import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Tên khách hàng là bắt buộc').optional(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  zaloLink: z.string().trim().optional().nullable(),
  facebookLink: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          where: { isDeleted: false },
          orderBy: [
            { orderDate: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 10,
          select: {
            id: true,
            code: true,
            orderDate: true,
            totalAmount: true,
            status: true,
            channel: true,
            deliveryType: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      );
    }

    const formatted = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      zaloLink: customer.zaloLink,
      facebookLink: customer.facebookLink,
      note: customer.note,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      ordersCount: customer._count.orders,
      orders: customer.orders.map((o) => ({
        id: o.id,
        code: o.code,
        orderDate: o.orderDate,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        channel: o.channel,
        deliveryType: o.deliveryType,
        createdAt: o.createdAt,
      })),
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khách hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin khách hàng' },
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
    const validated = updateCustomerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      );
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: validated.data,
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin khách hàng:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật thông tin khách hàng' },
      { status: 500 }
    );
  }
}
