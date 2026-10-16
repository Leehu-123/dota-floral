'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MATERIAL_GROUPS } from '@/lib/constants';
import { toast } from 'sonner';

export default function NewMaterialPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [baseUnit, setBaseUnit] = useState('bông');
  const [purchaseUnit, setPurchaseUnit] = useState('túi');
  const [conversionFactor, setConversionFactor] = useState('50');
  const [minStock, setMinStock] = useState('0');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    if (!baseUnit.trim()) {
      toast.error('Vui lòng nhập đơn vị cơ bản');
      return;
    }

    if (!purchaseUnit.trim()) {
      toast.error('Vui lòng nhập đơn vị nhập hàng');
      return;
    }

    const factor = parseFloat(conversionFactor);
    if (isNaN(factor) || factor <= 0) {
      toast.error('Hệ số quy đổi phải lớn hơn 0');
      return;
    }

    const min = parseFloat(minStock || '0');
    if (isNaN(min) || min < 0) {
      toast.error('Định mức tồn tối thiểu không được âm');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          group,
          baseUnit: baseUnit.trim(),
          purchaseUnit: purchaseUnit.trim(),
          conversionFactor: factor,
          minStock: min,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo nguyên liệu');
      }

      toast.success('Đã thêm nguyên liệu thành công');
      router.push('/inventory');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tạo nguyên liệu');
    } finally {
      setSubmitting(false);
    }
  };

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
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Thêm nguyên liệu mới</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tạo thông tin vật tư, đơn vị tính và định mức quy đổi
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Material Name */}
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

            {/* Material Group */}
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
            <h3 className="text-sm font-semibold text-gray-800">Đơn vị tính & Quy đổi</h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Base Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="baseUnit" className="text-xs font-medium text-gray-700">
                  Đơn vị cơ bản (SX) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="baseUnit"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  placeholder="VD: bông, cành, mét"
                  className="h-11 rounded-xl"
                  required
                />
              </div>

              {/* Purchase Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="purchaseUnit" className="text-xs font-medium text-gray-700">
                  Đơn vị nhập hàng <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="purchaseUnit"
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                  placeholder="VD: túi, hộp, cuộn"
                  className="h-11 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Conversion Factor */}
            <div className="space-y-1.5">
              <Label htmlFor="conversionFactor" className="text-xs font-medium text-gray-700">
                Hệ số quy đổi <span className="text-red-500">*</span>
              </Label>
              <Input
                id="conversionFactor"
                type="number"
                step="any"
                min="0.0001"
                inputMode="decimal"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(e.target.value)}
                placeholder="50"
                className="h-11 rounded-xl"
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
              <p className="text-[11px] text-muted-foreground">
                Hệ thống cảnh báo khi tồn kho giảm xuống dưới mức này.
              </p>
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
            {submitting ? 'Đang lưu...' : 'Lưu nguyên liệu'}
          </Button>
        </div>
      </form>
    </div>
  );
}
