export interface OrderLineMaterialFormatted {
  id?: string;
  orderLineId?: string;
  materialId: string;
  quantity: number;
  unitCost: number;
  material?: {
    id: string;
    name: string;
    baseUnit: string;
    currentStock?: number;
    avgCost?: number;
  };
}

export interface OrderLineFormatted {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshotCost: number;
  isCustom: boolean;
  materials: OrderLineMaterialFormatted[];
}

export interface OrderFormatted {
  id: string;
  code: string;
  orderDate: Date | string;
  channel: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  status: string;
  deliveryType: string;
  deliveryDate: Date | string | null;
  shippingFee: number;
  discount: number;
  channelFeePercent: number;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  paymentStatus: string;
  depositAmount: number;
  paymentMethod: string | null;
  note: string | null;
  referenceImageUrl: string | null;
  finishedImageUrl: string | null;
  isDeleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    address?: string | null;
    zaloLink?: string | null;
    facebookLink?: string | null;
    note?: string | null;
  } | null;
  linesCount: number;
  lines: OrderLineFormatted[];
}

/**
 * Tính lợi nhuận gộp của đơn hàng
 * Gross Profit = totalAmount - totalCost - (totalAmount * channelFeePercent / 100)
 */
export function calculateGrossProfit(
  totalAmount: number,
  totalCost: number,
  channelFeePercent: number
): number {
  const channelFee = (totalAmount * channelFeePercent) / 100;
  return Math.round(totalAmount - totalCost - channelFee);
}

/**
 * Format Order Prisma object sang JSON response kèm các trường tính toán và chuyển Decimal -> Number
 */
export function formatOrder(order: any): OrderFormatted {
  const totalAmount = Number(order.totalAmount) || 0;
  const totalCost = Number(order.totalCost) || 0;
  const channelFeePercent = Number(order.channelFeePercent) || 0;
  const shippingFee = Number(order.shippingFee) || 0;
  const discount = Number(order.discount) || 0;
  const depositAmount = Number(order.depositAmount) || 0;
  const grossProfit = calculateGrossProfit(totalAmount, totalCost, channelFeePercent);

  const lines: OrderLineFormatted[] = (order.lines || []).map((line: any) => ({
    id: line.id,
    orderId: line.orderId,
    productId: line.productId || null,
    productName: line.productName,
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    lineTotal: Number(line.lineTotal) || 0,
    snapshotCost: Number(line.snapshotCost) || 0,
    isCustom: Boolean(line.isCustom),
    materials: (line.materials || []).map((m: any) => ({
      id: m.id,
      orderLineId: m.orderLineId,
      materialId: m.materialId,
      quantity: Number(m.quantity) || 0,
      unitCost: Number(m.unitCost) || 0,
      material: m.material
        ? {
            id: m.material.id,
            name: m.material.name,
            baseUnit: m.material.baseUnit,
            currentStock: m.material.currentStock !== undefined ? Number(m.material.currentStock) : undefined,
            avgCost: m.material.avgCost !== undefined ? Number(m.material.avgCost) : undefined,
          }
        : undefined,
    })),
  }));

  return {
    id: order.id,
    code: order.code,
    orderDate: order.orderDate,
    channel: order.channel,
    customerId: order.customerId || null,
    customerName: order.customerName,
    customerPhone: order.customerPhone || null,
    status: order.status,
    deliveryType: order.deliveryType,
    deliveryDate: order.deliveryDate || null,
    shippingFee,
    discount,
    channelFeePercent,
    totalAmount,
    totalCost,
    grossProfit,
    paymentStatus: order.paymentStatus,
    depositAmount,
    paymentMethod: order.paymentMethod || null,
    note: order.note || null,
    referenceImageUrl: order.referenceImageUrl || null,
    finishedImageUrl: order.finishedImageUrl || null,
    isDeleted: Boolean(order.isDeleted),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone || null,
          address: order.customer.address || null,
          zaloLink: order.customer.zaloLink || null,
          facebookLink: order.customer.facebookLink || null,
          note: order.customer.note || null,
        }
      : null,
    linesCount: order._count?.lines ?? lines.length,
    lines,
  };
}

/**
 * Sinh mã đơn hàng dạng DF-YYMMDD-NNN trong transaction
 */
export async function generateOrderCode(tx: any, date: Date = new Date()): Promise<string> {
  // Múi giờ Việt Nam UTC+7
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const vnDate = new Date(date.getTime() + vnOffsetMs);
  const yy = String(vnDate.getUTCFullYear()).slice(-2);
  const mm = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnDate.getUTCDate()).padStart(2, '0');
  const prefix = `DF-${yy}${mm}${dd}-`;

  const count = await tx.order.count({
    where: {
      code: {
        startsWith: prefix,
      },
    },
  });

  let seq = count + 1;
  let code = `${prefix}${String(seq).padStart(3, '0')}`;

  // Kiểm tra chống trùng mã
  while (await tx.order.findUnique({ where: { code } })) {
    seq++;
    code = `${prefix}${String(seq).padStart(3, '0')}`;
  }

  return code;
}

/**
 * Lấy tỷ lệ phí kênh bán hàng từ bảng Settings
 */
export async function getChannelFeePercent(tx: any, channel: string): Promise<number> {
  const normalizedChannel = channel ? channel.toLowerCase().trim() : '';
  const key = `fee_${normalizedChannel}`;
  const setting = await tx.setting.findUnique({
    where: { key },
  });

  if (!setting) return 0;
  const val = parseFloat(setting.value);
  return isNaN(val) ? 0 : val;
}
