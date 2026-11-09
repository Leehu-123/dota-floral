export const MATERIAL_GROUPS = [
  { value: 'hoa_sap', label: 'Hoa sáp' },
  { value: 'hoa_lua', label: 'Hoa lụa' },
  { value: 'cot_hoa', label: 'Cốt hoa' },
  { value: 'phu_kien', label: 'Phụ kiện' },
  { value: 'bao_bi', label: 'Bao bì' },
  { value: 'vat_tu_khac', label: 'Vật tư khác' },
] as const;

export const CHANNELS = [
  { value: 'zalo', label: 'Zalo' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tai_tiem', label: 'Tại tiệm' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'khac', label: 'Khác' },
] as const;

export const ORDER_STATUSES = [
  { value: 'new', label: 'Mới', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'Đang làm', color: 'bg-amber-100 text-amber-800' },
  { value: 'completed', label: 'Hoàn thành', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', label: 'Đã giao', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelled', label: 'Đã hủy', color: 'bg-rose-100 text-rose-800' },
] as const;

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Chưa TT', color: 'bg-red-100 text-red-700' },
  { value: 'deposited', label: 'Đã cọc', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'paid', label: 'Đã TT', color: 'bg-green-100 text-green-700' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'cod', label: 'COD' },
] as const;

export const DELIVERY_TYPES = [
  { value: 'pickup', label: 'Nhận tại tiệm' },
  { value: 'ship', label: 'Ship' },
] as const;

export const STOCK_MOVEMENT_TYPES = [
  { value: 'purchase_in', label: 'Nhập hàng' },
  { value: 'order_out', label: 'Xuất cho đơn' },
  { value: 'order_return', label: 'Hoàn kho (hủy đơn)' },
  { value: 'adjustment', label: 'Điều chỉnh kiểm kho' },
  { value: 'damage', label: 'Hao hụt/hỏng' },
] as const;

export function getLabel(
  list: readonly { value: string; label: string }[],
  value: string
): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export function getStatusStyle(
  list: readonly { value: string; label: string; color: string }[],
  value: string
): { label: string; color: string } {
  const item = list.find((i) => i.value === value);
  return item ?? { label: value, color: 'bg-gray-100 text-gray-700' };
}
