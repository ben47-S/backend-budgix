/**
 * Script de test complet pour vérifier l'envoi automatique des notifications de budget
 * 
 * Ce script :
 * 1. Vérifie que l'utilisateur premium existe et a le token push enregistré
 * 2. Crée un budget qui déclenchera une notification (>= 80% mais < 100%)
 * 3. Attend 15 secondes pour voir la notification envoyée
 * 4. Affiche tous les logs détaillés
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-budget-notification-full.ts <userId> <pushToken>
 * 
 * Exemple:
 *   pnpm tsx src/scripts/test-budget-notification-full.ts "cmkjsni940001nkl8g6cskmr5" "ExponentPushToken[TL0_tEEYP0hMOGOMk2NNXV]"
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { upsertBudgetForPeriod } from '../services/budget.service';
import logger from '../lib/logger';

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Erreur: Arguments requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-full.ts <userId> <pushToken>');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-full.ts "cmkjsni940001nkl8g6cskmr5" "ExponentPushToken[TL0_tEEYP0hMOGOMk2NNXV]"');
  process.exit(1);
}

const userId = args[0];
const expectedToken = args[1];

// Valider que tous les arguments sont présents et sont des strings
if (!userId || typeof userId !== 'string' || 
    !expectedToken || typeof expectedToken !== 'string') {
  console.error('❌ Erreur: Tous les arguments sont requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-budget-notification-full.ts <userId> <pushToken>');
  process.exit(1);
}

// À ce stade, TypeScript sait que userId et expectedToken sont des strings
const validatedUserId: string = userId;
const validatedToken: string = expectedToken;

async function testBudgetNotificationFull() {
  try {
    // Se connecter à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');

    console.log('🧪 Test complet de notification de budget\n');
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
      console.log('Les budgets nécessitent un abonnement premium.');
      process.exit(1);
    }

    // Vérifier que le token push existe et est actif
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
      console.log('Le token doit être:');
      console.log('  - Enregistré pour cet utilisateur');
      console.log('  - Activé (enabled: true)');
      console.log('  - Alertes de budget activées (budgetAlerts: true)');
      
      // Afficher les tokens existants
      const allTokens = await prisma.pushToken.findMany({
        where: { userId: validatedUserId },
      });
      
      if (allTokens.length > 0) {
        console.log('\n📱 Tokens existants pour cet utilisateur:');
        allTokens.forEach((token, index) => {
          console.log(`  Token ${index + 1}:`);
          console.log('    id:', token.id);
          console.log('    token:', process.env.NODE_ENV === 'production' 
            ? token.token.substring(0, 30) + '...' 
            : token.token);
          console.log('    enabled:', token.enabled);
          console.log('    budgetAlerts:', token.budgetAlerts);
        });
      } else {
        console.log('\n⚠️  Aucun token push enregistré pour cet utilisateur.');
        console.log('Vous devez d\'abord enregistrer le token via POST /api/notifications/token');
      }
      
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
    // Cela garantit que spentAmount / limitAmount = ~85% (entre 80% et 100%)
    const limitAmount = spentAmount > 0 ? Math.ceil(spentAmount / 0.85) : 1000000;
    
    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

    console.log('\n📊 État actuel:');
    console.log('  Dépenses actuelles (janvier 2026):', spentAmount.toLocaleString(), 'FCFA');
    console.log('  Budget à créer:', limitAmount.toLocaleString(), 'FCFA');
    console.log('  Pourcentage attendu:', percentage.toFixed(2), '%');
    console.log('  Notification programmée ?', percentage >= 80 && spentAmount < limitAmount ? '✅ OUI' : '❌ NON');

    if (spentAmount === 0) {
      console.log('\n⚠️  Aucune dépense trouvée pour cette période.');
      console.log('Le budget sera créé avec un montant de 1 000 000 FCFA.');
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
      categoryId: null, // Budget global
    });

    console.log('✅ Budget créé:');
    console.log('  id:', budget.id);
    console.log('  amount:', budget.amount.toLocaleString(), 'FCFA');
    console.log('  periodStart:', budget.periodStart.toISOString());
    console.log('  periodEnd:', budget.periodEnd.toISOString());

    console.log('\n⏳ Attente de 15 secondes pour voir la notification envoyée...');
    console.log('  (Les logs du processus de notification apparaîtront ci-dessous)\n');
    console.log('---\n');

    // Attendre 15 secondes + 5 secondes de marge pour être sûr de voir la notification
    await new Promise(resolve => setTimeout(resolve, (15 + 5) * 1000));

    console.log('\n---\n');
    console.log('✅ Test terminé !');
    console.log('\nVérifiez les logs ci-dessus pour voir:');
    console.log('  1. ⚠️  Budget presque atteint - Notification programmée');
    console.log('  2. ⏰ Délai de 15 secondes écoulé');
    console.log('  3. 🚀 Envoi de la notification de budget');
    console.log('  4. ✅ Notification envoyée avec succès');
    console.log('\n📱 Vérifiez également votre appareil pour voir la notification push !');

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
testBudgetNotificationFull();

