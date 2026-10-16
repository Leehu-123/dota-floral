'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  Layers,
  Truck,
  Store,
  Calendar,
  Clock,
  User,
  Phone,
  AlertTriangle,
  CreditCard,
  PackagePlus,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatVND, formatQty } from '@/lib/format';
import {
  CHANNELS,
  DELIVERY_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  ORDER_STATUSES,
  getLabel,
  getStatusStyle,
} from '@/lib/constants';
import { toast } from 'sonner';

interface ProductTemplate {
  id: string;
  name: string;
  suggestedPrice: number | string;
  computedPrice?: number | string;
  description?: string | null;
}

interface MaterialItem {
  id: string;
  name: string;
  baseUnit: string;
  avgCost: number | string;
  currentStock: number | string;
}

interface CustomMaterialEntry {
  materialId: string;
  materialName: string;
  baseUnit: string;
  unitCost: number;
  quantity: number;
}

interface OrderLineFormItem {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isCustom: boolean;
  materials?: {
    materialId: string;
    quantity: number;
    unitCost: number;
  }[];
}

interface CustomerSuggestion {
  id: string;
  name: string;
  phone?: string | null;
}

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  // Initial order fetching state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState('');
  const [orderStatus, setOrderStatus] = useState('new');

  // Form states
  const [channel, setChannel] = useState<string>('zalo');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<string>('pickup');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('');
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('unpaid');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  // Lines
  const [lines, setLines] = useState<OrderLineFormItem[]>([]);

  // Customer Autocomplete
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<HTMLDivElement | null>(null);

  // Add Product Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'template' | 'custom'>('template');
  const [products, setProducts] = useState<ProductTemplate[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  // Custom Product Builder
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [selectedMaterials, setSelectedMaterials] = useState<CustomMaterialEntry[]>([]);
  const [pickedMaterialId, setPickedMaterialId] = useState('');
  const [pickedMaterialQty, setPickedMaterialQty] = useState<number>(1);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Fetch initial order data
  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        throw new Error('Không thể tải thông tin đơn hàng');
      }
      const data = await res.json();
      const o = data.order || data;

      setOrderCode(o.code || '');
      setOrderStatus(o.status || 'new');
      setChannel(o.channel || 'zalo');
      setCustomerId(o.customerId || null);
      setCustomerName(o.customerName || '');
      setCustomerPhone(o.customerPhone || '');
      setDeliveryType(o.deliveryType || 'pickup');
      setShippingFee(Number(o.shippingFee) || 0);
      setDiscount(Number(o.discount) || 0);
      setNote(o.note || '');
      setPaymentStatus(o.paymentStatus || 'unpaid');
      setDepositAmount(Number(o.depositAmount) || 0);
      setPaymentMethod(o.paymentMethod || 'cash');

      // Parse deliveryDate
      if (o.deliveryDate) {
        const d = new Date(o.deliveryDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setDeliveryDate(`${yyyy}-${mm}-${dd}`);

        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setDeliveryTime(`${hh}:${min}`);
      }

      // Populate lines
      if (o.lines && Array.isArray(o.lines)) {
        setLines(
          o.lines.map((l: any, idx: number) => ({
            id: l.id || `line-${idx}`,
            productId: l.productId || null,
            productName: l.productName || 'Sản phẩm',
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
            lineTotal:
              Number(l.lineTotal) ||
              (Number(l.unitPrice) || 0) * (Number(l.quantity) || 1),
            isCustom: Boolean(l.isCustom),
            materials: l.materials || [],
          }))
        );
      }
    } catch (err: any) {
      console.error('Fetch order for edit error:', err);
      setError(err.message || 'Lỗi khi tải đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Load products and materials for dialog
  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoadingProducts(true);
        const [prodRes, matRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/materials'),
        ]);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(Array.isArray(prodData) ? prodData : prodData.products || []);
        }
        if (matRes.ok) {
          const matData = await matRes.json();
          setMaterials(Array.isArray(matData) ? matData : []);
        }
      } catch (e) {
        console.error('Lỗi khi tải danh mục:', e);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadCatalog();
  }, []);

  // Customer Autocomplete handler
  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    setCustomerId(null);

    if (customerDebounceRef.current) {
      clearTimeout(customerDebounceRef.current);
    }

    if (!val || val.trim().length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    customerDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(val.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.customers || [];
          setCustomerSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch (err) {
        console.error('Search customer error:', err);
      }
    }, 300);
  };

  const selectCustomer = (cust: CustomerSuggestion) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerId(cust.id);
    setShowSuggestions(false);
  };

  // Quick date shortcuts
  const setQuickDate = (type: 'today' | 'tomorrow') => {
    const d = new Date();
    if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDeliveryDate(`${yyyy}-${mm}-${dd}`);
    if (!deliveryTime) setDeliveryTime('10:00');
  };

  // Calculated totals
  const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const totalAmount = Math.max(
    0,
    subtotal + (deliveryType === 'ship' ? shippingFee : 0) - discount
  );

  // Line operations
  const addTemplateLine = (prod: ProductTemplate) => {
    const price = Number(prod.suggestedPrice || prod.computedPrice) || 0;
    const newLine: OrderLineFormItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: prod.id,
      productName: prod.name,
      quantity: 1,
      unitPrice: price,
      lineTotal: price,
      isCustom: false,
    };
    setLines((prev) => [...prev, newLine]);
    toast.success(`Đã thêm "${prod.name}"`);
    setAddDialogOpen(false);
  };

  const handleAddCustomMaterial = () => {
    if (!pickedMaterialId) return;
    const mat = materials.find((m) => m.id === pickedMaterialId);
    if (!mat) return;

    const existingIndex = selectedMaterials.findIndex(
      (m) => m.materialId === pickedMaterialId
    );
    if (existingIndex >= 0) {
      const updated = [...selectedMaterials];
      updated[existingIndex].quantity += pickedMaterialQty;
      setSelectedMaterials(updated);
    } else {
      setSelectedMaterials((prev) => [
        ...prev,
        {
          materialId: mat.id,
          materialName: mat.name,
          baseUnit: mat.baseUnit,
          unitCost: Number(mat.avgCost) || 0,
          quantity: pickedMaterialQty,
        },
      ]);
    }

    const estCost = Number(mat.avgCost) * pickedMaterialQty;
    if (customPrice === 0) {
      setCustomPrice(Math.round(estCost * 1.5));
    } else {
      setCustomPrice((p) => p + Math.round(estCost * 1.5));
    }

    setPickedMaterialId('');
    setPickedMaterialQty(1);
  };

  const handleAddCustomLine = () => {
    if (!customName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }
    const newLine: OrderLineFormItem = {
      id: `custom-${Date.now()}`,
      productId: null,
      productName: customName.trim(),
      quantity: 1,
      unitPrice: customPrice,
      lineTotal: customPrice,
      isCustom: true,
      materials: selectedMaterials.map((m) => ({
        materialId: m.materialId,
        quantity: m.quantity,
        unitCost: m.unitCost,
      })),
    };
    setLines((prev) => [...prev, newLine]);
    setCustomName('');
    setCustomPrice(0);
    setSelectedMaterials([]);
    setAddDialogOpen(false);
  };

  const updateLineQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: newQty,
        lineTotal: newQty * copy[index].unitPrice,
      };
      return copy;
    });
  };

  const updateLinePrice = (index: number, newPrice: number) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unitPrice: newPrice,
        lineTotal: copy[index].quantity * newPrice,
      };
      return copy;
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler: PUT /api/orders/[id]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    if (lines.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    try {
      setSubmitting(true);

      let deliveryDateTime: string | null = null;
      if (deliveryDate) {
        const timePart = deliveryTime ? deliveryTime : '12:00';
        deliveryDateTime = new Date(`${deliveryDate}T${timePart}:00`).toISOString();
      }

      const payload = {
        channel,
        customerId: customerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        deliveryType,
        deliveryDate: deliveryDateTime,
        shippingFee: deliveryType === 'ship' ? Number(shippingFee) || 0 : 0,
        discount: Number(discount) || 0,
        note: note.trim() || undefined,
        paymentStatus,
        depositAmount:
          paymentStatus === 'paid'
            ? totalAmount
            : paymentStatus === 'deposited'
            ? Number(depositAmount) || 0
            : 0,
        paymentMethod,
        lines: lines.map((l) => ({
          id:
            l.id.startsWith('line-') || l.id.startsWith('custom-')
              ? undefined
              : l.id,
          productId: l.productId || undefined,
          productName: l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          isCustom: l.isCustom,
          materials: l.materials || [],
        })),
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Không thể cập nhật đơn hàng');
      }

      toast.success('Cập nhật đơn hàng thành công!');
      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      console.error('Update order error:', err);
      toast.error(err.message || 'Lỗi khi cập nhật đơn hàng');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="rounded-2xl border-red-200 bg-red-50/50 mt-6">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-gray-900">{error}</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl border-gray-200"
              onClick={() => router.push('/orders')}
            >
              Về danh sách
            </Button>
            <Button
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              onClick={fetchOrder}
            >
              Thử lại
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Guard: If status is not 'new', show read-only notice & redirect button
  if (orderStatus !== 'new') {
    const statusStyle = getStatusStyle(ORDER_STATUSES, orderStatus);
    return (
      <div className="space-y-4 pt-4">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60 shadow-xs">
          <CardContent className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                Không thể chỉnh sửa đơn hàng
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Đơn hàng <b>{orderCode}</b> hiện đang ở trạng thái{' '}
                <Badge className={`text-xs border-0 ${statusStyle.color}`}>
                  {statusStyle.label}
                </Badge>
                . Chỉ các đơn hàng ở trạng thái <b>"Mới"</b> mới có thể chỉnh sửa
                thông tin và danh sách sản phẩm.
              </p>
            </div>
            <div className="pt-3">
              <Button
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white h-11 px-5 font-semibold"
                asChild
              >
                <Link href={`/orders/${orderId}`}>
                  Xem chi tiết đơn hàng
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    return p.name.toLowerCase().includes(productSearch.trim().toLowerCase());
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-36">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-gray-100 shrink-0"
            onClick={() => router.push(`/orders/${orderId}`)}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Sửa đơn: {orderCode}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Cập nhật thông tin đơn hàng ở trạng thái Mới
            </p>
          </div>
        </div>
      </div>

      {/* 1. Channel Select */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-gray-700 px-1">
          Kênh nhận đơn
        </Label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {CHANNELS.map((ch) => {
            const isSelected = channel === ch.value;
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => setChannel(ch.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border active:scale-[0.98] ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Customer Section */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-visible">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <User className="w-4 h-4 text-rose-500" />
            <span>Thông tin khách hàng</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3">
          <div className="space-y-1.5 relative" ref={autocompleteRef}>
            <Label className="text-xs font-semibold text-gray-700">
              Tên khách hàng <span className="text-rose-500">*</span>
            </Label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              required
              className="h-11 rounded-xl text-sm bg-white"
            />
            {showSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {customerSuggestions.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => selectCustomer(cust)}
                    className="w-full text-left p-3 hover:bg-rose-50/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{cust.name}</p>
                      {cust.phone && (
                        <p className="text-muted-foreground">{cust.phone}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Chọn
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Số điện thoại
            </Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="pl-10 h-11 rounded-xl text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Delivery Section */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-rose-500" />
            <span>Hình thức nhận & Giao hàng</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                deliveryType === 'pickup'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Nhận tại tiệm</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('ship')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                deliveryType === 'ship'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Giao hàng (Ship)</span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">
                Ngày & Giờ nhận
              </Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate('today')}
                  className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('tomorrow')}
                  className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"
                >
                  Ngày mai
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-11 rounded-xl text-xs px-3"
              />
              <Input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="h-11 rounded-xl text-xs px-3"
              />
            </div>
          </div>

          {deliveryType === 'ship' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-gray-700">
                Phí ship (₫)
              </Label>
              <Input
                type="number"
                min="0"
                step="5000"
                value={shippingFee || ''}
                onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                className="h-11 rounded-xl text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Order Lines Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <Label className="text-sm font-bold text-gray-900">
            Sản phẩm ({lines.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 h-9 font-semibold text-xs gap-1 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm</span>
          </Button>
        </div>

        {lines.length === 0 ? (
          <div
            onClick={() => setAddDialogOpen(true)}
            className="border-2 border-dashed border-rose-200 rounded-2xl p-6 text-center bg-rose-50/30 hover:bg-rose-50/60 transition-colors cursor-pointer space-y-2"
          >
            <PackagePlus className="w-8 h-8 text-rose-500 mx-auto" />
            <div>
              <p className="text-sm font-bold text-rose-900">
                Chưa có sản phẩm nào
              </p>
              <p className="text-xs text-rose-700/80 mt-0.5">
                Chạm để thêm sản phẩm từ mẫu hoặc tự tạo
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lines.map((line, idx) => (
              <Card
                key={line.id}
                className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-hidden"
              >
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {line.productName}
                        </span>
                        {line.isCustom && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700 font-semibold border-rose-200"
                          >
                            Tùy chỉnh
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
                    <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50/50 p-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-gray-700"
                        onClick={() => updateLineQty(idx, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="w-9 text-center font-bold text-sm text-gray-900">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-gray-700"
                        onClick={() => updateLineQty(idx, line.quantity + 1)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="5000"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLinePrice(idx, Number(e.target.value) || 0)
                            }
                            className="h-8 w-24 text-right text-xs font-semibold rounded-lg px-2"
                          />
                          <span className="text-xs text-muted-foreground">₫</span>
                        </div>
                        <span className="text-[11px] font-bold text-rose-600 block mt-0.5">
                          = {formatVND(line.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 5. Discount & 6. Note */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardContent className="p-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Giảm giá (₫)
            </Label>
            <Input
              type="number"
              min="0"
              step="5000"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="h-11 rounded-xl text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Ghi chú đơn hàng & Lời chúc
            </Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl text-sm min-h-[70px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* 7. Payment Section */}
      <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-rose-500" />
            <span>Thanh toán</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Trạng thái thanh toán
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_STATUSES.map((ps) => {
                const isSelected = paymentStatus === ps.value;
                return (
                  <button
                    key={ps.value}
                    type="button"
                    onClick={() => {
                      setPaymentStatus(ps.value);
                      if (ps.value === 'paid') {
                        setDepositAmount(totalAmount);
                      } else if (ps.value === 'unpaid') {
                        setDepositAmount(0);
                      }
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border text-center transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {ps.label}
                  </button>
                );
              })}
            </div>
          </div>

          {paymentStatus === 'deposited' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-gray-700">
                  Số tiền đã cọc (₫)
                </Label>
                <button
                  type="button"
                  onClick={() => setDepositAmount(Math.round(totalAmount / 2))}
                  className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded"
                >
                  Cọc 50% ({formatVND(Math.round(totalAmount / 2))})
                </button>
              </div>
              <Input
                type="number"
                min="0"
                max={totalAmount}
                step="1000"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                className="h-11 rounded-xl text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Phương thức
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = paymentMethod === pm.value;
                return (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border text-center transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {pm.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8. Sticky Bottom Summary & Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 pb-4 md:pb-3 safe-area-bottom z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              Tạm tính: <b>{formatVND(subtotal)}</b>
              {deliveryType === 'ship' && Number(shippingFee) > 0 && (
                <> + Ship: <b>{formatVND(shippingFee)}</b></>
              )}
              {Number(discount) > 0 && (
                <> - Giảm: <b className="text-rose-600">{formatVND(discount)}</b></>
              )}
            </span>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">
                Tổng cộng
              </span>
              <span className="text-lg font-black text-rose-600">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl border-gray-200"
              onClick={() => router.push(`/orders/${orderId}`)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-[2] h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold shadow-md active:scale-[0.98]"
            >
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </div>

      {/* Product Selection Dialog with 2 Tabs */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[85vh] flex flex-col p-4">
          <DialogHeader className="p-1 pb-0">
            <DialogTitle className="text-base font-bold text-gray-900">
              Thêm sản phẩm vào đơn
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Chọn mẫu bó hoa có sẵn trong kho hoặc định lượng mẫu hoa tùy chỉnh
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={dialogTab}
            onValueChange={(val) => setDialogTab(val as 'template' | 'custom')}
            className="w-full flex-1 flex flex-col min-h-0 pt-2"
          >
            <TabsList className="grid grid-cols-2 w-full h-10 rounded-xl bg-gray-100 p-1">
              <TabsTrigger
                value="template"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-white"
              >
                Mẫu có sẵn ({products.length})
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-white"
              >
                Tùy chỉnh (Định lượng)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: MẪU CÓ SẴN */}
            <TabsContent
              value="template"
              className="flex-1 flex flex-col min-h-0 space-y-3 pt-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Tìm mẫu bó hoa..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 h-10 text-xs rounded-xl"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
                {loadingProducts ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Không tìm thấy mẫu phù hợp
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const price =
                      Number(p.suggestedPrice || p.computedPrice) || 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => addTemplateLine(p)}
                        className="p-3 rounded-xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50/40 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-gray-900 truncate">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-rose-600 block">
                            {formatVND(price)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Chạm để thêm
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* TAB 2: TÙY CHỈNH */}
            <TabsContent
              value="custom"
              className="flex-1 overflow-y-auto space-y-3 pt-2 max-h-[55vh]"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Tên sản phẩm tùy chỉnh <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="VD: Bó hoa sáp theo yêu cầu"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-gray-500" />
                  <span>Chọn nguyên vật liệu tiêu hao (tùy chọn)</span>
                </Label>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Select
                      value={pickedMaterialId}
                      onValueChange={setPickedMaterialId}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue placeholder="Chọn vật tư..." />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.baseUnit}) - tồn: {formatQty(m.currentStock)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={pickedMaterialQty}
                      onChange={(e) =>
                        setPickedMaterialQty(Number(e.target.value) || 1)
                      }
                      className="h-9 text-xs rounded-lg px-2 text-center"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomMaterial}
                      className="h-9 px-2.5 rounded-lg bg-gray-900 text-white"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {selectedMaterials.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {selectedMaterials.map((sm, sIdx) => (
                      <div
                        key={sIdx}
                        className="bg-white p-2 rounded-lg border border-gray-200 text-[11px] flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-800">
                          {sm.materialName}: <b>{sm.quantity} {sm.baseUnit}</b>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {formatVND(sm.unitCost * sm.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMaterials((prev) =>
                                prev.filter((_, i) => i !== sIdx)
                              )
                            }
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Giá bán sản phẩm này (₫)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="5000"
                  value={customPrice || ''}
                  onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <Button
                type="button"
                onClick={handleAddCustomLine}
                className="w-full h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
              >
                Thêm vào đơn hàng
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </form>
  );
}
