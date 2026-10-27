import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeProductCosts } from '@/lib/product-calc';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Lấy ngưỡng cảnh báo biên lợi nhuận từ Settings (mặc định 20%)
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'margin_alert_threshold' },
    });
    const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 20;

    // 2. Lấy tất cả mẫu sản phẩm đang hoạt động kèm chi tiết nguyên vật liệu
    const products = await prisma.product.findMany({
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
                baseUnit: true,
                avgCost: true,
                currentStock: true,
                group: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const alertProducts = [];

    // 3. Tính toán lại chi phí và kiểm tra cảnh báo biên lợi nhuận
    for (const product of products) {
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

      // Nếu biên lợi nhuận thực tế thấp hơn ngưỡng cảnh báo
      if (costs.actualMargin < threshold) {
        alertProducts.push({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          suggestedPrice,
          materialCost: costs.materialCost,
          overheadCost: costs.overheadCost,
          laborCost,
          overheadPercent,
          totalCost: costs.totalCost,
          targetMargin,
          actualMargin: costs.actualMargin,
          threshold,
          marginDifference: Number((costs.actualMargin - targetMargin).toFixed(2)),
          materials: product.materials.map((pm) => ({
            id: pm.id,
            materialId: pm.materialId,
            quantity: Number(pm.quantity),
            unitCost: Number(pm.material.avgCost),
            lineCost: Math.round(Number(pm.quantity) * Number(pm.material.avgCost)),
            material: {
              id: pm.material.id,
              name: pm.material.name,
              baseUnit: pm.material.baseUnit,
              avgCost: Number(pm.material.avgCost),
              currentStock: Number(pm.material.currentStock),
              group: pm.material.group,
              imageUrl: pm.material.imageUrl,
            },
          })),
        });
      }
    }

    return NextResponse.json(alertProducts);
  } catch (error) {
    console.error('Lỗi khi kiểm tra cảnh báo biên lợi nhuận:', error);
    return NextResponse.json(
      { error: 'Không thể kiểm tra cảnh báo biên lợi nhuận' },
      { status: 500 }
    );
  }
}
