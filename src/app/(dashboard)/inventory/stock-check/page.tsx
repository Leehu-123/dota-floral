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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatQty } from '@/lib/format';
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

        // Pre-fill actual counts, pack counts and loose counts
        const initialCounts: Record<string, string> = {};
        const initialPacks: Record<string, string> = {};
        const initialLoose: Record<string, string> = {};

        data.forEach((m) => {
          const stock = Number(m.currentStock);
          initialCounts[m.id] = stock.toString();

          const factor = Number(m.conversionFactor) > 1 ? Number(m.conversionFactor) : 1;
          if (factor > 1) {
            const whole = Math.floor(stock / factor);
            const remainder = Math.round((stock - whole * factor) * 100) / 100;
            initialPacks[m.id] = whole > 0 ? whole.toString() : '0';
            initialLoose[m.id] = remainder > 0 ? remainder.toString() : '0';
          }
        });

        setActualCounts(initialCounts);
        setPackCounts(initialPacks);
        setLooseCounts(initialLoose);
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

  // Reset a specific material to current stock
  const handleResetItem = (material: Material) => {
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

  // Calculate differences
  const adjustments = useMemo(() => {
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
        if (!isNaN(actualQty)) {
          const diff = actualQty - currentStock;
          if (Math.abs(diff) > 0.0001) {
            list.push({
              material: m,
              currentStock,
              actualQty,
              diff,
            });
          }
        }
      }
    });

    return list;
  }, [materials, actualCounts]);

  const summary = useMemo(() => {
    let increaseCount = 0;
    let decreaseCount = 0;

    adjustments.forEach((item) => {
      if (item.diff > 0) {
        increaseCount++;
      } else if (item.diff < 0) {
        decreaseCount++;
      }
    });

    return {
      totalAdjusted: adjustments.length,
      increaseCount,
      decreaseCount,
    };
  }, [adjustments]);

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
        const actualQty = parseFloat(valStr || '0');
        return isNaN(actualQty) || Math.abs(actualQty - currentStock) > 0.0001;
      }

      return true;
    });
  }, [materials, selectedGroup, search, onlyDiffs, actualCounts]);

  const handleSave = async () => {
    if (adjustments.length === 0) {
      toast.info('Không có mục nào thay đổi số lượng để cập nhật');
      return;
    }

    // Validate no negative quantities
    for (const adj of adjustments) {
      if (adj.actualQty < 0) {
        toast.error(`Số lượng thực tế của "${adj.material.name}" không được âm`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        items: adjustments.map((adj) => ({
          materialId: adj.material.id,
          actualQty: adj.actualQty,
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

      toast.success(data.message || 'Đã lưu kết quả kiểm kho thành công');
      router.push('/inventory');
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Kho</span>
        </button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <PackageCheck className="w-6 h-6 text-purple-600" />
          Kiểm kho định kỳ
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nhập số lượng thực tế tại tiệm để cân bằng tồn kho hệ thống
        </p>
      </div>

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
            const actualQty = parseFloat(valStr);
            const hasDiff = !isNaN(actualQty) && Math.abs(actualQty - currentStock) > 0.0001;
            const diff = !isNaN(actualQty) ? actualQty - currentStock : 0;

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
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[11px] bg-gray-100 text-gray-500 font-normal shrink-0"
                      >
                        Khớp kho
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
                          {hasDiff && (
                            <button
                              type="button"
                              onClick={() => handleResetItem(m)}
                              className="text-[11px] text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 font-semibold"
                              title="Đặt lại bằng tồn hệ thống"
                            >
                              <RotateCcw className="w-3 h-3" /> Hoàn tác
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
                            Tự quy đổi: ({packCounts[m.id] || 0} × {factor}) + {looseCounts[m.id] || 0}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 text-[11px]">➔ Tổng thực tế:</span>
                            <span className="font-extrabold text-sm text-purple-950">
                              {formatQty(actualQty || 0)} {m.baseUnit}
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
                            {hasDiff && (
                              <button
                                type="button"
                                onClick={() => handleResetItem(m)}
                                className="text-[10px] text-purple-700 hover:underline flex items-center gap-0.5 font-medium"
                                title="Đặt lại bằng tồn hệ thống"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> Hoàn tác
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
                              value={valStr}
                              onChange={(e) =>
                                handleActualCountChange(m.id, e.target.value)
                              }
                              className={`h-10 text-right pr-12 font-bold rounded-xl ${
                                hasDiff
                                  ? diff > 0
                                    ? 'border-emerald-400 text-emerald-800 focus:ring-emerald-400'
                                    : 'border-red-400 text-red-800 focus:ring-red-400'
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

      {/* Note for stock check */}
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="p-4 space-y-1.5">
          <Label htmlFor="note" className="text-sm font-medium text-gray-700">
            Ghi chú đợt kiểm kho
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Kiểm kê định kỳ đầu tuần, phát hiện hao hụt hoa sáp..."
            rows={2}
            className="rounded-xl resize-none text-sm"
          />
        </CardContent>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 pb-4 md:pb-3 safe-area-bottom z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-muted-foreground">Điều chỉnh: </span>
            <span className="font-bold text-gray-900">
              {summary.totalAdjusted} vật tư
            </span>
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
              className="h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5 shadow-sm px-5"
              onClick={handleSave}
              disabled={submitting || summary.totalAdjusted === 0}
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Đang lưu...' : 'Lưu kiểm kho'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
