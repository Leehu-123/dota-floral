import { BottomNav } from '@/components/layout/bottom-nav';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto pb-24 md:pb-12 px-4 sm:px-6 md:px-8 pt-4 md:pt-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
