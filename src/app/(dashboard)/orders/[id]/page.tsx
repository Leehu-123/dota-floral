'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Clock,
  Truck,
  Store,
  Copy,
  Edit,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  CreditCard,
  Banknote,
  DollarSign,
  Package,
  Layers,
  FileText,
  RefreshCw,
  Send,
  XCircle,
  ChevronRight,
  Info,
  QrCode,
} from 'lucide-react';
import { PaymentQrDialog } from '@/components/payment-qr-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatVND, formatDate, formatDateTime, formatQty } from '@/lib/format';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  CHANNELS,
  DELIVERY_TYPES,
  getLabel,
  getStatusStyle,
} from '@/lib/constants';
import { toast } from 'sonner';

interface OrderLineMaterialItem {
  id: string;
  materialId: string;
  quantity: number | string;
  unitCost: number | string;
  material?: {
    id: string;
    name: string;
    baseUnit: string;
  };
}

interface OrderLineDetail {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
  snapshotCost?: number | string;
  isCustom: boolean;
  materials?: OrderLineMaterialItem[];
}

interface OrderDetail {
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
  referenceImageUrl?: string | null;
  finishedImageUrl?: string | null;
  lines: OrderLineDetail[];
}

const PROGRESS_STEPS = [
  { key: 'new', label: 'Mới' },
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'delivered', label: 'Đã giao' },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Change Confirmation Modal
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean;
    nextStatus: string;
    label: string;
    description: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Stock Warnings Modal
  const [stockWarnings, setStockWarnings] = useState<string[] | null>(null);

  // Payment Update Modal
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: 'unpaid',
    depositAmount: 0,
    paymentMethod: 'cash',
  });
  const [updatingPayment, setUpdatingPayment] = useState(false);

  // Fetch Order
  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Không tìm thấy đơn hàng');
        }
        throw new Error('Lỗi khi tải thông tin đơn hàng');
      }
      const data = await res.json();
      const orderData = data.order || data;
      setOrder(orderData);
      setPaymentForm({
        paymentStatus: orderData.paymentStatus || 'unpaid',
        depositAmount: Number(orderData.depositAmount) || 0,
        paymentMethod: orderData.paymentMethod || 'cash',
      });
    } catch (err: any) {
      console.error('Fetch order error:', err);
      setError(err.message || 'Không thể tải đơn hàng');
      toast.error(err.message || 'Không thể tải đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Handle status update
  const handleConfirmStatusChange = async () => {
    if (!statusConfirm || !order) return;
    const nextStatus = statusConfirm.nextStatus;

    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Không thể cập nhật trạng thái đơn');
      }

      toast.success(
        `Đã chuyển trạng thái sang "${getLabel(ORDER_STATUSES, nextStatus)}"`
      );

      // Check if server returned any stock warnings
      if (
        resData.stockWarnings &&
        Array.isArray(resData.stockWarnings) &&
        resData.stockWarnings.length > 0
      ) {
        setStockWarnings(resData.stockWarnings);
      } else if (
        resData.warnings &&
        Array.isArray(resData.warnings) &&
        resData.warnings.length > 0
      ) {
        setStockWarnings(resData.warnings);
      }

      setStatusConfirm(null);
      fetchOrder();
    } catch (err: any) {
      console.error('Update status error:', err);
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle payment update
  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      setUpdatingPayment(true);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: paymentForm.paymentStatus,
          depositAmount: Number(paymentForm.depositAmount) || 0,
          paymentMethod: paymentForm.paymentMethod,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Không thể cập nhật thanh toán');
      }

      toast.success('Đã cập nhật thông tin thanh toán');
      setPaymentDialogOpen(false);
      fetchOrder();
    } catch (err: any) {
      console.error('Update payment error:', err);
      toast.error(err.message || 'Lỗi khi cập nhật thanh toán');
    } finally {
      setUpdatingPayment(false);
    }
  };

  // Copy order info text
  const handleCopyOrderInfo = async () => {
    if (!order) return;
    try {
      // 1. Try to fetch formatted copy text from endpoint
      let copyText = '';
      try {
        const res = await fetch(`/api/orders/${order.id}/copy-text`);
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            copyText = data.text;
          }
        }
      } catch (e) {
        // Fallback to client-side formatted text
      }

      if (!copyText) {
        const lineItems = (order.lines || [])
          .map(
            (l, idx) =>
              `${idx + 1}. ${l.productName} x${l.quantity} - ${formatVND(
                l.lineTotal || Number(l.unitPrice) * l.quantity
              )}`
          )
          .join('\n');

        copyText = `🌸 [DOTA FLORAL] THÔNG TIN ĐƠN HÀNG: ${order.code}
- Khách hàng: ${order.customerName}${
          order.customerPhone ? ` - ${order.customerPhone}` : ''
        }
- Kênh đặt: ${getLabel(CHANNELS, order.channel)}
- Hình thức: ${getLabel(DELIVERY_TYPES, order.deliveryType)}
- Thời gian giao: ${
          order.deliveryDate ? formatDateTime(order.deliveryDate) : 'Chưa hẹn'
        }
- Danh sách món:
${lineItems || 'Không có'}
- Tạm tính: ${formatVND(subtotal)}
${
  Number(order.shippingFee) > 0
    ? `- Phí vận chuyển: ${formatVND(order.shippingFee)}\n`
    : ''
}${
          Number(order.discount) > 0
            ? `- Giảm giá: -${formatVND(order.discount)}\n`
            : ''
        }- TỔNG CỘNG: ${formatVND(order.totalAmount)}
- Thanh toán: ${getLabel(
          PAYMENT_STATUSES,
          order.paymentStatus
        )} (${getLabel(PAYMENT_METHODS, order.paymentMethod || 'cash')})
${
  Number(order.depositAmount) > 0
    ? `- Đã cọc: ${formatVND(order.depositAmount)}\n`
    : ''
}${order.note ? `- Ghi chú: ${order.note}` : ''}`;
      }

      await navigator.clipboard.writeText(copyText);
      toast.success('Đã sao chép thông tin đơn hàng vào bộ nhớ tạm!');
    } catch (err) {
      console.error('Copy text error:', err);
      toast.error('Không thể sao chép thông tin');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-6 w-44 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4 pt-6">
        <Card className="rounded-2xl border-red-200 bg-red-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                {error || 'Không tìm thấy đơn hàng'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl border-gray-200"
                asChild
              >
                <Link href="/orders">Về danh sách đơn</Link>
              </Button>
              <Button
                onClick={fetchOrder}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử lại</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculated financials
  const subtotal = (order.lines || []).reduce((acc, line) => {
    const total =
      line.lineTotal !== undefined && line.lineTotal !== null
        ? Number(line.lineTotal)
        : Number(line.unitPrice) * Number(line.quantity);
    return acc + (isNaN(total) ? 0 : total);
  }, 0);

  const totalAmount = Number(order.totalAmount) || 0;
  const totalCost = Number(order.totalCost) || 0;
  const grossProfit = totalAmount - totalCost;
  const marginPercent =
    totalAmount > 0 ? ((grossProfit / totalAmount) * 100).toFixed(1) : '0';

  const statusStyle = getStatusStyle(ORDER_STATUSES, order.status);
  const paymentStyle = getStatusStyle(PAYMENT_STATUSES, order.paymentStatus);

  // Stepper progression index
  const currentStepIndex = PROGRESS_STEPS.findIndex(
    (s) => s.key === order.status
  );
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Header with Back Button, Code, Status & Edit Link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-gray-100 shrink-0"
            onClick={() => router.push('/orders')}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {order.code}
              </h2>
              <Badge
                className={`text-[11px] px-2.5 py-0.5 border-0 font-semibold ${statusStyle.color}`}
              >
                {statusStyle.label}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ngày tạo: {formatDate(order.orderDate)}
            </p>
          </div>
        </div>

        {/* Edit Button (Available when order status is 'new') */}
        {order.status === 'new' && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 h-9 gap-1"
            asChild
          >
            <Link href={`/orders/${order.id}/edit`}>
              <Edit className="w-3.5 h-3.5" />
              <span className="text-xs">Sửa</span>
            </Link>
          </Button>
        )}
      </div>

      {/* 2. Visual Status Progression Bar */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardContent className="p-4">
          {isCancelled ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 flex items-center gap-3 text-red-800">
              <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" />
              <div>
                <p className="font-bold text-sm">Đơn hàng này đã bị hủy</p>
                <p className="text-xs text-red-600/90 mt-0.5">
                  Không thể thay đổi quy trình tiến độ cho đơn hàng đã hủy.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between relative px-2">
                {/* Connecting Line Background */}
                <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-gray-200 -z-0" />
                {/* Connecting Line Active Fill */}
                <div
                  className="absolute top-3.5 left-6 h-0.5 bg-rose-500 transition-all duration-300 -z-0"
                  style={{
                    width: `${
                      currentStepIndex >= 0
                        ? (currentStepIndex / (PROGRESS_STEPS.length - 1)) * 100
                        : 0
                    }%`,
                  }}
                />

                {PROGRESS_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className="flex flex-col items-center z-10"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-rose-600 text-white shadow-xs'
                            : isCurrent
                            ? 'bg-rose-600 text-white ring-4 ring-rose-100 shadow-sm'
                            : 'bg-white border-2 border-gray-300 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] mt-1.5 whitespace-nowrap ${
                          isCurrent
                            ? 'font-bold text-rose-600'
                            : isCompleted
                            ? 'font-medium text-gray-800'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2-Column Responsive Layout for Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Customer, Products & Notes (lg:col-span-7 xl:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* 3. Customer & Delivery Info Card */}
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center justify-between">
            <span>Thông tin khách hàng & Giao hàng</span>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-rose-50 text-rose-700">
              {getLabel(CHANNELS, order.channel)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-base">
                {order.customerName}
              </p>
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 mt-1 active:scale-95 transition-transform"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.customerPhone}</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    (Chạm để gọi)
                  </span>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Không có số điện thoại
                </p>
              )}
            </div>

            <Badge
              variant="outline"
              className="text-xs font-medium border-gray-200"
            >
              {order.deliveryType === 'ship' ? (
                <span className="flex items-center gap-1 text-blue-700">
                  <Truck className="w-3 h-3" /> Ship hàng
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700">
                  <Store className="w-3 h-3" /> Nhận tại tiệm
                </span>
              )}
            </Badge>
          </div>

          <div className="bg-gray-50/80 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Thời gian giao:</span>
            </span>
            <span className="font-semibold text-gray-800">
              {order.deliveryDate
                ? formatDateTime(order.deliveryDate)
                : 'Chưa hẹn giờ'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Order Lines Section */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-900 px-1">
          Sản phẩm đặt ({order.lines?.length || 0})
        </h3>
        <div className="space-y-2.5">
          {(order.lines || []).map((line, idx) => {
            const lineTotal =
              line.lineTotal !== undefined && line.lineTotal !== null
                ? Number(line.lineTotal)
                : Number(line.unitPrice) * Number(line.quantity);

            return (
              <Card
                key={line.id || idx}
                className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-hidden"
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">
                          {line.productName}
                        </span>
                        {line.isCustom && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700 border border-rose-200 font-semibold"
                          >
                            Tùy chỉnh
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Đơn giá: {formatVND(line.unitPrice)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-sm text-gray-900 block">
                        {formatVND(lineTotal)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        x{line.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Materials breakdown if available */}
                  {line.materials && line.materials.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>Nguyên vật liệu cấu thành:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {line.materials.map((m, mIdx) => (
                          <span
                            key={m.id || mIdx}
                            className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md"
                          >
                            {m.material?.name || 'Vật tư'}: {formatQty(m.quantity)}{' '}
                            {m.material?.baseUnit || ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 7. Note Section */}
      {order.note && (
        <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Ghi chú đơn hàng</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-gray-700 bg-amber-50/60 p-3 rounded-xl border border-amber-100/80 leading-relaxed whitespace-pre-wrap">
              {order.note}
            </p>
          </CardContent>
        </Card>
      )}
    </div>

    {/* Right Column: Financials, Payment & Actions (lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20) */}
    <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
      {/* 5. Financial Summary Card */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900">
            Tổng kết tài chính
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 text-xs">
            <span>Tạm tính (tiền hàng)</span>
            <span className="font-medium">{formatVND(subtotal)}</span>
          </div>

          <div className="flex justify-between text-gray-600 text-xs">
            <span>Phí vận chuyển</span>
            <span className="font-medium">
              {Number(order.shippingFee) > 0
                ? formatVND(order.shippingFee)
                : '0 ₫'}
            </span>
          </div>

          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-rose-600 text-xs font-medium">
              <span>Giảm giá</span>
              <span>-{formatVND(order.discount)}</span>
            </div>
          )}

          {Number(order.channelFeePercent) > 0 && (
            <div className="flex justify-between text-gray-600 text-xs">
              <span>Phí kênh ({Number(order.channelFeePercent)}%)</span>
              <span className="font-medium">
                {formatVND(
                  (totalAmount * Number(order.channelFeePercent)) / 100
                )}
              </span>
            </div>
          )}

          <Separator className="my-1.5" />

          <div className="flex justify-between items-center text-base font-bold">
            <span className="text-gray-900">Tổng cộng</span>
            <span className="text-lg text-rose-600 font-extrabold">
              {formatVND(order.totalAmount)}
            </span>
          </div>

          {/* Cost & Gross Profit */}
          <div className="mt-3 pt-3 border-t border-dashed border-gray-200 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-muted-foreground block text-[11px]">
                Giá vốn ước tính
              </span>
              <span className="font-bold text-gray-800 text-sm mt-0.5 block">
                {formatVND(totalCost)}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl ${
                grossProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`block text-[11px] font-semibold ${
                    grossProfit >= 0 ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  Lãi gộp ({marginPercent}%)
                </span>
              </div>
              <span
                className={`font-extrabold text-sm mt-0.5 block ${
                  grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {grossProfit >= 0
                  ? `+${formatVND(grossProfit)}`
                  : `-${formatVND(Math.abs(grossProfit))}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Payment Section */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-900">
              Thanh toán
            </CardTitle>
            <Badge
              className={`text-xs px-2.5 py-0.5 border-0 font-medium ${paymentStyle.color}`}
            >
              {paymentStyle.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-muted-foreground block text-[11px]">
                Đã thanh toán / cọc
              </span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                {formatVND(order.depositAmount)}
              </span>
            </div>

            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-muted-foreground block text-[11px]">
                Phương thức
              </span>
              <span className="font-semibold text-gray-900 text-sm mt-0.5 block">
                {getLabel(PAYMENT_METHODS, order.paymentMethod || 'cash')}
              </span>
            </div>
          </div>

          {order.paymentStatus === 'deposited' && (
            <div className="flex justify-between items-center text-xs px-1 text-amber-800">
              <span>Số tiền còn lại cần thu:</span>
              <span className="font-bold text-sm">
                {formatVND(
                  Math.max(0, totalAmount - Number(order.depositAmount))
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setQrDialogOpen(true)}
              className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white h-10 font-semibold text-xs gap-1.5 shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Quét mã QR</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogOpen(true)}
              className="w-full rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 h-10 font-medium text-xs gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-gray-500" />
              <span>Cập nhật TT</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 8. Action Buttons (Based on status) */}
      <div className="space-y-2 pt-2">
        {/* New order actions */}
        {order.status === 'new' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs text-sm"
              onClick={() =>
                setStatusConfirm({
                  open: true,
                  nextStatus: 'in_progress',
                  label: 'Bắt đầu làm đơn này',
                  description:
                    'Chuyển đơn hàng sang trạng thái "Đang làm". Hệ thống sẽ kiểm tra và tạm giữ/xuất kho vật tư nếu cần.',
                })
              }
            >
              Bắt đầu làm
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm"
              onClick={() =>
                setStatusConfirm({
                  open: true,
                  nextStatus: 'cancelled',
                  label: 'Hủy đơn hàng này',
                  description:
                    'Bạn có chắc chắn muốn hủy đơn hàng này? Thao tác này không thể hoàn tác.',
                })
              }
            >
              Hủy đơn
            </Button>
          </div>
        )}

        {/* In progress actions */}
        {order.status === 'in_progress' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-sm"
              onClick={() =>
                setStatusConfirm({
                  open: true,
                  nextStatus: 'completed',
                  label: 'Hoàn thành làm hoa',
                  description:
                    'Xác nhận bó hoa/sản phẩm đã được cắm xong và sẵn sàng giao cho khách.',
                })
              }
            >
              Hoàn thành
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm"
              onClick={() =>
                setStatusConfirm({
                  open: true,
                  nextStatus: 'cancelled',
                  label: 'Hủy đơn hàng',
                  description:
                    'Hủy đơn hàng sẽ hoàn lại các nguyên vật liệu đã xuất cho đơn này vào lại kho.',
                })
              }
            >
              Hủy đơn
            </Button>
          </div>
        )}

        {/* Completed actions */}
        {order.status === 'completed' && (
          <Button
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-sm"
            onClick={() =>
              setStatusConfirm({
                open: true,
                nextStatus: 'delivered',
                label: 'Xác nhận đã giao hàng',
                description:
                  'Đơn hàng đã được giao tận tay khách hoặc khách đã đến lấy tại tiệm.',
              })
            }
          >
            Đã giao hàng
          </Button>
        )}

        {/* All statuses: Copy info button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyOrderInfo}
          className="w-full h-11 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-sm gap-2"
        >
          <Copy className="w-4 h-4 text-gray-500" />
          <span>Sao chép thông tin gửi khách/shipper</span>
        </Button>
      </div>
    </div>
  </div>

      {/* Confirmation Dialog for Status Change */}
      <Dialog
        open={Boolean(statusConfirm?.open)}
        onOpenChange={(open) => !open && setStatusConfirm(null)}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {statusConfirm?.label}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 pt-1 leading-relaxed">
              {statusConfirm?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end pt-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-gray-200"
              onClick={() => setStatusConfirm(null)}
              disabled={updatingStatus}
            >
              Đóng
            </Button>
            <Button
              className={`flex-1 rounded-xl text-white font-semibold ${
                statusConfirm?.nextStatus === 'cancelled'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
              onClick={handleConfirmStatusChange}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Warnings Dialog */}
      <Dialog
        open={Boolean(stockWarnings && stockWarnings.length > 0)}
        onOpenChange={(open) => !open && setStockWarnings(null)}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-gray-900">
              Cảnh báo tồn kho vật tư
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-gray-600">
              Hệ thống ghi nhận một số nguyên vật liệu đang thiếu hoặc vượt mức tồn kho:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-48 overflow-y-auto">
            {stockWarnings?.map((warn, i) => (
              <div
                key={i}
                className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="pt-2">
            <Button
              className="w-full rounded-xl bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => setStockWarnings(null)}
            >
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Update Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">
                Cập nhật thanh toán
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-600">
                Thay đổi trạng thái thanh toán, tiền cọc và phương thức nhận tiền
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-1">
              {/* Payment status select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Trạng thái thanh toán
                </Label>
                <Select
                  value={paymentForm.paymentStatus}
                  onValueChange={(val) => {
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentStatus: val,
                      depositAmount:
                        val === 'paid'
                          ? totalAmount
                          : val === 'unpaid'
                          ? 0
                          : prev.depositAmount,
                    }));
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl text-sm">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((ps) => (
                      <SelectItem key={ps.value} value={ps.value}>
                        {ps.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Deposit amount input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Số tiền đã nhận / cọc (₫)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={totalAmount * 2}
                  step="1000"
                  value={paymentForm.depositAmount}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      depositAmount: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm"
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tổng đơn:{' '}
                  <span className="font-bold text-gray-800">
                    {formatVND(totalAmount)}
                  </span>
                </p>
              </div>

              {/* Payment method select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Phương thức thanh toán
                </Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(val) =>
                    setPaymentForm((prev) => ({ ...prev, paymentMethod: val }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl text-sm">
                    <SelectValue placeholder="Chọn phương thức" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex-row gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl border-gray-200"
                onClick={() => setPaymentDialogOpen(false)}
                disabled={updatingPayment}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                disabled={updatingPayment}
              >
                {updatingPayment ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 11. VietQR Quick Payment Dialog */}
      {order && (
        <PaymentQrDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          orderId={order.id}
          orderCode={order.code}
          amount={
            order.paymentStatus === 'deposited'
              ? Math.max(0, totalAmount - Number(order.depositAmount))
              : totalAmount
          }
          customerName={order.customerName}
          onPaymentSuccess={fetchOrder}
        />
      )}
    </div>
  );
}
