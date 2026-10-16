import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Tên khách hàng là bắt buộc'),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  zaloLink: z.string().trim().optional().nullable(),
  facebookLink: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 20;

    const where: any = {};

    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        orders: {
          where: { isDeleted: false },
          orderBy: [
            { orderDate: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 1,
          select: {
            orderDate: true,
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

    // Sắp xếp: Ưu tiên khách có đơn gần nhất trước, nếu cùng thời gian thì sắp theo tên Tiếng Việt
    customers.sort((a, b) => {
      const aOrder = a.orders[0];
      const bOrder = b.orders[0];
      const aTime = aOrder ? new Date(aOrder.orderDate || aOrder.createdAt).getTime() : 0;
      const bTime = bOrder ? new Date(bOrder.orderDate || bOrder.createdAt).getTime() : 0;

      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return a.name.localeCompare(b.name, 'vi');
    });

    const result = customers.slice(0, limit).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      zaloLink: c.zaloLink,
      facebookLink: c.facebookLink,
      note: c.note,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ordersCount: c._count.orders,
      lastOrderDate: c.orders[0]?.orderDate || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khách hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách khách hàng' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCustomerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu khách hàng không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, phone, address, zaloLink, facebookLink, note } = validated.data;

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        address: address || null,
        zaloLink: zaloLink || null,
        facebookLink: facebookLink || null,
        note: note || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo khách hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tạo khách hàng mới' },
      { status: 500 }
    );
  }
}
