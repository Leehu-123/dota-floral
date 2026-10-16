'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Store,
  TrendingUp,
  Percent,
  AlertTriangle,
  RefreshCw,
  Building,
  Clock,
  Sparkles,
  Info,
  QrCode,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatVND } from '@/lib/format';
import { POPULAR_BANKS } from '@/lib/vietqr';

interface SettingsFormState {
  shop_name: string;
  shop_address: string;
  default_margin: string;
  price_rounding_step: string;
  labor_rate_per_hour: string;
  default_overhead_percent: string;
  fee_shopee: string;
  fee_tiktok: string;
  fee_zalo: string;
  fee_facebook: string;
  fee_tai_tiem: string;
  margin_alert_threshold: string;
  bank_id: string;
  bank_account_no: string;
  bank_account_name: string;
}

const defaultValues: SettingsFormState = {
  shop_name: 'Dota Floral',
  shop_address: 'TT. Bắc Hà, Lào Cai',
  default_margin: '40',
  price_rounding_step: '5000',
  labor_rate_per_hour: '30000',
  default_overhead_percent: '10',
  fee_shopee: '8',
  fee_tiktok: '5',
  fee_zalo: '0',
  fee_facebook: '0',
  fee_tai_tiem: '0',
  margin_alert_threshold: '20',
  bank_id: 'MB',
  bank_account_no: '0987654321',
  bank_account_name: 'DOTA FLORAL',
};

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<SettingsFormState>(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings');
      if (!res.ok) {
        throw new Error('Không thể tải dữ liệu cài đặt');
      }
      const data = await res.json();

      let incoming: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item?.key) incoming[item.key] = String(item.value ?? '');
        });
      } else if (typeof data === 'object' && data !== null) {
        const root = data.settings || data;
        Object.entries(root).forEach(([k, v]) => {
          incoming[k] = String(v ?? '');
        });
      }

      setForm((prev) => ({
        ...prev,
        ...incoming,
      }));
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Lỗi khi tải cài đặt');
      toast.error('Lỗi khi tải cài đặt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: keyof SettingsFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Không thể lưu cài đặt');
      }

      toast.success('Đã lưu cấu hình cài đặt thành công!');
    } catch (err: any) {
      console.error('Save settings error:', err);
      toast.error(err.message || 'Lỗi khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-6 w-40 rounded-md" />
        </div>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-gray-100">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="rounded-xl h-9 w-9 p-0 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cài đặt chung</h1>
            <p className="text-xs text-muted-foreground">
              Cấu hình tiệm hoa, giá vốn & phí kênh bán
            </p>
          </div>
        </div>

        {error && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            className="rounded-xl text-xs border-rose-200 text-rose-700 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Thử lại
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. THÔNG TIN TIỆM */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-rose-600" />
              <span>Thông tin tiệm hoa</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Hiển thị trên hóa đơn và thông tin cửa hàng
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="shop_name" className="text-xs font-semibold text-gray-700">
                Tên tiệm
              </Label>
              <Input
                id="shop_name"
                value={form.shop_name}
                onChange={(e) => handleChange('shop_name', e.target.value)}
                placeholder="VD: Dota Floral"
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shop_address" className="text-xs font-semibold text-gray-700">
                Địa chỉ tiệm
              </Label>
              <Input
                id="shop_address"
                value={form.shop_address}
                onChange={(e) => handleChange('shop_address', e.target.value)}
                placeholder="VD: TT. Bắc Hà, Lào Cai"
                className="h-11 rounded-xl text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. TÀI KHOẢN NGÂN HÀNG (VIETQR) */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-rose-600" />
              <span>Tài khoản ngân hàng (Mã VietQR)</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Dùng để tự động tạo mã QR khi khách chuyển khoản mua hoa
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bank_id" className="text-xs font-semibold text-gray-700">
                Ngân hàng thụ hưởng
              </Label>
              <Select
                value={form.bank_id}
                onValueChange={(val) => handleChange('bank_id', val)}
              >
                <SelectTrigger id="bank_id" className="h-11 rounded-xl text-sm bg-white">
                  <SelectValue placeholder="Chọn ngân hàng" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {POPULAR_BANKS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-semibold">{b.id}</span> - {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank_account_no" className="text-xs font-semibold text-gray-700">
                Số tài khoản ngân hàng
              </Label>
              <Input
                id="bank_account_no"
                inputMode="numeric"
                value={form.bank_account_no}
                onChange={(e) => handleChange('bank_account_no', e.target.value)}
                placeholder="VD: 0987654321"
                className="h-11 rounded-xl text-sm font-mono font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank_account_name" className="text-xs font-semibold text-gray-700">
                Tên chủ tài khoản (viết hoa không dấu)
              </Label>
              <Input
                id="bank_account_name"
                value={form.bank_account_name}
                onChange={(e) => handleChange('bank_account_name', e.target.value.toUpperCase())}
                placeholder="VD: DOTA FLORAL hoặc NGUYEN VAN A"
                className="h-11 rounded-xl text-sm uppercase font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. GIÁ & LỢI NHUẬN */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-600" />
              <span>Giá & Biên lợi nhuận</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Công thức định giá mặc định khi tạo mới mẫu sản phẩm
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="default_margin" className="text-xs font-semibold text-gray-700">
                  Biên LN mặc định (%)
                </Label>
                <Input
                  id="default_margin"
                  type="number"
                  inputMode="numeric"
                  value={form.default_margin}
                  onChange={(e) => handleChange('default_margin', e.target.value)}
                  className="h-11 rounded-xl text-sm font-semibold"
                />
                <span className="text-[10px] text-muted-foreground block">
                  VD: 40%
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price_rounding_step" className="text-xs font-semibold text-gray-700">
                  Làm tròn giá (VND)
                </Label>
                <Input
                  id="price_rounding_step"
                  type="number"
                  inputMode="numeric"
                  value={form.price_rounding_step}
                  onChange={(e) => handleChange('price_rounding_step', e.target.value)}
                  className="h-11 rounded-xl text-sm font-semibold"
                />
                <span className="text-[10px] text-muted-foreground block">
                  VD: 5.000 ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="labor_rate_per_hour" className="text-xs font-semibold text-gray-700">
                  Đơn giá công/giờ (VND)
                </Label>
                <Input
                  id="labor_rate_per_hour"
                  type="number"
                  inputMode="numeric"
                  value={form.labor_rate_per_hour}
                  onChange={(e) => handleChange('labor_rate_per_hour', e.target.value)}
                  className="h-11 rounded-xl text-sm font-semibold"
                />
                <span className="text-[10px] text-muted-foreground block">
                  VD: 30.000 ₫/h
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="default_overhead_percent" className="text-xs font-semibold text-gray-700">
                  Chi phí chung (%)
                </Label>
                <Input
                  id="default_overhead_percent"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={form.default_overhead_percent}
                  onChange={(e) => handleChange('default_overhead_percent', e.target.value)}
                  className="h-11 rounded-xl text-sm font-semibold"
                />
                <span className="text-[10px] text-muted-foreground block">
                  % tính trên tiền vật tư
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. PHÍ SÀN & KÊNH BÁN HÀNG */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-4 h-4 text-rose-600" />
              <span>Phí kênh bán hàng (%)</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Phần trăm khấu trừ hoa hồng theo từng kênh bán
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fee_shopee" className="text-xs font-semibold text-gray-700">
                  Shopee (%)
                </Label>
                <Input
                  id="fee_shopee"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.fee_shopee}
                  onChange={(e) => handleChange('fee_shopee', e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fee_tiktok" className="text-xs font-semibold text-gray-700">
                  TikTok Shop (%)
                </Label>
                <Input
                  id="fee_tiktok"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.fee_tiktok}
                  onChange={(e) => handleChange('fee_tiktok', e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="fee_zalo" className="text-xs font-semibold text-gray-700">
                  Zalo (%)
                </Label>
                <Input
                  id="fee_zalo"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.fee_zalo}
                  onChange={(e) => handleChange('fee_zalo', e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fee_facebook" className="text-xs font-semibold text-gray-700">
                  Facebook (%)
                </Label>
                <Input
                  id="fee_facebook"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.fee_facebook}
                  onChange={(e) => handleChange('fee_facebook', e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fee_tai_tiem" className="text-xs font-semibold text-gray-700">
                  Tại tiệm (%)
                </Label>
                <Input
                  id="fee_tai_tiem"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.fee_tai_tiem}
                  onChange={(e) => handleChange('fee_tai_tiem', e.target.value)}
                  className="h-11 rounded-xl text-sm font-medium"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. CẢNH BÁO */}
        <Card className="rounded-xl border border-gray-100 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Ngưỡng cảnh báo rủi ro</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Hệ thống sẽ gắn cờ cảnh báo khi biên lợi nhuận thấp hơn mức này
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="margin_alert_threshold" className="text-xs font-semibold text-gray-700">
                Ngưỡng cảnh báo biên lợi nhuận thấp (%)
              </Label>
              <Input
                id="margin_alert_threshold"
                type="number"
                step="1"
                inputMode="numeric"
                value={form.margin_alert_threshold}
                onChange={(e) => handleChange('margin_alert_threshold', e.target.value)}
                className="h-11 rounded-xl text-sm font-semibold text-rose-700"
              />
              <span className="text-[11px] text-muted-foreground block">
                Mặc định: 20%. Mọi sản phẩm hoặc đơn hàng có biên LN &lt; {form.margin_alert_threshold}% sẽ hiển thị cảnh báo đỏ.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Floating / Sticky Save Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm gap-2 active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu cài đặt...' : 'Lưu thay đổi'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
