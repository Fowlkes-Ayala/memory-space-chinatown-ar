import { ZComponent, ContextManager, Observable, Animation, Layer, LayerClip, Event, ConstructorForComponent } from "@zcomponent/core";

import { Button as Button_0 } from "@zcomponent/html/lib/button";
import { CameraEnvironmentMap as CameraEnvironmentMap_1 } from "@zcomponent/zappar-three/lib/components/environments/CameraEnvironmentMap";
import { HTML as HTML_2 } from "@zcomponent/three/lib/components/HTML";
import { DefaultCookieConsent as DefaultCookieConsent_3 } from "@zcomponent/core/lib/components/DefaultCookieConsent";
import { DefaultLoader as DefaultLoader_4 } from "@zcomponent/core/lib/components/DefaultLoader";
import { Group as Group_5 } from "@zcomponent/three/lib/components/Group";
import { DirectionalLight as DirectionalLight_6 } from "@zcomponent/three/lib/components/lights/DirectionalLight";
import { ImmersalAnchorGroup as ImmersalAnchorGroup_7 } from "@zcomponent/immersal/lib/components/ImmersalAnchorGroup";
import { GLTF as GLTF_8 } from "@zcomponent/three/lib/components/models/GLTF";
import { SampleCharacterAnimator as SampleCharacterAnimator_9 } from "./SampleCharacterAnimator";
import { FixGLTFMaterials as FixGLTFMaterials_10 } from "./FixGLTFMaterials";
import { Animation as Animation_11 } from "@zcomponent/three/lib/behaviors/Animation";
import { ShadowPlane as ShadowPlane_12 } from "@zcomponent/three/lib/components/meshes/ShadowPlane";
import { WorldTracker as WorldTracker_13 } from "@zcomponent/zappar-three/lib/components/trackers/WorldTracker";
import { WorldTrackingUI as WorldTrackingUI_14 } from "@zcomponent/zappar-three/lib/components/WorldTrackingUI";
import { ZapparCamera as ZapparCamera_15 } from "@zcomponent/zappar-three/lib/components/cameras/Camera";

interface ConstructorProps {

}

/**
* @zcomponent
* @zicon zcomponent
* @ztag zcomponent
*/
declare class Comp extends ZComponent {

	constructor(contextManager: ContextManager, constructorProps: ConstructorProps);

	nodes: {
		Button: Button_0 & {
			behaviors: {

			}
		},
		CameraEnvironmentMap: CameraEnvironmentMap_1 & {
			behaviors: {

			}
		},
		DebugOverlay: HTML_2 & {
			behaviors: {

			}
		},
		DefaultCookieConsent: DefaultCookieConsent_3 & {
			behaviors: {

			}
		},
		DefaultLoader: DefaultLoader_4 & {
			behaviors: {

			}
		},
		Defaults: Group_5 & {
			behaviors: {

			}
		},
		DirectionalLight: DirectionalLight_6 & {
			behaviors: {

			}
		},
		ImmersalAnchorGroup: ImmersalAnchorGroup_7 & {
			behaviors: {

			}
		},
		PatrolBoundary: Group_5 & {
			behaviors: {

			}
		},
		Peacock_glb: GLTF_8 & {
			behaviors: {
				0: SampleCharacterAnimator_9,
				1: FixGLTFMaterials_10,
				FixGLTFMaterials: FixGLTFMaterials_10,
				2: Animation_11,
				Peacock_A15_Idle0: Animation_11,
				3: Animation_11,
				Peacock_A15_Spreadfeathers: Animation_11,
				4: Animation_11,
				Peacock_A15_LickingFeathers: Animation_11,
				5: Animation_11,
				Peacock_A15_SpreadFeathers2: Animation_11,
				6: Animation_11,
				Peacock_A15_Walk: Animation_11,
			}
		},
		ShadowPlane: ShadowPlane_12 & {
			behaviors: {

			}
		},
		WorldTracker: WorldTracker_13 & {
			behaviors: {

			}
		},
		WorldTrackingUI: WorldTrackingUI_14 & {
			behaviors: {

			}
		},
		ZapparCamera: ZapparCamera_15 & {
			behaviors: {

			}
		},
		marker_glb: GLTF_8 & {
			behaviors: {

			}
		},
		marker_glb_2: GLTF_8 & {
			behaviors: {

			}
		},
		marker_glb_3: GLTF_8 & {
			behaviors: {

			}
		},
		marker_glb_4: GLTF_8 & {
			behaviors: {

			}
		},
	};

	animation: Animation & { layers: {
		PeacockAnimations: Layer & { clips: {
			Peacock_A15_licking_feathers: LayerClip;
			Peacock_A15_Spreadfeathers: LayerClip;
			Peacock_A15_Spreadfeathers2: LayerClip;
			Peacock_A15_Walk: LayerClip;
			Peacock_A15_Idle: LayerClip;
		}};
	}};

	/**
	 * The position, in 3D space, of this node relative to its parent. The three elements of the array correspond to the `x`, `y`, and `z` components of position.
	 * 
	 * @zprop
	 * @zdefault [0,0,0]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public position: Observable<[x: number, y: number, z: number]>;

	/**
	 * The rotation, in three dimensions, of this node relative to its parent. The three elements of the array correspond to Euler angles - yaw, pitch and roll.
	 * 
	 * @zprop
	 * @zdefault [0,0,0]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public rotation: Observable<[x: number, y: number, z: number]>;

	/**
	 * The scale, in three dimensions, of this node relative to its parent. The three elements of the array correspond to scales in the the `x`, `y`, and `z` axis.
	 * 
	 * @zprop
	 * @zdefault [1,1,1]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public scale: Observable<[x: number, y: number, z: number]>;

	/**
	 * Determines if this object and its children are rendered to the screen.
	 * 
	 * @zprop
	 * @zdefault true
	 * @zgroup Appearance
	 * @zgrouppriority 11
	 */
	public visible: Observable<boolean>;
}

export default Comp;
