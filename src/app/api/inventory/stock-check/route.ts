import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const stockCheckSchema = z.object({
  items: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, 'materialId là bắt buộc'),
        actualQty: z.coerce.number().min(0, 'Số lượng kiểm kho không được âm'),
      })
    )
    .min(1, 'Danh sách kiểm kho không được rỗng'),
  note: z.string().trim().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = stockCheckSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { items, note } = validated.data;

    // 1. Lấy danh sách materialIds cần kiểm tra (loại bỏ trùng lặp nếu có)
    const materialIds = Array.from(new Set(items.map((i) => i.materialId)));

    const result = await prisma.$transaction(
      async (tx) => {
        // Query toàn bộ vật tư trong 1 lần gọi duy nhất
        const materials = await tx.material.findMany({
          where: {
            id: { in: materialIds },
            isDeleted: false,
          },
        });

        const materialMap = new Map(materials.map((m) => [m.id, m]));

        // Kiểm tra vật tư có tồn tại không
        for (const id of materialIds) {
          if (!materialMap.has(id)) {
            throw new Error(`NOT_FOUND_${id}`);
          }
        }

        // Sinh mã phiếu kiểm kho dạng PKK-YYYYMMDD-XXX
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const prefix = `PKK-${y}${m}${d}-`;

        const todayChecksCount = await tx.stockCheck.count({
          where: {
            code: { startsWith: prefix },
          },
        });
        const code = `${prefix}${String(todayChecksCount + 1).padStart(3, '0')}`;

        let increaseCount = 0;
        let decreaseCount = 0;
        let matchCount = 0;
        let totalDiffCost = 0;

        const movementsToCreate: Array<{
          materialId: string;
          type: string;
          quantity: number;
          unitCost: number;
          refType: string;
          refId: string;
          note: string;
        }> = [];

        const updates: Array<{
          id: string;
          actualQty: number;
        }> = [];

        const adjustments: Array<{
          materialId: string;
          materialName: string;
          baseUnit: string;
          previousStock: number;
          actualStock: number;
          difference: number;
          unitCost: number;
          costDiff: number;
        }> = [];

        // 1. Tạo phiếu kiểm kho trước để lấy ID
        const stockCheck = await tx.stockCheck.create({
          data: {
            code,
            checkDate: now,
            note: note || `Kiểm kho đợt ${d}/${m}/${y}`,
            totalItems: items.length,
            increaseCount: 0,
            decreaseCount: 0,
            matchCount: 0,
            totalDiffCost: 0,
          },
        });

        const checkItemsToCreate: Array<{
          stockCheckId: string;
          materialId: string;
          previousStock: number;
          actualStock: number;
          difference: number;
          unitCost: number;
          totalCostDiff: number;
          note: string;
        }> = [];

        for (const item of items) {
          const material = materialMap.get(item.materialId)!;
          const currentStock = Number(material.currentStock);
          const actualQty = Math.round(Number(item.actualQty) * 10000) / 10000;
          const diff = Math.round((actualQty - currentStock) * 10000) / 10000;
          const unitCost = Number(material.avgCost) || 0;
          const costDiff = Math.round(diff * unitCost);

          totalDiffCost += costDiff;

          let autoNote = 'Khớp tồn kho';
          if (diff > 0) {
            increaseCount++;
            autoNote = `Kiểm kho: thừa ${diff} ${material.baseUnit}`;
          } else if (diff < 0) {
            decreaseCount++;
            autoNote = `Kiểm kho: thiếu ${Math.abs(diff)} ${material.baseUnit}`;
          } else {
            matchCount++;
          }

          checkItemsToCreate.push({
            stockCheckId: stockCheck.id,
            materialId: item.materialId,
            previousStock: currentStock,
            actualStock: actualQty,
            difference: diff,
            unitCost,
            totalCostDiff: costDiff,
            note: autoNote,
          });

          // Nếu có chênh lệch, tạo stock movement và ghi log
          if (Math.abs(diff) > 0.0001) {
            movementsToCreate.push({
              materialId: item.materialId,
              type: 'adjustment',
              quantity: diff,
              unitCost,
              refType: 'stock_check',
              refId: stockCheck.id,
              note: note ? `${note} (${autoNote})` : autoNote,
            });

            updates.push({
              id: item.materialId,
              actualQty,
            });

            adjustments.push({
              materialId: item.materialId,
              materialName: material.name,
              baseUnit: material.baseUnit,
              previousStock: currentStock,
              actualStock: actualQty,
              difference: diff,
              unitCost,
              costDiff,
            });
          }
        }

        // Tạo chi tiết phiếu kiểm kho
        if (checkItemsToCreate.length > 0) {
          await tx.stockCheckItem.createMany({
            data: checkItemsToCreate,
          });
        }

        // Cập nhật lại thông số tổng của phiếu kiểm kho
        await tx.stockCheck.update({
          where: { id: stockCheck.id },
          data: {
            increaseCount,
            decreaseCount,
            matchCount,
            totalDiffCost,
          },
        });

        // Batch insert tất cả stock movements nếu có chênh lệch
        if (movementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: movementsToCreate,
          });
        }

        // Cập nhật tồn kho tất cả vật tư
        if (updates.length > 0) {
          await Promise.all(
            updates.map((u) =>
              tx.material.update({
                where: { id: u.id },
                data: {
                  currentStock: u.actualQty,
                },
              })
            )
          );
        }

        return {
          stockCheck: {
            id: stockCheck.id,
            code,
            checkDate: now,
            note: note || `Kiểm kho đợt ${d}/${m}/${y}`,
            totalItems: items.length,
            increaseCount,
            decreaseCount,
            matchCount,
            totalDiffCost,
          },
          totalChecked: items.length,
          adjustedCount: adjustments.length,
          adjustments,
        };
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    return NextResponse.json({
      message: `Đã tạo phiếu kiểm kho ${result.stockCheck.code} thành công`,
      ...result,
    });
  } catch (error: any) {
    console.error('Lỗi khi thực hiện kiểm kho:', error);

    if (typeof error?.message === 'string' && error.message.startsWith('NOT_FOUND_')) {
      const materialId = error.message.replace('NOT_FOUND_', '');
      return NextResponse.json(
        { error: `Không tìm thấy vật tư có ID: ${materialId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'Không thể thực hiện kiểm kho' },
      { status: 500 }
    );
  }
}
