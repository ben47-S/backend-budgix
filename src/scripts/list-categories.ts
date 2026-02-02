import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function listCategories() {
  await prisma.$connect();
  const userId = process.argv[2] || 'cmkjsni940001nkl8g6cskmr5';
  
  const cats = await prisma.category.findMany({
    where: {
      OR: [{ userId: null }, { userId }],
    },
    select: { id: true, name: true, userId: true },
    take: 10,
  });
  
  console.log('Catégories disponibles:');
  cats.forEach(c => console.log(`  - ${c.id}: ${c.name} (${c.userId ? 'personnelle' : 'globale'})`));
  
  await prisma.$disconnect();
}

listCategories();







