import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { formatOrder } from '@/lib/order-calc';

const updateStatusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'completed', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Trạng thái đơn hàng không hợp lệ' }),
  }),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const validated = updateStatusSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Trạng thái không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newStatus = validated.data.status;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin đơn hàng cùng lines và materials
      const order = await tx.order.findFirst({
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
                  material: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const currentStatus = order.status;

      // Không thể thay đổi trạng thái của đơn hàng đã giao (delivered)
      if (currentStatus === 'delivered') {
        throw new Error('DELIVERED_IMMUTABLE');
      }

      // Không thể thay đổi trạng thái của đơn hàng đã hủy (cancelled)
      if (currentStatus === 'cancelled') {
        throw new Error('CANCELLED_IMMUTABLE');
      }

      if (currentStatus === newStatus) {
        throw new Error(`SAME_STATUS_${newStatus}`);
      }

      const warnings: string[] = [];

      // Kiểm tra các chuyển đổi trạng thái hợp lệ
      if (currentStatus === 'new' && (newStatus === 'in_progress' || newStatus === 'completed')) {
        // TRANSITION: new -> in_progress hoặc completed (Bán nhanh tại quầy): DEDUCT STOCK
        // 1. Phân loại: Dòng lấy từ hoa có sẵn (fromStock) vs Dòng làm mới từ nguyên liệu
        for (const line of order.lines) {
          if (line.fromStock && line.productId) {
            // Lấy từ kho hoa thành phẩm có sẵn tại tiệm
            const product = await tx.product.findUnique({
              where: { id: line.productId },
            });

            if (product) {
              if (product.stock < line.quantity) {
                warnings.push(
                  `Mẫu "${product.name}" không đủ hoa có sẵn tại tiệm (còn ${product.stock} bó, đơn cần ${line.quantity} bó)`
                );
              }

              // Trừ tồn kho thành phẩm
              await tx.product.update({
                where: { id: line.productId },
                data: {
                  stock: {
                    decrement: line.quantity,
                  },
                },
              });

              // Ghi biến động kho thành phẩm
              await tx.productMovement.create({
                data: {
                  productId: line.productId,
                  type: 'sell',
                  quantity: -line.quantity,
                  unitCost: line.snapshotCost,
                  refType: 'order',
                  refId: order.id,
                  note: `Bán hoa có sẵn cho đơn ${order.code}`,
                },
              });
            }
          } else {
            // Làm mới theo công thức: Trừ kho nguyên vật liệu
            for (const olm of line.materials) {
              const deductQty = Number(olm.quantity) * line.quantity;
              if (deductQty > 0) {
                const mat = await tx.material.findUnique({
                  where: { id: olm.materialId },
                });

                if (mat && Number(mat.currentStock) < deductQty) {
                  warnings.push(
                    `Vật tư "${mat.name}" không đủ tồn kho (còn ${mat.currentStock} ${mat.baseUnit}, cần ${deductQty} ${mat.baseUnit})`
                  );
                }

                await tx.stockMovement.create({
                  data: {
                    materialId: olm.materialId,
                    type: 'order_out',
                    quantity: -deductQty,
                    unitCost: olm.unitCost,
                    refType: 'order',
                    refId: order.id,
                    note: `Xuất cho đơn ${order.code}`,
                  },
                });

                await tx.material.update({
                  where: { id: olm.materialId },
                  data: {
                    currentStock: {
                      decrement: deductQty,
                    },
                  },
                });
              }
            }
          }
        }
      } else if (currentStatus === 'in_progress' && newStatus === 'completed') {
        // TRANSITION: in_progress -> completed: Không biến động kho
      } else if (currentStatus === 'completed' && newStatus === 'delivered') {
        // TRANSITION: completed -> delivered: Không biến động kho
      } else if (newStatus === 'cancelled') {
        // TRANSITION: any (except delivered) -> cancelled: RETURN STOCK
        for (const line of order.lines) {
          if (line.fromStock && line.productId) {
            // Hoàn lại kho hoa thành phẩm
            await tx.product.update({
              where: { id: line.productId },
              data: {
                stock: {
                  increment: line.quantity,
                },
              },
            });

            await tx.productMovement.create({
              data: {
                productId: line.productId,
                type: 'return',
                quantity: line.quantity,
                unitCost: line.snapshotCost,
                refType: 'order',
                refId: order.id,
                note: `Hoàn kho thành phẩm do hủy đơn ${order.code}`,
              },
            });

            // Xóa biến động sell của đơn hàng này
            await tx.productMovement.deleteMany({
              where: {
                refType: 'order',
                refId: order.id,
                type: 'sell',
              },
            });
          } else {
            // Hoàn lại kho nguyên vật liệu
            for (const olm of line.materials) {
              const returnQty = Number(olm.quantity) * line.quantity;
              if (returnQty > 0) {
                await tx.stockMovement.create({
                  data: {
                    materialId: olm.materialId,
                    type: 'order_return',
                    quantity: returnQty,
                    unitCost: olm.unitCost,
                    refType: 'order',
                    refId: order.id,
                    note: `Hoàn kho do hủy đơn ${order.code}`,
                  },
                });

                await tx.material.update({
                  where: { id: olm.materialId },
                  data: {
                    currentStock: {
                      increment: returnQty,
                    },
                  },
                });
              }
            }

            // Xóa các biến động order_out gốc của đơn hàng này
            await tx.stockMovement.deleteMany({
              where: {
                refType: 'order',
                refId: order.id,
                type: 'order_out',
              },
            });
          }
        }
      } else {
        throw new Error(`INVALID_TRANSITION_${currentStatus}_TO_${newStatus}`);
      }

      // Cập nhật trạng thái đơn hàng
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
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

      return {
        order: updatedOrder,
        warnings,
      };
    });

    const formatted = formatOrder(result.order);

    return NextResponse.json({
      ...formatted,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error('Lỗi khi cập nhật trạng thái đơn hàng:', error);

    if (error?.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng hoặc đơn đã bị xóa' },
        { status: 404 }
      );
    }

    if (error?.message === 'DELIVERED_IMMUTABLE') {
      return NextResponse.json(
        { error: 'Không thể thay đổi trạng thái của đơn hàng đã giao' },
        { status: 400 }
      );
    }

    if (error?.message === 'CANCELLED_IMMUTABLE') {
      return NextResponse.json(
        { error: 'Không thể thay đổi trạng thái của đơn hàng đã hủy' },
        { status: 400 }
      );
    }

    if (error?.message?.startsWith('SAME_STATUS_')) {
      const s = error.message.replace('SAME_STATUS_', '');
      return NextResponse.json(
        { error: `Đơn hàng hiện tại đã ở trạng thái "${s}"` },
        { status: 400 }
      );
    }

    if (error?.message?.startsWith('INVALID_TRANSITION_')) {
      return NextResponse.json(
        { error: 'Chuyển đổi trạng thái đơn hàng không hợp lệ' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Không thể cập nhật trạng thái đơn hàng' },
      { status: 500 }
    );
  }
}
