import { Component, Behavior, ContextManager, Observable, started } from "@zcomponent/core";
import { EstuaryClient } from "@estuary-ai/sdk";

interface ConstructionProps {
	/** The Estuary character ID */
	characterId?: string;

	/** The Estuary API key (starts with 'est_') */
	apiKey?: string;

	/** The server URL */
	serverUrl?: string;

	/** Unique ID for this player/user */
	playerId?: string;

	/** Auto-start voice when connected */
	autoStartVoice?: boolean;
}

/**
 * @zbehavior
 * Manages voice conversation connection to Estuary AI
 **/
export class EstuaryVoiceConnection extends Behavior<Component> {

	/**
	 * The character ID to use for the conversation
	 * @zui
	 * @zdefault ""
	 */
	public characterId = new Observable<string>("", (value) => {
		if (this.client && value) {
			this._reconnect();
		}
	});

	/**
	 * The API key for Estuary (starts with 'est_')
	 * @zui
	 * @zdefault ""
	 */
	public apiKey = new Observable<string>("", (value) => {
		if (this.client && value) {
			this._reconnect();
		}
	});

	/**
	 * The server URL
	 * @zui
	 * @zdefault "https://api.estuary-ai.com"
	 */
	public serverUrl = new Observable<string>("https://api.estuary-ai.com");

	/**
	 * Unique ID for this player/user
	 * @zui
	 * @zdefault "player-1"
	 */
	public playerId = new Observable<string>("player-1");

	/**
	 * Auto-start voice when connected
	 * @zui
	 * @zdefault true
	 */
	public autoStartVoice = new Observable<boolean>(true);

	/**
	 * Whether the voice connection is active
	 * @zui
	 */
	public isConnected = new Observable<boolean>(false);

	/**
	 * Whether the AI is currently speaking
	 * @zui
	 */
	public isSpeaking = new Observable<boolean>(false);

	/**
	 * Whether the user is currently speaking
	 * @zui
	 */
	public isListening = new Observable<boolean>(false);

	/**
	 * Whether the microphone is muted
	 * @zui
	 */
	public isMuted = new Observable<boolean>(false);

	private client: EstuaryClient | null = null;

	constructor(contextManager: ContextManager, instance: Component, protected constructorProps: ConstructionProps) {
		super(contextManager, instance);

		this.characterId.value = constructorProps.characterId || "";
		this.apiKey.value = constructorProps.apiKey || "";
		this.serverUrl.value = constructorProps.serverUrl || "https://api.estuary-ai.com";
		this.playerId.value = constructorProps.playerId || "player-1";
		this.autoStartVoice.value = constructorProps.autoStartVoice ?? true;

		// Initialize connection when the experience starts
		started(this.contextManager).then(() => {
			this._initializeConnection();
			this._wireMuteButton();
		});
	}

	private _wireMuteButton() {
		const btn = document.getElementById("muteButton");
		if (!btn) return;

		btn.addEventListener("click", () => {
			this.toggleMute();
			btn.classList.toggle("muted", this.isMuted.value);
		});
	}

	private async _initializeConnection() {
		const characterId = this.characterId.value;
		const apiKey = this.apiKey.value;
		const playerId = this.playerId.value || "player-1";
		const serverUrl = this.serverUrl.value || "https://api.estuary-ai.com";

		if (!characterId || !apiKey) {
			console.warn("EstuaryVoiceConnection: Character ID and API Key are required");
			return;
		}

		try {
			this.client = new EstuaryClient({
				serverUrl: serverUrl,
				apiKey: apiKey,
				characterId: characterId,
				playerId: playerId,
				voiceTransport: 'livekit',
				autoReconnect: true,
				debug: false,
				realtimeMemory: true,
				audioSampleRate: 24000,
			});

			(window as any).__estuaryClient = this.client;

			// Set up event listeners
			this.client.on("connected", async (session) => {
				console.log("Estuary: Connected", session);
				this.isConnected.value = true;

				if (this.autoStartVoice.value) {
					await this.startVoice();
				}
			});

			this.client.on("disconnected", (reason) => {
				console.log("Estuary: Disconnected", reason);
				this.isConnected.value = false;
				this.isSpeaking.value = false;
				this.isListening.value = false;
			});

			this.client.on("botResponse", (response) => {
				console.log("Estuary bot response:", response.text);
				if (response.isFinal) {
					console.log("Estuary: Response complete");
				}
			});

			this.client.on("botVoice", (voice) => {
				this.isSpeaking.value = true;
			});

			this.client.on("sttResponse", (stt) => {
				console.log("Estuary STT:", stt.text);
				this.isListening.value = stt.isFinal ? false : true;
			});

			this.client.on("error", (error) => {
				console.error("Estuary error:", error);
			});

			this.client.on("interrupt", (data) => {
				console.log("Estuary: Interrupted", data);
				this.isSpeaking.value = false;
			});

			this.client.on("cameraCaptureRequest", (request) => {
				console.log("Estuary: Camera capture requested", request.requestId);
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						this._captureAndSendImage(request.requestId, request.text);
					});
				});
			});

			this.client.on("audioPlaybackComplete", (messageId: string) => {
				this.isSpeaking.value = false;
				console.log("Estuary: Audio playback complete", messageId);
			});

			this.client.on("quotaExceeded", (data) => {
				console.log("Estuary: Quota exceeded", data);
			});

			// Connect to Estuary
			await this.client.connect();
			console.log("Estuary: Connection initialized");

		} catch (error) {
			console.error("Failed to initialize Estuary connection:", error);
		}
	}

	private async _reconnect() {
		if (this.client) {
			await this.disconnect();
		}
		await this._initializeConnection();
	}

	private _captureAndSendImage(requestId: string, text?: string) {
		const canvas = document.querySelector('canvas');
		if (!canvas || !this.client) {
			console.warn("Estuary: Cannot capture - no canvas or client");
			return;
		}

		try {
			const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
			const base64 = dataUrl.split(',')[1];
			this.client.sendCameraImage(base64, 'image/jpeg', requestId, text);
			console.log("Estuary: Camera image sent for request", requestId);
		} catch (error) {
			console.error("Estuary: Failed to capture camera image:", error);
		}
	}

	/**
	 * Manually connect to Estuary
	 */
	public async connect() {
		if (!this.client) {
			await this._initializeConnection();
		} else if (!this.isConnected.value) {
			await this.client.connect();
		}
	}

	/**
	 * Disconnect from Estuary
	 */
	public async disconnect() {
		if (this.client) {
			await this.client.disconnect();
			(window as any).__estuaryClient = null;
			this.client = null;
			this.isConnected.value = false;
		}
	}

	/**
	 * Start voice conversation (requests microphone permission)
	 */
	public async startVoice() {
		if (!this.client) {
			console.warn("Estuary client not initialized");
			return;
		}

		try {
			await this.client.startVoice();
			console.log("Estuary: Voice started");
		} catch (error) {
			console.error("Failed to start voice:", error);
		}
	}

	/**
	 * Stop voice conversation
	 */
	public stopVoice() {
		if (!this.client) {
			console.warn("Estuary client not initialized");
			return;
		}

		this.client.stopVoice();
		this.isListening.value = false;
		console.log("Estuary: Voice stopped");
	}

	/**
	 * Toggle mute on/off
	 */
	public toggleMute() {
		if (!this.client) {
			console.warn("Estuary client not initialized");
			return;
		}

		this.client.toggleMute();
		this.isMuted.value = !!this.client.isMuted;
		console.log("Estuary: Mute toggled, muted:", this.isMuted.value);
	}

	/**
	 * Send a text message to the character
	 * @param text The text to send
	 * @param textOnly If true, response will be text-only (no voice)
	 */
	public sendText(text: string, textOnly?: boolean) {
		if (!this.client) {
			console.warn("Estuary client not initialized");
			return;
		}

		try {
			this.client.sendText(text, textOnly);
			console.log("Estuary: Sent text:", text);
		} catch (error) {
			console.error("Failed to send text:", error);
		}
	}

	/**
	 * Interrupt the current bot response
	 */
	public interrupt(messageId?: string) {
		if (!this.client) {
			console.warn("Estuary client not initialized");
			return;
		}

		this.client.interrupt(messageId);
		this.isSpeaking.value = false;
		console.log("Estuary: Interrupted");
	}

	dispose() {
		if (this.client) {
			this.client.disconnect();
			this.client = null;
		}
		(window as any).__estuaryClient = null;
		return super.dispose();
	}
}
