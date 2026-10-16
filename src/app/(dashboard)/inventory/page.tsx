'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  ClipboardList,
  Download,
  AlertTriangle,
  Layers,
  Flower2,
  Package,
  Store,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { formatVND, formatQty } from '@/lib/format';
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
  imageUrl?: string | null;
  note?: string | null;
  status: 'ok' | 'low' | 'out';
}

interface ProductItem {
  id: string;
  name: string;
  description?: string | null;
  suggestedPrice: number;
  totalCost: number;
  stock: number;
  actualMargin?: number;
}

export default function InventoryPage() {
  const router = useRouter();

  // Active top tab: 'materials' (Nguyên vật liệu) vs 'products' (Hoa thành phẩm)
  const [activeTab, setActiveTab] = useState<'materials' | 'products'>('materials');

  // Materials state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Finished Products state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Fetch materials
  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const res = await fetch('/api/materials');
      if (!res.ok) throw new Error('Không thể tải danh sách nguyên liệu');
      const data = await res.json();
      setMaterials(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tải dữ liệu nguyên liệu');
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Không thể tải danh sách hoa thành phẩm');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.products || [];
      setProducts(list);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tải dữ liệu sản phẩm');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchProducts();
  }, []);

  // Summary stats for finished goods
  const totalFinishedStock = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  }, [products]);

  const totalFinishedCostValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.totalCost) || 0), 0);
  }, [products]);

  const totalFinishedRetailValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.suggestedPrice) || 0), 0);
  }, [products]);

  // Materials low stock count
  const lowStockCount = useMemo(() => {
    return materials.filter(
      (m) => Number(m.currentStock) <= Number(m.minStock)
    ).length;
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesSearch =
        materialSearch.trim() === '' ||
        material.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        material.baseUnit.toLowerCase().includes(materialSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedGroupFilter === 'all') return true;
      if (selectedGroupFilter === 'low_stock') {
        return Number(material.currentStock) <= Number(material.minStock);
      }
      return material.group === selectedGroupFilter;
    });
  }, [materials, materialSearch, selectedGroupFilter]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        productSearch.trim() === '' ||
        prod.name.toLowerCase().includes(productSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (productFilter === 'in_stock') {
        return Number(prod.stock) > 0;
      }
      if (productFilter === 'out_of_stock') {
        return Number(prod.stock) <= 0;
      }
      return true;
    });
  }, [products, productSearch, productFilter]);

  // Stock badge helper for materials
  const renderMaterialStockBadge = (material: Material) => {
    const stock = Number(material.currentStock);
    const min = Number(material.minStock);

    if (stock <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Hết hàng ({formatQty(stock)} {material.baseUnit})
        </span>
      );
    }
    if (stock <= min) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Sắp hết: {formatQty(stock)} {material.baseUnit}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Tồn: {formatQty(stock)} {material.baseUnit}
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Page Title & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quản lý kho</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nguyên vật liệu & Hoa bó sẵn tại tiệm
          </p>
        </div>
        {activeTab === 'materials' ? (
          <Button
            size="sm"
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm gap-1.5 h-9"
            asChild
          >
            <Link href="/inventory/materials/new">
              <Plus className="w-4 h-4" />
              <span>Thêm vật tư</span>
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm gap-1.5 h-9"
            asChild
          >
            <Link href="/products/new">
              <Plus className="w-4 h-4" />
              <span>Thêm mẫu</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Main Mode Switcher: Nguyên vật liệu vs Hoa thành phẩm */}
      <div className="grid grid-cols-2 p-1 bg-gray-100/80 rounded-2xl border border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('materials')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'materials'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className={`w-4 h-4 ${activeTab === 'materials' ? 'text-rose-600' : ''}`} />
          <span>Nguyên vật liệu ({materials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'products'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Flower2 className={`w-4 h-4 ${activeTab === 'products' ? 'text-rose-600' : ''}`} />
          <span>Hoa có sẵn ({totalFinishedStock} bó)</span>
        </button>
      </div>

      {/* TAB 1: NGUYÊN VẬT LIỆU */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Tìm tên nguyên liệu, đơn vị..."
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              className="pl-10 h-11 bg-white rounded-xl border-gray-200 shadow-sm"
            />
          </div>

          {/* Group Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            <button
              onClick={() => setSelectedGroupFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedGroupFilter === 'all'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tất cả ({materials.length})
            </button>

            <button
              onClick={() => setSelectedGroupFilter('low_stock')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                selectedGroupFilter === 'low_stock'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>Sắp hết</span>
              {lowStockCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    selectedGroupFilter === 'low_stock'
                      ? 'bg-rose-200 text-rose-800'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {lowStockCount}
                </span>
              )}
            </button>

            {MATERIAL_GROUPS.map((group) => {
              const isSelected = selectedGroupFilter === group.value;
              return (
                <button
                  key={group.value}
                  onClick={() => setSelectedGroupFilter(group.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                    isSelected
                      ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          {/* Materials List */}
          <div>
            {loadingMaterials ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="rounded-xl border border-gray-100 shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <Skeleton className="h-4 w-24 rounded-md" />
                        <Skeleton className="h-4 w-28 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredMaterials.length === 0 ? (
              <Card className="rounded-xl border-dashed border-2 border-gray-200">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="text-4xl">📦</div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-800">
                      {materialSearch
                        ? 'Không tìm thấy nguyên liệu phù hợp'
                        : 'Chưa có nguyên liệu nào'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {materialSearch
                        ? 'Hãy thử tìm kiếm với từ khóa khác'
                        : 'Bắt đầu bằng cách thêm nguyên liệu mới hoặc nhập hàng'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                      asChild
                    >
                      <Link href="/inventory/materials/new">
                        <Plus className="w-4 h-4 mr-1.5" /> Thêm nguyên liệu
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredMaterials.map((material) => (
                  <Card
                    key={material.id}
                    onClick={() => router.push(`/inventory/materials/${material.id}`)}
                    className="rounded-xl border border-gray-100 shadow-xs hover:shadow-md hover:border-rose-100 transition-all cursor-pointer active:scale-[0.99] bg-white overflow-hidden"
                  >
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {material.name}
                        </h3>
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[11px] font-normal px-2 py-0.5 bg-gray-100 text-gray-600 border-none"
                      >
                        {getLabel(MATERIAL_GROUPS, material.group)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div>{renderMaterialStockBadge(material)}</div>

                      <div className="text-right">
                        <span className="text-muted-foreground">Giá vốn: </span>
                        <span className="font-medium text-gray-900">
                          {formatVND(material.avgCost)}
                          <span className="text-[11px] text-muted-foreground font-normal">
                            /{material.baseUnit}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            )}
          </div>

          {/* Bottom Action Buttons for Raw Materials */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl h-12 border-gray-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shadow-xs active:scale-[0.98]"
              asChild
            >
              <Link href="/inventory/stock-check">
                <ClipboardList className="w-5 h-5 mr-2 text-rose-600" />
                Kiểm kho NVL
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl h-12 border-gray-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shadow-xs active:scale-[0.98]"
              asChild
            >
              <Link href="/purchases/new">
                <Download className="w-5 h-5 mr-2 text-rose-600" />
                Nhập hàng NVL
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: HOA THÀNH PHẨM (MAKE-TO-STOCK AT STORE) */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Quick Metrics Header Card */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="rounded-2xl border-rose-100 bg-gradient-to-br from-rose-50/70 to-pink-50/50 p-3 text-center">
              <span className="text-[10px] font-medium text-rose-600 uppercase block">
                Tổng có sẵn
              </span>
              <span className="text-lg font-black text-rose-900 block mt-0.5">
                {totalFinishedStock} <span className="text-xs font-normal">bó</span>
              </span>
            </Card>

            <Card className="rounded-2xl border-gray-100 bg-white p-3 text-center">
              <span className="text-[10px] font-medium text-gray-500 uppercase block">
                Vốn tồn sẵn
              </span>
              <span className="text-xs font-bold text-gray-900 block mt-1 truncate">
                {formatVND(totalFinishedCostValue)}
              </span>
            </Card>

            <Card className="rounded-2xl border-gray-100 bg-white p-3 text-center">
              <span className="text-[10px] font-medium text-emerald-600 uppercase block">
                Dự kiến bán
              </span>
              <span className="text-xs font-bold text-emerald-700 block mt-1 truncate">
                {formatVND(totalFinishedRetailValue)}
              </span>
            </Card>
          </div>

          {/* Search Input for finished bouquets */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Tìm mẫu hoa bó sẵn..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10 h-11 bg-white rounded-xl border-gray-200 shadow-sm"
            />
          </div>

          {/* Filter Pills for Finished Products */}
          <div className="flex gap-2">
            <button
              onClick={() => setProductFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                productFilter === 'all'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tất cả ({products.length})
            </button>
            <button
              onClick={() => setProductFilter('in_stock')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                productFilter === 'in_stock'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Đang có sẵn tại tiệm ({products.filter((p) => p.stock > 0).length})
            </button>
            <button
              onClick={() => setProductFilter('out_of_stock')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                productFilter === 'out_of_stock'
                  ? 'bg-gray-100 border-gray-300 text-gray-800 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Hết hàng sẵn
            </button>
          </div>

          {/* Finished Bouquet Cards */}
          <div>
            {loadingProducts ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="rounded-xl border border-gray-100 shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-40 rounded-md" />
                      <Skeleton className="h-4 w-28 rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="rounded-xl border-dashed border-2 border-gray-200">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="text-4xl">🌸</div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-800">
                      {productSearch
                        ? 'Không tìm thấy mẫu hoa nào'
                        : 'Chưa có hoa thành phẩm'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bó sẵn hoa từ nguyên liệu trong kho để trưng bày và bán ngay tại tiệm
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredProducts.map((prod) => {
                const stock = Number(prod.stock) || 0;
                return (
                  <Card
                    key={prod.id}
                    className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all bg-white overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 text-sm truncate">
                            {prod.name}
                          </h3>
                          {prod.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {prod.description}
                            </p>
                          )}
                        </div>

                        {/* Stock badge */}
                        {stock > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Có sẵn {stock} bó
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Hết bó sẵn
                          </span>
                        )}
                      </div>

                      {/* Pricing and Costs */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50/70 rounded-xl text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Giá bán tiệm:</span>
                          <span className="font-bold text-rose-600 text-sm">
                            {formatVND(prod.suggestedPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Giá vốn/bó:</span>
                          <span className="font-semibold text-gray-800">
                            {formatVND(prod.totalCost)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/products/${prod.id}`)}
                          className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 rounded-xl"
                        >
                          <span>Xem công thức & lịch sử</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => router.push(`/products/${prod.id}`)}
                          className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-3 gap-1 shadow-xs active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Bó sẵn vào kho</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
