/**
 * Format số tiền VND: 1.250.000 ₫
 */
export function formatVND(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0 ₫';
  const num = typeof amount === 'string' ? parseInt(amount, 10) : Math.round(amount);
  if (isNaN(num)) return '0 ₫';
  return num.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Format số tiền VND ngắn gọn: 1.25tr, 850k
 */
export function formatVNDShort(amount: number): string {
  if (amount >= 1_000_000) {
    const tr = amount / 1_000_000;
    return tr % 1 === 0 ? `${tr}tr` : `${tr.toFixed(1)}tr`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(0)}k`;
  }
  return amount.toString();
}

/**
 * Format số lượng: bỏ .0000 thừa
 */
export function formatQty(qty: number | string | null | undefined): string {
  if (qty === null || qty === undefined) return '0';
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(num)) return '0';
  // Remove trailing zeros
  return parseFloat(num.toFixed(4)).toString();
}

/**
 * Format ngày giờ Việt Nam
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}
