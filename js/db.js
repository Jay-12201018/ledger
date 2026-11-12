const DB_NAME = 'ledger';
const DB_VERSION = 1;

let dbPromise = null;

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('externalId', 'externalId');
        s.createIndex('categoryId', 'categoryId');
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => {
      dbPromise = null;
      reject(open.error);
    };
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

export async function loadAll() {
  const db = await openDB();
  const tx = db.transaction(['records', 'categories', 'kv'], 'readonly');
  const records = req(tx.objectStore('records').getAll());
  const categories = req(tx.objectStore('categories').getAll());
  const kv = req(tx.objectStore('kv').getAll());
  const [r, c, k] = await Promise.all([records, categories, kv]);
  await txDone(tx);
  const settings = (k || []).find((x) => x.key === 'settings') || null;
  return { records: r || [], categories: c || [], settings };
}

export async function putRecord(rec) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').put(rec);
  await txDone(tx);
}

export async function bulkPutRecords(recs) {
  if (!recs.length) return;
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  for (const rec of recs) store.put(rec);
  await txDone(tx);
}

export async function deleteRecord(id) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').delete(id);
  await txDone(tx);
}

export async function putCategory(cat) {
  const db = await openDB();
  const tx = db.transaction('categories', 'readwrite');
  tx.objectStore('categories').put(cat);
  await txDone(tx);
}

export async function bulkPutCategories(cats) {
  if (!cats.length) return;
  const db = await openDB();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  for (const c of cats) store.put(c);
  await txDone(tx);
}

export async function deleteCategory(id) {
  const db = await openDB();
  const tx = db.transaction('categories', 'readwrite');
  tx.objectStore('categories').delete(id);
  await txDone(tx);
}

export async function putSettings(settings) {
  const db = await openDB();
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put({ ...settings, key: 'settings' });
  await txDone(tx);
}

export async function replaceAll({ categories, records, settings }) {
  const db = await openDB();
  const tx = db.transaction(['records', 'categories', 'kv'], 'readwrite');
  tx.objectStore('records').clear();
  tx.objectStore('categories').clear();
  tx.objectStore('kv').clear();
  for (const c of categories) tx.objectStore('categories').put(c);
  for (const r of records) tx.objectStore('records').put(r);
  tx.objectStore('kv').put({ ...settings, key: 'settings' });
  await txDone(tx);
}
