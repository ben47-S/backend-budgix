/**
 * Script de seed pour les catégories globales
 * 
 * Ce script crée les catégories prédéfinies (globales) qui seront
 * disponibles pour tous les utilisateurs.
 * 
 * Exécution : pnpm prisma db seed
 * ou : tsx prisma/seed.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Créer l'adapter PostgreSQL pour le seed
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL n'est pas défini dans les variables d'environnement");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

// Catégories globales prédéfinies
const globalCategories = [
  // Catégories de DÉPENSES (EXPENSE)
  { name: "Alimentation", type: "EXPENSE" as const },
  { name: "Transport", type: "EXPENSE" as const },
  { name: "Logement", type: "EXPENSE" as const },
  { name: "Santé", type: "EXPENSE" as const },
  { name: "Éducation", type: "EXPENSE" as const },
  { name: "Loisirs", type: "EXPENSE" as const },
  { name: "Shopping", type: "EXPENSE" as const },
  { name: "Factures", type: "EXPENSE" as const },
  { name: "Restaurant", type: "EXPENSE" as const },
  { name: "Autres dépenses", type: "EXPENSE" as const },

  // Catégories de REVENUS (INCOME)
  { name: "Salaire", type: "INCOME" as const },
  { name: "Freelance", type: "INCOME" as const },
  { name: "Investissement", type: "INCOME" as const },
  { name: "Cadeau", type: "INCOME" as const },
  { name: "Vente", type: "INCOME" as const },
  { name: "Autres revenus", type: "INCOME" as const },
];

async function main() {
  console.log("🌱 Début du seed des catégories globales...\n");

  // Supprimer les anciennes catégories globales (optionnel, pour réinitialiser)
  // await prisma.category.deleteMany({
  //   where: { userId: null },
  // });

  let created = 0;
  let skipped = 0;

  for (const category of globalCategories) {
    try {
      // Vérifier si la catégorie existe déjà
      // Utiliser findFirst car userId peut être null pour les catégories globales
      const existing = await prisma.category.findFirst({
        where: {
          userId: null,
          name: category.name,
          type: category.type,
        },
      });

      if (existing) {
        console.log(`⏭️  Catégorie "${category.name}" (${category.type}) existe déjà, ignorée`);
        skipped++;
        continue;
      }

      // Créer la catégorie globale
      // Pour les catégories globales, userId doit être explicitement null
      await prisma.category.create({
        data: {
          name: category.name,
          type: category.type,
          userId: null as any, // null = catégorie globale (cast nécessaire pour TypeScript)
        },
      });

      console.log(`✅ Catégorie "${category.name}" (${category.type}) créée`);
      created++;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la création de "${category.name}":`, error.message);
    }
  }

  console.log(`\n📊 Résumé :`);
  console.log(`   - ${created} catégorie(s) créée(s)`);
  console.log(`   - ${skipped} catégorie(s) ignorée(s) (déjà existantes)`);
  console.log(`   - ${globalCategories.length} catégorie(s) au total\n`);
}

main()
  .catch((error) => {
    console.error("❌ Erreur lors du seed :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

