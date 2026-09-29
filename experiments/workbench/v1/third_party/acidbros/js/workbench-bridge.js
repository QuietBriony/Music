import { UI } from './ui/UI.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { FileManager } from './data/FileManager.js';

// The embedded machine keeps its own audio clock and file format. This bridge
// only handles explicit file and tempo actions from the same-origin workbench.
function loadSavedFile(fileId) {
    if (typeof fileId !== 'string' || !fileId || fileId.length > 100) return false;
    // Loading another pattern while RUN is active would leave two different
    // step positions audible. Require a fresh RUN after the switch.
    AudioEngine.stop();
    if (!FileManager.loadFile(fileId)) return false;
    UI.renderFileList();
    UI.update303ClearButtons();
    UI.update909ClearButtons();
    UI.renderAll();
    UI.updateTempoUI();
    return true;
}

export function initWorkbenchBridge() {
    const requestedFileId = new URLSearchParams(window.location.search).get('file');
    if (requestedFileId && !loadSavedFile(requestedFileId)) {
        UI.showToast('Saved patch is not on this browser');
    }
    if (window.parent === window) return;
    const reply = (type, fields = {}) => window.parent.postMessage(
        { source: 'acidbros-bridge-v1', type, ...fields }, window.location.origin
    );

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        const command = event.data;
        if (command?.source !== 'music-workbench-v1') return;

        if (command.type === 'load-file') {
            if (!loadSavedFile(command.fileId)) {
                reply('error', { message: '保存したパッチが見つかりません' });
                return;
            }
            reply('file-loaded', { fileId: command.fileId, bpm: AudioEngine.tempo });
        } else if (command.type === 'set-tempo') {
            if (!Number.isInteger(command.bpm) || command.bpm < 60 || command.bpm > 200) return;
            AudioEngine.setTempo(command.bpm);
            UI.updateTempoUI();
            reply('tempo-set', { bpm: AudioEngine.tempo });
        } else if (command.type === 'read-tempo') {
            reply('tempo-read', { bpm: AudioEngine.tempo });
        }
    });

    reply('ready', { bpm: AudioEngine.tempo, fileId: FileManager.currentFileId });
}
