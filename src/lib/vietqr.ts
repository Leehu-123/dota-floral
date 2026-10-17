export interface BankInfo {
  id: string; // e.g. 'ICB', 'VCB', 'MB'
  name: string; // 'Ngân hàng TMCP Công thương Việt Nam'
  shortName: string; // 'VietinBank'
  bin: string; // '970415'
}

export const POPULAR_BANKS: BankInfo[] = [
  { id: 'ICB', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank', bin: '970415' },
  { id: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương VN', shortName: 'Vietcombank', bin: '970436' },
  { id: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển VN', shortName: 'BIDV', bin: '970418' },
  { id: 'VBA', name: 'Ngân hàng Nông nghiệp & PTNT VN', shortName: 'Agribank', bin: '970405' },
  { id: 'MB', name: 'Ngân hàng TMCP Quân Đội', shortName: 'MB Bank', bin: '970422' },
  { id: 'TCB', name: 'Ngân hàng TMCP Kỹ Thương VN', shortName: 'Techcombank', bin: '970407' },
  { id: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank', bin: '970432' },
  { id: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB', bin: '970416' },
  { id: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank', bin: '970423' },
  { id: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank', bin: '970403' },
  { id: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank', bin: '970437' },
  { id: 'VIB', name: 'Ngân hàng TMCP Quốc tế VN', shortName: 'VIB', bin: '970441' },
  { id: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB', bin: '970443' },
  { id: 'MSB', name: 'Ngân hàng TMCP Hàng Hải', shortName: 'MSB', bin: '970426' },
  { id: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB', bin: '970448' },
  { id: 'LPB', name: 'Ngân hàng TMCP Lộc Phát VN', shortName: 'LPBank', bin: '970449' },
  { id: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu VN', shortName: 'Eximbank', bin: '970431' },
  { id: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á', shortName: 'SeABank', bin: '970440' },
  { id: 'BAB', name: 'Ngân hàng TMCP Bắc Á', shortName: 'Bac A Bank', bin: '970409' },
  { id: 'NAB', name: 'Ngân hàng TMCP Nam Á', shortName: 'Nam A Bank', bin: '970428' },
];

/**
 * Tìm thông tin ngân hàng theo id (ICB/CTG), tên viết tắt (VietinBank), hoặc số BIN (970415)
 */
export function findBank(bankIdentifier: string | null | undefined): BankInfo | undefined {
  if (!bankIdentifier) return undefined;
  const clean = bankIdentifier.trim().toLowerCase();
  return POPULAR_BANKS.find(
    (b) =>
      b.id.toLowerCase() === clean ||
      b.bin === clean ||
      b.shortName.toLowerCase() === clean ||
      (clean === 'ctg' && b.id === 'ICB') ||
      (clean === 'vietin' && b.id === 'ICB') ||
      (clean === 'viettinbank' && b.id === 'ICB')
  );
}

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

  const matchedBank = findBank(bankId);
  // Dùng mã BIN chuẩn VietQR (ví dụ VietinBank là 970415) để đảm bảo không bị 404
  const targetBank = matchedBank ? matchedBank.bin : bankId.trim();

  const cleanBank = encodeURIComponent(targetBank);
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
