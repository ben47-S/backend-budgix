/**
 * Script de test simple pour les notifications de budget
 * 
 * Ce script permet de tester facilement les notifications push pour les budgets
 * avec différentes options (budget global ou par catégorie).
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-budget-notification-simple.ts <userId>
 * 
 * Exemple:
 *   pnpm tsx src/scripts/test-budget-notification-simple.ts "cmkjsni940001nkl8g6cskmr5"
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { upsertBudgetForPeriod } from '../services/budget.service.js';


// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Erreur: userId requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-simple.ts <userId>');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-simple.ts "cmkjsni940001nkl8g6cskmr5"');
  process.exit(1);
}

const userId = args[0];

// Valider que userId est présent et est une string
if (!userId || typeof userId !== 'string') {
  console.error('❌ Erreur: userId requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-simple.ts <userId>');
  process.exit(1);
}

// À ce stade, TypeScript sait que userId est une string
const validatedUserId: string = userId;

async function testBudgetNotificationSimple() {
  try {
    // Se connecter à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');

    console.log('🧪 Test de notification de budget\n');
    console.log('Paramètres:');
    console.log('  userId:', validatedUserId);
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
      where: { 
        userId: validatedUserId,
        enabled: true,
        budgetAlerts: true,
      },
      select: {
        id: true,
        platform: true,
        enabled: true,
        budgetAlerts: true,
        token: true,
      },
    });

    console.log('\n📱 Tokens push actifs avec budgetAlerts:');
    if (tokens.length === 0) {
      console.warn('  ⚠️  Aucun token actif avec budgetAlerts activé !');
      console.warn('  Les notifications ne pourront pas être envoyées.');
      console.warn('  Vérifiez que:');
      console.warn('    - Le token est enregistré via POST /api/notifications/token');
      console.warn('    - enabled: true');
      console.warn('    - budgetAlerts: true');
      
      // Afficher tous les tokens pour debug
      const allTokens = await prisma.pushToken.findMany({
        where: { userId: validatedUserId },
      });
      
      if (allTokens.length > 0) {
        console.log('\n📱 Tous les tokens de l\'utilisateur:');
        allTokens.forEach((token, index) => {
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

    // Récupérer les catégories de l'utilisateur
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId: null }, // Catégories globales
          { userId: validatedUserId },      // Catégories personnalisées
        ],
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
      orderBy: [
        { userId: 'asc' }, // Catégories globales en premier
        { name: 'asc' },
      ],
    });

    console.log('\n📂 Catégories disponibles:');
    console.log('  0. Budget global (toutes catégories)');
    categories.forEach((cat, index) => {
      const type = cat.userId ? 'personnalisée' : 'globale';
      console.log(`  ${index + 1}. ${cat.name} (${type})`);
    });

    // Pour simplifier, on teste avec un budget global
    // Vous pouvez modifier pour tester avec une catégorie
    const categoryId = null; // Budget global
    const categoryName = null;

    // Période : mois en cours
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log('\n📅 Période du budget:');
    console.log('  Début:', startDate.toISOString().split('T')[0]);
    console.log('  Fin:', endDate.toISOString().split('T')[0]);

    // Calculer les dépenses actuelles pour cette période
    const where: any = {
      userId: validatedUserId,
      date: {
        gte: startDate,
        lte: endDate,
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
    
    // Créer un budget qui déclenchera une notification (85% des dépenses actuelles)
    // Cela garantit que spentAmount / limitAmount = ~85% (entre 80% et 100%)
    const limitAmount = spentAmount > 0 ? Math.ceil(spentAmount / 0.85) : 100000;
    
    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

    console.log('\n📊 État actuel:');
    console.log('  Dépenses actuelles:', spentAmount.toLocaleString(), 'FCFA');
    console.log('  Budget à créer:', limitAmount.toLocaleString(), 'FCFA');
    console.log('  Pourcentage attendu:', percentage.toFixed(2), '%');
    console.log('  Type:', categoryId ? `Catégorie: ${categoryName}` : 'Budget global (toutes catégories)');
    console.log('  Notification programmée ?', percentage >= 80 && spentAmount < limitAmount ? '✅ OUI' : '❌ NON');

    if (spentAmount === 0) {
      console.log('\n⚠️  Aucune dépense trouvée pour cette période.');
      console.log('Le budget sera créé avec un montant de 100 000 FCFA.');
      console.log('Pour tester la notification, vous devrez créer des transactions.');
    }

    console.log('\n---\n');
    console.log('🚀 Création du budget...\n');

    // Créer le budget
    const budget = await upsertBudgetForPeriod({
      userId: validatedUserId,
      amount: limitAmount,
      periodStart: startDate,
      periodEnd: endDate,
      categoryId: categoryId,
    });

    console.log('✅ Budget créé:');
    console.log('  id:', budget.id);
    console.log('  amount:', Number(budget.amount).toLocaleString(), 'FCFA');
    console.log('  periodStart:', budget.periodStart.toISOString());
    console.log('  periodEnd:', budget.periodEnd.toISOString());
    console.log('  categoryId:', budget.categoryId || 'null (budget global)');
    console.log('  categoryName:', budget.category?.name || 'Toutes catégories');

    console.log('\n⏳ Attente de 20 secondes pour voir la notification envoyée...');
    console.log('  (Les logs du processus de notification apparaîtront ci-dessous)\n');
    console.log('---\n');

    // Attendre 20 secondes pour être sûr de voir la notification (15s + 5s de marge)
    await new Promise(resolve => setTimeout(resolve, 20 * 1000));

    console.log('\n---\n');
    console.log('✅ Test terminé !');
    console.log('\nVérifiez les logs ci-dessus pour voir:');
    console.log('  1. ⚠️  Budget presque atteint - Notification programmée');
    console.log('  2. ⏰ Délai de 15 secondes écoulé');
    console.log('  3. 🚀 Envoi de la notification de budget');
    console.log('  4. ✅ Notification envoyée avec succès');
    console.log('\n📱 Vérifiez également votre appareil pour voir la notification push !');
    console.log('\n💡 Si la notification n\'apparaît pas:');
    console.log('   - Vérifiez que le token est bien enregistré et actif');
    console.log('   - Vérifiez que budgetAlerts est activé');
    console.log('   - Vérifiez les permissions de notification sur l\'appareil');
    console.log('   - Vérifiez les logs du backend pour les erreurs');

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
testBudgetNotificationSimple();

