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
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-indigo-200 flex flex-col min-h-screen">
        {/* Removed the pb-6 padding that was breaking the 100dvh layout */}
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
        
        {/* 
          Completely decoupled fixed footer. 
          pointer-events-none ensures you can still click things underneath it.
          mix-blend-difference ensures it stays visible on both the light dashboard and the dark testing screen.
        */}
        <footer className="fixed bottom-1 w-full text-center opacity-30 transition-opacity z-50 pointer-events-none">
          <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mix-blend-difference drop-shadow-sm">
            Powered by Verbalist Elite
          </p>
        </footer>
      </body>
    </html>
  );
}