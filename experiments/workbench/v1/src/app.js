const editorHost = document.querySelector('#editor');
const status = document.querySelector('#status');
const reloadButton = document.querySelector('#reload-pattern');
const playButton = document.querySelector('#play');
const updateButton = document.querySelector('#update');
const stopButton = document.querySelector('#stop');
let activeEditor;

const samplePrelude = `samples({
  pad: '/api/sounds/pad',
  sub: '/api/sounds/sub',
  drums: '/api/sounds/drums',
});`;

async function loadPattern() {
  reloadButton.disabled = true;
  status.textContent = '保存済みのコードを読み込み中…';
  try {
    const response = await fetch('/api/pattern', { cache: 'no-store' });
    if (!response.ok) throw new Error(`コードの取得に失敗しました (${response.status})`);
    const code = await response.text();
    if (!code.trim()) throw new Error('保存済みのコードが空です');
    await customElements.whenDefined('strudel-editor');
    const editor = document.createElement('strudel-editor');
    editor.append(document.createComment(`\n${samplePrelude}\n${code}\n`));
    activeEditor?.editor?.stop();
    editorHost.replaceChildren(editor);
    activeEditor = editor;
    editor.editor?.setLineWrappingEnabled?.(true);
    playButton.disabled = false;
    updateButton.disabled = false;
    stopButton.disabled = false;
    status.textContent = '準備できました。Play を押すと音が出ます。';
  } catch (error) {
    status.textContent = error.message || '読み込みに失敗しました';
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener('click', loadPattern);
playButton.addEventListener('click', async () => {
  if (!activeEditor?.editor) return;
  try {
    await activeEditor.editor.evaluate();
    status.textContent = '再生中。コード変更後は「コードを反映」で更新できます。';
  } catch (error) {
    status.textContent = error.message || '再生に失敗しました';
  }
});
updateButton.addEventListener('click', async () => {
  if (!activeEditor?.editor) return;
  try {
    await activeEditor.editor.evaluate();
    status.textContent = '現在のコードを反映しました。';
  } catch (error) {
    status.textContent = error.message || 'コードの反映に失敗しました';
  }
});
stopButton.addEventListener('click', () => {
  activeEditor?.editor?.stop();
  status.textContent = '停止しました。';
});
loadPattern();
