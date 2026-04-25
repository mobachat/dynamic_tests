import Papa from 'papaparse';

// IMPORTANT: Update these with your actual GitHub details
const REPO_OWNER = 'mobachat'; 
const REPO_NAME = 'dynamic_tests';
const FOLDER_PATH = 'testdata'; 

export async function getAvailableTests() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}`, {
      next: { revalidate: 60 } // Caches for 60 seconds to avoid API rate limits
    });
    
    if (!res.ok) throw new Error('Failed to fetch from GitHub');
    
    const files = await res.json();
    // Return only CSV files, stripping the extension and decoding %20 spaces for clean UI
    return files
      .filter(file => file.name.endsWith('.csv'))
      .map(file => ({
        filename: file.name,
        name: decodeURIComponent(file.name.replace('.csv', ''))
      }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getTestData(filename) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FOLDER_PATH}/${filename}`;
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