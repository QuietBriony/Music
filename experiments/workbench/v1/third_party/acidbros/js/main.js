import { UI } from './ui/UI.js';
import { initWorkbenchBridge } from './workbench-bridge.js';
import { Data } from './data/Data.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { initMachineRack } from './workbench-rack/ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    initWorkbenchBridge();
    initMachineRack({ data: Data, ui: UI, audio: AudioEngine, knobs: () => window.knobInstances });
});
