'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Save,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  ChevronRight,
  Layers,
  Calculator,
  History,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatQty, formatVND } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  minStock: number;
  avgCost: number;
  currentStock: number;
}

export default function StockCheckPage() {
  const router = useRouter();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Map of materialId -> actual count string (in baseUnit)
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  // Map of materialId -> whole stem/pack count string (in purchaseUnit)
  const [packCounts, setPackCounts] = useState<Record<string, string>>({});
  // Map of materialId -> loose stem/flower count string (in baseUnit)
  const [looseCounts, setLooseCounts] = useState<Record<string, string>>({});
  // Map of materialId -> boolean (whether breakdown mode is active or user switched to direct total)
  const [directModeMap, setDirectModeMap] = useState<Record<string, boolean>>({});
  // Map of materialId -> custom factor if item doesn't have factor > 1
  const [customFactors, setCustomFactors] = useState<Record<string, string>>({});

  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/materials');
        if (!res.ok) {
          throw new Error('Không thể tải danh sách nguyên liệu');
        }
        const data: Material[] = await res.json();
        setMaterials(data);

        // Để trống các ô kiểm kho ban đầu, không điền sẵn số để người dùng không phải mất công xóa
        setActualCounts({});
        setPackCounts({});
        setLooseCounts({});
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Lỗi khi tải dữ liệu nguyên liệu');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  const getEffectiveFactor = (m: Material) => {
    const baseFactor = Number(m.conversionFactor) > 0 ? Number(m.conversionFactor) : 1;
    if (baseFactor > 1) return baseFactor;
    const custom = parseFloat(customFactors[m.id] || '');
    return custom > 1 ? custom : 1;
  };

  const handlePackChange = (m: Material, value: string) => {
    setPackCounts((prev) => ({ ...prev, [m.id]: value }));

    const factor = getEffectiveFactor(m);
    const packs = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);
    const looseStr = looseCounts[m.id] ?? '';
    const loose = looseStr === '' ? 0 : Math.max(0, parseFloat(looseStr) || 0);

    const total = Math.round((packs * factor + loose) * 100) / 100;
    const totalStr = value === '' && looseStr === '' ? '' : total.toString();
    setActualCounts((prev) => ({ ...prev, [m.id]: totalStr }));
  };

  const handleLooseChange = (m: Material, value: string) => {
    setLooseCounts((prev) => ({ ...prev, [m.id]: value }));

    const factor = getEffectiveFactor(m);
    const packStr = packCounts[m.id] ?? '';
    const packs = packStr === '' ? 0 : Math.max(0, parseFloat(packStr) || 0);
    const loose = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);

    const total = Math.round((packs * factor + loose) * 100) / 100;
    const totalStr = packStr === '' && value === '' ? '' : total.toString();
    setActualCounts((prev) => ({ ...prev, [m.id]: totalStr }));
  };

  const handleActualCountChange = (materialId: string, value: string) => {
    setActualCounts((prev) => ({
      ...prev,
      [materialId]: value,
    }));
  };

  // Xóa số đã nhập (về lại trạng thái chưa kiểm / rỗng)
  const handleClearItem = (materialId: string) => {
    setActualCounts((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
    setPackCounts((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
    setLooseCounts((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
  };

  // Điền nhanh theo tồn hệ thống nếu kiểm đếm khớp với hệ thống
  const handleFillSystemStock = (material: Material) => {
    const stock = Number(material.currentStock);
    setActualCounts((prev) => ({
      ...prev,
      [material.id]: stock.toString(),
    }));

    const factor = getEffectiveFactor(material);
    if (factor > 1) {
      const whole = Math.floor(stock / factor);
      const remainder = Math.round((stock - whole * factor) * 100) / 100;
      setPackCounts((prev) => ({ ...prev, [material.id]: whole.toString() }));
      setLooseCounts((prev) => ({ ...prev, [material.id]: remainder.toString() }));
    }
  };

  const [createdTicket, setCreatedTicket] = useState<{
    id: string;
    code: string;
    note: string | null;
    totalItems: number;
    increaseCount: number;
    decreaseCount: number;
    matchCount: number;
    totalDiffCost: number;
  } | null>(null);

  // Danh sách các nguyên vật liệu đã được người dùng nhập số lượng thực tế
  const checkedItems = useMemo(() => {
    const list: Array<{
      material: Material;
      currentStock: number;
      actualQty: number;
      diff: number;
    }> = [];

    materials.forEach((m) => {
      const currentStock = Number(m.currentStock);
      const valStr = actualCounts[m.id];
      if (valStr !== undefined && valStr.trim() !== '') {
        const actualQty = parseFloat(valStr);
        if (!isNaN(actualQty) && actualQty >= 0) {
          const diff = Math.round((actualQty - currentStock) * 10000) / 10000;
          list.push({
            material: m,
            currentStock,
            actualQty,
            diff,
          });
        }
      }
    });

    return list;
  }, [materials, actualCounts]);

  // Backward compatibility alias for list with non-zero diff
  const adjustments = useMemo(() => {
    return checkedItems.filter((i) => Math.abs(i.diff) > 0.0001);
  }, [checkedItems]);

  const summary = useMemo(() => {
    let increaseCount = 0;
    let decreaseCount = 0;
    let matchCount = 0;
    let totalDiffCost = 0;

    checkedItems.forEach((item) => {
      const unitCost = Number(item.material.avgCost) || 0;
      totalDiffCost += item.diff * unitCost;
      if (item.diff > 0.0001) {
        increaseCount++;
      } else if (item.diff < -0.0001) {
        decreaseCount++;
      } else {
        matchCount++;
      }
    });

    return {
      totalChecked: checkedItems.length,
      totalAdjusted: adjustments.length,
      increaseCount,
      decreaseCount,
      matchCount,
      totalDiffCost: Math.round(totalDiffCost),
    };
  }, [checkedItems, adjustments]);

  // Filtered materials for listing
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Group filter
      if (selectedGroup !== 'all' && m.group !== selectedGroup) {
        return false;
      }

      // Search filter
      if (
        search.trim() !== '' &&
        !m.name.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      // Only show differences filter
      if (onlyDiffs) {
        const currentStock = Number(m.currentStock);
        const valStr = actualCounts[m.id];
        if (!valStr || valStr.trim() === '') return false;
        const actualQty = parseFloat(valStr);
        return !isNaN(actualQty) && Math.abs(actualQty - currentStock) > 0.0001;
      }

      return true;
    });
  }, [materials, selectedGroup, search, onlyDiffs, actualCounts]);

  const handleSave = async () => {
    if (checkedItems.length === 0) {
      toast.info('Vui lòng nhập số lượng thực tế cho ít nhất 1 nguyên vật liệu');
      return;
    }

    // Validate no negative quantities
    for (const item of checkedItems) {
      if (item.actualQty < 0) {
        toast.error(`Số lượng thực tế của "${item.material.name}" không được âm`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        items: checkedItems.map((item) => ({
          materialId: item.material.id,
          actualQty: item.actualQty,
        })),
        note: note.trim() || undefined,
      };

      const res = await fetch('/api/inventory/stock-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi lưu kết quả kiểm kho');
      }

      toast.success(data.message || 'Đã lưu phiếu kiểm kho thành công');

      // Update local materials state with newly verified actual stock
      const updatedMap = new Map<string, number>(
        checkedItems.map((ci) => [ci.material.id, ci.actualQty])
      );
      setMaterials((prev) =>
        prev.map((m) =>
          updatedMap.has(m.id)
            ? { ...m, currentStock: updatedMap.get(m.id)! }
            : m
        )
      );

      // Open success modal
      if (data.stockCheck) {
        setCreatedTicket(data.stockCheck);
      } else {
        router.push('/inventory/stock-checks');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Không thể lưu kiểm kho');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-32">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Kho</span>
        </button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="rounded-xl border-purple-200 text-purple-900 hover:bg-purple-50 text-xs gap-1.5 h-9 font-semibold"
        >
          <Link href="/inventory/stock-checks">
            <History className="w-4 h-4 text-purple-600" />
            <span>Danh sách phiếu kiểm</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <PackageCheck className="w-6 h-6 text-purple-600" />
          Kiểm kho nguyên vật liệu
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nhập số lượng thực tế tại tiệm theo từng đợt (10-20 NVL) để tạo phiếu kiểm kê và lưu lại
        </p>
      </div>

      {/* Ghi chú đợt kiểm kho & Tên phiếu */}
      <Card className="rounded-2xl border-purple-100 shadow-xs bg-white">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="note" className="text-xs font-bold text-gray-800">
              Ghi chú đợt kiểm kho này
            </Label>
            <span className="text-[10px] text-gray-400">Tùy chọn</span>
          </div>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Kiểm kho sau đợt 20/10 - Đợt hoa sáp, 15 mặt hàng..."
            className="rounded-xl text-xs h-9 bg-gray-50/60"
          />
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-gray-400">Gợi ý nhanh:</span>
            {['Kiểm kho sau đợt 20/10', 'Đợt 1: Giấy nơ phụ liệu', 'Đợt 2: Hoa sáp', 'Đợt 3: Hoa cành & giỏ'].map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setNote(sug)}
                className="text-[10px] bg-purple-50 text-purple-800 hover:bg-purple-100 px-2.5 py-0.5 rounded-full font-medium transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Banner cân đối sau đợt bán lớn (nếu có phát sinh) */}
      <Link href="/inventory/reconciliation">
        <div className="bg-purple-50/70 hover:bg-purple-50 border border-purple-200/70 rounded-xl p-3 flex items-center justify-between text-xs transition-colors">
          <div className="flex items-center gap-2.5">
            <span className="text-base">💡</span>
            <div>
              <p className="font-semibold text-purple-900">
                Vừa qua đợt lễ bận rộn chưa kịp tạo đơn lẻ?
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Dùng công cụ Cân đối theo hóa đơn & tồn cuối để tự tính giá vốn
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-500 shrink-0 ml-2" />
        </div>
      </Link>

      {/* Summary Card */}
      <Card
        className={`rounded-2xl border transition-all ${
          summary.totalAdjusted > 0
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-gray-100 bg-white'
        }`}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Tổng kết chênh lệch
            </span>
            <Badge
              variant={summary.totalAdjusted > 0 ? 'warning' : 'outline'}
              className="font-bold text-xs"
            >
              {summary.totalAdjusted} vật tư thay đổi
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-xl bg-white border border-gray-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Thừa kho</span>
                <span className="font-bold text-emerald-700">
                  {summary.increaseCount} mục
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-100 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Thiếu kho</span>
                <span className="font-bold text-red-700">
                  {summary.decreaseCount} mục
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Search */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Tìm tên nguyên liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white rounded-xl border-gray-200"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex gap-1.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                selectedGroup === 'all'
                  ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tất cả
            </button>
            {MATERIAL_GROUPS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setSelectedGroup(g.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  selectedGroup === g.value
                    ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Toggle only differences */}
          <button
            type="button"
            onClick={() => setOnlyDiffs(!onlyDiffs)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              onlyDiffs
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Chỉ lệch ({summary.totalAdjusted})</span>
          </button>
        </div>
      </div>

      {/* Materials List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
            <p>Không có nguyên liệu nào phù hợp với bộ lọc</p>
            {onlyDiffs && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOnlyDiffs(false)}
                className="rounded-xl text-xs"
              >
                Hiện tất cả nguyên liệu
              </Button>
            )}
          </div>
        ) : (
          filteredMaterials.map((m) => {
            const currentStock = Number(m.currentStock);
            const valStr = actualCounts[m.id] ?? '';
            const isEntered = valStr.trim() !== '';
            const actualQty = isEntered ? parseFloat(valStr) : NaN;
            const hasDiff = isEntered && !isNaN(actualQty) && Math.abs(actualQty - currentStock) > 0.0001;
            const isMatch = isEntered && !isNaN(actualQty) && Math.abs(actualQty - currentStock) <= 0.0001;
            const diff = isEntered && !isNaN(actualQty) ? actualQty - currentStock : 0;

            const factor = getEffectiveFactor(m);
            const isBreakdownMode = (factor > 1 || !!customFactors[m.id]) && !directModeMap[m.id];

            return (
              <Card
                key={m.id}
                className={`rounded-2xl transition-all border ${
                  hasDiff
                    ? diff > 0
                      ? 'border-emerald-200 bg-emerald-50/20 shadow-xs'
                      : 'border-red-200 bg-red-50/20 shadow-xs'
                    : isMatch
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <CardContent className="p-3.5 space-y-3">
                  {/* Title & Group */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {getLabel(MATERIAL_GROUPS, m.group)}
                      </span>
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {m.name}
                      </h3>
                      {factor > 1 && (
                        <span className="inline-flex items-center text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md font-semibold mt-0.5">
                          1 {m.purchaseUnit} = {factor} {m.baseUnit}
                        </span>
                      )}
                    </div>

                    {/* Diff status badge */}
                    {hasDiff ? (
                      <div className="shrink-0 text-right">
                        {diff > 0 ? (
                          <Badge variant="success" className="text-xs font-bold gap-1">
                            <TrendingUp className="w-3 h-3" />+{formatQty(diff)}{' '}
                            {m.baseUnit}
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-xs font-bold gap-1">
                            <TrendingDown className="w-3 h-3" />
                            {formatQty(diff)} {m.baseUnit}
                          </Badge>
                        )}
                      </div>
                    ) : isMatch ? (
                      <Badge
                        variant="secondary"
                        className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold shrink-0"
                      >
                        Khớp kho
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[11px] border-dashed border-gray-200 text-gray-400 font-normal shrink-0"
                      >
                        Chưa kiểm
                      </Badge>
                    )}
                  </div>

                  {isBreakdownMode ? (
                    /* ========================================================
                       CHẾ ĐỘ 2 MỤC: SỐ CÀNH NGUYÊN & SỐ NHÁNH LẺ TỰ QUY ĐỔI
                       ======================================================== */
                    <div className="space-y-2.5 pt-2 border-t border-purple-100/60">
                      {/* Tồn hệ thống */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tồn hệ thống:</span>
                        <div className="text-right">
                          <span className="font-bold text-gray-800">
                            {formatQty(currentStock)} {m.baseUnit}
                          </span>
                          {factor > 1 && currentStock > 0 && (
                            <span className="text-purple-700 text-[11px] font-medium ml-1.5">
                              (~ {Math.floor(currentStock / factor)} {m.purchaseUnit}
                              {currentStock % factor > 0
                                ? ` + ${formatQty(Math.round((currentStock % factor) * 100) / 100)} ${m.baseUnit}`
                                : ''})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Khung 2 mục điền kiểm đếm */}
                      <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>Điền cành nguyên & nhánh lẻ:</span>
                          </div>
                          {isEntered ? (
                            <button
                              type="button"
                              onClick={() => handleClearItem(m.id)}
                              className="text-[11px] text-red-600 hover:text-red-800 hover:underline flex items-center gap-1 font-semibold"
                              title="Xóa số đã nhập"
                            >
                              <RotateCcw className="w-3 h-3" /> Xóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleFillSystemStock(m)}
                              className="text-[11px] text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 font-medium"
                              title="Điền bằng số tồn hệ thống"
                            >
                              <CheckCircle2 className="w-3 h-3 text-purple-600" /> Khớp tồn ({formatQty(currentStock)})
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Mục 1: Số cành nguyên */}
                          <div>
                            <Label
                              htmlFor={`pack-${m.id}`}
                              className="text-[11px] font-semibold text-gray-700 block mb-1"
                            >
                              1. Số {m.purchaseUnit} nguyên
                            </Label>
                            <div className="relative">
                              <Input
                                id={`pack-${m.id}`}
                                type="number"
                                step="any"
                                min="0"
                                inputMode="decimal"
                                placeholder="0"
                                value={packCounts[m.id] ?? ''}
                                onChange={(e) => handlePackChange(m, e.target.value)}
                                className="h-10 text-right pr-12 font-bold rounded-xl bg-white border-purple-200 text-purple-950 focus:border-purple-500"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 pointer-events-none">
                                {m.purchaseUnit}
                              </span>
                            </div>
                          </div>

                          {/* Mục 2: Số nhánh lẻ */}
                          <div>
                            <Label
                              htmlFor={`loose-${m.id}`}
                              className="text-[11px] font-semibold text-gray-700 block mb-1"
                            >
                              2. Số {m.baseUnit} lẻ
                            </Label>
                            <div className="relative">
                              <Input
                                id={`loose-${m.id}`}
                                type="number"
                                step="any"
                                min="0"
                                inputMode="decimal"
                                placeholder="0"
                                value={looseCounts[m.id] ?? ''}
                                onChange={(e) => handleLooseChange(m, e.target.value)}
                                className="h-10 text-right pr-12 font-bold rounded-xl bg-white border-purple-200 text-purple-950 focus:border-purple-500"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 pointer-events-none">
                                {m.baseUnit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dòng tự động quy đổi */}
                        <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 text-xs bg-white/70 px-2.5 py-1.5 rounded-lg">
                          <span className="text-[11px] text-purple-800 font-medium">
                            {isEntered
                              ? `Tự quy đổi: (${packCounts[m.id] || 0} × ${factor}) + ${looseCounts[m.id] || 0}`
                              : `Quy đổi: (Số ${m.purchaseUnit} × ${factor}) + Số ${m.baseUnit} lẻ`}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 text-[11px]">➔ Tổng thực tế:</span>
                            <span className="font-extrabold text-sm text-purple-950">
                              {isEntered ? `${formatQty(actualQty || 0)} ${m.baseUnit}` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Nút chuyển sang nhập thẳng tổng nếu muốn */}
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => setDirectModeMap((prev) => ({ ...prev, [m.id]: true }))}
                          className="text-[10px] text-gray-500 hover:text-purple-700 flex items-center gap-1 hover:underline font-medium"
                        >
                          <Calculator className="w-3 h-3" />
                          Nhập thẳng tổng số {m.baseUnit}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ========================================================
                       CHẾ ĐỘ NHẬP 1 MỤC (TRỰC TIẾP TỔNG HOẶC ĐƠN VỊ 1:1)
                       ======================================================== */
                    <div className="space-y-2 pt-1 border-t border-gray-50">
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Tồn hệ thống
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {formatQty(currentStock)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {m.baseUnit}
                            </span>
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label
                              htmlFor={`actual-${m.id}`}
                              className="text-[11px] font-medium text-gray-700"
                            >
                              Số thực tế
                            </Label>
                            {isEntered ? (
                              <button
                                type="button"
                                onClick={() => handleClearItem(m.id)}
                                className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 font-medium"
                                title="Xóa số đã nhập"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> Xóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFillSystemStock(m)}
                                className="text-[10px] text-purple-700 hover:underline flex items-center gap-0.5 font-medium"
                                title="Điền nhanh bằng tồn hệ thống"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-purple-600" /> Khớp ({formatQty(currentStock)})
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Input
                              id={`actual-${m.id}`}
                              type="number"
                              step="any"
                              min="0"
                              inputMode="decimal"
                              placeholder="0"
                              value={valStr}
                              onChange={(e) =>
                                handleActualCountChange(m.id, e.target.value)
                              }
                              className={`h-10 text-right pr-12 font-bold rounded-xl ${
                                hasDiff
                                  ? diff > 0
                                    ? 'border-emerald-400 text-emerald-800 focus:ring-emerald-400'
                                    : 'border-red-400 text-red-800 focus:ring-red-400'
                                  : isMatch
                                  ? 'border-emerald-200 text-emerald-800'
                                  : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                              {m.baseUnit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Nút bật chế độ Cành & Nhánh */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (factor <= 1) {
                              const promptVal = prompt(
                                `Nhập số ${m.baseUnit} trong 1 ${m.purchaseUnit} (hệ số quy đổi):`,
                                '5'
                              );
                              if (promptVal && parseFloat(promptVal) > 1) {
                                setCustomFactors((prev) => ({ ...prev, [m.id]: promptVal }));
                                const f = parseFloat(promptVal);
                                const whole = Math.floor(currentStock / f);
                                const remainder = Math.round((currentStock - whole * f) * 100) / 100;
                                setPackCounts((prev) => ({ ...prev, [m.id]: whole.toString() }));
                                setLooseCounts((prev) => ({ ...prev, [m.id]: remainder.toString() }));
                              } else {
                                return;
                              }
                            }
                            setDirectModeMap((prev) => ({ ...prev, [m.id]: false }));
                          }}
                          className="text-[10px] text-purple-700 hover:text-purple-900 flex items-center gap-1 font-semibold hover:underline"
                        >
                          <Layers className="w-3 h-3 text-purple-600" />
                          Tách theo {m.purchaseUnit} & {m.baseUnit} lẻ
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 pb-4 md:pb-3 safe-area-bottom z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-muted-foreground">Đã kiểm đợt này: </span>
            <span className="font-bold text-purple-950">
              {summary.totalChecked} NVL
            </span>
            {summary.totalAdjusted > 0 && (
              <span className="text-rose-600 font-semibold ml-1.5 hidden sm:inline">
                ({summary.totalAdjusted} lệch)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-gray-200"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5 shadow-sm px-5"
              onClick={handleSave}
              disabled={submitting || summary.totalChecked === 0}
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Đang lưu phiếu...' : `Lưu phiếu kiểm (${summary.totalChecked})`}
            </Button>
          </div>
        </div>
      </div>

      {/* Success Modal after saving ticket */}
      {createdTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-3xl border-purple-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 mb-2">
                  {createdTicket.code}
                </span>
                <h3 className="text-lg font-black text-gray-900">
                  Lưu phiếu kiểm kho thành công!
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {createdTicket.note || 'Đã cập nhật tồn kho hệ thống khớp thực tế'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100 text-left text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 block">Đã kiểm kê</span>
                  <span className="font-extrabold text-sm text-gray-900">
                    {createdTicket.totalItems} NVL
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Lệch giảm (thiếu)</span>
                  <span className="font-extrabold text-sm text-rose-600">
                    {createdTicket.decreaseCount} NVL
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Lệch tăng (thừa)</span>
                  <span className="font-bold text-xs text-emerald-600">
                    {createdTicket.increaseCount} NVL
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">Chênh lệch giá trị</span>
                  <span className={`font-black text-xs ${createdTicket.totalDiffCost < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                    {createdTicket.totalDiffCost > 0 ? '+' : ''}{formatVND(createdTicket.totalDiffCost)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  onClick={() => {
                    setActualCounts({});
                    setPackCounts({});
                    setLooseCounts({});
                    setCreatedTicket(null);
                    setNote('');
                    toast.success('Đã sẵn sàng kiểm đợt tiếp theo!');
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Tiếp tục kiểm đợt tiếp theo (10-20 NVL khác)</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl border-purple-200 text-purple-950 font-semibold text-xs"
                    onClick={() => router.push('/inventory/stock-checks')}
                  >
                    <span>Xem danh sách phiếu</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full h-10 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold text-xs"
                    onClick={() => router.push('/inventory')}
                  >
                    <span>Về Quản lý kho</span>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
