import { Component, Behavior, ContextManager, Observable, started } from "@zcomponent/core";
import { EstuaryClient } from "@estuary-ai/sdk";
import type { CharacterAction, InterruptData } from "@estuary-ai/sdk";
import type { default as SceneType } from "./Scene.zcomp";
import { Vector3, Quaternion, Object3D, MathUtils, AnimationMixer, AnimationAction, AnimationClip, LoopOnce, LoopRepeat } from "three";

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
	introductionPrompt?: string;
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
	 * Relative likelihood of a full tail display during conversation, as an
	 * occasional flourish for emphasis (further gated by displayChance).
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
	 * Turn rate (rad/s). Caps how fast the heading arcs toward a walk target — lower =
	 * wider, lazier walking turns; higher = tighter, snappier ones. Also the rate used
	 * for in-place reorientation (idle look-around, the approach "notice" beat, facing
	 * the viewer in conversation).
	 * @zui
	 * @zdefault 3.0
	 */
	public turnSpeed = new Observable<number>(3.0);

	/**
	 * Prompt sent to the character (via Estuary's `sendText`, not a scripted line) the
	 * first time it greets a viewer — the character's LLM generates its own introduction
	 * from this instruction rather than speaking fixed, prewritten text.
	 * @zui
	 * @zdefault "A visitor has just walked up to you for the first time. Introduce yourself and welcome them, in character, in a sentence or two."
	 */
	public introductionPrompt = new Observable<string>(
		"A visitor has just walked up to you for the first time. Introduce yourself and welcome them, in character, in a sentence or two."
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

	/**
	 * Show the on-screen debug overlay (state/patrol/locomotion/animation panels).
	 * Turn on while iterating; leave off for production builds.
	 * @zui
	 * @zdefault false
	 */
	public showDebugOverlay = new Observable<boolean>(false);

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
	// Guards against the Estuary SDK's audioPlaybackComplete misfiring: internally it infers
	// "complete" from a fixed ~300ms gap with no new audio chunks (AudioPlayer.DRAIN_DELAY_MS),
	// not a real end-of-utterance signal — a slow TTS chunk during a long sentence can trip
	// it mid-speech, immediately followed by another audioPlaybackStarted for the same
	// utterance. So "complete" is held for _AUDIO_COMPLETE_GUARD_MS (just over that internal
	// delay) before we act on it; a started arriving in that window cancels it as spurious.
	private _audioCompleteGuardTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly _AUDIO_COMPLETE_GUARD_MS = 400;

	// Bound event handlers for cleanup
	private _boundOnCharacterAction: ((action: CharacterAction) => void) | null = null;
	private _boundOnAudioPlaybackStarted: ((messageId: string) => void) | null = null;
	private _boundOnAudioPlaybackComplete: ((messageId: string) => void) | null = null;
	private _boundOnInterrupt: ((data: InterruptData) => void) | null = null;
	private _boundOnSttResponse: ((payload: { text: string; isFinal: boolean }) => void) | null = null;

	// ─── Animation / crossfade ───────────────────────────────────────

	// Semantic-name → GLTF animation clip name. These are STREAM tracks (GLTF skeletal
	// animations); @zcomponent stream tracks are play/pause/stop ONLY — no weight, no
	// real fade (see streamtrack.js `_applyState`). So we DON'T crossfade through the
	// @zcomponent layer; we drive the underlying THREE.AnimationMixer actions directly
	// (weighted fadeIn/fadeOut), the standard way to blend skeletal animations. The
	// @zcomponent layer is kept empty so it never double-drives these same actions.
	//   display = full tail spread (rare, deliberate "showing off")
	//   shake   = quick feather ruffle/shake (common little comfort beat)
	// Match is by normalized name, so editor spaces/underscores ("Spread feathers2")
	// vs the @zcomponent script-name ("Spreadfeathers2") don't matter.
	private static readonly _LAYER = "PeacockAnimations";
	private static readonly _ANIM: Record<AnimKey, string> = {
		walk:    "Peacock_A15_Walk",
		idle:    "Peacock_A15_Idle",
		preen:   "Peacock_A15_licking_feathers",
		shake:   "Peacock_A15_Spreadfeathers2",
		display: "Peacock_A15_Spreadfeathers",
	};

	// THREE.AnimationMixer actions resolved from the Peacock_glb GLTF, keyed by AnimKey.
	private _mixer: AnimationMixer | null = null;
	private _actions: Partial<Record<AnimKey, AnimationAction>> = {};
	private _currentAction: AnimationAction | null = null;
	// The GLB loads async — a _setAnim call before the mixer is ready is stashed here and
	// replayed the moment the mixer resolves. Cleanup unsubscribes the mixer listener.
	private _pendingAnim: { key: AnimKey; opts: { loop?: boolean; speed?: number; force?: boolean } } | null = null;
	private _mixerListenerCleanup: (() => void) | null = null;

	private _currentAnimKey: AnimKey | null = null;

	// Natural clip durations (seconds) — used to schedule one-shot follow-ups.
	private readonly _PREEN_DURATION_S = 6.53;
	private readonly _SHAKE_DURATION_S = 8.33;
	private readonly _DISPLAY_DURATION_S = 7.33;

	// ─── isConversating state ────────────────────────────────────────

	private _convAnimTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly _CONVERSATING_IDLE_DURATION_S = 3.0;
	private _convAnimStartedAt = 0;
	private readonly _CONV_ANIM_MIN_HOLD_S = 2.5;

	// ─── Locomotion (eased velocity — keeps starts/stops from being robotic) ──

	private _speed = 0;                       // current ground speed, m/s (eased)
	private readonly _ACCEL = 2.4;            // m/s² ramp toward target speed
	private readonly _ARRIVE_DIST = 0.08;     // m — close enough to count as arrived
	private readonly _ARRIVE_DECEL_K = 2.6;   // higher = brakes later/harder near target

	// ─── Heading (the bird walks *along* its facing, never diagonally) ──────────
	// Single source of truth for the ground heading. Movement and facing are both
	// derived from this every frame, so the direction it travels is always the
	// direction it faces. The heading is steered toward the target at a capped yaw
	// rate (turnSpeed, rad/s), producing a forward walking *arc* instead of the body
	// snapping its travel vector to the target while the mesh lags behind.
	private _headingYaw = 0;                   // radians, parent-local XZ (atan2(x, z))
	private _headingValid = false;             // false ⇒ re-seed from current facing first
	// Yaw is driven through an eased *rate* rather than a flat capped step, so turns
	// accelerate from a standstill (ease-in) and slow as they line up (ease-out) — an
	// S-curve sweep instead of a robotic constant-speed pan. `_turnRateScale` gives each
	// maneuver a slightly different briskness so no two turns look identical.
	private _yawRate = 0;                       // current yaw angular velocity (rad/s), eased
	private _turnRateScale = 1;                 // per-maneuver variance on the max turn rate
	private readonly _YAW_ACCEL = 11;          // rad/s² — how fast the yaw rate ramps (ease-in)
	private readonly _TURN_KP = 4.5;           // desired-rate gain vs. heading error (ease-out)
	// Forward speed is scaled by how well the heading is aligned with the target
	// (cos of the heading error). This floor keeps it creeping forward — arcing —
	// through even a 180° turn rather than pivoting in place, and by slowing hard
	// turns it shrinks the turn radius so a sharp target can never become an orbit.
	private readonly _STEER_SPEED_FLOOR = 0.35;
	// Arrival watchdog (anti-orbit). A pure-pursuit walker circles forever if the target
	// sits inside its turning circle: it keeps turning toward a point it can't curve
	// tightly enough to reach, so the distance plateaus instead of shrinking. We watch
	// for that — distance not improving while still short of the goal — and break it by
	// cranking turn authority and easing off speed so the radius collapses and it spirals
	// straight in. Selection (`_minWanderDist`) also refuses targets close enough to risk it.
	// We count a "stall" ONLY while the bird is aligned (pointed at the target) yet not
	// closing — the true orbit signature. Mid-turn (large heading error) the distance
	// legitimately stalls/grows as it creeps forward off-axis, so we must NOT trip then,
	// or escape kills the forward creep and the bird spins on the spot ("moonwalk").
	// Progress is frame-to-frame, not vs an all-time best, so recovering from forward
	// drift counts as progress instead of staying latched above a stale best distance.
	private _prevDistToTarget = Infinity;    // last frame's distance to target (closing test)
	private _noProgressTime = 0;             // seconds aligned-but-not-closing (true orbit)
	private readonly _ORBIT_STALL_S = 1.2;   // aligned-stall time that counts as a real orbit
	private _orbitEscaping = false;          // currently force-converging out of an orbit
	// Debug readouts (shown in the Locomotion overlay section).
	private _debugHeadingErrDeg = 0;
	private _debugAlign = 1;

	// ─── Wander / forage state ───────────────────────────────────────

	private _patrolWaypoint = new Vector3();
	private _wanderSub: "stroll" | "settle" = "settle";
	private _strollSpeedFactor = 1;           // small per-stroll speed variation
	private _patrolPauseTimer: ReturnType<typeof setTimeout> | null = null;       // settle end
	private _patrolIntervalTimer: ReturnType<typeof setTimeout> | null = null;    // reserved
	private _patrolFallbackIdleTimer: ReturnType<typeof setTimeout> | null = null;// settle tail
	private _patrolAnimState: string = "none";

	// Gentle idle look-around so the bird is never frozen while settled.


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
		if (constructorProps.introductionPrompt !== undefined) this.introductionPrompt.value = constructorProps.introductionPrompt;
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
		this._clearAllAnimLayersAtStartup();
		this._resolveMixer();
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
	 * Resolves the THREE.AnimationMixer + one AnimationAction per AnimKey from the
	 * Peacock_glb GLTF component. `mixer.clipAction(clip)` returns the SAME cached action
	 * the @zcomponent stream wrapper holds, so we end up driving the exact actions the
	 * mixer ticks each frame (GLTF.js ticks `mixer.update` via useOnBeforeRender).
	 *
	 * IMPORTANT: we leave each action's base `weight` at 1 and silence it with stop()
	 * (deactivate), NOT setEffectiveWeight(0). Effective weight in THREE is
	 * `weight * fadeInterpolant`; fadeIn()/fadeOut() animate only the interpolant. If we
	 * zeroed the base weight, fadeIn would compute `0 * interpolant = 0` forever — the
	 * action would advance ("run", time climbing) but never become visible. stop() removes
	 * it from the mixer's active set so it contributes nothing while keeping weight=1.
	 */
	private _resolveMixer(): void {
		const gltf = (this._rootScene as any)?.nodes?.Peacock_glb;
		if (!gltf?.mixer) { this._logDebugEvent("mixer: Peacock_glb node not found"); return; }

		// Resolve actions once the mixer + clips exist. The GLB loads async, so subscribe
		// to the mixer Observable (callImmediately:true handles the already-loaded case)
		// and resolve on the firing where the value is present.
		const onMixer = () => {
			const mixer = gltf?.mixer?.value as AnimationMixer | undefined;
			const clips = gltf?.animationClips?.value as Map<string, AnimationClip> | undefined;
			if (!mixer || !clips || clips.size === 0) return;

			const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
			const byNorm = new Map<string, AnimationClip>();
			for (const [name, clip] of clips) byNorm.set(norm(name), clip);

			let found = 0;
			for (const key of Object.keys(SampleCharacterAnimator._ANIM) as AnimKey[]) {
				const clip = byNorm.get(norm(SampleCharacterAnimator._ANIM[key]));
				if (!clip) { this._logDebugEvent(`mixer: no clip for ${key}`); continue; }
				const action = mixer.clipAction(clip);
				action.stop(); // deactivate (contributes nothing); keeps base weight=1 so fadeIn works
				this._actions[key] = action;
				found++;
			}
			this._mixer = mixer;
			this._logDebugEvent(`mixer: resolved ${found}/5 actions`);

			// Stop listening and play whatever the state machine asked for while we waited.
			this._mixerListenerCleanup?.();
			this._mixerListenerCleanup = null;
			if (this._pendingAnim) {
				const p = this._pendingAnim;
				this._pendingAnim = null;
				this._setAnim(p.key, p.opts);
			}
		};

		gltf.mixer.addListener(onMixer, undefined, true);
		this._mixerListenerCleanup = () => { try { gltf.mixer.removeListener(onMixer); } catch { /* noop */ } };
	}

	/**
	 * Crossfades to a semantic animation by driving the THREE.AnimationMixer actions
	 * directly with weighted fades — NOT through the @zcomponent layer.
	 *
	 * Why: these are GLTF stream tracks, and @zcomponent stream tracks have no weight or
	 * fade — only play/pause/stop (streamtrack.js `_applyState`). "Fading" through a layer
	 * left both actions at full weight during the overlap, then PAUSED the outgoing one,
	 * freezing its pose in the mixer at weight 1 — that was the stiff, half-expressed walk
	 * after a one-shot. Here we instead ramp the outgoing action's weight 1→0 and the
	 * incoming 0→1 over crossfadeTime (action.fadeOut/fadeIn), the standard skeletal
	 * crossfade. Anything not `next` is faded to zero too, so no pose can ever linger.
	 */
	private _setAnim(key: AnimKey, opts: { loop?: boolean; speed?: number; force?: boolean } = {}): void {
		const loop = opts.loop ?? false;
		const speed = opts.speed ?? 1;
		if (!this._mixer) {
			// GLB still loading — remember the latest request; _resolveMixer replays it.
			this._pendingAnim = { key, opts };
			this._currentAnimKey = key;
			this._debugLastAnimPath = `pending (mixer loading): ${key}`;
			return;
		}
		const next = this._actions[key];
		if (!next) { this._debugLastAnimPath = `NO ACTION: ${key}`; return; }

		const prev = this._currentAction;
		const fadeSec = Math.max(0, this.crossfadeTime.value);

		// Already looping this clip — don't restart (frame-0 snap), but allow live speed
		// changes (e.g. the slowed approach walk).
		if (!opts.force && loop && key === this._currentAnimKey && prev === next) {
			next.setEffectiveTimeScale(speed);
			return;
		}

		next.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
		next.clampWhenFinished = !loop;
		next.setEffectiveTimeScale(speed);
		next.reset();   // enabled=true, time→0, clears any pending fade; base weight stays 1
		next.play();    // (re)activate in the mixer's blend set

		// NOTE: only the fade INTERPOLANT is animated by fadeIn/fadeOut; base weight must
		// stay 1 (effective = weight * interpolant). Never setEffectiveWeight(0) on an
		// action we'll fade back in — use stop() to silence (deactivate) instead.
		if (prev && prev !== next && fadeSec > 0) {
			prev.fadeOut(fadeSec);
			next.fadeIn(fadeSec);
		} else {
			next.setEffectiveWeight(1); // instant full pose (no prev / no fade / restart)
			if (prev && prev !== next) prev.stop();
		}

		// Belt-and-braces: silence every other action (e.g. a one-shot that ended and
		// clamped at weight 1, or a stale fade) so nothing bleeds into the new pose.
		for (const k of Object.keys(this._actions) as AnimKey[]) {
			const a = this._actions[k as AnimKey];
			if (!a || a === next || a === prev) continue;
			if (a.getEffectiveWeight() > 0.0001 || a.isRunning()) {
				if (fadeSec > 0) a.fadeOut(fadeSec); else a.stop();
			}
		}

		this._currentAnimKey = key;
		this._currentAction = next;
		this._debugLastAnimPath = `${key} xfade ${fadeSec.toFixed(2)}s${prev && prev !== next ? "" : prev === next ? " (restart)" : " (first)"}`;
	}

	/**
	 * Mattercraft leaves every animation layer in fade→clr q:1 after scene init, before our
	 * code runs. Force them all to undefined (fully empty) once at startup so the first
	 * _setAnim call starts from a clean baseline rather than fighting stale queue entries.
	 */
	private _clearAllAnimLayersAtStartup(): void {
		// Clear EVERY layer (including ones we don't drive), so a GLB rest/base/auto-play
		// clip can't sit there holding a partial pose that bleeds over our animations.
		let n = 0;
		for (const { layer } of this._collectAllAnimLayers()) {
			try { layer.active = undefined; n++; } catch { /* tolerate internal API differences */ }
		}
		this._logDebugEvent(`startup: cleared ${n} anim layers`);
	}

	/**
	 * Smoothly rotates obj to face targetPos (in the same coordinate space that lookAt expects)
	 * using an exponential slerp. Call every frame for natural arc turns.
	 * Pass `speed` to override the default turn rate (e.g. a slow idle head-turn).
	 *
	 * This is for *stationary* reorientation (idle look-around, the approach "notice"
	 * beat) where the body turns in place. Because it rotates the mesh by a route the
	 * heading integrator doesn't know about, it invalidates `_headingYaw` so the next
	 * locomotion step re-seeds from wherever the body actually ended up — otherwise the
	 * walk would start with a jump from the stale heading to the real facing.
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
		this._headingValid = false;
	}

	/**
	 * Seeds `_headingYaw` from the bird's *current* facing so a walk continues smoothly
	 * from wherever the mesh is pointing. Reads the object's world forward (+Z, which is
	 * the axis lookAt aims at the target — so "forward" here is the same "forward" the
	 * rest of the code means) and expresses it as a yaw in parent-local XZ.
	 */
	private _seedHeadingFromFacing(obj: Object3D): void {
		obj.getWorldDirection(this._tmpVec);   // world-space forward (unit)
		obj.getWorldPosition(this._tmpVec2);   // world-space position
		this._tmpVec.add(this._tmpVec2);       // a point one unit ahead, world space
		if (obj.parent) {
			obj.parent.worldToLocal(this._tmpVec);   // ahead point  → parent-local
			obj.parent.worldToLocal(this._tmpVec2);  // position     → parent-local (≈ obj.position)
		}
		const fx = this._tmpVec.x - this._tmpVec2.x;
		const fz = this._tmpVec.z - this._tmpVec2.z;
		if (Number.isFinite(fx) && Number.isFinite(fz) && (fx * fx + fz * fz) > 1e-8) {
			this._headingYaw = Math.atan2(fx, fz);
			this._headingValid = true;
			this._yawRate = 0; // fresh turn eases in from rest
		}
	}

	/**
	 * Resets the arrival watchdog. Call whenever a fresh navigation target is committed
	 * (a new wander waypoint, or starting an approach) so the no-progress timer measures
	 * progress toward *this* target, not a stale one.
	 */
	private _resetArrivalWatchdog(): void {
		this._prevDistToTarget = Infinity;
		this._noProgressTime = 0;
		this._orbitEscaping = false;
	}

	/**
	 * Coupled steer-and-move toward a local-space XZ target. The bird walks *along its
	 * heading* (so it never glides diagonally), and the heading is rotated toward the
	 * target at a capped yaw rate (`turnSpeed`, rad/s) — a forward walking arc, not a
	 * snap. Returns the pre-step horizontal distance to the target.
	 *
	 * Anti-orbit: forward speed is scaled by heading alignment (cos of the error) and
	 * eased down near the goal, so a sharp required turn slows the bird and tightens its
	 * arc instead of letting it circle a target it can't turn fast enough to reach. The
	 * `_STEER_SPEED_FLOOR` keeps it creeping forward through a full U-turn rather than
	 * pivoting in place.
	 */
	private _steerAndMove(obj: Object3D, targetX: number, targetZ: number, dt: number, maxSpeed: number): number {
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
			this._headingValid = false;
		}

		if (!this._headingValid) this._seedHeadingFromFacing(obj);

		const dx = targetX - obj.position.x;
		const dz = targetZ - obj.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist < 1e-5) { this._speed = 0; return dist; }

		// Arrival watchdog: a pure-pursuit walker orbits forever when the target sits
		// inside its turning circle — it keeps curving toward a point it can't reach, so
		// the distance stops shrinking. Detect that (no improvement for _ORBIT_STALL_S
		// while still short of the goal) and flip into an escape mode below.
		// Heading error toward the target bearing, wrapped to [-π, π].
		const bearing = Math.atan2(dx, dz);
		let err = bearing - this._headingYaw;
		err = Math.atan2(Math.sin(err), Math.cos(err));

		// Anti-orbit watchdog. Three cases, in priority order:
		//   • closing  (distance dropping this frame)  → real progress, clear the timer.
		//   • turningHard (|err| > 60°, mid-slew)      → NOT an orbit: the bird is creeping
		//       forward off-axis while it swings around, so distance legitimately stalls or
		//       grows. BLEED the timer down rather than accruing it (this is what was firing
		//       escape mid-turn and freezing forward motion into a "moonwalk" spin).
		//   • else (aligned, |err| ≤ 60°, yet NOT closing) → the genuine pure-pursuit orbit
		//       signature; the only case that accrues stall time toward an escape.
		// Frame-to-frame (vs an all-time best) so that the instant the turn finishes and it
		// starts closing, the timer resets instead of staying latched above a stale best.
		const closing = dist < this._prevDistToTarget - 5e-4;
		this._prevDistToTarget = dist;
		const turningHard = Math.abs(err) > (60 * Math.PI / 180);
		if (closing) this._noProgressTime = 0;
		else if (turningHard) this._noProgressTime = Math.max(0, this._noProgressTime - dt);
		else this._noProgressTime += dt;
		this._orbitEscaping = this._noProgressTime > this._ORBIT_STALL_S && dist > this._ARRIVE_DIST;

		// Turn the heading toward the target with an *eased* yaw rate (→ an S-curve arc,
		// not a flat constant-speed pan). Desired rate is proportional to the heading
		// error so it eases out as the bird lines up, capped at turnSpeed with a small
		// per-maneuver variance; the actual rate ramps toward it (angular accel) so the
		// turn also eases in from rest. Escaping an orbit, crank the cap so the heading
		// snaps onto the bearing and the turning circle collapses to nothing.
		const escapeBoost = this._orbitEscaping ? 2.5 : 1;
		const maxRate = this.turnSpeed.value * this._turnRateScale * escapeBoost;
		const desiredRate = Math.max(-maxRate, Math.min(maxRate, err * this._TURN_KP * escapeBoost));
		const dRate = this._YAW_ACCEL * escapeBoost * dt;
		this._yawRate += Math.max(-dRate, Math.min(dRate, desiredRate - this._yawRate));
		let dYaw = this._yawRate * dt;
		if (Math.abs(dYaw) >= Math.abs(err)) { dYaw = err; this._yawRate = desiredRate; } // don't overshoot
		this._headingYaw += dYaw;

		// Forward speed: ease toward the goal AND slow for sharp turns (alignment gate,
		// floored so a U-turn still arcs forward instead of pivoting). CRITICAL: keep the
		// SAME forward floor even while escaping an orbit — never drop toward 0, or the bird
		// spins on the spot (the "moonwalk": walk cycle playing, zero translation). A tighter
		// turn radius comes from turning FASTER (escapeBoost above), not from stopping:
		// radius = speed / yawRate, so a brisk turn at the floor speed already collapses the
		// circle and spirals it straight in while it keeps visibly stepping forward.
		const align = Math.max(this._STEER_SPEED_FLOOR, Math.cos(err));
		const desired = Math.min(maxSpeed, dist * this._ARRIVE_DECEL_K) * align;
		const ds = this._ACCEL * dt;
		if (this._speed < desired) this._speed = Math.min(desired, this._speed + ds);
		else this._speed = Math.max(desired, this._speed - ds);

		// Move along the heading (movement == facing, by construction). Don't overshoot
		// the target on the (near-)aligned final step.
		const hx = Math.sin(this._headingYaw), hz = Math.cos(this._headingYaw);
		const step = Math.min(this._speed * dt, dist);
		obj.position.x += hx * step;
		obj.position.z += hz * step;

		// Face exactly along the heading: look at a point one unit ahead (world space).
		this._tmpVec.set(obj.position.x + hx, obj.position.y, obj.position.z + hz);
		if (obj.parent) obj.parent.localToWorld(this._tmpVec);
		this._faceWorldPointInstant(obj, this._tmpVec);

		this._debugHeadingErrDeg = err * 180 / Math.PI;
		this._debugAlign = align;
		return dist;
	}

	/**
	 * Snap-orient obj to look at a world point (horizontal), with the lookAt NaN guard.
	 * Used by the steer where the heading itself is already rate-limited, so the mesh
	 * should match the heading exactly with no additional smoothing.
	 */
	private _faceWorldPointInstant(obj: Object3D, worldPoint: Vector3): void {
		this._tmpQuat.copy(obj.quaternion);
		obj.lookAt(worldPoint);
		if (isNaN(obj.quaternion.x)) obj.quaternion.copy(this._tmpQuat);
	}

	/**
	 * Gathers every unique animation Layer object reachable from the scene — both the
	 * root scene's animation and each behavior on the Peacock_glb node — deduped by
	 * object identity. Used by the debug overlay to surface layers we DON'T drive (a
	 * GLB rest/base clip, an auto-play, a duplicate) which could be holding a residual
	 * pose invisibly. Each is named by its scriptName key (falling back to its id).
	 */
	private _collectAllAnimLayers(): Array<{ name: string; layer: any }> {
		const seen = new Set<any>();
		const out: Array<{ name: string; layer: any }> = [];
		const harvest = (layers: any) => {
			if (!layers) return;
			for (const key of Object.keys(layers)) {
				const lyr = layers[key];
				if (!lyr || seen.has(lyr)) continue;
				seen.add(lyr);
				out.push({ name: key, layer: lyr });
			}
		};
		harvest((this._rootScene as any)?.animation?.layers);
		const behaviors = (this._rootScene as any)?.nodes?.Peacock_glb?.behaviors;
		for (const bk of Object.keys(behaviors ?? {})) harvest(behaviors[bk]?.layers);
		return out;
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

					// Coupled steer: walks *along its heading* and arcs that heading toward
					// the waypoint, so movement and facing are always the same direction
					// (no diagonal gliding) and it never pure-pursuit orbits.
					const dist = this._steerAndMove(
						obj, this._tmpVec2.x, this._tmpVec2.z, dt,
						this.walkSpeed.value * this._strollSpeedFactor);

					if (dist <= this._ARRIVE_DIST) this._beginSettle();
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

					// Walk over (coupled steer), aiming at a point greetDist short of the
					// viewer so it glides to a stop at conversation distance rather than into
					// their face. The notice beat just turned the body in place, so the steer
					// re-seeds its heading from that facing before stepping.
					const f = (dist - greetDist) / dist;
					const targetDist = this._steerAndMove(
						obj, obj.position.x + dx * f, obj.position.z + dz * f, dt, this.walkSpeed.value);

					// The steer DECELERATES onto that greetDist-short point, so it brakes to a
					// near-halt right around viewer-dist ≈ greetDist. If it stops a hair outside
					// greetDist the `dist <= greetDist` check above never flips — so also arrive
					// once the steer has reached its own target, regardless of the exact
					// viewer-distance crossing. Otherwise it would stand here forever playing
					// the walk cycle in place.
					if (targetDist <= this._ARRIVE_DIST) {
						this._enterConversating(this._greetOnArrival);
						break;
					}

					// Drive the gait from actual motion: only play the walk cycle while it is
					// genuinely moving or turning, never in place once it has braked to a stop.
					const moving = this._speed > 0.05;
					const turning = Math.abs(this._debugHeadingErrDeg) > 6;
					this._setAnim(moving || turning ? "walk" : "idle", { loop: true });
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

					const TURN_ON  = 0.21; // ~12° — start turning
					const TURN_OFF = 0.14; // ~8° — stop turning (hysteresis)

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
						this._headingValid = false; // body turned directly — re-seed before next walk
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
		this._logSdkEvent("audioPlaybackStarted");
		// A started arriving while a complete is still held in its guard window means that
		// "complete" was spurious (the SDK's gap-based drain heuristic, not a real end of
		// speech) — drop it so we never acted on it.
		if (this._audioCompleteGuardTimer !== null) {
			clearTimeout(this._audioCompleteGuardTimer);
			this._audioCompleteGuardTimer = null;
			this._logSdkEvent("  → cancelled spurious pending complete");
		}
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
		this._logSdkEvent("audioPlaybackComplete (pending guard)");
		// Don't act immediately — hold it for _AUDIO_COMPLETE_GUARD_MS in case it's spurious
		// (see field comment). _onAudioPlaybackStarted cancels this timer if speech resumes
		// within the window; only once it fires unchallenged do we treat speech as truly over.
		if (this._audioCompleteGuardTimer !== null) clearTimeout(this._audioCompleteGuardTimer);
		this._audioCompleteGuardTimer = setTimeout(() => {
			this._audioCompleteGuardTimer = null;
			this._logSdkEvent("audioPlaybackComplete (confirmed)");
			this._isSpeaking = false;
			if (this._state === "isConversating") {
				// Switch to the calmer "listening" palette and start the silence countdown.
				if (!this._isTurning) this._pickConversatingAnim();
				this._resetInactivityTimer("audioPlaybackComplete");
			}
		}, this._AUDIO_COMPLETE_GUARD_MS);
	}

	private _onSttResponse(payload: { text: string; isFinal: boolean }): void {
		this._logSdkEvent(`sttResponse isFinal=${payload.isFinal} "${payload.text.slice(0, 40)}"`);

		// User spoke up before the character ever noticed them (still patrolling/idle).
		// Still play the physical noticing → walk-over → settle beat for visual consistency,
		// but skip the canned introduction — they already started the conversation themselves,
		// so just let the normal conversating animation palette take over once it arrives.
		if (this._state === "notEngaged" && !this._hasGreeted && this._camera && this._vpsReady) {
			this._logDebugEvent("user spoke first → noticing viewer (no intro)");
			this._enterApproaching(false);
			return;
		}

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
		this._resetArrivalWatchdog();
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
			const prompt = this.introductionPrompt.value.trim();
			if (prompt && this._client) {
				// sendText (not sayLine) routes through the character's LLM, so it
				// generates its own introduction from this instruction rather than
				// speaking back fixed, prewritten text. textOnly=false → TTS audio.
				this._client.sendText(prompt, false);
				this._logDebugEvent("sent introduction prompt");
			} else {
				console.log("SampleCharacterAnimator: Greeting viewer (no client/prompt)");
				this._resetInactivityTimer("greet-no-client-fallback");
			}
			// Timer starts in _onAudioPlaybackComplete so the silence counts down
			// after speech finishes, not while it's still playing.

			// A full tail-spread as a greeting flourish — the peacock showing off as
			// it says hello. Otherwise settle straight into the attentive idle.
			if (Math.random() < 0.55) {
				this._setAnim("display", { loop: false });
				this._convAnimStartedAt = performance.now();
				this._queueNextConvAnim(this._DISPLAY_DURATION_S);
			} else {
				this._convAnimStartedAt = 0; // first pick of the conversation — no hold to respect yet
				this._pickConversatingAnim();
			}
		} else {
			this._convAnimStartedAt = 0;
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
	 * animated — expressive idle with the occasional full display for emphasis)
	 * from *listening* (calmer — attentive idle with the occasional patient
	 * preen). The feather-shake is deliberately NOT part of the conversation
	 * palette (it's a wander-only comfort beat). Tunable via the conversating*
	 * weight properties.
	 */
	private _pickConversatingAnim(): void {
		// Never cut an animation short — if it hasn't been held for the minimum
		// duration yet, defer the re-roll instead of sampling a new one now.
		const heldS = (performance.now() - this._convAnimStartedAt) / 1000;
		if (this._convAnimStartedAt !== 0 && heldS < this._CONV_ANIM_MIN_HOLD_S) {
			this._queueNextConvAnim(this._CONV_ANIM_MIN_HOLD_S - heldS);
			return;
		}

		const speaking = this._isSpeaking;
		const idleW = Math.max(0, this.conversatingIdleWeight.value);
		// Won't groom mid-sentence — preening is a calm listening-time comfort beat.
		const preenW = Math.max(0, this.conversatingLickingWeight.value) * (speaking ? 0.1 : 1);
		const expressW = Math.max(0, this.conversatingSpreadWeight.value);
		// Full tail display, as a rare, deliberate flourish (gated by displayChance).
		const displayW = expressW * (speaking ? 0.5 : 0.2) * Math.max(0, Math.min(1, this.displayChance.value * 3));

		const total = idleW + preenW + displayW;
		let roll = Math.random() * (total || 1);

		let key: AnimKey; let dur: number;
		if (total === 0 || (roll -= idleW) < 0)      { key = "idle";    dur = this._CONVERSATING_IDLE_DURATION_S; }
		else if ((roll -= preenW) < 0)               { key = "preen";   dur = this._PREEN_DURATION_S; }
		else                                         { key = "display"; dur = this._DISPLAY_DURATION_S; }

		const loop = key === "idle";
		this._setAnim(key, { loop });
		this._convAnimStartedAt = performance.now();
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

		// Give this leg's turns their own briskness so no two maneuvers sweep identically.
		this._turnRateScale = MathUtils.randFloat(0.72, 1.3);

		// Never aim at a spot the bird would orbit. A target inside the turning circle can't
		// be reached by curving toward it, so require it to be at least the turn *diameter*
		// (2R, R = speed / yawRate) away — that puts it outside both forbidden circles for
		// any starting bearing. Computed from this leg's actual speed/turn-rate, plus margin.
		const turnRadius = (this.walkSpeed.value * this._strollSpeedFactor) /
			Math.max(0.1, this.turnSpeed.value * this._turnRateScale);
		const minDist = 2 * turnRadius + 0.15;

		const obj = this._obj;
		obj.getWorldPosition(this._tmpVec);
		const cx = this._tmpVec.x, cz = this._tmpVec.z;
		const farEnough = (p: { x: number; z: number }) =>
			(p.x - cx) ** 2 + (p.z - cz) ** 2 >= minDist * minDist;
		let best: { x: number; z: number } | null = null;

		if (awayFromCamera && this._camera) {
			// Pick, among a few candidates, the one furthest from the viewer — but only
			// from those far enough not to orbit (fall back to furthest overall if none).
			this._camera.getWorldPosition(this._tmpVec2);
			let bestScore = -Infinity, bestAny: { x: number; z: number } | null = null, bestAnyScore = -Infinity;
			for (let i = 0; i < 8; i++) {
				const c = this._samplePointInPolygon(verts);
				const score = (c.x - this._tmpVec2.x) ** 2 + (c.z - this._tmpVec2.z) ** 2;
				if (score > bestAnyScore) { bestAnyScore = score; bestAny = c; }
				if (farEnough(c) && score > bestScore) { bestScore = score; best = c; }
			}
			best = best ?? bestAny;
		} else if (Math.random() < 0.6) {
			// Short forage hop: a nearby point that's still inside the boundary AND at least
			// the orbit-safe distance away (so the "short" hop can't become a tight circle).
			const rMax = Math.max(minDist + 0.5, 1.3);
			for (let i = 0; i < 10; i++) {
				const ang = Math.random() * Math.PI * 2;
				const r = MathUtils.randFloat(minDist, rMax);
				const px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
				if (this._pointInPolygon(verts, px, pz)) { best = { x: px, z: pz }; break; }
			}
		}
		if (!best || !farEnough(best)) {
			// Longer stroll / fallback — resample until far enough (bounded), so even the
			// fallback never hands back an orbit-prone target.
			for (let i = 0; i < 12; i++) {
				const c = this._samplePointInPolygon(verts);
				if (farEnough(c)) { best = c; break; }
				best = best ?? c;
			}
			if (!best) best = this._samplePointInPolygon(verts);
		}

		// WORLD space — must NOT be pre-converted to parent-local here; _animate does
		// that fresh each frame against the live VPS anchor pose. (y unused downstream.)
		this._patrolWaypoint.set(best.x, 0, best.z);
		this._resetArrivalWatchdog();
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
		// Logic stays intact even when hidden — _updateDebugOverlay/_logDebugEvent
		// just no-op without a live _debugOverlay, so toggling showDebugOverlay
		// back on later is a one-property change.
		if (!this.showDebugOverlay.value) return;

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
					"width:300px",
					"overflow-wrap:break-word",
					"word-break:break-all",
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
					["State",      false],
					["Patrol",     true ],
					["Locomotion", true ],
					["Animation",  true ],
					["Events",     false],
				] as Array<[string, boolean]>) {
					const sectionEl  = document.createElement("div");
					const headerEl   = document.createElement("div");
					const sectionContent = document.createElement("div");

					headerEl.style.cssText = headerStyle;
					headerEl.textContent = `${defaultCollapsed ? "▶" : "▼"} ${name}`;
					sectionContent.style.cssText = `white-space:pre-wrap;overflow-wrap:break-word;word-break:break-all;padding-top:2px${defaultCollapsed ? ";display:none" : ""}`;

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

		// ── Locomotion section ───────────────────────────────────────────
		const locoEntry = this._debugSections.get("Locomotion");
		if (locoEntry && !locoEntry.collapsed) {
			locoEntry.contentEl.innerHTML = [
				`heading:    ${(this._headingYaw * 180 / Math.PI).toFixed(0)}°  ${this._headingValid ? "" : "(re-seed)"}`,
				`headingErr: ${this._debugHeadingErrDeg.toFixed(0)}°`,
				`align:      ${this._debugAlign.toFixed(2)}  (floor ${this._STEER_SPEED_FLOOR})`,
				`speed:      ${this._speed.toFixed(2)} m/s`,
				`yawRate:    ${(this._yawRate * 180 / Math.PI).toFixed(0)}°/s`,
				`turnCap:    ${(this.turnSpeed.value * this._turnRateScale).toFixed(1)} rad/s  (×${this._turnRateScale.toFixed(2)})`,
				`noProgress: ${this._noProgressTime.toFixed(1)}s  ${this._orbitEscaping ? "⚠ ORBIT-ESCAPE" : ""}`,
			].join("<br>");
		}

		// ── Animation section ────────────────────────────────────────────
		const animEntry = this._debugSections.get("Animation");
		if (animEntry && !animEntry.collapsed) {
			// We drive THREE.AnimationMixer actions directly (not the @zcomponent layer).
			// One row per action with its live effective WEIGHT — this is the actual pose
			// contribution. During a crossfade you'll see two rows with weights summing to
			// ~1; at rest exactly one row at 1.00 and all others 0.00. Any non-current row
			// stuck above 0 is the bleed source.
			const rows: string[] = [];
			for (const key of Object.keys(SampleCharacterAnimator._ANIM) as AnimKey[]) {
				const a = this._actions[key];
				if (!a) { rows.push(`  ${key}: — no action —`); continue; }
				const w = a.getEffectiveWeight();
				const bar = "█".repeat(Math.round(w * 8)).padEnd(8, "·");
				const cur = key === this._currentAnimKey ? "►" : " ";
				const st = a.isRunning() ? "run" : (a.paused ? "pause" : "stop");
				rows.push(`${cur} ${key}: ${bar} ${w.toFixed(2)} ${st} t:${a.time.toFixed(2)}`);
			}

			// Sanity check the @zcomponent layer stays EMPTY — if it ever goes ACTIVE it's
			// double-driving these same actions and will fight the mixer crossfade.
			const lyr = (this._rootScene as any)?.animation?.layers?.[SampleCharacterAnimator._LAYER];
			const layerState = !lyr ? "—"
				: lyr.active === undefined ? "empty ✓"
				: lyr.active === null ? "fade→clr"
				: "ACTIVE ⚠ FIGHTING";

			animEntry.contentEl.innerHTML = [
				`currentKey: ${this._currentAnimKey ?? "—"}`,
				`lastPlay:   ${this._debugLastAnimPath}`,
				`mixer: ${this._mixer ? "ready" : "NULL ⚠"}   xfade:${this.crossfadeTime.value.toFixed(2)}s   layer:${layerState}`,
				"",
				"actions (► current · weight bar · state · t:time):",
				...rows,
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
		if (this._audioCompleteGuardTimer !== null) {
			clearTimeout(this._audioCompleteGuardTimer);
			this._audioCompleteGuardTimer = null;
		}
		this._clearConversatingTimers();
		this._clearPatrolTimers();
		if (this._mixerListenerCleanup) {
			this._mixerListenerCleanup();
			this._mixerListenerCleanup = null;
		}
		// Stop our actions so they don't keep contributing a frozen pose after teardown.
		for (const a of Object.values(this._actions)) { try { a?.stop(); } catch { /* noop */ } }
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
