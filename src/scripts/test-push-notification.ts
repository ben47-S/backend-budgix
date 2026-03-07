/**
 * Script de test pour envoyer une notification push à un appareil
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-push-notification.ts <token> [title] [body]
 * 
 * Exemple:
 *   pnpm tsx src/scripts/test-push-notification.ts "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *   pnpm tsx src/scripts/test-push-notification.ts "ExponentPushToken[...]" "Test" "Ceci est un message de test"
 */

import { sendExpoPushNotification } from '../services/expo-notification.service.js';

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Erreur: Token Expo requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-push-notification.ts <token> [title] [body]');
  console.log('\nExemple:');
  console.log('  pnpm tsx src/scripts/test-push-notification.ts "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"');
  console.log('  pnpm tsx src/scripts/test-push-notification.ts "ExponentPushToken[...]" "Test" "Ceci est un message de test"');
  process.exit(1);
}

const token = args[0];
const titleArg = args[1];
const bodyArg = args[2];

// Valider que le token est présent et est une string
if (!token || typeof token !== 'string') {
  console.error('❌ Erreur: Token Expo requis');
  console.log('\nUsage:');
  console.log('  pnpm tsx src/scripts/test-push-notification.ts <token> [title] [body]');
  process.exit(1);
}

// À ce stade, TypeScript sait que token est une string
const validatedToken: string = token;
const title: string = titleArg || 'Test Notification';
const body: string = bodyArg || 'Ceci est une notification de test depuis le backend Budgix';

// Données supplémentaires (optionnel)
const data = {
  type: 'TEST_NOTIFICATION',
  timestamp: new Date().toISOString(),
  test: true,
};

async function testPushNotification() {
  try {
    console.log('🚀 Envoi d\'une notification push de test...\n');
    console.log('Token:', validatedToken);
    console.log('Titre:', title);
    console.log('Message:', body);
    console.log('Données:', JSON.stringify(data, null, 2));
    console.log('\n---\n');

    // Envoyer la notification
    const tickets = await sendExpoPushNotification(
      [validatedToken],
      title,
      body,
      data,
      'default', // sound
      'high' // priority (high pour les tests)
    );

    console.log('✅ Notification envoyée avec succès!\n');
    console.log('Tickets reçus:', tickets.length);
    
    // Afficher les détails des tickets
    tickets.forEach((ticket, index) => {
      console.log(`\nTicket ${index + 1}:`);
      console.log('  Status:', ticket.status);
      if (ticket.status === 'ok') {
        console.log('  ID:', ticket.id);
        console.log('  ✅ Notification acceptée par Expo');
      } else if (ticket.status === 'error') {
        console.log('  ❌ Erreur:', ticket.message);
        console.log('  Détails:', ticket.details);
      }
    });

    // Vérifier s'il y a des erreurs
    const errors = tickets.filter(t => t.status === 'error');
    if (errors.length > 0) {
      console.log('\n⚠️  Certaines notifications ont échoué:');
      errors.forEach((error, index) => {
        console.log(`  Erreur ${index + 1}:`, error.message);
        if (error.details) {
          console.log('    Détails:', error.details);
        }
      });
      process.exit(1);
    } else {
      console.log('\n✅ Toutes les notifications ont été acceptées par Expo!');
      console.log('📱 Vérifiez votre appareil pour voir la notification.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'envoi de la notification:');
    console.error(error instanceof Error ? error.message : 'Erreur inconnue');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Exécuter le script
testPushNotification();

