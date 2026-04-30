import Papa from 'papaparse';

// IMPORTANT: Update these with your actual GitHub details
const REPO_OWNER = 'mobachat'; 
const REPO_NAME = 'dynamic_tests';
const FOLDER_PATH = 'testdata'; 

export async function getAvailableTests(currentPath = FOLDER_PATH) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${currentPath}`, {
      next: { revalidate: 60 } // Caches for 60 seconds to avoid API rate limits
    });
    
    if (!res.ok) throw new Error('Failed to fetch from GitHub');
    
    const items = await res.json();
    let files = [];
    
    // Process items; recurse if directory, add if CSV
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.type === 'dir') {
          // Recursively fetch subfolder contents
          const subFiles = await getAvailableTests(item.path);
          files = files.concat(subFiles);
        } else if (item.name.endsWith('.csv')) {
          files.push({
            filename: item.path, // Store the full path for fetching data later
            name: decodeURIComponent(item.name.replace('.csv', ''))
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
    // Use the exact filePath (which now includes subfolder paths)
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${filePath}`;
    const res = await fetch(rawUrl, { cache: 'no-store' });
    const csvText = await res.text();
    
    // Parse CSV to an array of arrays
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });
    
    // Remove headers (row 0) and return the rest
    if (parsed.data.length > 1) {
      return parsed.data.slice(1);
    }
    return [];
  } catch (error) {
    console.error(error);
    return [];
  }
}