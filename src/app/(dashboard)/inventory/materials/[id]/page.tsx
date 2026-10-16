'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit3,
  Package,
  Layers,
  History,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Truck,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MATERIAL_GROUPS, STOCK_MOVEMENT_TYPES, getLabel } from '@/lib/constants';
import { formatVND, formatQty, formatDate, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

interface PurchaseHistoryItem {
  id: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal?: number | string;
  convertedQty?: number | string;
  purchase?: {
    id: string;
    date: string;
    supplierName: string;
  };
  date?: string;
  supplierName?: string;
}

interface StockMovementItem {
  id: string;
  type: string;
  quantity: number | string;
  unitCost?: number | string;
  note?: string | null;
  createdAt: string;
}

interface MaterialDetail {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  minStock: number;
  avgCost: number;
  currentStock: number;
  note?: string | null;
  imageUrl?: string | null;
  purchaseLines?: PurchaseHistoryItem[];
  stockMovements?: StockMovementItem[];
}

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movements' | 'purchases'>('movements');

  useEffect(() => {
    if (!id) return;

    const fetchMaterial = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/materials/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Không tìm thấy nguyên liệu');
          }
          throw new Error('Lỗi khi tải thông tin nguyên liệu');
        }
        const data = await res.json();
        setMaterial(data);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Không thể tải dữ liệu nguyên liệu');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-700 font-medium">Không tìm thấy nguyên liệu này</p>
        <Button variant="outline" onClick={() => router.push('/inventory')}>
          Quay lại kho
        </Button>
      </div>
    );
  }

  const currentStock = Number(material.currentStock);
  const minStock = Number(material.minStock);
  const avgCost = Number(material.avgCost);
  const conversionFactor = Number(material.conversionFactor);

  // Status configuration
  const getStockStatus = () => {
    if (currentStock <= 0) {
      return {
        label: 'Hết hàng',
        variant: 'danger' as const,
        textColor: 'text-red-600',
        bgBox: 'bg-red-50 border-red-200',
      };
    }
    if (currentStock <= minStock) {
      return {
        label: 'Sắp hết hàng',
        variant: 'warning' as const,
        textColor: 'text-amber-600',
        bgBox: 'bg-amber-50 border-amber-200',
      };
    }
    return {
      label: 'Đủ tồn kho',
      variant: 'success' as const,
      textColor: 'text-emerald-600',
      bgBox: 'bg-emerald-50 border-emerald-200',
    };
  };

  const status = getStockStatus();

  const purchaseLines = material.purchaseLines || [];
  const stockMovements = material.stockMovements || [];

  return (
    <div className="space-y-4 pb-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/inventory')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Kho</span>
        </button>

        <Button
          size="sm"
          variant="outline"
          className="rounded-xl border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 gap-1.5 h-9"
          asChild
        >
          <Link href={`/inventory/materials/${material.id}/edit`}>
            <Edit3 className="w-4 h-4" />
            <span>Chỉnh sửa</span>
          </Link>
        </Button>
      </div>

      {/* Main Stock Highlight Card */}
      <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden bg-gradient-to-br from-white to-gray-50/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                {getLabel(MATERIAL_GROUPS, material.group)}
              </span>
              <h1 className="text-xl font-bold text-gray-900 mt-1">{material.name}</h1>
            </div>
            <Badge variant={status.variant} className="text-xs px-2.5 py-0.5 mt-1 shrink-0">
              {status.label}
            </Badge>
          </div>

          {/* Large stock display */}
          <div className={`p-4 rounded-xl border ${status.bgBox} flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 font-medium">Tồn kho hiện tại</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-3xl font-extrabold tracking-tight ${status.textColor}`}>
                  {formatQty(currentStock)}
                </span>
                <span className="text-sm font-semibold text-gray-600">{material.baseUnit}</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Giá vốn bình quân</p>
              <p className="text-base font-bold text-gray-900 mt-1">
                {formatVND(avgCost)}
                <span className="text-xs font-normal text-muted-foreground">/{material.baseUnit}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specification Card */}
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-500" />
            Thông số nguyên liệu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2.5 text-sm">
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <span className="text-muted-foreground">Đơn vị cơ bản (dùng sx)</span>
            <span className="font-medium text-gray-900">{material.baseUnit}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <span className="text-muted-foreground">Đơn vị nhập hàng</span>
            <span className="font-medium text-gray-900">{material.purchaseUnit}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <span className="text-muted-foreground">Quy đổi</span>
            <span className="font-medium text-gray-900">
              1 {material.purchaseUnit} = {formatQty(conversionFactor)} {material.baseUnit}
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <span className="text-muted-foreground">Định mức tồn tối thiểu</span>
            <span className="font-medium text-gray-900">
              {formatQty(minStock)} {material.baseUnit}
            </span>
          </div>
          {material.note && (
            <div className="pt-1">
              <span className="text-muted-foreground block text-xs mb-1">Ghi chú:</span>
              <p className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-700 whitespace-pre-wrap">
                {material.note}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Tabs: Movements / Purchases */}
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 p-1.5 bg-gray-50/60 rounded-t-2xl">
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'movements'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử xuất nhập ({stockMovements.length})
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'purchases'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Lịch sử giá nhập ({purchaseLines.length})
          </button>
        </div>

        <CardContent className="p-4 pt-3">
          {activeTab === 'movements' ? (
            // Stock movements list
            stockMovements.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                Chưa có lịch sử biến động kho
              </div>
            ) : (
              <div className="space-y-2.5">
                {stockMovements.map((m) => {
                  const qty = Number(m.quantity);
                  const isPositive = qty > 0;
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">
                            {getLabel(STOCK_MOVEMENT_TYPES, m.type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                          <span>{formatDateTime(m.createdAt)}</span>
                          {m.note && (
                            <>
                              <span>•</span>
                              <span className="truncate text-gray-600">{m.note}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-bold text-sm inline-flex items-center gap-0.5 ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? `+${formatQty(qty)}` : formatQty(qty)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1">
                          {material.baseUnit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Purchase history list
            purchaseLines.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                Chưa có lịch sử mua hàng
              </div>
            ) : (
              <div className="space-y-2.5">
                {purchaseLines.map((line) => {
                  const purchaseDate = line.purchase?.date || line.date;
                  const supplier =
                    line.purchase?.supplierName || line.supplierName || 'NCC không tên';
                  const qty = Number(line.quantity);
                  const price = Number(line.unitPrice);

                  return (
                    <div
                      key={line.id}
                      className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 truncate">
                            {supplier}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {formatDate(purchaseDate)}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-gray-900">
                          {formatVND(price)}
                          <span className="text-[11px] text-muted-foreground font-normal">
                            /{material.purchaseUnit}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          SL: {formatQty(qty)} {material.purchaseUnit}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
