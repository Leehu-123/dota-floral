import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  calculateSuggestedPrice,
  formatProductResponse,
  getSettingsMap,
} from '@/lib/product-calc';

const updateProductSchema = z.object({
  name: z.string().trim().min(1, 'Tên mẫu sản phẩm là bắt buộc'),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  laborCost: z.coerce.number().min(0, 'Chi phí công không được âm').optional().default(0),
  overheadPercent: z.coerce.number().min(0, 'Chi phí chung không được âm').optional(),
  targetMargin: z.coerce.number().min(0, 'Biên lợi nhuận mục tiêu không được âm').optional(),
  suggestedPrice: z.coerce.number().min(0, 'Giá bán đề xuất không được âm').optional(),
  materials: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, 'Vật tư là bắt buộc'),
        quantity: z.coerce.number().positive('Số lượng vật tư phải lớn hơn 0'),
      })
    )
    .optional()
    .default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        isDeleted: false,
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
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm' },
        { status: 404 }
      );
    }

    const formatted = formatProductResponse(product, true);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin mẫu sản phẩm' },
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
    const validated = updateProductSchema.safeParse(body);

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

    // Gộp các nguyên vật liệu trùng nhau nếu có
    const mergedMaterialsMap = new Map<string, number>();
    for (const item of data.materials) {
      const current = mergedMaterialsMap.get(item.materialId) || 0;
      mergedMaterialsMap.set(item.materialId, current + item.quantity);
    }
    const normalizedMaterials = Array.from(mergedMaterialsMap.entries()).map(
      ([materialId, quantity]) => ({
        materialId,
        quantity,
      })
    );

    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra sản phẩm tồn tại
      const existing = await tx.product.findFirst({
        where: { id, isDeleted: false },
      });

      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      // 2. Đọc cấu hình
      const settings = await getSettingsMap(tx);
      const defaultMargin = parseFloat(settings['default_margin'] || '40');
      const defaultOverhead = parseFloat(settings['default_overhead_percent'] || '10');
      const roundingStep = parseInt(settings['price_rounding_step'] || '5000', 10);

      const overheadPercent =
        data.overheadPercent !== undefined
          ? data.overheadPercent
          : Number(existing.overheadPercent) || defaultOverhead;

      const targetMargin =
        data.targetMargin !== undefined
          ? data.targetMargin
          : Number(existing.targetMargin) || defaultMargin;

      const laborCost =
        data.laborCost !== undefined ? data.laborCost : Number(existing.laborCost) || 0;

      // 3. Kiểm tra vật tư
      const materialIds = normalizedMaterials.map((m) => m.materialId);
      const materialsData =
        materialIds.length > 0
          ? await tx.material.findMany({
              where: {
                id: { in: materialIds },
                isDeleted: false,
              },
              select: {
                id: true,
                name: true,
                avgCost: true,
                baseUnit: true,
                currentStock: true,
                group: true,
                imageUrl: true,
              },
            })
          : [];

      if (materialsData.length !== materialIds.length) {
        const foundIds = new Set(materialsData.map((m) => m.id));
        const missingIds = materialIds.filter((mId) => !foundIds.has(mId));
        throw new Error(`Không tìm thấy nguyên vật liệu có ID: ${missingIds.join(', ')}`);
      }

      // 4. Tính toán chi phí
      let materialCost = 0;
      for (const item of normalizedMaterials) {
        const mat = materialsData.find((m) => m.id === item.materialId);
        if (mat) {
          materialCost += item.quantity * Number(mat.avgCost);
        }
      }

      const overheadCost = Math.round((materialCost * overheadPercent) / 100);
      const totalCost = Math.round(materialCost + laborCost + overheadCost);

      // 5. Tính lại giá đề xuất nếu cần
      let suggestedPrice = data.suggestedPrice;
      if (suggestedPrice === undefined || suggestedPrice === null || suggestedPrice <= 0) {
        suggestedPrice = calculateSuggestedPrice(totalCost, targetMargin, roundingStep);
      }

      // 6. Cập nhật thông tin Product
      await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          laborCost,
          overheadPercent,
          targetMargin,
          suggestedPrice,
        },
      });

      // 7. Xóa toàn bộ liên kết ProductMaterial cũ
      await tx.productMaterial.deleteMany({
        where: { productId: id },
      });

      // 8. Tạo lại các liên kết ProductMaterial mới
      if (normalizedMaterials.length > 0) {
        await tx.productMaterial.createMany({
          data: normalizedMaterials.map((m) => ({
            productId: id,
            materialId: m.materialId,
            quantity: m.quantity,
          })),
        });
      }

      // 9. Lấy lại dữ liệu đầy đủ sau khi cập nhật
      const result = await tx.product.findUnique({
        where: { id },
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
      });

      return result;
    });

    return NextResponse.json(formatProductResponse(updatedProduct, true));
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm để cập nhật' },
        { status: 404 }
      );
    }
    console.error('Lỗi khi cập nhật mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: error.message || 'Không thể cập nhật mẫu sản phẩm' },
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

    const product = await prisma.product.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm để xóa' },
        { status: 404 }
      );
    }

    // Kiểm tra xem mẫu sản phẩm đã từng được sử dụng trong đơn hàng chưa
    const orderLinesCount = await prisma.orderLine.count({
      where: { productId: id },
    });

    // Thực hiện xóa mềm
    await prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });

    if (orderLinesCount > 0) {
      return NextResponse.json({
        message: 'Đã xóa mẫu sản phẩm thành công',
        warning: `Mẫu sản phẩm này đã được dùng trong ${orderLinesCount} dòng đơn hàng, đã được chuyển vào trạng thái lưu trữ đã xóa`,
        hasOrders: true,
        orderLinesCount,
      });
    }

    return NextResponse.json({
      message: 'Đã xóa mẫu sản phẩm thành công',
      hasOrders: false,
    });
  } catch (error) {
    console.error('Lỗi khi xóa mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: 'Không thể xóa mẫu sản phẩm' },
      { status: 500 }
    );
  }
}
