/**
 * Script pour vérifier les reçus (receipts) des notifications Expo
 * 
 * Ce script permet de vérifier si les notifications ont été livrées avec succès
 * ou s'il y a eu des erreurs (token invalide, appareil non enregistré, etc.)
 * 
 * Usage:
 *   pnpm tsx src/scripts/check-push-receipts.ts <ticketId1> [ticketId2] ...
 * 
 * Note: Les ticket IDs sont retournés par sendExpoPushNotification
 */

import 'dotenv/config';
import { Expo } from 'expo-server-sdk';
import logger from '../lib/logger';

const expo = new Expo({
  ...(process.env.EXPO_ACCESS_TOKEN && { accessToken: process.env.EXPO_ACCESS_TOKEN }),
  useFcmV1: true,
});

async function checkReceipts() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Erreur: Au moins un ticket ID est requis');
    console.log('\nUsage:');
    console.log('  pnpm tsx src/scripts/check-push-receipts.ts <ticketId1> [ticketId2] ...');
    console.log('\nExemple:');
    console.log('  pnpm tsx src/scripts/check-push-receipts.ts "019be6a6-8873-72e8-b9fa-6aeb0a509d40"');
    process.exit(1);
  }

  const ticketIds = args.filter(id => id && typeof id === 'string');

  if (ticketIds.length === 0) {
    console.error('❌ Aucun ticket ID valide fourni');
    process.exit(1);
  }

  console.log('🔍 Vérification des reçus Expo pour', ticketIds.length, 'ticket(s)...\n');

  try {
    // Expo limite à 100 IDs par requête
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

    for (const chunk of receiptIdChunks) {
      console.log(`📦 Vérification d'un chunk de ${chunk.length} ticket(s)...`);

      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      console.log(`✅ ${Object.keys(receipts).length} reçu(s) obtenu(s)\n`);

      // Analyser chaque reçu
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        console.log(`📄 Ticket ID: ${receiptId}`);
        console.log(`   Status: ${receipt.status}`);

        if (receipt.status === 'ok') {
          console.log('   ✅ Notification livrée avec succès');
          if (receipt.details) {
            console.log('   Détails:', JSON.stringify(receipt.details, null, 2));
          }
        } else if (receipt.status === 'error') {
          console.log('   ❌ Erreur lors de la livraison');
          console.log('   Message:', receipt.message);
          
          if (receipt.details) {
            console.log('   Détails:', JSON.stringify(receipt.details, null, 2));
            
            const error = receipt.details.error;
            if (error) {
              console.log(`   Code d'erreur: ${error}`);
              
              // Messages d'erreur courants
              switch (error) {
                case 'DeviceNotRegistered':
                  console.log('   ⚠️  L\'appareil n\'est plus enregistré.');
                  console.log('   Solution: Le token est invalide ou l\'app a été désinstallée.');
                  break;
                case 'InvalidCredentials':
                  console.log('   ⚠️  Les credentials Expo sont invalides.');
                  break;
                case 'MessageTooBig':
                  console.log('   ⚠️  Le message est trop volumineux.');
                  break;
                case 'MessageRateExceeded':
                  console.log('   ⚠️  Trop de messages envoyés à cet appareil.');
                  break;
                default:
                  console.log(`   ⚠️  Erreur inconnue: ${error}`);
              }
            }
          }
        }

        console.log('');
      }
    }

    console.log('✅ Vérification terminée');
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification des reçus:');
    console.error(error instanceof Error ? error.message : 'Erreur inconnue');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkReceipts();