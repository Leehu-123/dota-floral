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
  Search,
  X,
  Layers,
  Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatVND, formatQty } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { normalizeVietnamese } from '@/lib/utils';
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
  unitPrice: string; // Stored in "ngàn đồng" (e.g. "15" = 15.000đ, "2.5" = 2.500đ)
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

  // Materials list
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  // Search Material Modal State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeLineIndexForSearch, setActiveLineIndexForSearch] = useState<number | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Lines state
  const [lines, setLines] = useState<PurchaseLineForm[]>([
    { materialId: '', quantity: '', unitPrice: '' },
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
      { materialId: '', quantity: '', unitPrice: '' },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.info('Phiếu nhập hàng cần ít nhất 1 dòng nguyên liệu');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Open Search Material Modal for a line
  const handleOpenSearchModal = (lineIndex: number) => {
    setActiveLineIndexForSearch(lineIndex);
    setMaterialSearchQuery('');
    setSelectedGroupFilter('all');
    setSearchModalOpen(true);
  };

  // Select Material from Modal
  const handleSelectMaterial = (material: Material) => {
    if (activeLineIndexForSearch === null) return;
    const idx = activeLineIndexForSearch;

    setLines((prev) => {
      const next = [...prev];
      const currentLine = next[idx];

      // If unit price is empty, suggest previous price or avgCost in "ngàn đồng"
      let suggestedPrice = currentLine.unitPrice;
      if (!suggestedPrice && material.avgCost > 0) {
        const costInNgàn = Math.round(
          (material.avgCost * material.conversionFactor) / 1000
        );
        if (costInNgàn > 0) {
          suggestedPrice = String(costInNgàn);
        }
      }

      next[idx] = {
        ...currentLine,
        materialId: material.id,
        unitPrice: suggestedPrice,
      };
      return next;
    });

    setSearchModalOpen(false);
  };

  // Filtered materials inside modal
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Group filter
      if (selectedGroupFilter !== 'all' && m.group !== selectedGroupFilter) {
        return false;
      }
      // Search query
      if (materialSearchQuery.trim()) {
        const q = normalizeVietnamese(materialSearchQuery.trim());
        const normName = normalizeVietnamese(m.name);
        const normBaseUnit = normalizeVietnamese(m.baseUnit);
        const normPurchaseUnit = normalizeVietnamese(m.purchaseUnit);
        return (
          normName.includes(q) ||
          normBaseUnit.includes(q) ||
          normPurchaseUnit.includes(q)
        );
      }
      return true;
    });
  }, [materials, selectedGroupFilter, materialSearchQuery]);

  // Calculations
  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const material = materials.find((m) => m.id === line.materialId);
      const qty = line.quantity
        ? parseFloat(line.quantity.replace(',', '.')) || 0
        : 0;
      // Parse unit price in "ngàn đồng" -> multiply by 1,000 for VND
      const rawPrice = line.unitPrice
        ? parseFloat(line.unitPrice.replace(',', '.'))
        : 0;
      const priceInVND = isNaN(rawPrice) ? 0 : Math.round(rawPrice * 1000);
      const lineTotal = Math.round(qty * priceInVND);
      const convFactor = material ? Number(material.conversionFactor) : 1;
      const convertedQty = qty * convFactor;

      return {
        ...line,
        material,
        numQty: qty,
        numPriceVND: priceInVND,
        rawPrice,
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
        toast.error(`Mặt hàng #${i + 1}: Vui lòng chọn nguyên liệu`);
        return;
      }
      if (!line.quantity.trim()) {
        toast.error(`Mặt hàng #${i + 1}: Vui lòng nhập số lượng`);
        return;
      }
      const qty = parseFloat(line.quantity.replace(',', '.'));
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Mặt hàng #${i + 1}: Số lượng nhập phải lớn hơn 0`);
        return;
      }
      const rawPrice = parseFloat(line.unitPrice.replace(',', '.'));
      if (isNaN(rawPrice) || rawPrice < 0) {
        toast.error(`Mặt hàng #${i + 1}: Vui lòng nhập đơn giá`);
        return;
      }
    }

    if (numShipping < 0) {
      toast.error('Chi phí vận chuyển không được âm');
      return;
    }

    try {
      setSubmitting(true);
      // Unit price sent to backend in VND (multiplied by 1000)
      const payload = {
        date,
        supplierName: supplierName.trim(),
        shippingCost: numShipping,
        note: note.trim() || undefined,
        lines: lines.map((l) => {
          const rawPrice = parseFloat(l.unitPrice.replace(',', '.')) || 0;
          const unitPriceVND = Math.round(rawPrice * 1000);
          const qty = parseFloat(l.quantity.replace(',', '.')) || 0;
          return {
            materialId: l.materialId,
            quantity: qty,
            unitPrice: unitPriceVND,
          };
        }),
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
      console.error('Error creating purchase:', err);
      toast.error(err.message || 'Không thể tạo phiếu nhập hàng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-36">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-bold text-purple-900 hover:text-purple-950 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-purple-700" />
          <span>Hủy & Quay lại</span>
        </button>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-black text-purple-950">
          Tạo phiếu nhập hàng
        </h1>
        <p className="text-xs text-purple-800 font-semibold mt-0.5">
          Ghi nhận mua nguyên liệu, cập nhật tồn kho & giá vốn tự động
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General Info Card */}
        <Card className="rounded-2xl border-purple-200/80 shadow-xs bg-white">
          <CardContent className="p-4 space-y-4">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs font-bold text-gray-800">
                Ngày nhập hàng <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-xl font-medium focus-visible:ring-purple-500"
                />
              </div>
            </div>

            {/* Supplier with Autocomplete */}
            <div className="space-y-1.5 relative">
              <Label
                htmlFor="supplierName"
                className="text-xs font-bold text-gray-800 flex items-center justify-between"
              >
                <span>
                  Nhà cung cấp <span className="text-red-500">*</span>
                </span>
                {supplierName.trim() && (
                  <span className="text-[11px] text-purple-700 font-bold">
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
                    setTimeout(() => setShowSupplierSuggestions(false), 200);
                  }}
                  placeholder="VD: Tổng kho Hoa Sáp Sài Gòn, Chợ hoa Quảng Bá..."
                  className="h-11 rounded-xl font-medium focus-visible:ring-purple-500"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-purple-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-purple-50">
                  {supplierSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3.5 py-2.5 hover:bg-purple-50 text-xs text-gray-800 flex items-center justify-between transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSupplierName(s.name);
                        setShowSupplierSuggestions(false);
                      }}
                    >
                      <span className="font-bold text-purple-950">{s.name}</span>
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
                  className="text-xs font-bold text-gray-800"
                >
                  Phí vận chuyển (₫)
                </Label>
                <span className="text-xs text-purple-800 font-bold">
                  {formatVND(numShipping)}
                </span>
              </div>
              <Input
                id="shippingCost"
                type="number"
                min="0"
                inputMode="numeric"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0"
                className="h-11 rounded-xl font-medium focus-visible:ring-purple-500"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs font-bold text-gray-800">
                Ghi chú đơn nhập
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Số hóa đơn, đợt hoa lễ 20/10, ghi chú thanh toán..."
                rows={2}
                className="rounded-xl resize-none text-sm font-medium focus-visible:ring-purple-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-purple-950">
              Danh sách vật tư
            </h2>
            <span className="text-xs font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
              {lines.length} mặt hàng
            </span>
          </div>

          {lines.map((line, idx) => {
            const calc = calculatedLines[idx];
            const mat = calc.material;

            return (
              <Card
                key={idx}
                className="rounded-2xl border-purple-200/90 shadow-xs bg-white overflow-hidden"
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Line Header: Index + Remove Button */}
                  <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                    <span className="text-xs font-black text-purple-950 bg-[#d4c8ee]/70 px-2.5 py-0.5 rounded-lg">
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

                  {/* Material Search & Selector Button */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-800">
                      Nguyên liệu nhập <span className="text-red-500">*</span>
                    </Label>

                    {mat ? (
                      /* Display Selected Material Card with Quick Change */
                      <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/60 flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-purple-950 text-sm truncate">
                              {mat.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="bg-[#d4c8ee] text-purple-950 text-[10px] font-bold px-2 py-0"
                            >
                              {getLabel(MATERIAL_GROUPS, mat.group)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-purple-900 font-medium">
                            Đơn vị mua: <strong className="text-purple-950">{mat.purchaseUnit}</strong>{' '}
                            • Quy đổi: 1 {mat.purchaseUnit} ={' '}
                            <strong>
                              {mat.conversionFactor} {mat.baseUnit}
                            </strong>{' '}
                            • Tồn kho:{' '}
                            <strong>
                              {formatQty(mat.currentStock)} {mat.baseUnit}
                            </strong>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSearchModal(idx)}
                          className="rounded-lg h-8 px-2.5 border-purple-300 text-purple-900 hover:bg-purple-100 text-xs font-bold shrink-0 gap-1"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Đổi</span>
                        </Button>
                      </div>
                    ) : (
                      /* Prompt to Search & Pick Material */
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenSearchModal(idx)}
                        className="w-full h-12 rounded-xl border-dashed border-2 border-purple-300 bg-purple-50/40 hover:bg-purple-100/60 text-purple-900 font-bold text-sm justify-between px-3.5"
                      >
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-purple-700" />
                          <span>Chạm để tìm & chọn nguyên liệu...</span>
                        </div>
                        <span className="text-xs text-purple-700 font-normal">
                          (156 vật tư)
                        </span>
                      </Button>
                    )}
                  </div>

                  {/* Quantity & Unit Price Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-800">
                        Số lượng ({mat ? mat.purchaseUnit : 'nhập'}){' '}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(idx, 'quantity', e.target.value)
                        }
                        placeholder="Nhập SL"
                        className="h-11 rounded-xl font-bold text-gray-900 focus-visible:ring-purple-500"
                      />
                    </div>

                    {/* Unit Price in NGÀN ĐỒNG */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-gray-800">
                          Đơn giá ({mat ? `k/${mat.purchaseUnit}` : 'k ₫'}){' '}
                          <span className="text-red-500">*</span>
                        </Label>
                        <span className="text-[11px] font-bold text-purple-800">
                          {line.unitPrice
                            ? `= ${formatVND(calc.numPriceVND)}`
                            : 'Nhập ngàn đ'}
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(e) =>
                            handleLineChange(idx, 'unitPrice', e.target.value)
                          }
                          placeholder="VD: 15 hoặc 2.5"
                          className="h-11 rounded-xl font-black text-gray-900 pr-12 text-base focus-visible:ring-purple-500"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-purple-950 bg-[#d4c8ee] px-2 py-0.5 rounded-md pointer-events-none">
                          k ₫
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning button if user typed full VND instead of ngàn (e.g. 15000 instead of 15) */}
                  {calc.rawPrice >= 1000 && (
                    <button
                      type="button"
                      onClick={() => {
                        const corrected = (calc.rawPrice / 1000).toString();
                        handleLineChange(idx, 'unitPrice', corrected);
                      }}
                      className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-left block w-full hover:bg-amber-100 transition-colors"
                    >
                      ⚠️ Đang tính:{' '}
                      <strong>{formatVND(calc.rawPrice * 1000)}</strong>. Có phải ý
                      bạn là{' '}
                      <strong>{formatVND(calc.rawPrice)}</strong>?{' '}
                      <span className="text-purple-700 underline font-bold">
                        [Chạm để sửa thành {calc.rawPrice / 1000}k]
                      </span>
                    </button>
                  )}

                  {/* Calculations Preview */}
                  {mat && (
                    <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[11px] text-purple-800 font-semibold block">
                          Quy đổi nhập kho:
                        </span>
                        <span className="font-bold text-purple-950 text-sm">
                          {formatQty(calc.convertedQty)} {mat.baseUnit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-purple-800 font-semibold block">
                          Thành tiền dòng này:
                        </span>
                        <span className="font-black text-purple-950 text-base">
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
            className="w-full h-12 rounded-xl border-dashed border-2 border-purple-300 text-purple-900 hover:bg-purple-50 hover:border-purple-400 gap-1.5 font-bold shadow-xs"
            onClick={handleAddLine}
          >
            <Plus className="w-4 h-4 text-purple-700" />
            <span>Thêm dòng nguyên liệu</span>
          </Button>
        </div>

        {/* Sticky Bottom Summary Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-purple-200/80 p-3 pb-4 md:pb-3 safe-area-bottom z-40 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-purple-800 font-bold">
                Tổng thanh toán ({lines.length} mặt hàng)
              </p>
              <p className="text-lg md:text-xl font-black text-purple-950">
                {formatVND(grandTotal)}
              </p>
            </div>

            <Button
              type="submit"
              className="h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black gap-1.5 shadow-md px-6 active:scale-95 transition-transform"
              disabled={submitting}
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Đang lưu...' : 'Lưu phiếu nhập'}
            </Button>
          </div>
        </div>
      </form>

      {/* SEARCH MATERIAL MODAL */}
      <Dialog open={searchModalOpen} onOpenChange={setSearchModalOpen}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b border-purple-100">
            <DialogTitle className="text-base font-black text-purple-950 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-600" />
              <span>Tìm & chọn nguyên liệu nhập</span>
            </DialogTitle>
          </DialogHeader>

          {/* Search Input Bar */}
          <div className="p-4 pt-3 pb-2 space-y-3 border-b border-purple-100 bg-purple-50/40">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-600 pointer-events-none" />
              <Input
                autoFocus
                type="text"
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                placeholder="Tìm theo tên (VD: hồng, ly, xốp, giấy...)"
                className="h-11 pl-9 pr-9 rounded-xl border-purple-200 bg-white font-medium focus-visible:ring-purple-500"
              />
              {materialSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMaterialSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedGroupFilter('all')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-bold transition-colors ${
                  selectedGroupFilter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                Tất cả ({materials.length})
              </button>
              {MATERIAL_GROUPS.map((g) => {
                const count = materials.filter((m) => m.group === g.value).length;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setSelectedGroupFilter(g.value)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-bold transition-colors ${
                      selectedGroupFilter === g.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {g.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto divide-y divide-purple-50 p-2">
            {loadingMaterials ? (
              <div className="p-8 text-center text-sm text-purple-700 font-medium">
                Đang tải danh sách nguyên liệu...
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-bold text-gray-700">
                  Không tìm thấy nguyên liệu nào khớp
                </p>
                <p className="text-xs text-muted-foreground">
                  Thử tìm từ khóa khác hoặc chuyển danh mục
                </p>
              </div>
            ) : (
              filteredMaterials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMaterial(m)}
                  className="w-full text-left p-3 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                        {m.name}
                      </span>
                      <span className="text-[10px] font-bold bg-[#d4c8ee]/60 text-purple-950 px-2 py-0.2 rounded-md">
                        {getLabel(MATERIAL_GROUPS, m.group)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-3 flex-wrap">
                      <span>
                        Đơn vị mua: <strong className="text-gray-700">{m.purchaseUnit}</strong>
                      </span>
                      <span>
                        Quy đổi: 1 {m.purchaseUnit} ={' '}
                        <strong className="text-gray-700">
                          {m.conversionFactor} {m.baseUnit}
                        </strong>
                      </span>
                      <span>
                        Tồn: <strong className="text-gray-700">{formatQty(m.currentStock)} {m.baseUnit}</strong>
                      </span>
                      {m.avgCost > 0 && (
                        <span className="text-purple-700 font-bold">
                          Giá vốn: {formatVND(m.avgCost)}/{m.baseUnit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-purple-700 font-bold text-xs bg-purple-100 group-hover:bg-purple-600 group-hover:text-white px-2.5 py-1.5 rounded-lg transition-colors">
                    Chọn
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
