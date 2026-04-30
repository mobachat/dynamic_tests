import Link from 'next/link';
import { Home, Info, HelpCircle, Star, List } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full font-sans text-slate-800 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Info className="text-indigo-600" size={36} /> About Engine
        </h1>
        <Link href="/" className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm">
          <Home size={18} /> Back to Home
        </Link>
      </div>

      <div className="grid gap-8">
        <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/80">
          <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2 text-slate-900">
            <Star className="text-indigo-500" size={24}/> Core Features
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <strong className="text-slate-800 block mb-1">Serverless PWA</strong>
              <span className="text-slate-600 text-sm font-medium">Installs directly to your device for offline resilience and fast loading.</span>
            </li>
            <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <strong className="text-slate-800 block mb-1">P2P Quiz Arena</strong>
              <span className="text-slate-600 text-sm font-medium">Real-time synchronized testing using secure WebRTC connections.</span>
            </li>
            <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <strong className="text-slate-800 block mb-1">Local Obfuscation</strong>
              <span className="text-slate-600 text-sm font-medium">Mid-level encryption ensures your historical metrics remain secure locally.</span>
            </li>
            <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <strong className="text-slate-800 block mb-1">Dictionary Integration</strong>
              <span className="text-slate-600 text-sm font-medium">Highlight any word during a passage to instantly fetch definitions.</span>
            </li>
          </ul>
        </section>

        <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/80">
          <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2 text-slate-900">
            <List className="text-amber-500" size={24}/> How to Use
          </h2>
          <div className="text-slate-600 font-medium leading-relaxed space-y-4">
            <p>
              <strong className="text-slate-800">1. Select a Module:</strong> From the main dashboard, choose a dataset loaded from the GitHub repository.
            </p>
            <p>
              <strong className="text-slate-800">2. Navigation:</strong> Use the arrow buttons, your keyboard's left/right arrow keys, or swipe gestures on mobile to move between questions.
            </p>
            <p>
              <strong className="text-slate-800">3. Interface:</strong> Adjust text size using the top-right controls. If on desktop or a landscape mobile view, resize the split-screen by dragging the center divider.
            </p>
            <p>
              <strong className="text-slate-800">4. Submission:</strong> Once you reach the end, submit the test to securely log your performance into your local analytics dashboard.
            </p>
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/80">
          <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2 text-slate-900">
            <HelpCircle className="text-emerald-500" size={24}/> FAQ
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 mb-1">Is my testing data stored securely?</h3>
              <p className="text-slate-600 text-sm font-medium">Yes. All analytics, progress, and historical data are stored strictly within your browser's IndexedDB and obfuscated. No data is sent to a central server.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">Can I use this engine offline?</h3>
              <p className="text-slate-600 text-sm font-medium">Absolutely. Once you install the application to your home screen (PWA), you can access previously loaded datasets without an active internet connection.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">How does the P2P Arena work?</h3>
              <p className="text-slate-600 text-sm font-medium">The Quiz Arena establishes a direct WebRTC tunnel between you and your peer. The server is only used momentarily to exchange connection details (signaling).</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}