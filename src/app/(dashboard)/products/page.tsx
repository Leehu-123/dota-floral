'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Flower2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND } from '@/lib/format';
import { toast } from 'sonner';

interface ProductMaterialItem {
  id?: string;
  materialId: string;
  quantity: number | string;
  material?: {
    id: string;
    name: string;
    baseUnit: string;
    group: string;
    avgCost: number | string;
    currentStock: number | string;
  };
}

interface ProductItem {
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
  margin?: number;
  materials?: ProductMaterialItem[];
  _count?: {
    materials?: number;
    orderLines?: number;
  };
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low_margin'>('all');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products');
      if (!res.ok) {
        throw new Error('Không thể tải danh sách sản phẩm');
      }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products ?? []);
    } catch (err: any) {
      console.error('Fetch products error:', err);
      setError(err.message || 'Lỗi khi tải danh sách sản phẩm');
      toast.error('Lỗi khi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Compute calculated fields for each product
  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      // 1. Calculate material cost
      let materialCost = 0;
      if (p.materialCost !== undefined && p.materialCost !== null) {
        materialCost = Number(p.materialCost);
      } else if (p.materials && Array.isArray(p.materials)) {
        materialCost = p.materials.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const cost = Number(item.material?.avgCost) || 0;
          return sum + qty * cost;
        }, 0);
      }

      // 2. Calculate labor & overhead
      const laborCost = Number(p.laborCost) || 0;
      const overheadPercent = Number(p.overheadPercent) || 0;
      const overheadCost = Math.round((materialCost * overheadPercent) / 100);

      // 3. Total cost
      const computedTotalCost =
        p.totalCost !== undefined && p.totalCost !== null
          ? Number(p.totalCost)
          : materialCost + laborCost + overheadCost;

      // 4. Selling / suggested price
      const price = Number(p.suggestedPrice) || 0;

      // 5. Margin %
      let margin = 0;
      if (p.margin !== undefined && p.margin !== null) {
        margin = Number(p.margin);
      } else if (price > 0) {
        margin = ((price - computedTotalCost) / price) * 100;
      }

      // Material count
      const materialCount =
        p.materials?.length ?? p._count?.materials ?? 0;

      return {
        ...p,
        computedMaterialCost: materialCost,
        computedTotalCost,
        computedPrice: price,
        computedMargin: margin,
        materialCount,
      };
    });
  }, [products]);

  // Low margin count (< 20%)
  const lowMarginCount = useMemo(() => {
    return enrichedProducts.filter((p) => p.computedMargin < 20).length;
  }, [enrichedProducts]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (filterType === 'low_margin') {
        return p.computedMargin < 20;
      }

      return true;
    });
  }, [enrichedProducts, search, filterType]);

  // Margin color helper
  const getMarginStyle = (margin: number) => {
    if (margin >= 30) {
      return {
        badgeVariant: 'success' as const,
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        textClass: 'text-emerald-700 font-semibold',
        dotClass: 'bg-emerald-500',
        isLow: false,
      };
    }
    if (margin >= 20) {
      return {
        badgeVariant: 'warning' as const,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        textClass: 'text-amber-700 font-semibold',
        dotClass: 'bg-amber-500',
        isLow: false,
      };
    }
    return {
      badgeVariant: 'danger' as const,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      textClass: 'text-rose-700 font-semibold',
      dotClass: 'bg-rose-500',
      isLow: true,
    };
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🌸 Mẫu sản phẩm</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Định lượng công thức & tính giá thành bó hoa
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm gap-1.5 h-10 px-3.5 font-semibold"
          asChild
        >
          <Link href="/products/new">
            <Plus className="w-4 h-4" />
            <span className="text-xs">Thêm mẫu</span>
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Tìm kiếm mẫu bó hoa, mô tả..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-white rounded-xl border-gray-200 shadow-xs text-sm"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
            filterType === 'all'
              ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Tất cả ({products.length})
        </button>
        <button
          onClick={() => setFilterType('low_margin')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
            filterType === 'low_margin'
              ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Biên LN thấp (&lt;20%)</span>
          {lowMarginCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {lowMarginCount}
            </span>
          )}
        </button>
      </div>

      {/* Products Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-xl border border-gray-100 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-5 w-48 rounded-md" />
                    <Skeleton className="h-3.5 w-3/4 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="rounded-xl border border-red-200 bg-red-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">{error}</p>
              <p className="text-xs text-muted-foreground">
                Đã xảy ra sự cố khi tải danh sách sản phẩm. Vui lòng thử lại.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchProducts}
              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </Button>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 border-gray-200 bg-white">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-2xl">
              🌸
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-gray-900">
                {search
                  ? 'Không tìm thấy mẫu phù hợp'
                  : 'Chưa có mẫu sản phẩm nào'}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {search
                  ? 'Thử đổi từ khóa tìm kiếm tên hoa hoặc mô tả sản phẩm'
                  : 'Tạo công thức mẫu để tự động tính giá vốn, giá bán đề xuất và quản lý xuất kho'}
              </p>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5 h-10 px-4"
                asChild
              >
                <Link href="/products/new">
                  <Plus className="w-4 h-4" />
                  <span>Tạo mẫu đầu tiên</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProducts.map((product) => {
            const marginStyle = getMarginStyle(product.computedMargin);

            return (
              <Card
                key={product.id}
                onClick={() => router.push(`/products/${product.id}`)}
                className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer active:scale-[0.99] bg-white overflow-hidden flex flex-col group"
              >
                {/* Product Image Thumbnail / Banner */}
                <div className="relative w-full h-44 sm:h-48 bg-purple-50/50 overflow-hidden border-b border-gray-100 flex items-center justify-center">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-purple-300 gap-1 select-none py-6">
                      <span className="text-3xl">🌸</span>
                      <span className="text-[11px] font-medium text-purple-400/80">Chưa có ảnh</span>
                    </div>
                  )}

                  {/* Margin Pill overlaid on top right of image */}
                  <div
                    className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs ${marginStyle.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${marginStyle.dotClass}`} />
                    <span>{product.computedMargin.toFixed(0)}% LN</span>
                  </div>

                  {product.type === 'template' && (
                    <div className="absolute bottom-2 left-2.5">
                      <span className="text-[10px] bg-black/60 text-white backdrop-blur-md px-2 py-0.5 rounded-md font-semibold">
                        Mẫu chuẩn
                      </span>
                    </div>
                  )}
                </div>

                <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1 group-hover:text-purple-900 transition-colors">
                        {product.name}
                      </h3>
                      {marginStyle.isLow && (
                        <Badge
                          variant="danger"
                          className="text-[10px] px-1.5 py-0 shrink-0 font-medium bg-red-100 text-red-700 border-red-200"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5 inline" />
                          LN thấp
                        </Badge>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Materials Count Pill & Type */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md text-[11px] font-medium">
                      <Layers className="w-3 h-3 text-gray-400" />
                      {product.materialCount} nguyên liệu
                    </span>
                  </div>

                  {/* Cost & Price Row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div className="bg-gray-50/80 p-2 rounded-xl">
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Giá vốn
                      </span>
                      <span className="text-xs font-bold text-gray-800 mt-0.5 block truncate">
                        {formatVND(product.computedTotalCost)}
                      </span>
                    </div>

                    <div className="bg-purple-50 p-2 rounded-xl flex items-center justify-between border border-purple-100/60">
                      <div className="min-w-0">
                        <span className="text-[10px] text-purple-700 font-semibold block">
                          Giá bán
                        </span>
                        <span className="text-xs font-extrabold text-purple-950 mt-0.5 block truncate">
                          {formatVND(product.computedPrice)}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for easy thumb reach on mobile */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button
          size="icon"
          className="w-13 h-13 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg active:scale-95 flex items-center justify-center p-0"
          asChild
        >
          <Link href="/products/new" aria-label="Thêm mẫu sản phẩm">
            <Plus className="w-6 h-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
