import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const updatePurchaseSchema = z.object({
  date: z.string().or(z.date()),
  supplierName: z.string().trim().min(1, 'Tên nhà cung cấp là bắt buộc'),
  shippingCost: z.coerce.number().min(0, 'Chi phí vận chuyển không được âm').default(0),
  note: z.string().trim().optional().nullable(),
  invoiceImageUrl: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, 'Vật tư là bắt buộc'),
        quantity: z.coerce.number().positive('Số lượng nhập phải lớn hơn 0'),
        unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm'),
      })
    )
    .min(1, 'Đơn nhập hàng phải có ít nhất 1 mặt hàng'),
});

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const validated = updatePurchaseSchema.safeParse(body);

    if (!validated.success) {
      const firstError = validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ';
      return NextResponse.json(
        {
          error: firstError,
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { date, supplierName, shippingCost, note, invoiceImageUrl, lines } = validated.data;

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Ngày nhập hàng không hợp lệ' },
        { status: 400 }
      );
    }

    const updatedPurchase = await prisma.$transaction(
      async (tx) => {
        // 1. Kiểm tra phiếu nhập hiện tại
        const existingPurchase = await tx.purchase.findFirst({
          where: {
            id,
            isDeleted: false,
          },
          include: {
            lines: true,
          },
        });

        if (!existingPurchase) {
          throw new Error('PURCHASE_NOT_FOUND');
        }

        // 2. Thu thập toàn bộ ID vật tư bị ảnh hưởng (cả vật tư cũ lẫn vật tư mới sau khi sửa)
        const oldMaterialIds = existingPurchase.lines.map((l) => l.materialId);
        const newMaterialIds = lines.map((l) => l.materialId);
        const allAffectedMaterialIds = Array.from(
          new Set([...oldMaterialIds, ...newMaterialIds])
        );

        // 3. Upsert Nhà cung cấp
        const trimmedSupplierName = supplierName.trim();
        const supplier = await tx.supplier.upsert({
          where: { name: trimmedSupplierName },
          update: {},
          create: { name: trimmedSupplierName },
        });

        // 4. Batch query: Lấy thông tin các vật tư mới
        const materials = await tx.material.findMany({
          where: {
            id: { in: newMaterialIds },
            isDeleted: false,
          },
        });
        const materialMap = new Map(materials.map((m) => [m.id, m]));

        for (const line of lines) {
          if (!materialMap.has(line.materialId)) {
            throw new Error(`NOT_FOUND_${line.materialId}`);
          }
        }

        // 5. Tính toán các dòng mới
        let linesTotalSum = 0;
        const preparedLines = lines.map((line) => {
          const material = materialMap.get(line.materialId)!;
          const qty = Number(line.quantity);
          const unitPrice = Math.round(Number(line.unitPrice));
          const convFactor = Number(material.conversionFactor) || 1;
          const lineTotal = Math.round(qty * unitPrice);
          const convertedQty = qty * convFactor;

          linesTotalSum += lineTotal;

          return {
            materialId: line.materialId,
            quantity: qty,
            unitPrice,
            lineTotal,
            convertedQty,
            material,
          };
        });

        const totalAmount = linesTotalSum + Math.round(Number(shippingCost) || 0);

        // 6. Xóa các dòng purchase_lines cũ và các biến động kho stock_movement cũ của phiếu này
        await tx.purchaseLine.deleteMany({
          where: { purchaseId: id },
        });

        await tx.stockMovement.deleteMany({
          where: {
            refType: 'purchase',
            refId: id,
          },
        });

        // 7. Cập nhật Purchase và tạo lại các dòng PurchaseLine mới
        const purchase = await tx.purchase.update({
          where: { id },
          data: {
            date: parsedDate,
            supplierId: supplier.id,
            supplierName: supplier.name,
            shippingCost: Math.round(Number(shippingCost) || 0),
            totalAmount,
            note: note || null,
            invoiceImageUrl: invoiceImageUrl || null,
            lines: {
              create: preparedLines.map((l) => ({
                materialId: l.materialId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                convertedQty: l.convertedQty,
              })),
            },
          },
          include: {
            lines: {
              include: {
                material: true,
              },
            },
            supplier: true,
          },
        });

        // 8. Tạo lại các StockMovement mới
        const stockMovementsToCreate = preparedLines.map((pl) => {
          const unitCostPerBaseUnit =
            pl.convertedQty > 0 ? pl.lineTotal / pl.convertedQty : 0;

          return {
            materialId: pl.materialId,
            type: 'purchase_in',
            quantity: pl.convertedQty,
            unitCost: Math.round(unitCostPerBaseUnit * 100) / 100,
            refType: 'purchase',
            refId: purchase.id,
            note: `Nhập hàng từ ${supplier.name} (chỉnh sửa)`,
          };
        });

        if (stockMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: stockMovementsToCreate,
          });
        }

        // 9. Tính toán lại tồn kho và giá vốn bình quân gia quyền cho TẤT CẢ các vật tư bị ảnh hưởng
        for (const materialId of allAffectedMaterialIds) {
          // Tổng tồn kho = tổng tất cả stock_movements hiện có
          const allMovements = await tx.stockMovement.findMany({
            where: { materialId },
          });

          const remainingStock = allMovements.reduce(
            (sum, m) => sum + Number(m.quantity),
            0
          );

          // Phát lại toàn bộ các lần nhập hàng theo thời gian để tính giá vốn bình quân chính xác
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

        return purchase;
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    return NextResponse.json(formatPurchase(updatedPurchase));
  } catch (error: any) {
    console.error('Lỗi khi cập nhật đơn nhập hàng:', error);

    if (error?.message === 'PURCHASE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn nhập hàng hoặc đơn đã bị xóa' },
        { status: 404 }
      );
    }

    if (typeof error?.message === 'string' && error.message.startsWith('NOT_FOUND_')) {
      const materialId = error.message.replace('NOT_FOUND_', '');
      return NextResponse.json(
        { error: `Không tìm thấy vật tư có ID: ${materialId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'Không thể cập nhật đơn nhập hàng' },
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

    await prisma.$transaction(
      async (tx) => {
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
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

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
