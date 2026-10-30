import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const actualStock = parseInt(body.actualStock, 10);
    const reason = body.reason?.trim() || '';
    const type = body.type || 'damage'; // 'damage' | 'adjustment'

    if (isNaN(actualStock) || actualStock < 0) {
      return NextResponse.json(
        { error: 'Số lượng tồn thực tế không hợp lệ' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Không tìm thấy mẫu sản phẩm này' },
        { status: 404 }
      );
    }

    const diff = actualStock - product.stock;

    if (diff === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tồn kho không thay đổi',
        stock: product.stock,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: { stock: actualStock },
      });

      await tx.productMovement.create({
        data: {
          productId: id,
          type: type === 'damage' ? 'damage' : 'adjustment',
          quantity: diff,
          unitCost: product.suggestedPrice,
          refType: 'manual',
          note: reason || (diff < 0 ? `Hao hụt/hỏng ${Math.abs(diff)} bó` : `Điều chỉnh kiểm kê +${diff} bó`),
        },
      });

      return p;
    },
    {
      maxWait: 15000,
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật tồn kho thành phẩm thành ${updated.stock} bó!`,
      stock: updated.stock,
    });
  } catch (error: any) {
    console.error('Lỗi khi điều chỉnh tồn kho thành phẩm:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi điều chỉnh tồn kho' },
      { status: 500 }
    );
  }
}
