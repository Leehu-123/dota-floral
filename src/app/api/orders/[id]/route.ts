import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { formatOrder } from '@/lib/order-calc';

const updateOrderSchema = z.object({
  note: z.string().trim().optional().nullable(),
  deliveryType: z.enum(['pickup', 'ship']).optional(),
  deliveryDate: z.string().or(z.date()).optional().nullable(),
  shippingFee: z.coerce.number().min(0, 'Phí ship không được âm').optional(),
  discount: z.coerce.number().min(0, 'Giảm giá không được âm').optional(),
  paymentStatus: z.enum(['unpaid', 'deposited', 'paid']).optional(),
  depositAmount: z.coerce.number().min(0, 'Tiền đặt cọc không được âm').optional(),
  paymentMethod: z.string().trim().optional().nullable(),
  referenceImageUrl: z.string().trim().optional().nullable(),
  finishedImageUrl: z.string().trim().optional().nullable(),
  customerName: z.string().trim().min(1).optional(),
  customerPhone: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().optional().nullable(),
        productName: z.string().trim().min(1, 'Tên mặt hàng là bắt buộc'),
        quantity: z.coerce.number().int().min(1, 'Số lượng tối thiểu là 1').default(1),
        unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm'),
        isCustom: z.boolean().optional().default(false),
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
    .optional(),
});

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
        lines: {
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
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng' },
        { status: 404 }
      );
    }

    const formatted = formatOrder(order);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin đơn hàng' },
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
    const validated = updateOrderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu cập nhật không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    const updated = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: {
          lines: {
            include: {
              materials: true,
            },
          },
        },
      });

      if (!existingOrder) {
        throw new Error('ORDER_NOT_FOUND');
      }

      // Kiểm tra: Không được sửa lines khi trạng thái khác 'new'
      if (data.lines !== undefined && existingOrder.status !== 'new') {
        throw new Error('CANNOT_EDIT_LINES_NON_NEW');
      }

      let sumLineTotals = 0;
      let totalCost = Number(existingOrder.totalCost);

      if (data.lines !== undefined) {
        // Xóa các dòng OrderLine cũ
        await tx.orderLine.deleteMany({
          where: { orderId: id },
        });

        // Xử lý và tạo mới các dòng OrderLine
        const preparedLines = [];
        let newTotalCost = 0;

        for (const line of data.lines) {
          const lineQty = line.quantity;
          const unitPrice = line.unitPrice;
          const lineTotal = Math.round(lineQty * unitPrice);
          sumLineTotals += lineTotal;

          const isCustomLine = Boolean(line.isCustom || !line.productId);
          const materialsToCreate: { materialId: string; quantity: number; unitCost: number }[] = [];
          let snapshotCost = 0;

          if (!isCustomLine && line.productId) {
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

          newTotalCost += snapshotCost * lineQty;

          preparedLines.push({
            productId: isCustomLine ? null : line.productId || null,
            productName: line.productName,
            quantity: lineQty,
            unitPrice,
            lineTotal,
            snapshotCost,
            isCustom: isCustomLine,
            materials: materialsToCreate,
          });
        }

        totalCost = newTotalCost;

        // Tạo các dòng mới
        for (const pl of preparedLines) {
          await tx.orderLine.create({
            data: {
              orderId: id,
              productId: pl.productId,
              productName: pl.productName,
              quantity: pl.quantity,
              unitPrice: pl.unitPrice,
              lineTotal: pl.lineTotal,
              snapshotCost: pl.snapshotCost,
              isCustom: pl.isCustom,
              materials: {
                create: pl.materials.map((m) => ({
                  materialId: m.materialId,
                  quantity: m.quantity,
                  unitCost: m.unitCost,
                })),
              },
            },
          });
        }
      } else {
        sumLineTotals = existingOrder.lines.reduce(
          (sum, l) => sum + Number(l.lineTotal),
          0
        );
      }

      // Tính lại totalAmount khi shippingFee, discount hoặc lines thay đổi
      const effectiveShippingFee =
        data.shippingFee !== undefined ? data.shippingFee : Number(existingOrder.shippingFee);
      const effectiveDiscount =
        data.discount !== undefined ? data.discount : Number(existingOrder.discount);
      const newTotalAmount = Math.max(0, sumLineTotals + effectiveShippingFee - effectiveDiscount);

      const updateData: any = {
        totalAmount: newTotalAmount,
        totalCost,
      };

      if (data.note !== undefined) updateData.note = data.note;
      if (data.deliveryType !== undefined) updateData.deliveryType = data.deliveryType;
      if (data.deliveryDate !== undefined) {
        updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
      }
      if (data.shippingFee !== undefined) updateData.shippingFee = data.shippingFee;
      if (data.discount !== undefined) updateData.discount = data.discount;
      if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
      if (data.depositAmount !== undefined) updateData.depositAmount = data.depositAmount;
      if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
      if (data.referenceImageUrl !== undefined) updateData.referenceImageUrl = data.referenceImageUrl;
      if (data.finishedImageUrl !== undefined) updateData.finishedImageUrl = data.finishedImageUrl;
      if (data.customerName !== undefined) updateData.customerName = data.customerName;
      if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;

      return tx.order.update({
        where: { id },
        data: updateData,
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
    });

    const formatted = formatOrder(updated);

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Lỗi khi cập nhật đơn hàng:', error);

    if (error?.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng hoặc đơn đã bị xóa' },
        { status: 404 }
      );
    }

    if (error?.message === 'CANNOT_EDIT_LINES_NON_NEW') {
      return NextResponse.json(
        { error: 'Không thể chỉnh sửa danh sách mặt hàng khi đơn đã bắt đầu xử lý' },
        { status: 400 }
      );
    }

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
      { error: 'Không thể cập nhật đơn hàng' },
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

    const existingOrder = await prisma.order.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng' },
        { status: 404 }
      );
    }

    // Chỉ cho phép xóa mềm khi đơn ở trạng thái 'new' hoặc 'cancelled'
    if (existingOrder.status !== 'new' && existingOrder.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Chỉ có thể xóa đơn hàng ở trạng thái Mới hoặc Đã hủy' },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: 'Đã xóa đơn hàng thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xóa đơn hàng:', error);
    return NextResponse.json(
      { error: 'Không thể xóa đơn hàng' },
      { status: 500 }
    );
  }
}
