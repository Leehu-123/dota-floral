import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        customer: true,
        lines: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng' },
        { status: 404 }
      );
    }

    const formatVNDText = (amount: number) => {
      const rounded = Math.round(amount);
      return `${rounded.toLocaleString('vi-VN')} đ`;
    };

    const phone = order.customerPhone || order.customer?.phone;
    const customerInfo = phone
      ? `Khach hang: ${order.customerName}\nSĐT: ${phone}`
      : `Khach hang: ${order.customerName}`;

    const linesText = order.lines
      .map(
        (line) =>
          `- ${line.productName} x${line.quantity}: ${formatVNDText(Number(line.lineTotal))}`
      )
      .join('\n');

    const subtotal = order.lines.reduce(
      (sum, line) => sum + Number(line.lineTotal),
      0
    );
    const shippingFee = Number(order.shippingFee) || 0;
    const discount = Number(order.discount) || 0;
    const totalAmount = Number(order.totalAmount) || 0;

    let deliveryDateText = 'Chưa xác định';
    if (order.deliveryDate) {
      const vnDate = new Date(order.deliveryDate.getTime() + 7 * 60 * 60 * 1000);
      const dd = String(vnDate.getUTCDate()).padStart(2, '0');
      const mm = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = vnDate.getUTCFullYear();
      const hh = String(vnDate.getUTCHours()).padStart(2, '0');
      const min = String(vnDate.getUTCMinutes()).padStart(2, '0');
      deliveryDateText = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    }

    let deliveryTypeText = 'Ship';
    if (order.deliveryType === 'pickup') {
      deliveryTypeText = 'Nhận tại tiệm';
    } else if (order.deliveryType === 'ship') {
      deliveryTypeText = 'Ship';
    } else {
      deliveryTypeText = order.deliveryType;
    }

    const text = `🌸 Dota Floral - Xac nhan don hang

Ma don: ${order.code}
${customerInfo}

San pham:
${linesText}

Tam tinh: ${formatVNDText(subtotal)}
Phi ship: ${formatVNDText(shippingFee)}
Giam gia: ${formatVNDText(discount)}
Tong cong: ${formatVNDText(totalAmount)}

Giao hang: ${deliveryDateText}
Hinh thuc: ${deliveryTypeText}

Cam on quy khach! 🌸`;

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Lỗi khi tạo nội dung đơn hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tạo nội dung chia sẻ đơn hàng' },
      { status: 500 }
    );
  }
}
