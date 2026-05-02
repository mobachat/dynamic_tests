import Papa from 'papaparse';

const REPO_OWNER = 'mobachat'; 
const REPO_NAME = 'dynamic_tests';
const FOLDER_PATH = 'testdata'; 

export async function getAvailableTests(currentPath = FOLDER_PATH) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${currentPath}`, {
      next: { revalidate: 60 }
    });
    
    if (!res.ok) throw new Error('Failed to fetch from GitHub');
    
    const items = await res.json();
    let files = [];
    
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.type === 'dir') {
          const subFiles = await getAvailableTests(item.path);
          files = files.concat(subFiles);
        } else if (item.name.endsWith('.csv')) {
          const folderName = currentPath === FOLDER_PATH ? 'Root' : currentPath.replace(FOLDER_PATH + '/', '');
          files.push({
            filename: item.path,
            name: decodeURIComponent(item.name.replace('.csv', '')),
            folder: folderName
          });
        }
      }
    }
    return files;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getTestData(filePath) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${filePath}`;
    const res = await fetch(rawUrl, { cache: 'no-store' });
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });
    
    if (parsed.data.length > 1) {
      return parsed.data.slice(1);
    }
    return [];
  } catch (error) {
    console.error(error);
    return [];
  }
}