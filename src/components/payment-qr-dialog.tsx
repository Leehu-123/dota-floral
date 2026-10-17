'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getVietQRUrl, findBank } from '@/lib/vietqr';
import { formatVND } from '@/lib/format';
import { toast } from 'sonner';
import { Copy, CheckCircle2, QrCode, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PaymentQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  orderCode: string;
  amount: number;
  customerName?: string;
  onPaymentSuccess?: () => void;
}

export function PaymentQrDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  amount,
  customerName,
  onPaymentSuccess,
}: PaymentQrDialogProps) {
  const [bankSettings, setBankSettings] = useState<{
    bankId: string;
    accountNo: string;
    accountName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/settings')
        .then((res) => res.json())
        .then((settings) => {
          if (settings.bank_id && settings.bank_account_no) {
            setBankSettings({
              bankId: settings.bank_id,
              accountNo: settings.bank_account_no,
              accountName: settings.bank_account_name || 'DOTA FLORAL',
            });
          } else {
            // Default demo MB Bank if not configured
            setBankSettings({
              bankId: 'MB',
              accountNo: '0987654321',
              accountName: 'DOTA FLORAL',
            });
          }
        })
        .catch(() => {
          setBankSettings({
            bankId: 'MB',
            accountNo: '0987654321',
            accountName: 'DOTA FLORAL',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Đã sao chép ${field}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPaid = async () => {
    if (!orderId) {
      onOpenChange(false);
      return;
    }

    try {
      setConfirming(true);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'paid',
          depositAmount: amount,
          paymentMethod: 'transfer',
        }),
      });

      if (!res.ok) {
        throw new Error('Không thể cập nhật thanh toán');
      }

      toast.success('Đã xác nhận thanh toán thành công! 🌸');
      onOpenChange(false);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật thanh toán');
    } finally {
      setConfirming(false);
    }
  };

  const bankObj = findBank(bankSettings?.bankId);
  const qrUrl = bankSettings
    ? getVietQRUrl({
        bankId: bankSettings.bankId,
        accountNo: bankSettings.accountNo,
        accountName: bankSettings.accountName,
        amount,
        memo: orderCode,
        template: 'compact2',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-5 mx-4">
        <DialogHeader className="text-center pb-2 border-b border-gray-100">
          <div className="mx-auto w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-2">
            <QrCode className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900">
            Quét Mã VietQR Chuyển Khoản
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Đơn hàng: <span className="font-semibold text-rose-600">{orderCode}</span>
            {customerName && ` • Khách: ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Đang tải mã QR...
          </div>
        ) : bankSettings ? (
          <div className="space-y-4 pt-2">
            {/* VietQR Image Container */}
            <div className="bg-gradient-to-b from-rose-50/50 to-pink-50/30 rounded-2xl p-3 border border-rose-100/80 flex flex-col items-center justify-center">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrl}
                  alt={`VietQR ${orderCode}`}
                  className="w-full max-w-[260px] h-auto rounded-xl shadow-sm"
                />
              ) : (
                <div className="py-8 text-xs text-gray-400">Không thể tạo mã QR</div>
              )}
              <p className="text-[11px] text-gray-500 mt-2 text-center">
                Mở app ngân hàng bất kỳ quét mã là tự điền đúng số tiền & nội dung
              </p>
            </div>

            {/* Account Details Box */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Ngân hàng:</span>
                <span className="font-medium text-gray-900">
                  {bankObj ? bankObj.shortName : bankSettings.bankId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Số tài khoản:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bankSettings.accountNo, 'số tài khoản')}
                  className="font-mono font-semibold text-rose-600 flex items-center gap-1 active:opacity-70"
                >
                  {bankSettings.accountNo}
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Chủ tài khoản:</span>
                <span className="font-semibold uppercase text-gray-900">
                  {bankSettings.accountName}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                <span className="text-gray-500">Số tiền:</span>
                <span className="text-sm font-bold text-rose-600">
                  {formatVND(amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Nội dung:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(orderCode, 'nội dung chuyển khoản')}
                  className="font-mono font-semibold text-gray-800 flex items-center gap-1 active:opacity-70"
                >
                  {orderCode}
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-11"
                onClick={handleConfirmPaid}
                disabled={confirming}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {confirming ? 'Đang cập nhật...' : 'Đã nhận tiền • Hoàn thành TT'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl h-10 text-gray-600"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-600">Chưa cấu hình tài khoản ngân hàng</p>
            <Button size="sm" asChild>
              <Link href="/settings">
                Vào Cài đặt ngân hàng <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
