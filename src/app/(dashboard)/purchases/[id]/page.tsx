'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Truck,
  Trash2,
  Package,
  Layers,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatVND, formatQty, formatDate } from '@/lib/format';
import { toast } from 'sonner';

interface PurchaseLine {
  id: string;
  materialId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  convertedQty: number;
  material?: {
    id: string;
    name: string;
    group: string;
    baseUnit: string;
    purchaseUnit: string;
    conversionFactor: number;
  };
}

interface PurchaseDetail {
  id: string;
  date: string;
  supplierName: string;
  shippingCost: number;
  totalAmount: number;
  note?: string | null;
  supplier?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  lines: PurchaseLine[];
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Không tìm thấy phiếu nhập hàng');
          }
          throw new Error('Lỗi khi tải thông tin phiếu nhập');
        }
        const data = await res.json();
        setPurchase(data);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Không thể tải dữ liệu phiếu nhập');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi xóa phiếu nhập hàng');
      }

      toast.success(data.message || 'Đã xóa phiếu nhập hàng thành công');
      setShowDeleteDialog(false);
      router.push('/purchases');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Không thể xóa phiếu nhập');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-700 font-medium">Không tìm thấy phiếu nhập này</p>
        <Button variant="outline" onClick={() => router.push('/purchases')}>
          Quay lại danh sách phiếu nhập
        </Button>
      </div>
    );
  }

  const shippingCost = Number(purchase.shippingCost) || 0;
  const totalAmount = Number(purchase.totalAmount) || 0;
  const itemsSubtotal = totalAmount - shippingCost;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/purchases')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Danh sách phiếu nhập</span>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl gap-1.5 h-9"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Xóa phiếu</span>
        </Button>
      </div>

      {/* Main Info Card */}
      <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden bg-gradient-to-br from-white to-gray-50/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{formatDate(purchase.date)}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-0.5">
                {purchase.supplierName}
              </h1>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">
                Tổng thanh toán
              </span>
              <span className="text-lg font-black text-rose-600">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Details breakdown */}
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-gray-600">
              <span>Tiền hàng ({purchase.lines?.length || 0} mặt hàng):</span>
              <span className="font-semibold text-gray-900">
                {formatVND(itemsSubtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-gray-400" />
                Phí vận chuyển:
              </span>
              <span className="font-semibold text-gray-900">
                {formatVND(shippingCost)}
              </span>
            </div>
            {purchase.note && (
              <div className="pt-1.5 border-t border-gray-200/60 text-gray-700">
                <span className="text-muted-foreground block text-[11px] mb-0.5">
                  Ghi chú:
                </span>
                <p className="whitespace-pre-wrap">{purchase.note}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lines Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-500" />
            Chi tiết nguyên liệu nhập
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            {purchase.lines?.length || 0} mục
          </span>
        </div>

        <div className="space-y-2.5">
          {purchase.lines?.map((line, idx) => {
            const mat = line.material;
            const purchaseUnit = mat?.purchaseUnit || 'đv';
            const baseUnit = mat?.baseUnit || 'đv';

            return (
              <Card
                key={line.id || idx}
                className="rounded-2xl border-gray-100 shadow-xs bg-white overflow-hidden"
              >
                <CardContent className="p-4 space-y-2.5">
                  {/* Line title & Line total */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {mat?.id ? (
                        <Link
                          href={`/inventory/materials/${mat.id}`}
                          className="font-bold text-sm text-gray-900 hover:text-rose-600 transition-colors truncate block"
                        >
                          {mat.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-sm text-gray-900 truncate block">
                          {mat?.name || 'Nguyên liệu'}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-sm text-gray-900">
                        {formatVND(line.lineTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Unit price breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-50 text-gray-600">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Số lượng nhập:
                      </span>
                      <span className="font-medium text-gray-800">
                        {formatQty(line.quantity)} {purchaseUnit}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-muted-foreground block text-[11px]">
                        Đơn giá nhập:
                      </span>
                      <span className="font-medium text-gray-800">
                        {formatVND(line.unitPrice)}/{purchaseUnit}
                      </span>
                    </div>
                  </div>

                  {/* Converted stock preview */}
                  <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-100 flex items-center justify-between text-[11px]">
                    <span className="text-rose-700">Quy đổi vào tồn kho:</span>
                    <span className="font-bold text-rose-800">
                      +{formatQty(line.convertedQty)} {baseUnit}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-2xl max-w-sm sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Xóa phiếu nhập hàng?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Hệ thống sẽ tự động trừ lại số lượng tồn kho đã nhập và tính toán lại giá vốn bình quân gia quyền cho các nguyên vật liệu liên quan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2.5 pt-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
