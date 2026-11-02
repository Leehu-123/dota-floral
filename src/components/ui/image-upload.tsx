'use client';

import React, { useState, useRef } from 'react';
import { Upload, Camera, Image as ImageIcon, X, Trash2, Link as LinkIcon, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  description?: string;
}

/**
 * Nén ảnh client-side bằng HTML5 Canvas để giảm dung lượng ảnh chụp điện thoại (5-15MB xuống còn ~100-150KB)
 * Giúp lưu nhanh vào cơ sở dữ liệu và tải trang cực nhanh trên điện thoại.
 */
function compressImage(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({
  value,
  onChange,
  label = 'Hình ảnh sản phẩm thành phẩm',
  description = 'Chụp ảnh thực tế bó hoa hoặc tải ảnh từ thư viện',
}: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [showZoom, setShowZoom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh (JPG, PNG, WebP)');
      return;
    }

    try {
      setLoading(true);
      const compressedDataUrl = await compressImage(file);
      onChange(compressedDataUrl);
      toast.success('Đã tải và tối ưu hóa hình ảnh thành công!');
    } catch (err: any) {
      console.error('Image compression error:', err);
      toast.error('Không thể xử lý hình ảnh này');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setShowUrlInput(false);
    setUrlValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
          <span>{label}</span>
        </Label>
        {!value && (
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-purple-700 hover:text-purple-900 font-medium hover:underline flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            {showUrlInput ? 'Tải từ máy' : 'Dán link URL'}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        // Preview Card - Khung ảnh lớn hiển thị trọn vẹn bó hoa, không bị cắt xén
        <div className="relative rounded-2xl border border-purple-200/80 bg-gray-950 p-2 overflow-hidden group shadow-xs">
          <div className="relative min-h-[300px] sm:min-h-[380px] max-h-[500px] w-full rounded-xl overflow-hidden bg-gray-950 flex items-center justify-center">
            {/* Ambient blurred background */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125 pointer-events-none"
              style={{ backgroundImage: `url(${value})` }}
            />

            {/* Foreground image: object-contain hiển thị 100% bó hoa từ ngọn tới cuống */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Ảnh sản phẩm"
              className="relative z-10 max-h-[480px] max-w-full w-auto h-auto object-contain drop-shadow-2xl cursor-pointer transition-transform duration-200 group-hover:scale-[1.01]"
              onClick={() => setShowZoom(true)}
            />

            {/* Overlay buttons on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20 pointer-events-none">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowZoom(true)}
                className="rounded-xl shadow-md text-xs font-semibold gap-1.5 bg-white/95 hover:bg-white text-gray-900 pointer-events-auto"
              >
                <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                <span>Xem ảnh lớn</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded-xl shadow-md text-xs font-semibold gap-1.5 bg-white/95 hover:bg-white text-gray-900 pointer-events-auto"
              >
                <Camera className="w-3.5 h-3.5 text-purple-600" />
                <span>Đổi ảnh</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onChange(null)}
                className="rounded-xl shadow-md text-xs font-semibold gap-1.5 pointer-events-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </Button>
            </div>

            {/* Quick full-size button */}
            <div className="absolute top-2.5 right-2.5 z-20">
              <button
                type="button"
                onClick={() => setShowZoom(true)}
                className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                title="Bấm để xem ảnh phóng to toàn màn hình"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">Phóng to</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 text-xs text-white">
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              ✓ Đã có ảnh thành phẩm (Bấm vào ảnh để xem lớn)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-purple-300 font-semibold hover:underline"
              >
                Đổi ảnh
              </button>
              <span className="text-gray-500">•</span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-[11px] text-red-400 font-medium hover:underline"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      ) : showUrlInput ? (
        // URL Input
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Dán đường dẫn ảnh: https://..."
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            className="h-10 text-xs rounded-xl"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleApplyUrl}
            className="h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 font-semibold"
          >
            Áp dụng
          </Button>
        </div>
      ) : (
        // Upload Dropzone
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`border-2 border-dashed border-purple-200/90 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/70 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            loading ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              <span className="text-xs font-semibold text-purple-900">
                Đang xử lý & tối ưu hóa ảnh...
              </span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white border border-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                <Camera className="w-6 h-6 text-purple-600" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-purple-950">
                  Tải lên hoặc chụp ảnh thành phẩm
                </p>
                <p className="text-[11px] text-purple-700/80 max-w-xs mx-auto">
                  {description}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lightbox xem ảnh lớn toàn màn hình */}
      {showZoom && value && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowZoom(false)}
        >
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowZoom(false)}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Đóng xem ảnh"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div
            className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Ảnh phóng to chi tiết"
              className="max-h-[85vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl"
            />
          </div>
          <p className="text-gray-400 text-xs mt-2 select-none">
            Bấm bất kỳ đâu hoặc bấm nút X để đóng
          </p>
        </div>
      )}
    </div>
  );
}
