import { Component, Behavior, ContextManager, registerBehaviorRunAtDesignTime, started } from "@zcomponent/core";
import { Mesh, MeshStandardMaterial, MeshPhysicalMaterial } from "three";


interface ConstructionProps {
	// None
}

/**
 * Fixes material issues on GLTF/GLB models where alphaMode BLEND causes
 * the body to appear see-through due to Three.js disabling depthWrite on
 * transparent materials by default.
 *
 * Attach this behavior to any GLTF node exported from Blender with
 * alpha-blend materials that look correct in Blender but show through in Three.js.
 *
 * @zbehavior
 **/
export class FixGLTFMaterials extends Behavior<Component> {

	constructor(contextManager: ContextManager, instance: Component, protected constructorProps: ConstructionProps) {
		super(contextManager, instance);

		started(this.contextManager).then(() => {
			this._fixMaterials();
		});
	}

	private _fixMaterials(): void {
		const obj = (this.instance as any).element;
		if (!obj) return;

		obj.traverse((child: any) => {
			if (!child.isMesh) return;
			const mesh = child as Mesh;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				if (mat instanceof MeshStandardMaterial || mat instanceof MeshPhysicalMaterial) {
					if (mat.transparent) {
						// Switch from BLEND to MASK mode. BLEND with depthWrite=true causes
						// transparent pixels to write depth, blocking body geometry behind them.
						// MASK (alphaTest) discards sub-threshold pixels entirely — no color
						// write, no depth write — so geometry behind feather vanes renders
						// correctly. Trade-off: feather edges become hard cutouts rather than
						// soft gradients. To preserve soft edges you'd need to separate the
						// mesh into opaque and transparent objects in Blender.
						mat.transparent = false;
						mat.alphaTest = 0.45;
						mat.depthWrite = true;
						mat.needsUpdate = true;
					}
				}
			}
		});
	}

	dispose() {
		return super.dispose();
	}
}

// Uncomment below to run this behavior at design time
// registerBehaviorRunAtDesignTime(FixGLTFMaterials);
