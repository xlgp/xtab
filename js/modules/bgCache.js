// 背景图缓存：用 IndexedDB 存 Blob，避免每次打开新标签都重新拉图。
// 比 chrome.storage.local 更适合存二进制大图，无 5MB 顾虑。

const DB_NAME = "xtab-bg";
const STORE = "images";
const KEY = "last";

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function loadCachedImage() {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const get = store.get(KEY);
    get.onsuccess = () => res(get.result || null);
    get.onerror = () => res(null);
  });
}

export async function saveCachedImage(blob) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const put = store.put({ blob, ts: Date.now() }, KEY);
    put.onsuccess = () => res();
    put.onerror = () => rej(put.error);
  });
}
