import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatProductResponse } from '@/lib/product-calc';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const original = await prisma.product.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        materials: true,
      },
    });

    if (!original) {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm để nhân bản' },
        { status: 404 }
      );
    }

    const clonedProduct = await prisma.$transaction(async (tx) => {
      const cloned = await tx.product.create({
        data: {
          name: `${original.name} (bản sao)`,
          type: 'template',
          description: original.description,
          imageUrl: original.imageUrl,
          laborCost: original.laborCost,
          overheadPercent: original.overheadPercent,
          targetMargin: original.targetMargin,
          suggestedPrice: original.suggestedPrice,
          materials: {
            create: original.materials.map((m) => ({
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

      return cloned;
    },
    {
      maxWait: 15000,
      timeout: 60000,
    });

    return NextResponse.json(formatProductResponse(clonedProduct, true), { status: 201 });
  } catch (error: any) {
    console.error('Lỗi khi nhân bản mẫu sản phẩm:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể nhân bản mẫu sản phẩm' },
      { status: 500 }
    );
  }
}
