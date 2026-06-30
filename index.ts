import { setPreferWebXRCamera } from "@zappar/zappar";
setPreferWebXRCamera(true);

import { initialize } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";

initialize(Scene, {}, {
	launchButton: document.getElementById('launchButton')
});
