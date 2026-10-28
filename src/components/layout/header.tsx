'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  LogOut,
  User,
  Home,
  ShoppingCart,
  Package,
  Flower2,
  BarChart3,
  Settings,
  Zap,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MobileConnectDialog } from '@/components/mobile-connect-dialog';

interface HeaderProps {
  title?: string;
}

const navLinks = [
  { href: '/', icon: Home, label: 'Tổng quan' },
  { href: '/orders', icon: ShoppingCart, label: 'Đơn hàng' },
  { href: '/inventory', icon: Package, label: 'Kho & Vật tư' },
  { href: '/products', icon: Flower2, label: 'Sản phẩm' },
  { href: '/reports', icon: BarChart3, label: 'Báo cáo' },
  { href: '/settings', icon: Settings, label: 'Cài đặt' },
];

export function Header({ title = 'Dota Floral' }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14 md:h-16 px-4 md:px-8">
        {/* Brand logo & title */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl transition-transform group-hover:scale-110">🌸</span>
            <div>
              <h1 className="text-lg md:text-xl font-black text-purple-900 tracking-tight leading-none">
                {title}
              </h1>
              <p className="text-[10px] text-purple-500 font-medium hidden sm:block mt-0.5">
                Tiệm hoa handmade • Bắc Hà
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {navLinks.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-purple-50 text-purple-700 shadow-xs font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: POS Quick Button & User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Connect QR Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMobileDialogOpen(true)}
            className="hidden sm:inline-flex rounded-xl border-gray-200 text-gray-700 hover:text-purple-600 hover:border-purple-200 font-semibold text-xs gap-1.5 h-9 px-3"
            title="Mở ứng dụng trên điện thoại"
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-500" />
            <span>Mở trên điện thoại</span>
          </Button>

          {/* Quick POS Button for Desktop */}
          <Button
            size="sm"
            className="hidden sm:inline-flex rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 h-9 px-3.5 shadow-sm active:scale-95"
            asChild
          >
            <Link href="/orders/new?channel=tai_tiem">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Bán tại tiệm</span>
            </Link>
          </Button>

          {session?.user && (
            <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-gray-100">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-gray-800 leading-tight">
                  {session.user.name}
                </span>
                <span className="text-[10px] text-gray-400">
                  {session.user.email}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Đăng xuất"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 active:text-rose-700 transition-colors p-2 rounded-xl hover:bg-rose-50"
              >
                <User className="w-4 h-4" />
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <MobileConnectDialog
        open={mobileDialogOpen}
        onOpenChange={setMobileDialogOpen}
      />
    </header>
  );
}
