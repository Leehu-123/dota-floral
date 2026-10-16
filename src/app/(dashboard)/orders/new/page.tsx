'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  Sparkles,
  Layers,
  Truck,
  Store,
  Calendar,
  Clock,
  User,
  Phone,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  QrCode,
  DollarSign,
  ChevronDown,
  ChevronRight,
  PackagePlus,
  CheckCircle2,
  Zap,
  ShoppingBag,
  RotateCcw,
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
  DialogFooter,
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
  MATERIAL_GROUPS,
  getLabel,
} from '@/lib/constants';
import { PaymentQrDialog } from '@/components/payment-qr-dialog';
import { toast } from 'sonner';

interface ProductTemplate {
  id: string;
  name: string;
  suggestedPrice: number | string;
  computedPrice?: number | string;
  description?: string | null;
  imageUrl?: string | null;
  materials?: any[];
  stock?: number;
}

interface MaterialItem {
  id: string;
  name: string;
  baseUnit: string;
  avgCost: number | string;
  currentStock: number | string;
  group: string;
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
  fromStock?: boolean;
  productStock?: number;
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

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial channel from URL param or default to 'tai_tiem' (90% customer base!)
  const initialChannel = searchParams?.get('channel') || 'tai_tiem';

  // Form states
  const [channel, setChannel] = useState<string>(initialChannel);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>(
    initialChannel === 'tai_tiem' ? 'Khách lẻ tại tiệm' : ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<string>('pickup');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('');
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>(
    initialChannel === 'tai_tiem' ? 'paid' : 'unpaid'
  );
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  // Lines
  const [lines, setLines] = useState<OrderLineFormItem[]>([]);

  // Customer Autocomplete state
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCustomerInput, setShowCustomerInput] = useState(false);
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement | null>(null);

  // Products and Materials data
  const [products, setProducts] = useState<ProductTemplate[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<string>('all'); // 'all' | 'in_stock'

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Add Custom / Template Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'template' | 'custom'>('custom');

  // Custom Product Builder state
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [selectedMaterials, setSelectedMaterials] = useState<CustomMaterialEntry[]>([]);
  const [pickedMaterialId, setPickedMaterialId] = useState('');
  const [pickedMaterialQty, setPickedMaterialQty] = useState<number>(1);

  // QR Payment Dialog State
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Switch channel handler
  const handleChannelSelect = (newChannel: string) => {
    setChannel(newChannel);
    if (newChannel === 'tai_tiem') {
      if (!customerName || customerName.trim() === '') {
        setCustomerName('Khách lẻ tại tiệm');
      }
      setDeliveryType('pickup');
      setShippingFee(0);
      setPaymentStatus('paid');
    } else {
      if (customerName === 'Khách lẻ tại tiệm') {
        setCustomerName('');
      }
      if (paymentStatus === 'paid') {
        setPaymentStatus('unpaid');
      }
    }
  };

  // Click outside listener for customer suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch product templates
  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (e) {
      console.error('Lỗi khi tải sản phẩm:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Fetch materials
  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Lỗi khi tải vật tư:', e);
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadMaterials();
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
        setSearchingCustomer(true);
        const res = await fetch(`/api/customers?search=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.customers || [];
          setCustomerSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch (err) {
        console.error('Search customer error:', err);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
  };

  const selectCustomer = (cust: CustomerSuggestion) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerId(cust.id);
    setShowSuggestions(false);
    setShowCustomerInput(true);
    toast.success(`Đã chọn khách hàng: ${cust.name}`);
  };

  // Quick date shortcuts
  const setQuickDate = (type: 'today' | 'tomorrow') => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDeliveryDate(`${yyyy}-${mm}-${dd}`);
    if (!deliveryTime) {
      setDeliveryTime('10:00');
    }
  };

  // Calculate totals
  const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const totalAmount = Math.max(0, subtotal + (deliveryType === 'ship' ? shippingFee : 0) - discount);

  // Fast 1-Touch Add Bouquet to Order (POS style)
  const handleQuickAddProduct = (prod: ProductTemplate) => {
    const price = Number(prod.suggestedPrice || prod.computedPrice) || 0;
    const availableStock = Number(prod.stock) || 0;
    const existingIndex = lines.findIndex((l) => l.productId === prod.id);

    if (existingIndex >= 0) {
      // Increase quantity
      updateLineQty(existingIndex, lines[existingIndex].quantity + 1);
      toast.success(`+1 "${prod.name}" (Tổng: ${lines[existingIndex].quantity + 1})`, {
        duration: 1500,
      });
    } else {
      // Add new line
      const useStock = availableStock > 0;
      const newLine: OrderLineFormItem = {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: prod.id,
        productName: prod.name,
        quantity: 1,
        unitPrice: price,
        lineTotal: price,
        isCustom: false,
        fromStock: useStock,
        productStock: availableStock,
      };
      setLines((prev) => [...prev, newLine]);
      toast.success(
        `Đã thêm "${prod.name}"${useStock ? ' (lấy từ hoa có sẵn)' : ''}`,
        { duration: 1500 }
      );
    }
  };

  const toggleLineFromStock = (index: number) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        fromStock: !copy[index].fromStock,
      };
      return copy;
    });
  };

  const handleAddCustomMaterial = () => {
    if (!pickedMaterialId) {
      toast.error('Vui lòng chọn vật tư');
      return;
    }
    const mat = materials.find((m) => m.id === pickedMaterialId);
    if (!mat) return;

    const existingIndex = selectedMaterials.findIndex((m) => m.materialId === pickedMaterialId);
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
      toast.error('Vui lòng nhập tên sản phẩm tùy chỉnh');
      return;
    }
    if (customPrice < 0) {
      toast.error('Đơn giá không hợp lệ');
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
      fromStock: false,
      materials: selectedMaterials.map((m) => ({
        materialId: m.materialId,
        quantity: m.quantity,
        unitCost: m.unitCost,
      })),
    };

    setLines((prev) => [...prev, newLine]);
    toast.success(`Đã thêm mẫu tùy chỉnh: "${customName}"`);

    // Reset custom form
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

  // Submit Handler: Supports fast complete for counter retail
  const handleSubmit = async (e?: React.FormEvent, forceComplete: boolean = false) => {
    if (e) e.preventDefault();

    const nameToSubmit = customerName.trim() || (channel === 'tai_tiem' ? 'Khách lẻ tại tiệm' : '');
    if (!nameToSubmit) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    if (lines.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 bó hoa vào đơn hàng');
      return;
    }

    try {
      setSubmitting(true);

      // Build deliveryDate ISO string
      let deliveryDateTime: string | null = null;
      if (deliveryDate) {
        const timePart = deliveryTime ? deliveryTime : '12:00';
        deliveryDateTime = new Date(`${deliveryDate}T${timePart}:00`).toISOString();
      }

      // For in-store counter checkout, default status is paid
      const finalPaymentStatus = channel === 'tai_tiem' ? (paymentStatus || 'paid') : paymentStatus;
      const finalDepositAmount =
        finalPaymentStatus === 'paid'
          ? totalAmount
          : finalPaymentStatus === 'deposited'
          ? Number(depositAmount) || 0
          : 0;

      const payload = {
        channel,
        customerId: customerId || undefined,
        customerName: nameToSubmit,
        customerPhone: customerPhone.trim() || undefined,
        deliveryType: channel === 'tai_tiem' ? 'pickup' : deliveryType,
        deliveryDate: deliveryDateTime,
        shippingFee: deliveryType === 'ship' && channel !== 'tai_tiem' ? Number(shippingFee) || 0 : 0,
        discount: Number(discount) || 0,
        note: note.trim() || undefined,
        paymentStatus: finalPaymentStatus,
        depositAmount: finalDepositAmount,
        paymentMethod: paymentMethod || 'cash',
        lines: lines.map((l) => ({
          productId: l.productId || undefined,
          productName: l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          isCustom: l.isCustom,
          fromStock: Boolean(l.fromStock),
          materials: l.materials || [],
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo đơn hàng');
      }

      // If in-store retail or forceComplete, immediately mark completed to deduct stock!
      if (channel === 'tai_tiem' || forceComplete) {
        try {
          const statusRes = await fetch(`/api/orders/${data.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          });
          if (statusRes.ok) {
            toast.success(`🌸 Bán hàng thành công! Đơn ${data.code} đã hoàn tất.`);
          } else {
            toast.success(`Đã tạo đơn ${data.code}`);
          }
        } catch (err) {
          toast.success(`Đã tạo đơn ${data.code}`);
        }
      } else {
        toast.success(`Đã tạo đơn ${data.code}`);
      }

      router.push(`/orders/${data.id}`);
    } catch (err: any) {
      console.error('Submit order error:', err);
      toast.error(err.message || 'Lỗi khi tạo đơn hàng');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Products for Catalog Grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search matching
      const matchesSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.trim().toLowerCase());
      if (!matchesSearch) return false;

      // Filter
      if (catalogFilter === 'in_stock') {
        return (Number(p.stock) || 0) > 0;
      }
      return true;
    });
  }, [products, productSearch, catalogFilter]);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-xl h-10 w-10 text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
              <span>{channel === 'tai_tiem' ? '🌸 Bán hàng tại tiệm (POS)' : 'Tạo đơn hàng mới'}</span>
            </h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {channel === 'tai_tiem'
                ? 'Chạm chọn hoa có sẵn để thanh toán và xuất kho nhanh'
                : 'Nhận đơn đặt trước từ Zalo, Facebook, Giao hàng'}
            </p>
          </div>
        </div>

        {/* Quick Mode Indicator */}
        <div className="flex items-center gap-2">
          {channel === 'tai_tiem' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Chế độ bán tại quầy</span>
            </span>
          )}
        </div>
      </div>

      {/* 1. Channel Selector Pills */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <Label className="text-xs font-bold text-gray-700">
            Kênh nhận đơn
          </Label>
          <span className="text-[11px] text-muted-foreground">
            90% khách mua trực tiếp tại tiệm
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {CHANNELS.map((ch) => {
            const isSelected = channel === ch.value;
            const isStore = ch.value === 'tai_tiem';
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => handleChannelSelect(ch.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border active:scale-[0.98] flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : isStore
                    ? 'bg-rose-50/80 text-rose-800 border-rose-200 hover:bg-rose-100/60'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isStore && <span>🌸</span>}
                <span>{ch.label}</span>
                {isStore && !isSelected && (
                  <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded-md font-extrabold ml-1">
                    Tại tiệm
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT ON DESKTOP (lg:grid lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Catalog Grid or Custom Order Form (lg:col-span-7 xl:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* A. If channel === 'tai_tiem': Show direct POS flower bouquet catalog! */}
          {channel === 'tai_tiem' ? (
            <Card className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-gray-50 flex flex-row items-center justify-between space-y-0 gap-2">
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-gray-900 flex items-center gap-2">
                    <Store className="w-4 h-4 text-rose-600" />
                    <span>Chọn hoa có sẵn trên kệ</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chạm vào mẫu hoa để thêm nhanh vào đơn
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDialogTab('custom');
                      setAddDialogOpen(true);
                    }}
                    className="rounded-xl border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 h-8 text-xs font-semibold gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Yêu cầu riêng</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {/* Search & Filter pills */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Tìm nhanh mẫu bó hoa..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 h-10 text-xs rounded-xl bg-gray-50/70 border-gray-200"
                    />
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCatalogFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        catalogFilter === 'all'
                          ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-2xs'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Tất cả ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogFilter('in_stock')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        catalogFilter === 'in_stock'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      🌸 Đang có sẵn ({products.filter((p) => (p.stock ?? 0) > 0).length})
                    </button>
                  </div>
                </div>

                {/* Catalog Grid */}
                {loadingProducts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 py-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed rounded-2xl">
                    <div className="text-3xl mb-2">🌸</div>
                    <p className="text-sm font-semibold text-gray-700">
                      Không tìm thấy mẫu hoa nào
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Bạn có thể bấm "+ Yêu cầu riêng" để tạo bó hoa theo ý khách
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredProducts.map((p) => {
                      const stock = Number(p.stock) || 0;
                      const price = Number(p.suggestedPrice || p.computedPrice) || 0;
                      const inCartCount = lines
                        .filter((l) => l.productId === p.id)
                        .reduce((sum, l) => sum + l.quantity, 0);

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleQuickAddProduct(p)}
                          className={`relative p-3 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] hover:shadow-md flex flex-col justify-between min-h-[110px] group ${
                            inCartCount > 0
                              ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-200'
                              : 'border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/20'
                          }`}
                        >
                          {/* Cart badge count */}
                          {inCartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center shadow-md animate-scale">
                              {inCartCount}
                            </span>
                          )}

                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-xs text-gray-900 line-clamp-2 leading-snug">
                                {p.name}
                              </span>
                            </div>

                            {/* Stock badge */}
                            <div>
                              {stock > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Có sẵn {stock} bó
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">
                                  Hết bó sẵn
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 flex items-baseline justify-between">
                            <span className="text-xs md:text-sm font-black text-rose-600">
                              {formatVND(price)}
                            </span>
                            <span className="text-[10px] text-rose-600 font-semibold group-hover:underline">
                              + Chọn
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* B. Remote Orders: Detailed Customer & Delivery info */}
          {channel !== 'tai_tiem' && (
            <div className="space-y-4">
              {/* Customer Info Card */}
              <Card className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-visible">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-rose-500" />
                    <span>Thông tin khách hàng</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="relative" ref={autocompleteContainerRef}>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Tên khách hàng <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="VD: Chị Mai, Anh Đức..."
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      className="h-11 rounded-xl text-sm"
                      autoComplete="off"
                    />

                    {showSuggestions && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-gray-100">
                        {customerSuggestions.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => selectCustomer(cust)}
                            className="p-3 hover:bg-rose-50/50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-gray-900">
                              {cust.name}
                            </span>
                            <span className="text-gray-500">
                              {cust.phone || 'Chưa có SĐT'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-700">
                      Số điện thoại
                    </Label>
                    <Input
                      type="tel"
                      placeholder="09xx xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery info card */}
              <Card className="rounded-2xl border-gray-100 shadow-xs bg-white">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-rose-500" />
                    <span>Hình thức nhận & Giao hàng</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    {DELIVERY_TYPES.map((dt) => {
                      const isSelected = deliveryType === dt.value;
                      return (
                        <button
                          key={dt.value}
                          type="button"
                          onClick={() => setDeliveryType(dt.value)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                            isSelected
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {dt.value === 'pickup' ? (
                            <Store className="w-4 h-4" />
                          ) : (
                            <Truck className="w-4 h-4" />
                          )}
                          <span>{dt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-700">
                        Ngày & Giờ nhận
                      </Label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickDate('today')}
                          className="text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg"
                        >
                          Hôm nay
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('tomorrow')}
                          className="text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg"
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
                        placeholder="0"
                        onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Lines Button for remote order */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-gray-900">
                  Sản phẩm trong đơn ({lines.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDialogOpen(true)}
                  className="rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 h-9 font-semibold text-xs gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Chọn mẫu hoặc Tùy chỉnh</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Real-Time Cart & Fast Checkout Panel (lg:col-span-5 xl:col-span-4) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <Card className="rounded-2xl border-gray-200/90 shadow-sm bg-white overflow-hidden sticky top-20">
            <CardHeader className="p-4 pb-3 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-rose-600" />
                <CardTitle className="text-sm md:text-base font-bold text-gray-900">
                  Giỏ hàng & Thanh toán
                </CardTitle>
              </div>
              <Badge
                variant="secondary"
                className="bg-rose-100 text-rose-800 font-extrabold text-xs px-2 py-0.5 rounded-full"
              >
                {lines.reduce((s, l) => s + l.quantity, 0)} món
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Customer quick bar for in-store sales */}
              {channel === 'tai_tiem' && (
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="text-muted-foreground block text-[10px]">
                      Khách hàng:
                    </span>
                    <span className="font-bold text-gray-900 truncate block">
                      {customerName || 'Khách lẻ tại tiệm'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCustomerInput(!showCustomerInput)}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline shrink-0 ml-2"
                  >
                    {showCustomerInput ? 'Đóng' : 'Đổi tên/SĐT'}
                  </button>
                </div>
              )}

              {/* Optional inline customer name input for in-store sales */}
              {channel === 'tai_tiem' && showCustomerInput && (
                <div className="space-y-2 p-3 bg-rose-50/40 rounded-xl border border-rose-100 text-xs">
                  <div>
                    <Label className="text-[11px] font-semibold text-gray-700">
                      Tên khách hàng
                    </Label>
                    <Input
                      placeholder="Khách lẻ tại tiệm"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-9 rounded-lg text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-gray-700">
                      Số điện thoại (để lưu thông tin)
                    </Label>
                    <Input
                      placeholder="09xx xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-9 rounded-lg text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Order Lines List in Cart */}
              <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                {lines.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-xl bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-600">
                      Chưa chọn sản phẩm nào
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Chạm vào bó hoa bên trái để thêm vào đơn
                    </p>
                  </div>
                ) : (
                  lines.map((line, idx) => (
                    <div
                      key={line.id}
                      className="p-3 rounded-xl border border-gray-100 bg-gray-50/40 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-gray-900 truncate">
                            {line.productName}
                          </p>
                          {/* Stock toggle */}
                          {!line.isCustom && line.productId && (
                            <button
                              type="button"
                              onClick={() => toggleLineFromStock(idx)}
                              className={`text-[10px] mt-1 px-2 py-0.5 rounded border font-medium flex items-center gap-1 transition-colors ${
                                line.fromStock
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  line.fromStock ? 'bg-emerald-500' : 'bg-gray-400'
                                }`}
                              />
                              {line.fromStock
                                ? `Lấy từ hoa có sẵn (còn ${line.productStock ?? 0} bó)`
                                : `Làm mới từ nguyên liệu`}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Stepper & Price */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => updateLineQty(idx, line.quantity - 1)}
                            disabled={line.quantity <= 1}
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-gray-100 text-gray-700 disabled:opacity-30"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-gray-900">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateLineQty(idx, line.quantity + 1)}
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-gray-100 text-gray-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900">
                            {formatVND(line.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Discount & Presets */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-xs font-semibold text-gray-700">
                    Giảm giá (₫)
                  </Label>
                  <div className="flex gap-1">
                    {[10000, 20000, 50000].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiscount(d)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                      >
                        -{formatVND(d)}
                      </button>
                    ))}
                    {discount > 0 && (
                      <button
                        type="button"
                        onClick={() => setDiscount(0)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 font-medium"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="5000"
                  placeholder="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              {/* Payment Method Quick Selector */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Phương thức thanh toán
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Tiền mặt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Quét VietQR</span>
                  </button>
                </div>

                {/* Show QR button if transfer is selected and amount > 0 */}
                {paymentMethod === 'transfer' && totalAmount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQrDialogOpen(true)}
                    className="w-full h-9 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold gap-1.5 mt-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Mở mã VietQR cho khách quét</span>
                  </Button>
                )}
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-50/70 to-pink-50/40 border border-rose-100 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Tạm tính:</span>
                  <span className="font-semibold">{formatVND(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-rose-600">
                    <span>Giảm giá:</span>
                    <span className="font-bold">-{formatVND(discount)}</span>
                  </div>
                )}
                {deliveryType === 'ship' && Number(shippingFee) > 0 && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Phí ship:</span>
                    <span className="font-semibold">+{formatVND(shippingFee)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-rose-200/60 flex items-baseline justify-between">
                  <span className="font-bold text-gray-900 text-sm">
                    Khách cần trả:
                  </span>
                  <span className="text-xl md:text-2xl font-black text-rose-600">
                    {formatVND(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Giant Checkout Action Button: Visible on Desktop Right Column */}
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  disabled={submitting || lines.length === 0}
                  onClick={() => handleSubmit(undefined, true)}
                  className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-base font-bold shadow-md transition-all gap-2"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>
                    {submitting
                      ? 'Đang xử lý...'
                      : channel === 'tai_tiem'
                      ? '⚡ THANH TOÁN & HOÀN THÀNH'
                      : 'TẠO ĐƠN HÀNG'}
                  </span>
                </Button>

                {channel === 'tai_tiem' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting || lines.length === 0}
                    onClick={() => handleSubmit(undefined, false)}
                    className="w-full text-xs text-gray-500 hover:text-gray-900 h-8 rounded-lg"
                  >
                    <span>Lưu đơn chờ lấy sau (Chưa hoàn thành)</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM CHECKOUT BAR: ONLY SHOWN ON SCREENS < lg */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 pb-5 safe-area-bottom z-40 shadow-xl">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-700 px-1">
            <span>
              {lines.reduce((s, l) => s + l.quantity, 0)} bó •{' '}
              {paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản QR'}
            </span>
            <div className="text-right flex items-baseline gap-1.5">
              <span className="text-[11px] text-muted-foreground">Tổng:</span>
              <span className="text-lg font-black text-rose-600">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          <Button
            type="button"
            disabled={submitting || lines.length === 0}
            onClick={() => handleSubmit(undefined, channel === 'tai_tiem')}
            className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-base font-black shadow-md transition-all gap-1.5"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {submitting
                ? 'Đang xử lý...'
                : channel === 'tai_tiem'
                ? '⚡ Thanh toán & Hoàn thành'
                : 'Tạo đơn hàng'}
            </span>
          </Button>
        </div>
      </div>

      {/* Product Selection Dialog with 2 Tabs: Mẫu có sẵn & Tùy chỉnh */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[85vh] flex flex-col p-4">
          <DialogHeader className="p-1 pb-0">
            <DialogTitle className="text-base font-bold text-gray-900">
              {dialogTab === 'custom' ? 'Bó hoa theo yêu cầu riêng' : 'Chọn mẫu hoa'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Định lượng từng cành hoa hoặc chọn mẫu có sẵn
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={dialogTab}
            onValueChange={(val) => setDialogTab(val as 'template' | 'custom')}
            className="w-full flex-1 flex flex-col min-h-0 pt-2"
          >
            <TabsList className="grid grid-cols-2 w-full h-10 rounded-xl bg-gray-100 p-1">
              <TabsTrigger
                value="custom"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-white"
              >
                Bó theo yêu cầu (Định lượng)
              </TabsTrigger>
              <TabsTrigger
                value="template"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-white"
              >
                Mẫu có sẵn ({products.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: TÙY CHỈNH */}
            <TabsContent
              value="custom"
              className="flex-1 overflow-y-auto space-y-3 pt-2 max-h-[55vh]"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Tên sản phẩm tùy chỉnh <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="VD: Bó hoa sáp đỏ 5 bông theo yêu cầu"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Đơn giá bán cho khách (₫) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="5000"
                  placeholder="0"
                  value={customPrice || ''}
                  onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              {/* Material Picker for Custom bouquet */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <Label className="text-xs font-bold text-gray-800">
                  Nguyên vật liệu cấu thành (để trừ kho)
                </Label>

                <div className="grid grid-cols-12 gap-1.5 items-end">
                  <div className="col-span-7">
                    <Select
                      value={pickedMaterialId}
                      onValueChange={setPickedMaterialId}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Chọn vật tư..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name} ({m.baseUnit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0.1"
                      step="1"
                      value={pickedMaterialQty}
                      onChange={(e) => setPickedMaterialQty(Number(e.target.value) || 1)}
                      className="h-9 text-xs rounded-xl text-center"
                    />
                  </div>

                  <div className="col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomMaterial}
                      className="w-full h-9 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 p-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Selected materials list */}
                {selectedMaterials.length > 0 && (
                  <div className="space-y-1 bg-gray-50 p-2 rounded-xl border border-gray-100 text-xs">
                    {selectedMaterials.map((sm, smIdx) => (
                      <div
                        key={sm.materialId}
                        className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0"
                      >
                        <span className="truncate flex-1">
                          {sm.materialName}: <b>{sm.quantity} {sm.baseUnit}</b>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMaterials((prev) =>
                              prev.filter((_, i) => i !== smIdx)
                            )
                          }
                          className="text-gray-400 hover:text-red-500 ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={handleAddCustomLine}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 mt-2"
              >
                Thêm vào đơn hàng
              </Button>
            </TabsContent>

            {/* TAB 2: MẪU CÓ SẴN */}
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
                {filteredProducts.map((p) => {
                  const price = Number(p.suggestedPrice || p.computedPrice) || 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        handleQuickAddProduct(p);
                        setAddDialogOpen(false);
                      }}
                      className="p-3 rounded-xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50/40 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-gray-900 truncate">
                          {p.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {(p.stock ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                              🌸 Có sẵn {p.stock} bó tại tiệm
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              Chưa có bó sẵn
                            </span>
                          )}
                        </div>
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
                })}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog for in-store transfer payments */}
      <PaymentQrDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        orderCode={`DF-QUAY-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`}
        amount={totalAmount}
        customerName={customerName || 'Khách lẻ tại tiệm'}
        onPaymentSuccess={() => {
          setQrDialogOpen(false);
          setPaymentStatus('paid');
          toast.success('Đã xác nhận thanh toán chuyển khoản!');
        }}
      />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Đang tải biểu mẫu bán hàng...</div>}>
      <NewOrderForm />
    </Suspense>
  );
}
