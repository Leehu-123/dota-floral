'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  ArrowDownToLine,
  ClipboardCheck,
  RefreshCw,
  Clock,
  Truck,
  Store,
  AlertTriangle,
  TrendingDown,
  CreditCard,
  ChevronRight,
  Calendar,
  Phone,
  Package,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, formatQty, formatDate, formatTime } from '@/lib/format';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  DELIVERY_TYPES,
  getStatusStyle,
  getLabel,
} from '@/lib/constants';
import { toast } from 'sonner';

interface DashboardMetrics {
  revenue: number;
  grossProfit: number;
  orderCount: number;
}

interface DeliveryOrder {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string | null;
  deliveryDate: string | null;
  deliveryType: string;
  status: string;
  totalAmount: number;
}

interface LowStockMaterial {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  currentStock: number;
  minStock: number;
  avgCost: number;
  status: 'out' | 'low' | 'ok';
}

interface UnpaidOrder {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string | null;
  orderDate: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
}

interface LowMarginProduct {
  id: string;
  name: string;
  suggestedPrice: number;
  totalCost: number;
  actualMargin: number;
  targetMargin: number;
}

interface DashboardData {
  metrics: {
    today: DashboardMetrics;
    week: DashboardMetrics;
    month: DashboardMetrics;
  };
  todayDeliveries: DeliveryOrder[];
  lowStockMaterials: LowStockMaterial[];
  unpaidOrders: UnpaidOrder[];
  lowMarginProducts: LowMarginProduct[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [deliveriesExpanded, setDeliveriesExpanded] = useState<boolean>(true);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Lỗi tải dữ liệu bảng điều khiển');
      }
      const json: DashboardData = await res.json();
      setData(json);
      if (isRefresh) {
        toast.success('Đã cập nhật dữ liệu mới nhất');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không thể tải dữ liệu tổng quan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Lấy ngày hiện tại hiển thị tiếng Việt
  const todayFormatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());

  const activeMetric = data?.metrics?.[period] || { revenue: 0, grossProfit: 0, orderCount: 0 };
  const profitMargin =
    activeMetric.revenue > 0
      ? Math.round((activeMetric.grossProfit / activeMetric.revenue) * 100)
      : 0;

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Greeting & Refresh */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-1.5">
            <span>Xin chào!</span>
            <span className="text-xl">🌸</span>
          </h2>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{todayFormatted}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardData(true)}
          disabled={loading || refreshing}
          className="h-9 px-3 gap-1.5 rounded-xl text-xs font-medium border-gray-200 text-gray-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-rose-500' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Desktop 2-column layout (grid-cols-1 lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column on Desktop: Quick Actions & KPIs (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 2. Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2.5">
        <Link href="/orders/new" className="w-full">
          <Button className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex flex-col items-center justify-center py-1 gap-0.5">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-semibold">Tạo đơn</span>
          </Button>
        </Link>
        <Link href="/purchases/new" className="w-full">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-gray-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-gray-800 flex flex-col items-center justify-center py-1 gap-0.5"
          >
            <ArrowDownToLine className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-semibold">Nhập hàng</span>
          </Button>
        </Link>
        <Link href="/inventory" className="w-full">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-gray-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-gray-800 flex flex-col items-center justify-center py-1 gap-0.5"
          >
            <ClipboardCheck className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-semibold">Kiểm kho</span>
          </Button>
        </Link>
      </div>

      {/* 3. Quick Period Selector & KPI Card */}
      <Card className="rounded-2xl border-rose-100 shadow-sm overflow-hidden bg-gradient-to-br from-white via-white to-rose-50/40">
        <CardContent className="p-4 space-y-4">
          {/* Period Tabs */}
          <div className="flex bg-gray-100/80 p-1 rounded-xl">
            {(
              [
                { key: 'today', label: 'Hôm nay' },
                { key: 'week', label: 'Tuần này' },
                { key: 'month', label: 'Tháng này' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPeriod(t.key)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === t.key
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3 py-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Doanh thu {period === 'today' ? 'hôm nay' : period === 'week' ? 'tuần này' : 'tháng này'}</span>
                  <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    {activeMetric.orderCount} đơn hàng
                  </span>
                </p>
                <p className="text-2xl font-black text-rose-600 tracking-tight mt-1">
                  {formatVND(activeMetric.revenue)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-rose-100/60">
                <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-medium text-emerald-800">Lãi gộp ước tính</p>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">
                    {formatVND(activeMetric.grossProfit)}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Biên lợi nhuận: <span className="font-semibold">{profitMargin}%</span>
                  </p>
                </div>

                <div className="bg-white/90 border border-gray-100 p-2.5 rounded-xl flex flex-col justify-between">
                  <p className="text-[11px] font-medium text-gray-500">Xem chi tiết báo cáo</p>
                  <Link
                    href="/reports"
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 mt-1 group"
                  >
                    <span>Vào trang báo cáo</span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        {/* Right Column on Desktop: Delivery and Inventory Alerts (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
      {/* 4. Alert Section 1: ⚡ Cần giao hôm nay */}
      <Card className="rounded-2xl border-gray-200/80 shadow-sm overflow-hidden">
        <CardHeader
          onClick={() => setDeliveriesExpanded(!deliveriesExpanded)}
          className="p-4 cursor-pointer hover:bg-gray-50/60 transition-colors flex flex-row items-center justify-between space-y-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <CardTitle className="text-sm font-bold text-gray-900">
              Cần giao hôm nay
            </CardTitle>
            {data && (
              <Badge
                variant="secondary"
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  data.todayDeliveries.length > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {data.todayDeliveries.length}
              </Badge>
            )}
          </div>
          <button type="button" className="text-gray-400 p-1">
            {deliveriesExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </CardHeader>

        {deliveriesExpanded && (
          <CardContent className="p-4 pt-0 space-y-2.5">
            {loading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !data || data.todayDeliveries.length === 0 ? (
              <div className="text-center py-6 px-4 bg-emerald-50/40 rounded-xl border border-emerald-100/60">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-sm font-semibold text-emerald-800">
                  Không có đơn cần giao hôm nay 🎉
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bạn có thể thảnh thơi chuẩn bị cho các đơn sắp tới
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.todayDeliveries.map((order) => {
                  const statusInfo = getStatusStyle(ORDER_STATUSES, order.status);
                  const isShip = order.deliveryType === 'ship';

                  return (
                    <div
                      key={order.id}
                      className="p-3 bg-white border border-gray-100 rounded-xl shadow-xs hover:border-rose-200 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-gray-900 tracking-tight">
                            {order.code}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {order.deliveryDate ? formatTime(order.deliveryDate) : 'Trong ngày'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-gray-900 truncate">
                            {order.customerName}
                          </p>
                          {order.customerPhone && (
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="text-[11px] text-gray-500 hover:text-rose-600 flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{order.customerPhone}</span>
                            </a>
                          )}
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                            {isShip ? (
                              <>
                                <Truck className="w-3 h-3 text-blue-500" />
                                <span>Giao tận nơi</span>
                              </>
                            ) : (
                              <>
                                <Store className="w-3 h-3 text-purple-500" />
                                <span>Nhận tại tiệm</span>
                              </>
                            )}
                          </div>
                          <span className="font-bold text-xs text-gray-900">
                            {formatVND(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-gray-50 flex items-center justify-end">
                        <Link href={`/orders/${order.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 rounded-lg"
                          >
                            <span>Xem đơn</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 5. Alert Section 2: ⚠️ Nguyên liệu sắp hết */}
      <Card className="rounded-2xl border-gray-200/80 shadow-sm overflow-hidden">
        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <CardTitle className="text-sm font-bold text-gray-900">
              Nguyên liệu sắp hết
            </CardTitle>
            {data && data.lowStockMaterials.length > 0 && (
              <Badge
                variant="destructive"
                className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-100"
              >
                {data.lowStockMaterials.length}
              </Badge>
            )}
          </div>
          <Link href="/purchases/new">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Nhập hàng</span>
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : !data || data.lowStockMaterials.length === 0 ? (
            <div className="text-center py-5 px-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <Package className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-gray-800">
                Tất cả nguyên liệu đủ dùng ✨
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kho hàng đang trong mức an toàn
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.lowStockMaterials.map((mat) => {
                const isOut = mat.status === 'out';
                return (
                  <div
                    key={mat.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isOut
                        ? 'bg-red-50/50 border-red-200/80 text-red-950'
                        : 'bg-amber-50/50 border-amber-200/80 text-amber-950'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs truncate">{mat.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isOut ? 'bg-red-200/80 text-red-800' : 'bg-amber-200/80 text-amber-800'
                          }`}
                        >
                          {isOut ? 'Hết hàng' : 'Sắp hết'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Tồn: <span className="font-bold text-gray-900">{formatQty(mat.currentStock)} {mat.baseUnit}</span> / Tối thiểu: {formatQty(mat.minStock)} {mat.baseUnit}
                      </p>
                    </div>

                    <Link href={`/purchases/new?materialId=${mat.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs font-semibold bg-white border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg shrink-0"
                      >
                        Nhập
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Alert Section 3: 💰 Đơn chưa thanh toán đủ */}
      <Card className="rounded-2xl border-gray-200/80 shadow-sm overflow-hidden">
        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <span className="text-base">💰</span>
            <CardTitle className="text-sm font-bold text-gray-900">
              Đơn chưa thanh toán đủ
            </CardTitle>
            {data && data.unpaidOrders.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800"
              >
                {data.unpaidOrders.length}
              </Badge>
            )}
          </div>
          <Link href="/orders?paymentStatus=unpaid,deposited">
            <span className="text-xs font-semibold text-rose-600 hover:underline">
              Tất cả
            </span>
          </Link>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : !data || data.unpaidOrders.length === 0 ? (
            <div className="text-center py-5 px-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <CreditCard className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-gray-800">
                Không có đơn nợ tiền 🎉
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tất cả đơn hàng đang xử lý đã thanh toán đủ
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.unpaidOrders.slice(0, 5).map((order) => {
                const paymentInfo = getStatusStyle(PAYMENT_STATUSES, order.paymentStatus);
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block p-3 bg-white border border-gray-100 rounded-xl shadow-xs hover:border-rose-200 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-gray-900">{order.code}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${paymentInfo.color}`}
                          >
                            {paymentInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 font-medium truncate mt-0.5">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-rose-600">
                          Thiếu: {formatVND(order.remainingAmount)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Tổng: {formatVND(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Alert Section 4: 📉 Cảnh báo biên lợi nhuận thấp */}
      {data && data.lowMarginProducts && data.lowMarginProducts.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-sm overflow-hidden">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <span className="text-base">📉</span>
              <CardTitle className="text-sm font-bold text-amber-900">
                Cảnh báo biên lợi nhuận thấp
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[11px] font-bold px-2 py-0.5 rounded-full border-amber-300 text-amber-800 bg-white"
              >
                {data.lowMarginProducts.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-2">
            <p className="text-xs text-amber-800 leading-relaxed mb-2">
              Giá nhập vật tư tăng khiến các mẫu sau có biên lợi nhuận thực tế thấp hơn mục tiêu:
            </p>
            {data.lowMarginProducts.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-white rounded-xl border border-amber-100 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Giá bán: {formatVND(p.suggestedPrice)} | Vốn: {formatVND(p.totalCost)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-black text-xs px-2 py-0.5 rounded-md ${
                      p.actualMargin <= 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Lãi: {p.actualMargin}%
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">Mục tiêu: {p.targetMargin}%</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}
