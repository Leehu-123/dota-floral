import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeProductCosts } from '@/lib/product-calc';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const quantity = parseInt(body.quantity, 10);

    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'Số lượng bó cần làm sẵn phải lớn hơn 0' },
        { status: 400 }
      );
    }

    // 1. Kiểm tra sản phẩm và công thức
    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
      include: {
        materials: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm này' },
        { status: 404 }
      );
    }

    if (product.materials.length === 0) {
      return NextResponse.json(
        { error: 'Mẫu sản phẩm này chưa có công thức nguyên vật liệu' },
        { status: 400 }
      );
    }

    // 2. Kiểm tra tồn kho nguyên vật liệu
    const missingMaterials: { name: string; needed: number; available: number; unit: string }[] = [];

    for (const pm of product.materials) {
      const needed = Number(pm.quantity) * quantity;
      const currentStock = Number(pm.material.currentStock);

      if (currentStock < needed) {
        missingMaterials.push({
          name: pm.material.name,
          needed,
          available: currentStock,
          unit: pm.material.baseUnit,
        });
      }
    }

    if (missingMaterials.length > 0) {
      return NextResponse.json(
        {
          error: 'Kho không đủ nguyên vật liệu để bó sẵn số lượng này',
          missingMaterials,
        },
        { status: 400 }
      );
    }

    // 3. Tính giá vốn bó hoa tại thời điểm làm
    const costs = computeProductCosts(
      product.materials.map((pm) => ({
        quantity: pm.quantity,
        material: { avgCost: pm.material.avgCost },
      })),
      Number(product.laborCost) || 0,
      Number(product.overheadPercent) || 0,
      Number(product.suggestedPrice) || 0
    );

    // 4. Thực hiện transaction: Trừ kho nguyên liệu & Tăng tồn kho thành phẩm
    const result = await prisma.$transaction(async (tx) => {
      // 4a. Trừ từng nguyên liệu và ghi StockMovement
      for (const pm of product.materials) {
        const deductQty = Number(pm.quantity) * quantity;

        await tx.stockMovement.create({
          data: {
            materialId: pm.materialId,
            type: 'produce_out',
            quantity: -deductQty,
            unitCost: pm.material.avgCost,
            refType: 'produce_product',
            refId: product.id,
            note: `Bó sẵn ${quantity} bó "${product.name}" vào kho thành phẩm`,
          },
        });

        await tx.material.update({
          where: { id: pm.materialId },
          data: {
            currentStock: {
              decrement: deductQty,
            },
          },
        });
      }

      // 4b. Tăng tồn kho thành phẩm của Product
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stock: {
            increment: quantity,
          },
        },
      });

      // 4c. Ghi nhận ProductMovement
      await tx.productMovement.create({
        data: {
          productId: product.id,
          type: 'produce',
          quantity: quantity,
          unitCost: costs.totalCost,
          refType: 'manual',
          note: `Bó sẵn ${quantity} bó vào kho thành phẩm tại tiệm`,
        },
      });

      return updatedProduct;
    });

    return NextResponse.json({
      success: true,
      message: `Đã bó sẵn thành công ${quantity} bó "${product.name}" vào kho thành phẩm!`,
      newStock: result.stock,
    });
  } catch (error: any) {
    console.error('Lỗi khi bó sẵn thành phẩm:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi tạo thành phẩm' },
      { status: 500 }
    );
  }
}
