import Link from 'next/link';
import { getAvailableTests } from '@/lib/githubFetcher';
import { BookOpen } from 'lucide-react';

export default async function Home() {
  const tests = await getAvailableTests();

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto flex flex-col">
      <header className="mb-10 mt-6 text-center">
        <h1 className="text-3xl font-bold text-blue-700">Available Tests</h1>
        <p className="text-gray-500 mt-2">Select a module to begin. The app will enter fullscreen mode.</p>
      </header>

      {tests.length === 0 ? (
        <div className="text-center p-10 bg-white shadow rounded font-medium text-gray-500">
          No tests found in the GitHub "testdata" folder.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => (
            <Link href={`/test/${test.filename}`} key={test.filename}>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-500 transition-all flex items-center gap-4 cursor-pointer">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <BookOpen size={24} />
                </div>
                <h2 className="text-xl font-semibold">{test.name}</h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}