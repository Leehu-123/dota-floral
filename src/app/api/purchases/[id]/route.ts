import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function formatPurchase(p: any) {
  return {
    ...p,
    shippingCost: Number(p.shippingCost),
    totalAmount: Number(p.totalAmount),
    lines: p.lines?.map((line: any) => ({
      ...line,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      convertedQty: Number(line.convertedQty),
      material: line.material
        ? {
            ...line.material,
            conversionFactor: Number(line.material.conversionFactor),
            minStock: Number(line.material.minStock),
            avgCost: Number(line.material.avgCost),
            currentStock: Number(line.material.currentStock),
          }
        : undefined,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const purchase = await prisma.purchase.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        supplier: true,
        lines: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                group: true,
                baseUnit: true,
                purchaseUnit: true,
                conversionFactor: true,
                currentStock: true,
                avgCost: true,
                minStock: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn nhập hàng' },
        { status: 404 }
      );
    }

    return NextResponse.json(formatPurchase(purchase));
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn nhập hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin đơn nhập hàng' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      // 1. Lấy purchase cùng các dòng lines
      const purchase = await tx.purchase.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: {
          lines: true,
        },
      });

      if (!purchase) {
        throw new Error('PURCHASE_NOT_FOUND');
      }

      // Danh sách các vật tư bị ảnh hưởng bởi đơn nhập này
      const affectedMaterialIds = Array.from(
        new Set(purchase.lines.map((line) => line.materialId))
      );

      // 2. Xóa các biến động kho liên quan đến đơn nhập hàng này
      await tx.stockMovement.deleteMany({
        where: {
          refType: 'purchase',
          refId: purchase.id,
        },
      });

      // 3. Tính toán lại tồn kho và giá vốn bình quân cho từng vật tư
      for (const materialId of affectedMaterialIds) {
        // Tồn kho = Tổng tất cả biến động kho còn lại
        const allMovements = await tx.stockMovement.findMany({
          where: { materialId },
        });

        const remainingStock = allMovements.reduce(
          (sum, m) => sum + Number(m.quantity),
          0
        );

        // Tính lại giá vốn bình quân gia quyền từ tất cả các phiếu nhập (purchase_in) còn lại
        const purchaseInMovements = await tx.stockMovement.findMany({
          where: {
            materialId,
            type: 'purchase_in',
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        let replayedStock = 0;
        let replayedAvgCost = 0;

        for (const mov of purchaseInMovements) {
          const qty = Number(mov.quantity);
          const unitCost = Number(mov.unitCost);

          if (qty > 0) {
            if (replayedStock <= 0 || replayedStock + qty <= 0) {
              replayedAvgCost = unitCost;
            } else {
              replayedAvgCost =
                (replayedStock * replayedAvgCost + qty * unitCost) /
                (replayedStock + qty);
            }
            replayedStock += qty;
          }
        }

        await tx.material.update({
          where: { id: materialId },
          data: {
            currentStock: remainingStock,
            avgCost: Math.round(replayedAvgCost * 100) / 100,
          },
        });
      }

      // 4. Xóa mềm đơn nhập hàng (isDeleted = true)
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          isDeleted: true,
        },
      });
    });

    return NextResponse.json({
      message: 'Đã xóa đơn nhập hàng thành công',
    });
  } catch (error: any) {
    console.error('Lỗi khi xóa đơn nhập hàng:', error);

    if (error?.message === 'PURCHASE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn nhập hàng hoặc đơn đã bị xóa' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Không thể xóa đơn nhập hàng' },
      { status: 500 }
    );
  }
}
