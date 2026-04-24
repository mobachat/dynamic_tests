import './globals.css';

export const metadata = {
  title: 'VARC Testing Engine',
  description: 'PWA Testing Platform',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#4f46e5', // Updated to modern indigo-600
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming to maintain an app-like feel
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-indigo-200 flex flex-col min-h-screen">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        
        {/* Subtle Credits Footer */}
        <footer className="py-4 text-center text-xs text-slate-400 font-medium shrink-0 tracking-wide">
          created by - Arjan Chatterjee
        </footer>
      </body>
    </html>
  );
}