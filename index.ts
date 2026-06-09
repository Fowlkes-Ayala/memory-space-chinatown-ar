import { initialize } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";

// Set up debug skip button
const debugSkipButton = document.getElementById('debugSkipButton');
if (debugSkipButton) {
	debugSkipButton.addEventListener('click', () => {
		(window as any).__skipEstuaryConnection = true;
		const launchButton = document.getElementById('launchButton') as HTMLButtonElement;
		if (launchButton) {
			launchButton.disabled = false;
		}
		console.log('Debug: Skipping Estuary connection');
	});
}

initialize(Scene, {}, {
	launchButton: document.getElementById('launchButton')
});
