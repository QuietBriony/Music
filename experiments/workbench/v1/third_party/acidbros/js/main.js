import { UI } from './ui/UI.js';
import { initWorkbenchBridge } from './workbench-bridge.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    initWorkbenchBridge();
});
