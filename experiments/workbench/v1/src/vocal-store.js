const DB = 'music-workbench-takes-v1';
export const TAKE_LIMIT = 12, BYTE_LIMIT = 250 * 1024 * 1024;
export const takeBytes = take => Object.values(take.audio || {}).reduce((n, blob) => n + blob.size, 0);
export function checkTakeRoom(takes, incoming) {
  if (takes.length >= TAKE_LIMIT || takes.reduce((n, take) => n + takeBytes(take), takeBytes(incoming)) > BYTE_LIMIT) {
    throw new Error('テイク棚が上限です（12件／250 MB）。音声をダウンロードしてから不要なテイクを削除してください。');
  }
}
export function openTakeStore(indexedDB) {
  let opening;
  const open = () => opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('takes', {keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
  });
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('takes', mode), store = tx.objectStore('takes'); let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('端末への保存に失敗しました'));
      action(store, value => { result = value; }, error => { failure = error; tx.abort(); });
    });
  }
  return {
    list: () => transaction('readonly', (store, done) => { store.getAll().onsuccess = event => done(event.target.result); }),
    put: take => transaction('readwrite', (store, done, fail) => {
      store.getAll().onsuccess = event => {
        try { checkTakeRoom(event.target.result, take); store.add(take); done(take); }
        catch (error) { fail(error); }
      };
    }),
    remove: id => transaction('readwrite', store => store.delete(id)),
  };
}
