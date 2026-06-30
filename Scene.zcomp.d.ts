import { ZComponent, ContextManager, Observable, Animation, Layer, LayerClip, Event, ConstructorForComponent } from "@zcomponent/core";

import { CameraEnvironmentMap as CameraEnvironmentMap_0 } from "@zcomponent/zappar-three/lib/components/environments/CameraEnvironmentMap";
import { DefaultCookieConsent as DefaultCookieConsent_1 } from "@zcomponent/core/lib/components/DefaultCookieConsent";
import { DefaultLoader as DefaultLoader_2 } from "@zcomponent/core/lib/components/DefaultLoader";
import { Group as Group_3 } from "@zcomponent/three/lib/components/Group";
import { DirectionalLight as DirectionalLight_4 } from "@zcomponent/three/lib/components/lights/DirectionalLight";
import { ShadowPlane as ShadowPlane_5 } from "@zcomponent/three/lib/components/meshes/ShadowPlane";
import { UserPlacementAnchorGroup as UserPlacementAnchorGroup_6 } from "@zcomponent/zappar-three/lib/components/anchorgroups/UserPlacementAnchorGroup";
import { WorldTracker as WorldTracker_7 } from "@zcomponent/zappar-three/lib/components/trackers/WorldTracker";
import { WorldTrackingUI as WorldTrackingUI_8 } from "@zcomponent/zappar-three/lib/components/WorldTrackingUI";
import { ZapparCamera as ZapparCamera_9 } from "@zcomponent/zappar-three/lib/components/cameras/Camera";
import { GLTF as GLTF_10 } from "@zcomponent/three/lib/components/models/GLTF";
import { SampleCharacterAnimator as SampleCharacterAnimator_11 } from "./SampleCharacterAnimator";
import { FixGLTFMaterials as FixGLTFMaterials_12 } from "./FixGLTFMaterials";
import { Animation as Animation_13 } from "@zcomponent/three/lib/behaviors/Animation";

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
		CameraEnvironmentMap: CameraEnvironmentMap_0 & {
			behaviors: {

			}
		},
		DefaultCookieConsent: DefaultCookieConsent_1 & {
			behaviors: {

			}
		},
		DefaultLoader: DefaultLoader_2 & {
			behaviors: {

			}
		},
		Defaults: Group_3 & {
			behaviors: {

			}
		},
		DirectionalLight: DirectionalLight_4 & {
			behaviors: {

			}
		},
		ShadowPlane: ShadowPlane_5 & {
			behaviors: {

			}
		},
		UserPlacementAnchorGroup: UserPlacementAnchorGroup_6 & {
			behaviors: {

			}
		},
		WorldTracker: WorldTracker_7 & {
			behaviors: {

			}
		},
		WorldTrackingUI: WorldTrackingUI_8 & {
			behaviors: {

			}
		},
		ZapparCamera: ZapparCamera_9 & {
			behaviors: {

			}
		},
		PatrolBoundary: Group_3 & {
			behaviors: {

			}
		},
		GLTF: GLTF_10 & {
			behaviors: {

			}
		},
		GLTF_2: GLTF_10 & {
			behaviors: {

			}
		},
		GLTF_3: GLTF_10 & {
			behaviors: {

			}
		},
		GLTF_4: GLTF_10 & {
			behaviors: {

			}
		},
		Peacock_glb: GLTF_10 & {
			behaviors: {
				0: SampleCharacterAnimator_11,
				1: FixGLTFMaterials_12,
				FixGLTFMaterials: FixGLTFMaterials_12,
				2: Animation_13,
				Peacock_A15_Idle: Animation_13,
				3: Animation_13,
				Peacock_A15_Walk: Animation_13,
				4: Animation_13,
				Peacock_A15_licking_feathers: Animation_13,
				5: Animation_13,
				Peacock_A15_Run: Animation_13,
				6: Animation_13,
				Peacock_A15_Spread_feathers: Animation_13,
				7: Animation_13,
				Peacock_A15_Spread_feathers2: Animation_13,
			}
		},
	};

	animation: Animation & { layers: {
		PeacockAnimations: Layer & { clips: {
			Peacock_A15_Idle: LayerClip;
			Peacock_A15_licking_feathers: LayerClip;
			Peacock_A15_Spreadfeathers: LayerClip;
			Peacock_A15_Spreadfeathers2: LayerClip;
			Peacock_A15_Walk: LayerClip;
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
