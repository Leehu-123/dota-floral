'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Clock,
  Calendar,
  Phone,
  Truck,
  Store,
  AlertTriangle,
  RefreshCw,
  Package,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, formatDate, formatDateTime, formatTime } from '@/lib/format';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  CHANNELS,
  DELIVERY_TYPES,
  getLabel,
  getStatusStyle,
} from '@/lib/constants';
import { toast } from 'sonner';

interface OrderLineItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
  isCustom?: boolean;
}

interface OrderItem {
  id: string;
  code: string;
  orderDate: string | Date;
  channel: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  status: string;
  deliveryType: string;
  deliveryDate?: string | Date | null;
  shippingFee: number | string;
  discount: number | string;
  channelFeePercent?: number | string;
  totalAmount: number | string;
  totalCost?: number | string;
  paymentStatus: string;
  depositAmount: number | string;
  paymentMethod?: string | null;
  note?: string | null;
  lines?: OrderLineItem[];
  _count?: {
    lines?: number;
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/orders');
      if (!res.ok) {
        throw new Error('Không thể tải danh sách đơn hàng');
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.orders ?? [];
      setOrders(list);
    } catch (err: any) {
      console.error('Fetch orders error:', err);
      setError(err.message || 'Lỗi khi tải danh sách đơn hàng');
      toast.error('Lỗi khi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Helper check if delivery is today
  const isDeliveryToday = (deliveryDate?: string | Date | null) => {
    if (!deliveryDate) return false;
    const date = new Date(deliveryDate);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Orders needing delivery today (not delivered and not cancelled)
  const todayDeliveryOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return false;
      }
      return isDeliveryToday(order.deliveryDate);
    });
  }, [orders]);

  // Counts per tab
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      new: 0,
      in_progress: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
    });
    return counts;
  }, [orders]);

  // Filtered orders based on search & active tab
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status tab filter
      if (activeTab !== 'all' && order.status !== activeTab) {
        return false;
      }

      // 2. Search query filter (order code, customer name, phone)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const codeMatch = order.code?.toLowerCase().includes(q);
        const nameMatch = order.customerName?.toLowerCase().includes(q);
        const phoneMatch = order.customerPhone?.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !phoneMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, search]);

  const filterTabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'new', label: 'Mới' },
    { value: 'in_progress', label: 'Đang làm' },
    { value: 'completed', label: 'Hoàn thành' },
    { value: 'delivered', label: 'Đã giao' },
    { value: 'cancelled', label: 'Hủy' },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📦 Đơn hàng</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý và theo dõi tiến độ đơn tiệm hoa
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm gap-1.5 h-10 px-3.5"
          asChild
        >
          <Link href="/orders/new">
            <Plus className="w-4 h-4" />
            <span className="font-medium text-xs">Tạo đơn</span>
          </Link>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Tìm theo mã đơn, tên khách, số điện thoại..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-9 h-11 bg-white rounded-xl border-gray-200 shadow-xs text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs (Horizontal Scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab.value;
          const count = statusCounts[tab.value] ?? 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 active:scale-[0.98] ${
                isActive
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm font-semibold'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 'Cần giao hôm nay' Section (if any orders match) */}
      {todayDeliveryOrders.length > 0 && activeTab === 'all' && !search && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <Truck className="w-4 h-4 text-amber-600" />
              <span>Cần giao hôm nay ({todayDeliveryOrders.length})</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {todayDeliveryOrders.map((order) => {
              const statusStyle = getStatusStyle(ORDER_STATUSES, order.status);
              const isShip = order.deliveryType === 'ship';
              return (
                <Card
                  key={`today-${order.id}`}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="rounded-xl border-2 border-amber-200 bg-amber-50/40 shadow-xs hover:border-amber-400 transition-all cursor-pointer active:scale-[0.99] overflow-hidden"
                >
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {order.code}
                        </span>
                        <Badge
                          className={`text-[10px] px-2 py-0 border-0 ${statusStyle.color}`}
                        >
                          {statusStyle.label}
                        </Badge>
                      </div>
                      <span className="text-xs font-bold text-rose-600">
                        {formatVND(order.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-700">
                      <span className="font-medium truncate max-w-[180px]">
                        {order.customerName}
                        {order.customerPhone && (
                          <span className="text-muted-foreground ml-1 font-normal">
                            ({order.customerPhone})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 text-amber-800 font-semibold shrink-0">
                        {isShip ? (
                          <Truck className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Store className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span>
                          {order.deliveryDate
                            ? formatTime(order.deliveryDate) || 'Hôm nay'
                            : 'Hôm nay'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl border border-gray-100 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-4 w-48 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="rounded-xl border border-red-200 bg-red-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">{error}</p>
              <p className="text-xs text-muted-foreground">
                Không thể tải danh sách đơn hàng. Vui lòng kiểm tra và thử lại.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchOrders}
              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </Button>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 border-gray-200 bg-white">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-2xl">
              📦
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-gray-900">
                {search
                  ? 'Không tìm thấy đơn hàng phù hợp'
                  : activeTab === 'all'
                  ? 'Chưa có đơn hàng nào'
                  : `Chưa có đơn hàng nào ở mục "${getLabel(
                      filterTabs,
                      activeTab
                    )}"`}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {search
                  ? 'Thử kiểm tra lại mã đơn, tên khách hàng hoặc số điện thoại'
                  : 'Bấm "Tạo đơn" để lên đơn hoa mới ngay trong tích tắc'}
              </p>
            </div>
            <div className="pt-2">
              {search ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearch('')}
                  className="rounded-xl border-gray-200"
                >
                  Xóa tìm kiếm
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5 h-10 px-4"
                  asChild
                >
                  <Link href="/orders/new">
                    <Plus className="w-4 h-4" />
                    <span>Tạo đơn ngay</span>
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredOrders.map((order) => {
            const statusStyle = getStatusStyle(ORDER_STATUSES, order.status);
            const paymentStyle = getStatusStyle(
              PAYMENT_STATUSES,
              order.paymentStatus
            );
            const itemCount =
              order.lines?.length ?? order._count?.lines ?? 1;

            return (
              <Card
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="rounded-xl border border-gray-100 shadow-xs hover:shadow-md hover:border-rose-200 transition-all cursor-pointer active:scale-[0.99] bg-white overflow-hidden"
              >
                <CardContent className="p-4 space-y-2.5">
                  {/* Top row: Order code + channel badge + status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base tracking-tight">
                        {order.code}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-gray-100 text-gray-700">
                        {getLabel(CHANNELS, order.channel)}
                      </span>
                    </div>

                    <Badge
                      className={`text-[11px] px-2.5 py-0.5 font-medium border-0 shrink-0 ${statusStyle.color}`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </div>

                  {/* Customer row */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium text-gray-800 truncate pr-2">
                      {order.customerName}
                      {order.customerPhone && (
                        <span className="text-xs text-muted-foreground ml-1.5 font-normal">
                          {order.customerPhone}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>{itemCount} món</span>
                    </div>
                  </div>

                  {/* Delivery / Date Info Row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      {order.deliveryType === 'ship' ? (
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Store className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      <span>
                        {getLabel(DELIVERY_TYPES, order.deliveryType)}
                      </span>
                      {order.deliveryDate && (
                        <>
                          <span>•</span>
                          <span
                            className={
                              isDeliveryToday(order.deliveryDate)
                                ? 'text-amber-700 font-semibold'
                                : ''
                            }
                          >
                            {formatDateTime(order.deliveryDate)}
                          </span>
                        </>
                      )}
                    </div>

                    <span>{formatDate(order.orderDate)}</span>
                  </div>

                  {/* Bottom Financial & Payment Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <Badge
                      className={`text-[11px] px-2 py-0.5 font-medium border-0 ${paymentStyle.color}`}
                    >
                      {paymentStyle.label}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <span className="text-base font-bold text-rose-600">
                        {formatVND(order.totalAmount)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (FAB) for fast mobile access */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button
          size="icon"
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg active:scale-95 flex items-center justify-center p-0 transition-transform"
          asChild
        >
          <Link href="/orders/new" aria-label="Tạo đơn hàng mới">
            <Plus className="w-6 h-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
