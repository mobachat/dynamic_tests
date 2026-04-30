import './globals.css';

export const metadata = {
  title: 'Verbalist Elite Engine',
  description: 'Premium PWA Testing Platform',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-indigo-200 flex flex-col min-h-screen relative">
        <div className="flex-1 flex flex-col z-10 pb-6">
          {children}
        </div>
        
        {/* Subtle Global Credits Footer */}
        <footer className="fixed bottom-0 w-full text-center py-1 opacity-40 hover:opacity-100 transition-opacity z-0 pointer-events-none">
          <p className="text-[10px] font-medium text-slate-500 tracking-wider">Powered by Verbalist Elite</p>
        </footer>
      </body>
    </html>
  );
}