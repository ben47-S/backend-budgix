/**
 * Script de test pour vérifier les notifications de budget par catégorie
 * 
 * Ce script teste si les notifications fonctionnent pour un budget spécifique à une catégorie
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-budget-category.ts <userId> <pushToken> <categoryId>
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { upsertBudgetForPeriod } from '../services/budget.service';
import logger from '../lib/logger';

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('❌ Erreur: Arguments requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-category.ts <userId> <pushToken> <categoryId>');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-budget-category.ts "cmkjsni940001nkl8g6cskmr5" "ExponentPushToken[TL0_tEEYP0hMOGOMk2NNXV]" "clx_category_123"');
  process.exit(1);
}

const userId = args[0];
const expectedToken = args[1];
const categoryId = args[2];

// Valider que tous les arguments sont présents et sont des strings
if (!userId || typeof userId !== 'string' || 
    !expectedToken || typeof expectedToken !== 'string' || 
    !categoryId || typeof categoryId !== 'string') {
  console.error('❌ Erreur: Tous les arguments sont requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-category.ts <userId> <pushToken> <categoryId>');
  process.exit(1);
}

// À ce stade, TypeScript sait que userId, expectedToken et categoryId sont des strings
const validatedUserId: string = userId;
const validatedToken: string = expectedToken;
const validatedCategoryId: string = categoryId;

async function testBudgetCategory() {
  try {
    // Se connecter à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');

    console.log('🧪 Test de notification de budget par catégorie\n');
    console.log('Paramètres:');
    console.log('  userId:', validatedUserId);
    console.log('  pushToken:', validatedToken);
    console.log('  categoryId:', validatedCategoryId);
    console.log('\n---\n');

    // Vérifier que l'utilisateur existe et est premium
    const user = await prisma.user.findUnique({
      where: { id: validatedUserId },
      select: { id: true, isPremium: true },
    });

    if (!user || !user.isPremium) {
      console.error('❌ Utilisateur non trouvé ou pas premium');
      process.exit(1);
    }

    // Vérifier que la catégorie existe
    const category = await prisma.category.findFirst({
      where: {
        id: validatedCategoryId,
        OR: [{ userId: null }, { userId: validatedUserId }],
      },
    });

    if (!category) {
      console.error('❌ Catégorie non trouvée:', validatedCategoryId);
      console.log('\n📋 Catégories disponibles pour cet utilisateur:');
      const categories = await prisma.category.findMany({
        where: {
          OR: [{ userId: null }, { userId: validatedUserId }],
        },
        select: { id: true, name: true, userId: true },
        take: 10,
      });
      categories.forEach(cat => {
        console.log(`  - ${cat.id}: ${cat.name} (${cat.userId ? 'personnelle' : 'globale'})`);
      });
      process.exit(1);
    }

    console.log('✅ Catégorie trouvée:');
    console.log('  id:', category.id);
    console.log('  name:', category.name);
    console.log('  userId:', category.userId || 'null (globale)');

    // Vérifier que le token push existe
    const tokenRecord = await prisma.pushToken.findFirst({
      where: {
        userId: validatedUserId,
        token: validatedToken,
        enabled: true,
        budgetAlerts: true,
      },
    });

    if (!tokenRecord) {
      console.error('❌ Token push non trouvé ou inactif !');
      process.exit(1);
    }

    console.log('\n✅ Token push vérifié');

    // Calculer les dépenses actuelles pour cette catégorie en janvier 2026
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');

    const aggregation = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        userId: validatedUserId,
        categoryId: validatedCategoryId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const spentAmount = aggregation._sum.amount ? Number(aggregation._sum.amount) : 0;
    
    // Créer un budget qui déclenchera une notification (85% des dépenses actuelles)
    const limitAmount = spentAmount > 0 ? Math.ceil(spentAmount / 0.85) : 100000;
    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

    console.log('\n📊 État actuel pour la catégorie "' + category.name + '":');
    console.log('  Dépenses actuelles (janvier 2026):', spentAmount.toLocaleString(), 'FCFA');
    console.log('  Budget à créer:', limitAmount.toLocaleString(), 'FCFA');
    console.log('  Pourcentage attendu:', percentage.toFixed(2), '%');
    console.log('  Notification programmée ?', percentage >= 80 && spentAmount < limitAmount ? '✅ OUI' : '❌ NON');

    if (spentAmount === 0) {
      console.log('\n⚠️  Aucune dépense trouvée pour cette catégorie dans cette période.');
      console.log('Le budget sera créé avec un montant de 100 000 FCFA.');
      console.log('Pour tester la notification, vous devrez créer des transactions dans cette catégorie.');
    }

    console.log('\n---\n');
    console.log('🚀 CRÉATION DU BUDGET POUR LA CATÉGORIE "' + category.name + '"...\n');
    console.log('⏰ Heure actuelle:', new Date().toISOString());
    console.log('📝 Surveillez les logs ci-dessous pour voir la réaction du backend\n');
    console.log('='.repeat(60));
    console.log('');

    // Créer le budget pour cette catégorie
    const budget = await upsertBudgetForPeriod({
      userId: validatedUserId,
      amount: limitAmount,
      periodStart: startDate,
      periodEnd: endDate,
      categoryId: validatedCategoryId, // ✅ Budget par catégorie
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Budget créé pour la catégorie "' + category.name + '"');
    console.log('  id:', budget.id);
    console.log('  categoryId:', budget.categoryId);
    console.log('  amount:', budget.amount.toLocaleString(), 'FCFA');
    console.log('');

    console.log('⏳ ATTENTE DE 20 SECONDES pour voir la notification...');
    console.log('   (Le backend devrait envoyer la notification dans 15 secondes)\n');

    // Attendre 20 secondes
    for (let i = 20; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const elapsed = 20 - i;
      if (elapsed === 15) {
        console.log(`⏰ T+${elapsed}s : Délai de 15 secondes écoulé - Notification devrait être envoyée maintenant !`);
      } else if (i % 5 === 0 || i <= 3) {
        console.log(`⏳ ${i} seconde(s) restante(s)...`);
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('✅ Test terminé !');
    console.log('\n📝 Vérifiez les logs ci-dessus pour voir:');
    console.log('   1. ✅ Budget créé pour la catégorie');
    console.log('   2. 📊 Vérification de progression (avec categoryId filtré)');
    console.log('   3. ⚠️  Notification programmée (si >= 80%)');
    console.log('   4. ⏰ Délai de 15 secondes écoulé');
    console.log('   5. 🚀 Envoi de la notification');
    console.log('   6. ✅ Notification envoyée avec succès');
    console.log('\n📱 Vérifiez également votre appareil pour voir la notification push !');
    console.log('');

    // Fermer la connexion
    await prisma.$disconnect();
    console.log('✅ Connexion à la base de données fermée');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du test:');
    console.error(error instanceof Error ? error.message : 'Erreur inconnue');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      // Ignorer
    }
    process.exit(1);
  }
}

testBudgetCategory();







