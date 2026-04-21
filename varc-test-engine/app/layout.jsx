import './globals.css';

export const metadata = {
  title: 'VARC Testing Engine',
  description: 'PWA Testing Platform',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming to maintain an app-like feel
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased selection:bg-blue-200">
        {children}
      </body>
    </html>
  );
}