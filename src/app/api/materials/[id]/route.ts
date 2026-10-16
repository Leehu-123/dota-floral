import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MATERIAL_GROUPS } from '@/lib/constants';

const updateMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Tên vật tư không được để trống').optional(),
  group: z.string().trim().min(1, 'Nhóm vật tư không được để trống').refine(
    (val) => MATERIAL_GROUPS.some((g) => g.value === val),
    { message: 'Nhóm vật tư không hợp lệ' }
  ).optional(),
  baseUnit: z.string().trim().min(1, 'Đơn vị cơ bản không được để trống').optional(),
  purchaseUnit: z.string().trim().min(1, 'Đơn vị nhập không được để trống').optional(),
  conversionFactor: z.coerce.number().positive('Hệ số quy đổi phải lớn hơn 0').optional(),
  minStock: z.coerce.number().min(0, 'Tồn kho tối thiểu không được âm').optional(),
  note: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
});

function computeMaterialStatus(stock: number, min: number): 'ok' | 'low' | 'out' {
  if (stock <= 0) return 'out';
  if (stock <= min) return 'low';
  return 'ok';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const material = await prisma.material.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
        purchaseLines: {
          where: {
            purchase: {
              isDeleted: false,
            },
          },
          include: {
            purchase: {
              select: {
                id: true,
                date: true,
                supplierName: true,
                shippingCost: true,
                totalAmount: true,
              },
            },
          },
          orderBy: {
            purchase: {
              date: 'desc',
            },
          },
          take: 20,
        },
      },
    });

    if (!material) {
      return NextResponse.json(
        { error: 'Không tìm thấy vật tư' },
        { status: 404 }
      );
    }

    const currentStock = Number(material.currentStock);
    const minStock = Number(material.minStock);

    const formatted = {
      ...material,
      conversionFactor: Number(material.conversionFactor),
      minStock,
      avgCost: Number(material.avgCost),
      currentStock,
      status: computeMaterialStatus(currentStock, minStock),
      stockMovements: material.stockMovements.map((sm) => ({
        ...sm,
        quantity: Number(sm.quantity),
        unitCost: Number(sm.unitCost),
      })),
      purchaseLines: material.purchaseLines.map((pl) => ({
        ...pl,
        quantity: Number(pl.quantity),
        unitPrice: Number(pl.unitPrice),
        lineTotal: Number(pl.lineTotal),
        convertedQty: Number(pl.convertedQty),
        purchase: {
          ...pl.purchase,
          shippingCost: Number(pl.purchase.shippingCost),
          totalAmount: Number(pl.purchase.totalAmount),
        },
      })),
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết vật tư:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin vật tư' },
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

    const validated = updateMaterialSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.material.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy vật tư' },
        { status: 404 }
      );
    }

    const data = validated.data;

    // Kiểm tra xem có thay đổi baseUnit, purchaseUnit hoặc conversionFactor không
    const isChangingUnits =
      (data.baseUnit !== undefined && data.baseUnit !== existing.baseUnit) ||
      (data.purchaseUnit !== undefined && data.purchaseUnit !== existing.purchaseUnit) ||
      (data.conversionFactor !== undefined &&
        Number(data.conversionFactor) !== Number(existing.conversionFactor));

    if (isChangingUnits) {
      const movementCount = await prisma.stockMovement.count({
        where: { materialId: id },
      });

      if (movementCount > 0) {
        return NextResponse.json(
          {
            error:
              'Không thể thay đổi đơn vị tính hoặc hệ số quy đổi khi vật tư đã có phát sinh giao dịch kho',
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.material.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.group !== undefined && { group: data.group }),
        ...(data.baseUnit !== undefined && { baseUnit: data.baseUnit }),
        ...(data.purchaseUnit !== undefined && { purchaseUnit: data.purchaseUnit }),
        ...(data.conversionFactor !== undefined && { conversionFactor: data.conversionFactor }),
        ...(data.minStock !== undefined && { minStock: data.minStock }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      },
    });

    const currentStock = Number(updated.currentStock);
    const minStock = Number(updated.minStock);

    return NextResponse.json({
      ...updated,
      conversionFactor: Number(updated.conversionFactor),
      minStock,
      avgCost: Number(updated.avgCost),
      currentStock,
      status: computeMaterialStatus(currentStock, minStock),
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật vật tư:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật vật tư' },
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

    const existing = await prisma.material.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy vật tư' },
        { status: 404 }
      );
    }

    const movementCount = await prisma.stockMovement.count({
      where: { materialId: id },
    });

    await prisma.material.update({
      where: { id },
      data: { isDeleted: true },
    });

    if (movementCount > 0) {
      return NextResponse.json({
        message: 'Đã xóa vật tư',
        warning: 'Vật tư đã có lịch sử kho, đã chuyển sang trạng thái đã xóa',
        hasMovements: true,
      });
    }

    return NextResponse.json({
      message: 'Đã xóa vật tư thành công',
      hasMovements: false,
    });
  } catch (error) {
    console.error('Lỗi khi xóa vật tư:', error);
    return NextResponse.json(
      { error: 'Không thể xóa vật tư' },
      { status: 500 }
    );
  }
}
