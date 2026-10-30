import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  calculateSuggestedPrice,
  formatProductResponse,
  getSettingsMap,
} from '@/lib/product-calc';

const createProductSchema = z.object({
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const where: any = {
      isDeleted: false,
      type: 'template',
    };

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const products = await prisma.product.findMany({
      where,
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
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });

    const formatted = products.map((product) => formatProductResponse(product));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách mẫu sản phẩm' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createProductSchema.safeParse(body);

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

    const createdProduct = await prisma.$transaction(async (tx) => {
      // 1. Đọc cài đặt để lấy giá trị mặc định và bước làm tròn
      const settings = await getSettingsMap(tx);
      const defaultMargin = parseFloat(settings['default_margin'] || '40');
      const defaultOverhead = parseFloat(settings['default_overhead_percent'] || '10');
      const roundingStep = parseInt(settings['price_rounding_step'] || '5000', 10);

      const overheadPercent =
        data.overheadPercent !== undefined ? data.overheadPercent : defaultOverhead;
      const targetMargin =
        data.targetMargin !== undefined ? data.targetMargin : defaultMargin;
      const laborCost = data.laborCost ?? 0;

      // 2. Kiểm tra các nguyên vật liệu có tồn tại trong hệ thống
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
        const missingIds = materialIds.filter((id) => !foundIds.has(id));
        throw new Error(`Không tìm thấy nguyên vật liệu có ID: ${missingIds.join(', ')}`);
      }

      // 3. Tính chi phí nguyên vật liệu và tổng chi phí
      let materialCost = 0;
      for (const item of normalizedMaterials) {
        const mat = materialsData.find((m) => m.id === item.materialId);
        if (mat) {
          materialCost += item.quantity * Number(mat.avgCost);
        }
      }

      const overheadCost = Math.round((materialCost * overheadPercent) / 100);
      const totalCost = Math.round(materialCost + laborCost + overheadCost);

      // 4. Xác định giá bán đề xuất: Nếu không có hoặc <= 0 thì tự động tính theo targetMargin và làm tròn
      let suggestedPrice = data.suggestedPrice;
      if (suggestedPrice === undefined || suggestedPrice === null || suggestedPrice <= 0) {
        suggestedPrice = calculateSuggestedPrice(totalCost, targetMargin, roundingStep);
      }

      // 5. Tạo Product với type='template' và ProductMaterial trong giao dịch
      const product = await tx.product.create({
        data: {
          name: data.name,
          type: 'template',
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          laborCost,
          overheadPercent,
          targetMargin,
          suggestedPrice,
          materials: {
            create: normalizedMaterials.map((m) => ({
              materialId: m.materialId,
              quantity: m.quantity,
            })),
          },
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

      return product;
    },
    {
      maxWait: 15000,
      timeout: 60000,
    });

    return NextResponse.json(formatProductResponse(createdProduct), { status: 201 });
  } catch (error: any) {
    console.error('Lỗi khi tạo mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: error.message || 'Không thể tạo mẫu sản phẩm' },
      { status: 500 }
    );
  }
}
