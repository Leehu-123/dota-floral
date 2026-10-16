import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeProductCosts } from '@/lib/product-calc';

export const dynamic = 'force-dynamic';

/**
 * Tính toán mốc thời gian theo múi giờ Việt Nam (UTC+7)
 */
function getVietnamTimeBounds() {
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const now = new Date();
  const vnNow = new Date(now.getTime() + vnOffsetMs);
  const curYear = vnNow.getUTCFullYear();
  const curMonth = vnNow.getUTCMonth();
  const curDate = vnNow.getUTCDate();
  const curDayOfWeek = vnNow.getUTCDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...

  // Hôm nay: 00:00:00.000 đến 23:59:59.999 VN
  const startOfToday = new Date(Date.UTC(curYear, curMonth, curDate, 0, 0, 0, 0) - vnOffsetMs);
  const endOfToday = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999) - vnOffsetMs);

  // Ngày mai
  const startOfTomorrow = new Date(Date.UTC(curYear, curMonth, curDate + 1, 0, 0, 0, 0) - vnOffsetMs);
  const endOfTomorrow = new Date(Date.UTC(curYear, curMonth, curDate + 1, 23, 59, 59, 999) - vnOffsetMs);

  // Tuần này: Từ Thứ 2 đầu tuần (00:00:00) đến hết hôm nay
  const diffToMonday = curDayOfWeek === 0 ? 6 : curDayOfWeek - 1;
  const startOfWeek = new Date(Date.UTC(curYear, curMonth, curDate - diffToMonday, 0, 0, 0, 0) - vnOffsetMs);

  // Tháng này: Từ ngày 1 đầu tháng (00:00:00) đến hết hôm nay
  const startOfMonth = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0, 0) - vnOffsetMs);

  return {
    now,
    startOfToday,
    endOfToday,
    startOfTomorrow,
    endOfTomorrow,
    startOfWeek,
    startOfMonth,
  };
}

/**
 * Tính doanh thu, giá vốn, phí kênh, lợi nhuận gộp và số đơn hàng cho một danh sách đơn
 */
function computePeriodMetrics(
  orders: {
    totalAmount: any;
    totalCost: any;
    channelFeePercent: any;
  }[]
) {
  let revenue = 0;
  let cost = 0;
  let channelFee = 0;

  for (const order of orders) {
    const amt = Number(order.totalAmount) || 0;
    const c = Number(order.totalCost) || 0;
    const feePct = Number(order.channelFeePercent) || 0;
    const fee = (amt * feePct) / 100;

    revenue += amt;
    cost += c;
    channelFee += fee;
  }

  const grossProfit = Math.round(revenue - cost - channelFee);

  return {
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    channelFee: Math.round(channelFee),
    grossProfit,
    orderCount: orders.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const {
      startOfToday,
      endOfToday,
      startOfTomorrow,
      endOfTomorrow,
      startOfWeek,
      startOfMonth,
    } = getVietnamTimeBounds();

    // 1. Lấy tất cả đơn hàng từ mốc thời gian sớm nhất (giữa đầu tuần và đầu tháng) đến hết hôm nay
    const earliestStart = new Date(
      Math.min(startOfWeek.getTime(), startOfMonth.getTime(), startOfToday.getTime())
    );

    const periodOrders = await prisma.order.findMany({
      where: {
        isDeleted: false,
        status: { not: 'cancelled' },
        orderDate: {
          gte: earliestStart,
          lte: endOfToday,
        },
      },
      select: {
        id: true,
        totalAmount: true,
        totalCost: true,
        channelFeePercent: true,
        orderDate: true,
      },
    });

    // Lọc theo từng khoảng thời gian
    const todayOrders = periodOrders.filter((o) => {
      const d = new Date(o.orderDate).getTime();
      return d >= startOfToday.getTime() && d <= endOfToday.getTime();
    });

    const weekOrders = periodOrders.filter((o) => {
      const d = new Date(o.orderDate).getTime();
      return d >= startOfWeek.getTime() && d <= endOfToday.getTime();
    });

    const monthOrders = periodOrders.filter((o) => {
      const d = new Date(o.orderDate).getTime();
      return d >= startOfMonth.getTime() && d <= endOfToday.getTime();
    });

    const todayMetrics = computePeriodMetrics(todayOrders);
    const weekMetrics = computePeriodMetrics(weekOrders);
    const monthMetrics = computePeriodMetrics(monthOrders);

    // 2. Đơn cần giao hôm nay (status: 'new' | 'in_progress', deliveryDate là hôm nay)
    const rawDeliveryToday = await prisma.order.findMany({
      where: {
        isDeleted: false,
        status: { in: ['new', 'in_progress'] },
        deliveryDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      select: {
        id: true,
        code: true,
        customerName: true,
        customerPhone: true,
        deliveryType: true,
        deliveryDate: true,
        totalAmount: true,
        status: true,
      },
      orderBy: {
        deliveryDate: 'asc',
      },
    });

    const ordersToDeliverToday = rawDeliveryToday.map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryType: o.deliveryType,
      deliveryDate: o.deliveryDate,
      totalAmount: Number(o.totalAmount),
      status: o.status,
    }));

    // 3. Đơn cần giao ngày mai (status: 'new' | 'in_progress', deliveryDate là ngày mai)
    const rawDeliveryTomorrow = await prisma.order.findMany({
      where: {
        isDeleted: false,
        status: { in: ['new', 'in_progress'] },
        deliveryDate: {
          gte: startOfTomorrow,
          lte: endOfTomorrow,
        },
      },
      select: {
        id: true,
        code: true,
        customerName: true,
        customerPhone: true,
        deliveryType: true,
        deliveryDate: true,
        totalAmount: true,
        status: true,
      },
      orderBy: {
        deliveryDate: 'asc',
      },
    });

    const ordersToDeliverTomorrow = rawDeliveryTomorrow.map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryType: o.deliveryType,
      deliveryDate: o.deliveryDate,
      totalAmount: Number(o.totalAmount),
      status: o.status,
    }));

    // 4. Vật tư sắp hết / tồn kho thấp (currentStock <= minStock và minStock > 0)
    const materialsWithMin = await prisma.material.findMany({
      where: {
        isDeleted: false,
        minStock: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        group: true,
        currentStock: true,
        minStock: true,
        baseUnit: true,
        avgCost: true,
      },
      orderBy: {
        currentStock: 'asc',
      },
    });

    const lowStockMaterials = materialsWithMin
      .filter((m) => Number(m.currentStock) <= Number(m.minStock))
      .map((m) => ({
        id: m.id,
        name: m.name,
        group: m.group,
        currentStock: Number(m.currentStock),
        minStock: Number(m.minStock),
        baseUnit: m.baseUnit,
        avgCost: Number(m.avgCost),
      }));

    // 5. Đơn hàng chưa thanh toán hoặc mới đặt cọc (paymentStatus in ['unpaid', 'deposited'], limit 10)
    const rawUnpaidOrders = await prisma.order.findMany({
      where: {
        isDeleted: false,
        status: { not: 'cancelled' },
        paymentStatus: { in: ['unpaid', 'deposited'] },
      },
      select: {
        id: true,
        code: true,
        customerName: true,
        totalAmount: true,
        depositAmount: true,
        paymentStatus: true,
        orderDate: true,
      },
      orderBy: [
        { orderDate: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });

    const unpaidOrders = rawUnpaidOrders.map((o) => {
      const totalAmount = Number(o.totalAmount) || 0;
      const depositAmount = Number(o.depositAmount) || 0;
      return {
        id: o.id,
        code: o.code,
        customerName: o.customerName,
        totalAmount,
        depositAmount,
        remainingAmount: Math.max(0, totalAmount - depositAmount),
        paymentStatus: o.paymentStatus,
        orderDate: o.orderDate,
      };
    });

    // 6. Cảnh báo biên lợi nhuận thấp hơn ngưỡng cài đặt
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'margin_alert_threshold' },
    });
    const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 20;

    const templateProducts = await prisma.product.findMany({
      where: {
        isDeleted: false,
        type: 'template',
      },
      include: {
        materials: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                avgCost: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const marginAlerts = [];
    for (const product of templateProducts) {
      const laborCost = Number(product.laborCost) || 0;
      const overheadPercent = Number(product.overheadPercent) || 0;
      const targetMargin = Number(product.targetMargin) || 0;
      const suggestedPrice = Number(product.suggestedPrice) || 0;

      const costs = computeProductCosts(
        product.materials,
        laborCost,
        overheadPercent,
        suggestedPrice
      );

      if (costs.actualMargin < threshold) {
        marginAlerts.push({
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          suggestedPrice,
          totalCost: costs.totalCost,
          actualMargin: costs.actualMargin,
          targetMargin,
          threshold,
          marginDifference: Number((costs.actualMargin - targetMargin).toFixed(2)),
        });
      }
    }

    marginAlerts.sort((a, b) => a.actualMargin - b.actualMargin);

    return NextResponse.json({
      periods: {
        today: todayMetrics,
        week: weekMetrics,
        month: monthMetrics,
      },
      metrics: {
        today: todayMetrics,
        week: weekMetrics,
        month: monthMetrics,
      },
      today: todayMetrics,
      thisWeek: weekMetrics,
      thisMonth: monthMetrics,
      ordersToDeliverToday,
      ordersToDeliverTomorrow,
      todayDeliveries: ordersToDeliverToday,
      lowStockMaterials,
      unpaidOrders,
      marginAlerts,
      lowMarginProducts: marginAlerts,
    });
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu bảng điều khiển:', error);
    return NextResponse.json(
      { error: 'Không thể tải dữ liệu bảng điều khiển' },
      { status: 500 }
    );
  }
}
