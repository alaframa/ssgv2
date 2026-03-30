// scripts/test-db.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$connect();
        console.log("✅ Connected to DB successfully");

        // optional: run a simple query to double check
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log("✅ Query OK:", result);

    } catch (e) {
        console.error("❌ Connection failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();