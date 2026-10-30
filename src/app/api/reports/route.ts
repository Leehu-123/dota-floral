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

    // 1. Lấy danh sách đơn hàng hợp lệ trong khoảng ngày (kèm chi tiết nguyên vật liệu của từng dòng)
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

    // 6. Báo cáo nguyên vật liệu đã sử dụng trong đợt (từ đơn hàng + bó sẵn + kiểm kho)
    const materialUsageMap = new Map<
      string,
      {
        materialId: string;
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

    // 6a. Từ các đơn hàng bán ra trong đợt
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
            materialId: mId,
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

    // 6b. Từ các bó hoa làm sẵn vào kho trong đợt (StockMovement type 'produce_out')
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
        materialId: mId,
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

    // 6c. Từ các đợt kiểm kho / hao hụt vật tư trong đợt (StockMovement refType 'stock_check' có quantity < 0)
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
        materialId: mId,
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

    let totalStockCheckCost = 0;
    let totalOrderCost = 0;
    let totalProduceCost = 0;
    for (const m of materialUsageMap.values()) {
      const avg = m.quantityUsed > 0 ? m.totalCost / m.quantityUsed : m.avgCost;
      totalStockCheckCost += (m.stockCheckUsage || 0) * avg;
      totalOrderCost += (m.orderUsage || 0) * avg;
      totalProduceCost += (m.produceUsage || 0) * avg;
    }

    const materialsUsed = Array.from(materialUsageMap.values())
      .map((m) => {
        const avgCost = m.quantityUsed > 0 ? Math.round(m.totalCost / m.quantityUsed) : m.avgCost;
        return {
          materialId: m.materialId,
          name: m.name,
          group: m.group,
          baseUnit: m.baseUnit,
          quantityUsed: Math.round(m.quantityUsed * 100) / 100,
          avgCost,
          totalCost: Math.round(m.totalCost),
          orderUsage: Math.round(m.orderUsage * 100) / 100,
          produceUsage: Math.round(m.produceUsage * 100) / 100,
          stockCheckUsage: Math.round(m.stockCheckUsage * 100) / 100,
          costShare: totalMaterialCost > 0 ? Number(((m.totalCost / totalMaterialCost) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost || b.quantityUsed - a.quantityUsed);

    // 7. Lấy danh sách phiếu kiểm kho trong đợt
    const stockChecksInPeriod = await prisma.stockCheck.findMany({
      where: {
        checkDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { checkDate: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    // 7. Lấy danh sách các đợt cân đối kho (nếu có tạo phiếu Cân đối kho)
    const reconciliationPurchases = await prisma.purchase.findMany({
      where: {
        isDeleted: false,
        note: { contains: 'Cân đối' },
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        lines: {
          include: {
            material: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const reconciliationBatches = reconciliationPurchases.map((p) => {
      const periodName = (p.note || '').replace(/^Cân đối kho\s*-\s*/i, '').trim() || p.supplierName;
      const totalAmount = Number(p.totalAmount) || 0;
      const items = p.lines.map((l) => {
        const convertedQty = Number(l.convertedQty) || 0;
        const lineTotal = Number(l.lineTotal) || 0;
        const unitCost = convertedQty > 0 ? lineTotal / convertedQty : Number(l.unitPrice) || 0;
        return {
          materialId: l.materialId,
          name: l.material?.name || 'Vật tư',
          group: l.material?.group || 'khac',
          baseUnit: l.material?.baseUnit || '',
          purchaseQty: Number(l.quantity) || 0,
          convertedQty,
          unitCost: Math.round(unitCost),
          lineTotal: Math.round(lineTotal),
        };
      });
      return {
        id: p.id,
        periodName,
        date: p.date,
        totalAmount: Math.round(totalAmount),
        itemCount: items.length,
        items,
      };
    });

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
        totalMaterialCost: Math.round(totalMaterialCost),
        materialItemsCount: materialsUsed.length,
        totalStockCheckCost: Math.round(totalStockCheckCost),
        totalOrderCost: Math.round(totalOrderCost),
        totalProduceCost: Math.round(totalProduceCost),
        stockChecksCount: stockChecksInPeriod.length,
      },
      byChannel,
      channels: byChannel, // Backwards compatibility alias
      topProducts,
      materialsUsed,
      reconciliationBatches,
      stockChecks: stockChecksInPeriod,
    });
  } catch (error) {
    console.error('Lỗi khi lập báo cáo:', error);
    return NextResponse.json(
      { error: 'Không thể tải báo cáo' },
      { status: 500 }
    );
  }
}
