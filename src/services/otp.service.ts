/**
 * Service OTP - Gestion des codes OTP
 *
 * Ce service gère :
 * - La génération de codes OTP sécurisés (6 chiffres)
 * - La validation des codes OTP
 * - La gestion de l'expiration (5 minutes)
 * - Le marquage des codes comme utilisés
 * - Le hashage des codes avant stockage
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import * as crypto from "crypto";

// Durée de validité d'un code OTP en millisecondes (5 minutes)
const OTP_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Hashe un code OTP avec SHA-256
 * Le hash est utilisé pour stocker le code de manière sécurisée
 */
function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Génère un code OTP sécurisé à 6 chiffres
 * Utilise crypto.randomInt pour une génération cryptographiquement sécurisée
 */
export function generateOTP(): string {
  // Générer un nombre aléatoire entre 100000 et 999999 (6 chiffres)
  const min = 100000;
  const max = 999999 + 1; // crypto.randomInt exclut le max, donc +1
  return crypto.randomInt(min, max).toString();
}

/**
 * Crée un nouveau code OTP pour un numéro de téléphone
 * 
 * @param phone - Numéro de téléphone
 * @param userId - ID de l'utilisateur (optionnel, pour les utilisateurs existants qui ajoutent un téléphone)
 * @returns Le code OTP généré
 */
export async function createOTP(
  phone: string,
  userId?: string
): Promise<string> {
  // Générer le code OTP
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

  // Construire la condition where pour invalider les anciens codes
  const whereCondition: any = {
    phone,
    used: false,
    expiresAt: {
      gt: new Date(), // Codes non expirés
    },
  };

  // Si userId est fourni, invalider seulement les codes pour cet utilisateur
  if (userId !== undefined) {
    whereCondition.userId = userId;
  }

  // Marquer les anciens codes OTP comme utilisés pour ce numéro
  await prisma.otpCode.updateMany({
    where: whereCondition,
    data: {
      used: true, // Invalider les anciens codes
    },
  });

  // Hasher le code avant stockage
  const hashedCode = hashOTP(code);

  // Créer le nouveau code OTP avec le hash
  await prisma.otpCode.create({
    data: {
      code: hashedCode,
      phone,
      expiresAt,
      userId: userId || null,
    },
  });

  // Retourner le code en clair (sera envoyé par SMS)
  return code;
}

/**
 * Vérifie un code OTP pour un numéro de téléphone
 * 
 * @param phone - Numéro de téléphone
 * @param code - Code OTP à vérifier
 * @param userId - ID de l'utilisateur (optionnel, pour vérifier que le code appartient à cet utilisateur)
 * @returns L'ID de l'utilisateur associé (ou null si nouveau utilisateur)
 * @throws Erreur si le code est invalide, expiré ou déjà utilisé
 */
export async function verifyOTP(
  phone: string,
  code: string,
  userId?: string
): Promise<{ userId: string | null; isNewUser: boolean }> {
  // Hasher le code fourni pour le comparer avec le hash stocké
  const hashedCode = hashOTP(code);

  // Construire la condition where pour rechercher le code OTP
  const whereCondition: any = {
    phone,
    code: hashedCode,
    used: false,
    expiresAt: {
      gt: new Date(), // Code non expiré
    },
  };

  // Si userId est fourni, vérifier que le code appartient à cet utilisateur
  if (userId !== undefined) {
    whereCondition.userId = userId;
  }

  // Rechercher le code OTP valide
  const otpCode = await prisma.otpCode.findFirst({
    where: whereCondition,
    orderBy: {
      createdAt: "desc", // Prendre le plus récent
    },
  });

  // Vérifier si le code existe
  if (!otpCode) {
    throw createError(
      "Code OTP invalide, expiré ou déjà utilisé",
      400,
      "INVALID_OTP"
    );
  }
  // Marquer le code comme utilisé
  await prisma.otpCode.update({
    where: {
      id: otpCode.id,
    },
    data: {
      used: true,
    },
  });

  // Déterminer si c'est un nouvel utilisateur ou un utilisateur existant
  const isNewUser = !otpCode.userId;

  return {
    userId: otpCode.userId || null,
    isNewUser,
  };
}

/**
 * Nettoie les codes OTP expirés (à exécuter périodiquement)
 * Utile pour maintenir la base de données propre
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } }, // Codes expirés
        { used: true }, // Codes déjà utilisés (optionnel, selon vos besoins)
      ],
    },
  });
}

