'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertTriangle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MATERIAL_GROUPS } from '@/lib/constants';
import { toast } from 'sonner';

export default function EditMaterialPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [baseUnit, setBaseUnit] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [note, setNote] = useState('');
  const [unitsLocked, setUnitsLocked] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchMaterial = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/materials/${id}`);
        if (!res.ok) {
          throw new Error('Không thể tải thông tin nguyên liệu');
        }
        const data = await res.json();

        setName(data.name || '');
        setGroup(data.group || '');
        setBaseUnit(data.baseUnit || '');
        setPurchaseUnit(data.purchaseUnit || '');
        setConversionFactor(data.conversionFactor?.toString() || '1');
        setMinStock(data.minStock?.toString() || '0');
        setNote(data.note || '');

        // If has stock movements or purchase lines, lock units
        const hasHistory =
          (data.stockMovements && data.stockMovements.length > 0) ||
          (data.purchaseLines && data.purchaseLines.length > 0);
        setUnitsLocked(hasHistory);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Lỗi khi tải dữ liệu nguyên liệu');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Vui lòng nhập tên nguyên liệu');
      return;
    }

    if (!group) {
      toast.error('Vui lòng chọn nhóm nguyên liệu');
      return;
    }

    const min = parseFloat(minStock || '0');
    if (isNaN(min) || min < 0) {
      toast.error('Định mức tồn tối thiểu không được âm');
      return;
    }

    const payload: Record<string, any> = {
      name: name.trim(),
      group,
      minStock: min,
      note: note.trim() || null,
    };

    if (!unitsLocked) {
      if (!baseUnit.trim()) {
        toast.error('Vui lòng nhập đơn vị cơ bản');
        return;
      }
      if (!purchaseUnit.trim()) {
        toast.error('Vui lòng nhập đơn vị nhập');
        return;
      }
      const factor = parseFloat(conversionFactor);
      if (isNaN(factor) || factor <= 0) {
        toast.error('Hệ số quy đổi phải lớn hơn 0');
        return;
      }
      payload.baseUnit = baseUnit.trim();
      payload.purchaseUnit = purchaseUnit.trim();
      payload.conversionFactor = factor;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật nguyên liệu');
      }

      toast.success('Đã cập nhật nguyên liệu thành công');
      router.push(`/inventory/materials/${id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi cập nhật nguyên liệu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa nguyên liệu');
      }

      toast.success(data.message || 'Đã xóa nguyên liệu thành công');
      setShowDeleteDialog(false);
      router.push('/inventory');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi xóa nguyên liệu');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <Skeleton className="h-8 w-36 rounded-md" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 pr-3 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span>Hủy & Quay lại</span>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl gap-1.5 h-9"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Xóa</span>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Chỉnh sửa nguyên liệu</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cập nhật thông tin chi tiết của nguyên liệu
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Tên nguyên liệu <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Hoa hồng sáp đỏ 3 lớp"
                className="h-11 rounded-xl"
                required
              />
            </div>

            {/* Group */}
            <div className="space-y-1.5">
              <Label htmlFor="group" className="text-sm font-medium text-gray-700">
                Nhóm nguyên liệu <span className="text-red-500">*</span>
              </Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger id="group" className="h-11 rounded-xl">
                  <SelectValue placeholder="Chọn phân loại..." />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Units and Conversion Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Đơn vị tính & Quy đổi</h3>
              {unitsLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Lock className="w-3 h-3 text-amber-600" /> Đã khóa đơn vị
                </span>
              )}
            </div>

            {unitsLocked && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Không thể thay đổi đơn vị tính và hệ số quy đổi vì nguyên liệu này đã có phát sinh giao dịch nhập/xuất kho.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Base Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="baseUnit" className="text-xs font-medium text-gray-700">
                  Đơn vị cơ bản (SX)
                </Label>
                <Input
                  id="baseUnit"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  disabled={unitsLocked}
                  className="h-11 rounded-xl disabled:bg-gray-100 disabled:text-gray-500"
                  required
                />
              </div>

              {/* Purchase Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="purchaseUnit" className="text-xs font-medium text-gray-700">
                  Đơn vị nhập hàng
                </Label>
                <Input
                  id="purchaseUnit"
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                  disabled={unitsLocked}
                  className="h-11 rounded-xl disabled:bg-gray-100 disabled:text-gray-500"
                  required
                />
              </div>
            </div>

            {/* Conversion Factor */}
            <div className="space-y-1.5">
              <Label htmlFor="conversionFactor" className="text-xs font-medium text-gray-700">
                Hệ số quy đổi
              </Label>
              <Input
                id="conversionFactor"
                type="number"
                step="any"
                min="0.0001"
                inputMode="decimal"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(e.target.value)}
                disabled={unitsLocked}
                className="h-11 rounded-xl disabled:bg-gray-100 disabled:text-gray-500"
                required
              />
              <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  1 {purchaseUnit.trim() || 'đơn vị nhập'} ={' '}
                  {conversionFactor || '1'} {baseUnit.trim() || 'đơn vị cơ bản'}
                </span>
              </p>
            </div>

            {/* Min Stock */}
            <div className="space-y-1.5">
              <Label htmlFor="minStock" className="text-xs font-medium text-gray-700">
                Định mức tồn tối thiểu ({baseUnit || 'đơn vị cơ bản'})
              </Label>
              <Input
                id="minStock"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="0"
                className="h-11 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Note Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-4 space-y-1.5">
            <Label htmlFor="note" className="text-sm font-medium text-gray-700">
              Ghi chú thêm
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Nhà cung cấp thường mua, lưu ý bảo quản..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-gray-200"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5 shadow-sm"
            disabled={submitting}
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-2xl max-w-sm sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold text-gray-900">
              Xác nhận xóa nguyên liệu
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Bạn có chắc chắn muốn xóa nguyên liệu{' '}
              <strong className="text-gray-900">{name}</strong>?
              Hành động này không thể hoàn tác nếu đã phát sinh dữ liệu đơn hàng liên quan.
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
              {deleting ? 'Đang xóa...' : 'Xóa nguyên liệu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
