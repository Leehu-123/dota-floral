import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌸 Seeding Dota Floral database...');

  // 1. Users
  const passwordHash = await hash('dotafloral2024', 12);
  
  const user1 = await prisma.user.upsert({
    where: { email: 'anh@dotafloral.com' },
    update: {},
    create: {
      email: 'anh@dotafloral.com',
      name: 'Anh',
      passwordHash,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'chi@dotafloral.com' },
    update: {},
    create: {
      email: 'chi@dotafloral.com',
      name: 'Chị',
      passwordHash,
    },
  });

  console.log('✅ Users created:', user1.email, user2.email);

  // 2. Settings
  const settings = [
    { key: 'shop_name', value: 'Dota Floral', description: 'Tên tiệm' },
    { key: 'shop_address', value: 'TT. Bắc Hà, Lào Cai', description: 'Địa chỉ' },
    { key: 'default_margin', value: '40', description: 'Biên lợi nhuận mặc định (%)' },
    { key: 'price_rounding_step', value: '5000', description: 'Bước làm tròn giá (VND)' },
    { key: 'labor_rate_per_hour', value: '30000', description: 'Đơn giá công/giờ (VND)' },
    { key: 'default_overhead_percent', value: '10', description: 'Chi phí chung mặc định (%)' },
    { key: 'fee_shopee', value: '8', description: 'Phí sàn Shopee (%)' },
    { key: 'fee_tiktok', value: '5', description: 'Phí sàn TikTok (%)' },
    { key: 'fee_zalo', value: '0', description: 'Phí kênh Zalo (%)' },
    { key: 'fee_facebook', value: '0', description: 'Phí kênh Facebook (%)' },
    { key: 'fee_tai_tiem', value: '0', description: 'Phí tại tiệm (%)' },
    { key: 'margin_alert_threshold', value: '20', description: 'Ngưỡng cảnh báo biên LN thấp (%)' },
    { key: 'bank_id', value: 'MB', description: 'Mã ngân hàng (VietQR: MB, VCB, TCB, VPB, ACB...)' },
    { key: 'bank_account_no', value: '0987654321', description: 'Số tài khoản ngân hàng' },
    { key: 'bank_account_name', value: 'DOTA FLORAL', description: 'Tên chủ tài khoản' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('✅ Settings created');

  // 3. Materials
  const materials = [
    { name: 'Hoa sáp hồng đỏ', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: 50, minStock: 20, note: 'Loại cao cấp' },
    { name: 'Hoa sáp hồng phấn', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: 50, minStock: 20 },
    { name: 'Hoa sáp trắng', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: 50, minStock: 15 },
    { name: 'Hoa sáp vàng', group: 'hoa_sap', baseUnit: 'bông', purchaseUnit: 'túi', conversionFactor: 50, minStock: 10 },
    { name: 'Hoa lụa hồng pastel', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: 20, minStock: 15 },
    { name: 'Hoa lụa trắng', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: 20, minStock: 10 },
    { name: 'Hoa lụa lavender', group: 'hoa_lua', baseUnit: 'cành', purchaseUnit: 'bó', conversionFactor: 20, minStock: 10 },
    { name: 'Cốt hoa tròn', group: 'cot_hoa', baseUnit: 'cái', purchaseUnit: 'cái', conversionFactor: 1, minStock: 10 },
    { name: 'Cốt hoa dài', group: 'cot_hoa', baseUnit: 'cái', purchaseUnit: 'cái', conversionFactor: 1, minStock: 10 },
    { name: 'Giấy bọc trắng', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: 20, minStock: 10 },
    { name: 'Giấy bọc hồng', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: 20, minStock: 10 },
    { name: 'Giấy bọc kraft', group: 'bao_bi', baseUnit: 'tờ', purchaseUnit: 'bó', conversionFactor: 20, minStock: 8 },
    { name: 'Nơ satin hồng', group: 'phu_kien', baseUnit: 'cái', purchaseUnit: 'gói', conversionFactor: 50, minStock: 20 },
    { name: 'Băng dính hoa', group: 'vat_tu_khac', baseUnit: 'm', purchaseUnit: 'cuộn', conversionFactor: 25, minStock: 10 },
    { name: 'Keo nến', group: 'vat_tu_khac', baseUnit: 'thanh', purchaseUnit: 'gói', conversionFactor: 20, minStock: 10 },
  ];

  const createdMaterials: Record<string, string> = {};
  for (const m of materials) {
    const created = await prisma.material.create({ data: m });
    createdMaterials[m.name] = created.id;
  }
  console.log('✅ Materials created:', Object.keys(createdMaterials).length);

  // 4. Suppliers
  const sup1 = await prisma.supplier.create({ data: { name: 'Shop Hoa Sáp HN', phone: '0912345678', note: 'Nhập sỉ hoa sáp từ Hà Nội' } });
  const sup2 = await prisma.supplier.create({ data: { name: 'Chợ Đồng Xuân', phone: '0987654321', note: 'Phụ kiện, bao bì' } });
  console.log('✅ Suppliers created');

  // 5. Purchases (2 phiếu nhập mẫu)
  // Purchase 1: Nhập hoa sáp
  const p1Lines = [
    { materialName: 'Hoa sáp hồng đỏ', qty: 2, unitPrice: 750000 },
    { materialName: 'Hoa sáp hồng phấn', qty: 2, unitPrice: 750000 },
    { materialName: 'Hoa sáp trắng', qty: 1, unitPrice: 700000 },
  ];
  
  const purchase1 = await prisma.purchase.create({
    data: {
      date: new Date('2024-10-01'),
      supplierId: sup1.id,
      supplierName: 'Shop Hoa Sáp HN',
      shippingCost: 80000,
      totalAmount: 3280000,
      note: 'Nhập đợt tháng 10',
      lines: {
        create: p1Lines.map(l => ({
          materialId: createdMaterials[l.materialName],
          quantity: l.qty,
          unitPrice: l.unitPrice,
          lineTotal: l.qty * l.unitPrice,
          convertedQty: l.qty * 50,
        })),
      },
    },
  });

  // Stock movements for purchase 1
  for (const l of p1Lines) {
    const convertedQty = l.qty * 50;
    const costPerUnit = (l.qty * l.unitPrice) / convertedQty;
    await prisma.stockMovement.create({
      data: {
        materialId: createdMaterials[l.materialName],
        type: 'purchase_in',
        quantity: convertedQty,
        unitCost: costPerUnit,
        refType: 'purchase',
        refId: purchase1.id,
      },
    });
    await prisma.material.update({
      where: { id: createdMaterials[l.materialName] },
      data: {
        currentStock: convertedQty,
        avgCost: costPerUnit,
      },
    });
  }

  // Purchase 2: Nhập phụ kiện
  const p2Lines = [
    { materialName: 'Giấy bọc trắng', qty: 2, unitPrice: 100000, factor: 20 },
    { materialName: 'Giấy bọc hồng', qty: 2, unitPrice: 120000, factor: 20 },
    { materialName: 'Nơ satin hồng', qty: 2, unitPrice: 75000, factor: 50 },
    { materialName: 'Băng dính hoa', qty: 4, unitPrice: 25000, factor: 25 },
    { materialName: 'Keo nến', qty: 2, unitPrice: 30000, factor: 20 },
    { materialName: 'Cốt hoa tròn', qty: 20, unitPrice: 15000, factor: 1 },
    { materialName: 'Cốt hoa dài', qty: 15, unitPrice: 18000, factor: 1 },
  ];

  const purchase2 = await prisma.purchase.create({
    data: {
      date: new Date('2024-10-03'),
      supplierId: sup2.id,
      supplierName: 'Chợ Đồng Xuân',
      shippingCost: 50000,
      totalAmount: 1010000,
      note: 'Nhập phụ kiện + bao bì',
      lines: {
        create: p2Lines.map(l => ({
          materialId: createdMaterials[l.materialName],
          quantity: l.qty,
          unitPrice: l.unitPrice,
          lineTotal: l.qty * l.unitPrice,
          convertedQty: l.qty * l.factor,
        })),
      },
    },
  });

  for (const l of p2Lines) {
    const convertedQty = l.qty * l.factor;
    const costPerUnit = (l.qty * l.unitPrice) / convertedQty;
    await prisma.stockMovement.create({
      data: {
        materialId: createdMaterials[l.materialName],
        type: 'purchase_in',
        quantity: convertedQty,
        unitCost: costPerUnit,
        refType: 'purchase',
        refId: purchase2.id,
      },
    });
    await prisma.material.update({
      where: { id: createdMaterials[l.materialName] },
      data: {
        currentStock: convertedQty,
        avgCost: costPerUnit,
      },
    });
  }
  console.log('✅ Purchases & stock movements created');

  // 6. Hoa lụa - nhập riêng
  const luaLines = [
    { materialName: 'Hoa lụa hồng pastel', qty: 3, unitPrice: 200000, factor: 20 },
    { materialName: 'Hoa lụa trắng', qty: 2, unitPrice: 180000, factor: 20 },
    { materialName: 'Hoa lụa lavender', qty: 2, unitPrice: 190000, factor: 20 },
  ];
  for (const l of luaLines) {
    const convertedQty = l.qty * l.factor;
    const costPerUnit = (l.qty * l.unitPrice) / convertedQty;
    await prisma.stockMovement.create({
      data: {
        materialId: createdMaterials[l.materialName],
        type: 'purchase_in',
        quantity: convertedQty,
        unitCost: costPerUnit,
        refType: 'purchase',
        refId: purchase1.id,
      },
    });
    await prisma.material.update({
      where: { id: createdMaterials[l.materialName] },
      data: {
        currentStock: convertedQty,
        avgCost: costPerUnit,
      },
    });
  }

  // 7. Products (3 mẫu)
  const product1 = await prisma.product.create({
    data: {
      name: 'Bó hồng sáp cổ điển',
      type: 'template',
      description: 'Bó 10 bông hoa sáp hồng đỏ, giấy trắng, nơ satin',
      laborCost: 30000,
      overheadPercent: 10,
      targetMargin: 45,
      suggestedPrice: 350000,
      materials: {
        create: [
          { materialId: createdMaterials['Hoa sáp hồng đỏ'], quantity: 10 },
          { materialId: createdMaterials['Cốt hoa tròn'], quantity: 1 },
          { materialId: createdMaterials['Giấy bọc trắng'], quantity: 2 },
          { materialId: createdMaterials['Nơ satin hồng'], quantity: 1 },
          { materialId: createdMaterials['Băng dính hoa'], quantity: 1.5 },
          { materialId: createdMaterials['Keo nến'], quantity: 2 },
        ],
      },
    },
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Bó lụa pastel',
      type: 'template',
      description: 'Bó hoa lụa pastel mix, giấy kraft, phong cách Hàn',
      laborCost: 25000,
      overheadPercent: 10,
      targetMargin: 50,
      suggestedPrice: 250000,
      materials: {
        create: [
          { materialId: createdMaterials['Hoa lụa hồng pastel'], quantity: 5 },
          { materialId: createdMaterials['Hoa lụa trắng'], quantity: 3 },
          { materialId: createdMaterials['Cốt hoa dài'], quantity: 1 },
          { materialId: createdMaterials['Giấy bọc kraft'], quantity: 2 },
          { materialId: createdMaterials['Băng dính hoa'], quantity: 1 },
        ],
      },
    },
  });

  const product3 = await prisma.product.create({
    data: {
      name: 'Giỏ mix sáp-lụa',
      type: 'template',
      description: 'Giỏ hoa mix sáp và lụa, phong cách sang trọng',
      laborCost: 40000,
      overheadPercent: 10,
      targetMargin: 45,
      suggestedPrice: 450000,
      materials: {
        create: [
          { materialId: createdMaterials['Hoa sáp hồng phấn'], quantity: 5 },
          { materialId: createdMaterials['Hoa sáp trắng'], quantity: 3 },
          { materialId: createdMaterials['Hoa lụa lavender'], quantity: 4 },
          { materialId: createdMaterials['Cốt hoa tròn'], quantity: 1 },
          { materialId: createdMaterials['Giấy bọc hồng'], quantity: 2 },
          { materialId: createdMaterials['Nơ satin hồng'], quantity: 2 },
          { materialId: createdMaterials['Keo nến'], quantity: 3 },
          { materialId: createdMaterials['Băng dính hoa'], quantity: 2 },
        ],
      },
    },
  });
  console.log('✅ Products created:', product1.name, product2.name, product3.name);

  // 8. Customers
  const cust1 = await prisma.customer.create({ data: { name: 'Chị Mai', phone: '0901234567', address: 'Số 5, TT Bắc Hà', note: 'Khách quen, hay mua hoa sáp' } });
  const cust2 = await prisma.customer.create({ data: { name: 'Anh Tú', phone: '0912345678', facebookLink: 'fb.com/tu.nguyen', note: 'Hay đặt qua Facebook' } });
  const cust3 = await prisma.customer.create({ data: { name: 'Chị Hương', phone: '0923456789', zaloLink: 'zalo.me/0923456789' } });
  const cust4 = await prisma.customer.create({ data: { name: 'Anh Đức', phone: '0934567890' } });
  console.log('✅ Customers created');

  // 9. Orders (5 đơn mẫu)
  // Order 1: Hoàn thành, đã thanh toán
  await prisma.order.create({
    data: {
      code: 'DF-241010-001',
      orderDate: new Date('2024-10-10'),
      channel: 'zalo',
      customerId: cust1.id,
      customerName: 'Chị Mai',
      customerPhone: '0901234567',
      status: 'delivered',
      deliveryType: 'ship',
      deliveryDate: new Date('2024-10-10T14:00:00'),
      shippingFee: 30000,
      discount: 0,
      totalAmount: 380000,
      totalCost: 195000,
      paymentStatus: 'paid',
      depositAmount: 380000,
      paymentMethod: 'transfer',
      note: 'Giao trước 14h',
      lines: {
        create: [{
          productId: product1.id,
          productName: 'Bó hồng sáp cổ điển',
          quantity: 1,
          unitPrice: 350000,
          lineTotal: 350000,
          snapshotCost: 195000,
          isCustom: false,
        }],
      },
    },
  });

  // Order 2: Đang làm, đã cọc
  await prisma.order.create({
    data: {
      code: 'DF-241012-001',
      orderDate: new Date('2024-10-12'),
      channel: 'facebook',
      customerId: cust2.id,
      customerName: 'Anh Tú',
      customerPhone: '0912345678',
      status: 'in_progress',
      deliveryType: 'pickup',
      deliveryDate: new Date('2024-10-14T10:00:00'),
      shippingFee: 0,
      discount: 0,
      totalAmount: 500000,
      totalCost: 260000,
      paymentStatus: 'deposited',
      depositAmount: 200000,
      paymentMethod: 'cash',
      note: 'Sinh nhật bạn gái',
      lines: {
        create: [{
          productId: product3.id,
          productName: 'Giỏ mix sáp-lụa',
          quantity: 1,
          unitPrice: 500000,
          lineTotal: 500000,
          snapshotCost: 260000,
          isCustom: false,
        }],
      },
    },
  });

  // Order 3: Mới tạo
  await prisma.order.create({
    data: {
      code: 'DF-241014-001',
      orderDate: new Date('2024-10-14'),
      channel: 'zalo',
      customerId: cust3.id,
      customerName: 'Chị Hương',
      customerPhone: '0923456789',
      status: 'new',
      deliveryType: 'ship',
      deliveryDate: new Date('2024-10-15T09:00:00'),
      shippingFee: 25000,
      discount: 10000,
      totalAmount: 265000,
      totalCost: 130000,
      paymentStatus: 'unpaid',
      depositAmount: 0,
      paymentMethod: null,
      note: 'Tặng mẹ',
      lines: {
        create: [{
          productId: product2.id,
          productName: 'Bó lụa pastel',
          quantity: 1,
          unitPrice: 250000,
          lineTotal: 250000,
          snapshotCost: 130000,
          isCustom: false,
        }],
      },
    },
  });

  // Order 4: Đơn custom, hoàn thành
  await prisma.order.create({
    data: {
      code: 'DF-241011-001',
      orderDate: new Date('2024-10-11'),
      channel: 'tai_tiem',
      customerId: cust4.id,
      customerName: 'Anh Đức',
      customerPhone: '0934567890',
      status: 'completed',
      deliveryType: 'pickup',
      deliveryDate: new Date('2024-10-11T16:00:00'),
      shippingFee: 0,
      discount: 0,
      totalAmount: 280000,
      totalCost: 150000,
      paymentStatus: 'paid',
      depositAmount: 280000,
      paymentMethod: 'cash',
      note: 'Bó custom theo yêu cầu',
      lines: {
        create: [{
          productName: 'Bó custom hồng sáp + lụa',
          quantity: 1,
          unitPrice: 280000,
          lineTotal: 280000,
          snapshotCost: 150000,
          isCustom: true,
        }],
      },
    },
  });

  // Order 5: Đã hủy
  await prisma.order.create({
    data: {
      code: 'DF-241013-001',
      orderDate: new Date('2024-10-13'),
      channel: 'facebook',
      customerName: 'Khách lẻ',
      status: 'cancelled',
      deliveryType: 'ship',
      shippingFee: 30000,
      discount: 0,
      totalAmount: 380000,
      totalCost: 195000,
      paymentStatus: 'unpaid',
      note: 'Khách hủy do đổi ý',
      lines: {
        create: [{
          productId: product1.id,
          productName: 'Bó hồng sáp cổ điển',
          quantity: 1,
          unitPrice: 350000,
          lineTotal: 350000,
          snapshotCost: 195000,
          isCustom: false,
        }],
      },
    },
  });
  console.log('✅ Orders created');

  console.log('\n🌸 Seed completed!');
  console.log('\n📧 Đăng nhập:');
  console.log('   Email: anh@dotafloral.com');
  console.log('   Email: chi@dotafloral.com');
  console.log('   Mật khẩu: dotafloral2024');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
