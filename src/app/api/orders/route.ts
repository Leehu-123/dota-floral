import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  formatOrder,
  generateOrderCode,
  getChannelFeePercent,
} from '@/lib/order-calc';

const createOrderSchema = z.object({
  channel: z.string().trim().min(1, 'Kênh bán hàng là bắt buộc'),
  customerName: z.string().trim().min(1, 'Tên khách hàng là bắt buộc'),
  customerPhone: z.string().trim().optional().nullable(),
  customerAddress: z.string().trim().optional().nullable(),
  customerZaloLink: z.string().trim().optional().nullable(),
  customerFacebookLink: z.string().trim().optional().nullable(),
  deliveryType: z.enum(['pickup', 'ship']).optional().default('pickup'),
  deliveryDate: z.string().or(z.date()).optional().nullable(),
  orderDate: z.string().or(z.date()).optional().nullable(),
  shippingFee: z.coerce.number().min(0, 'Phí vận chuyển không được âm').optional().default(0),
  discount: z.coerce.number().min(0, 'Giảm giá không được âm').optional().default(0),
  note: z.string().trim().optional().nullable(),
  paymentStatus: z.enum(['unpaid', 'deposited', 'paid']).optional().default('unpaid'),
  depositAmount: z.coerce.number().min(0, 'Tiền đặt cọc không được âm').optional().default(0),
  paymentMethod: z.string().trim().optional().nullable(),
  referenceImageUrl: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().optional().nullable(),
        productName: z.string().trim().min(1, 'Tên mặt hàng là bắt buộc'),
        quantity: z.coerce.number().int().min(1, 'Số lượng tối thiểu là 1').default(1),
        unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm'),
        isCustom: z.boolean().optional().default(false),
        fromStock: z.boolean().optional().default(false),
        materials: z
          .array(
            z.object({
              materialId: z.string().trim().min(1, 'Vật tư là bắt buộc'),
              quantity: z.coerce.number().positive('Số lượng vật tư phải lớn hơn 0'),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1, 'Đơn hàng phải có ít nhất 1 mặt hàng'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const channelParam = searchParams.get('channel');
    const searchParam = searchParams.get('search');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const deliveryToday = searchParams.get('deliveryToday');
    const deliveryTomorrow = searchParams.get('deliveryTomorrow');
    const paymentStatusParam = searchParams.get('paymentStatus');

    const where: any = {
      isDeleted: false,
    };

    // 1. Lọc theo trạng thái đơn hàng (hỗ trợ phân cách bởi dấu phẩy ?status=new,in_progress)
    if (statusParam && statusParam.trim()) {
      const statuses = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    // 2. Lọc theo kênh bán hàng
    if (channelParam && channelParam.trim()) {
      where.channel = channelParam.trim();
    }

    // 3. Tìm kiếm theo tên khách, sđt, mã đơn hàng
    if (searchParam && searchParam.trim()) {
      const s = searchParam.trim();
      where.OR = [
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
      ];
    }

    // 4. Lọc theo khoảng ngày đặt hàng (orderDate)
    if (fromParam || toParam) {
      where.orderDate = {};
      if (fromParam) {
        where.orderDate.gte = new Date(fromParam);
      }
      if (toParam) {
        where.orderDate.lte = new Date(
          toParam.includes('T') ? toParam : `${toParam}T23:59:59.999Z`
        );
      }
    }

    // 5 & 6. Lọc theo ngày giao hôm nay hoặc ngày mai (tính theo giờ Việt Nam UTC+7)
    const vnOffsetMs = 7 * 60 * 60 * 1000;
    const now = new Date();
    const vnNow = new Date(now.getTime() + vnOffsetMs);
    const curYear = vnNow.getUTCFullYear();
    const curMonth = vnNow.getUTCMonth();
    const curDay = vnNow.getUTCDate();

    if (deliveryToday === 'true') {
      const startToday = new Date(Date.UTC(curYear, curMonth, curDay, 0, 0, 0) - vnOffsetMs);
      const endToday = new Date(Date.UTC(curYear, curMonth, curDay, 23, 59, 59, 999) - vnOffsetMs);
      where.deliveryDate = {
        gte: startToday,
        lte: endToday,
      };
    } else if (deliveryTomorrow === 'true') {
      const startTomorrow = new Date(Date.UTC(curYear, curMonth, curDay + 1, 0, 0, 0) - vnOffsetMs);
      const endTomorrow = new Date(Date.UTC(curYear, curMonth, curDay + 1, 23, 59, 59, 999) - vnOffsetMs);
      where.deliveryDate = {
        gte: startTomorrow,
        lte: endTomorrow,
      };
    }

    // 7. Lọc theo trạng thái thanh toán
    if (paymentStatusParam && paymentStatusParam.trim()) {
      where.paymentStatus = paymentStatusParam.trim();
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        lines: {
          include: {
            materials: {
              include: {
                material: {
                  select: {
                    id: true,
                    name: true,
                    baseUnit: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            lines: true,
          },
        },
      },
      orderBy: [
        { orderDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const formatted = orders.map(formatOrder);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách đơn hàng' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createOrderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu đơn hàng không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      channel,
      customerName,
      customerPhone,
      customerAddress,
      customerZaloLink,
      customerFacebookLink,
      deliveryType,
      deliveryDate,
      orderDate: rawOrderDate,
      shippingFee,
      discount,
      note,
      paymentStatus,
      depositAmount,
      paymentMethod,
      referenceImageUrl,
      lines,
    } = validated.data;

    const orderDate = rawOrderDate ? new Date(rawOrderDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Sinh mã đơn hàng dạng DF-YYMMDD-NNN
      const code = await generateOrderCode(tx, orderDate);

      // 2. Tìm hoặc tạo Customer theo số điện thoại (nếu có) hoặc theo tên. Cập nhật thông tin nếu đã tồn tại.
      const trimmedPhone = customerPhone?.trim() || null;
      const trimmedName = customerName.trim();
      let customer = null;

      if (trimmedPhone) {
        customer = await tx.customer.findFirst({
          where: { phone: trimmedPhone },
        });
      }

      if (!customer) {
        customer = await tx.customer.findFirst({
          where: { name: trimmedName },
        });
      }

      if (customer) {
        const updateData: any = {};
        if (trimmedName && customer.name !== trimmedName) updateData.name = trimmedName;
        if (trimmedPhone && !customer.phone) updateData.phone = trimmedPhone;
        if (customerAddress?.trim()) updateData.address = customerAddress.trim();
        if (customerZaloLink?.trim()) updateData.zaloLink = customerZaloLink.trim();
        if (customerFacebookLink?.trim()) updateData.facebookLink = customerFacebookLink.trim();

        if (Object.keys(updateData).length > 0) {
          customer = await tx.customer.update({
            where: { id: customer.id },
            data: updateData,
          });
        }
      } else {
        customer = await tx.customer.create({
          data: {
            name: trimmedName,
            phone: trimmedPhone,
            address: customerAddress?.trim() || null,
            zaloLink: customerZaloLink?.trim() || null,
            facebookLink: customerFacebookLink?.trim() || null,
          },
        });
      }

      // 3. Lấy phí kênh bán hàng từ Settings
      const channelFeePercent = await getChannelFeePercent(tx, channel);

      // 4. Xử lý từng dòng mặt hàng (OrderLine)
      const preparedLines = [];
      let sumLineTotals = 0;
      let totalCost = 0;

      for (const line of lines) {
        const lineQty = line.quantity;
        const unitPrice = line.unitPrice;
        const lineTotal = Math.round(lineQty * unitPrice);
        sumLineTotals += lineTotal;

        const isCustomLine = Boolean(line.isCustom || !line.productId);
        const materialsToCreate: { materialId: string; quantity: number; unitCost: number }[] = [];
        let snapshotCost = 0;

        if (!isCustomLine && line.productId) {
          // a. Mẫu sản phẩm có sẵn (Template)
          const product = await tx.product.findFirst({
            where: { id: line.productId, isDeleted: false },
            include: {
              materials: {
                include: {
                  material: true,
                },
              },
            },
          });

          if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND_${line.productId}`);
          }

          let materialCostPerUnit = 0;
          for (const pm of product.materials) {
            const mQty = Number(pm.quantity);
            const mAvgCost = Number(pm.material.avgCost) || 0;
            materialCostPerUnit += mQty * mAvgCost;

            materialsToCreate.push({
              materialId: pm.materialId,
              quantity: mQty,
              unitCost: mAvgCost,
            });
          }

          const overheadPercent = Number(product.overheadPercent) || 0;
          const laborCost = Number(product.laborCost) || 0;
          const overheadCost = Math.round((materialCostPerUnit * overheadPercent) / 100);

          snapshotCost = Math.round(materialCostPerUnit + laborCost + overheadCost);
        } else {
          // b. Đơn đặt riêng / Tùy biến (Custom)
          for (const m of line.materials) {
            const mat = await tx.material.findFirst({
              where: { id: m.materialId, isDeleted: false },
            });

            if (!mat) {
              throw new Error(`MATERIAL_NOT_FOUND_${m.materialId}`);
            }

            const mQty = Number(m.quantity);
            const mAvgCost = Number(mat.avgCost) || 0;

            materialsToCreate.push({
              materialId: mat.id,
              quantity: mQty,
              unitCost: mAvgCost,
            });
          }

          snapshotCost = Math.round(
            materialsToCreate.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
          );
        }

        totalCost += snapshotCost * lineQty;

        preparedLines.push({
          productId: isCustomLine ? null : line.productId || null,
          productName: line.productName,
          quantity: lineQty,
          unitPrice,
          lineTotal,
          snapshotCost,
          isCustom: isCustomLine,
          fromStock: Boolean(line.fromStock),
          materials: materialsToCreate,
        });
      }

      // 6 & 7. Tính tổng tiền đơn hàng và tổng giá vốn
      const totalAmount = Math.max(0, sumLineTotals + shippingFee - discount);

      // 5. Tạo Order với các dòng OrderLine và OrderLineMaterial
      // 8. KHÔNG trừ kho ở bước này (sẽ trừ khi chuyển trạng thái sang in_progress)
      const order = await tx.order.create({
        data: {
          code,
          orderDate,
          channel,
          customerId: customer?.id || null,
          customerName: trimmedName,
          customerPhone: trimmedPhone,
          status: 'new',
          deliveryType,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          shippingFee,
          discount,
          channelFeePercent,
          totalAmount,
          totalCost,
          paymentStatus,
          depositAmount,
          paymentMethod: paymentMethod || null,
          note: note || null,
          referenceImageUrl: referenceImageUrl || null,
          lines: {
            create: preparedLines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
              snapshotCost: l.snapshotCost,
              isCustom: l.isCustom,
              fromStock: l.fromStock,
              materials: {
                create: l.materials.map((m) => ({
                  materialId: m.materialId,
                  quantity: m.quantity,
                  unitCost: m.unitCost,
                })),
              },
            })),
          },
        },
        include: {
          customer: true,
          lines: {
            include: {
              materials: {
                include: {
                  material: {
                    select: {
                      id: true,
                      name: true,
                      baseUnit: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return order;
    });

    const formatted = formatOrder(result);

    return NextResponse.json(formatted, { status: 201 });
  } catch (error: any) {
    console.error('Lỗi khi tạo đơn hàng:', error);

    if (error?.message?.startsWith('PRODUCT_NOT_FOUND_')) {
      const pid = error.message.replace('PRODUCT_NOT_FOUND_', '');
      return NextResponse.json(
        { error: `Không tìm thấy mẫu sản phẩm với mã: ${pid}` },
        { status: 400 }
      );
    }

    if (error?.message?.startsWith('MATERIAL_NOT_FOUND_')) {
      const mid = error.message.replace('MATERIAL_NOT_FOUND_', '');
      return NextResponse.json(
        { error: `Không tìm thấy nguyên vật liệu với mã: ${mid}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Không thể tạo đơn hàng mới' },
      { status: 500 }
    );
  }
}
