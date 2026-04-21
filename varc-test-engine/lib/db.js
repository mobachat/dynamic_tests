const DB_NAME = 'VARC_Engine_DB';
const DB_VERSION = 1;

// Initialize and upgrade database stores
export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null); // Safety check for Next.js SSR
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Store for in-progress test answers
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'testId' });
      }
      // Store for final submitted results
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results', { keyPath: 'testId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Generic function to save data to a specific store
export const saveToDB = async (storeName, data) => {
  const db = await initDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Generic function to get data from a specific store
export const getFromDB = async (storeName, key) => {
  const db = await initDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result ? request.result : null);
    request.onerror = () => reject(request.error);
  });
};