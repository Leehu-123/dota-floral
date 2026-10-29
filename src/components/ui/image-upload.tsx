'use client';

import React, { useState, useRef } from 'react';
import { Upload, Camera, Image as ImageIcon, X, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';
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
        // Preview Card
        <div className="relative rounded-2xl border border-purple-200/80 bg-purple-50/30 p-2 overflow-hidden group">
          <div className="relative aspect-[4/3] w-full max-h-64 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Ảnh sản phẩm"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded-xl shadow-md text-xs font-semibold gap-1.5 bg-white/90 hover:bg-white text-gray-800"
              >
                <Camera className="w-3.5 h-3.5 text-purple-600" />
                <span>Đổi ảnh khác</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onChange(null)}
                className="rounded-xl shadow-md text-xs font-semibold gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 text-xs">
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              ✓ Đã có ảnh thành phẩm
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-purple-700 font-semibold hover:underline"
              >
                Đổi ảnh
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-[11px] text-red-600 font-medium hover:underline"
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
    </div>
  );
}
