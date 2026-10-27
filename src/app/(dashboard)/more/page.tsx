'use client';

import Link from 'next/link';
import {
  PackagePlus,
  Download,
  Flower2,
  ShoppingCart,
  ClipboardCheck,
  FileText,
  Calculator,
  Settings,
  FileSpreadsheet,
  ChevronRight,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface QuickAction {
  href: string;
  label: string;
  desc: string;
  icon: any;
  color: string;
  bgColor: string;
}

const quickActions: QuickAction[] = [
  {
    href: '/inventory/materials/new',
    label: 'Thêm nguyên liệu',
    desc: 'Khai báo vật tư mới',
    icon: PackagePlus,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-100',
  },
  {
    href: '/purchases/new',
    label: 'Nhập hàng',
    desc: 'Tạo phiếu nhập kho',
    icon: Download,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-100',
  },
  {
    href: '/products/new',
    label: 'Tạo sản phẩm',
    desc: 'Định lượng mẫu bó hoa',
    icon: Flower2,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 border-rose-100',
  },
  {
    href: '/orders/new',
    label: 'Tạo đơn hàng',
    desc: 'Bán hàng đa kênh',
    icon: ShoppingCart,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-100',
  },
  {
    href: '/inventory/stock-check',
    label: 'Kiểm kho',
    desc: 'Cân đối số lượng tồn',
    icon: ClipboardCheck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-100',
  },
  {
    href: '/purchases',
    label: 'Phiếu nhập',
    desc: 'Lịch sử mua hàng',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-100',
  },
];

export default function MorePage() {
  return (
    <div className="space-y-5 pb-8">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span>🌸 Menu mở rộng</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Phím tắt thao tác nhanh & cấu hình tiệm hoa
        </p>
      </div>

      {/* 1. QUICK ACTIONS GRID (2 COLUMNS) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Thao tác nhanh
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group">
                <Card className="rounded-xl border border-gray-100 bg-white hover:border-rose-200 hover:shadow-sm transition-all h-full active:scale-[0.98]">
                  <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${action.bgColor} ${action.color} group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-rose-600 transition-colors">
                        {action.label}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {action.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2. SETTINGS & SYSTEM SECTION */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Hệ thống & Cài đặt
        </h3>

        <div className="space-y-2">
          {/* Cài đặt chung */}
          <Link href="/settings">
            <Card className="rounded-xl border border-gray-100 bg-white hover:border-rose-200 hover:shadow-xs transition-all active:scale-[0.99]">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      Cài đặt chung
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tên tiệm, biên lợi nhuận, chi phí chung & phí kênh bán
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>

          {/* Báo cáo & Xuất dữ liệu */}
          <Link href="/reports">
            <Card className="rounded-xl border border-gray-100 bg-white hover:border-rose-200 hover:shadow-xs transition-all active:scale-[0.99]">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      Báo cáo & Xuất dữ liệu
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Báo cáo doanh thu, lãi gộp & xuất file Excel/CSV
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 3. TIỆN ÍCH DỊP LỄ & ĐỢT BÁN LỚN */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Nghiệp vụ sự kiện & đợt bán lớn
          </h3>
          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
            Dùng khi cao điểm
          </Badge>
        </div>

        <Link href="/inventory/reconciliation">
          <Card className="rounded-xl border border-gray-100 bg-white hover:border-rose-200 hover:shadow-xs transition-all active:scale-[0.99]">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Cân đối sau đợt bán lớn
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Dành cho các đợt lễ bận rộn (20/10, 8/3, Valentine...) tính cost từ hóa đơn & kiểm kê
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 4. Shop App Information Card */}
      <Card className="rounded-xl border border-rose-100/60 bg-linear-to-r from-rose-50/40 via-white to-rose-50/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900">
              Dota Floral v1.0 • Bắc Hà
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Phần mềm quản lý tiệm hoa sáp & lụa thiết kế
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
