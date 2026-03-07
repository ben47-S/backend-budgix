/**
 * Script de test en temps réel pour créer un budget et voir la réaction du backend
 * 
 * Ce script crée un budget qui déclenchera une notification et affiche tous les logs en temps réel
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-budget-realtime.ts <userId> <pushToken>
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { upsertBudgetForPeriod } from '../services/budget.service.js';

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Erreur: Arguments requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-realtime.ts <userId> <pushToken>');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-budget-realtime.ts "cmkjsni940001nkl8g6cskmr5" "ExponentPushToken[TL0_tEEYP0hMOGOMk2NNXV]"');
  process.exit(1);
}

const userId = args[0];
const expectedToken = args[1];

// Valider que tous les arguments sont présents et sont des strings
if (!userId || typeof userId !== 'string' || 
    !expectedToken || typeof expectedToken !== 'string') {
  console.error('❌ Erreur: Tous les arguments sont requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-realtime.ts <userId> <pushToken>');
  process.exit(1);
}

// À ce stade, TypeScript sait que userId et expectedToken sont des strings
const validatedUserId: string = userId;
const validatedToken: string = expectedToken;

async function testBudgetRealtime() {
  try {
    // Se connecter à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');

    console.log('🧪 Test en temps réel de création de budget\n');
    console.log('Paramètres:');
    console.log('  userId:', validatedUserId);
    console.log('  pushToken:', validatedToken);
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
      process.exit(1);
    }

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
      console.error('\n❌ Token push non trouvé ou inactif !');
      process.exit(1);
    }

    console.log('\n✅ Token push vérifié:');
    console.log('  id:', tokenRecord.id);
    console.log('  platform:', tokenRecord.platform);
    console.log('  enabled:', tokenRecord.enabled);
    console.log('  budgetAlerts:', tokenRecord.budgetAlerts);

    // Calculer les dépenses actuelles pour janvier 2026
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');

    const aggregation = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        userId: validatedUserId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const spentAmount = aggregation._sum.amount ? Number(aggregation._sum.amount) : 0;
    
    // Créer un budget qui déclenchera une notification (85% des dépenses actuelles)
    const limitAmount = spentAmount > 0 ? Math.ceil(spentAmount / 0.85) : 1000000;
    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

    console.log('\n📊 État actuel:');
    console.log('  Dépenses actuelles (janvier 2026):', spentAmount.toLocaleString(), 'FCFA');
    console.log('  Budget à créer:', limitAmount.toLocaleString(), 'FCFA');
    console.log('  Pourcentage attendu:', percentage.toFixed(2), '%');
    console.log('  Notification programmée ?', percentage >= 80 && spentAmount < limitAmount ? '✅ OUI' : '❌ NON');

    console.log('\n---\n');
    console.log('🚀 CRÉATION DU BUDGET MAINTENANT...\n');
    console.log('⏰ Heure actuelle:', new Date().toISOString());
    console.log('📝 Surveillez les logs ci-dessous pour voir la réaction du backend\n');
    console.log('='.repeat(60));
    console.log('');

    // Créer le budget
    const budgetStartTime = Date.now();
    const budget = await upsertBudgetForPeriod({
      userId: validatedUserId,
      amount: limitAmount,
      periodStart: startDate,
      periodEnd: endDate,
      categoryId: null, // Budget global
    });

    const budgetEndTime = Date.now();
    const budgetDuration = budgetEndTime - budgetStartTime;

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Budget créé en', budgetDuration, 'ms');
    console.log('  id:', budget.id);
    console.log('  amount:', budget.amount.toLocaleString(), 'FCFA');
    console.log('  periodStart:', budget.periodStart.toISOString());
    console.log('  periodEnd:', budget.periodEnd.toISOString());
    console.log('');

    console.log('⏳ ATTENTE DE 20 SECONDES pour voir la notification...');
    console.log('   (Le backend devrait envoyer la notification dans 15 secondes)\n');
    console.log('📊 Timeline attendue:');
    console.log('   T+0s   : Budget créé');
    console.log('   T+0s   : Vérification de progression');
    console.log('   T+0s   : Notification programmée (si >= 80%)');
    console.log('   T+15s  : Délai écoulé - Envoi de notification');
    console.log('   T+15s  : Notification envoyée à Expo');
    console.log('');

    // Attendre 20 secondes pour voir la notification
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
    console.log('   1. ✅ Budget créé');
    console.log('   2. 📊 Vérification de progression');
    console.log('   3. ⚠️  Notification programmée (si >= 80%)');
    console.log('   4. ⏰ Délai de 15 secondes écoulé');
    console.log('   5. 🚀 Envoi de la notification');
    console.log('   6. ✅ Notification envoyée avec succès');
    console.log('\n📱 Vérifiez également votre appareil pour voir la notification push !');
    console.log('');

    // Fermer la connexion à la base de données
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
testBudgetRealtime();







