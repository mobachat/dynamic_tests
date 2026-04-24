import './globals.css';

export const metadata = {
  title: 'VARC Testing Engine',
  description: 'PWA Testing Platform',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-indigo-200 flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}