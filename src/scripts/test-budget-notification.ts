/**
 * Script de test pour vérifier l'envoi automatique des notifications de budget
 * 
 * Ce script simule la création d'un budget et vérifie si les notifications sont bien programmées
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-budget-notification.ts <userId> <amount> <startDate> <endDate> [categoryId]
 * 
 * Exemple:
 *   pnpm tsx src/scripts/test-budget-notification.ts "clx123..." 500 "2026-01-01" "2026-01-31"
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { upsertBudgetForPeriod } from '../services/budget.service.js';

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 4) {
  console.error('❌ Erreur: Arguments requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification.ts <userId> <amount> <startDate> <endDate> [categoryId]');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-budget-notification.ts "clx123..." 500 "2026-01-01" "2026-01-31"');
  console.log('  pnpm tsx src/scripts/test-budget-notification.ts "clx123..." 500 "2026-01-01" "2026-01-31" "clx_category_123"');
  process.exit(1);
}

const userId = args[0];
const amountStr = args[1];
const startDate = args[2];
const endDate = args[3];
const categoryId = args[4] || null;

// Valider que tous les arguments requis sont présents et sont des strings
if (!userId || typeof userId !== 'string' ||
    !amountStr || typeof amountStr !== 'string' ||
    !startDate || typeof startDate !== 'string' ||
    !endDate || typeof endDate !== 'string') {
  console.error('❌ Erreur: Tous les arguments requis sont nécessaires');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification.ts <userId> <amount> <startDate> <endDate> [categoryId]');
  process.exit(1);
}

// À ce stade, TypeScript sait que les arguments sont des strings
const validatedUserId: string = userId;
const validatedStartDate: string = startDate;
const validatedEndDate: string = endDate;
const amount = parseFloat(amountStr);

if (isNaN(amount) || amount <= 0) {
  console.error('❌ Erreur: amount doit être un nombre positif');
  process.exit(1);
}

async function testBudgetNotification() {
  try {
    // Se connecter à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');

    console.log('🧪 Test de création de budget avec notification automatique\n');
    console.log('Paramètres:');
    console.log('  userId:', validatedUserId);
    console.log('  amount:', amount);
    console.log('  startDate:', validatedStartDate);
    console.log('  endDate:', validatedEndDate);
    console.log('  categoryId:', categoryId || 'null (budget global)');
    console.log('\n---\n');

    // Vérifier que l'utilisateur existe et est premium
    const user = await prisma.user.findUnique({
      where: { id: validatedUserId },
      select: { id: true, isPremium: true, phone: true, email: true },
    });

    if (!user) {
      console.error('❌ Utilisateur non trouvé:', validatedUserId);
      process.exit(1);
    }

    console.log('✅ Utilisateur trouvé:');
    console.log('  id:', user.id);
    console.log('  isPremium:', user.isPremium);
    console.log('  phone:', user.phone);
    console.log('  email:', user.email);

    if (!user.isPremium) {
      console.error('\n❌ L\'utilisateur n\'est pas premium !');
      console.log('Les budgets nécessitent un abonnement premium.');
      process.exit(1);
    }

    // Vérifier les tokens push de l'utilisateur
    const tokens = await prisma.pushToken.findMany({
      where: { userId: validatedUserId },
      select: {
        id: true,
        platform: true,
        enabled: true,
        budgetAlerts: true,
        token: true,
      },
    });

    console.log('\n📱 Tokens push de l\'utilisateur:');
    if (tokens.length === 0) {
      console.warn('  ⚠️  Aucun token push enregistré !');
      console.warn('  Les notifications ne pourront pas être envoyées.');
    } else {
      tokens.forEach((token, index) => {
        console.log(`  Token ${index + 1}:`);
        console.log('    id:', token.id);
        console.log('    platform:', token.platform);
        console.log('    enabled:', token.enabled);
        console.log('    budgetAlerts:', token.budgetAlerts);
        console.log('    token:', process.env.NODE_ENV === 'production' 
          ? token.token.substring(0, 30) + '...' 
          : token.token);
      });
    }

    // Calculer les dépenses actuelles pour cette période
    const where: any = {
      userId: validatedUserId,
      date: {
        gte: new Date(validatedStartDate),
        lte: new Date(validatedEndDate),
      },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const aggregation = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where,
    });

    const spentAmount = aggregation._sum.amount ? Number(aggregation._sum.amount) : 0;
    const percentage = amount > 0 ? (spentAmount / amount) * 100 : 0;

    console.log('\n📊 État actuel du budget:');
    console.log('  Limite:', amount, 'FCFA');
    console.log('  Dépenses actuelles:', spentAmount, 'FCFA');
    console.log('  Pourcentage:', percentage.toFixed(2), '%');
    console.log('  Notification programmée ?', percentage >= 80 && spentAmount < amount ? '✅ OUI' : '❌ NON');

    if (percentage >= 80 && spentAmount < amount) {
      console.log('\n⚠️  ATTENTION: Le budget est déjà à', percentage.toFixed(2), '%');
      console.log('  Une notification sera programmée avec un délai de 15 secondes.');
      console.log('  Surveillez les logs pour voir la notification envoyée.');
    } else if (percentage < 80) {
      console.log('\nℹ️  Le budget est à', percentage.toFixed(2), '%');
      console.log('  Aucune notification ne sera programmée (seuil: 80%)');
    } else {
      console.log('\n⚠️  Le budget est déjà dépassé !');
      console.log('  Aucune notification ne sera programmée.');
    }

    console.log('\n---\n');
    console.log('🚀 Création/mise à jour du budget...\n');

    // Créer/mettre à jour le budget
    const budget = await upsertBudgetForPeriod({
      userId: validatedUserId,
      amount,
      periodStart: new Date(validatedStartDate),
      periodEnd: new Date(validatedEndDate),
      categoryId: categoryId ?? null,
    });

    console.log('✅ Budget créé/mis à jour:');
    console.log('  id:', budget.id);
    console.log('  amount:', budget.amount);
    console.log('  periodStart:', budget.periodStart);
    console.log('  periodEnd:', budget.periodEnd);
    console.log('  categoryId:', budget.categoryId || 'null');

    console.log('\n📝 Vérifiez les logs ci-dessus pour voir:');
    console.log('  1. 📊 Vérification de la progression du budget');
    console.log('  2. ⚠️  Budget presque atteint - Notification programmée (si >= 80%)');
    console.log('  3. ⏰ Délai de 15 secondes écoulé (après 15s)');
    console.log('  4. 🚀 Envoi de la notification de budget');
    console.log('  5. ✅ Notification envoyée avec succès');

    console.log('\n⏳ Attendez 15 secondes pour voir la notification envoyée...');
    console.log('  (Le script se termine ici, mais la notification sera envoyée en arrière-plan)');

    // Attendre un peu pour voir les logs initiaux
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fermer la connexion à la base de données
    await prisma.$disconnect();
    console.log('\n✅ Connexion à la base de données fermée');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du test:');
    console.error(error instanceof Error ? error.message : 'Erreur inconnue');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    // Fermer la connexion en cas d'erreur
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      // Ignorer les erreurs de déconnexion
    }
    process.exit(1);
  }
}

// Exécuter le script
testBudgetNotification();

