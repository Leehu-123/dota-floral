'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Truck,
  Sparkles,
  Save,
  Building2,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatVND, formatQty } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  currentStock: number;
  avgCost: number;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
}

interface PurchaseLineForm {
  materialId: string;
  quantity: string;
  unitPrice: string;
}

export default function NewPurchasePage() {
  const router = useRouter();

  // Basic Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [note, setNote] = useState('');

  // Supplier Autocomplete
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  // Materials list for dropdown
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  // Lines
  const [lines, setLines] = useState<PurchaseLineForm[]>([
    { materialId: '', quantity: '1', unitPrice: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);

  // Load materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoadingMaterials(true);
        const res = await fetch('/api/materials');
        if (!res.ok) throw new Error('Không thể tải danh sách nguyên liệu');
        const data = await res.json();
        setMaterials(data);
      } catch (err: any) {
        console.error(err);
        toast.error('Lỗi khi tải danh sách nguyên liệu');
      } finally {
        setLoadingMaterials(false);
      }
    };

    fetchMaterials();
  }, []);

  // Search suppliers debounce
  useEffect(() => {
    if (!supplierName.trim()) {
      setSupplierSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suppliers?search=${encodeURIComponent(supplierName.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSupplierSuggestions(data);
        }
      } catch (err) {
        // Silently fail autocomplete
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [supplierName]);

  // Handle line changes
  const handleLineChange = (
    index: number,
    field: keyof PurchaseLineForm,
    value: string
  ) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { materialId: '', quantity: '1', unitPrice: '' },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.info('Phiếu nhập hàng cần ít nhất 1 dòng nguyên liệu');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const material = materials.find((m) => m.id === line.materialId);
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const lineTotal = Math.round(qty * price);
      const convFactor = material ? Number(material.conversionFactor) : 1;
      const convertedQty = qty * convFactor;

      return {
        ...line,
        material,
        numQty: qty,
        numPrice: price,
        lineTotal,
        convertedQty,
      };
    });
  }, [lines, materials]);

  const subtotal = useMemo(() => {
    return calculatedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  }, [calculatedLines]);

  const numShipping = parseFloat(shippingCost) || 0;
  const grandTotal = subtotal + numShipping;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      toast.error('Vui lòng nhập tên nhà cung cấp');
      supplierInputRef.current?.focus();
      return;
    }

    if (!date) {
      toast.error('Vui lòng chọn ngày nhập hàng');
      return;
    }

    if (lines.length === 0) {
      toast.error('Vui lòng thêm ít nhất một mặt hàng');
      return;
    }

    // Validate lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.materialId) {
        toast.error(`Dòng ${i + 1}: Vui lòng chọn nguyên liệu`);
        return;
      }
      const qty = parseFloat(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0`);
        return;
      }
      const price = parseFloat(line.unitPrice);
      if (isNaN(price) || price < 0) {
        toast.error(`Dòng ${i + 1}: Đơn giá không được âm`);
        return;
      }
    }

    if (numShipping < 0) {
      toast.error('Chi phí vận chuyển không được âm');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        date,
        supplierName: supplierName.trim(),
        shippingCost: numShipping,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          materialId: l.materialId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
        })),
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tạo phiếu nhập hàng');
      }

      toast.success('Đã tạo phiếu nhập hàng thành công');
      router.push(`/purchases/${data.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Không thể tạo phiếu nhập hàng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-32">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Hủy & Quay lại</span>
        </button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Tạo phiếu nhập hàng</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ghi nhận mua nguyên liệu, cập nhật tồn kho & giá vốn tự động
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General Info Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                Ngày nhập hàng <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Supplier with Autocomplete */}
            <div className="space-y-1.5 relative">
              <Label
                htmlFor="supplierName"
                className="text-sm font-medium text-gray-700 flex items-center justify-between"
              >
                <span>
                  Nhà cung cấp <span className="text-red-500">*</span>
                </span>
                {supplierName.trim() && (
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (tự động lưu nếu là NCC mới)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  ref={supplierInputRef}
                  id="supplierName"
                  value={supplierName}
                  onChange={(e) => {
                    setSupplierName(e.target.value);
                    setShowSupplierSuggestions(true);
                  }}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => {
                    // Small delay to allow click on suggestions
                    setTimeout(() => setShowSupplierSuggestions(false), 200);
                  }}
                  placeholder="VD: Tổng kho Hoa Sáp Sài Gòn"
                  className="h-11 rounded-xl"
                  required
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {supplierSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3.5 py-2.5 hover:bg-rose-50 text-xs text-gray-800 flex items-center justify-between transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSupplierName(s.name);
                        setShowSupplierSuggestions(false);
                      }}
                    >
                      <span className="font-medium text-gray-900">{s.name}</span>
                      {s.phone && (
                        <span className="text-muted-foreground text-[11px]">
                          {s.phone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shipping Cost */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="shippingCost"
                  className="text-sm font-medium text-gray-700"
                >
                  Phí vận chuyển (₫)
                </Label>
                <span className="text-xs text-rose-600 font-semibold">
                  {formatVND(numShipping)}
                </span>
              </div>
              <Input
                id="shippingCost"
                type="number"
                step="1000"
                min="0"
                inputMode="numeric"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-sm font-medium text-gray-700">
                Ghi chú đơn nhập
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Số hóa đơn đỏ, ghi chú thanh toán..."
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-gray-900">Danh sách vật tư</h2>
            <span className="text-xs text-muted-foreground">
              {lines.length} mặt hàng
            </span>
          </div>

          {lines.map((line, idx) => {
            const calc = calculatedLines[idx];
            const mat = calc.material;

            return (
              <Card
                key={idx}
                className="rounded-2xl border-gray-200/90 shadow-xs bg-white overflow-hidden"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Line Header: Index + Remove Button */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                      Mặt hàng #{idx + 1}
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Material Select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      Chọn nguyên liệu <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={line.materialId}
                      onValueChange={(val) =>
                        handleLineChange(idx, 'materialId', val)
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Chọn nguyên liệu nhập..." />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.purchaseUnit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity & Unit Price Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">
                        Số lượng ({mat ? mat.purchaseUnit : 'nhập'})
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.0001"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(idx, 'quantity', e.target.value)
                        }
                        placeholder="1"
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">
                        Đơn giá /{mat ? mat.purchaseUnit : 'đv'} (₫)
                      </Label>
                      <Input
                        type="number"
                        step="500"
                        min="0"
                        inputMode="numeric"
                        value={line.unitPrice}
                        onChange={(e) =>
                          handleLineChange(idx, 'unitPrice', e.target.value)
                        }
                        placeholder="0"
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  {/* Calculations Preview */}
                  {mat && (
                    <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          Quy đổi tồn kho:
                        </span>
                        <span className="font-semibold text-gray-800">
                          {formatQty(calc.convertedQty)} {mat.baseUnit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block">
                          Thành tiền:
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {formatVND(calc.lineTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add Line Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl border-dashed border-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 gap-1.5"
            onClick={handleAddLine}
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nguyên liệu</span>
          </Button>
        </div>

        {/* Sticky Bottom Summary Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 pb-4 md:pb-3 safe-area-bottom z-40 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Tổng thanh toán ({lines.length} mặt hàng)
              </p>
              <p className="text-lg font-black text-rose-600">
                {formatVND(grandTotal)}
              </p>
            </div>

            <Button
              type="submit"
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5 shadow-sm px-6"
              disabled={submitting}
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Đang lưu...' : 'Lưu phiếu nhập'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
