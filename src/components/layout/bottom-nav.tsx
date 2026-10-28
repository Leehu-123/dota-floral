'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, ShoppingCart, Package, Flower2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', icon: Home, label: 'Tổng quan' },
  { href: '/orders', icon: ShoppingCart, label: 'Đơn hàng' },
  { href: '/inventory', icon: Package, label: 'Kho' },
  { href: '/products', icon: Flower2, label: 'Sản phẩm' },
  { href: '/more', icon: MoreHorizontal, label: 'Thêm' },
];

export function BottomNav() {
  const pathname = usePathname();

  // Only show bottom navigation on primary root tabs.
  // Hide on ALL forms, creation pages, editing screens, and subpages
  // so action buttons and sticky checkout/save bars are never covered or obstructed.
  const MAIN_TABS = ['/', '/orders', '/inventory', '/products', '/more'];
  if (!MAIN_TABS.includes(pathname)) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 safe-area-bottom z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center py-2 pt-2.5 transition-colors min-h-[56px]',
                isActive
                  ? 'text-purple-800'
                  : 'text-gray-400 active:text-gray-600'
              )}
            >
              <tab.icon className={cn('w-6 h-6', isActive && 'stroke-[2.5]')} />
              <span className={cn('text-[10px] mt-1', isActive ? 'font-bold text-purple-950' : 'text-gray-500 font-medium')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
