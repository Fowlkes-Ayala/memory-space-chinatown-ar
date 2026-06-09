# Mattercraft API Reference

Scraped from docs.zap.works



================================================================================
# index
# https://docs.zap.works/mattercraft/scripting/reference/index.html
================================================================================

Documentation
ZComponent Documentation Overview

ZComponent packages are a collection of modules that extend and enhance the capabilities of Mattercraft, a powerful 3D content creation platform for the web. Each package in the documentation is linked to its corresponding API reference, generated using TypeDoc.

These API references serve as a comprehensive guide for developers working with Mattercraft. They provide detailed documentation on the classes, methods, and properties available in each package.

Packages
core: The core component model and built-in functionality for Mattercraft.
google-analytics: Google analytics for Mattercraft
html: Mattercraft support for HTML
immersal: Place content in real-world locations with Immersal's VPS technology.
lms-client: LMS integration behaviors for tracking and reporting course status through peer connections
microsoft-clarity: Microsoft Clarity analytics for Mattercraft
particles: Mattercraft components and behaviors for creating particle effects.
physics: Havok physics for Mattercraft.
postprocessing: Postprocessing for Mattercraft
template: Template package
three: Mattercraft support for the three.js rendering engine
three-evercoast: Mattercraft support for Evercoast's high quality volumentic streams.
three-multiset: Place content in real-world locations with MultiSet's VPS technology.
three-navigation: Navigation components for three.js, including navmesh generation and pathfinding.
three-trail: Trail component for Mattercraft
three-video-player: HLS & MP4 Player for Mattercraft
three-webxr: WebXR support for Mattercraft
videorecorder: Canvas video recorder for Mattercraft
zappar-three: Mattercraft support for Zappar's high performance AR for the web, including world, face and image tracking.
Additional Resources

For more information on how to use these components in your Mattercraft projects, check out our scripting documentation.

Community Support

If you need further assistance or want to join the community discussion, head over to the Mattercraft Discord server.

================================================================================
# _zcomponent_core
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_core.html
================================================================================

Documentation@zcomponent/core
Module @zcomponent/core - v1.29.0
@zcomponent/core
Index
Components - Advanced
Children
DefaultLoader
LongLoad
Components - Cookie Consent
DefaultCookieConsent
Components - Media
Audio
AudioLayerSettings
Components - Other
Gamepad
Components - Social Sharing
SnapshotUI
Behaviors - Actions
CallFunction
ChangeCursor
ConsoleLog
DownloadSnapshot
EmitComponentPropEvent
LaunchURL
LogAnalyticsEvent
PlaySound
ShareSnapshot
ShowTextAlert
TakeSnapshot
Behaviors - Animation Actions
ActivateState
PauseLayerClip
PlayLayerClip
SetLayerOff
ToggleLayerClips
Behaviors - Stream Actions
PauseStream
PlayStream
SeekStream
StopStream
Contexts
GestureContext
GlobalTagContext
OrientationContext
SnapshotContext
TextAlertContext
Hooks
isLandscape
isLandscapeSecondary
isPortrait
isPortraitSecondary
isValidValueForType
isValidVariableName
useCanShare
useCanvasFile
useCanvasImage
useFileName
useFileType
useOnOrientationChange
useQuality
useShareAPISupported
useText
useTitle
Classes
DocumentFlagManager
Emitter
Entity
Profile
Enumerations
ConditionType
CursorStyle
DeviceType
GestureMode
ImageFormat
Orientation
ProposedChangeType
TypeHint
TypeName
ValuesType
Functions
ZValuesToCSVString
addBlend
addNewKeyToValues
addNewKeyToValuesWithDefaultValue
addNewVariantToValues
areTypesCompatible
canShiftPriorityLeftOrRightByUUID
changeKeyAndType
changeValueInValues
clipNamesForEntitiesByProp
computeEasing
constructImport
createClipFromData
createLayerClipFromData
createLayerFromData
createTrackFromData
defaultValueForType
deleteKeyFromValues
entitiesWithAnimation
entityPropOverrideByEntityAndProp
generateKeyBetween
generateNKeysBetween
getBehaviorBlockForNode
getCurrentZComponentConstruction
getDefaultValueForKey
getDefaultValuesByKey
getOrientation
getSafeKeyName
getScriptName
getScriptNameForBehaviorLabel
getScriptNameForNodeLabel
getSortedValuesByType
getTypeForVariant
getTypesAndDefaultsByKey
getTypesByKey
importNameWithoutExt
interpolate
mergeCSVStringIntoTarget
mergeProps
mergeTypes
mergeValues
outputForType
overridesAreCompatible
parseImport
populateAnimationStructureFromData
populateAnimationTracksFromData
processKeyframes
propertyTracksByEntityID
removeVariantFromValuesByUUID
setCurrentZComponentConstruction
setDefaultValueForKey
shiftPriorityLeftOrRightByUUID
showTextAlert
summaryForEntityPropOverrideDestination
symbolPathFromFilename
typeDefinitionForComponent
typeDefinitionForZValues
updateClipFromData
validateImport
validatorZValuesTopLevel
validatorZcomponentComponent
validatorZcomponentTopLevel
variableNameFromImport
Interfaces
AnimationState
ArrayType
AudioConstructorProps
BaseProposedChange
BaseType
BaseVariant
BooleanPrimitiveType
ComponentInfo
DebugVariant
DefaultChild
DefaultCookieConsentConstructorProps
DefaultLoaderConstructorProps
DefaultVariant
Editor
EditorNewNode
EntityType
EnumType
EventType
FileGenerator
FunctionType
GamepadButtonEvent
LayerClipState
LayerState
LiteralType
LocaleVariant
LongLoadConstructorProps
NumberPrimitiveType
PlaySoundProps
PreviewInfo
Prop
ProposeAddClipToLayer
ProposeAddOrModifyKeyframes
ProposeAddPropertyTrack
ProposeChangeEntityLabel
ProposeDeleteBehavior
ProposeDeleteKeyframe
ProposeDeleteLayer
ProposeDeleteLayerClip
ProposeDeleteNode
ProposeEntityPropertyChange
ProposeModifyClip
ProposeModifyLayerClip
ProposeMoveNode
ProposeNewBehavior
ProposeNewClip
ProposeNewLayer
ProposeNewNode
QueryStringVariant
RegisterOptions
ResolvedFunctionTrackEntity
SnapshotUIConstructorProps
SourceFileTypeInfo
StreamInfo
StringPrimitiveType
TemplateInfo
TextAlertOptions
TupleType
UnionType
UnknownType
UserAgentVariant
ValueInfo
Values
Type Aliases
ComponentInfoType
DownloadSnapshotProps
EntityPropOverrideByEntityPropPath
LayerQueueEntryState
ProposedChange
ShareCanvasProps
Type
TypeInfoByFileName
ZValues
ZValuesKey
ZValuesKeys
ZValuesValues
ZVariant
Variables
BASE_62_DIGITS

================================================================================
# _zcomponent_google_analytics
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_google_analytics.html
================================================================================

Documentation@zcomponent/google-analytics
Module @zcomponent/google-analytics - v1.0.3
@zcomponent/google-analytics
Index
Components - Analytics
GoogleAnalytics
Variables
_empty

================================================================================
# _zcomponent_html
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_html.html
================================================================================

Documentation@zcomponent/html
Module @zcomponent/html - v1.4.2
@zcomponent/html
Index
Components - Heading
H1
H2
H3
H4
H5
H6
Components - Other
Button
CSS
Div
I
Img
Span
Hooks
useOnNodeConstructed
useOnNodeDisposed
Classes
HTMLContext
ZHTMLElement
Enumerations
CSSDisplay
CSSFlexDirection
CSSLengthUnit
CSSPosition
Interfaces
HTMLElementProps
ImgConstructorProps
Variables
_empty

================================================================================
# _zcomponent_immersal
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_immersal.html
================================================================================

Documentation@zcomponent/immersal
Module @zcomponent/immersal - v1.3.0
@zcomponent/immersal
Index
Components
ImmersalAnchorGroup
Behaviors - Appearance
OverrideWireframe
Variables
PreviewType
_empty

================================================================================
# _zcomponent_lms_client
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_lms_client.html
================================================================================

Documentation@zcomponent/lms-client
Module @zcomponent/lms-client - v1.0.2
@zcomponent/lms-client

This package adds Learning Management System (LMS) integration capabilities to Mattercraft projects through simple behaviors for reporting course progress and completion status.

Features

The package includes two main behaviors that can be attached to any node in your Mattercraft project:

CourseProgress

Reports course completion percentage using a 0-1 slider (where 0 = 0% and 1 = 100%). Add this behavior to trigger progress updates at key points in your course.

CourseCompletion

Reports course completion status and optionally terminates the session. Add this behavior to mark course completion milestones.

Setup Requirements

The project must be launched with a valid LMS peer ID provided as a URL parameter:

?lmshp=PEER_ID

Getting Support

Head over to the Mattercraft Discord server to join the discussion: https://discord.gg/DhFGBVXqkp

Index
Contexts
LmsClientContext
Hooks
useOnCompletion
useOnProgress
Classes
LmsActionBehavior

================================================================================
# _zcomponent_microsoft_clarity
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_microsoft_clarity.html
================================================================================

Documentation@zcomponent/microsoft-clarity
Module @zcomponent/microsoft-clarity - v1.0.2
@zcomponent/microsoft-clarity
Index
Components - Analytics
MicrosoftClarity
Variables
_empty

================================================================================
# _zcomponent_particles
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_particles.html
================================================================================

Documentation@zcomponent/particles
Module @zcomponent/particles - v1.0.0
@zcomponent/particles
Index
Components - Particles
Confetti
Fire
Firework
Rain
Snow
Sparkle
Enumerations
Distribution

================================================================================
# _zcomponent_physics
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_physics.html
================================================================================

Documentation@zcomponent/physics
Module @zcomponent/physics - v1.2.0
@zcomponent/physics
Index
Components - Physics
RigidbodyEventEmitter
Components - Physics Forces
Updraft
Vortex
Components - Physics Transforms
RigidbodyTargetTransform
Behaviors - Physics Actions
ApplyForce
ApplyImpulse
SetAngularDamping
SetAngularVelocity
SetGrabState
SetGravityFactor
SetLinearDamping
SetLinearVelocity
ToggleGrabState
Behaviors - Physics Constraints
BallAndSocketConstraint
DistanceConstraint
HingeConstraint
LockConstraint
RangeConstraint
SpringConstraint
Classes - Other
EditorToolbarContext
HavokInternalAPI
HavokLoadContext
PhysicsConstraint
PhysicsEditorContext
PhysicsSixDofLimit
RigidBodyBehavior
RigidBodyComponent
Classes - Physics Constraints
SixDofConstraint
SliderConstraint
Classes - Physics Transforms
PositionTransform
Enumerations
MotionType
UpdraftMode
Functions
RigidBodyMixin
_bQuatToV4
_bVecToV3
processPromisesBatch
translateUpdraftMode
Interfaces
Physics6DoFLimit
PhysicsConstraintBaseConstructorProps
PhysicsConstraintConstructorProps
RigidBodyonstructorProps

================================================================================
# _zcomponent_postprocessing
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_postprocessing.html
================================================================================

Documentation@zcomponent/postprocessing
Module @zcomponent/postprocessing - v1.2.0
@zcomponent/postprocessing

================================================================================
# _zcomponent_template
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_template.html
================================================================================

Documentation@zcomponent/template
Module @zcomponent/template - v2.6.0
@zcomponent/template
Index
Variables
_empty

================================================================================
# _zcomponent_three
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three.html
================================================================================

Documentation@zcomponent/three
Module @zcomponent/three - v1.38.0
@zcomponent/three
Index
Components - 3D Models
PLY
Components - Advanced
AxesHelper
Components - Cameras
ActiveCameraSwitcher
Components - Curves
CatmullRomCurve3
LineCurve3
Components - Geometry
PLYGeometry
RoundedBoxGeometry
Components - Lines
Line2
Components - Materials
LineMaterial
PointsMaterial
Components - Meshes
Cylinder
ExtrudedText
SVG
Components - Navigation
Breadcrumbs
ChildrenBreadcrumbs
Components - Other
ModelPreview
Point
Components - Points
Points
Components - Texture
LottieTexture
Components - Transforms
CurveTransform
Behaviors - Appearance
OverrideWireframe
Classes
CameraHelper
CameraViewportRenderer
CatmullRomCurve3Helper
CheckboxButton
CheckboxButtonGroup
Curve3
Curve3EndHelper
Curve3Helper
Curve3LineHelper
FocusManager
GLTFTextureMemoryCalculator
GridMaterial
IconHelper
InlineButton
InlineCheckboxButton
LineCurve3Helper
LottieCanvasLoader
LottieLoader
PointHelper
Preview
RotationHelper
SceneStatsMonitor
SelectionBoxHelper
SoftShadows
ThreeAnimatedLottieTexture
TransformControls
TransformControlsGizmo
TransformControlsPlane
ViewHelper
Enumerations
CatmullRomCurve3Type
ChildBreadcrumbsAlignment
CurveTransformAlignment
SideBySideDirection
ThreeFont
Functions
getGLTFTextureMemoryMB
initialize
legacy_get_intersection_UV2
legacy_set_texture_encoding
safeDecompose
Interfaces
CheckboxButtonOptions
ILottieAnimation
InlineButtonOptions
InlineCheckboxButtonOptions
Line2ConstructorProps
LottieCanvasConstructorProps
LottieTextureConstructorProps
PLYGeometryConstructorProps
PointsConstructorProps
SoftShadowsOptions
Type Aliases
GizmoCombine
TransformPermissions
Variables
TRANSFORM_CONTROLS_DEBUG
gizmoCombine
helperCombine
pickerCombine
yellowLineMaterial
yellowLineMaterial_thin
yellowMaterial

================================================================================
# _zcomponent_three_evercoast
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_evercoast.html
================================================================================

Documentation@zcomponent/three-evercoast
Module @zcomponent/three-evercoast - v1.0.2
@zcomponent/three-evercoast

This package adds support for Evercoast's high quality volumetric streams to the Mattercraft 3D content creation platform for the web.

Index
Components - Evercoast
EvercoastPlayer
Variables
_empty

================================================================================
# _zcomponent_three_multiset
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_multiset.html
================================================================================

Documentation@zcomponent/three-multiset
Module @zcomponent/three-multiset - v1.3.1-beta.1
@zcomponent/three-multiset
Index
Components
MultiSetAnchorGroup
MultiSetModel
MultiSetOcclusionMesh
Contexts
MultiSetContext
Enumerations
ModelType
Interfaces
MapMesh
MapSet
MapSetData
Mesh
MultiSetMap
MultiSetObject
ObjectMesh
Pose
Rotation
Translation
Variables
_empty

================================================================================
# _zcomponent_three_navigation
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_navigation.html
================================================================================

Documentation@zcomponent/three-navigation
Module @zcomponent/three-navigation - v2.0.0
@zcomponent/three-navigation
Index
Components - Navigation
Elevator
ElevatorStop
NavigationConnection
NavigationMesh
NavigationRoute
Behaviors
NavigationAgent
Contexts
NavigationContext
Hooks
isCalculateRouteMessage
isCalculateRouteResultMessage
isGenerateNavMeshMessage
isGenerateNavMeshResultMessage
isSetNavMeshMessage
isSetOffMeshConnectionsForNavMeshMessage
Classes
ElevatorHelper
ElevatorStopHelper
NavMeshHelper
Functions
calculateRoute
generateNavMesh
getNavMeshWorker
getPositionsAndIndices
setNavMeshForID
setOffMeshConnectionsForNavMeshMessage
threeToSoloNavMesh
Interfaces
CalculateRoute
CalculateRouteOptions
CalculateRouteResult
CalculateRouteResultMessage
CrowdAgent
CrowdAgentParams
GenerateNavMeshMessage
GenerateNavMeshResultMessage
NavigationRouteConstructorProps
OffMeshConnection
OffMeshConnectionGenerator
SetNavMeshMessage
SetOffMeshConnectionsForNavMeshMessage
Type Aliases
NavMeshHelperParams
Variables
_empty
navMeshWorkerLoaded

================================================================================
# _zcomponent_three_trail
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_trail.html
================================================================================

Documentation@zcomponent/three-trail
Module @zcomponent/three-trail - v1.4.2
@zcomponent/three-trail

This package adds support for creating dynamic trails in 3D environments to Mattercraft 3D content creation platform for the web. It allows you to easily add beautiful, customizable trails to any object in your 3D scenes.

Features
Attaches to any Object3D to create a trail
Customizable trail properties such as width, color, length, and decay
Various attenuation functions for trail width
Support for textures and alpha maps
Seamlessly integrates with the Mattercraft 3D environment
Getting Started

To use the Trail component in your Mattercraft project:

Right-click on any Object3D node in your scene's Hierarchy.
Navigate to the "Trails" submenu.
Select "Trail" to add it to your object.
Key Properties
width: Width of the trail
color: Color of the trail
length: Length of the trail
decay: How fast the trail fades away
attenuationFunction: Function to control trail width attenuation
Material Properties
opacity: Opacity of the trail
alphaTest: Alpha test value for transparency
sizeAttenuation: Whether to use size attenuation
transparent: Whether the material is transparent
blending: Blending mode for the trail
Texture Properties
map: A texture to paint along the trail
alphaMap: A texture to use as alpha along the trail
repeat: Texture tiling for map and alphaMap
Example Usage

Here's a simple example of how to use a custom attenuation function with the Trail:

import { Behavior, ContextManager } from '@zcomponent/core';
import { Trail } from '@zcomponent/three-trail';

/**
 * @zbehavior
 */
export class MyTrailBehavior extends Behavior<Trail> {
	constructor(contextManager: ContextManager, instance: Trail, props: {}) {
		super(contextManager, instance);

		// Override the attenuation function with a custom one
		this.instance.attenuation = width => Math.sin(width * Math.PI);
	}
}

Copy

================================================================================
# _zcomponent_three_video_player
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_video_player.html
================================================================================

Documentation@zcomponent/three-video-player
Module @zcomponent/three-video-player - v1.2.1
@zcomponent/three-video-player

This package adds support for video playback in 3D environments to the Mattercraft 3D content creation platform for the web. It allows you to easily integrate and control video content within your 3D scenes, supporting various video formats and transparency options.

Features
Supports both HLS (.m3u8) and MP4 video formats
Offers various video transparency types, including chroma key and side-by-side transparency
Provides control over video playback properties like volume, looping, and muting
Seamlessly integrates with the Mattercraft 3D environment
Getting Started

To use the VideoPlayer component in your Mattercraft project:

Right-click on a Group node in your scene's Hierarchy.
Navigate to the "Media" submenu.
Select "VideoPlayer" to add it to your scene.
Video Formats

The VideoPlayer supports two primary video formats:

HLS (.m3u8): For adaptive streaming
MP4: For standard video playback
Transparency Options

The VideoPlayer offers three transparency types:

None: Standard video playback without transparency
Chroma Key: Removes a specific color from the video, typically used for green screen effects
Side-by-Side: Uses a side-by-side video format where one side contains the alpha channel
Key Properties
source: The URL or file path of the video (supports .m3u8 and .mp4 files)
transparent: The type of transparency to apply (none, chromaKey, or sideBySide)
autoplay: Whether the video should start playing automatically
volume: The playback volume (0 to 1)
muted: Whether the video is muted
loop: Whether the video should loop when it reaches the end
Chroma Key Properties

When using chroma key transparency:

similarity: How closely a color must match the key color to be made transparent
smoothness: The smoothness of the chroma key edges
spill: Controls color spill reduction
keyColor: The color to be made transparent (default is green: [0, 1, 0])
Side-by-Side Properties

When using side-by-side transparency:

direction: The direction of the side-by-side split (LeftRight or TopBottom)
alphaFirst: Whether the alpha channel is on the left/top (true) or right/bottom (false)
Playback Control

The VideoPlayer provides several methods for controlling playback:

play(): Starts or resumes playback
pause(): Pauses playback
stop(): Stops playback and resets to the beginning
seek(time): Jumps to a specific time in the video (in milliseconds)
Events

The VideoPlayer emits several events that you can listen to:

onEnded: Fired when the video playback ends
onPause: Fired when the video is paused
onPlay: Fired when video playback starts
onPlaying: Fired when the video starts playing after being paused or stopped for buffering
onWaiting: Fired when the video stops because it needs to buffer the next frame
onError: Fired when an error occurs during video loading or playback
Example Usage

Here's a simple example of how to use the VideoPlayer in a custom behavior:

import { Behavior, ContextManager } from '@zcomponent/core';
import { VideoPlayer } from '@zcomponent/three-video-player';
/**
 * @zbehavior
 */
export class MyVideoBehavior extends Behavior<VideoPlayer> {
 constructor(contextManager: ContextManager, instance: VideoPlayer) {
  super(contextManager, instance);

  console.log(this.instance.length())

  // Listen for the video to end
  this.register(this.instance.onEnded, () => {
   console.log('Video playback ended');
  });
 }
}

Copy

Here's an example of dynamically creating a VideoPlayer component in a custom Three.js component:

import { Component, ContextManager, registerLoadable } from '@zcomponent/core';
import { Group } from '@zcomponent/three/lib/components/Group';
import { VideoPlayer, VideoTransparencyType } from '@zcomponent/three-video-player';

/**
 * @zcomponent
 */
export class CustomVideoComponent extends Group {
 private videoPlayer: VideoPlayer;

 constructor(contextManager: ContextManager, props: {}) {
  super(contextManager, {});

  // Create a new VideoPlayer instance
  const source = new URL('./path/to/your/video.mp4', import.meta.url).href;

  this.videoPlayer = new VideoPlayer(contextManager, {
   source,
   transparent: VideoTransparencyType.none,
   autoplay: false
  });

  // Add the VideoPlayer  to our Group
  this.appendChild(this.videoPlayer);

 }

 // Example method to start playback
 playVideo() {
  this.videoPlayer.play();
 }

 // Don't forget to clean up when the component is disposed
 dispose() {
  this.videoPlayer.dispose();
  return super.dispose();
 }
}

Copy

================================================================================
# _zcomponent_three_webxr
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_three_webxr.html
================================================================================

Documentation@zcomponent/three-webxr
Module @zcomponent/three-webxr - v1.3.2
@zcomponent/three-webxr

This package adds support for building immersive virtual reality, mixed reality and augumented reality experiences to the Mattercraft 3D content creation platform for the web. It builds upon the WebXR specification, supporting a wide range of headsets and handheld devices, greatly simplifying the process of building such content for distribution over the web.

This package supports a number of immersive user experience paradigms, including:

fully virtual reality experiences, where the user's real environment is replaced with a virtual world; and,
mixed reality experineces, where the experience takes place in the user's real world but with virtual content added to the environment.
Device Support

In general, content built with this package should function on devices and browsers that support the WebXR specification. We've tested and optimised for the following devices:

Meta Quest 1 / 2 / 3 / Pro

Content built with Mattercraft and this package works well through the Quest browser, with great support for the two controllers, hand tracking and camera passthrough (for mixed reality experiences).

While Quest doesn't feature a built-in QR code scanner, it's possible to launch WebXR experiences on the device in a number of ways:

Typing a web address into the web browser's address bar
Using Quest's Web Launch feature, where end users tap a link on their phone or laptop/desktop and 'send' the link to their Quest device
Clicking 'Launch on Meta Quest' in Mattercraft's 'Live Preview' feature
Magic Leap 1 / 2

Content built with Mattercraft and this package works out of the box with the browser built into the Magic Leap operating system.

Users can launch WebXR experiences by scanning QR codes with Magic Leap's built-in 'QR Reader' app, or with the QR button on the browser's toolbar. This includes project trigger QR codes generated by Zapworks, and the QR provided by Mattercraft's Live Preview feature.

Google Chrome on Android

The Chrome browser on Android has support for the WebXR specification.

Experiences using the 'VR' mode are presented as two side-by-side stereo views suitable for use in 'Google Cardboard' style headsets. User interaction in this mode is primarily by means of the direction that the user is looking, known as 'gaze' input.

Experiences using the 'AR' mode are presented as handheld augmented reality, with interaction in the form of the user tapping on the screen, known as 'screen' input.

Getting Started

Mattercraft includes a number of template projects that are a great starting point for your next AR / VR / MR project. Just select an appropriate template in Mattercraft after creating a new project.

Alternatively this package includes a number of components designed to help you add XR support to an existing project super quickly. In each case it's possible to completely modify and configure the setup to meet your requirements. To get started, right click on the root group in your scene's Hierarchy and add a 'rig' from the 'AR / VR Rigs' menu. The options include:

XR Rig VR: for a fully immersive VR experience, including support for controllers and user teleport around the environment.
XR Rig VR Passthrough: for a mixed reality experience where the user's real-world environment is shown, including support for controllers and user teleport.
XR Rig AR: for a mixed reality experience where the user's real-world environment is shown, including support for controllers.
XR Rig AR User Placement: for a mixed reality experience where the user's real-world environment is shown, including support for controllers and the ability for the user to choose the origin location of their experience.
User Input & Controllers

This package provides a number of mechanisms for allowing user interaction in your experience. These include:

Pointer emulation, where the users can point at and click on objects using the device controllers, or (for some devices) hand tracking gestures. The package emits the same pointer* and click events that the mouse or touch screen input does in non-XR experiences.
Tracked controllers, where content can be attached to the handheld controllers supported by many devices.
Controller events, such as when the user presses buttons on the controllers.
Hand tracking, for devices that support it, where the user can point and interact with their hands.
Hand gesture events, for devices that support hand tracking, where events are emitted for gestures such as 'clenched' and 'pointing'.
Pointer Emulation

When building non-XR interactive projects in Mattercraft, it's common to use the browser events associated with the mouse or finger touch (e.g click, pointerup, pointerdown) to respond to user interaction. Since browsers don't generate these events during XR sessions, the XRManager component provides 'pointer emulation', where XR input events (such as the movement and button presses of handheld controllers) are translated into pointer events based on the direction of the underlying input device. This allows you to build experiences using Mattercraft's pointer events and have users point at and click on objects with their controllers or hands.

The exact mechanism of this user interaction varies depending on the type of device they're using, and the types of input supported by that device.

For headsets with tracked controllers, such as Meta Quest and Magic Leap, users point at objects by moving the controllers, and 'click' on them by pressing the trigger on the controller.

For headsets that support hand tracking, such as the Meta Quest, users point at objects by moving their hands, and 'click' on them with a pinching gesture between their thumb and forefinger.

For headsets without controllers or hand tracking, such as Google Chrome for Android running in the 'Google Cardboard' VR mode, users point at objects by turning their head towards them, and 'click' on them by tapping anywhere on the device screen.

For handheld AR, such as Google Chrome for Android running in the AR mode, users can tap on objects directly on the screen.

By default, the XRManager component enables pointer emulation for all of these input types, however it's possible to configure this, and to completely disable pointer emulation, by setting properties on the component.

In some instances you may wish a specific controller not have an emulated pointer - for example if the user is holding an object or tool with that controller - and you can do this by setting the suppressPointerEmulation of the associated XRController component to true.

Tracked Controllers and Hands

Many headsets support one or two controllers. These are typically held by users in their hands, have a tracked location in 3D space, and feature one or more buttons. The XRController component lets you work with these controllers in the following ways:

to show an 3D representation of the controller in the right place in 3D space,
to show a line in space in the direction that the controller is pointing,
to respond to events associated with controllers, such as button presses, or when controller tracking is lost or restored,
to attach 3D content to the controller, for example to let a user hold a tool in their hand.

Some devices that support hand tracking (such as the Meta Quest) represent the user's hands as tracked controllers. The XRController component works just the same for these cases, it just shows a 3D jointed hand rather than a 3D model of the controller. If you'd like your XRController to only work with actual tracked controllers, set its allowHands property to false.

Controller Binding

Since the various headsets each support different numbers and types of controllers, every XRController instance provides a number of properties that let you configure which underlying input device it is paired (aka bound) to. An XRController will bind to the first input device it finds that matches the values of its allow* properties.

In general there are two types of constraint: handedness, which is if the contoller is for the user's left or right hand (or indeed for either hand); and device type, which allows you limit the XRController to any of physical controllers, tracked hands, screen inputs and gaze inputs.

In order to give users a consistent experience, regardless of the device they're on, we recommend always having two XRControllers in your project - a 'primary' controller with allowLeftHandControllers set to false, and a 'secondary' controller with both allowRightHandControllers and allowUnspecifiedHandControllers set to false. This setup ensures that devices with either one or two controllers have predictable behavior. In addition, unless you're specifically targeting a device with two controllers, it's best to ensure that the user experience is functional using just the 'primary' controller. The 'XR Rig' components include this setup by default.

Attaching 3D Content

You can attach content to an XRController by placing items as children of it in the Hierarchy. There are two 'spaces' associated with tracked controllers:

grip space, where the origin appears in a location corresponding to the user 'holding' an object, and
target ray space, where the -Z axis is aligned with the direction the controller is pointing.

You can choose which space the children of an XRController should appear in with the space parameter. Note that on some devices (such as Meta Quest) there is no meaningful 'grip space' for hand tracking at this time.

To help position content in the correct location, you can use designTimeModel property of an XRController. Switching it to different values allows you to preview, in the editor, how the content will appear for different types of controller.

Hand Gestures

It's possible to respond to user hand gestures using the XRHandGestureManager component (in the 'AR / VR Components' menu). The following gestures are supported:

'clenched' where the fingers and thumb are closed towards the palm
'pointing' where the index finger is extended with the remaining fingers closed towards the palm
'thumbs up' where the thumb is extended with the fingers closed towards the palm
'palm open' where all the fingers are extended
'peace sign' where the index and middle fingers are extended with the remaining fingers closed towards the palm

You can respond to these events either by registering listeners to them from script, or by attaching action behaviors to the XRHandGestureManager node. The component also provides a number of properties for attaching timelines or states from the animation system to each of gestures.

User Movement

Considering how users move around in your virtual and mixed reality environments is an important part of building great content. This package includes support for a number of common movement mechanisms.

Here's a summary, with more information below:

Teleport

Users can choose a destination in the virtual environment to instantaneously jump to.

✓ Great for VR

✗ May not be right for some AR experiences

✗ May require instructions / tutorial

✓ Minimizes nausea

Turn

Users can turn instantly to the left or the right with the thumbstick/touchpad, without having to physically turn their heads/bodies.

✓ Great for VR

✗ May not be right for some AR experiences

✓ Intuitive user experience

✓ Minimizes nausea

Walk

Users can move smoothly forwards/backwards, and turn or strafe left/right, using the thumbstick/touchpad.

✓ Great for VR

✗ May not be right for some AR experiences

✓ Intuitive user experience

✗ Some users may experience nausea

User Placement

At the start of the experience, the user chooses the origin of the content in their environment by pointing the device or controller to a location on the ground and pressing the screen or controller trigger.

✗ May not be right for VR experiences

✓ Great for AR

✓ Intuitive user experience

✓ Minimizes nausea

Teleport

This mechanism allows users to move around the space by teleporting - they select a destination by holding forward on the thumbstick or touchpad and aiming the controller at a point on the ground. Upon releasing the thumbstick/touchpad the user will instantaneously be moved to their chosen location.

One benefit of this mechanism is that it minimizes the nausea that's felt by some users during continuous motion. It also allows users to travel larger distances quickly.

To support this form of movement, just add a 'Teleport Manager' component from 'AR / VR Movement' to your scene's Hierarchy.

The 'XR Rig VR' and 'XR Rig VR Passthrough' rigs already include an instance of 'Teleport Manager' that you can customize.

The Teleport Manager shows a white ring to help the user while they're choosing a destination. If you'd like to customize this, the ring can be disabled in the node properties and alternative content can be added as children in the Hierarchy.

The component's teleportingLayerClip and notTeleportingLayerClip properties allow you to associate timelines or states in Mattercraft's animation system with the different phases of the user experience. In addition, the onTeleportStart and onTeleportEnd events allow you to react to the changes in the phase from script or Action Behaviors.

Turn

This mechanism allows users to turn instantly to the left or the right by pushing a controller thumbstick / touchpad. It's great for longer experiences where users may tire of having to regularly move their head/body while navigating a space, or where the user may be teathered with a cable that might wrap around them when turning. Users do not typically experience nausea when using this form of movement.

To support this form of movement, just add a 'Turn Manager' component from 'AR / VR Movement' to your scene's Hierarchy.

The 'XR Rig VR' and 'XR Rig VR Passthrough' rigs already include an instance of 'Turn Manager' that you can customize.

Walk

This mechanism allows users to move smoothly in the environment using the thumbstick/touchpad of a controller. It's an intuitive form of input as users may be familiar with similar forms of movement in computer games.

The forward/backward axis of the thumbstick/touchpad is mapped to movement in the direction the user is facing. The left/right axis can be mapped to either strafing (i.e. side stepping to the left or right) or smooth turning (i.e. pivoting) about the user's current location.

Some users may experience nausea when using this form of movement in an experience.

To support this form of movement, just add a 'Walk Manager' component from 'AR / VR Movement' to your scene's Hierarchy.

User Placement

This mechanism allows the user to choose the origin location for the experience in their real world environment by pointing the controller (or, for devices without controllers, the direction of the camera) to a position in space and pulling the trigger (or tapping the screen).

During placement mode, normal controller events and interactions are disabled by default.

To support this form of movement, just add a 'User Placement Manager' component from 'AR / VR Movement' to your scene's Hierarchy.

The 'XR Rig AR User Placement' rig already includes an instance of 'User Placement Manager' that you can customize.

The placingLayerClip and notPlacingLayerClip properties of the component allow you to associate these two modes to timelines or states in Mattercraft's animation system. In addition the onPlacementStart and onPlacementEnd events allow you to react to changes in the mode from script or Action Behaviors.

You can restart the placement mode by calling the component's restartPlacement function, either from script or with a 'Node Function' Action Behavior.

Teleport Action Behaviors

You may wish to instantly teleport the user to a different location in your scene, perhaps to move them to a new room or area, or to allow them to 'reset' their position. You can achieve this either from script (see the 'Custom Movement' section below), or using the included Action Behaviors.

The Teleport To Position action behavior allows you teleport the user to a specified X, Y, and Z location in your scene in response to an event emitted by a node (e.g. clicking on a button).

The Teleport To Node action behavior allows you teleport the user to a location specified by a node in your Hierarchy in response to an event emitted by a node (e.g. clicking on a button).

Custom Movement

All forms of user movement work by updating the offsetPosition and offsetQuaternion observables in XRContext. These variables determine the position/rotation offset of the scene's origin versus the origin of the real world environment reported by the device hardware. This makes it possible to implement your own forms of user movement in script.

Start by importing XRContext at the top of your script file:

import { XRContext } from '@zcomponent/three-webxr';

Copy

Then modify the offsets in the context as you wish:

const context = this.contextManager.get(XRContext);
context.offsetPosition.value = [0, 0, 0];
context.offsetQuaternion.value = [0, 0, 0, 1];

Copy

Since these offsets are held centrally in the XRContext, their values correctly influcence the locations of any XRCamera or XRControllers in your project, regardless of where they appear in your Hierarchy or any subcomponents.

Getting Support

Head over to the Mattercraft Discord server to join the discussion: https://discord.gg/DhFGBVXqkp

Index
Components - AR / VR Components
XRCamera
XRController
XRControllerModel
XRDefaultLoader
XRHandGestureManager
XRManager
Components - AR / VR Movement
TeleportManager
TurnManager
UserPlacementManager
WalkManager
Components - AR / VR Rigs
XRRigAR
XRRigARUserPlacement
XRRigVR
XRRigVRPassthrough
Components - AR / VR Transforms
XRControllerTransform
XRHandJointTransform
Behaviors
ApplyXRHandRig
LaunchXRSession
VibrateXRController
Hooks
useXRSession
Classes
EmulatedPointer
MotionController
TeleportToNode
TeleportToPosition
Enumerations
WebXRProfile
XRHandJoint
XRSessionMode
Functions
fetchProfile
getAssetURL
Interfaces
ThreeInputSource
Type Aliases
GamepadIndices
Layout
Profile
VisualResponse
Variables
Constants

================================================================================
# _zcomponent_videorecorder
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_videorecorder.html
================================================================================

Documentation@zcomponent/videorecorder
Module @zcomponent/videorecorder - v0.2.1
@zcomponent/videorecorder
Index
Enumerations
VideoRecorderUIButtons
VideoRecorderUIMode
Interfaces
VideoRecorderUIConstructorProps

================================================================================
# _zcomponent_zappar_three
# https://docs.zap.works/mattercraft/scripting/reference/modules/_zcomponent_zappar_three.html
================================================================================

Documentation@zcomponent/zappar-three
Module @zcomponent/zappar-three - v4.3.0
@zcomponent/zappar-three

Mattercraft support for Zappar's best-in-class computer vision technologies.

Index
Components - AR
CameraEnvironmentMap
FaceAnchorGroup
FaceLandmarkGroup
FaceMesh
FaceTracker
FeaturePoints
GroundAnchorGroup
HeadMaskMesh
ImageTracker
InstantWorldTracker
PermissionRequestUI
PlanesMeshes
UserPlacementAnchorGroup
WorldAnchorGroup
WorldPlacementGroup
WorldTracker
WorldTrackingUI
ZapparCamera
Components - Other
TargetPreview
Behaviors - AR Actions
ResetWorldTracking
StartUserPlacement
StopUserPlacement
ToggleUserPlacement
Classes
ARContext
CameraTexture
FaceAnchorContext
FaceBufferGeometry
FaceMeshGenerator
FaceTrackerContext
FeaturePointsGeometry
ImageAnchorContext
ImageTrackerContext
InstantWorldTrackerContext
PlacementMesh
RiffReader
StaticGroup
TargetImagePreviewBufferGeometry
TargetImagePreviewMesh
UserPlacementAnchorGroupContext
WorldTrackerContext
WorldTrackingAnchorGroup
ZPTPreview
ZptDecoder
Enumerations
CameraDirection
CameraMirrorMode
CameraPoseMode
CameraProfile
EncodingType
ImageTargetOrientation
WorldTrackingUIState
Functions
cameraRotationForScreenOrientation
getSimulatedAnchor
getSimulatedCameraBackgroundTexture
getZPTFromCache
legacy_set_texture_encoding
projectionMatrix
requireCSS
translateEncoding
Interfaces
AnchorOnNewEvent
AnchorOnNotVisibleEvent
AnchorOnVisibleEvent
Chunk
FaceBufferGeometryOptions
FaceLandmarkGroupConstructorProps
FaceMeshConstructorProps
ZapparCameraConstructorProps
Namespaces
UserPlacementAnchorGroup
Type Aliases
Anchor
FeaturePointsConstructorProps
PropType
Variables
_empty