import { getAvailableTests, getTestData } from './githubFetcher';

export async function generateRandomQuiz(passageCount = 5) {
  try {
    const tests = await getAvailableTests();
    let allRows = [];
    
    // Fetch all test datasets holistically
    for (const t of tests) {
      const data = await getTestData(t.filename);
      if (data && data.length > 0) {
        allRows = allRows.concat(data);
      }
    }
    
    // Shuffle the combined array and take the requested amount
    const shuffled = allRows.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, passageCount);
  } catch (error) {
    console.error("Error generating random quiz:", error);
    return [];
  }
}