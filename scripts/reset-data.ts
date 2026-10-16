import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Đang bắt đầu làm sạch dữ liệu kiểm thử trên Neon DB...');

  // 1. Xóa chi tiết đơn hàng & đơn hàng
  const deletedOrderLineMaterials = await prisma.orderLineMaterial.deleteMany({});
  console.log(`- Đã xóa ${deletedOrderLineMaterials.count} vật tư trong dòng đơn (orderLineMaterial)`);

  const deletedOrderLines = await prisma.orderLine.deleteMany({});
  console.log(`- Đã xóa ${deletedOrderLines.count} dòng đơn hàng (orderLine)`);

  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`- Đã xóa ${deletedOrders.count} đơn hàng (order)`);

  // 2. Xóa khách hàng mẫu
  const deletedCustomers = await prisma.customer.deleteMany({});
  console.log(`- Đã xóa ${deletedCustomers.count} khách hàng mẫu (customer)`);

  // 3. Xóa biến động thành phẩm & công thức sản phẩm
  const deletedProductMovements = await prisma.productMovement.deleteMany({});
  console.log(`- Đã xóa ${deletedProductMovements.count} biến động kho thành phẩm (productMovement)`);

  const deletedProductMaterials = await prisma.productMaterial.deleteMany({});
  console.log(`- Đã xóa ${deletedProductMaterials.count} vật tư công thức (productMaterial)`);

  const deletedProducts = await prisma.product.deleteMany({});
  console.log(`- Đã xóa ${deletedProducts.count} mẫu sản phẩm (product)`);

  // 4. Xóa phiếu nhập & biến động kho nguyên liệu
  const deletedPurchaseLines = await prisma.purchaseLine.deleteMany({});
  console.log(`- Đã xóa ${deletedPurchaseLines.count} dòng phiếu nhập (purchaseLine)`);

  const deletedPurchases = await prisma.purchase.deleteMany({});
  console.log(`- Đã xóa ${deletedPurchases.count} phiếu nhập hàng (purchase)`);

  const deletedSuppliers = await prisma.supplier.deleteMany({});
  console.log(`- Đã xóa ${deletedSuppliers.count} nhà cung cấp mẫu (supplier)`);

  const deletedStockMovements = await prisma.stockMovement.deleteMany({});
  console.log(`- Đã xóa ${deletedStockMovements.count} lịch sử xuất nhập kho nguyên liệu (stockMovement)`);

  // 5. Xóa nguyên liệu mẫu
  const deletedMaterials = await prisma.material.deleteMany({});
  console.log(`- Đã xóa ${deletedMaterials.count} nguyên liệu mẫu (material)`);

  // 6. Kiểm tra các dữ liệu giữ lại
  const userCount = await prisma.user.count();
  const settingCount = await prisma.setting.count();

  console.log('\n✅ DỮ LIỆU ĐÃ ĐƯỢC RESET TRẮNG HOÀN TOÀN!');
  console.log(`🔒 Giữ lại an toàn:`);
  console.log(`   - Tài khoản đăng nhập (Users): ${userCount} tài khoản (anh@dotafloral.com, chi@dotafloral.com)`);
  console.log(`   - Cài đặt hệ thống (Settings): ${settingCount} cấu hình mặc định (phí sàn, biên lợi nhuận, tên tiệm...)`);
  console.log('\n🌸 Bạn có thể bắt đầu nhập nguyên liệu, sản phẩm và đơn hàng thật ngay bây giờ!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
