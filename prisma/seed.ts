import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import seedData from './seed-data.json'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // ── 1. Branches ────────────────────────────────────────────────────────────
  const branchMap: Record<string, string> = {}
  for (const b of seedData.static_seed.branches) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code as any },
      update: { name: b.name },
      create: { code: b.code as any, name: b.name },
    })
    branchMap[b.code] = branch.id
  }
  console.log(`✅ Branches: ${Object.keys(branchMap).join(', ')}`)

  // ── 2. Supplier ────────────────────────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { code: seedData.static_seed.supplier.code },
    update: { name: seedData.static_seed.supplier.name },
    create: { code: seedData.static_seed.supplier.code, name: seedData.static_seed.supplier.name },
  })
  console.log(`✅ Supplier: ${supplier.name}`)

  // ── 3. HMT Quotas (March 2026) ────────────────────────────────────────────
  const hmtQuota = seedData.static_seed.hmt_quota_march_2026 as Record<string, Record<string, { quotaQty: number }>>
  for (const [branchCode, sizes] of Object.entries(hmtQuota)) {
    for (const [size, data] of Object.entries(sizes)) {
      await prisma.supplierHmtQuota.upsert({
        where: {
          supplierId_branchId_cylinderSize_periodMonth_periodYear: {
            supplierId: supplier.id,
            branchId: branchMap[branchCode],
            cylinderSize: size as any,
            periodMonth: 3,
            periodYear: 2026,
          },
        },
        update: { quotaQty: data.quotaQty },
        create: {
          supplierId: supplier.id,
          branchId: branchMap[branchCode],
          cylinderSize: size as any,
          periodMonth: 3,
          periodYear: 2026,
          quotaQty: data.quotaQty,
          pricePerUnit: 0,
        },
      })
    }
  }
  console.log('✅ HMT Quotas seeded')

  // ── 4. Customers ───────────────────────────────────────────────────────────
  // Build lookup: branchCode -> { no -> customerId }
  const customerIdMap: Record<string, Record<number, string>> = { SBY: {}, YOG: {} }

  for (const branchCode of ['SBY', 'YOG'] as const) {
    const customers = seedData.gasback_opening[branchCode].customers
    let count = 0
    for (const c of customers) {
      const code = `${branchCode}-${String(c.no).padStart(4, '0')}`
      const customer = await prisma.customer.upsert({
        where: { code },
        update: { name: c.name },
        create: {
          branchId: branchMap[branchCode],
          code,
          name: c.name,
          customerType: 'RETAIL',
        },
      })
      customerIdMap[branchCode][c.no] = customer.id
      count++
    }
    console.log(`✅ Customers ${branchCode}: ${count}`)
  }

  // ── 5. GasbackLedger — opening ADJUSTMENT entries ─────────────────────────
  const openingDate = new Date('2026-03-02T00:00:00.000Z')
  let gasbackCount = 0
  for (const branchCode of ['SBY', 'YOG'] as const) {
    const customers = seedData.gasback_opening[branchCode].customers
    for (const c of customers) {
      const balance = (c as any).gasback_opening_balance
      if (!balance || balance <= 0) continue
      const customerId = customerIdMap[branchCode][c.no]
      if (!customerId) continue

      // only create if not already seeded
      const existing = await prisma.gasbackLedger.findFirst({
        where: { customerId, txType: 'ADJUSTMENT', txDate: openingDate },
      })
      if (!existing) {
        await prisma.gasbackLedger.create({
          data: {
            branchId: branchMap[branchCode],
            customerId,
            txType: 'ADJUSTMENT',
            qty: balance,
            amount: 0,
            txDate: openingDate,
            notes: 'Opening balance March 2026',
          },
        })
        gasbackCount++
      }
    }
  }
  console.log(`✅ GasbackLedger opening entries: ${gasbackCount}`)

  // ── 6. CustomerCylinderHolding — opening holdings ─────────────────────────
  let holdingCount = 0
  for (const branchCode of ['SBY', 'YOG'] as const) {
    const holdings = seedData.stock_tabung_opening[branchCode].customer_holdings
    for (const h of holdings) {
      if (h.held_kg12 === 0 && h.held_kg50 === 0) continue
      const customerId = customerIdMap[branchCode][h.no]
      if (!customerId) continue

      await prisma.customerCylinderHolding.upsert({
        where: { customerId_date: { customerId, date: openingDate } },
        update: { kg12HeldQty: h.held_kg12, kg50HeldQty: h.held_kg50 },
        create: {
          branchId: branchMap[branchCode],
          customerId,
          date: openingDate,
          kg12HeldQty: h.held_kg12,
          kg50HeldQty: h.held_kg50,
        },
      })
      holdingCount++
    }
  }
  console.log(`✅ CustomerCylinderHolding opening entries: ${holdingCount}`)

  // ── 7. WarehouseStock — opening snapshot ──────────────────────────────────
  for (const branchCode of ['SBY', 'YOG'] as const) {
    const stock = seedData.stock_tabung_opening[branchCode]
    await prisma.warehouseStock.upsert({
      where: { branchId_date: { branchId: branchMap[branchCode], date: openingDate } },
      update: {},
      create: {
        branchId: branchMap[branchCode],
        date: openingDate,
        kg12HmtQty: stock.hmt.KG12,
        kg50HmtQty: stock.hmt.KG50,
        kg12KuotaWo: stock.kuota_wo.KG12,
        kg50KuotaWo: stock.kuota_wo.KG50,
      },
    })
  }
  console.log('✅ WarehouseStock opening snapshot seeded')

  // ── 8. Employees ──────────────────────────────────────────────────────────
  let empCount = 0
  for (const emp of seedData.employees.records) {
    const branchId = branchMap[emp.branch]
    const code = `${emp.branch}-${emp.roles[0].substring(0, 3)}-${String(empCount + 1).padStart(3, '0')}`
    const employee = await prisma.employee.upsert({
      where: { employeeCode: `${emp.branch}-${emp.displayName}` },
      update: { fullName: emp.fullName, displayName: emp.displayName },
      create: {
        branchId,
        employeeCode: `${emp.branch}-${emp.displayName}`,
        fullName: emp.fullName,
        displayName: emp.displayName,
      },
    })

    for (const role of emp.roles) {
      const existing = await prisma.employeeRole.findFirst({
        where: { employeeId: employee.id, role: role as any },
      })
      if (!existing) {
        await prisma.employeeRole.create({
          data: { employeeId: employee.id, role: role as any },
        })
      }
    }
    empCount++
  }
  console.log(`✅ Employees: ${empCount}`)

  // ── 9. Users ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('ssg2026', 10)
  for (const u of seedData.static_seed.default_users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role as any,
        branchId: u.branch ? branchMap[u.branch] : null,
      },
    })
  }
  console.log(`✅ Users: ${seedData.static_seed.default_users.length}`)

  console.log('\n🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())