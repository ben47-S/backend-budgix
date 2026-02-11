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

import logger from "../lib/logger";

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
  statut: "submitted";
  id: string;
  partCount: number;
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

  try {
    const response = await fetch(`${LETEXTO_API_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LETEXTO_API_TOKEN}`,
      },
      body: JSON.stringify({
        from: LETEXTO_SENDER_ID,
        to: formattedPhone,
        content: message,
      }),
    });

    const data = (await response.json()) as LeTextoResponse;

    // Vérifier si c'est une réponse de succès
    if (response.ok && "statut" in data && data.statut === "submitted") {
      logger.info("SMS envoyé via LeTexto", {
        phone: formattedPhone,
        messageId: data.id,
        partCount: data.partCount,
      });
      return data.id;
    }

    // Gérer les erreurs
    const errorData = data as LeTextoErrorResponse;
    const errorMessage = Array.isArray(errorData.message)
      ? errorData.message.join(", ")
      : errorData.message;

    logger.error("Erreur LeTexto API", {
      phone: formattedPhone,
      statusCode: errorData.statusCode || response.status,
      error: errorMessage,
    });

    return null;
  } catch (error) {
    logger.error("Erreur lors de l'appel à LeTexto", {
      phone: formattedPhone,
      error: error instanceof Error ? error.message : "Unknown error",
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
    logger.info(`[SMS Mock] OTP envoyé à ${phone}`, {
      phone,
      codeLength: code.length,
    });
    return true;
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
    logger.info(`[SMS Mock] Message envoyé à ${phone}`, {
      phone,
      messageLength: message.length,
    });
    return true;
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
    logger.warn("LeTexto non configuré - Impossible de récupérer le solde");
    return null;
  }

  try {
    const response = await fetch(
      `${LETEXTO_API_URL}/users/balance?token=${LETEXTO_API_TOKEN}`
    );

    if (response.ok) {
      const data = (await response.json()) as { balance: number };
      logger.info("Solde LeTexto récupéré", { balance: data.balance });
      return data.balance;
    }

    logger.error("Erreur lors de la récupération du solde LeTexto", {
      status: response.status,
    });
    return null;
  } catch (error) {
    logger.error("Erreur lors de l'appel à LeTexto (balance)", {
      error: error instanceof Error ? error.message : "Unknown error",
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
    logger.warn("LeTexto non configuré - Impossible de vérifier le statut");
    return null;
  }

  try {
    const response = await fetch(
      `${LETEXTO_API_URL}/messages/${messageId}/status?token=${LETEXTO_API_TOKEN}`
    );

    if (response.ok) {
      const data = (await response.json()) as { statuts: string };
      return data.statuts;
    }

    return null;
  } catch (error) {
    logger.error("Erreur lors de la vérification du statut", {
      messageId,
      error: error instanceof Error ? error.message : "Unknown error",
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
