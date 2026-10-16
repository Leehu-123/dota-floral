import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CHANNELS, getLabel } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

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

    // 1. Lấy danh sách đơn hàng hợp lệ trong khoảng ngày
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
        lines: true,
      },
      orderBy: { orderDate: 'desc' },
    });

    // 2. Lấy danh sách phiếu nhập hàng trong khoảng ngày
    const purchases = await prisma.purchase.findMany({
      where: {
        isDeleted: false,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        id: true,
        totalAmount: true,
        shippingCost: true,
      },
    });

    const totalPurchasesAmount = purchases.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );
    const purchasesCount = purchases.length;

    // 3. Tính toán KPI tổng quan
    let totalRevenue = 0;
    let totalCost = 0;
    let totalChannelFee = 0;

    for (const o of orders) {
      const amt = Number(o.totalAmount) || 0;
      const c = Number(o.totalCost) || 0;
      const feePercent = Number(o.channelFeePercent) || 0;
      const fee = (amt * feePercent) / 100;

      totalRevenue += amt;
      totalCost += c;
      totalChannelFee += fee;
    }

    const totalOrders = orders.length;
    const grossProfit = Math.round(totalRevenue - totalCost - totalChannelFee);
    const marginPercentage =
      totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;
    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 4. Doanh thu & lợi nhuận theo kênh bán hàng
    // Danh sách kênh chuẩn: ['zalo', 'facebook', 'tai_tiem', 'tiktok', 'shopee', 'khac']
    const standardChannelKeys = ['zalo', 'facebook', 'tai_tiem', 'tiktok', 'shopee', 'khac'] as const;
    const channelMap = new Map<
      string,
      {
        channel: string;
        label: string;
        orderCount: number;
        revenue: number;
        cost: number;
        channelFee: number;
        grossProfit: number;
      }
    >();

    // Khởi tạo đầy đủ các kênh
    for (const key of standardChannelKeys) {
      channelMap.set(key, {
        channel: key,
        label: getLabel(CHANNELS, key),
        orderCount: 0,
        revenue: 0,
        cost: 0,
        channelFee: 0,
        grossProfit: 0,
      });
    }

    for (const o of orders) {
      const chKey = channelMap.has(o.channel) ? o.channel : 'khac';
      const target = channelMap.get(chKey)!;
      const amt = Number(o.totalAmount) || 0;
      const c = Number(o.totalCost) || 0;
      const feePct = Number(o.channelFeePercent) || 0;
      const fee = (amt * feePct) / 100;
      const profit = amt - c - fee;

      target.orderCount += 1;
      target.revenue += amt;
      target.cost += c;
      target.channelFee += fee;
      target.grossProfit += profit;
    }

    const byChannel = Array.from(channelMap.values()).map((ch) => ({
      channel: ch.channel,
      label: ch.label,
      channelLabel: ch.label,
      orderCount: ch.orderCount,
      revenue: Math.round(ch.revenue),
      cost: Math.round(ch.cost),
      channelFee: Math.round(ch.channelFee),
      grossProfit: Math.round(ch.grossProfit),
      revenueShare: totalRevenue > 0 ? Number(((ch.revenue / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    // Sắp xếp kênh có doanh thu cao nhất lên trước
    byChannel.sort((a, b) => b.revenue - a.revenue);

    // 5. Top sản phẩm bán chạy nhất (nhóm theo productName / productId, giới hạn 10)
    const productStatsMap = new Map<
      string,
      {
        productId: string | null;
        productName: string;
        quantitySold: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    for (const o of orders) {
      for (const line of o.lines) {
        const key = line.productName.trim();
        const current = productStatsMap.get(key) || {
          productId: line.productId || null,
          productName: line.productName,
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };

        const qty = Number(line.quantity) || 0;
        const rev = Number(line.lineTotal) || 0;
        const snapshotCost = (Number(line.snapshotCost) || 0) * qty;

        current.quantitySold += qty;
        current.revenue += rev;
        current.cost += snapshotCost;
        current.profit += (rev - snapshotCost);
        if (!current.productId && line.productId) {
          current.productId = line.productId;
        }

        productStatsMap.set(key, current);
      }
    }

    const topProducts = Array.from(productStatsMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
      .slice(0, 10)
      .map((p, idx) => ({
        rank: idx + 1,
        productId: p.productId,
        productName: p.productName,
        quantitySold: p.quantitySold,
        quantity: p.quantitySold, // Backwards compatibility alias
        revenue: Math.round(p.revenue),
        cost: Math.round(p.cost),
        profit: Math.round(p.profit),
        grossProfit: Math.round(p.profit), // Backwards compatibility alias
      }));

    return NextResponse.json({
      from: fromStr,
      to: toStr,
      dateRange: {
        from: fromStr,
        to: toStr,
      },
      summary: {
        totalRevenue: Math.round(totalRevenue),
        revenue: Math.round(totalRevenue), // Alias
        totalCost: Math.round(totalCost),
        totalChannelFee: Math.round(totalChannelFee),
        grossProfit,
        marginPercentage,
        marginPercent: marginPercentage, // Alias
        totalOrders,
        orderCount: totalOrders, // Alias
        aov,
        totalPurchasesExpense: Math.round(totalPurchasesAmount),
        totalPurchasesAmount: Math.round(totalPurchasesAmount), // Alias
        purchaseCost: Math.round(totalPurchasesAmount), // Alias
        purchasesCount,
      },
      byChannel,
      channels: byChannel, // Backwards compatibility alias
      topProducts,
    });
  } catch (error) {
    console.error('Lỗi khi lập báo cáo:', error);
    return NextResponse.json(
      { error: 'Không thể tải báo cáo' },
      { status: 500 }
    );
  }
}
