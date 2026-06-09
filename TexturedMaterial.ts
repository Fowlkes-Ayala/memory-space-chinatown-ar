import { Component, Observable } from "@zcomponent/core";
import * as THREE from "three";

/**
 * A custom material component that extends MeshStandardMaterial with texture support.
 * 
 * @zcomponent
 * @zicon material
 */
export class TexturedMaterial extends Component {
  private material: THREE.MeshStandardMaterial;

  /**
   * The path to the texture file to use as the main color/diffuse map.
   * @zui
   * @ztype files *.+(jpg|jpeg|png)
   * @zdefault ""
   */
  public map = new Observable<string>("");

  /**
   * The path to the normal map texture file.
   * @zui
   * @ztype files *.+(jpg|jpeg|png)
   * @zdefault ""
   */
  public normalMap = new Observable<string>("");

  /**
   * The path to the roughness map texture file.
   * @zui
   * @ztype files *.+(jpg|jpeg|png)
   * @zdefault ""
   */
  public roughnessMap = new Observable<string>("");

  /**
   * The path to the metalness map texture file.
   * @zui
   * @ztype files *.+(jpg|jpeg|png)
   * @zdefault ""
   */
  public metalnessMap = new Observable<string>("");

  /**
   * Color tint to apply to the material.
   * @zui
   * @ztype color-norm-rgb
   * @zdefault [1, 1, 1]
   */
  public color = new Observable<[number, number, number]>([1, 1, 1]);

  /**
   * How rough the material appears. 0.0 = smooth mirror, 1.0 = fully diffuse.
   * @zui
   * @zdefault 1
   */
  public roughness = new Observable<number>(1);

  /**
   * How metallic the material is. 0.0 = non-metal, 1.0 = metal.
   * @zui
   * @zdefault 0
   */
  public metalness = new Observable<number>(0);

  /**
   * Enable transparency (alpha blending). When disabled, material is fully opaque.
   * @zui
   * @zdefault false
   */
  public transparent = new Observable<boolean>(false);

  /**
   * The material's opacity. 1.0 = fully opaque, 0.0 = fully transparent.
   * @zui
   * @zdefault 1
   */
  public opacity = new Observable<number>(1);

  /**
   * Alpha test threshold. Pixels with alpha below this value won't be rendered.
   * @zui
   * @zdefault 0
   */
  public alphaTest = new Observable<number>(0);

  /**
   * Whether to render both sides of faces. Use for thin objects like leaves.
   * @zui
   * @zdefault false
   */
  public doubleSided = new Observable<boolean>(false);

  /**
   * Whether to write to the depth buffer. Disable for transparent objects with sorting issues.
   * @zui
   * @zdefault true
   */
  public depthWrite = new Observable<boolean>(true);

  /**
   * The name of a material in the parent GLTF node to attach to.
   * @zui
   * @zdefault ""
   */
  public attachTo = new Observable<string>("");

  constructor(contextManager: any, constructorProps: {
    attachTo?: string;
  }) {
    super(contextManager, constructorProps);

    // Create the THREE.js material
    this.material = new THREE.MeshStandardMaterial();

    // Handle attachTo constructor property
    if (constructorProps.attachTo) {
      this.attachTo.value = constructorProps.attachTo;
    }

    // Set up observables for all properties
    this.register(this.color, (value) => {
      this.material.color.setRGB(value[0], value[1], value[2]);
    });

    this.register(this.roughness, (value) => {
      this.material.roughness = value;
    });

    this.register(this.metalness, (value) => {
      this.material.metalness = value;
    });

    this.register(this.transparent, (value) => {
      this.material.transparent = value;
      this.material.needsUpdate = true;
    });

    this.register(this.opacity, (value) => {
      this.material.opacity = value;
      this.material.needsUpdate = true;
    });

    this.register(this.alphaTest, (value) => {
      this.material.alphaTest = value;
      this.material.needsUpdate = true;
    });

    this.register(this.doubleSided, (value) => {
      this.material.side = value ? THREE.DoubleSide : THREE.FrontSide;
      this.material.needsUpdate = true;
    });

    this.register(this.depthWrite, (value) => {
      this.material.depthWrite = value;
      this.material.needsUpdate = true;
    });

    this.register(this.map, (value) => {
      this._loadTexture(value, (texture) => {
        this.material.map = texture;
        this.material.needsUpdate = true;
      });
    });

    this.register(this.normalMap, (value) => {
      this._loadTexture(value, (texture) => {
        this.material.normalMap = texture;
        this.material.needsUpdate = true;
      });
    });

    this.register(this.roughnessMap, (value) => {
      this._loadTexture(value, (texture) => {
        this.material.roughnessMap = texture;
        this.material.needsUpdate = true;
      });
    });

    this.register(this.metalnessMap, (value) => {
      this._loadTexture(value, (texture) => {
        this.material.metalnessMap = texture;
        this.material.needsUpdate = true;
      });
    });

    // If we have an attachTo, find and replace the material in the parent
    if (this.attachTo.value) {
      this._attachToParentMaterial();
    }
    
    // Listen for changes to attachTo
    this.register(this.attachTo, () => {
      this._attachToParentMaterial();
    });
    
    // Clean up textures on disposal
    this.register(this.onDispose, () => {
      this.material.dispose();
      if (this.material.map) this.material.map.dispose();
      if (this.material.normalMap) this.material.normalMap.dispose();
      if (this.material.roughnessMap) this.material.roughnessMap.dispose();
      if (this.material.metalnessMap) this.material.metalnessMap.dispose();
    });
  }

  private _loadTexture(path: string, callback: (texture: THREE.Texture) => void) {
    if (!path) {
      callback(null as any);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(path, (texture) => {
      callback(texture);
    });
  }

  private _attachToParentMaterial() {
    if (!this.attachTo.value) return;

    // Find parent that might be a GLTF or Mesh
    const parent = this.parent;
    if (!parent) return;

    // Wait a bit for GLTF to load if needed
    setTimeout(() => {
      // Check if parent is a GLTF or has a traverse method
      const parentObj = (parent as any).content || (parent as any).object3D;
      if (parentObj && parentObj.traverse) {
        parentObj.traverse((child: any) => {
          if (child.isMesh && child.material) {
            // If it's an array of materials
            if (Array.isArray(child.material)) {
              for (let i = 0; i < child.material.length; i++) {
                if (child.material[i].name === this.attachTo.value) {
                  console.log(`✅ Replaced material "${this.attachTo.value}" on mesh "${child.name}"`);
                  child.material[i] = this.material;
                }
              }
            } else if (child.material.name === this.attachTo.value) {
              // Single material
              console.log(`✅ Replaced material "${this.attachTo.value}" on mesh "${child.name}"`);
              child.material = this.material;
            }
          }
        });
      }
    }, 100); // Give GLTF time to load
  }

  /**
   * Get the underlying THREE.js material.
   */
  public get threeMaterial(): THREE.MeshStandardMaterial {
    return this.material;
  }
}
