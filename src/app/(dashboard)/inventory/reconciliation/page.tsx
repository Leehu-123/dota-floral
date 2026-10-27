'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Calculator,
  Package,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatVND, formatQty } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';

/* ──────────────── Types ──────────────── */

interface ReconciliationItem {
  tempId: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: string;
  purchaseQty: string;
  unitPrice: string;
  actualStock: string;
}

interface SummaryItem {
  name: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseQty: number;
  unitPrice: number;
  initialStock: number;
  actualStock: number;
  usedQty: number;
  unitCost: number;
  purchaseCost: number;
  usedCost: number;
  currentValue: number;
}

interface ReconciliationResult {
  purchaseId: string;
  periodName: string;
  summary: {
    totalPurchaseCost: number;
    totalCurrentValue: number;
    totalUsedCost: number;
    shippingCost: number;
    itemCount: number;
    items: SummaryItem[];
  };
}

/* ──────────────── Presets ──────────────── */

const MATERIAL_PRESETS: Omit<
  ReconciliationItem,
  'tempId' | 'purchaseQty' | 'unitPrice' | 'actualStock'
>[] = [
  { name: 'Hoa sáp hồng đỏ', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: '50' },
  { name: 'Hoa sáp hồng phấn', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: '50' },
  { name: 'Hoa sáp trắng', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: '50' },
  { name: 'Hoa sáp vàng', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: '50' },
  { name: 'Hoa lụa hồng pastel', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Hoa lụa trắng', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Hoa lụa lavender', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Cốt hoa tròn', group: 'cot_hoa', baseUnit: 'cái', purchaseUnit: 'cái', conversionFactor: '1' },
  { name: 'Cốt hoa dài', group: 'cot_hoa', baseUnit: 'cái', purchaseUnit: 'cái', conversionFactor: '1' },
  { name: 'Giấy bọc trắng', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Giấy bọc hồng', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Giấy bọc kraft', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: '20' },
  { name: 'Nơ satin hồng', group: 'phu_kien', baseUnit: 'cái', purchaseUnit: 'gói', conversionFactor: '50' },
  { name: 'Băng dính hoa', group: 'vat_tu_khac', baseUnit: 'm', purchaseUnit: 'cuộn', conversionFactor: '25' },
  { name: 'Keo nến', group: 'vat_tu_khac', baseUnit: 'thanh', purchaseUnit: 'gói', conversionFactor: '20' },
];

/* ──────────────── Helpers ──────────────── */

let _counter = 0;
const newTempId = () => `t-${++_counter}-${Date.now()}`;

const createEmptyItem = (): ReconciliationItem => ({
  tempId: newTempId(),
  name: '',
  group: 'hoa_sap',
  baseUnit: '',
  purchaseUnit: '',
  conversionFactor: '1',
  purchaseQty: '',
  unitPrice: '',
  actualStock: '',
});

const n = (v: string) => {
  const num = parseFloat(v);
  return isNaN(num) ? 0 : num;
};

function calcItem(item: ReconciliationItem) {
  const factor = n(item.conversionFactor);
  const qty = n(item.purchaseQty);
  const price = n(item.unitPrice);
  const actual = n(item.actualStock);

  const initialStock = qty * factor;
  const lineTotal = Math.round(qty * price);
  const unitCost = initialStock > 0 ? lineTotal / initialStock : 0;
  const usedQty = Math.max(0, initialStock - actual);
  const usedCost = Math.round(usedQty * unitCost);
  const currentValue = Math.round(actual * unitCost);

  return { initialStock, lineTotal, unitCost, usedQty, usedCost, currentValue };
}

/* ──────────────── Component ──────────────── */

export default function ReconciliationPage() {
  const router = useRouter();

  // ── Form state ──
  const [periodName, setPeriodName] = useState('Đợt 20/10');
  const [date, setDate] = useState('2026-10-20');
  const [supplierName, setSupplierName] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [showPresets, setShowPresets] = useState(true);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  // ── Summary calculations ──
  const summary = useMemo(() => {
    const calculated = items.map(calcItem);
    return {
      totalPurchaseCost:
        calculated.reduce((s, c) => s + c.lineTotal, 0) + n(shippingCost),
      totalCurrentValue: calculated.reduce((s, c) => s + c.currentValue, 0),
      totalUsedCost: calculated.reduce((s, c) => s + c.usedCost, 0),
      itemCount: items.length,
      allValid:
        items.length > 0 &&
        items.every(
          (item) =>
            item.name.trim() &&
            item.baseUnit.trim() &&
            item.purchaseUnit.trim() &&
            n(item.conversionFactor) > 0 &&
            n(item.purchaseQty) > 0 &&
            n(item.unitPrice) > 0,
        ),
    };
  }, [items, shippingCost]);

  // ── Handlers ──
  const updateItem = useCallback(
    (tempId: string, field: keyof ReconciliationItem, value: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.tempId === tempId ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback((tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }, []);

  const addEmptyItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const addPreset = useCallback(
    (preset: (typeof MATERIAL_PRESETS)[0]) => {
      // Kiểm tra trùng tên
      if (items.some((item) => item.name === preset.name)) {
        toast.info(`"${preset.name}" đã có trong danh sách`);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          tempId: newTempId(),
          ...preset,
          purchaseQty: '',
          unitPrice: '',
          actualStock: '',
        },
      ]);
    },
    [items],
  );

  const addAllPresets = useCallback(() => {
    const existingNames = new Set(items.map((i) => i.name));
    const newItems = MATERIAL_PRESETS.filter(
      (p) => !existingNames.has(p.name),
    ).map((preset) => ({
      tempId: newTempId(),
      ...preset,
      purchaseQty: '',
      unitPrice: '',
      actualStock: '',
    }));
    if (newItems.length === 0) {
      toast.info('Tất cả nguyên liệu phổ biến đã có trong danh sách');
      return;
    }
    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Đã thêm ${newItems.length} nguyên liệu`);
    setShowPresets(false);
  }, [items]);

  const handleSubmit = async () => {
    if (!summary.allValid) {
      toast.error('Vui lòng nhập đầy đủ thông tin cho tất cả nguyên liệu');
      return;
    }
    if (!periodName.trim()) {
      toast.error('Vui lòng nhập tên đợt bán');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        periodName: periodName.trim(),
        date,
        supplierName: supplierName.trim() || undefined,
        shippingCost: n(shippingCost),
        note: note.trim() || undefined,
        items: items.map((item) => ({
          name: item.name.trim(),
          group: item.group,
          baseUnit: item.baseUnit.trim(),
          purchaseUnit: item.purchaseUnit.trim(),
          conversionFactor: n(item.conversionFactor),
          purchaseQty: n(item.purchaseQty),
          unitPrice: n(item.unitPrice),
          actualStock: n(item.actualStock),
        })),
      };

      const res = await fetch('/api/inventory/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể lưu cân đối');
      }

      const data = await res.json();
      setResult(data);
      toast.success('Cân đối kho thành công! 🌸');
    } catch (err: any) {
      console.error('Submit reconciliation error:', err);
      toast.error(err.message || 'Lỗi khi lưu cân đối');
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════
  //  KẾT QUẢ SAU KHI LƯU
  // ════════════════════════════════════════════
  if (result) {
    const { summary: s } = result;
    return (
      <div className="space-y-4 pb-32">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/inventory')}
            className="rounded-xl h-9 w-9 p-0 text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Kết quả cân đối
            </h1>
            <p className="text-xs text-muted-foreground">
              {result.periodName}
            </p>
          </div>
        </div>

        {/* ── Tổng hợp ── */}
        <Card className="rounded-2xl border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Tổng hợp giá vốn đợt bán
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/70 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  Tiền nhập
                </p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatVND(s.totalPurchaseCost)}
                </p>
              </div>
              <div className="bg-white/70 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  Tồn cuối
                </p>
                <p className="text-sm font-bold text-blue-700 mt-0.5">
                  {formatVND(s.totalCurrentValue)}
                </p>
              </div>
              <div className="bg-white/70 rounded-xl p-2.5 ring-2 ring-rose-200">
                <p className="text-[10px] text-rose-600 uppercase tracking-wide font-semibold">
                  Giá vốn
                </p>
                <p className="text-sm font-bold text-rose-700 mt-0.5">
                  {formatVND(s.totalUsedCost)}
                </p>
              </div>
            </div>
            {s.shippingCost > 0 && (
              <p className="text-[11px] text-gray-500 text-center">
                Đã bao gồm phí vận chuyển: {formatVND(s.shippingCost)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Chi tiết từng NVL ── */}
        <h3 className="text-sm font-semibold text-gray-700 px-1">
          Chi tiết {s.itemCount} nguyên liệu
        </h3>
        {s.items.map((item, idx) => {
          const usedPct =
            item.initialStock > 0
              ? Math.round((item.usedQty / item.initialStock) * 100)
              : 0;
          return (
            <Card key={idx} className="rounded-xl border-gray-100">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {item.name}
                  </h4>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-gray-100 text-gray-600"
                  >
                    Dùng {usedPct}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400">Nhập</p>
                    <p className="font-semibold text-gray-700">
                      {formatQty(item.initialStock)}{' '}
                      <span className="text-[10px] font-normal text-gray-400">
                        {item.baseUnit}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatVND(item.purchaseCost)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-blue-500">Tồn</p>
                    <p className="font-semibold text-blue-700">
                      {formatQty(item.actualStock)}{' '}
                      <span className="text-[10px] font-normal text-blue-400">
                        {item.baseUnit}
                      </span>
                    </p>
                    <p className="text-[10px] text-blue-400 mt-0.5">
                      {formatVND(item.currentValue)}
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-rose-500">Đã dùng</p>
                    <p className="font-semibold text-rose-700">
                      {formatQty(item.usedQty)}{' '}
                      <span className="text-[10px] font-normal text-rose-400">
                        {item.baseUnit}
                      </span>
                    </p>
                    <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                      {formatVND(item.usedCost)}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 text-right">
                  Đơn giá: {formatVND(item.unitCost)}/{item.baseUnit}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {/* ── Actions ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 safe-area-bottom z-50">
          <div className="max-w-lg mx-auto flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-12"
              onClick={() => router.push('/purchases')}
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Xem phiếu nhập
            </Button>
            <Button
              className="flex-1 rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => router.push('/inventory')}
            >
              <Package className="w-4 h-4 mr-1.5" />
              Về trang Kho
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  //  FORM NHẬP LIỆU
  // ════════════════════════════════════════════
  return (
    <div className="space-y-4 pb-36">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl h-9 w-9 p-0 text-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Cân đối kho sau đợt bán
          </h1>
          <p className="text-xs text-muted-foreground">
            Nhập tồn đầu kỳ (hóa đơn) → tồn cuối kỳ (kiểm kê) → tính giá vốn
          </p>
        </div>
      </div>

      {/* ── Hướng dẫn nhanh ── */}
      <Card className="rounded-xl border-amber-200 bg-amber-50/50">
        <CardContent className="p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">📋 Hướng dẫn:</span> Mở hóa đơn nhập hàng
            ra, nhập <b>số lượng mua</b> và <b>đơn giá</b> cho từng nguyên liệu.
            Sau đó kiểm kê thực tế và nhập <b>tồn còn lại</b>. Hệ thống sẽ tự
            tính giá vốn nguyên liệu đã sử dụng trong đợt bán.
          </p>
        </CardContent>
      </Card>

      {/* ── Thông tin đợt bán ── */}
      <Card className="rounded-xl border-gray-100 shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-gray-50">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-rose-600" />
            Thông tin đợt bán
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Tên đợt
              </Label>
              <Input
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="VD: Đợt 20/10, 8/3, Tết..."
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Ngày nhập hàng
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Nhà cung cấp{' '}
                <span className="font-normal text-gray-400">(tùy chọn)</span>
              </Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="VD: Shop Hoa Sáp HN"
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Phí vận chuyển
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0"
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Ghi chú{' '}
              <span className="font-normal text-gray-400">(tùy chọn)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Cân đối kho sau đợt bán 20/10..."
              rows={2}
              className="rounded-xl text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Thêm nhanh NVL phổ biến ── */}
      <Card className="rounded-xl border-gray-100 shadow-xs">
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="w-full p-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-900">
              Thêm nhanh nguyên liệu phổ biến
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {MATERIAL_PRESETS.length} mẫu
            </Badge>
          </div>
          {showPresets ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {showPresets && (
          <CardContent className="px-3 pb-3 pt-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {MATERIAL_PRESETS.map((preset) => {
                const added = items.some((i) => i.name === preset.name);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    disabled={added}
                    onClick={() => addPreset(preset)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                      added
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 active:scale-95'
                    }`}
                  >
                    {added ? '✓ ' : '+ '}
                    {preset.name}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addAllPresets}
              className="w-full rounded-xl text-xs h-9 border-dashed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Thêm tất cả nguyên liệu phổ biến
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Danh sách nguyên liệu ── */}
      {items.length > 0 && (
        <h3 className="text-sm font-semibold text-gray-700 px-1 flex items-center gap-2">
          <Package className="w-4 h-4 text-rose-500" />
          Nguyên liệu ({items.length})
        </h3>
      )}

      {items.map((item, idx) => {
        const calc = calcItem(item);
        const hasData =
          n(item.purchaseQty) > 0 && n(item.unitPrice) > 0;
        const hasActual = item.actualStock !== '';

        return (
          <Card
            key={item.tempId}
            className="rounded-xl border-gray-100 shadow-xs overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500">
                #{idx + 1}
              </span>
              <span className="text-xs font-semibold text-gray-700 flex-1 text-center truncate px-2">
                {item.name || 'Nguyên liệu mới'}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.tempId)}
                className="text-gray-400 hover:text-red-500 active:scale-90 p-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <CardContent className="p-3 space-y-3">
              {/* Tên & Nhóm */}
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Tên nguyên liệu
                  </Label>
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      updateItem(item.tempId, 'name', e.target.value)
                    }
                    placeholder="VD: Hoa sáp hồng đỏ"
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Nhóm
                  </Label>
                  <Select
                    value={item.group}
                    onValueChange={(val) =>
                      updateItem(item.tempId, 'group', val)
                    }
                  >
                    <SelectTrigger className="h-9 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_GROUPS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Đơn vị */}
              <div className="grid grid-cols-7 gap-2 items-end">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    ĐVT mua
                  </Label>
                  <Input
                    value={item.purchaseUnit}
                    onChange={(e) =>
                      updateItem(item.tempId, 'purchaseUnit', e.target.value)
                    }
                    placeholder="túi"
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
                <div className="col-span-1 flex items-end justify-center pb-2">
                  <span className="text-xs text-gray-400">→</span>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    ĐVT cơ bản
                  </Label>
                  <Input
                    value={item.baseUnit}
                    onChange={(e) =>
                      updateItem(item.tempId, 'baseUnit', e.target.value)
                    }
                    placeholder="bông"
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Hệ số
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={item.conversionFactor}
                    onChange={(e) =>
                      updateItem(
                        item.tempId,
                        'conversionFactor',
                        e.target.value,
                      )
                    }
                    placeholder="50"
                    className="h-9 rounded-lg text-xs font-semibold text-center"
                  />
                </div>
              </div>

              {/* Nhập hàng */}
              <div className="bg-blue-50/50 rounded-lg p-2.5 space-y-1.5">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                  📦 Nhập hàng (theo hóa đơn)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-blue-600">
                      Số lượng mua ({item.purchaseUnit || 'ĐVT mua'})
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.purchaseQty}
                      onChange={(e) =>
                        updateItem(item.tempId, 'purchaseQty', e.target.value)
                      }
                      placeholder="0"
                      className="h-9 rounded-lg text-sm font-semibold bg-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-blue-600">
                      Đơn giá (₫/{item.purchaseUnit || 'ĐVT mua'})
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(item.tempId, 'unitPrice', e.target.value)
                      }
                      placeholder="0"
                      className="h-9 rounded-lg text-sm font-semibold bg-white"
                    />
                  </div>
                </div>
                {hasData && (
                  <div className="flex items-center justify-between text-[11px] text-blue-700 pt-1 border-t border-blue-100">
                    <span>
                      Thành tiền:{' '}
                      <span className="font-bold">
                        {formatVND(calc.lineTotal)}
                      </span>
                    </span>
                    <span>
                      → {formatQty(calc.initialStock)}{' '}
                      {item.baseUnit || 'đv'} (
                      {formatVND(calc.unitCost)}/{item.baseUnit || 'đv'})
                    </span>
                  </div>
                )}
              </div>

              {/* Kiểm kê cuối kỳ */}
              <div className="bg-amber-50/50 rounded-lg p-2.5 space-y-1.5">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                  📋 Kiểm kê cuối kỳ (đếm thực tế)
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-0.5">
                    <Label className="text-[10px] text-amber-700">
                      Tồn thực tế còn lại ({item.baseUnit || 'ĐVT cơ bản'})
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.actualStock}
                      onChange={(e) =>
                        updateItem(item.tempId, 'actualStock', e.target.value)
                      }
                      placeholder="0"
                      className="h-9 rounded-lg text-sm font-semibold bg-white"
                    />
                  </div>
                  {hasData && hasActual && (
                    <div className="text-right shrink-0 pt-3">
                      <p className="text-[10px] text-gray-500">Đã dùng</p>
                      <p className="text-sm font-bold text-rose-600">
                        {formatQty(calc.usedQty)} {item.baseUnit}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Kết quả dòng */}
              {hasData && hasActual && (
                <div className="flex items-center justify-between bg-rose-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs text-rose-700">
                      Giá vốn sử dụng:
                    </span>
                  </div>
                  <span className="text-sm font-bold text-rose-700">
                    {formatVND(calc.usedCost)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Nút thêm NVL ── */}
      <Button
        variant="outline"
        onClick={addEmptyItem}
        className="w-full rounded-xl h-11 border-dashed border-gray-300 text-gray-500 hover:text-rose-600 hover:border-rose-300"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Thêm nguyên liệu thủ công
      </Button>

      {/* ── Tổng hợp nhanh ── */}
      {items.length > 0 && (
        <Card className="rounded-xl border-gray-200 bg-gray-50/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-rose-500" />
              Tổng hợp tạm tính
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng tiền nhập hàng:</span>
                <span className="font-semibold text-gray-900">
                  {formatVND(summary.totalPurchaseCost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Giá trị tồn cuối kỳ:</span>
                <span className="font-semibold text-blue-700">
                  {formatVND(summary.totalCurrentValue)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="text-rose-600 font-semibold">
                  Giá vốn đã sử dụng:
                </span>
                <span className="font-bold text-rose-700 text-sm">
                  {formatVND(summary.totalUsedCost)}
                </span>
              </div>
            </div>
            {!summary.allValid && items.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Vui lòng nhập đầy đủ thông tin (tên, đơn vị, SL mua, đơn giá)
                  cho tất cả nguyên liệu
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 safe-area-bottom z-50">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={saving || !summary.allValid}
            className="w-full rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Đang lưu cân đối...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu & Xác nhận cân đối ({items.length} NVL)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
