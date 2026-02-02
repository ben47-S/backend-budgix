/**
 * Service de vérification d'email
 * 
 * Ce service gère :
 * - La génération de codes de vérification d'email sécurisés (6 chiffres)
 * - La validation des codes de vérification d'email
 * - La gestion de l'expiration (5 minutes)
 * - Le marquage des codes comme utilisés
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { generateOTP } from "./otp.service"; // Réutiliser la fonction de génération OTP

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

  // Créer le nouveau code de vérification
  await prisma.emailVerificationCode.create({
    data: {
      code,
      email: normalizedEmail,
      expiresAt,
      userId,
    },
  });

  // TODO: Envoyer l'email avec le code (intégration avec un service d'email)
  // Pour l'instant, on retourne le code (à retirer en production)
  console.log(`📧 Code de vérification pour ${normalizedEmail}: ${code}`);

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

  // Rechercher le code de vérification valide
  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalizedEmail,
      code,
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

