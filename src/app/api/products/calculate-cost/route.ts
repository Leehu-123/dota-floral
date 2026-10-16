import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSettingsMap } from '@/lib/product-calc';

const calculateCostSchema = z.object({
  materials: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, 'Vật tư là bắt buộc'),
        quantity: z.coerce.number().positive('Số lượng vật tư phải lớn hơn 0'),
      })
    )
    .optional()
    .default([]),
  laborCost: z.coerce.number().min(0, 'Chi phí công không được âm').optional().default(0),
  overheadPercent: z.coerce.number().min(0, 'Chi phí chung không được âm').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = calculateCostSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validated.data;
    const laborCost = data.laborCost;

    // Lấy cài đặt nếu overheadPercent không được truyền vào
    let overheadPercent = data.overheadPercent;
    if (overheadPercent === undefined) {
      const settings = await getSettingsMap();
      overheadPercent = parseFloat(settings['default_overhead_percent'] || '10');
    }

    const materialIds = data.materials.map((m) => m.materialId);
    const materialsFromDb =
      materialIds.length > 0
        ? await prisma.material.findMany({
            where: {
              id: { in: materialIds },
              isDeleted: false,
            },
            select: {
              id: true,
              name: true,
              baseUnit: true,
              avgCost: true,
              currentStock: true,
              group: true,
            },
          })
        : [];

    const materialMap = new Map(materialsFromDb.map((m) => [m.id, m]));

    let materialCost = 0;
    const computedMaterials = data.materials.map((item) => {
      const mat = materialMap.get(item.materialId);
      const unitCost = mat ? Number(mat.avgCost) : 0;
      const currentStock = mat ? Number(mat.currentStock) : 0;
      const qty = item.quantity;
      const lineCost = Math.round(qty * unitCost);
      const available = currentStock >= qty;

      materialCost += lineCost;

      return {
        materialId: item.materialId,
        name: mat?.name ?? 'Không tìm thấy vật tư',
        baseUnit: mat?.baseUnit ?? '',
        qty,
        unitCost,
        lineCost,
        available,
        currentStock,
        missingQuantity: available ? 0 : Number((qty - currentStock).toFixed(4)),
      };
    });

    const overhead = Math.round((materialCost * overheadPercent) / 100);
    const totalCost = Math.round(materialCost + laborCost + overhead);
    const isAvailable =
      computedMaterials.length === 0 || computedMaterials.every((m) => m.available);

    return NextResponse.json({
      materialCost,
      laborCost,
      overhead,
      overheadPercent,
      totalCost,
      isAvailable,
      materials: computedMaterials,
    });
  } catch (error) {
    console.error('Lỗi khi tính toán chi phí công thức:', error);
    return NextResponse.json(
      { error: 'Không thể tính toán chi phí công thức' },
      { status: 500 }
    );
  }
}
