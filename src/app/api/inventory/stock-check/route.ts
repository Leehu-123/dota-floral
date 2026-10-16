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

    const result = await prisma.$transaction(async (tx) => {
      const adjustments = [];

      for (const item of items) {
        const material = await tx.material.findFirst({
          where: {
            id: item.materialId,
            isDeleted: false,
          },
        });

        if (!material) {
          throw new Error(`NOT_FOUND_${item.materialId}`);
        }

        const currentStock = Number(material.currentStock);
        const actualQty = Number(item.actualQty);
        const diff = actualQty - currentStock;

        if (diff !== 0) {
          const autoNote =
            diff > 0
              ? `Kiểm kho: thừa ${diff} ${material.baseUnit}`
              : `Kiểm kho: thiếu ${Math.abs(diff)} ${material.baseUnit}`;

          const movement = await tx.stockMovement.create({
            data: {
              materialId: item.materialId,
              type: 'adjustment',
              quantity: diff,
              unitCost: material.avgCost,
              refType: 'stock_check',
              note: note ? `${note} (${autoNote})` : autoNote,
            },
          });

          await tx.material.update({
            where: { id: item.materialId },
            data: {
              currentStock: actualQty,
            },
          });

          adjustments.push({
            materialId: item.materialId,
            materialName: material.name,
            baseUnit: material.baseUnit,
            previousStock: currentStock,
            actualStock: actualQty,
            difference: diff,
            movementId: movement.id,
          });
        }
      }

      return {
        totalChecked: items.length,
        adjustedCount: adjustments.length,
        adjustments,
      };
    });

    return NextResponse.json({
      message: 'Kiểm kho hoàn tất thành công',
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
      { error: 'Không thể thực hiện kiểm kho' },
      { status: 500 }
    );
  }
}
