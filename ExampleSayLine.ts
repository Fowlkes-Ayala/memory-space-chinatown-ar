import { Behavior, Component, ContextManager, Observable, started } from "@zcomponent/core";
import { EstuaryClient } from "@estuary-ai/sdk";
import type { ScriptController } from "@estuary-ai/sdk";

interface ConstructionProps {
	/** Automatically speak the first scripted line once the voice session is ready */
	autoSpeakOnConnect?: boolean;

	/** Brief settle pause after the session is ready, before speaking the first line */
	delayBeforeFirstLineSeconds?: number;

	/** Speak the lines out loud with TTS audio (false = text only, no audio) */
	useTts?: boolean;

	/** Scripted lines — what the character says (leave blank to skip) */
	line1?: string;
	line2?: string;
	line3?: string;
	line4?: string;
	line5?: string;
}

/**
 * @zbehavior
 * EXAMPLE: scripts the character to speak prewritten lines via Estuary's "say line" feature.
 *
 * `sayLine()` sends text straight to TTS — the character speaks your exact words without going
 * through the LLM. The line is saved to chat history, so the AI remembers it said this in future
 * turns. Use it for greetings, tutorials, story beats, or any scripted dialogue.
 *
 * Edit the lines (and toggle TTS) right in the Properties panel — no code changes needed.
 * To speak automatically on startup, turn ON `autoSpeakOnConnect` (it defaults to OFF).
 *
 * This behavior discovers the EstuaryClient via `window.__estuaryClient` (set by
 * EstuaryVoiceConnection on the root node), so attach it to ANY NON-ROOT node — never the root
 * Group node (that node is reserved for EstuaryVoiceConnection).
 *
 * Trigger lines at runtime from another behavior or the devtools console:
 *   window.__estuaryExampleSayLine.sayNext()        // next line
 *   window.__estuaryExampleSayLine.sayTextOnly()    // a silent text-only line
 *   window.__estuaryExampleSayLine.say("Hi there")  // any text
 *   window.__estuaryExampleSayLine.playFullScript() // all lines in order (paced sequencer)
 **/
export class ExampleSayLine extends Behavior<Component> {

	/**
	 * Automatically speak the first scripted line once the voice session is ready.
	 * @zui
	 * @zdefault false
	 */
	public autoSpeakOnConnect = new Observable<boolean>(false);

	/**
	 * A brief, natural pause AFTER the voice session is ready, before speaking the first line.
	 * (Readiness is detected, not timed — this is just a settle/UX delay.)
	 * @zui
	 * @zdefault 2
	 */
	public delayBeforeFirstLineSeconds = new Observable<number>(2);

	/**
	 * Speak the lines out loud with TTS audio. Turn off to deliver them as text only (no audio) —
	 * the lines are still saved to the conversation history.
	 * @zui
	 * @zdefault true
	 */
	public useTts = new Observable<boolean>(true);

	// ── Scripted lines — edit these in the Properties panel ───────────────────────────────────
	// Each non-empty line, in order, is what the character says. `sayNext()` advances through them
	// one at a time; `playFullScript()` speaks them all in order. Leave a field blank to skip it.

	/**
	 * Scripted line 1.
	 * @zui
	 * @zdefault "Welcome, traveler! I have wares if you have coin."
	 */
	public line1 = new Observable<string>("Welcome, traveler! I have wares if you have coin.");

	/**
	 * Scripted line 2.
	 * @zui
	 * @zdefault "That gear you're carrying has seen better days. I could fix it up for you."
	 */
	public line2 = new Observable<string>("That gear you're carrying has seen better days. I could fix it up for you.");

	/**
	 * Scripted line 3.
	 * @zui
	 * @zdefault "Come back anytime. I'll keep the forge warm."
	 */
	public line3 = new Observable<string>("Come back anytime. I'll keep the forge warm.");

	/**
	 * Scripted line 4 (optional).
	 * @zui
	 * @zdefault ""
	 */
	public line4 = new Observable<string>("");

	/**
	 * Scripted line 5 (optional).
	 * @zui
	 * @zdefault ""
	 */
	public line5 = new Observable<string>("");

	private client: EstuaryClient | null = null;
	private clientPollInterval: ReturnType<typeof setInterval> | null = null;
	private readyPollInterval: ReturnType<typeof setInterval> | null = null;
	private firstLineTimer: ReturnType<typeof setTimeout> | null = null;
	private currentLineIndex = 0;
	private activeScript: ScriptController | null = null;

	constructor(contextManager: ContextManager, instance: Component, protected constructorProps: ConstructionProps) {
		super(contextManager, instance);

		this.autoSpeakOnConnect.value = constructorProps.autoSpeakOnConnect ?? false;
		this.delayBeforeFirstLineSeconds.value = constructorProps.delayBeforeFirstLineSeconds ?? 2;
		this.useTts.value = constructorProps.useTts ?? true;
		this.line1.value = constructorProps.line1 ?? this.line1.value;
		this.line2.value = constructorProps.line2 ?? this.line2.value;
		this.line3.value = constructorProps.line3 ?? this.line3.value;
		this.line4.value = constructorProps.line4 ?? this.line4.value;
		this.line5.value = constructorProps.line5 ?? this.line5.value;

		// Expose this instance for manual triggering from other behaviors / the console.
		started(this.contextManager).then(() => {
			(window as any).__estuaryExampleSayLine = this;
			this._pollForClient();
		});
	}

	/**
	 * Collect the non-empty scripted lines, in order, from the editable Properties-panel fields.
	 * Read at speak-time (not cached) so edits made in the editor take effect immediately.
	 */
	private getScriptedLines(): string[] {
		return [this.line1, this.line2, this.line3, this.line4, this.line5]
			.map((o) => o.value.trim())
			.filter((s) => s.length > 0);
	}

	/**
	 * The EstuaryClient is created asynchronously by EstuaryVoiceConnection once the experience
	 * launches and connects. Poll `window.__estuaryClient` until it appears, then wire up.
	 */
	private _pollForClient() {
		let attempts = 0;
		this.clientPollInterval = setInterval(() => {
			attempts++;
			const client = (window as any).__estuaryClient as EstuaryClient | undefined;
			if (client) {
				clearInterval(this.clientPollInterval!);
				this.clientPollInterval = null;
				this.client = client;
				if (this.autoSpeakOnConnect.value) this._armFirstLineWhenReady();
			} else if (attempts === 40) {
				console.warn(
					"[ExampleSayLine] No window.__estuaryClient after ~10s. Make sure EstuaryVoiceConnection is " +
						"on the root node (with apiKey + characterId set) and this behavior is on a non-root node.",
				);
			}
		}, 250);
	}

	/**
	 * Wait until the voice session is actually ready, THEN speak the first line after a brief
	 * settle delay.
	 *
	 * `say_line` audio is routed by the gateway based on the session's transport, which is only
	 * established once LiveKit has joined. If we spoke on a fixed timer before that, the line's
	 * audio would be sent over Socket.IO instead of the LiveKit track — and in LiveKit mode the SDK
	 * has no audio player, so it would be silent. `client.isVoiceActive` flips true only after the
	 * SDK has joined LiveKit, so it's the right readiness signal. A text-only line only needs the
	 * connection.
	 */
	private _armFirstLineWhenReady() {
		const bufferMs = Math.max(0, this.delayBeforeFirstLineSeconds.value * 1000);
		const wantsAudio = this.useTts.value;
		const startedWaiting = Date.now();
		const MAX_WAIT_MS = 20000;

		const isReady = () => {
			if (!this.client || !this.client.isConnected) return false;
			return wantsAudio ? this.client.isVoiceActive : true;
		};

		const speakSoon = () => {
			if (this.readyPollInterval) {
				clearInterval(this.readyPollInterval);
				this.readyPollInterval = null;
			}
			this.firstLineTimer = setTimeout(() => {
				this.firstLineTimer = null;
				this.sayNext();
			}, bufferMs);
		};

		if (isReady()) {
			speakSoon();
			return;
		}

		this.readyPollInterval = setInterval(() => {
			if (isReady()) {
				speakSoon();
			} else if (Date.now() - startedWaiting >= MAX_WAIT_MS) {
				console.warn("[ExampleSayLine] Voice session not ready after 20s; speaking anyway.");
				speakSoon();
			}
		}, 250);
	}

	/**
	 * Speak the next scripted line, advancing a wrap-around cursor. Honors the `useTts` toggle.
	 */
	public sayNext() {
		if (!this.client) {
			console.warn("[ExampleSayLine] Not connected yet.");
			return;
		}

		const lines = this.getScriptedLines();
		if (lines.length === 0) {
			console.warn("[ExampleSayLine] No scripted lines set (all line1-5 fields are blank).");
			return;
		}

		const index = this.currentLineIndex % lines.length;
		const line = lines[index];
		console.log(`[ExampleSayLine] Speaking line ${index + 1}/${lines.length}: "${line}"`);
		this.client.sayLine(line, !this.useTts.value);
		this.currentLineIndex = (index + 1) % lines.length;
	}

	/**
	 * Send a one-off text-only scripted line (no audio, regardless of the `useTts` setting) —
	 * useful for subtitles, captions, or silent narration the AI should still "remember" saying.
	 */
	public sayTextOnly() {
		if (!this.client) {
			console.warn("[ExampleSayLine] Not connected yet.");
			return;
		}
		this.client.sayLine("This is a silent scripted line — delivered as text only, no audio.", true);
	}

	/**
	 * Speak any arbitrary text.
	 * @param text The text for the character to say
	 * @param textOnly Override audio for this call. Defaults to the inverse of the `useTts` toggle.
	 */
	public say(text: string, textOnly?: boolean) {
		if (!this.client) {
			console.warn("[ExampleSayLine] Not connected yet.");
			return;
		}
		this.client.sayLine(text, textOnly ?? !this.useTts.value);
	}

	/**
	 * Speak ALL scripted lines in order using the SDK's `playScript()` sequencer.
	 *
	 * The sequencer paces the lines: it sends one, waits for it to finish, then sends the next.
	 * This is required because `say_line` interrupts any in-progress speech server-side — firing
	 * the lines all at once would make each one cut off the previous, so only the last would play.
	 */
	public playFullScript() {
		if (!this.client) {
			console.warn("[ExampleSayLine] Not connected yet.");
			return;
		}

		const lines = this.getScriptedLines();
		if (lines.length === 0) {
			console.warn("[ExampleSayLine] No scripted lines set (all line1-5 fields are blank).");
			return;
		}

		// Starting a new script stops any previous one (the SDK also does this internally).
		this.activeScript?.stop();
		console.log(`[ExampleSayLine] Playing ${lines.length}-line script`);
		this.activeScript = this.client.playScript(lines, {
			textOnly: !this.useTts.value,
			lineGapMs: 250,
		});
	}

	/**
	 * Reset the cursor back to the first scripted line (affects sayNext()).
	 */
	public resetLines() {
		this.currentLineIndex = 0;
	}

	dispose() {
		if (this.clientPollInterval) {
			clearInterval(this.clientPollInterval);
			this.clientPollInterval = null;
		}
		if (this.readyPollInterval) {
			clearInterval(this.readyPollInterval);
			this.readyPollInterval = null;
		}
		if (this.firstLineTimer) {
			clearTimeout(this.firstLineTimer);
			this.firstLineTimer = null;
		}
		this.activeScript?.stop();
		this.activeScript = null;
		this.client = null;
		if ((window as any).__estuaryExampleSayLine === this) {
			(window as any).__estuaryExampleSayLine = null;
		}
		return super.dispose();
	}
}
