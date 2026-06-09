import { Component, Behavior, ContextManager, Observable, started } from "@zcomponent/core";
import { EstuaryClient } from "@estuary-ai/sdk";
import type { CharacterAction, InterruptData } from "@estuary-ai/sdk";
import type { default as SceneType } from "./Scene.zcomp";
import { Vector3, Quaternion, Object3D, MathUtils } from "three";

type AnimationState = "notEngaged" | "approaching" | "isConversating";

interface ConstructionProps {
	patrolBoundaryParent?: string;
	walkSpeed?: number;
	minPauseInterval?: number;
	maxPauseInterval?: number;
	minPauseDuration?: number;
	maxPauseDuration?: number;
	conversatingIdleWeight?: number;
	conversatingLickingWeight?: number;
	conversatingSpreadWeight?: number;
	proximityRadius?: number;
	conversatingTimeout?: number;
	turnSpeed?: number;
	openingLine?: string;
}

/**
 * @zbehavior
 * Controls a peacock character that patrols an area and engages with nearby viewers.
 * Subscribes to EstuaryClient events via window.__estuaryClient.
 **/
export class SampleCharacterAnimator extends Behavior<Component> {

	// ─── Inspector properties ────────────────────────────────────────

	/**
	 * Name of the scene group whose children define the patrol polygon boundary.
	 * Children are connected as polygon vertices in scene hierarchy order.
	 * Minimum 3 children required.
	 * @zui
	 * @zdefault ""
	 */
	public patrolBoundaryParent = new Observable<string>("");

	/**
	 * Walking speed during patrol in meters per second
	 * @zui
	 * @zdefault 1.0
	 */
	public walkSpeed = new Observable<number>(1.0);

	/**
	 * Minimum seconds of walking between pauses
	 * @zui
	 * @zdefault 3.0
	 */
	public minPauseInterval = new Observable<number>(3.0);

	/**
	 * Maximum seconds of walking between pauses
	 * @zui
	 * @zdefault 8.0
	 */
	public maxPauseInterval = new Observable<number>(8.0);

	/**
	 * Minimum duration of a patrol pause in seconds
	 * @zui
	 * @zdefault 1.0
	 */
	public minPauseDuration = new Observable<number>(1.0);

	/**
	 * Maximum duration of a patrol pause in seconds
	 * @zui
	 * @zdefault 3.0
	 */
	public maxPauseDuration = new Observable<number>(3.0);

	/**
	 * Relative likelihood of Peacock_A15_Idle during conversation
	 * @zui
	 * @zdefault 1.0
	 */
	public conversatingIdleWeight = new Observable<number>(1.0);

	/**
	 * Relative likelihood of Peacock_A15_lickingfeathers during conversation
	 * @zui
	 * @zdefault 1.0
	 */
	public conversatingLickingWeight = new Observable<number>(1.0);

	/**
	 * Relative likelihood of Peacock_A15_SpreadFeathers2 during conversation
	 * @zui
	 * @zdefault 1.0
	 */
	public conversatingSpreadWeight = new Observable<number>(1.0);

	/**
	 * Distance in meters at which the character engages a viewer for the first time
	 * @zui
	 * @zdefault 2.0
	 */
	public proximityRadius = new Observable<number>(2.0);

	/**
	 * Seconds of silence before the character returns to patrol
	 * @zui
	 * @zdefault 7.0
	 */
	public conversatingTimeout = new Observable<number>(7.0);

	/**
	 * Rotation speed when turning to face the viewer
	 * @zui
	 * @zdefault 3.0
	 */
	public turnSpeed = new Observable<number>(3.0);

	/**
	 * Scripted opening line spoken (via Estuary's "say line" / TTS) the first time
	 * the character greets a viewer.
	 * @zui
	 * @zdefault "Walk softly, and look down. Fourteen feet below, the bones of Old Chinatown were sealed. Beneath the concrete and the ballast and the rails, Peacock Alley still lies."
	 */
	public openingLine = new Observable<string>(
		"Walk softly, and look down. Fourteen feet below, the bones of Old Chinatown were sealed. Beneath the concrete and the ballast and the rails, Peacock Alley still lies."
	);

	// ─── Private state ───────────────────────────────────────────────

	private _state: AnimationState = "notEngaged";
	private _hasGreeted = false;
	private _isTurning = false;

	private _homePosition = new Vector3();
	private _camera: Object3D | null = null;
	// The actual root scene Comp — found by walking instance.parent to the top
	private _rootScene: SceneType | null = null;
	private _animFrameId: number | null = null;
	private _lastTime = 0;
	private _clientPollInterval: ReturnType<typeof setInterval> | null = null;
	private _client: EstuaryClient | null = null;
	private _inactivityTimer: ReturnType<typeof setTimeout> | null = null;

	// Bound event handlers for cleanup
	private _boundOnCharacterAction: ((action: CharacterAction) => void) | null = null;
	private _boundOnAudioPlaybackStarted: ((messageId: string) => void) | null = null;
	private _boundOnAudioPlaybackComplete: ((messageId: string) => void) | null = null;
	private _boundOnInterrupt: ((data: InterruptData) => void) | null = null;

	// ─── isConversating state ────────────────────────────────────────

	private _convAnimTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly _CONVERSATING_IDLE_DURATION_S = 3.0;

	// ─── Patrol state ────────────────────────────────────────────────

	// Update these to match the actual clip lengths in your scene
	private readonly _LICKING_FEATHERS_DURATION_S = 3.0;
	private readonly _SPREAD_FEATHERS_DURATION_S = 4.0;

	private _patrolWaypoint = new Vector3();
	private _patrolIsPaused = false;
	private _patrolPauseTimer: ReturnType<typeof setTimeout> | null = null;
	private _patrolIntervalTimer: ReturnType<typeof setTimeout> | null = null;
	private _patrolFallbackIdleTimer: ReturnType<typeof setTimeout> | null = null;
	private _patrolAnimState: "walk" | "pausing" | "none" = "none";

	// ─── Reusable temporaries ────────────────────────────────────────

	private _tmpVec = new Vector3();
	private _tmpVec2 = new Vector3();
	private _tmpQuat = new Quaternion();
	private _targetQuat = new Quaternion();

	// ─── VPS gate ────────────────────────────────────────────────────

	private _vpsReady = false;
	private _boundOnVpsLocalized: (() => void) | null = null;

	// ─── Debug overlay ───────────────────────────────────────────────

	private _debugOverlay: HTMLElement | null = null;
	private _debugContent: HTMLElement | null = null;
	private _debugCollapsed = false;
	private _debugButtonComp: any = null;
	private _boundOnDebugToggle: ((e: MouseEvent) => void) | null = null;
	private _debugLastUpdate = 0;
	private _debugEvents: string[] = [];
	private _debugBoundaryStatus = "not yet sampled";
	private _debugLastAnimPath = "none yet";

	constructor(contextManager: ContextManager, instance: Component, protected constructorProps: ConstructionProps) {
		super(contextManager, instance);

		if (constructorProps.patrolBoundaryParent !== undefined) this.patrolBoundaryParent.value = constructorProps.patrolBoundaryParent;
		if (constructorProps.walkSpeed !== undefined) this.walkSpeed.value = constructorProps.walkSpeed;
		if (constructorProps.minPauseInterval !== undefined) this.minPauseInterval.value = constructorProps.minPauseInterval;
		if (constructorProps.maxPauseInterval !== undefined) this.maxPauseInterval.value = constructorProps.maxPauseInterval;
		if (constructorProps.minPauseDuration !== undefined) this.minPauseDuration.value = constructorProps.minPauseDuration;
		if (constructorProps.maxPauseDuration !== undefined) this.maxPauseDuration.value = constructorProps.maxPauseDuration;
		if (constructorProps.conversatingIdleWeight !== undefined) this.conversatingIdleWeight.value = constructorProps.conversatingIdleWeight;
		if (constructorProps.conversatingLickingWeight !== undefined) this.conversatingLickingWeight.value = constructorProps.conversatingLickingWeight;
		if (constructorProps.conversatingSpreadWeight !== undefined) this.conversatingSpreadWeight.value = constructorProps.conversatingSpreadWeight;
		if (constructorProps.proximityRadius !== undefined) this.proximityRadius.value = constructorProps.proximityRadius;
		if (constructorProps.conversatingTimeout !== undefined) this.conversatingTimeout.value = constructorProps.conversatingTimeout;
		if (constructorProps.turnSpeed !== undefined) this.turnSpeed.value = constructorProps.turnSpeed;
		if (constructorProps.openingLine !== undefined) this.openingLine.value = constructorProps.openingLine;

		started(this.contextManager).then(() => {
			this._initialize();
		});
	}

	// ─── Initialization ──────────────────────────────────────────────

	private get _obj(): Object3D {
		return (this.instance as any).element as Object3D;
	}

	private _initialize(): void {
		const obj = this._obj;
		this._homePosition.copy(obj.position);

		// Walk the Mattercraft component parent chain to reach the root scene Comp.
		// this.instance.parent = ImmersalAnchorGroup, not the root — must go all the way up.
		let rootComp: any = this.instance;
		while (rootComp?.parent) rootComp = rootComp.parent;
		this._rootScene = rootComp as SceneType;

		// ZapparCamera is a node on the root scene, accessed via nodes not Three.js traversal
		this._camera = (this._rootScene as any)?.nodes?.ZapparCamera?.element ?? null;
		if (!this._camera) {
			console.warn("SampleCharacterAnimator: ZapparCamera not found in scene nodes");
		}

		this._clientPollInterval = setInterval(() => {
			const client = (window as any).__estuaryClient as EstuaryClient | undefined;
			if (client) {
				clearInterval(this._clientPollInterval!);
				this._clientPollInterval = null;
				this._subscribeToClient(client);
			}
		}, 250);

		// Gate proximity detection on Immersal VPS localization to prevent a false
		// trigger while the anchor group is at world origin (before the first lock).
		const anchorComp = (this._rootScene as any)?.nodes?.ImmersalAnchorGroup;
		if (!anchorComp) {
			this._vpsReady = true;
		} else if (anchorComp.localized?.value === true) {
			this._vpsReady = true;
			this._logDebugEvent("VPS already locked");
		} else {
			this._boundOnVpsLocalized = () => {
				this._vpsReady = true;
				this._logDebugEvent("VPS locked — proximity enabled");
			};
			anchorComp.onLocalized?.addListener(this._boundOnVpsLocalized);
		}

		this._createDebugOverlay();
		this._enterNotEngaged();
		this._lastTime = performance.now();
		this._animFrameId = requestAnimationFrame(this._animateFrame);
	}

	private _subscribeToClient(client: EstuaryClient): void {
		this._client = client;

		this._boundOnCharacterAction = (action) => this._onCharacterAction(action);
		this._boundOnAudioPlaybackStarted = () => this._onAudioPlaybackStarted();
		this._boundOnAudioPlaybackComplete = () => this._onAudioPlaybackComplete();
		this._boundOnInterrupt = () => this._onInterrupt();

		client.on("characterAction", this._boundOnCharacterAction);
		client.on("audioPlaybackStarted", this._boundOnAudioPlaybackStarted);
		client.on("audioPlaybackComplete", this._boundOnAudioPlaybackComplete);
		client.on("interrupt", this._boundOnInterrupt);

		this._logDebugEvent("EstuaryClient connected");
		console.log("SampleCharacterAnimator: Subscribed to EstuaryClient events");
	}

	// ─── Animation helpers ───────────────────────────────────────────

	/**
	 * Plays an animation clip by searching the root scene animation and then all
	 * behaviors on Peacock_glb. Records which path succeeded in _debugLastAnimPath.
	 */
	private _play(layerName: string, clipName: string): void {
		// Try the root scene's top-level animation first
		const sceneClip = (this._rootScene as any)?.animation?.layers?.[layerName]?.clips?.[clipName];
		if (sceneClip) {
			sceneClip.play();
			this._debugLastAnimPath = `scene.${layerName}.${clipName}`;
			return;
		}
		// Search all animation behaviors on the Peacock_glb node
		const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
		if (behaviors) {
			for (const key of Object.keys(behaviors)) {
				const clip = behaviors[key]?.layers?.[layerName]?.clips?.[clipName];
				if (clip) {
					clip.play();
					this._debugLastAnimPath = `Peacock_glb.behaviors.${key} → ${layerName}`;
					return;
				}
			}
		}
		this._debugLastAnimPath = `NOT FOUND: ${layerName}`;
	}

	/**
	 * Smoothly rotates obj to face targetPos (in the same coordinate space that lookAt expects)
	 * using an exponential slerp. Call every frame for natural arc turns.
	 */
	private _smoothTurnToward(obj: Object3D, targetWorldPos: Vector3, dt: number): void {
		this._tmpQuat.copy(obj.quaternion);
		obj.lookAt(targetWorldPos);
		// Guard: lookAt produces NaN when target == object world position; keep current rotation.
		if (isNaN(obj.quaternion.x)) {
			obj.quaternion.copy(this._tmpQuat);
			return;
		}
		this._targetQuat.copy(obj.quaternion);
		obj.quaternion.copy(this._tmpQuat);
		const t = 1 - Math.exp(-this.turnSpeed.value * dt);
		obj.quaternion.slerp(this._targetQuat, t);
	}

	/** Returns the raw clip object for timeScale manipulation, or null if not found. */
	private _getClip(layerName: string, clipName: string): any | null {
		const sceneClip = (this._rootScene as any)?.animation?.layers?.[layerName]?.clips?.[clipName];
		if (sceneClip) return sceneClip;
		const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
		if (behaviors) {
			for (const key of Object.keys(behaviors)) {
				const clip = behaviors[key]?.layers?.[layerName]?.clips?.[clipName];
				if (clip) return clip;
			}
		}
		return null;
	}

	// ─── Animation loop ──────────────────────────────────────────────

	private _animateFrame = (time: number): void => {
		if (this._animFrameId === null) return;
		this._animate(time);
		this._animFrameId = requestAnimationFrame(this._animateFrame);
	};

	private _animate(time: number): void {
		const dt = Math.min((time - this._lastTime) / 1000, 0.1);
		this._lastTime = time;
		const obj = this._obj;

		this._updateDebugOverlay(time);

		switch (this._state) {
			case "notEngaged": {
				// Proximity trigger — only fires on the first encounter
				if (this._camera && !this._hasGreeted && this._vpsReady) {
					obj.getWorldPosition(this._tmpVec);
					const charX = this._tmpVec.x, charZ = this._tmpVec.z;
					this._camera.getWorldPosition(this._tmpVec);
					const dx = this._tmpVec.x - charX, dz = this._tmpVec.z - charZ;
					const r = this.proximityRadius.value;
					if (dx * dx + dz * dz < r * r) {
						this._enterApproaching();
						break;
					}
				}

				// Patrol movement
				if (!this.patrolBoundaryParent.value) break;

				if (!this._patrolIsPaused) {
					if (this._patrolAnimState !== "walk") {
						this._patrolAnimState = "walk";
						this._play("Peacock_A15_Walk", "Peacock_A15_Walk");
					}
					// _patrolWaypoint is fixed in WORLD space (the boundary markers don't move),
					// but obj.parent (ImmersalAnchorGroup's tracker group) has its pose recomputed
					// from the live VPS/world-tracking anchor every frame — so re-derive the
					// local-space target fresh, every frame, rather than caching a stale snapshot.
					this._tmpVec2.copy(this._patrolWaypoint);
					if (obj.parent) obj.parent.worldToLocal(this._tmpVec2);

					const dx = this._tmpVec2.x - obj.position.x;
					const dz = this._tmpVec2.z - obj.position.z;
					const dist = Math.sqrt(dx * dx + dz * dz);
					if (dist > 0.05) {
						// Always step directly toward the target — this guarantees the distance
						// shrinks every frame regardless of how quickly the heading catches up.
						// (The "walk in current facing direction" approach tried previously is a
						// pursuit-style algorithm: if turnSpeed can't keep up with walkSpeed, the
						// character can orbit/spiral outward and never converge — which is exactly
						// what sent it off outside the patrol boundary.)
						const step = Math.min(this.walkSpeed.value * dt, dist);
						obj.position.x += (dx / dist) * step;
						obj.position.z += (dz / dist) * step;

						// Smoothly rotate to face the direction of travel — lookAt expects world
						// space, so use the fixed world-space waypoint at the character's current
						// world height (horizontal look). This still gives a natural turning
						// appearance without making the walked path itself depend on the turn.
						obj.getWorldPosition(this._tmpVec);
						this._tmpVec.set(this._patrolWaypoint.x, this._tmpVec.y, this._patrolWaypoint.z);
						this._smoothTurnToward(obj, this._tmpVec, dt);
					} else {
						this._pickNextPatrolWaypoint();
					}
				}
				break;
			}

			case "approaching": {
				if (this._camera) {
					// _tmpVec2 = camera world pos (world space, needed for lookAt)
					this._camera.getWorldPosition(this._tmpVec2);
					this._tmpVec2.y = obj.position.y; // horizontal look

					// _tmpVec = camera pos in parent-local space (matches obj.position space)
					this._tmpVec.copy(this._tmpVec2);
					if (obj.parent) obj.parent.worldToLocal(this._tmpVec);
					this._tmpVec.y = obj.position.y;

					const dx = this._tmpVec.x - obj.position.x;
					const dz = this._tmpVec.z - obj.position.z;
					const dist = Math.sqrt(dx * dx + dz * dz);

					// Abort if viewer has walked away
					const abandonDist = this.proximityRadius.value * 1.5;
					if (dist > abandonDist) {
						this._logDebugEvent("viewer left — resuming patrol");
						this._state = "notEngaged";
						this._enterNotEngaged();
						break;
					}

					// Arrived within greeting distance — trigger introduction
					const greetDist = 1.0;
					if (dist <= greetDist) {
						this._enterConversating(true);
						break;
					}

					// Walk toward the viewer (in local space), stopping greetDist short
					if (dist > 0) {
						const step = Math.min(this.walkSpeed.value * dt, dist - greetDist);
						if (step > 0) {
							obj.position.x += (dx / dist) * step;
							obj.position.z += (dz / dist) * step;
						}
					}
					// Rotate using world-space camera position (lookAt expects world space)
					this._smoothTurnToward(obj, this._tmpVec2, dt);
				}
				break;
			}

			case "isConversating": {
				if (this._camera) {
					// Compute the quaternion the character would need to face the camera.
					// lookAt expects world space — keep world coords, only adjust y for horizontal look.
					this._camera.getWorldPosition(this._tmpVec);
					this._tmpVec.y = obj.position.y; // approx horizontal; local y ≈ world y for floor-level AR

					// Sample the target quaternion without yet applying it
					this._tmpQuat.copy(obj.quaternion);
					obj.lookAt(this._tmpVec);
					this._targetQuat.copy(obj.quaternion);
					obj.quaternion.copy(this._tmpQuat);

					const angularDist = obj.quaternion.angleTo(this._targetQuat);

					const TURN_ON  = 0.087; // ~5° — start turning
					const TURN_OFF = 0.035; // ~2° — stop turning (hysteresis)

					if (!this._isTurning && angularDist > TURN_ON) {
						this._isTurning = true;
						this._clearConversatingTimers();
						const walkClip = this._getClip("Peacock_A15_Walk", "Peacock_A15_Walk");
						if (walkClip) {
							walkClip.timeScale = 0.4;
							walkClip.play();
						}
					} else if (this._isTurning && angularDist < TURN_OFF) {
						this._isTurning = false;
						const walkClip = this._getClip("Peacock_A15_Walk", "Peacock_A15_Walk");
						if (walkClip) walkClip.timeScale = 1.0;
						this._pickConversatingAnim();
					}

					if (this._isTurning) {
						const t = 1 - Math.exp(-this.turnSpeed.value * dt);
						obj.quaternion.slerp(this._targetQuat, t);
					}
				}
				break;
			}
		}
	}

	// ─── Event handlers ──────────────────────────────────────────────

	private _onCharacterAction(_action: CharacterAction): void {
		// Reserved for future character actions
	}

	private _onAudioPlaybackStarted(): void {
		if (this._state === "notEngaged" && this._hasGreeted) {
			this._logDebugEvent("audio started → re-enter conversating");
			this._enterConversating(false);
		} else if (this._state === "isConversating") {
			this._resetInactivityTimer();
		}
	}

	private _onAudioPlaybackComplete(): void {
		if (this._state === "isConversating") {
			this._resetInactivityTimer();
		}
	}

	private _onInterrupt(): void {
		if (this._state === "isConversating") {
			this._resetInactivityTimer();
		}
	}

	// ─── isConversating helpers ──────────────────────────────────────

	private _enterApproaching(): void {
		this._clearPatrolTimers();
		this._clearConversatingTimers();
		this._isTurning = false;
		this._state = "approaching";
		this._patrolAnimState = "none";
		this._play("Peacock_A15_Walk", "Peacock_A15_Walk");
		this._logDebugEvent("→ approaching viewer");
	}

	private _enterConversating(greet: boolean): void {
		this._clearPatrolTimers();
		this._clearConversatingTimers();
		this._isTurning = false;
		this._state = "isConversating";

		if (greet) {
			const line = this.openingLine.value.trim();
			if (line && this._client) {
				this._client.sayLine(line);
				this._logDebugEvent("spoke opening line");
			} else {
				console.log("SampleCharacterAnimator: Greeting viewer (no client/line)");
				this._resetInactivityTimer();
			}
			// Timer starts in _onAudioPlaybackComplete so the 7s counts down
			// after speech finishes, not while it's still playing.
		} else {
			this._resetInactivityTimer();
		}
		this._pickConversatingAnim();
		this._logDebugEvent(`→ isConversating (greet=${greet})`);
	}

	private _resetInactivityTimer(): void {
		if (this._inactivityTimer !== null) clearTimeout(this._inactivityTimer);
		this._inactivityTimer = setTimeout(() => {
			this._inactivityTimer = null;
			if (this._state === "isConversating") {
				this._hasGreeted = true;
				this._clearConversatingTimers();
				this._state = "notEngaged";
				this._enterNotEngaged();
				this._logDebugEvent("inactivity timeout → patrol");
			}
		}, this.conversatingTimeout.value * 1000);
	}

	private _pickConversatingAnim(): void {
		const idleW   = Math.max(0, this.conversatingIdleWeight.value);
		const lickW   = Math.max(0, this.conversatingLickingWeight.value);
		const spreadW = Math.max(0, this.conversatingSpreadWeight.value);
		const total = idleW + lickW + spreadW;
		const roll = Math.random() * (total || 1);

		let clipDuration: number;
		if (roll < idleW || total === 0) {
			this._play("Peacock_A15_Idle", "Peacock_A15_Idle");
			clipDuration = this._CONVERSATING_IDLE_DURATION_S;
		} else if (roll < idleW + lickW) {
			this._play("Peacock_A15_lickingfeathers", "Peacock_A15_lickingfeathers");
			clipDuration = this._LICKING_FEATHERS_DURATION_S;
		} else {
			this._play("Peacock_A15_SpreadFeathers2", "Peacock_A15_SpreadFeathers2");
			clipDuration = this._SPREAD_FEATHERS_DURATION_S;
		}

		this._convAnimTimer = setTimeout(() => {
			this._convAnimTimer = null;
			if (this._state === "isConversating" && !this._isTurning) {
				this._pickConversatingAnim();
			}
		}, clipDuration * 1000);
	}

	private _clearConversatingTimers(): void {
		if (this._convAnimTimer !== null) {
			clearTimeout(this._convAnimTimer);
			this._convAnimTimer = null;
		}
	}

	// ─── Patrol helpers ──────────────────────────────────────────────

	private _enterNotEngaged(): void {
		this._clearPatrolTimers();
		this._patrolIsPaused = false;
		this._patrolAnimState = "none";
		this._pickNextPatrolWaypoint();
		this._startPatrolPauseInterval();
	}

	private _pickNextPatrolWaypoint(): void {
		const verts = this._getPatrolBoundaryVertices();
		if (!verts) return;
		const pt = this._samplePointInPolygon(verts);
		// Stored in WORLD space — see the comment in _animate's "notEngaged" patrol
		// movement for why this must NOT be pre-converted to the character's
		// parent-local space here. (y is unused downstream — _animate overrides it
		// for the lookAt target and the distance/movement math only reads x/z — so
		// it's left at 0 rather than mixing in a parent-local value.)
		this._patrolWaypoint.set(pt.x, 0, pt.z);
	}

	private _startPatrolPauseInterval(): void {
		const interval = MathUtils.randFloat(this.minPauseInterval.value, this.maxPauseInterval.value);
		this._patrolIntervalTimer = setTimeout(() => {
			this._patrolIntervalTimer = null;
			this._beginPatrolPause();
		}, interval * 1000);
	}

	private _beginPatrolPause(): void {
		this._patrolIsPaused = true;
		this._patrolAnimState = "pausing";

		const duration = MathUtils.randFloat(this.minPauseDuration.value, this.maxPauseDuration.value);
		this._patrolPauseTimer = setTimeout(() => {
			this._patrolPauseTimer = null;
			this._endPatrolPause();
		}, duration * 1000);

		const roll = Math.floor(Math.random() * 3);
		if (roll === 0) {
			this._play("Peacock_A15_Idle", "Peacock_A15_Idle");
		} else {
			const isLicking = roll === 1;
			const clipDuration = isLicking ? this._LICKING_FEATHERS_DURATION_S : this._SPREAD_FEATHERS_DURATION_S;

			if (isLicking) {
				this._play("Peacock_A15_lickingfeathers", "Peacock_A15_lickingfeathers");
			} else {
				this._play("Peacock_A15_SpreadFeathers2", "Peacock_A15_SpreadFeathers2");
			}

			if (duration > clipDuration) {
				this._patrolFallbackIdleTimer = setTimeout(() => {
					this._patrolFallbackIdleTimer = null;
					if (this._patrolIsPaused) {
						this._play("Peacock_A15_Idle", "Peacock_A15_Idle");
					}
				}, clipDuration * 1000);
			}
		}
	}

	private _endPatrolPause(): void {
		this._patrolIsPaused = false;
		this._patrolAnimState = "none";
		this._pickNextPatrolWaypoint();
		this._startPatrolPauseInterval();
	}

	private _clearPatrolTimers(): void {
		if (this._patrolPauseTimer !== null) { clearTimeout(this._patrolPauseTimer); this._patrolPauseTimer = null; }
		if (this._patrolIntervalTimer !== null) { clearTimeout(this._patrolIntervalTimer); this._patrolIntervalTimer = null; }
		if (this._patrolFallbackIdleTimer !== null) { clearTimeout(this._patrolFallbackIdleTimer); this._patrolFallbackIdleTimer = null; }
	}

	// ─── Polygon helpers ─────────────────────────────────────────────

	/** Returns world-XZ positions of the boundary group's children in hierarchy order, or null if unavailable. */
	private _getPatrolBoundaryVertices(): Array<{ x: number; z: number }> | null {
		const name = this.patrolBoundaryParent.value;
		if (!name) return null;

		// All scene nodes are flat under _rootScene.nodes regardless of hierarchy depth
		const groupComp = (this._rootScene as any)?.nodes?.[name];
		const group: Object3D | null = (groupComp as any)?.element ?? null;

		if (!group) {
			this._debugBoundaryStatus = `nodes["${name}"] = ${typeof groupComp} — NOT FOUND ⚠`;
			return null;
		}
		if (group.children.length < 3) {
			this._debugBoundaryStatus = `found but only ${group.children.length} children (need ≥3)`;
			return null;
		}

		this._debugBoundaryStatus = `ok — ${group.children.length} vertices`;
		// Keep these in WORLD space — the boundary markers are fixed in the world
		// (children of the static root group), so this is the space they actually
		// live in. Do NOT convert to the character's parent-local space here: that
		// conversion must be done fresh every frame against the live parent
		// transform (see _animate's "notEngaged" patrol movement) since
		// ImmersalAnchorGroup's pose is continuously recomputed by VPS tracking.
		return group.children.map(child => {
			child.getWorldPosition(this._tmpVec);
			return { x: this._tmpVec.x, z: this._tmpVec.z };
		});
	}

	/** Samples a uniformly random point inside a simple (convex or concave) polygon. */
	private _samplePointInPolygon(verts: Array<{ x: number; z: number }>): { x: number; z: number } {
		const tris = this._triangulatePolygon(verts);

		let totalArea = 0;
		const areas = tris.map(([ai, bi, ci]) => {
			const a = verts[ai], b = verts[bi], c = verts[ci];
			const area = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) * 0.5;
			totalArea += area;
			return area;
		});

		let roll = Math.random() * totalArea;
		let triIdx = tris.length - 1;
		for (let i = 0; i < areas.length; i++) {
			roll -= areas[i];
			if (roll <= 0) { triIdx = i; break; }
		}

		const [ai, bi, ci] = tris[triIdx];
		const a = verts[ai], b = verts[bi], c = verts[ci];
		let r1 = Math.random(), r2 = Math.random();
		if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }

		return {
			x: a.x + r1 * (b.x - a.x) + r2 * (c.x - a.x),
			z: a.z + r1 * (b.z - a.z) + r2 * (c.z - a.z),
		};
	}

	/**
	 * Ear-clipping triangulation for simple (possibly concave) polygons.
	 * Automatically handles both CW and CCW vertex winding.
	 * Returns index triples into the original verts array.
	 */
	private _triangulatePolygon(verts: Array<{ x: number; z: number }>): Array<[number, number, number]> {
		const n = verts.length;
		if (n < 3) return [];
		if (n === 3) return [[0, 1, 2]];

		// Compute signed area to detect winding; normalize to CCW
		let signedArea = 0;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			signedArea += verts[i].x * verts[j].z - verts[j].x * verts[i].z;
		}
		const idxs = Array.from({ length: n }, (_, i) => i);
		if (signedArea < 0) idxs.reverse();

		const triangles: Array<[number, number, number]> = [];
		let safety = n * n;

		while (idxs.length > 3 && --safety > 0) {
			let clipped = false;
			for (let i = 0; i < idxs.length; i++) {
				const pi = (i - 1 + idxs.length) % idxs.length;
				const ni = (i + 1) % idxs.length;
				const prev = idxs[pi], curr = idxs[i], next = idxs[ni];
				if (this._isEar(verts, idxs, prev, curr, next)) {
					triangles.push([prev, curr, next]);
					idxs.splice(i, 1);
					clipped = true;
					break;
				}
			}
			if (!clipped) break;
		}

		if (idxs.length >= 3) triangles.push([idxs[0], idxs[1], idxs[2]]);
		return triangles;
	}

	private _isEar(
		verts: Array<{ x: number; z: number }>,
		idxs: number[],
		prev: number, curr: number, next: number
	): boolean {
		const a = verts[prev], b = verts[curr], c = verts[next];
		if ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) <= 0) return false;
		for (const idx of idxs) {
			if (idx === prev || idx === curr || idx === next) continue;
			if (this._pointInTriangle(verts[idx], a, b, c)) return false;
		}
		return true;
	}

	private _pointInTriangle(
		p: { x: number; z: number },
		a: { x: number; z: number },
		b: { x: number; z: number },
		c: { x: number; z: number }
	): boolean {
		const d1 = (p.x - b.x) * (a.z - b.z) - (a.x - b.x) * (p.z - b.z);
		const d2 = (p.x - c.x) * (b.z - c.z) - (b.x - c.x) * (p.z - c.z);
		const d3 = (p.x - a.x) * (c.z - a.z) - (c.x - a.x) * (p.z - a.z);
		return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
	}

	// ─── Debug overlay ───────────────────────────────────────────────

	/** Scans scene nodes for the first @zcomponent/html Button component. */
	private _findDebugButtonComp(): any | null {
		const nodes = (this._rootScene as any)?.nodes;
		if (!nodes) return null;
		for (const key of Object.keys(nodes)) {
			const node = nodes[key];
			if (node?.element instanceof HTMLButtonElement) return node;
		}
		return null;
	}

	private _createDebugOverlay(): void {
		// Pin the DebugOverlay HTML component to top-left of screen via Mattercraft properties.
		const overlayComp = (this._rootScene as any)?.nodes?.DebugOverlay;
		if (overlayComp) {
			overlayComp.horizontalAnchor = "left";
			overlayComp.verticalAnchor = "top";
		}

		// Find the Mattercraft Button component in the scene to use as the toggle header.
		const buttonComp = this._findDebugButtonComp();

		// The content area — a raw div placed inside the button's container.
		const contentEl = document.createElement("div");
		contentEl.style.cssText = "margin-top:4px;white-space:pre";
		this._debugContent = contentEl;

		if (buttonComp) {
			this._debugButtonComp = buttonComp;

			// Initial label
			buttonComp.innerText.value = "▼ Debug";

			// Style the button via its DOM element.
			// Explicit pointer-events:auto is required — the HTML overlay container
			// typically has pointer-events:none, and inheriting it would block clicks.
			const btnEl: HTMLButtonElement = buttonComp.element;
			btnEl.style.cssText = [
				"cursor:pointer",
				"font:bold 11px/1.4 monospace",
				"color:#7fff7f",
				"background:rgba(0,0,0,0.82)",
				"border:1px solid rgba(127,255,127,0.4)",
				"border-radius:3px",
				"padding:4px 10px",
				"pointer-events:auto",
				"width:100%",
				"box-sizing:border-box",
				"text-align:left",
			].join(";");

			// Style the container that Mattercraft created to hold the button,
			// and append the content div as a sibling inside it.
			const container = btnEl.parentElement;
			if (container) {
				container.style.cssText = [
					"background:rgba(0,0,0,0.82)",
					"color:#7fff7f",
					"font:11px/1.6 monospace",
					"padding:8px 12px",
					"border-radius:5px",
					"pointer-events:auto",
					"min-width:220px",
					"margin-top:65px",
				].join(";");
				container.appendChild(contentEl);
				this._debugOverlay = container;
			}

			// Register click via Mattercraft's onClick Event — this survives re-renders.
			this._boundOnDebugToggle = () => {
				this._debugCollapsed = !this._debugCollapsed;
				contentEl.style.display = this._debugCollapsed ? "none" : "";
				buttonComp.innerText.value = this._debugCollapsed ? "▶ Debug" : "▼ Debug";
			};
			buttonComp.onClick.addListener(this._boundOnDebugToggle);
		} else {
			// Fallback: no Mattercraft button found — create a standalone fixed overlay.
			const el = document.createElement("div");
			el.id = "sam-debug-fallback";
			el.style.cssText = [
				"position:fixed", "top:75px", "left:10px", "z-index:9999",
				"background:rgba(0,0,0,0.82)", "color:#7fff7f",
				"font:11px/1.6 monospace", "padding:8px 12px",
				"border-radius:5px", "pointer-events:none",
			].join(";");
			el.appendChild(contentEl);
			document.body.appendChild(el);
			this._debugOverlay = el;
		}

		this._logDebugEvent("initialized");
	}

	private _logDebugEvent(msg: string): void {
		const t = (performance.now() / 1000).toFixed(1);
		this._debugEvents.unshift(`[${t}s] ${msg}`);
		if (this._debugEvents.length > 8) this._debugEvents.pop();
	}

	private _updateDebugOverlay(now: number): void {
		if (!this._debugOverlay || !this._debugContent) return;
		if (this._debugCollapsed) return;
		if (now - this._debugLastUpdate < 200) return;
		this._debugLastUpdate = now;

		const obj = this._obj;

		// Camera distance — use separate vec to avoid corrupting _tmpVec mid-frame
		const cp = new Vector3();
		let camDist = "—", camXYZ = "—";
		if (this._camera) {
			obj.getWorldPosition(cp);
			const cx = cp.x, cz = cp.z;
			this._camera.getWorldPosition(cp);
			camDist = Math.sqrt((cp.x - cx) ** 2 + (cp.z - cz) ** 2).toFixed(2) + "m";
			camXYZ = `(${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, ${cp.z.toFixed(2)})`;
		}

		// Character world position
		obj.getWorldPosition(cp);
		const charXYZ = `(${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, ${cp.z.toFixed(2)})`;

		// Enumerate all animation behavior layers on Peacock_glb
		const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
		const animInfo: string[] = [];
		if (behaviors) {
			for (const bkey of Object.keys(behaviors)) {
				const beh = behaviors[bkey];
				const layers = beh?.layers;
				if (layers) {
					const lkeys = Object.keys(layers);
					animInfo.push(`  ${bkey}: [${lkeys.join(", ")}]`);
				}
			}
		}
		if (animInfo.length === 0) animInfo.push("  (no behaviors with layers found)");

		const bpName = this.patrolBoundaryParent.value;
		const wp = this._patrolWaypoint;

		// Visibility chain: obj + all ancestors
		let visChain = "";
		{
			let node: Object3D | null = obj;
			while (node) { visChain = (node.visible ? "✓" : "✗") + visChain; node = node.parent; }
		}
		const matNaN = isNaN(obj.matrixWorld.elements[0]);

		const lines = [
			"── CharacterAnimator Debug ─────",
			`state:         ${this._state}`,
			`vpsReady:      ${this._vpsReady}`,
			`visible chain: ${visChain}  matNaN:${matNaN}`,
			`camera:        ${this._camera ? "found" : "NOT FOUND ⚠"}`,
			`camWorldPos:   ${camXYZ}`,
			`charWorldPos:  ${charXYZ}`,
			`camDist:       ${camDist}  (r=${this.proximityRadius.value}m)`,
			`estuaryClient: ${this._client ? "connected" : "waiting…"}`,
			"",
			"── Patrol ──────────────────────",
			`boundaryParent: "${bpName || "(empty)"}"`,
			`boundary:      ${this._debugBoundaryStatus}`,
			`animState:     ${this._patrolAnimState}`,
			`waypoint:      (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)})`,
			"",
			"── Animation ───────────────────",
			`lastPlay:      ${this._debugLastAnimPath}`,
			"Peacock_glb behaviors:",
			...animInfo,
			"",
			"── Events ──────────────────────",
			...this._debugEvents,
		];

		this._debugContent.innerHTML = lines.join("<br>");
	}

	// ─── Dispose ─────────────────────────────────────────────────────

	dispose() {
		if (this._animFrameId !== null) {
			cancelAnimationFrame(this._animFrameId);
			this._animFrameId = null;
		}
		if (this._inactivityTimer !== null) {
			clearTimeout(this._inactivityTimer);
			this._inactivityTimer = null;
		}
		this._clearConversatingTimers();
		this._clearPatrolTimers();
		if (this._clientPollInterval !== null) {
			clearInterval(this._clientPollInterval);
			this._clientPollInterval = null;
		}
		if (this._client) {
			if (this._boundOnCharacterAction) this._client.off("characterAction", this._boundOnCharacterAction);
			if (this._boundOnAudioPlaybackStarted) this._client.off("audioPlaybackStarted", this._boundOnAudioPlaybackStarted);
			if (this._boundOnAudioPlaybackComplete) this._client.off("audioPlaybackComplete", this._boundOnAudioPlaybackComplete);
			if (this._boundOnInterrupt) this._client.off("interrupt", this._boundOnInterrupt);
			this._client = null;
		}
		if (this._boundOnVpsLocalized) {
			const anchorComp = (this._rootScene as any)?.nodes?.ImmersalAnchorGroup;
			anchorComp?.onLocalized?.removeListener(this._boundOnVpsLocalized);
			this._boundOnVpsLocalized = null;
		}
		if (this._debugButtonComp && this._boundOnDebugToggle) {
			this._debugButtonComp.onClick.removeListener(this._boundOnDebugToggle);
			this._boundOnDebugToggle = null;
			this._debugButtonComp = null;
		}
		return super.dispose();
	}
}
