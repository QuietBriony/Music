import { UI } from './ui/UI.js';
import { initWorkbenchBridge } from './workbench-bridge.js';
import { Data } from './data/Data.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { createMachineLink } from './workbench-rack/link.js';
import { initMachineRack } from './workbench-rack/ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    window.musicMachineLink = createMachineLink({ audio: AudioEngine, ui: UI, data: Data });
    initWorkbenchBridge();
    initMachineRack({ data: Data, ui: UI, audio: AudioEngine, knobs: () => window.knobInstances });
});
