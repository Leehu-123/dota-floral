'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Truck,
  ArrowRight,
  Package,
  Calendar,
  Layers,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatVND, formatDate } from '@/lib/format';
import { toast } from 'sonner';

interface PurchaseLine {
  id: string;
  materialId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  convertedQty: number;
  material?: {
    name: string;
    purchaseUnit: string;
    baseUnit: string;
  };
}

interface Purchase {
  id: string;
  date: string;
  supplierName: string;
  shippingCost: number;
  totalAmount: number;
  note?: string | null;
  lines: PurchaseLine[];
}

export default function PurchasesPage() {
  const router = useRouter();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/purchases');
      if (!res.ok) {
        throw new Error('Không thể tải danh sách phiếu nhập hàng');
      }
      const data = await res.json();
      setPurchases(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tải danh sách nhập hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const filteredPurchases = purchases.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.supplierName.toLowerCase().includes(term) ||
      p.lines.some((l) => l.material?.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-purple-950">
            Phiếu nhập hàng
          </h1>
          <p className="text-xs text-purple-800 font-semibold mt-0.5">
            Lịch sử nhập nguyên vật liệu và quản lý chi phí
          </p>
        </div>

        <Button
          size="sm"
          className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm gap-1.5 h-10 font-bold px-4"
          asChild
        >
          <Link href="/purchases/new">
            <Plus className="w-4 h-4" />
            <span>Tạo phiếu mới</span>
          </Link>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600 pointer-events-none" />
        <Input
          type="search"
          placeholder="Tìm nhà cung cấp, nguyên liệu đã nhập..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-white rounded-xl border-purple-200/80 font-medium focus-visible:ring-purple-500"
        />
      </div>

      {/* Purchases List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-2xl border border-purple-100 shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-40 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-4 w-20 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-2 border-purple-200 bg-purple-50/20">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-4xl">🚚</div>
              <div className="space-y-1">
                <p className="text-base font-bold text-gray-800">
                  {search
                    ? 'Không tìm thấy phiếu nhập nào phù hợp'
                    : 'Chưa có phiếu nhập hàng nào'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {search
                    ? 'Thử tìm với tên nhà cung cấp hoặc từ khóa khác'
                    : 'Ghi nhận đợt mua hàng đầu tiên để cập nhật tồn kho và giá vốn'}
                </p>
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 px-4"
                  asChild
                >
                  <Link href="/purchases/new">
                    <Plus className="w-4 h-4 mr-1.5" /> Tạo phiếu nhập mới
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredPurchases.map((purchase) => {
            const itemCount = purchase.lines?.length || 0;
            const shipping = Number(purchase.shippingCost);

            return (
              <Card
                key={purchase.id}
                onClick={() => router.push(`/purchases/${purchase.id}`)}
                className="rounded-2xl border border-purple-100 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer active:scale-[0.99] bg-white overflow-hidden"
              >
                <CardContent className="p-4 space-y-2.5">
                  {/* Top row: Date + Supplier */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-purple-700 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{formatDate(purchase.date)}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-base truncate">
                        {purchase.supplierName}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-purple-950">
                        {formatVND(purchase.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom row: Items count + Shipping info */}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-50 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-bold px-2 py-0.5 bg-[#d4c8ee]/60 text-purple-950 border-none"
                      >
                        <Package className="w-3 h-3 mr-1 text-purple-800" />
                        {itemCount} mặt hàng
                      </Badge>

                      {shipping > 0 && (
                        <span className="text-[11px] text-gray-600 font-medium flex items-center gap-1">
                          <Truck className="w-3 h-3 text-purple-500" />
                          Ship: {formatVND(shipping)}
                        </span>
                      )}
                    </div>

                    <div className="text-purple-700 font-bold flex items-center gap-1 hover:underline">
                      <span>Chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
