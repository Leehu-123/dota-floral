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
import { Smartphone, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface MobileConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileConnectDialog({ open, onOpenChange }: MobileConnectDialogProps) {
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const [onlineOrigin, setOnlineOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      setOnlineOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (open && !onlineOrigin) {
      setLoading(true);
      fetch('/api/tunnel')
        .then((res) => res.json())
        .then((data) => {
          if (data?.url) {
            setTunnelUrl(data.url);
          } else {
            setTunnelUrl('https://val-potter-civil-olive.trycloudflare.com');
          }
        })
        .catch(() => {
          setTunnelUrl('https://val-potter-civil-olive.trycloudflare.com');
        })
        .finally(() => setLoading(false));
    }
  }, [open, onlineOrigin]);

  const effectiveUrl =
    onlineOrigin || tunnelUrl || 'https://val-potter-civil-olive.trycloudflare.com';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    effectiveUrl
  )}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(effectiveUrl);
    setCopied(true);
    toast.success('Đã sao chép đường link!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm p-6 text-center">
        <DialogHeader className="items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
            <Smartphone className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900">
            Mở trên điện thoại
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Dùng camera điện thoại quét mã QR để mở ngay ứng dụng
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* QR Code Container */}
          <div className="p-3 bg-white border border-rose-100 rounded-2xl shadow-xs inline-block mx-auto">
            <img
              src={qrImageUrl}
              alt="Mã QR mở trên điện thoại"
              className="w-52 h-52 mx-auto rounded-lg"
            />
          </div>

          {/* Direct link & Copy */}
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1.5 text-left">
            <p className="text-[11px] font-semibold text-gray-500">
              Đường link trực tiếp:
            </p>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={effectiveUrl}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 font-mono flex-1 select-all outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-8 px-2.5 text-xs rounded-lg gap-1 border-gray-200"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                    <span>Chép</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Login credential reminder */}
          <div className="text-left text-xs bg-rose-50/60 border border-rose-100 p-2.5 rounded-xl space-y-1">
            <p className="font-bold text-rose-900">🌸 Tài khoản đăng nhập:</p>
            <p className="text-rose-800 text-[11px]">
              Email: <code className="bg-white px-1 py-0.5 rounded font-bold">anh@dotafloral.com</code>
            </p>
            <p className="text-rose-800 text-[11px]">
              Mật khẩu: <code className="bg-white px-1 py-0.5 rounded font-bold">dotafloral2024</code>
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold"
        >
          Đóng
        </Button>
      </DialogContent>
    </Dialog>
  );
}
