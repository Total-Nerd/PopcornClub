const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.request.updateMany({
    where: { status: 'archived' },
    data: { status: 'collected' }
  });
  console.log('Migrated', result.count, 'requests to collected');
}

main().catch(console.error).finally(() => prisma.$disconnect());
