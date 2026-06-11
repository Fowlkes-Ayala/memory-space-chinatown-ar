import { Component, Behavior, ContextManager, Observable, started } from "@zcomponent/core";
import { EstuaryClient } from "@estuary-ai/sdk";
import type { CharacterAction, InterruptData } from "@estuary-ai/sdk";
import type { default as SceneType } from "./Scene.zcomp";
import { Vector3, Quaternion, Object3D, MathUtils } from "three";

type AnimationState = "notEngaged" | "approaching" | "isConversating";

/** Semantic animation behaviours, mapped to scene layer/clip names in `_ANIM`. */
type AnimKey = "walk" | "idle" | "preen" | "shake" | "display";

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
	crossfadeTime?: number;
	displayChance?: number;
	noticeDuration?: number;
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
	 * Relative likelihood of preening (calm grooming) during conversation —
	 * mostly a "listening" comfort behaviour; suppressed while actually speaking.
	 * @zui
	 * @zdefault 1.0
	 */
	public conversatingLickingWeight = new Observable<number>(1.0);

	/**
	 * Relative likelihood of expressive feather movement during conversation —
	 * mostly a quick feather-shake, occasionally a full tail display for emphasis
	 * (the full display is further gated by displayChance).
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

	/**
	 * Crossfade duration (seconds) used when blending between animations.
	 * Larger = softer, more sluggish transitions; smaller = snappier.
	 * @zui
	 * @zdefault 0.35
	 */
	public crossfadeTime = new Observable<number>(0.35);

	/**
	 * Probability (0–1) that a wander pause becomes a full tail-feather display
	 * (the big "showing off" spread) rather than a calmer idle/preen/shake.
	 * Kept low — a full display is a special, deliberate act.
	 * @zui
	 * @zdefault 0.1
	 */
	public displayChance = new Observable<number>(0.1);

	/**
	 * Seconds the character spends noticing/orienting toward a viewer before it
	 * begins walking over — the "it just spotted you and looked up" beat.
	 * @zui
	 * @zdefault 0.6
	 */
	public noticeDuration = new Observable<number>(0.6);

	// ─── Private state ───────────────────────────────────────────────

	private _state: AnimationState = "notEngaged";
	private _hasGreeted = false;
	private _isTurning = false;
	private _isSpeaking = false;

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
	private _boundOnSttResponse: ((payload: { text: string; isFinal: boolean }) => void) | null = null;

	// ─── Animation / crossfade ───────────────────────────────────────

	// Maps semantic behaviours to the actual scene animation layer+clip names.
	// (These come straight from Scene.zcomp.d.ts — note the irregular layer
	//  names like "Peacock_A15_" for the preen clip.)
	//   display = full tail spread (rare, deliberate "showing off")
	//   shake   = quick feather ruffle/shake (common little comfort beat)
	private static readonly _ANIM: Record<AnimKey, { layer: string; clip: string }> = {
		walk:    { layer: "Peacock_A15_Walk",             clip: "Peacock_A15_Walk" },
		idle:    { layer: "Peacock_A15_Idle",             clip: "Peacock_A15_Idle" },
		preen:   { layer: "Peacock_A15_",                 clip: "Peacock_A15_licking_feathers" },
		shake:   { layer: "Peacock_A15_Spread_feathers2", clip: "Peacock_A15_Spread_feathers2" },
		display: { layer: "Peacock_A15_Spread_feathers",  clip: "Peacock_A15_Spreadfeathers" },
	};

	private _currentAnimKey: AnimKey | null = null;
	private _playingClips: any[] = [];

	// Natural clip durations (seconds) — used to schedule one-shot follow-ups.
	private readonly _PREEN_DURATION_S = 6.53;
	private readonly _SHAKE_DURATION_S = 8.33;
	private readonly _DISPLAY_DURATION_S = 7.33;

	// ─── isConversating state ────────────────────────────────────────

	private _convAnimTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly _CONVERSATING_IDLE_DURATION_S = 3.0;

	// ─── Locomotion (eased velocity — keeps starts/stops from being robotic) ──

	private _speed = 0;                       // current ground speed, m/s (eased)
	private readonly _ACCEL = 2.4;            // m/s² ramp toward target speed
	private readonly _ARRIVE_DIST = 0.08;     // m — close enough to count as arrived
	private readonly _ARRIVE_DECEL_K = 2.6;   // higher = brakes later/harder near target

	// ─── Wander / forage state ───────────────────────────────────────

	private _patrolWaypoint = new Vector3();
	private _wanderSub: "stroll" | "settle" = "settle";
	private _strollSpeedFactor = 1;           // small per-stroll speed variation
	private _patrolPauseTimer: ReturnType<typeof setTimeout> | null = null;       // settle end
	private _patrolIntervalTimer: ReturnType<typeof setTimeout> | null = null;    // reserved
	private _patrolFallbackIdleTimer: ReturnType<typeof setTimeout> | null = null;// settle tail
	private _patrolAnimState: string = "none";

	// Gentle idle look-around so the bird is never frozen while settled.
	private _lookPoint = new Vector3();
	private _hasLookPoint = false;
	private _nextLookTime = 0;

	// Approach "notice" beat — orient before walking over.
	private _approachNoticeUntil = 0;
	private _greetOnArrival = true;

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
	private _debugSummaryLine: HTMLElement | null = null;
	private _debugCollapsed = false;
	private _debugButtonComp: any = null;
	private _boundOnDebugToggle: ((e: MouseEvent) => void) | null = null;
	private _debugLastUpdate = 0;
	private _debugEvents: string[] = [];
	private _debugBoundaryStatus = "not yet sampled";
	private _debugLastAnimPath = "none yet";
	private _timerLastReason = "—";
	private _timerStartedAt = 0;
	private _sdkEventLog: string[] = [];
	private _debugSections = new Map<string, { contentEl: HTMLElement; collapsed: boolean }>();

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
		if (constructorProps.crossfadeTime !== undefined) this.crossfadeTime.value = constructorProps.crossfadeTime;
		if (constructorProps.displayChance !== undefined) this.displayChance.value = constructorProps.displayChance;
		if (constructorProps.noticeDuration !== undefined) this.noticeDuration.value = constructorProps.noticeDuration;

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
		this._boundOnSttResponse = (payload) => this._onSttResponse(payload);

		client.on("characterAction", this._boundOnCharacterAction);
		client.on("audioPlaybackStarted", this._boundOnAudioPlaybackStarted);
		client.on("audioPlaybackComplete", this._boundOnAudioPlaybackComplete);
		client.on("interrupt", this._boundOnInterrupt);
		client.on("sttResponse", this._boundOnSttResponse);

		this._logDebugEvent("EstuaryClient connected");
		console.log("SampleCharacterAnimator: Subscribed to EstuaryClient events");
	}

	// ─── Animation helpers ───────────────────────────────────────────

	/**
	 * Crossfades to a semantic animation. Every clip lives on its own separate layer,
	 * so blending between clips requires a two-sided operation:
	 *
	 *   Fade IN:  play() with {fade} on the incoming clip — the layer's
	 *             computePathProperty interpolates from valueBefore (the output of
	 *             all earlier layers, which includes the outgoing clip's pose) to
	 *             this clip's pose over crossfadeTime.
	 *
	 *   Fade OUT: inject a null entry into the outgoing layer's internal queue and
	 *             make it the active entry (_fadeOutClip). computePathProperty then
	 *             interpolates from the clip's current pose → valueBefore (transparent)
	 *             over the same window. The old clip keeps playing (no frame-0 snap)
	 *             and is removed by the layer's own tick() once the fade is done.
	 *
	 * This approach works regardless of layer evaluation order and avoids both snaps
	 * that plagued the previous stop()-after-timeout strategy.
	 */
	private _setAnim(key: AnimKey, opts: { loop?: boolean; speed?: number; force?: boolean } = {}): void {
		const loop = opts.loop ?? false;
		// Don't restart a looping animation that's already the current one — that
		// would snap it back to frame 0 every call and kill the looping motion.
		if (!opts.force && loop && key === this._currentAnimKey) return;

		const { layer, clip: clipName } = SampleCharacterAnimator._ANIM[key];
		const clip = this._getClip(layer, clipName);
		if (!clip) {
			this._debugLastAnimPath = `NOT FOUND: ${layer}.${clipName}`;
			return;
		}

		const fadeTime = Math.max(0, this.crossfadeTime.value);
		// Speed is passed through play() — clip.timeScale doesn't exist on LayerClip.
		clip.play({ loop, speed: opts.speed ?? 1, fade: fadeTime > 0 ? { time: fadeTime } : undefined });
		this._debugLastAnimPath = `${key} → ${layer}`;
		this._currentAnimKey = key;

		// Simultaneously fade out every clip that was playing before this one.
		const outgoing = this._playingClips.filter(c => c !== clip);
		this._playingClips = [clip];
		for (const c of outgoing) {
			try { this._fadeOutClip(c, fadeTime); } catch { /* internal API — tolerate version differences */ }
		}
	}

	/**
	 * Fades the given clip's layer out to fully transparent over `fadeTime`, without
	 * snapping to frame 0. Works by injecting a null "sentinel" entry into the
	 * layer's internal _queue and promoting it to _active:
	 *
	 *   computePathProperty iterates [clip_entry, null_entry]:
	 *     clip_entry  (inactive): outputs clip_pose
	 *     null_entry  (active, fade): interpolates clip_pose → valueBefore over fadeTime
	 *
	 * The old clip keeps playing normally. The layer's own tick() removes clip_entry
	 * automatically once the fade window has elapsed.
	 */
	private _fadeOutClip(clip: any, fadeTime: number): void {
		const layer = clip?.layer as any;
		if (!layer) return;
		if (fadeTime <= 0) {
			// No blend window — just make the layer transparent immediately.
			try { layer.setActive(null); } catch { /* ignore */ }
			return;
		}
		const internalQueue: any[] | undefined = layer._queue;
		if (!Array.isArray(internalQueue)) {
			try { layer.setActive(null); } catch { /* ignore */ }
			return;
		}
		const animation: any = layer.animation;
		const startTime: number = animation?.timeSource?.() ?? performance.now();
		const fadeEntry = {
			layerClip: null,
			playOptions: { fade: { time: fadeTime } },
			fadeByPath: {},
			fadeTime,
			startTime,
		};
		internalQueue.push(fadeEntry);
		layer._active = fadeEntry;
	}

	/**
	 * Smoothly rotates obj to face targetPos (in the same coordinate space that lookAt expects)
	 * using an exponential slerp. Call every frame for natural arc turns.
	 * Pass `speed` to override the default turn rate (e.g. a slow idle head-turn).
	 */
	private _smoothTurnToward(obj: Object3D, targetWorldPos: Vector3, dt: number, speed = this.turnSpeed.value): void {
		this._tmpQuat.copy(obj.quaternion);
		obj.lookAt(targetWorldPos);
		// Guard: lookAt produces NaN when target == object world position; keep current rotation.
		if (isNaN(obj.quaternion.x)) {
			obj.quaternion.copy(this._tmpQuat);
			return;
		}
		this._targetQuat.copy(obj.quaternion);
		obj.quaternion.copy(this._tmpQuat);
		const t = 1 - Math.exp(-speed * dt);
		obj.quaternion.slerp(this._targetQuat, t);
	}

	/**
	 * Eased step directly toward a local-space target on the XZ plane. Returns the
	 * pre-step horizontal distance to the target.
	 *
	 * Crucially this still steps *straight at* the target every frame (so distance
	 * strictly decreases and the path always converges — no pure-pursuit orbiting);
	 * only the *speed* is eased. `_speed` ramps up from a standstill and eases back
	 * down as the target nears, so starts and stops feel like a real animal rather
	 * than a constant-velocity slide.
	 */
	private _moveTowardLocalXZ(obj: Object3D, targetX: number, targetZ: number, dt: number, maxSpeed: number): number {
		// Refuse to move toward a non-finite target. This happens when the target was
		// derived via obj.parent.worldToLocal() while the ImmersalAnchorGroup parent is
		// momentarily degenerate/non-invertible (e.g. before the first VPS lock), which
		// yields NaN. Stepping anyway would permanently poison obj.position with NaN
		// (NaN + x === NaN forever), hiding the character for good. Stay put instead.
		if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) { this._speed = 0; return Infinity; }

		// Self-heal if position was already poisoned on an earlier frame: snap back to
		// the known-good home position rather than staying invisible.
		if (!Number.isFinite(obj.position.x) || !Number.isFinite(obj.position.z)) {
			obj.position.x = this._homePosition.x;
			obj.position.z = this._homePosition.z;
			this._speed = 0;
		}

		const dx = targetX - obj.position.x;
		const dz = targetZ - obj.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist < 1e-5) { this._speed = 0; return dist; }

		// Ease the target speed down close to the goal so it glides to a stop.
		const desired = Math.min(maxSpeed, dist * this._ARRIVE_DECEL_K);
		// Ramp current speed toward desired (symmetric accel/decel).
		const ds = this._ACCEL * dt;
		if (this._speed < desired) this._speed = Math.min(desired, this._speed + ds);
		else this._speed = Math.max(desired, this._speed - ds);

		const step = Math.min(this._speed * dt, dist);
		obj.position.x += (dx / dist) * step;
		obj.position.z += (dz / dist) * step;
		return dist;
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
						this._enterApproaching(true);
						break;
					}
				}

				if (!this.patrolBoundaryParent.value) break;

				if (this._wanderSub === "stroll") {
					// _patrolWaypoint is fixed in WORLD space (the boundary markers don't move),
					// but obj.parent (ImmersalAnchorGroup's tracker group) has its pose recomputed
					// from the live VPS/world-tracking anchor every frame — so re-derive the
					// local-space target fresh, every frame, rather than caching a stale snapshot.
					this._tmpVec2.copy(this._patrolWaypoint);
					if (obj.parent) obj.parent.worldToLocal(this._tmpVec2);

					// Eased step *straight at* the target (distance always converges — never
					// a pure-pursuit orbit); only the speed accelerates/decelerates.
					const dist = this._moveTowardLocalXZ(
						obj, this._tmpVec2.x, this._tmpVec2.z, dt,
						this.walkSpeed.value * this._strollSpeedFactor);

					// Face the direction of travel. lookAt wants world space, so aim at the
					// fixed world-space waypoint at the bird's current height (horizontal look).
					obj.getWorldPosition(this._tmpVec);
					this._tmpVec.set(this._patrolWaypoint.x, this._tmpVec.y, this._patrolWaypoint.z);
					this._smoothTurnToward(obj, this._tmpVec, dt);

					if (dist <= this._ARRIVE_DIST) this._beginSettle();
				} else {
					// Settled in place — gentle idle look-around so it's never frozen.
					this._idleLookAround(obj, time, dt);
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
						this._enterNotEngaged();
						break;
					}

					// "Notice" beat — it spotted you: hold position and orient (a touch
					// faster than normal) toward you before actually walking over.
					if (time < this._approachNoticeUntil) {
						this._speed = 0;
						this._smoothTurnToward(obj, this._tmpVec2, dt, this.turnSpeed.value * 1.6);
						break;
					}

					// Arrived within greeting distance — settle and (maybe) greet
					const greetDist = 1.0;
					if (dist <= greetDist) {
						this._enterConversating(this._greetOnArrival);
						break;
					}

					// Walk over (eased), aiming at a point greetDist short of the viewer so it
					// glides to a stop at conversation distance rather than into their face.
					this._setAnim("walk", { loop: true });
					const f = (dist - greetDist) / dist;
					this._moveTowardLocalXZ(obj, obj.position.x + dx * f, obj.position.z + dz * f, dt, this.walkSpeed.value);
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
						// Viewer moved enough that we must reorient — shuffle round with a
						// slow in-place walk so the feet "sell" the turn instead of sliding.
						this._isTurning = true;
						this._clearConversatingTimers();
						this._setAnim("walk", { loop: true, speed: 0.45 });
					} else if (this._isTurning && angularDist < TURN_OFF) {
						this._isTurning = false;
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

	/**
	 * Gentle idle "look around" while settled: every few seconds pick a new nearby
	 * point to glance toward and slowly turn the body toward it. Keeps the bird
	 * subtly alive (scanning/foraging head movement) instead of statue-still.
	 */
	private _idleLookAround(obj: Object3D, time: number, dt: number): void {
		// Only steer the body during the looping idle — never mid preen/shake/display.
		if (this._currentAnimKey !== "idle") return;
		if (!this._hasLookPoint || time >= this._nextLookTime) {
			obj.getWorldPosition(this._tmpVec);
			const ang = Math.random() * Math.PI * 2;
			// Bias glances roughly forward-ish but allow the occasional full turn.
			this._lookPoint.set(
				this._tmpVec.x + Math.cos(ang) * 2,
				this._tmpVec.y,
				this._tmpVec.z + Math.sin(ang) * 2,
			);
			this._hasLookPoint = true;
			this._nextLookTime = time + MathUtils.randFloat(1.6, 3.6) * 1000;
		}
		// A slow, lazy turn rate — this is idle curiosity, not urgent reorientation.
		this._smoothTurnToward(obj, this._lookPoint, dt, this.turnSpeed.value * 0.25);
	}

	// ─── Event handlers ──────────────────────────────────────────────

	private _onCharacterAction(_action: CharacterAction): void {
		// Reserved for future character actions
	}

	private _onAudioPlaybackStarted(): void {
		this._logSdkEvent("audioPlaybackStarted");
		this._isSpeaking = true;
		// Cancel any running inactivity timer — the character cannot be idle while speaking.
		// This is the hard guard: no matter what started the timer (interrupt, greet fallback,
		// re-entry, etc.), audio playing always wins and clears it.
		if (this._inactivityTimer !== null) {
			clearTimeout(this._inactivityTimer);
			this._inactivityTimer = null;
			this._logSdkEvent("  → timer CANCELLED");
		}
		if (this._state === "notEngaged" && this._hasGreeted) {
			// Player spoke to it again while it had wandered off — re-engage by
			// walking back over to them (no re-greeting), showing renewed attention.
			this._logDebugEvent("audio started → re-approach viewer");
			this._enterApproaching(false);
		} else if (this._state === "isConversating" && this._currentAnimKey === "idle" && !this._isTurning) {
			// Freshen the spoken animation now that it's actually talking — but only
			// from a resting idle, so an in-progress greeting display/preen isn't cut.
			this._clearConversatingTimers();
			this._pickConversatingAnim();
		}
	}

	private _onAudioPlaybackComplete(): void {
		this._logSdkEvent("audioPlaybackComplete");
		this._isSpeaking = false;
		if (this._state === "isConversating") {
			// Switch to the calmer "listening" palette and start the silence countdown.
			if (!this._isTurning) this._pickConversatingAnim();
			this._resetInactivityTimer("audioPlaybackComplete");
		}
	}

	private _onSttResponse(payload: { text: string; isFinal: boolean }): void {
		this._logSdkEvent(`sttResponse isFinal=${payload.isFinal} "${payload.text.slice(0, 40)}"`);
		if (this._state === "isConversating" && this._inactivityTimer !== null) {
			clearTimeout(this._inactivityTimer);
			this._inactivityTimer = null;
			this._logSdkEvent("  → timer CANCELLED (user speaking)");
		}
	}

	private _onInterrupt(): void {
		this._logSdkEvent("interrupt");
		if (this._state === "isConversating") {
			this._resetInactivityTimer("interrupt");
		}
	}

	// ─── isConversating helpers ──────────────────────────────────────

	private _enterApproaching(greetOnArrival: boolean): void {
		this._clearPatrolTimers();
		this._clearConversatingTimers();
		this._isTurning = false;
		this._speed = 0;
		this._greetOnArrival = greetOnArrival;
		this._state = "approaching";
		this._patrolAnimState = "none";
		// "Notice" beat first: stand alert and orient toward the viewer for a moment
		// (idle pose) before committing to the walk — see the approaching case in _animate.
		this._approachNoticeUntil = performance.now() + this.noticeDuration.value * 1000;
		this._setAnim("idle", { loop: true });
		this._logDebugEvent(greetOnArrival ? "→ noticing viewer" : "→ re-approaching viewer");
	}

	private _enterConversating(greet: boolean): void {
		this._clearPatrolTimers();
		this._clearConversatingTimers();
		this._isTurning = false;
		this._speed = 0;
		this._state = "isConversating";

		if (greet) {
			const line = this.openingLine.value.trim();
			if (line && this._client) {
				this._client.sayLine(line);
				this._logDebugEvent("spoke opening line");
			} else {
				console.log("SampleCharacterAnimator: Greeting viewer (no client/line)");
				this._resetInactivityTimer("greet-no-client-fallback");
			}
			// Timer starts in _onAudioPlaybackComplete so the silence counts down
			// after speech finishes, not while it's still playing.

			// A full tail-spread as a greeting flourish — the peacock showing off as
			// it says hello. Otherwise settle straight into the attentive idle.
			if (Math.random() < 0.55) {
				this._setAnim("display", { loop: false });
				this._queueNextConvAnim(this._DISPLAY_DURATION_S);
			} else {
				this._pickConversatingAnim();
			}
		} else {
			this._pickConversatingAnim();
		}
		this._logDebugEvent(`→ isConversating (greet=${greet})`);
	}

	private _resetInactivityTimer(reason: string): void {
		if (this._inactivityTimer !== null) clearTimeout(this._inactivityTimer);
		this._timerLastReason = reason;
		this._timerStartedAt = performance.now();
		this._logSdkEvent(`timer START (${reason})`);
		this._inactivityTimer = setTimeout(() => {
			this._inactivityTimer = null;
			if (this._state === "isConversating") {
				this._logDebugEvent("inactivity timeout → disengage");
				this._logSdkEvent("timer FIRED → disengage");
				this._enterDisengage();
			}
		}, this.conversatingTimeout.value * 1000);
	}

	/**
	 * Picks the next conversation animation. Distinguishes *speaking* (more
	 * animated — expressive idle with the occasional feather-shake or full
	 * display for emphasis) from *listening* (calmer — attentive idle with the
	 * occasional patient preen). Tunable via the conversating* weight properties.
	 */
	private _pickConversatingAnim(): void {
		const speaking = this._isSpeaking;
		const idleW = Math.max(0, this.conversatingIdleWeight.value);
		// Won't groom mid-sentence — preening is a calm listening-time comfort beat.
		const preenW = Math.max(0, this.conversatingLickingWeight.value) * (speaking ? 0.1 : 1);
		const expressW = Math.max(0, this.conversatingSpreadWeight.value);
		// Split the "expressive" weight into a common little feather-shake and a
		// rare, deliberate full display (gated further by displayChance).
		const displayW = expressW * (speaking ? 0.5 : 0.2) * Math.max(0, Math.min(1, this.displayChance.value * 3));
		const shakeW = Math.max(0, expressW - displayW);

		const total = idleW + preenW + shakeW + displayW;
		let roll = Math.random() * (total || 1);

		let key: AnimKey; let dur: number;
		if (total === 0 || (roll -= idleW) < 0)      { key = "idle";    dur = this._CONVERSATING_IDLE_DURATION_S; }
		else if ((roll -= preenW) < 0)               { key = "preen";   dur = this._PREEN_DURATION_S; }
		else if ((roll -= shakeW) < 0)               { key = "shake";   dur = this._SHAKE_DURATION_S; }
		else                                         { key = "display"; dur = this._DISPLAY_DURATION_S; }

		const loop = key === "idle";
		this._setAnim(key, { loop });
		// Hold a looping idle for a varied stretch; re-pick one-shots when they finish.
		this._queueNextConvAnim(loop ? MathUtils.randFloat(dur, dur * 1.9) : dur);
	}

	/** Schedules the next conversation-animation pick, unless turning/disengaged first. */
	private _queueNextConvAnim(afterS: number): void {
		this._convAnimTimer = setTimeout(() => {
			this._convAnimTimer = null;
			if (this._state === "isConversating" && !this._isTurning) this._pickConversatingAnim();
		}, afterS * 1000);
	}

	private _clearConversatingTimers(): void {
		if (this._convAnimTimer !== null) {
			clearTimeout(this._convAnimTimer);
			this._convAnimTimer = null;
		}
	}

	// ─── Wander / forage helpers ─────────────────────────────────────

	private _enterNotEngaged(awayFromCamera = false): void {
		this._clearPatrolTimers();
		this._speed = 0;
		this._hasLookPoint = false;
		this._beginStroll(awayFromCamera);
	}

	/** Conversation faded out: break eye contact and amble off rather than snap to patrol. */
	private _enterDisengage(): void {
		this._hasGreeted = true;
		this._clearConversatingTimers();
		this._isTurning = false;
		this._state = "notEngaged";
		this._enterNotEngaged(true);
	}

	/** Begin walking toward a freshly chosen wander target. */
	private _beginStroll(awayFromCamera = false): void {
		this._clearPatrolTimers();
		this._wanderSub = "stroll";
		this._patrolAnimState = "stroll";
		this._strollSpeedFactor = MathUtils.randFloat(0.8, 1.12); // subtle pace variation
		this._pickWanderTarget(awayFromCamera);
		this._setAnim("walk", { loop: true });
	}

	/**
	 * Chooses the next wander destination (stored in WORLD space). Mixes frequent
	 * short forage hops near the current spot with the occasional longer stroll, so
	 * the path meanders like an animal pottering about rather than marching corner
	 * to corner. When disengaging, biases the target away from the viewer.
	 */
	private _pickWanderTarget(awayFromCamera = false): void {
		const verts = this._getPatrolBoundaryVertices();
		if (!verts) return;

		const obj = this._obj;
		obj.getWorldPosition(this._tmpVec);
		const cx = this._tmpVec.x, cz = this._tmpVec.z;
		let best: { x: number; z: number } | null = null;

		if (awayFromCamera && this._camera) {
			// Pick, among a few candidates, the one furthest from the viewer.
			this._camera.getWorldPosition(this._tmpVec2);
			let bestScore = -Infinity;
			for (let i = 0; i < 6; i++) {
				const c = this._samplePointInPolygon(verts);
				const score = (c.x - this._tmpVec2.x) ** 2 + (c.z - this._tmpVec2.z) ** 2;
				if (score > bestScore) { bestScore = score; best = c; }
			}
		} else if (Math.random() < 0.6) {
			// Short forage hop: a nearby point that's still inside the boundary.
			for (let i = 0; i < 8; i++) {
				const ang = Math.random() * Math.PI * 2;
				const r = MathUtils.randFloat(0.35, 1.3);
				const px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
				if (this._pointInPolygon(verts, px, pz)) { best = { x: px, z: pz }; break; }
			}
		}
		if (!best) best = this._samplePointInPolygon(verts); // longer stroll / fallback

		// WORLD space — must NOT be pre-converted to parent-local here; _animate does
		// that fresh each frame against the live VPS anchor pose. (y unused downstream.)
		this._patrolWaypoint.set(best.x, 0, best.z);
	}

	/**
	 * Arrived at a wander target: pause and do a small, motivated behaviour — usually
	 * stand and scan, sometimes preen, a quick feather-shake, or (rarely) a full
	 * display — then move on. Occasionally skips the pause to keep foraging.
	 */
	private _beginSettle(): void {
		this._clearPatrolTimers();
		this._wanderSub = "settle";
		this._patrolAnimState = "settle";
		this._hasLookPoint = false;

		// Sometimes don't really stop — a foraging bird takes a few steps, then a few
		// more. Decide this before braking so the gait keeps its momentum.
		if (Math.random() < 0.22) { this._beginStroll(); return; }
		this._speed = 0;

		const settleDuration = MathUtils.randFloat(this.minPauseDuration.value, this.maxPauseDuration.value);
		this._patrolPauseTimer = setTimeout(() => {
			this._patrolPauseTimer = null;
			this._beginStroll();
		}, settleDuration * 1000);

		const roll = Math.random();
		const dc = this.displayChance.value;
		if (roll < dc) {
			// Rare spontaneous full display.
			this._setAnim("display", { loop: false });
			this._settleReturnToIdleAfter(this._DISPLAY_DURATION_S, settleDuration, false);
		} else if (roll < dc + 0.3) {
			// Preen — relaxed grooming — finished off with a little feather-shake.
			this._setAnim("preen", { loop: false });
			this._settleReturnToIdleAfter(this._PREEN_DURATION_S, settleDuration, true);
		} else if (roll < dc + 0.45) {
			// Quick feather-shake/ruffle.
			this._setAnim("shake", { loop: false });
			this._settleReturnToIdleAfter(this._SHAKE_DURATION_S, settleDuration, false);
		} else {
			// Just stand and scan (look-around is applied in _animate while idle).
			this._setAnim("idle", { loop: true });
		}
	}

	/**
	 * After a one-shot settle behaviour finishes, return to the looping idle (so it
	 * doesn't freeze on the clip's last frame) — optionally with a finishing
	 * feather-shake. No-ops if the settle is already ending around then.
	 */
	private _settleReturnToIdleAfter(clipDurationS: number, settleDurationS: number, withShake: boolean): void {
		if (settleDurationS <= clipDurationS + 0.15) return; // settle ends ~when the clip does
		this._patrolFallbackIdleTimer = setTimeout(() => {
			this._patrolFallbackIdleTimer = null;
			if (this._wanderSub !== "settle") return;
			if (withShake && settleDurationS > clipDurationS + this._SHAKE_DURATION_S + 0.15 && Math.random() < 0.6) {
				this._setAnim("shake", { loop: false });
				this._patrolFallbackIdleTimer = setTimeout(() => {
					this._patrolFallbackIdleTimer = null;
					if (this._wanderSub === "settle") this._setAnim("idle", { loop: true });
				}, this._SHAKE_DURATION_S * 1000);
			} else {
				this._setAnim("idle", { loop: true });
			}
		}, clipDurationS * 1000);
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

	/** Even-odd ray-cast test: is world-XZ point (px,pz) inside the boundary polygon? */
	private _pointInPolygon(verts: Array<{ x: number; z: number }>, px: number, pz: number): boolean {
		let inside = false;
		for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
			const xi = verts[i].x, zi = verts[i].z;
			const xj = verts[j].x, zj = verts[j].z;
			if (((zi > pz) !== (zj > pz)) && (px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi)) {
				inside = !inside;
			}
		}
		return inside;
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

		if (buttonComp) {
			this._debugButtonComp = buttonComp;
			buttonComp.innerText.value = "▼ Debug";

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

			const container = btnEl.parentElement;
			if (container) {
				container.style.cssText = [
					"background:rgba(0,0,0,0.82)",
					"color:#7fff7f",
					"font:11px/1.6 monospace",
					"padding:8px 12px",
					"border-radius:5px",
					"pointer-events:auto",
					"min-width:240px",
					"max-width:340px",
					"margin-top:65px",
				].join(";");

				// Summary line — always visible even when collapsed.
				const summaryEl = document.createElement("div");
				summaryEl.style.cssText = "margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.8";
				this._debugSummaryLine = summaryEl;
				container.appendChild(summaryEl);

				// Sections wrapper — hidden when main toggle is collapsed.
				const sectionsWrapper = document.createElement("div");
				container.appendChild(sectionsWrapper);

				const headerStyle = [
					"cursor:pointer",
					"user-select:none",
					"pointer-events:auto",
					"font-weight:bold",
					"color:#afffaf",
					"border-top:1px solid rgba(127,255,127,0.25)",
					"margin-top:5px",
					"padding-top:2px",
				].join(";");

				for (const [name, defaultCollapsed] of [
					["State",     false],
					["Patrol",    true ],
					["Animation", true ],
					["Events",    false],
				] as Array<[string, boolean]>) {
					const sectionEl  = document.createElement("div");
					const headerEl   = document.createElement("div");
					const sectionContent = document.createElement("div");

					headerEl.style.cssText = headerStyle;
					headerEl.textContent = `${defaultCollapsed ? "▶" : "▼"} ${name}`;
					sectionContent.style.cssText = `white-space:pre;padding-top:2px${defaultCollapsed ? ";display:none" : ""}`;

					const entry = { contentEl: sectionContent, collapsed: defaultCollapsed };
					this._debugSections.set(name, entry);

					headerEl.addEventListener("click", (e) => {
						e.stopPropagation();
						entry.collapsed = !entry.collapsed;
						sectionContent.style.display = entry.collapsed ? "none" : "";
						headerEl.textContent = `${entry.collapsed ? "▶" : "▼"} ${name}`;
					});

					sectionEl.appendChild(headerEl);
					sectionEl.appendChild(sectionContent);
					sectionsWrapper.appendChild(sectionEl);
				}

				this._debugOverlay = container;

				this._boundOnDebugToggle = () => {
					this._debugCollapsed = !this._debugCollapsed;
					sectionsWrapper.style.display = this._debugCollapsed ? "none" : "";
					buttonComp.innerText.value = this._debugCollapsed ? "▶ Debug" : "▼ Debug";
				};
				buttonComp.onClick.addListener(this._boundOnDebugToggle);
			}
		} else {
			// Fallback: no Mattercraft button — create a simple fixed overlay.
			const contentEl = document.createElement("div");
			contentEl.style.cssText = "white-space:pre";
			this._debugContent = contentEl;
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

	private _logSdkEvent(msg: string): void {
		const t = (performance.now() / 1000).toFixed(1);
		this._sdkEventLog.unshift(`[${t}s] ${msg}`);
		if (this._sdkEventLog.length > 14) this._sdkEventLog.pop();
	}

	private _updateDebugOverlay(now: number): void {
		if (!this._debugOverlay) return;
		if (now - this._debugLastUpdate < 50) return;
		this._debugLastUpdate = now;

		// Summary line — always updated regardless of collapsed state.
		if (this._debugSummaryLine) {
			const lastEvent = this._debugEvents[0] ?? "—";
			this._debugSummaryLine.innerHTML = `${this._state} &nbsp;·&nbsp; ${lastEvent}`;
		}

		if (this._debugCollapsed) return;

		const obj = this._obj;

		const cp = new Vector3();
		let camDist = "—", camXYZ = "—";
		if (this._camera) {
			obj.getWorldPosition(cp);
			const cx = cp.x, cz = cp.z;
			this._camera.getWorldPosition(cp);
			camDist = Math.sqrt((cp.x - cx) ** 2 + (cp.z - cz) ** 2).toFixed(2) + "m";
			camXYZ = `(${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, ${cp.z.toFixed(2)})`;
		}
		obj.getWorldPosition(cp);
		const charXYZ = `(${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, ${cp.z.toFixed(2)})`;

		let visChain = "";
		{ let node: Object3D | null = obj; while (node) { visChain = (node.visible ? "✓" : "✗") + visChain; node = node.parent; } }
		const matNaN = isNaN(obj.matrixWorld.elements[0]);

		// ── State section ────────────────────────────────────────────────
		const stateEntry = this._debugSections.get("State");
		if (stateEntry && !stateEntry.collapsed) {
			stateEntry.contentEl.innerHTML = [
				`state:      ${this._state}`,
				`hasGreeted: ${this._hasGreeted}`,
				`vpsReady:   ${this._vpsReady}`,
				`visible:    ${visChain}  matNaN:${matNaN}`,
				`camera:     ${this._camera ? "found" : "NOT FOUND ⚠"}`,
				`camPos:     ${camXYZ}`,
				`charPos:    ${charXYZ}`,
				`camDist:    ${camDist}  (r=${this.proximityRadius.value}m)`,
				`client:     ${this._client ? "connected" : "waiting…"}`,
			].join("<br>");
		}

		// ── Patrol section ───────────────────────────────────────────────
		const patrolEntry = this._debugSections.get("Patrol");
		if (patrolEntry && !patrolEntry.collapsed) {
			const wp = this._patrolWaypoint;
			patrolEntry.contentEl.innerHTML = [
				`boundary:   "${this.patrolBoundaryParent.value || "(empty)"}"`,
				`status:     ${this._debugBoundaryStatus}`,
				`animState:  ${this._patrolAnimState}`,
				`waypoint:   (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)})`,
			].join("<br>");
		}

		// ── Animation section ────────────────────────────────────────────
		const animEntry = this._debugSections.get("Animation");
		if (animEntry && !animEntry.collapsed) {
			const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
			const animInfo: string[] = [];
			if (behaviors) {
				for (const bkey of Object.keys(behaviors)) {
					const layers = behaviors[bkey]?.layers;
					if (layers) animInfo.push(`  ${bkey}: [${Object.keys(layers).join(", ")}]`);
				}
			}
			if (animInfo.length === 0) animInfo.push("  (none)");
			animEntry.contentEl.innerHTML = [
				`lastPlay:   ${this._debugLastAnimPath}`,
				`fadeTime:   ${this.crossfadeTime.value.toFixed(2)}s`,
				"behaviors:",
				...animInfo,
			].join("<br>");
		}

		// ── Events section ───────────────────────────────────────────────
		const eventsEntry = this._debugSections.get("Events");
		if (eventsEntry && !eventsEntry.collapsed) {
			const timerRunning = this._inactivityTimer !== null;
			const elapsed = this._timerStartedAt > 0
				? `${((performance.now() - this._timerStartedAt) / 1000).toFixed(1)}s ago`
				: "—";
			eventsEntry.contentEl.innerHTML = [
				`timer:    ${timerRunning ? "RUNNING" : "idle"}  started: ${elapsed}`,
				`  reason: ${this._timerLastReason}`,
				`  timeout: ${this.conversatingTimeout.value}s`,
				"",
				"SDK events:",
				...this._sdkEventLog.map(e => `  ${e}`),
				"",
				"State changes:",
				...this._debugEvents,
			].join("<br>");
		}

		// ── Fallback (no button component) ───────────────────────────────
		if (this._debugContent) {
			const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
			const animInfo: string[] = [];
			if (behaviors) {
				for (const bkey of Object.keys(behaviors)) {
					const layers = behaviors[bkey]?.layers;
					if (layers) animInfo.push(`  ${bkey}: [${Object.keys(layers).join(", ")}]`);
				}
			}
			this._debugContent.innerHTML = [
				`state: ${this._state}  hasGreeted: ${this._hasGreeted}`,
				`camDist: ${camDist}  vpsReady: ${this._vpsReady}`,
				`timer: ${this._inactivityTimer !== null ? "RUNNING" : "idle"}  reason: ${this._timerLastReason}`,
				"SDK:", ...this._sdkEventLog.slice(0, 6).map(e => `  ${e}`),
				"Events:", ...this._debugEvents,
			].join("<br>");
		}
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
			if (this._boundOnSttResponse) this._client.off("sttResponse", this._boundOnSttResponse);
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
