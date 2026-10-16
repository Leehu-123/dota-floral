export interface BankInfo {
  id: string; // e.g. 'MB'
  name: string; // 'Ngân hàng Quân Đội'
  shortName: string; // 'MB Bank'
  bin: string; // '970422'
}

export const POPULAR_BANKS: BankInfo[] = [
  { id: 'MB', name: 'Ngân hàng TMCP Quân Đội', shortName: 'MB Bank', bin: '970422' },
  { id: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương VN', shortName: 'Vietcombank', bin: '970436' },
  { id: 'TCB', name: 'Ngân hàng TMCP Kỹ Thương VN', shortName: 'Techcombank', bin: '970407' },
  { id: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank', bin: '970432' },
  { id: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB', bin: '970416' },
  { id: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển VN', shortName: 'BIDV', bin: '970418' },
  { id: 'CTG', name: 'Ngân hàng TMCP Công Thương VN', shortName: 'VietinBank', bin: '970415' },
  { id: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank', bin: '970423' },
  { id: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank', bin: '970403' },
  { id: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank', bin: '970437' },
  { id: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB', bin: '970448' },
  { id: 'MSB', name: 'Ngân hàng TMCP Hàng Hải', shortName: 'MSB', bin: '970426' },
  { id: 'VIB', name: 'Ngân hàng TMCP Quốc tế VN', shortName: 'VIB', bin: '970441' },
  { id: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB', bin: '970443' },
  { id: 'VBA', name: 'Ngân hàng Nông nghiệp & PTNT VN', shortName: 'Agribank', bin: '970405' },
];

/**
 * Tạo URL hình ảnh mã VietQR tự động qua dịch vụ VietQR API
 */
export function getVietQRUrl(options: {
  bankId: string;
  accountNo: string;
  accountName?: string;
  amount: number;
  memo?: string;
  template?: 'compact2' | 'compact' | 'qr_only' | 'print';
}): string {
  const { bankId, accountNo, accountName, amount, memo, template = 'compact2' } = options;
  if (!bankId || !accountNo) return '';

  const cleanBank = encodeURIComponent(bankId.trim());
  const cleanAccount = encodeURIComponent(accountNo.trim().replace(/\s+/g, ''));
  const params = new URLSearchParams();

  if (amount > 0) {
    params.set('amount', Math.round(amount).toString());
  }
  if (memo) {
    params.set('addInfo', memo.trim());
  }
  if (accountName) {
    params.set('accountName', accountName.trim());
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return `https://img.vietqr.io/image/${cleanBank}-${cleanAccount}-${template}.png${queryString}`;
}
