/**
 * Service de vérification d'email
 *
 * Ce service gère :
 * - La génération de codes de vérification d'email sécurisés (6 chiffres)
 * - La validation des codes de vérification d'email
 * - La gestion de l'expiration (5 minutes)
 * - Le marquage des codes comme utilisés
 * - Le hashage des codes avant stockage
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { generateOTP } from "./otp.service"; // Réutiliser la fonction de génération OTP
import { sendVerificationEmail } from "./email.service"; // Service d'envoi d'email
import logger from "../lib/logger";
import * as crypto from "crypto";

/**
 * Hashe un code de vérification avec SHA-256
 */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Durée de validité d'un code de vérification d'email en millisecondes (5 minutes)
const EMAIL_VERIFICATION_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Valide un email
 * Format basique de validation d'email
 * 
 * @param email - Email à valider
 * @returns true si valide, false sinon
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalise un email (minuscules, trim)
 * 
 * @param email - Email à normaliser
 * @returns L'email normalisé
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Crée un nouveau code de vérification d'email
 * 
 * @param email - Email à vérifier
 * @param userId - ID de l'utilisateur (obligatoire pour ajouter un email à un compte existant)
 * @returns Le code de vérification généré
 */
export async function createEmailVerificationCode(
  email: string,
  userId: string
): Promise<string> {
  // Normaliser l'email
  const normalizedEmail = normalizeEmail(email);

  // Valider l'email
  if (!isValidEmail(normalizedEmail)) {
    throw createError("Format d'email invalide", 400, "INVALID_EMAIL");
  }

  // Vérifier si l'email est déjà utilisé par un autre utilisateur
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    throw createError(
      "Cet email est déjà utilisé par un autre compte",
      409,
      "EMAIL_ALREADY_EXISTS"
    );
  }

  // Générer le code de vérification
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION_MS);

  // Marquer les anciens codes de vérification comme utilisés pour cet email et cet utilisateur
  await prisma.emailVerificationCode.updateMany({
    where: {
      email: normalizedEmail,
      userId,
      used: false,
      expiresAt: {
        gt: new Date(), // Codes non expirés
      },
    },
    data: {
      used: true, // Invalider les anciens codes
    },
  });

  // Hasher le code avant stockage
  const hashedCode = hashCode(code);

  // Créer le nouveau code de vérification avec le hash
  await prisma.emailVerificationCode.create({
    data: {
      code: hashedCode,
      email: normalizedEmail,
      expiresAt,
      userId,
    },
  });

  // Envoyer l'email avec le code de vérification
  try {
    const emailSent = await sendVerificationEmail(normalizedEmail, code);

    if (emailSent) {
      logger.info(`Code de vérification email envoyé à ${normalizedEmail}`);
    } else {
      logger.warn(`Échec d'envoi du code de vérification à ${normalizedEmail}`);
      // En développement, afficher le code dans les logs
      if (process.env.NODE_ENV === "development") {
        logger.info(`📧 Code de vérification pour ${normalizedEmail}: ${code}`);
      }
    }
  } catch (error) {
    logger.error("Erreur lors de l'envoi de l'email de vérification", {
      error: error instanceof Error ? error.message : "Unknown error",
      email: normalizedEmail,
    });
    // Ne pas bloquer le processus si l'email n'est pas envoyé
    // Le code est quand même créé dans la DB
  }

  // Retourner le code en clair (pour le stockage en DB et potentiellement pour les tests)
  return code;
}

/**
 * Vérifie un code de vérification d'email
 * 
 * @param email - Email à vérifier
 * @param code - Code de vérification à vérifier
 * @param userId - ID de l'utilisateur
 * @returns true si le code est valide
 * @throws Erreur si le code est invalide, expiré ou déjà utilisé
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  userId: string
): Promise<boolean> {
  // Normaliser l'email
  const normalizedEmail = normalizeEmail(email);

  // Hasher le code fourni pour le comparer avec le hash stocké
  const hashedCode = hashCode(code);

  // Rechercher le code de vérification valide
  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalizedEmail,
      code: hashedCode,
      userId,
      used: false,
      expiresAt: {
        gt: new Date(), // Code non expiré
      },
    },
    orderBy: {
      createdAt: "desc", // Prendre le plus récent
    },
  });

  // Vérifier si le code existe
  if (!verificationCode) {
    throw createError(
      "Code de vérification invalide, expiré ou déjà utilisé",
      400,
      "INVALID_VERIFICATION_CODE"
    );
  }

  // Marquer le code comme utilisé
  await prisma.emailVerificationCode.update({
    where: {
      id: verificationCode.id,
    },
    data: {
      used: true,
    },
  });

  return true;
}

/**
 * Nettoie les codes de vérification d'email expirés (à exécuter périodiquement)
 * Utile pour maintenir la base de données propre
 */
export async function cleanupExpiredEmailVerificationCodes(): Promise<void> {
  await prisma.emailVerificationCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } }, // Codes expirés
        { used: true }, // Codes déjà utilisés (optionnel, selon vos besoins)
      ],
    },
  });
}

