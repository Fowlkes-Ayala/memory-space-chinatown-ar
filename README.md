# Estuary Mattercraft Template

A [Mattercraft](https://docs.zap.works/mattercraft/) WebAR project featuring a voice-enabled 3D peacock character powered by [Estuary](https://estuary-ai.com). The character patrols a defined area, notices and approaches nearby visitors, and holds spoken conversations using live microphone input and synthesized speech.

## Prerequisites

- [Mattercraft](https://zap.works/mattercraft/) editor
- An [Estuary](https://app.estuary-ai.com) account with:
  - An **API key** (starts with `est_`)
  - A **character ID** (created in the Estuary Configurator)

## Quick Start

1. Open this project in Mattercraft
2. Select the **EstuaryVoiceConnection** behavior (on the root `Group` node) and set your `apiKey` and `characterId` in the Properties panel
3. Click **Preview** — approach the peacock and start speaking to it
4. Use the **debug skip button** (`#debugSkipButton`) to bypass the Estuary connection while iterating on animation/patrol behavior without an API key
5. Publish when ready

## Project Structure

```
estuary-mattercraft-template/
├── index.ts                     # Entry point — initializes the scene, wires debug skip button
├── index.html                   # HTML shell (splash, launch button, mute button)
├── Scene.zcomp                  # Scene graph (edit visually in Mattercraft)
├── Scene.zcomp.d.ts             # Auto-generated scene type declarations
├── EstuaryVoiceConnection.ts    # Estuary SDK connection + voice pipeline + VLM capture
├── SampleCharacterAnimator.ts   # Peacock patrol AI, conversation state, animation blending
├── ExampleSayLine.ts            # Example: scripted TTS lines via Estuary's "say line" feature
├── FixGLTFMaterials.ts          # Fixes alphaMode BLEND transparency on GLB models
├── TexturedMaterial.ts          # @zcomponent for runtime texture swapping on GLTF materials
└── 3D Models/                   # Peacock GLB and marker models
```

## Behaviors

### EstuaryVoiceConnection

Attached to the root `Group` node. Manages the Estuary SDK client lifecycle, the voice pipeline (mic in / TTS out), and camera capture for Vision/VLM requests. Exposes the live `EstuaryClient` on `window.__estuaryClient` so other behaviors can subscribe to events without prop drilling.

**Properties panel settings:**

| Property | Description | Default |
|---|---|---|
| `characterId` | Your Estuary character ID | `""` |
| `apiKey` | Your Estuary API key (`est_...`) | `""` |
| `serverUrl` | Estuary API server URL | `"https://api.estuary-ai.com"` |
| `playerId` | Unique identifier for the end user | `"player-1"` |
| `autoStartVoice` | Start voice automatically on connect | `true` |

**Read-only state** (consumed by other behaviors):

| Property | Description |
|---|---|
| `isConnected` | Whether the voice connection is active |
| `isSpeaking` | Whether the AI is currently speaking |
| `isListening` | Whether the user is currently speaking |
| `isMuted` | Whether the microphone is muted |

### SampleCharacterAnimator

Attached to the peacock GLTF node (`Peacock_glb`). Drives the character's full behavior loop:

- **Patrol AI** — wanders within the polygon defined by `PatrolBoundary`'s child nodes, pausing for randomized intervals
- **Proximity detection** — notices the visitor when they're within `proximityRadius` of the camera, turns to face them, and triggers an introduction via Estuary
- **Conversation state** — while conversing, blends between idle/licking-feathers/spread-feathers animations using weighted randomization (`conversatingIdleWeight`, `conversatingLickingWeight`, `conversatingSpreadWeight`) and times out back to patrol after `conversatingTimeout` seconds of silence
- **Animation blending** — crossfades GLTF clips by driving the underlying `THREE.AnimationMixer` actions directly (see [CLAUDE.md](CLAUDE.md) for why — `@zcomponent` stream tracks don't support weighted blending)
- **Debug overlay** — renders live state (patrol position, distance to camera, current animation) to the `#DebugOverlay` HTML node, or an auto-created fallback if absent

Key tunable properties (all exposed via `@zui` in the Properties panel): `patrolBoundaryParent`, `walkSpeed`, `turnSpeed`, `minPauseInterval`/`maxPauseInterval`, `minPauseDuration`/`maxPauseDuration`, `proximityRadius`, `conversatingTimeout`, `crossfadeTime`, `displayChance`, `noticeDuration`, `introductionPrompt`.

### ExampleSayLine

An optional example behavior showing how to script the character to speak prewritten lines via Estuary's `sayLine()` — text sent straight to TTS, bypassing the LLM, while still being recorded in chat history. Attach to any **non-root** node (it discovers the client via `window.__estuaryClient`). Configure up to 5 lines, toggle TTS on/off, and optionally trigger the first line automatically on connect. Can also be triggered at runtime via `window.__estuaryExampleSayLine`.

### FixGLTFMaterials

Attach to any GLTF node whose Blender-exported materials use `alphaMode: BLEND` and render as see-through in Three.js (depthWrite is disabled by default for transparent materials). Switches affected materials to `alphaTest`-based cutout transparency instead.

### TexturedMaterial

A `@zcomponent` (not a behavior) for swapping textures on a GLTF's materials at runtime — set `attachTo` to the target material name inside the parent GLTF, then drive `map`/`normalMap`/etc. from the Properties panel or code.

## Estuary SDK Events

`EstuaryVoiceConnection` subscribes to (and other behaviors can listen for via `window.__estuaryClient`):

| Event | Payload | Meaning |
|---|---|---|
| `connected` | session | Session established |
| `disconnected` | reason | Session dropped |
| `botVoice` | voice | AI audio chunk starting |
| `audioPlaybackStarted` | messageId | AI speech started playing |
| `audioPlaybackComplete` | messageId | AI speech finished |
| `sttResponse` | `{text, isFinal}` | User speech transcript |
| `characterAction` | action | Structured AI action |
| `cameraCaptureRequest` | `{requestId, text}` | AI requests a camera image for VLM |
| `interrupt` | data | Response was interrupted |
| `quotaExceeded` | data | API quota reached |

## Customization

### Using your own model

1. Replace the peacock GLB in `3D Models/` with your own and update the reference in `Scene.zcomp` via the Mattercraft editor
2. Rework `SampleCharacterAnimator._ANIM` (clip-name lookup) and the patrol/conversation logic for your model's animation clips and desired behavior
3. Re-draw the `PatrolBoundary` child nodes to define the new patrol polygon

### Debugging without an API key

Click `#debugSkipButton` (wired in `index.ts`) to set `window.__skipEstuaryConnection = true` and test patrol/animation behavior without connecting to Estuary.

See [CLAUDE.md](CLAUDE.md) for architecture details, the animation-blending gotcha, and the full scene-graph reference.
