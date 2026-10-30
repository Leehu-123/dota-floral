'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Calendar,
  TrendingUp,
  ShoppingBag,
  Boxes,
  FileSpreadsheet,
  Award,
  Filter,
  RefreshCw,
  Coins,
  Store,
  MessageCircle,
  Share2,
  Package,
  Layers,
  Search,
  PackageCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, formatQty, formatDate } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { toast } from 'sonner';

interface SummaryData {
  revenue: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
  aov: number;
  purchaseCost: number;
  totalMaterialCost?: number;
  materialItemsCount?: number;
}

interface ChannelStat {
  channel: string;
  channelLabel: string;
  orderCount: number;
  revenue: number;
  grossProfit: number;
  revenueShare: number;
}

interface TopProduct {
  rank: number;
  productId: string | null;
  productName: string;
  quantity: number;
  revenue: number;
  grossProfit: number;
}

interface MaterialUsedItem {
  materialId: string;
  name: string;
  group: string;
  baseUnit: string;
  quantityUsed: number;
  avgCost: number;
  totalCost: number;
  orderUsage: number;
  produceUsage: number;
  costShare: number;
}

interface ReconciliationBatch {
  id: string;
  periodName: string;
  date: string;
  totalAmount: number;
  itemCount: number;
  items: Array<{
    materialId: string;
    name: string;
    group: string;
    baseUnit: string;
    purchaseQty: number;
    convertedQty: number;
    unitCost: number;
    lineTotal: number;
  }>;
}

interface ReportResponse {
  from: string;
  to: string;
  summary: SummaryData;
  channels: ChannelStat[];
  topProducts: TopProduct[];
  materialsUsed?: MaterialUsedItem[];
  reconciliationBatches?: ReconciliationBatch[];
}

type PresetKey = 'today' | '7days' | 'month' | 'prevMonth' | 'custom';

function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetDates(preset: PresetKey): { from: string; to: string } {
  const now = new Date();
  const todayStr = toYMD(now);

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }
  if (preset === '7days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: toYMD(d), to: todayStr };
  }
  if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYMD(firstDay), to: todayStr };
  }
  if (preset === 'prevMonth') {
    const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYMD(firstDayPrev), to: toYMD(lastDayPrev) };
  }
  return { from: todayStr, to: todayStr };
}

export default function ReportsPage() {
  const initialDates = getPresetDates('month');
  const [activePreset, setActivePreset] = useState<PresetKey>('month');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingMaterials, setExportingMaterials] = useState<boolean>(false);
  const [materialSearch, setMaterialSearch] = useState<string>('');
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState<string>('all');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (from: string, to: string) => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports?from=${from}&to=${to}`);
        if (!res.ok) {
          throw new Error('Lỗi khi tải dữ liệu báo cáo');
        }
        const json: ReportResponse = await res.json();
        setData(json);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || 'Không thể tải báo cáo');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchReport(fromDate, toDate);
  }, [fetchReport, fromDate, toDate]);

  const handleSelectPreset = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const dates = getPresetDates(preset);
      setFromDate(dates.from);
      setToDate(dates.to);
    }
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setActivePreset('custom');
    setFromDate(from);
    setToDate(to);
  };

  const handleExportCsv = () => {
    try {
      setExporting(true);
      const url = `/api/reports/export?from=${fromDate}&to=${toDate}&type=orders`;
      window.open(url, '_blank');
      toast.success('Đang tạo và tải file CSV báo cáo...');
    } catch (err) {
      toast.error('Không thể xuất file CSV');
    } finally {
      setTimeout(() => setExporting(false), 1500);
    }
  };

  const handleExportMaterialsCsv = () => {
    try {
      setExportingMaterials(true);
      const url = `/api/reports/export?from=${fromDate}&to=${toDate}&type=materials`;
      window.open(url, '_blank');
      toast.success('Đang tạo và tải file CSV nguyên vật liệu...');
    } catch (err) {
      toast.error('Không thể xuất file CSV nguyên liệu');
    } finally {
      setTimeout(() => setExportingMaterials(false), 1500);
    }
  };

  const filteredMaterialsUsed = useMemo(() => {
    const list = data?.materialsUsed || [];
    return list.filter((m) => {
      const matchSearch =
        materialSearch.trim() === '' ||
        m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.baseUnit.toLowerCase().includes(materialSearch.toLowerCase());
      if (!matchSearch) return false;

      if (selectedMaterialGroup !== 'all' && m.group !== selectedMaterialGroup) {
        return false;
      }
      return true;
    });
  }, [data?.materialsUsed, materialSearch, selectedMaterialGroup]);

  const filteredMaterialTotalCost = useMemo(() => {
    return filteredMaterialsUsed.reduce((sum, m) => sum + m.totalCost, 0);
  }, [filteredMaterialsUsed]);

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'facebook':
        return 'bg-blue-500';
      case 'zalo':
        return 'bg-cyan-500';
      case 'tai_tiem':
        return 'bg-rose-500';
      case 'tiktok':
        return 'bg-black';
      case 'shopee':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              Báo cáo kinh doanh
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Doanh thu, lãi gộp & hiệu quả các kênh bán
            </p>
          </div>
          <Button
            onClick={handleExportCsv}
            disabled={loading || exporting || !data}
            size="sm"
            className="h-9 px-3 gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </Button>
        </div>
      </div>

      {/* 2. Date Range Filter */}
      <Card className="rounded-2xl border-gray-200/80 shadow-xs overflow-hidden">
        <CardContent className="p-3.5 space-y-3">
          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { key: 'today', label: 'Hôm nay' },
                { key: '7days', label: '7 ngày' },
                { key: 'month', label: 'Tháng này' },
                { key: 'prevMonth', label: 'Tháng trước' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleSelectPreset(p.key)}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
                  activePreset === p.key
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                Từ ngày
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => handleCustomDateChange(e.target.value, toDate)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                Đến ngày
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => handleCustomDateChange(fromDate, e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. KPI Summary Cards (Responsive Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* KPI 1: Doanh thu */}
        <Card className="rounded-2xl border-rose-100 bg-gradient-to-br from-white to-rose-50/30 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[11px] font-semibold text-gray-500">Doanh thu</span>
              <Coins className="w-4 h-4 text-rose-500" />
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 my-1" />
            ) : (
              <p className="text-base font-black text-rose-600 tracking-tight">
                {formatVND(data?.summary.revenue)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {loading ? 'Đang tải...' : `${data?.summary.orderCount || 0} đơn hàng`}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Lãi gộp & % Margin */}
        <Card className="rounded-2xl border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[11px] font-semibold text-gray-500">Lãi gộp</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 my-1" />
            ) : (
              <p className="text-base font-black text-emerald-600 tracking-tight">
                {formatVND(data?.summary.grossProfit)}
              </p>
            )}
            <p className="text-[10px] text-emerald-700 font-medium">
              {loading ? '...' : `Tỷ suất: ${data?.summary.marginPercent || 0}%`}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Vốn NVL đã dùng trong đợt */}
        <Card className="rounded-2xl border-purple-100 bg-gradient-to-br from-white to-purple-50/40 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-purple-600">
              <span className="text-[11px] font-semibold text-gray-500">Vốn NVL đã dùng</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 my-1" />
            ) : (
              <p className="text-base font-black text-purple-700 tracking-tight">
                {formatVND(data?.summary.totalMaterialCost || 0)}
              </p>
            )}
            <p className="text-[10px] text-purple-700/80 font-medium">
              {loading ? '...' : `${data?.summary.materialItemsCount || 0} loại nguyên liệu`}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Chi nhập hàng mới */}
        <Card className="rounded-2xl border-amber-100 bg-gradient-to-br from-white to-amber-50/30 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[11px] font-semibold text-gray-500">Chi nhập hàng</span>
              <Boxes className="w-4 h-4 text-amber-500" />
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 my-1" />
            ) : (
              <p className="text-base font-black text-amber-700 tracking-tight">
                {formatVND(data?.summary.purchaseCost)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">Mua nguyên vật liệu</p>
          </CardContent>
        </Card>

        {/* KPI 5: Số đơn & Giá trị đơn TB (AOV) */}
        <Card className="rounded-2xl border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-xs col-span-2 lg:col-span-1">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-[11px] font-semibold text-gray-500">Đơn TB (AOV)</span>
              <ShoppingBag className="w-4 h-4 text-blue-500" />
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 my-1" />
            ) : (
              <p className="text-base font-black text-blue-700 tracking-tight">
                {formatVND(data?.summary.aov)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {loading ? '...' : `Tổng ${data?.summary.orderCount || 0} đơn`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Card 1: Doanh thu & Lợi nhuận theo kênh bán */}
      <Card className="rounded-2xl border-gray-200/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center justify-between">
            <span>Theo kênh bán hàng</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {data?.channels.filter((c) => c.orderCount > 0).length || 0} kênh có phát sinh
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 pt-1 space-y-3.5">
          {loading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : !data || data.channels.every((c) => c.orderCount === 0) ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Chưa có đơn hàng nào trong khoảng thời gian này
            </div>
          ) : (
            <div className="space-y-3">
              {data.channels
                .filter((c) => c.orderCount > 0)
                .map((ch) => {
                  return (
                    <div key={ch.channel} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${getChannelColor(ch.channel)}`}
                          />
                          <span className="font-semibold text-gray-900">
                            {ch.channelLabel}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            ({ch.orderCount} đơn)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">
                            {formatVND(ch.revenue)}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1">
                            ({ch.revenueShare}%)
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getChannelColor(
                            ch.channel
                          )}`}
                          style={{ width: `${Math.max(ch.revenueShare, 2)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                        <span>Lãi gộp:</span>
                        <span className="font-semibold text-emerald-600">
                          {formatVND(ch.grossProfit)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Card 2: Top 5 sản phẩm bán chạy nhất */}
      <Card className="rounded-2xl border-gray-200/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Top 5 sản phẩm bán chạy</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 pt-1">
          {loading ? (
            <div className="space-y-2.5 py-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : !data || data.topProducts.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Không có dữ liệu bán hàng trong khoảng thời gian này
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.topProducts.map((p) => {
                const getRankBadge = (rank: number) => {
                  if (rank === 1)
                    return 'bg-amber-100 text-amber-800 border-amber-300';
                  if (rank === 2)
                    return 'bg-slate-100 text-slate-800 border-slate-300';
                  if (rank === 3)
                    return 'bg-amber-50 text-amber-700 border-amber-200';
                  return 'bg-gray-50 text-gray-600 border-gray-200';
                };

                return (
                  <div
                    key={p.rank + '-' + (p.productId || p.productName)}
                    className="p-3 bg-white rounded-xl border border-gray-100 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${getRankBadge(
                          p.rank
                        )}`}
                      >
                        {p.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-gray-900 truncate">
                          {p.productName}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Đã bán: <span className="font-bold text-rose-600">{p.quantity}</span> chiếc/bó
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-gray-900">
                        {formatVND(p.revenue)}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        Lãi: {formatVND(p.grossProfit)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Card 3: Báo cáo nguyên vật liệu đã sử dụng theo đợt */}
      <Card className="rounded-2xl border-purple-200/80 shadow-xs overflow-hidden bg-white">
        <CardHeader className="p-4 pb-3 border-b border-purple-100/60 bg-gradient-to-r from-purple-50/50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Nguyên vật liệu đã sử dụng theo đợt</span>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Từ {formatDate(fromDate)} đến {formatDate(toDate)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMaterialsCsv}
                disabled={exportingMaterials || !data?.materialsUsed || data.materialsUsed.length === 0}
                className="rounded-xl border-purple-200 text-purple-900 hover:bg-purple-100 font-semibold text-xs gap-1.5 h-9"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-700" />
                <span>{exportingMaterials ? 'Đang xuất...' : 'Xuất Excel NVL'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3.5">
          {/* Quick Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs">
            <div>
              <span className="text-[10px] text-purple-700 font-semibold uppercase block">
                Tổng chi phí NVL
              </span>
              <span className="font-extrabold text-sm text-purple-950 block mt-0.5">
                {formatVND(data?.summary.totalMaterialCost || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-purple-700 font-semibold uppercase block">
                Loại NVL đã dùng
              </span>
              <span className="font-bold text-sm text-gray-900 block mt-0.5">
                {data?.materialsUsed?.length || 0} loại
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-purple-700 font-semibold uppercase block">
                Phục vụ
              </span>
              <span className="font-bold text-sm text-emerald-700 block mt-0.5">
                {data?.summary.orderCount || 0} đơn hàng
              </span>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Tìm tên nguyên liệu..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-gray-50/60 border-gray-200"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedMaterialGroup('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors border ${
                  selectedMaterialGroup === 'all'
                    ? 'bg-purple-100 border-purple-300 text-purple-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Tất cả ({data?.materialsUsed?.length || 0})
              </button>
              {MATERIAL_GROUPS.map((g) => {
                const count = (data?.materialsUsed || []).filter((m) => m.group === g.value).length;
                if (count === 0 && selectedMaterialGroup !== g.value) return null;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setSelectedMaterialGroup(g.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors border ${
                      selectedMaterialGroup === g.value
                        ? 'bg-purple-100 border-purple-300 text-purple-900'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {g.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of materials used */}
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredMaterialsUsed.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-gray-700">Chưa có dữ liệu tiêu hao nguyên liệu</p>
              <p className="text-[11px] text-gray-400">
                Khi các đơn hàng trong đợt được tạo hoặc có hoa bó sẵn tại tiệm, hệ thống sẽ tự động tổng hợp số lượng và chi phí tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMaterialsUsed.map((m) => (
                <div
                  key={m.materialId}
                  className="p-3 bg-white rounded-xl border border-gray-100 shadow-xs space-y-1.5 hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-gray-900 truncate">
                          {m.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal px-1.5 py-0.2 bg-gray-100 text-gray-600 border-none"
                        >
                          {getLabel(MATERIAL_GROUPS, m.group)}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          Đã dùng:{' '}
                          <span className="font-bold text-purple-900">
                            {formatQty(m.quantityUsed)} {m.baseUnit}
                          </span>
                        </span>
                        <span>•</span>
                        <span>Đơn giá vốn: {formatVND(m.avgCost)}/{m.baseUnit}</span>
                        {(m.orderUsage > 0 || m.produceUsage > 0) && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-gray-400">
                              (Đơn hàng: {formatQty(m.orderUsage)}
                              {m.produceUsage > 0 ? ` + Bó sẵn: ${formatQty(m.produceUsage)}` : ''})
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-xs text-purple-950 block">
                        {formatVND(m.totalCost)}
                      </span>
                      <span className="text-[10px] font-semibold text-purple-700/80">
                        {m.costShare}% chi phí đợt
                      </span>
                    </div>
                  </div>

                  {/* Visual Cost Share Bar */}
                  <div className="w-full bg-purple-50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(m.costShare, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Card 4: Các đợt cân đối kho đã chốt (Reconciliation) */}
      {data?.reconciliationBatches && data.reconciliationBatches.length > 0 && (
        <Card className="rounded-2xl border-gray-200/80 shadow-xs overflow-hidden bg-white">
          <CardHeader className="p-4 pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>Đợt cân đối kho đã lưu ({data.reconciliationBatches.length})</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-2 space-y-2.5">
            {data.reconciliationBatches.map((batch) => {
              const isExpanded = expandedBatchId === batch.id;
              return (
                <div
                  key={batch.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2 transition-all"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">
                          {batch.periodName}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white">
                          {formatDate(batch.date)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {batch.itemCount} loại nguyên liệu • Hóa đơn nhập: {formatVND(batch.totalAmount)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg text-gray-500"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-gray-200/60 space-y-1.5 text-xs">
                      {batch.items.map((item, idx) => (
                        <div
                          key={item.materialId + '-' + idx}
                          className="flex items-center justify-between py-1 border-b border-gray-100/60 last:border-none text-[11px]"
                        >
                          <div>
                            <span className="font-medium text-gray-800">{item.name}</span>
                            <span className="text-gray-400 ml-1">
                              ({formatQty(item.convertedQty)} {item.baseUnit})
                            </span>
                          </div>
                          <span className="font-semibold text-gray-900">
                            {formatVND(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
