/**
 * Service SMS - Envoi de SMS via LeTexto
 *
 * Ce service gère l'envoi de SMS pour :
 * - Les codes OTP d'authentification
 * - Les codes de vérification de téléphone
 *
 * Configuration requise dans .env :
 * - LETEXTO_API_TOKEN : Token API LeTexto (depuis la section API développeur)
 * - LETEXTO_SENDER_ID : Nom d'expéditeur (max 11 caractères, ex: "Budgix")
 *
 * Documentation : https://github.com/Arolitec/letexto-v3-api-examples
 */

import logger from "../lib/logger.js";

// Configuration LeTexto depuis les variables d'environnement
const LETEXTO_API_TOKEN = process.env.LETEXTO_API_TOKEN;
const LETEXTO_SENDER_ID = process.env.LETEXTO_SENDER_ID || "Budgix";
const LETEXTO_API_URL = "https://apis.letexto.com/v1";

// Vérifier si LeTexto est configuré
const isLeTextoConfigured = Boolean(LETEXTO_API_TOKEN);

if (isLeTextoConfigured) {
  logger.info("LeTexto SMS service initialized");
} else {
  logger.warn(
    "LeTexto non configuré - Les SMS seront uniquement loggés. " +
      "Configurez LETEXTO_API_TOKEN dans .env"
  );
}

/**
 * Interface pour la réponse de l'API LeTexto (succès)
 */
interface LeTextoSuccessResponse {
  status: "submitted";
  id: string;
  partCount: number;
  createdAt?: string;
}

/**
 * Interface pour la réponse de l'API LeTexto (erreur)
 */
interface LeTextoErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  errors?: string;
}

type LeTextoResponse = LeTextoSuccessResponse | LeTextoErrorResponse;

/**
 * Formate le numéro de téléphone pour LeTexto
 * LeTexto attend le format sans "+" (ex: 2250585743342)
 *
 * @param phone - Numéro au format +225... ou 225...
 * @returns Numéro formaté pour LeTexto
 */
function formatPhoneForLeTexto(phone: string): string {
  // Supprimer le "+" si présent
  return phone.replace(/^\+/, "");
}

/**
 * Masque partiellement le token API pour les logs
 * Affiche uniquement les 8 premiers caractères
 */
function maskToken(token: string | undefined): string {
  if (!token) return "NON_CONFIGURÉ";
  return token.substring(0, 8) + "..." + token.substring(token.length - 4);
}

/**
 * Envoie un SMS via l'API LeTexto
 *
 * @param phone - Numéro de téléphone destinataire (format international: +225...)
 * @param message - Message à envoyer
 * @returns L'ID du message si envoyé avec succès, null sinon
 */
async function sendViaLeTexto(
  phone: string,
  message: string
): Promise<string | null> {
  const formattedPhone = formatPhoneForLeTexto(phone);

  // Logger la tentative d'envoi
  logger.info("📤 [LeTexto] Tentative d'envoi de SMS", {
    phone: formattedPhone,
    messageLength: message.length,
    sender: LETEXTO_SENDER_ID,
    apiToken: maskToken(LETEXTO_API_TOKEN),
  });

  try {
    const requestBody = {
      from: LETEXTO_SENDER_ID,
      to: formattedPhone,
      content: message,
    };

    // Logger les détails de la requête en développement
    if (process.env.NODE_ENV === "development") {
      console.log("\n🔍 [LeTexto DEBUG] Requête sortante:");
      console.log("  URL:", `${LETEXTO_API_URL}/messages/send`);
      console.log("  Method: POST");
      console.log("  Headers:", {
        "Content-Type": "application/json",
        Authorization: `Bearer ${maskToken(LETEXTO_API_TOKEN)}`,
      });
      console.log("  Body:", requestBody);
    }

    const response = await fetch(`${LETEXTO_API_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LETEXTO_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as LeTextoResponse;

    // Logger la réponse complète en développement
    if (process.env.NODE_ENV === "development") {
      console.log("\n📥 [LeTexto DEBUG] Réponse reçue:");
      console.log("  Status:", response.status, response.statusText);
      console.log("  Headers:", Object.fromEntries(response.headers.entries()));
      console.log("  Body:", JSON.stringify(data, null, 2));
    }

    // Vérifier si c'est une réponse de succès
    if (response.ok && "status" in data && data.status === "submitted") {
      logger.info("✅ [LeTexto] SMS envoyé avec succès", {
        phone: formattedPhone,
        messageId: data.id,
        partCount: data.partCount,
        status: data.status,
      });
      return data.id;
    }

    // Gérer les erreurs
    const errorData = data as LeTextoErrorResponse;
    const errorMessage = Array.isArray(errorData.message)
      ? errorData.message.join(", ")
      : errorData.message;

    logger.error("❌ [LeTexto] Erreur API", {
      phone: formattedPhone,
      statusCode: errorData.statusCode || response.status,
      error: errorMessage,
      fullErrorData: errorData,
    });

    return null;
  } catch (error) {
    logger.error("❌ [LeTexto] Erreur lors de l'appel à l'API", {
      phone: formattedPhone,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Envoie un SMS avec le code OTP
 *
 * @param phone - Numéro de téléphone destinataire (format international: +225...)
 * @param code - Code OTP à envoyer
 * @returns true si envoyé avec succès, false sinon
 */
export async function sendOTPSMS(
  phone: string,
  code: string
): Promise<boolean> {
  const message = `Votre code de verification Budgix est : ${code}. Ce code expire dans 5 minutes.`;

  // Toujours logger le code en développement
  if (process.env.NODE_ENV === "development") {
    console.log(`📱 [SMS] Code OTP pour ${phone}: ${code}`);
  }

  // Si LeTexto n'est pas configuré, juste logger
  if (!isLeTextoConfigured) {
    if (process.env.NODE_ENV === "development") {
      logger.info(`[SMS Mock] OTP envoyé à ${phone}`, {
        phone,
        codeLength: code.length,
      });
      return true;
    }

    logger.error("LeTexto non configuré - SMS non envoyé", {
      phone,
    });
    return false;
  }

  const messageId = await sendViaLeTexto(phone, message);

  // En développement, on continue même si l'envoi échoue
  if (!messageId && process.env.NODE_ENV === "development") {
    logger.warn(
      "Mode développement - Continuation malgré l'échec d'envoi SMS"
    );
    return true;
  }

  return messageId !== null;
}

/**
 * Envoie un SMS générique
 *
 * @param phone - Numéro de téléphone destinataire
 * @param message - Message à envoyer
 * @returns true si envoyé avec succès, false sinon
 */
export async function sendSMS(
  phone: string,
  message: string
): Promise<boolean> {
  // Toujours logger en développement
  if (process.env.NODE_ENV === "development") {
    console.log(`📱 [SMS] Message pour ${phone}: ${message}`);
  }

  // Si LeTexto n'est pas configuré, juste logger
  if (!isLeTextoConfigured) {
    if (process.env.NODE_ENV === "development") {
      logger.info(`[SMS Mock] Message envoyé à ${phone}`, {
        phone,
        messageLength: message.length,
      });
      return true;
    }

    logger.error("LeTexto non configuré - SMS non envoyé", {
      phone,
      messageLength: message.length,
    });
    return false;
  }

  const messageId = await sendViaLeTexto(phone, message);
  return messageId !== null;
}

/**
 * Vérifie le solde SMS disponible
 *
 * @returns Le solde ou null en cas d'erreur
 */
export async function getBalance(): Promise<number | null> {
  if (!isLeTextoConfigured) {
    logger.warn("⚠️ [LeTexto] Non configuré - Impossible de récupérer le solde");
    return null;
  }

  logger.info("📊 [LeTexto] Vérification du solde");

  try {
    const url = `${LETEXTO_API_URL}/users/balance?token=${LETEXTO_API_TOKEN}`;

    if (process.env.NODE_ENV === "development") {
      console.log("\n🔍 [LeTexto DEBUG] Requête balance:");
      console.log("  URL:", url.replace(LETEXTO_API_TOKEN || "", maskToken(LETEXTO_API_TOKEN)));
      console.log("  Method: GET");
    }

    const response = await fetch(url);
    const data = (await response.json()) as { balance: number };

    if (process.env.NODE_ENV === "development") {
      console.log("\n📥 [LeTexto DEBUG] Réponse balance:");
      console.log("  Status:", response.status);
      console.log("  Body:", JSON.stringify(data, null, 2));
    }

    if (response.ok) {
      logger.info("✅ [LeTexto] Solde récupéré", { balance: data.balance });
      return data.balance;
    }

    logger.error("❌ [LeTexto] Erreur lors de la récupération du solde", {
      status: response.status,
      data,
    });
    return null;
  } catch (error) {
    logger.error("❌ [LeTexto] Erreur lors de l'appel à l'API (balance)", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Vérifie le statut d'un message envoyé
 *
 * @param messageId - ID du message retourné par sendViaLeTexto
 * @returns Le statut du message ou null en cas d'erreur
 */
export async function getMessageStatus(
  messageId: string
): Promise<string | null> {
  if (!isLeTextoConfigured) {
    logger.warn("⚠️ [LeTexto] Non configuré - Impossible de vérifier le statut");
    return null;
  }

  logger.info("🔍 [LeTexto] Vérification du statut du message", { messageId });

  try {
    const url = `${LETEXTO_API_URL}/messages/${messageId}/status?token=${LETEXTO_API_TOKEN}`;

    if (process.env.NODE_ENV === "development") {
      console.log("\n🔍 [LeTexto DEBUG] Requête statut:");
      console.log("  URL:", url.replace(LETEXTO_API_TOKEN || "", maskToken(LETEXTO_API_TOKEN)));
      console.log("  Method: GET");
      console.log("  MessageId:", messageId);
    }

    const response = await fetch(url);
    const data = (await response.json()) as { statuts: string };

    if (process.env.NODE_ENV === "development") {
      console.log("\n📥 [LeTexto DEBUG] Réponse statut:");
      console.log("  Status:", response.status);
      console.log("  Body:", JSON.stringify(data, null, 2));
    }

    if (response.ok) {
      logger.info("✅ [LeTexto] Statut récupéré", {
        messageId,
        status: data.statuts,
      });
      return data.statuts;
    }

    logger.error("❌ [LeTexto] Erreur lors de la récupération du statut", {
      messageId,
      status: response.status,
      data,
    });
    return null;
  } catch (error) {
    logger.error("❌ [LeTexto] Erreur lors de la vérification du statut", {
      messageId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Vérifie si le service SMS est opérationnel
 */
export function isSMSServiceAvailable(): boolean {
  return isLeTextoConfigured;
}
