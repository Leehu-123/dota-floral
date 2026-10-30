import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateGrossProfit } from '@/lib/order-calc';
import {
  CHANNELS,
  DELIVERY_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  getLabel,
} from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Escape ô CSV để mở an toàn và đúng định dạng trên Excel
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const type = (searchParams.get('type') || 'orders').toLowerCase().trim();

    // Múi giờ Việt Nam UTC+7
    const vnOffsetMs = 7 * 60 * 60 * 1000;
    const now = new Date();
    const vnNow = new Date(now.getTime() + vnOffsetMs);
    const curYear = vnNow.getUTCFullYear();
    const curMonth = vnNow.getUTCMonth();
    const curDay = vnNow.getUTCDate();

    // Mặc định: từ ngày 1 đầu tháng đến hết ngày hôm nay
    const defaultFromStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
    const defaultToStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`;

    const fromStr = fromParam && fromParam.trim() ? fromParam.trim() : defaultFromStr;
    const toStr = toParam && toParam.trim() ? toParam.trim() : defaultToStr;

    const fromDate = new Date(fromStr.includes('T') ? fromStr : `${fromStr}T00:00:00.000Z`);
    const toDate = new Date(toStr.includes('T') ? toStr : `${toStr}T23:59:59.999Z`);

    if (type === 'orders') {
      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          orderDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          customer: true,
          lines: true,
        },
        orderBy: [
          { orderDate: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      const headers = [
        'Mã đơn',
        'Ngày đặt',
        'Khách hàng',
        'Số ĐT',
        'Kênh bán',
        'Trạng thái',
        'Hình thức',
        'Ngày giao',
        'Tiền hàng',
        'Phí ship',
        'Giảm giá',
        'Tổng tiền',
        'Giá vốn',
        'Lợi nhuận gộp',
        'Thanh toán',
        'Phương thức',
        'Ghi chú',
      ];

      const rows: string[] = [];
      rows.push(headers.map(escapeCsvCell).join(','));

      for (const o of orders) {
        const totalAmount = Number(o.totalAmount) || 0;
        const totalCost = Number(o.totalCost) || 0;
        const channelFeePercent = Number(o.channelFeePercent) || 0;
        const shippingFee = Number(o.shippingFee) || 0;
        const discount = Number(o.discount) || 0;
        const grossProfit = calculateGrossProfit(totalAmount, totalCost, channelFeePercent);

        // Tiền hàng = tổng lineTotal từ danh sách mặt hàng (hoặc tổng tiền - ship + giảm giá)
        const lineTotalSum = (o.lines || []).reduce(
          (sum, line) => sum + (Number(line.lineTotal) || 0),
          0
        );
        const goodsTotal = lineTotalSum > 0 ? lineTotalSum : Math.max(0, totalAmount - shippingFee + discount);

        const channelLabel = getLabel(CHANNELS, o.channel);
        const statusLabel = getLabel(ORDER_STATUSES, o.status);
        const deliveryLabel = getLabel(DELIVERY_TYPES, o.deliveryType);
        const paymentLabel = getLabel(PAYMENT_STATUSES, o.paymentStatus);
        const methodLabel = o.paymentMethod ? getLabel(PAYMENT_METHODS, o.paymentMethod) : '';

        const row = [
          o.code,
          formatDate(o.orderDate),
          o.customerName,
          o.customerPhone || '',
          channelLabel,
          statusLabel,
          deliveryLabel,
          o.deliveryDate ? formatDateTime(o.deliveryDate) : '',
          Math.round(goodsTotal),
          Math.round(shippingFee),
          Math.round(discount),
          Math.round(totalAmount),
          Math.round(totalCost),
          grossProfit,
          paymentLabel,
          methodLabel,
          o.note || '',
        ];

        rows.push(row.map(escapeCsvCell).join(','));
      }

      // Thêm ký tự UTF-8 BOM (\uFEFF) để Microsoft Excel tại Việt Nam mở file không bị lỗi font tiếng Việt
      const csvContent = '\uFEFF' + rows.join('\r\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dota-floral-don-hang.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (type === 'purchases') {
      const purchases = await prisma.purchase.findMany({
        where: {
          isDeleted: false,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          supplier: true,
          lines: true,
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      const headers = [
        'Mã/ID',
        'Ngày nhập',
        'Nhà cung cấp',
        'Phí vận chuyển',
        'Tổng tiền',
        'Ghi chú',
        'Số mặt hàng',
      ];

      const rows: string[] = [];
      rows.push(headers.map(escapeCsvCell).join(','));

      for (const p of purchases) {
        const shippingCost = Number(p.shippingCost) || 0;
        const totalAmount = Number(p.totalAmount) || 0;
        const itemsCount = p.lines ? p.lines.length : 0;

        const row = [
          p.id,
          formatDate(p.date),
          p.supplierName,
          Math.round(shippingCost),
          Math.round(totalAmount),
          p.note || '',
          itemsCount,
        ];

        rows.push(row.map(escapeCsvCell).join(','));
      }

      // Thêm ký tự UTF-8 BOM (\uFEFF)
      const csvContent = '\uFEFF' + rows.join('\r\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dota-floral-nhap-hang.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (type === 'materials') {
      // Lấy danh sách nguyên vật liệu đã dùng từ đơn hàng
      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          status: { not: 'cancelled' },
          orderDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          lines: {
            include: {
              materials: {
                include: {
                  material: true,
                },
              },
            },
          },
        },
      });

      const materialUsageMap = new Map<
        string,
        {
          name: string;
          group: string;
          baseUnit: string;
          quantityUsed: number;
          totalCost: number;
          avgCost: number;
          orderUsage: number;
          produceUsage: number;
          stockCheckUsage: number;
        }
      >();

      for (const o of orders) {
        for (const line of o.lines) {
          const lineQty = Number(line.quantity) || 1;
          for (const olm of (line as any).materials || []) {
            const mId = olm.materialId;
            const mName = olm.material?.name || 'Vật tư';
            const mGroup = olm.material?.group || 'khac';
            const mBaseUnit = olm.material?.baseUnit || '';
            const qty = (Number(olm.quantity) || 0) * lineQty;
            const unitCost = Number(olm.unitCost) || Number(olm.material?.avgCost) || 0;
            const cost = qty * unitCost;

            const existing = materialUsageMap.get(mId) || {
              name: mName,
              group: mGroup,
              baseUnit: mBaseUnit,
              quantityUsed: 0,
              totalCost: 0,
              avgCost: unitCost,
              orderUsage: 0,
              produceUsage: 0,
              stockCheckUsage: 0,
            };

            existing.quantityUsed += qty;
            existing.totalCost += cost;
            existing.orderUsage += qty;
            if (existing.avgCost === 0 && unitCost > 0) existing.avgCost = unitCost;
            materialUsageMap.set(mId, existing);
          }
        }
      }

      // Lấy thêm từ produce_out
      const produceMovements = await prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
          type: 'produce_out',
        },
        include: {
          material: true,
        },
      });

      for (const pm of produceMovements) {
        const mId = pm.materialId;
        const mName = pm.material?.name || 'Vật tư';
        const mGroup = pm.material?.group || 'khac';
        const mBaseUnit = pm.material?.baseUnit || '';
        const qty = Math.abs(Number(pm.quantity)) || 0;
        const unitCost = Number(pm.unitCost) || Number(pm.material?.avgCost) || 0;
        const cost = qty * unitCost;

        const existing = materialUsageMap.get(mId) || {
          name: mName,
          group: mGroup,
          baseUnit: mBaseUnit,
          quantityUsed: 0,
          totalCost: 0,
          avgCost: unitCost,
          orderUsage: 0,
          produceUsage: 0,
          stockCheckUsage: 0,
        };

        existing.quantityUsed += qty;
        existing.totalCost += cost;
        existing.produceUsage += qty;
        if (existing.avgCost === 0 && unitCost > 0) existing.avgCost = unitCost;
        materialUsageMap.set(mId, existing);
      }

      // Lấy thêm từ kiểm kho / hao hụt vật tư
      const stockCheckMovements = await prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
          refType: 'stock_check',
          quantity: { lt: 0 },
        },
        include: {
          material: true,
        },
      });

      for (const scm of stockCheckMovements) {
        const mId = scm.materialId;
        const mName = scm.material?.name || 'Vật tư';
        const mGroup = scm.material?.group || 'khac';
        const mBaseUnit = scm.material?.baseUnit || '';
        const qty = Math.abs(Number(scm.quantity)) || 0;
        const unitCost = Number(scm.unitCost) || Number(scm.material?.avgCost) || 0;
        const cost = qty * unitCost;

        const existing = materialUsageMap.get(mId) || {
          name: mName,
          group: mGroup,
          baseUnit: mBaseUnit,
          quantityUsed: 0,
          totalCost: 0,
          avgCost: unitCost,
          orderUsage: 0,
          produceUsage: 0,
          stockCheckUsage: 0,
        };

        existing.quantityUsed += qty;
        existing.totalCost += cost;
        existing.stockCheckUsage = (existing.stockCheckUsage || 0) + qty;
        if (existing.avgCost === 0 && unitCost > 0) existing.avgCost = unitCost;
        materialUsageMap.set(mId, existing);
      }

      const totalMaterialCost = Array.from(materialUsageMap.values()).reduce(
        (sum, m) => sum + m.totalCost,
        0
      );

      const sortedMaterials = Array.from(materialUsageMap.values()).sort(
        (a, b) => b.totalCost - a.totalCost || b.quantityUsed - a.quantityUsed
      );

      const headers = [
        'STT',
        'Tên nguyên liệu',
        'Nhóm',
        'Đơn vị tính',
        'Tổng số lượng đã dùng',
        'Đơn giá vốn bình quân (đ)',
        'Tổng chi phí tiêu hao (đ)',
        'Tỷ trọng chi phí (%)',
        'Từ đơn hàng',
        'Từ bó sẵn tiệm',
        'Từ kiểm kho / hao hụt',
      ];

      const rows: string[] = [];
      rows.push(headers.map(escapeCsvCell).join(','));

      sortedMaterials.forEach((m, idx) => {
        const avgCost = m.quantityUsed > 0 ? Math.round(m.totalCost / m.quantityUsed) : m.avgCost;
        const share = totalMaterialCost > 0 ? Number(((m.totalCost / totalMaterialCost) * 100).toFixed(1)) : 0;
        const row = [
          idx + 1,
          m.name,
          m.group,
          m.baseUnit,
          m.quantityUsed,
          avgCost,
          Math.round(m.totalCost),
          share + '%',
          m.orderUsage,
          m.produceUsage,
          m.stockCheckUsage,
        ];
        rows.push(row.map(escapeCsvCell).join(','));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dota-floral-nguyen-lieu-da-dung.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      { error: "Loại báo cáo không hợp lệ. Vui lòng chọn 'orders', 'purchases' hoặc 'materials'." },
      { status: 400 }
    );
  } catch (error) {
    console.error('Lỗi khi xuất file báo cáo:', error);
    return NextResponse.json(
      { error: 'Không thể xuất file báo cáo' },
      { status: 500 }
    );
  }
}
