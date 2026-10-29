'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit3,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  RefreshCw,
  Flower2,
  Plus,
  Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { formatVND, formatQty } from '@/lib/format';
import { toast } from 'sonner';

interface ProductMaterialDetail {
  id?: string;
  materialId: string;
  quantity: number | string;
  material: {
    id: string;
    name: string;
    baseUnit: string;
    group: string;
    avgCost: number | string;
    currentStock: number | string;
  };
}

interface ProductDetail {
  id: string;
  name: string;
  type?: string;
  description?: string | null;
  imageUrl?: string | null;
  laborCost: number | string;
  overheadPercent: number | string;
  targetMargin: number | string;
  suggestedPrice: number | string;
  totalCost?: number | string;
  materialCost?: number | string;
  stock?: number;
  materials: ProductMaterialDetail[];
  createdAt?: string;
  updatedAt?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Modal Bó sẵn vào kho
  const [showProduceDialog, setShowProduceDialog] = useState(false);
  const [produceQty, setProduceQty] = useState(1);
  const [isProducing, setIsProducing] = useState(false);

  // Modal Báo hỏng / Điều chỉnh tồn
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustStock, setAdjustStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fetchProduct = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Không tìm thấy sản phẩm');
        }
        throw new Error('Lỗi khi tải thông tin sản phẩm');
      }
      const data = await res.json();
      setProduct(data);
    } catch (err: any) {
      console.error('Error fetching product:', err);
      setError(err.message || 'Không thể tải chi tiết sản phẩm');
      toast.error('Lỗi khi tải thông tin sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể xóa sản phẩm');
      }
      toast.success('Đã xóa mẫu sản phẩm thành công');
      setShowDeleteDialog(false);
      router.push('/products');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Có lỗi xảy ra khi xóa sản phẩm');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setIsDuplicating(true);
      const res = await fetch(`/api/products/${id}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể nhân bản sản phẩm');
      }
      const duplicated = await res.json();
      toast.success('Đã nhân bản mẫu sản phẩm thành công!');
      if (duplicated?.id) {
        router.push(`/products/${duplicated.id}`);
      } else {
        router.push('/products');
      }
    } catch (err: any) {
      console.error('Duplicate error:', err);
      toast.error(err.message || 'Có lỗi khi nhân bản sản phẩm');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleProduce = async () => {
    if (produceQty <= 0) {
      toast.error('Số lượng bó phải lớn hơn 0');
      return;
    }

    try {
      setIsProducing(true);
      const res = await fetch(`/api/products/${id}/produce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: produceQty }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.missingMaterials && Array.isArray(resData.missingMaterials)) {
          const names = resData.missingMaterials.map((m: any) => m.name).join(', ');
          throw new Error(`Kho không đủ: ${names}`);
        }
        throw new Error(resData.error || 'Lỗi khi bó sẵn thành phẩm');
      }

      toast.success(resData.message || `Đã bó sẵn ${produceQty} bó vào kho!`);
      setShowProduceDialog(false);
      setProduceQty(1);
      fetchProduct();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi bó hoa vào kho');
    } finally {
      setIsProducing(false);
    }
  };

  const handleAdjustStock = async () => {
    try {
      setIsAdjusting(true);
      const res = await fetch(`/api/products/${id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualStock: adjustStock,
          reason: adjustReason,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi điều chỉnh tồn kho');
      }

      toast.success(resData.message || 'Đã cập nhật tồn kho thành phẩm');
      setShowAdjustDialog(false);
      fetchProduct();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi điều chỉnh tồn kho');
    } finally {
      setIsAdjusting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-6 w-48 rounded-md" />
        </div>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-20 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-40 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4 pb-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl gap-1 text-gray-600 pl-0 hover:bg-transparent"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </Button>
        <Card className="rounded-xl border border-red-200 bg-red-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-gray-900">
                {error || 'Không tìm thấy sản phẩm'}
              </p>
              <p className="text-xs text-muted-foreground">
                Mẫu sản phẩm có thể đã bị xóa hoặc đường dẫn không chính xác.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProduct}
                className="rounded-xl border-rose-200 text-rose-700"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Thử lại
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                asChild
              >
                <Link href="/products">Về danh sách</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cost calculations
  const rawMaterials = product.materials || [];
  const materialCost =
    product.materialCost !== undefined && product.materialCost !== null
      ? Number(product.materialCost)
      : rawMaterials.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const cost = Number(item.material?.avgCost) || 0;
          return sum + qty * cost;
        }, 0);

  const laborCost = Number(product.laborCost) || 0;
  const overheadPercent = Number(product.overheadPercent) || 0;
  const overheadCost = Math.round((materialCost * overheadPercent) / 100);

  const totalCost =
    product.totalCost !== undefined && product.totalCost !== null
      ? Number(product.totalCost)
      : materialCost + laborCost + overheadCost;

  const suggestedPrice = Number(product.suggestedPrice) || 0;
  const profitPerUnit = suggestedPrice - totalCost;
  const marginPercent =
    suggestedPrice > 0 ? ((suggestedPrice - totalCost) / suggestedPrice) * 100 : 0;

  // Margin style helper
  const getMarginBadge = (margin: number) => {
    if (margin >= 30) {
      return {
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        textClass: 'text-emerald-700 font-bold',
        dotClass: 'bg-emerald-500',
      };
    }
    if (margin >= 20) {
      return {
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        textClass: 'text-amber-700 font-bold',
        dotClass: 'bg-amber-500',
      };
    }
    return {
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      textClass: 'text-rose-700 font-bold',
      dotClass: 'bg-rose-500',
    };
  };

  const marginBadge = getMarginBadge(marginPercent);

  // Check if all materials have enough stock
  const outOfStockCount = rawMaterials.filter(
    (m) => Number(m.material?.currentStock || 0) < Number(m.quantity || 0)
  ).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/products')}
          className="rounded-xl gap-1 text-gray-700 hover:text-gray-900 -ml-2 h-9 px-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Danh sách mẫu</span>
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="rounded-xl h-9 px-2.5 text-xs text-gray-700 border-gray-200 hover:bg-gray-50 gap-1"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Nhân bản</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl h-9 px-2.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 gap-1"
          >
            <Link href={`/products/${id}/edit`}>
              <Edit3 className="w-3.5 h-3.5 text-rose-600" />
              <span>Sửa</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            className="rounded-xl h-9 w-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 1. Product Info Card */}
      <Card className="rounded-2xl border border-gray-100 shadow-xs bg-white overflow-hidden">
        {product.imageUrl && (
          <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-72 bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute top-3 left-3">
              <Badge className="bg-black/60 text-white backdrop-blur-md border-0 text-[11px] font-medium">
                🌸 Ảnh thành phẩm thực tế
              </Badge>
            </div>
          </div>
        )}
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {product.name}
                </h1>
              </div>
              {product.description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            <Badge
              variant="secondary"
              className="shrink-0 text-xs font-medium bg-rose-50 text-rose-700 border-rose-100"
            >
              {product.type === 'template' ? 'Mẫu chuẩn' : product.type || 'Mẫu hoa'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              {rawMaterials.length} nguyên liệu
            </span>
            <span>•</span>
            {outOfStockCount === 0 ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Đủ tồn kho để bó
              </span>
            ) : (
              <span className="text-rose-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Thiếu {outOfStockCount} nguyên liệu
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 1.5 FINISHED GOODS INVENTORY (Hoa có sẵn tại tiệm) */}
      <Card className="rounded-xl border border-emerald-100 shadow-sm bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-white overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Flower2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Hoa thành phẩm có sẵn tại tiệm
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-emerald-800">
                    {product.stock || 0}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">bó có sẵn</span>
                </div>
              </div>
            </div>

            <Badge
              className={`text-xs px-2.5 py-1 border-0 ${
                (product.stock || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {(product.stock || 0) > 0 ? 'Có sẵn để bán' : 'Hết hàng sẵn'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-100/60">
            <Button
              type="button"
              onClick={() => {
                setProduceQty(1);
                setShowProduceDialog(true);
              }}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Bó sẵn vào kho</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdjustStock(product.stock || 0);
                setAdjustReason('');
                setShowAdjustDialog(true);
              }}
              className="rounded-xl border-emerald-200 text-emerald-900 hover:bg-emerald-50 text-xs h-10 font-medium"
            >
              <span>Kiểm kê / Báo hỏng</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. COST BREAKDOWN Section */}
      <Card className="rounded-xl border border-rose-100 shadow-sm bg-linear-to-br from-white via-white to-rose-50/30 overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-rose-50">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-rose-600" />
              Cơ cấu giá thành (Cost Breakdown)
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Tính trên 1 sản phẩm
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {/* Detailed components */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center text-gray-600">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gray-400" />
                Tiền nguyên liệu (BOM)
              </span>
              <span className="font-medium text-gray-900">
                {formatVND(materialCost)}
              </span>
            </div>

            <div className="flex justify-between items-center text-gray-600">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Tiền công làm
              </span>
              <span className="font-medium text-gray-900">
                {formatVND(laborCost)}
              </span>
            </div>

            <div className="flex justify-between items-center text-gray-600">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                Chi phí chung ({overheadPercent}%)
              </span>
              <span className="font-medium text-gray-900">
                {formatVND(overheadCost)}
              </span>
            </div>
          </div>

          <Separator className="bg-rose-100" />

          {/* Prominent TOTAL COST */}
          <div className="flex justify-between items-end bg-rose-50/80 p-3 rounded-xl border border-rose-100">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 block">
                Tổng giá vốn (Total Cost)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Nguyên liệu + Công + Chi phí chung
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-rose-700 tracking-tight">
                {formatVND(totalCost)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. PRICING & PROFIT Section */}
      <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-gray-50">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Định giá & Lợi nhuận
            </span>
            <div
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${marginBadge.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${marginBadge.dotClass}`} />
              <span>Biên LN: {marginPercent.toFixed(1)}%</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Giá bán gợi ý
              </span>
              <span className="text-lg font-bold text-gray-900 mt-0.5 block">
                {formatVND(suggestedPrice)}
              </span>
              <span className="text-[10px] text-gray-500 mt-1 block">
                Mục tiêu: {product.targetMargin}%
              </span>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
              <span className="text-[11px] text-emerald-700 block font-medium">
                Lợi nhuận / bó
              </span>
              <span className="text-lg font-bold text-emerald-800 mt-0.5 block">
                {formatVND(profitPerUnit)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-1 block">
                = Giá bán - Giá vốn
              </span>
            </div>
          </div>

          {marginPercent < 20 && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Cảnh báo biên lợi nhuận thấp!</span>
                <p className="mt-0.5 text-[11px] text-rose-700 leading-normal">
                  Biên lợi nhuận của mẫu này đang dưới ngưỡng 20%. Bạn nên cân nhắc điều chỉnh tăng giá bán hoặc tối ưu lại định lượng vật tư.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. RECIPE (Công thức) Section */}
      <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-rose-600" />
              Công thức nguyên liệu ({rawMaterials.length})
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Tồn kho hiện tại
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {rawMaterials.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Chưa có nguyên liệu nào trong công thức. Bấm "Sửa" để bổ sung nguyên liệu.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rawMaterials.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const avgCost = Number(item.material?.avgCost) || 0;
                const lineCost = qty * avgCost;
                const currentStock = Number(item.material?.currentStock) || 0;
                const isEnoughStock = currentStock >= qty;

                return (
                  <div key={item.id || index} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.material?.name || 'Nguyên liệu'}
                          </span>
                        </div>

                        {/* Quantity & Unit Cost */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold text-gray-800">
                            {formatQty(qty)} {item.material?.baseUnit}
                          </span>
                          <span>×</span>
                          <span>{formatVND(avgCost)}</span>
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-gray-900 block">
                          {formatVND(lineCost)}
                        </span>

                        {/* Stock indicator badge */}
                        <div className="mt-1">
                          {isEnoughStock ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Đủ ({formatQty(currentStock)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-medium bg-rose-50 px-1.5 py-0.2 rounded-md">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Thiếu ({formatQty(currentStock)}/{formatQty(qty)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total Material Cost at bottom of recipe */}
          <div className="pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/80 -mx-4 -mb-4 p-3.5 px-4 rounded-b-xl">
            <span className="text-xs font-semibold text-gray-700">
              Tổng tiền nguyên liệu
            </span>
            <span className="text-base font-bold text-gray-900">
              {formatVND(materialCost)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Footer Buttons */}
      <div className="pt-2 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 rounded-xl h-12 border-rose-200 text-rose-700 hover:bg-rose-50 gap-2 font-medium"
          asChild
        >
          <Link href={`/products/${id}/edit`}>
            <Edit3 className="w-4 h-4" />
            <span>Chỉnh sửa mẫu</span>
          </Link>
        </Button>

        <Button
          className="flex-1 rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white gap-2 font-medium shadow-sm"
          onClick={handleDuplicate}
          disabled={isDuplicating}
        >
          <Copy className="w-4 h-4" />
          <span>{isDuplicating ? 'Đang nhân bản...' : 'Nhân bản mẫu'}</span>
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Xóa mẫu sản phẩm?</span>
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-gray-600 pt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa mẫu hoa <strong className="text-gray-900">"{product.name}"</strong>?
              Thao tác này sẽ chuyển mẫu vào trạng thái đã xóa và không thể khôi phục trực tiếp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-10"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl h-10 bg-rose-600 hover:bg-rose-700"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produce Dialog (Bó sẵn vào kho) */}
      <Dialog open={showProduceDialog} onOpenChange={setShowProduceDialog}>
        <DialogContent className="rounded-2xl max-w-sm p-5 mx-4">
          <DialogHeader className="text-left pb-1 border-b border-gray-100">
            <DialogTitle className="text-emerald-700 flex items-center gap-2 text-base">
              <Flower2 className="w-5 h-5 text-emerald-600" />
              <span>Bó hoa sẵn vào kho</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Mẫu: <strong className="text-gray-900">{product.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">Cơ chế tự động trừ nguyên liệu:</p>
              <p className="text-emerald-700 leading-relaxed">
                Khi lưu, hệ thống sẽ tự động trừ hoa sáp, que cắm, giấy bọc, phụ kiện... theo đúng số lượng bó bạn làm.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Số lượng bó hoa làm sẵn
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => setProduceQty((prev) => Math.max(1, prev - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={produceQty}
                  onChange={(e) => setProduceQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-11 rounded-xl text-center text-lg font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => setProduceQty((prev) => prev + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Estimated material preview */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-gray-600 block">
                Nguyên vật liệu dự kiến tiêu hao:
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs text-gray-600">
                {rawMaterials.map((m, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-gray-50 text-[11px]">
                    <span className="truncate pr-2">{m.material?.name || 'Nguyên liệu'}</span>
                    <span className="font-semibold text-gray-900 shrink-0">
                      {(Number(m.quantity) * produceQty).toFixed(1)} {m.material?.baseUnit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => setShowProduceDialog(false)}
                disabled={isProducing}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={handleProduce}
                disabled={isProducing}
              >
                {isProducing ? 'Đang xử lý...' : `Làm ${produceQty} bó`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust / Damage Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="rounded-2xl max-w-sm p-5 mx-4">
          <DialogHeader className="text-left pb-1 border-b border-gray-100">
            <DialogTitle className="text-gray-900 flex items-center gap-2 text-base">
              <span>Kiểm kê / Báo hỏng thành phẩm</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Điều chỉnh số lượng bó hoa thực tế đang có sẵn tại cửa hàng
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Số lượng bó hoa thực tế tại tiệm
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={adjustStock}
                onChange={(e) => setAdjustStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="h-11 rounded-xl text-base font-bold"
              />
              <span className="text-[11px] text-muted-foreground block">
                Hiện tại hệ thống ghi nhận: <strong>{product.stock || 0} bó</strong>
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Lý do (Tùy chọn)
              </Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="VD: Hoa để lâu bị bụi/hỏng, kiểm kê định kỳ..."
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <DialogFooter className="flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => setShowAdjustDialog(false)}
                disabled={isAdjusting}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                onClick={handleAdjustStock}
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Đang lưu...' : 'Xác nhận cập nhật'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
