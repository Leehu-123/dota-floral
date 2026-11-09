'use client';

import { useState, useEffect } from 'react';
import {
  PackagePlus,
  Sparkles,
  Save,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MATERIAL_GROUPS } from '@/lib/constants';
import { toast } from 'sonner';

export interface CreatedMaterial {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  currentStock: number;
  avgCost: number;
  minStock?: number;
}

interface QuickCreateMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (material: CreatedMaterial) => void;
}

// Smart presets per material group for quick filling
const GROUP_PRESETS: Record<
  string,
  { purchaseUnit: string; baseUnit: string; factor: string }
> = {
  hoa_sap: { purchaseUnit: 'hộp', baseUnit: 'bông', factor: '50' },
  hoa_lua: { purchaseUnit: 'cành', baseUnit: 'bông', factor: '5' },
  cot_hoa: { purchaseUnit: 'cái', baseUnit: 'cái', factor: '1' },
  phu_kien: { purchaseUnit: 'cuộn', baseUnit: 'mét', factor: '20' },
  bao_bi: { purchaseUnit: 'xấp', baseUnit: 'tờ', factor: '20' },
  vat_tu_khac: { purchaseUnit: 'cái', baseUnit: 'cái', factor: '1' },
};

const COMMON_PURCHASE_UNITS = ['hộp', 'bó', 'cuộn', 'xấp', 'túi', 'gói', 'cái', 'thùng'];
const COMMON_BASE_UNITS = ['bông', 'cành', 'tờ', 'mét', 'cái', 'nhánh', 'que'];

export function QuickCreateMaterialDialog({
  open,
  onOpenChange,
  initialName = '',
  onCreated,
}: QuickCreateMaterialDialogProps) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('hoa_sap');
  const [purchaseUnit, setPurchaseUnit] = useState('hộp');
  const [baseUnit, setBaseUnit] = useState('bông');
  const [conversionFactor, setConversionFactor] = useState('50');
  const [minStock, setMinStock] = useState('0');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync initial name when opened
  useEffect(() => {
    if (open) {
      if (initialName && initialName.trim()) {
        setName(initialName.trim());
      } else {
        setName('');
      }
      // Default to hoa_sap
      const preset = GROUP_PRESETS['hoa_sap'];
      setGroup('hoa_sap');
      setPurchaseUnit(preset.purchaseUnit);
      setBaseUnit(preset.baseUnit);
      setConversionFactor(preset.factor);
      setMinStock('0');
      setNote('');
    }
  }, [open, initialName]);

  // Apply group preset when group changes
  const handleSelectGroup = (gVal: string) => {
    setGroup(gVal);
    const preset = GROUP_PRESETS[gVal];
    if (preset) {
      setPurchaseUnit(preset.purchaseUnit);
      setBaseUnit(preset.baseUnit);
      setConversionFactor(preset.factor);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên nguyên liệu');
      return;
    }

    if (!group) {
      toast.error('Vui lòng chọn nhóm nguyên liệu');
      return;
    }

    const trimmedBase = baseUnit.trim();
    if (!trimmedBase) {
      toast.error('Vui lòng nhập đơn vị cơ bản (SX)');
      return;
    }

    const trimmedPurchase = purchaseUnit.trim();
    if (!trimmedPurchase) {
      toast.error('Vui lòng nhập đơn vị nhập hàng');
      return;
    }

    const factor = parseFloat(conversionFactor.replace(',', '.'));
    if (isNaN(factor) || factor <= 0) {
      toast.error('Hệ số quy đổi phải lớn hơn 0');
      return;
    }

    const min = parseFloat(minStock ? minStock.replace(',', '.') : '0');

    try {
      setSubmitting(true);
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          group,
          baseUnit: trimmedBase,
          purchaseUnit: trimmedPurchase,
          conversionFactor: factor,
          minStock: isNaN(min) || min < 0 ? 0 : min,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo nguyên liệu mới');
      }

      toast.success(`Đã thêm "${trimmedName}" và chọn vào phiếu nhập!`);
      onCreated(data);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi tạo nguyên liệu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 rounded-3xl overflow-hidden max-h-[92vh] flex flex-col border border-purple-200 shadow-2xl">
        <DialogHeader className="p-4 pb-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 via-white to-purple-50/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-black text-purple-950 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <PackagePlus className="w-4 h-4" />
              </div>
              <div>
                <span>Thêm nguyên liệu mới vào kho</span>
                <span className="block text-[11px] font-normal text-purple-700 mt-0.5">
                  Tạo nhanh trực tiếp & tự động chọn vào phiếu nhập
                </span>
              </div>
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Tên nguyên liệu */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-mat-name" className="text-xs font-bold text-gray-800">
              Tên nguyên liệu mới <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="quick-mat-name"
              type="text"
              required
              autoFocus
              placeholder="VD: Hoa hồng sáp đỏ 3 lớp, Giấy nhún vàng, Ruy băng gân..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl text-sm font-semibold border-purple-200 focus-visible:ring-purple-500"
            />
          </div>

          {/* 2. Nhóm nguyên liệu */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-gray-800">
                Nhóm nguyên liệu <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[10px] text-purple-700">Tự động gợi ý đơn vị tính</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MATERIAL_GROUPS.map((g) => {
                const isSelected = group === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => handleSelectGroup(g.value)}
                    className={`h-9 px-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs scale-[1.02]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Đơn vị tính & Quy đổi */}
          <div className="p-3.5 bg-purple-50/40 rounded-2xl border border-purple-100 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Đơn vị tính & Tỉ lệ quy đổi</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Đơn vị nhập */}
              <div className="space-y-1.5">
                <Label htmlFor="quick-purchase-unit" className="text-[11px] font-semibold text-gray-700">
                  Đơn vị mua vào (Hóa đơn) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="quick-purchase-unit"
                  type="text"
                  required
                  placeholder="hộp, bó, xấp..."
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-white border-purple-200 font-semibold"
                />
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {COMMON_PURCHASE_UNITS.slice(0, 5).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setPurchaseUnit(u)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        purchaseUnit === u
                          ? 'bg-purple-600 text-white border-purple-600 font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Đơn vị cơ bản (SX) */}
              <div className="space-y-1.5">
                <Label htmlFor="quick-base-unit" className="text-[11px] font-semibold text-gray-700">
                  Đơn vị xuất cắm bó (SX) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="quick-base-unit"
                  type="text"
                  required
                  placeholder="bông, cành, tờ..."
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-white border-purple-200 font-semibold"
                />
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {COMMON_BASE_UNITS.slice(0, 5).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setBaseUnit(u)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        baseUnit === u
                          ? 'bg-purple-600 text-white border-purple-600 font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hệ số quy đổi */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="quick-factor" className="text-[11px] font-semibold text-gray-700">
                1 {purchaseUnit.trim() || 'đơn vị mua'} có bao nhiêu {baseUnit.trim() || 'đơn vị cắm'}? <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="quick-factor"
                    type="number"
                    step="any"
                    min="0.0001"
                    inputMode="decimal"
                    required
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value)}
                    className="h-10 rounded-xl text-sm font-bold text-purple-950 bg-white border-purple-200"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {['1', '10', '20', '50'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setConversionFactor(f)}
                      className={`h-10 px-2.5 rounded-xl border text-xs font-bold transition-colors ${
                        conversionFactor === f
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic conversion helper banner */}
              <div className="p-2.5 rounded-xl bg-purple-100/70 border border-purple-200 text-xs text-purple-950 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                <span>
                  Quy đổi: <strong>1 {purchaseUnit.trim() || 'đơn vị mua'}</strong> ={' '}
                  <strong className="text-purple-700 underline">
                    {conversionFactor || '1'} {baseUnit.trim() || 'đơn vị cắm'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* 4. Ghi chú (tùy chọn) */}
          <div className="space-y-1">
            <Label htmlFor="quick-note" className="text-xs font-semibold text-gray-700">
              Ghi chú thêm (Tùy chọn)
            </Label>
            <Input
              id="quick-note"
              type="text"
              placeholder="VD: Nhà cung cấp thường lấy, màu sắc đặc biệt..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>
        </form>

        <DialogFooter className="p-4 pt-3 border-t border-purple-100 bg-gray-50/50 flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-initial h-11 rounded-xl border-gray-200 text-xs font-semibold"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting || !name.trim()}
            className="flex-1 sm:flex-initial h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5 shadow-sm px-5"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Đang tạo...' : 'Lưu & Chọn vào phiếu'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
