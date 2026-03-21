import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Finance Categorization',
  description: 'Personal finance transaction categorization',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-white text-gray-900">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
