const DB_NAME = 'VARC_Engine_DB';
const DB_VERSION = 1;

// Mid-Level Obfuscation Helpers
const obfuscate = (data) => btoa(encodeURIComponent(JSON.stringify(data)));
const deobfuscate = (encoded) => JSON.parse(decodeURIComponent(atob(encoded)));

export const initDB = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported in this environment");
      return resolve(null);
    }
    
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'testId' });
        }
        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results', { keyPath: 'testId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
};

export const saveToDB = async (storeName, data) => {
  const db = await initDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Obfuscate the payload except for the primary key (testId)
    const payload = { testId: data.testId, _secureData: obfuscate(data) };
    const request = store.put(payload);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFromDB = async (storeName, key) => {
  const db = await initDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => {
      if (request.result && request.result._secureData) {
         try {
           resolve(deobfuscate(request.result._secureData));
         } catch(e) { 
           resolve(null); 
         }
      } else {
         resolve(request.result || null); // Legacy fallback
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllFromDB = async (storeName) => {
  const db = await initDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result || [];
      // Deobfuscate all records
      const decodedResults = results.map(item => {
        if (item._secureData) {
          try {
            return deobfuscate(item._secureData);
          } catch(e) {
            return item;
          }
        }
        return item; // Legacy fallback
      });
      resolve(decodedResults);
    };
    request.onerror = () => reject(request.error);
  });
};

export const restoreStore = async (storeName, dataArray) => {
  const db = await initDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    
    // Re-obfuscate incoming JSON backup data
    dataArray.forEach(item => {
      const payload = { testId: item.testId, _secureData: obfuscate(item) };
      store.put(payload);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};