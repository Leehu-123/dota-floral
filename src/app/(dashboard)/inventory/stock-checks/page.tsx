'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  PackageCheck,
  Search,
  Calendar,
  FileSpreadsheet,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, formatQty, formatDate } from '@/lib/format';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { toast } from 'sonner';

interface StockCheckSummary {
  id: string;
  code: string;
  checkDate: string;
  note: string | null;
  totalItems: number;
  increaseCount: number;
  decreaseCount: number;
  matchCount: number;
  totalDiffCost: number;
  createdAt: string;
}

interface StockCheckDetail extends StockCheckSummary {
  items: Array<{
    id: string;
    materialId: string;
    previousStock: number;
    actualStock: number;
    difference: number;
    unitCost: number;
    totalCostDiff: number;
    note: string | null;
    material: {
      id: string;
      name: string;
      group: string;
      baseUnit: string;
      purchaseUnit: string;
      conversionFactor: number;
      avgCost: number;
      currentStock: number;
    };
  }>;
}

export default function StockChecksListPage() {
  const router = useRouter();
  const [stockChecks, setStockChecks] = useState<StockCheckSummary[]>([]);
  const [summary, setSummary] = useState({
    totalTickets: 0,
    totalItemsChecked: 0,
    totalDiffCost: 0,
    totalDecreaseCount: 0,
    totalIncreaseCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Expand ticket details
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, StockCheckDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const fetchStockChecks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory/stock-checks');
      if (!res.ok) throw new Error('Không thể tải danh sách phiếu kiểm kho');
      const data = await res.json();
      setStockChecks(data.stockChecks || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tải phiếu kiểm kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockChecks();
  }, []);

  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    if (!detailCache[id]) {
      try {
        setLoadingDetail(id);
        const res = await fetch(`/api/inventory/stock-checks/${id}`);
        if (!res.ok) throw new Error('Không thể tải chi tiết phiếu');
        const detail: StockCheckDetail = await res.json();
        setDetailCache((prev) => ({ ...prev, [id]: detail }));
      } catch (err: any) {
        console.error(err);
        toast.error('Lỗi khi tải chi tiết phiếu kiểm kho');
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  const handleExportCsv = (id: string, code: string) => {
    window.open(`/api/inventory/stock-checks/${id}/export`, '_blank');
  };

  const filteredChecks = useMemo(() => {
    if (!search.trim()) return stockChecks;
    const q = search.toLowerCase();
    return stockChecks.filter(
      (sc) =>
        sc.code.toLowerCase().includes(q) ||
        (sc.note && sc.note.toLowerCase().includes(q))
    );
  }, [stockChecks, search]);

  return (
    <div className="space-y-4 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/inventory')}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
            <span>Kho</span>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-purple-950 flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-purple-600" />
              <span>Phiếu kiểm kho</span>
            </h1>
            <p className="text-xs text-purple-700 font-semibold mt-0.5">
              Lịch sử các đợt kiểm kê & chốt tồn nguyên vật liệu theo thời điểm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={fetchStockChecks}
            variant="outline"
            className="rounded-xl border-purple-200 text-purple-900 hover:bg-purple-50 h-9 font-semibold text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          <Button
            size="sm"
            className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs text-xs gap-1.5 h-9"
            asChild
          >
            <Link href="/inventory/stock-check">
              <Plus className="w-4 h-4" />
              <span>Tạo phiếu kiểm mới</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="rounded-2xl border-purple-100/80 shadow-xs bg-white p-3.5">
          <span className="text-[11px] font-semibold text-purple-700 block uppercase">
            Tổng số phiếu
          </span>
          <span className="text-xl font-extrabold text-purple-950 block mt-1">
            {summary.totalTickets} phiếu
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Các đợt đã lưu vào hệ thống
          </span>
        </Card>

        <Card className="rounded-2xl border-purple-100/80 shadow-xs bg-white p-3.5">
          <span className="text-[11px] font-semibold text-purple-700 block uppercase">
            Tổng NVL đã kiểm
          </span>
          <span className="text-xl font-extrabold text-gray-900 block mt-1">
            {summary.totalItemsChecked} lượt
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Bao gồm nhập theo từng đợt
          </span>
        </Card>

        <Card className="rounded-2xl border-purple-100/80 shadow-xs bg-white p-3.5">
          <span className="text-[11px] font-semibold text-purple-700 block uppercase">
            Mặt hàng thiếu/hao hụt
          </span>
          <span className="text-xl font-extrabold text-rose-600 block mt-1">
            {summary.totalDecreaseCount} lượt
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Nguyên liệu đã dùng hoặc hao hụt
          </span>
        </Card>

        <Card className="rounded-2xl border-purple-100/80 shadow-xs bg-white p-3.5">
          <span className="text-[11px] font-semibold text-purple-700 block uppercase">
            Tổng chênh lệch giá trị
          </span>
          <span className={`text-xl font-extrabold block mt-1 ${summary.totalDiffCost < 0 ? 'text-rose-600' : 'text-purple-950'}`}>
            {formatVND(summary.totalDiffCost)}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Giá trị xuất dùng ghi nhận qua kiểm kho
          </span>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          type="search"
          placeholder="Tìm theo mã phiếu (PKK-...) hoặc ghi chú đợt kiểm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-xs rounded-xl bg-white border-gray-200"
        />
      </div>

      {/* Stock Checks List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : filteredChecks.length === 0 ? (
        <Card className="rounded-2xl border-gray-100 bg-white p-8 text-center">
          <PackageCheck className="w-10 h-10 text-purple-300 mx-auto mb-2" />
          <p className="font-bold text-sm text-gray-800">Chưa có phiếu kiểm kho nào</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Khi bạn thực hiện kiểm kho tại cửa hàng (nhập theo từng đợt 10-20 NVL), các phiếu sẽ tự động lưu lại tại đây kèm thời điểm và chênh lệch cụ thể.
          </p>
          <Button
            size="sm"
            className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs mt-4 gap-1.5"
            asChild
          >
            <Link href="/inventory/stock-check">
              <Plus className="w-4 h-4" />
              <span>Bắt đầu kiểm kho</span>
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredChecks.map((sc) => {
            const isExpanded = expandedId === sc.id;
            const detail = detailCache[sc.id];
            const diffCost = Number(sc.totalDiffCost) || 0;

            return (
              <Card
                key={sc.id}
                className="rounded-2xl border-purple-100/80 shadow-xs bg-white overflow-hidden transition-all hover:border-purple-300"
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-purple-950">
                          {sc.code}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-purple-50 text-purple-900 border-purple-200"
                        >
                          {new Date(sc.checkDate).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {formatDate(sc.checkDate)}
                        </Badge>
                      </div>

                      <p className="text-xs font-semibold text-gray-700">
                        {sc.note || 'Kiểm kho định kỳ'}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap pt-0.5">
                        <span>
                          Đã kiểm: <strong className="text-gray-900">{sc.totalItems}</strong> NVL
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 font-semibold">
                          Thiếu: {sc.decreaseCount}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">
                          Thừa: {sc.increaseCount}
                        </span>
                        <span>•</span>
                        <span className="text-gray-600">
                          Khớp: {sc.matchCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-gray-400 block font-semibold uppercase">
                          Chênh lệch giá trị
                        </span>
                        <span
                          className={`font-black text-sm block ${
                            diffCost < 0
                              ? 'text-rose-600'
                              : diffCost > 0
                              ? 'text-emerald-600'
                              : 'text-gray-800'
                          }`}
                        >
                          {diffCost > 0 ? '+' : ''}
                          {formatVND(diffCost)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportCsv(sc.id, sc.code)}
                          className="rounded-xl border-purple-200 text-purple-900 hover:bg-purple-50 text-xs h-8 px-2.5 gap-1"
                          title="Xuất Excel phiếu kiểm kho"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-700" />
                          <span className="hidden md:inline">Excel</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleExpand(sc.id)}
                          className="rounded-xl text-purple-900 hover:bg-purple-50 text-xs h-8 px-2.5 gap-1 font-semibold"
                        >
                          <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Items Table */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-purple-100 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700 pb-1">
                        <span>Danh sách nguyên vật liệu trong phiếu ({sc.totalItems})</span>
                        <span className="text-[11px] text-purple-700">
                          Sắp xếp theo chênh lệch thiếu nhiều nhất
                        </span>
                      </div>

                      {loadingDetail === sc.id ? (
                        <div className="py-4 text-center text-xs text-gray-500 space-y-1">
                          <Skeleton className="h-8 w-full rounded-lg" />
                          <Skeleton className="h-8 w-full rounded-lg" />
                        </div>
                      ) : !detail ? (
                        <p className="text-xs text-gray-500 py-2">Không thể tải chi tiết.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-purple-50/60 text-purple-950 font-bold border-b border-gray-200 text-[11px]">
                                <th className="p-2.5">STT</th>
                                <th className="p-2.5">Tên nguyên liệu</th>
                                <th className="p-2.5">Nhóm</th>
                                <th className="p-2.5 text-right">Tồn cũ</th>
                                <th className="p-2.5 text-right">Thực tế</th>
                                <th className="p-2.5 text-right">Chênh lệch</th>
                                <th className="p-2.5 text-right">Đơn giá vốn</th>
                                <th className="p-2.5 text-right">Thành tiền lệch</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detail.items.map((it, idx) => {
                                const diff = Number(it.difference);
                                const costDiff = Number(it.totalCostDiff) || 0;
                                return (
                                  <tr
                                    key={it.id}
                                    className={`hover:bg-gray-50/80 transition-colors ${
                                      diff < 0
                                        ? 'bg-rose-50/20'
                                        : diff > 0
                                        ? 'bg-emerald-50/20'
                                        : ''
                                    }`}
                                  >
                                    <td className="p-2.5 text-gray-400 font-medium">{idx + 1}</td>
                                    <td className="p-2.5 font-bold text-gray-900">
                                      {it.material?.name || 'Vật tư'}
                                    </td>
                                    <td className="p-2.5 text-gray-500 text-[11px]">
                                      {getLabel(MATERIAL_GROUPS, it.material?.group || '')}
                                    </td>
                                    <td className="p-2.5 text-right text-gray-600 font-medium">
                                      {formatQty(it.previousStock)} {it.material?.baseUnit}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-gray-900">
                                      {formatQty(it.actualStock)} {it.material?.baseUnit}
                                    </td>
                                    <td
                                      className={`p-2.5 text-right font-bold ${
                                        diff < 0
                                          ? 'text-rose-600'
                                          : diff > 0
                                          ? 'text-emerald-600'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {diff > 0 ? `+${formatQty(diff)}` : formatQty(diff)}{' '}
                                      {it.material?.baseUnit}
                                    </td>
                                    <td className="p-2.5 text-right text-gray-600">
                                      {formatVND(it.unitCost)}
                                    </td>
                                    <td
                                      className={`p-2.5 text-right font-bold ${
                                        costDiff < 0
                                          ? 'text-rose-600'
                                          : costDiff > 0
                                          ? 'text-emerald-600'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {costDiff > 0 ? '+' : ''}
                                      {formatVND(costDiff)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
