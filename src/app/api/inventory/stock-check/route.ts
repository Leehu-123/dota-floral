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
        // Query toàn bộ vật tư trong 1 lần gọi duy nhất thay vì lặp từng câu lệnh
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

        const movementsToCreate: Array<{
          materialId: string;
          type: string;
          quantity: number;
          unitCost: number;
          refType: string;
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
        }> = [];

        for (const item of items) {
          const material = materialMap.get(item.materialId)!;
          const currentStock = Number(material.currentStock);
          const actualQty = Math.round(Number(item.actualQty) * 10000) / 10000;
          const diff = Math.round((actualQty - currentStock) * 10000) / 10000;

          if (Math.abs(diff) > 0.0001) {
            const autoNote =
              diff > 0
                ? `Kiểm kho: thừa ${diff} ${material.baseUnit}`
                : `Kiểm kho: thiếu ${Math.abs(diff)} ${material.baseUnit}`;

            movementsToCreate.push({
              materialId: item.materialId,
              type: 'adjustment',
              quantity: diff,
              unitCost: Number(material.avgCost) || 0,
              refType: 'stock_check',
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
            });
          }
        }

        // Batch insert tất cả stock movements trong 1 lần gọi duy nhất
        if (movementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: movementsToCreate,
          });
        }

        // Cập nhật tồn kho tất cả vật tư song song
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
          totalChecked: items.length,
          adjustedCount: adjustments.length,
          adjustments,
        };
      },
      {
        maxWait: 15000, // Chờ connection pool tối đa 15s
        timeout: 60000, // Timeout giao dịch 60s
      }
    );

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
      { error: error?.message || 'Không thể thực hiện kiểm kho' },
      { status: 500 }
    );
  }
}
