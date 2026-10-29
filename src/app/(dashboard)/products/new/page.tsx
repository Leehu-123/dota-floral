'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  DollarSign,
  Layers,
  Sparkles,
  TrendingUp,
  Search,
  Check,
  AlertTriangle,
  Info,
  Clock,
  Package,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';
import { formatVND, formatQty } from '@/lib/format';
import { toast } from 'sonner';

interface MaterialOption {
  id: string;
  name: string;
  group: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  minStock: number;
  avgCost: number;
  currentStock: number;
  status: 'ok' | 'low' | 'out';
}

interface RecipeItem {
  id: string; // client id for key
  materialId: string;
  quantity: number | string;
}

export default function NewProductPage() {
  const router = useRouter();

  // Settings & Materials state
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [roundingStep, setRoundingStep] = useState<number>(5000);

  // Form inputs
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [laborCost, setLaborCost] = useState<number | string>(30000);
  const [overheadPercent, setOverheadPercent] = useState<number | string>(10);
  const [targetMargin, setTargetMargin] = useState<number | string>(40);

  // Recipe
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);

  // Price override
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [manualPrice, setManualPrice] = useState<number | string>('');

  // Material picker dialog
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerGroup, setPickerGroup] = useState<string>('all');

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch materials and settings on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingInitial(true);

        // Fetch materials
        const matRes = await fetch('/api/materials');
        if (matRes.ok) {
          const matData = await matRes.json();
          setMaterials(Array.isArray(matData) ? matData : []);
        }

        // Fetch settings
        const setRes = await fetch('/api/settings');
        if (setRes.ok) {
          const setData = await setRes.json();
          let settingsMap: Record<string, string> = {};

          if (Array.isArray(setData)) {
            setData.forEach((s: any) => {
              if (s.key) settingsMap[s.key] = s.value;
            });
          } else if (typeof setData === 'object' && setData !== null) {
            settingsMap = setData.settings || setData;
          }

          if (settingsMap.default_overhead_percent) {
            setOverheadPercent(Number(settingsMap.default_overhead_percent) || 10);
          }
          if (settingsMap.default_margin) {
            setTargetMargin(Number(settingsMap.default_margin) || 40);
          }
          if (settingsMap.price_rounding_step) {
            setRoundingStep(Number(settingsMap.price_rounding_step) || 5000);
          }
          if (settingsMap.labor_rate_per_hour) {
            setLaborCost(Number(settingsMap.labor_rate_per_hour) || 30000);
          }
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadInitialData();
  }, []);

  // 2. Real-time cost calculations
  const {
    materialCost,
    overheadCost,
    totalCost,
    suggestedPrice,
    effectivePrice,
    actualMargin,
    actualProfit,
  } = useMemo(() => {
    // A. Material Cost
    const matCost = recipe.reduce((sum, item) => {
      const mat = materials.find((m) => m.id === item.materialId);
      const qty = Number(item.quantity) || 0;
      const cost = Number(mat?.avgCost) || 0;
      return sum + qty * cost;
    }, 0);

    // B. Overhead Cost
    const ovhPercent = Number(overheadPercent) || 0;
    const ovhCost = Math.round((matCost * ovhPercent) / 100);

    // C. Total Cost
    const labor = Number(laborCost) || 0;
    const totCost = matCost + labor + ovhCost;

    // D. Suggested Price
    const margin = Number(targetMargin) || 0;
    let rawSuggested = 0;
    if (margin < 100 && totCost > 0) {
      rawSuggested = totCost / (1 - margin / 100);
    }
    const step = roundingStep > 0 ? roundingStep : 1000;
    const suggPrice =
      rawSuggested > 0 ? Math.ceil(rawSuggested / step) * step : 0;

    // E. Effective Price & Actual Profit / Margin
    const effPrice = isPriceOverridden
      ? Number(manualPrice) || 0
      : suggPrice;

    const profit = effPrice - totCost;
    const actMargin =
      effPrice > 0 ? ((effPrice - totCost) / effPrice) * 100 : 0;

    return {
      materialCost: matCost,
      overheadCost: ovhCost,
      totalCost: totCost,
      suggestedPrice: suggPrice,
      effectivePrice: effPrice,
      actualMargin: actMargin,
      actualProfit: profit,
    };
  }, [
    recipe,
    materials,
    laborCost,
    overheadPercent,
    targetMargin,
    roundingStep,
    isPriceOverridden,
    manualPrice,
  ]);

  // Handle adding material from picker
  const handleAddMaterial = (material: MaterialOption) => {
    const existingIndex = recipe.findIndex((r) => r.materialId === material.id);
    if (existingIndex >= 0) {
      // Increase qty by 1
      setRecipe((prev) =>
        prev.map((r, i) =>
          i === existingIndex
            ? { ...r, quantity: Number(r.quantity || 0) + 1 }
            : r
        )
      );
      toast.success(`Đã tăng số lượng ${material.name}`);
    } else {
      // Add new row
      setRecipe((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          materialId: material.id,
          quantity: 1,
        },
      ]);
      toast.success(`Đã thêm ${material.name}`);
    }
  };

  // Handle updating row quantity
  const handleUpdateQuantity = (index: number, quantity: string) => {
    setRecipe((prev) =>
      prev.map((r, i) => (i === index ? { ...r, quantity } : r))
    );
  };

  // Handle removing row
  const handleRemoveRecipeRow = (index: number) => {
    setRecipe((prev) => prev.filter((_, i) => i !== index));
  };

  // Filter materials for picker
  const filteredPickerMaterials = useMemo(() => {
    return materials.filter((m) => {
      const q = pickerSearch.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        m.name.toLowerCase().includes(q) ||
        m.baseUnit.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (pickerGroup === 'all') return true;
      return m.group === pickerGroup;
    });
  }, [materials, pickerSearch, pickerGroup]);

  // Margin color style
  const getMarginBadge = (margin: number) => {
    if (margin >= 30) {
      return {
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        textClass: 'text-emerald-700',
        dotClass: 'bg-emerald-500',
      };
    }
    if (margin >= 20) {
      return {
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        textClass: 'text-amber-700',
        dotClass: 'bg-amber-500',
      };
    }
    return {
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      textClass: 'text-rose-700',
      dotClass: 'bg-rose-500',
    };
  };

  const marginStyle = getMarginBadge(actualMargin);

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Vui lòng nhập tên mẫu sản phẩm');
      return;
    }

    if (recipe.length === 0) {
      toast.error('Vui lòng thêm ít nhất một nguyên liệu vào công thức');
      return;
    }

    // Check for invalid quantities
    const invalidQty = recipe.some(
      (r) => !r.quantity || Number(r.quantity) <= 0
    );
    if (invalidQty) {
      toast.error('Số lượng nguyên liệu phải lớn hơn 0');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl || null,
        type: 'template',
        laborCost: Number(laborCost) || 0,
        overheadPercent: Number(overheadPercent) || 0,
        targetMargin: Number(targetMargin) || 0,
        suggestedPrice: effectivePrice,
        materials: recipe.map((r) => ({
          materialId: r.materialId,
          quantity: Number(r.quantity),
        })),
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể tạo mẫu sản phẩm');
      }

      const created = await res.json();
      toast.success('Tạo mẫu sản phẩm thành công!');
      router.push(`/products/${created.id || ''}`);
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Lỗi khi lưu sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="space-y-4 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-6 w-48 rounded-md" />
        </div>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl h-9 w-9 p-0 text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tạo mẫu sản phẩm</h1>
          <p className="text-xs text-muted-foreground">
            Định lượng nguyên liệu và tính giá vốn bó hoa
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Basic Info */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span>🌸 Thông tin sản phẩm</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-gray-700">
                Tên mẫu bó hoa <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                required
                placeholder="VD: Bó hồng sáp 10 bông phong cách Hàn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-semibold text-gray-700">
                Mô tả chi tiết
              </Label>
              <Textarea
                id="desc"
                placeholder="Ghi chú màu sắc, phong cách gói, phụ kiện đi kèm..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-xl text-sm min-h-[70px]"
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label="Ảnh chụp sản phẩm thành phẩm"
                description="Chụp ảnh thực tế bó hoa hoặc tải ảnh mẫu từ máy để khách và thợ dễ xem"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. RECIPE (Công thức) SECTION */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <span>Công thức nguyên liệu</span>
                <Badge variant="secondary" className="text-[11px] px-2 py-0">
                  {recipe.length} mục
                </Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Định lượng từng thành phần tạo nên sản phẩm
              </p>
            </div>

            {/* Button opens Material Picker Modal */}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsPickerOpen(true)}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-3 gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm vật tư</span>
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {recipe.length === 0 ? (
              <div
                onClick={() => setIsPickerOpen(true)}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-rose-300 hover:bg-rose-50/30 transition-all space-y-2"
              >
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-gray-700">
                  Chưa có nguyên liệu nào trong công thức
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Bấm vào đây hoặc nút "Thêm vật tư" để chọn hoa, cốt, bao bì, phụ kiện
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recipe.map((row, index) => {
                  const mat = materials.find((m) => m.id === row.materialId);
                  const qty = Number(row.quantity) || 0;
                  const avgCost = Number(mat?.avgCost) || 0;
                  const lineCost = qty * avgCost;

                  return (
                    <div
                      key={row.id}
                      className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-rose-100 hover:shadow-xs transition-all space-y-2"
                    >
                      {/* Material name & remove button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">
                              {mat?.name || 'Nguyên liệu không xác định'}
                            </span>
                            {mat?.group && (
                              <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.2 rounded-md">
                                {getLabel(MATERIAL_GROUPS, mat.group)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>Giá vốn: {formatVND(avgCost)}/{mat?.baseUnit}</span>
                            <span>•</span>
                            <span>Tồn: {formatQty(mat?.currentStock)} {mat?.baseUnit}</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRecipeRow(index)}
                          className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Quantity input & Line Cost */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-medium">
                            Số lượng:
                          </span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="any"
                              min="0.0001"
                              inputMode="decimal"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(index, e.target.value)
                              }
                              className="h-8 w-20 px-2 text-center text-sm font-semibold rounded-lg bg-white"
                            />
                            <span className="text-xs text-gray-500 font-medium">
                              {mat?.baseUnit}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">
                            Thành tiền
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {formatVND(lineCost)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Subtotal of Materials */}
                <div className="pt-2 flex justify-between items-center px-1">
                  <span className="text-xs font-semibold text-gray-700">
                    Tổng tiền nguyên liệu (BOM):
                  </span>
                  <span className="text-sm font-bold text-rose-700">
                    {formatVND(materialCost)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. LABOR & OVERHEAD SETTINGS */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>Tiền công & Chi phí chung</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="labor" className="text-xs font-semibold text-gray-700">
                  Tiền công làm (VND)
                </Label>
                <Input
                  id="labor"
                  type="number"
                  inputMode="numeric"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Công cắm / bó / đóng gói
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="overhead" className="text-xs font-semibold text-gray-700">
                  Chi phí chung (%)
                </Label>
                <Input
                  id="overhead"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={overheadPercent}
                  onChange={(e) => setOverheadPercent(e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
                <span className="text-[10px] text-muted-foreground block">
                  = {formatVND(overheadCost)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="margin" className="text-xs font-semibold text-gray-700">
                  Biên lợi nhuận mục tiêu (%)
                </Label>
                <span className="text-xs font-bold text-rose-700">
                  {targetMargin}%
                </span>
              </div>
              <Input
                id="margin"
                type="number"
                step="1"
                inputMode="numeric"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                className="h-11 rounded-xl text-sm font-medium"
              />
              <span className="text-[10px] text-muted-foreground block">
                Công thức: Giá bán = Giá vốn / (1 - %LN). Làm tròn {formatVND(roundingStep)}.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. REAL-TIME COST CALCULATION & PRICING */}
        <Card className="rounded-xl border border-rose-200 shadow-sm bg-linear-to-br from-white to-rose-50/40 overflow-hidden">
          <CardHeader className="p-4 pb-2 bg-rose-50/60 border-b border-rose-100">
            <CardTitle className="text-sm font-bold text-rose-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-rose-600" />
                Tính giá thành thời gian thực (Live Cost)
              </span>
              <div
                className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${marginStyle.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${marginStyle.dotClass}`} />
                <span>LN: {actualMargin.toFixed(1)}%</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Live breakdown table */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>1. Tiền nguyên liệu:</span>
                <span className="font-semibold text-gray-900">
                  {formatVND(materialCost)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>2. Tiền công:</span>
                <span className="font-semibold text-gray-900">
                  {formatVND(Number(laborCost) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>3. Chi phí chung ({overheadPercent}%):</span>
                <span className="font-semibold text-gray-900">
                  {formatVND(overheadCost)}
                </span>
              </div>

              <div className="pt-2 border-t border-rose-100 flex justify-between items-center text-sm">
                <span className="font-bold text-rose-900">
                  TỔNG GIÁ VỐN:
                </span>
                <span className="text-base font-black text-rose-700">
                  {formatVND(totalCost)}
                </span>
              </div>
            </div>

            <Separator className="bg-rose-100" />

            {/* Suggested vs Manual Price Toggle */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-800 block">
                    Giá bán gợi ý theo công thức
                  </span>
                  <span className="text-lg font-extrabold text-gray-900">
                    {formatVND(suggestedPrice)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsPriceOverridden(!isPriceOverridden);
                    if (!isPriceOverridden && !manualPrice) {
                      setManualPrice(suggestedPrice);
                    }
                  }}
                  className={`rounded-xl text-xs h-9 ${
                    isPriceOverridden
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {isPriceOverridden ? 'Đang tự nhập giá' : 'Nhập giá thủ công'}
                </Button>
              </div>

              {/* Price Override Input */}
              {isPriceOverridden && (
                <div className="p-3 rounded-xl bg-white border border-rose-200 shadow-xs space-y-1.5 animate-in fade-in-50">
                  <Label htmlFor="manualPrice" className="text-xs font-semibold text-rose-900">
                    Giá bán thực tế mong muốn (VND)
                  </Label>
                  <Input
                    id="manualPrice"
                    type="number"
                    inputMode="numeric"
                    placeholder="VD: 350000"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="h-10 text-sm font-bold text-rose-900"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Hệ thống sẽ tính biên lợi nhuận thực tế theo mức giá này.
                  </span>
                </div>
              )}

              {/* Profit summary card */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-medium block">
                    Lợi nhuận / sản phẩm
                  </span>
                  <span className="text-sm font-bold text-emerald-800 mt-0.5 block">
                    {formatVND(actualProfit)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-[10px] text-muted-foreground font-medium block">
                    Giá chốt áp dụng
                  </span>
                  <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                    {formatVND(effectivePrice)}
                  </span>
                </div>
              </div>

              {actualMargin < 20 && totalCost > 0 && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Biên LN đang dưới 20%. Bạn nên cân nhắc tăng giá bán!</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="pt-2 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-1/3 rounded-xl h-12 border-gray-200 text-gray-700"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="w-2/3 rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm active:scale-[0.98]"
          >
            {submitting ? 'Đang lưu mẫu...' : 'Tạo mẫu sản phẩm'}
          </Button>
        </div>
      </form>

      {/* MATERIAL SELECTOR MODAL / DIALOG */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] flex flex-col p-4">
          <DialogHeader className="pb-2 text-left">
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-rose-600" />
              <span>Chọn nguyên liệu vào công thức</span>
            </DialogTitle>
          </DialogHeader>

          {/* Search bar inside dialog */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Tìm hoa sáp, hoa lụa, cốt, bao bì..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-9 h-10 text-xs rounded-xl"
              />
            </div>

            {/* Group Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setPickerGroup('all')}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium text-[11px] border transition-colors ${
                  pickerGroup === 'all'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Tất cả ({materials.length})
              </button>
              {MATERIAL_GROUPS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setPickerGroup(g.value)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium text-[11px] border transition-colors ${
                    pickerGroup === g.value
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Materials List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-2 min-h-[250px]">
            {filteredPickerMaterials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Không tìm thấy nguyên liệu phù hợp
              </div>
            ) : (
              filteredPickerMaterials.map((mat) => {
                const inRecipe = recipe.find((r) => r.materialId === mat.id);

                return (
                  <div
                    key={mat.id}
                    onClick={() => handleAddMaterial(mat)}
                    className="p-2.5 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/40 cursor-pointer transition-all flex items-center justify-between gap-2 active:scale-[0.99] bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-900 text-xs truncate">
                          {mat.name}
                        </span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                          {getLabel(MATERIAL_GROUPS, mat.group)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>Giá vốn: <strong className="text-gray-800">{formatVND(mat.avgCost)}</strong>/{mat.baseUnit}</span>
                        <span>•</span>
                        <span>
                          Tồn: <strong className={mat.currentStock > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {formatQty(mat.currentStock)} {mat.baseUnit}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {inRecipe && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                          x{formatQty(inRecipe.quantity)}
                        </span>
                      )}
                      <div className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              Đã chọn: <strong>{recipe.length}</strong> nguyên liệu
            </span>
            <Button
              type="button"
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-4"
              onClick={() => setIsPickerOpen(false)}
            >
              Hoàn tất
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
