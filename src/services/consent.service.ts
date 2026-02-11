/**
 * Service de consentement - Gestion de l'acceptation des CGU et politiques
 *
 * Ce service gère :
 * - L'acceptation des CGU (Conditions Générales d'Utilisation)
 * - L'acceptation de la politique de confidentialité
 * - La vérification du statut de consentement
 * - Le traçage des versions acceptées
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";

const CURRENT_TERMS_VERSION = "v1.0";
const CURRENT_PRIVACY_VERSION = "v1.0";

/**
 * Accepte les CGU et la politique de confidentialité pour un utilisateur
 *
 * @param userId - ID de l'utilisateur
 * @param acceptTerms - L'utilisateur accepte les CGU
 * @param acceptPrivacy - L'utilisateur accepte la politique de confidentialité
 * @returns L'utilisateur mis à jour
 * @throws Erreur si les deux conditions ne sont pas acceptées
 */
export async function acceptConsentTerms(
  userId: string,
  acceptTerms: boolean,
  acceptPrivacy: boolean
) {
  // L'utilisateur doit accepter les deux pour continuer
  if (!acceptTerms || !acceptPrivacy) {
    throw createError(
      "Vous devez accepter les CGU et la politique de confidentialité pour continuer",
      400,
      "CONSENT_REQUIRED"
    );
  }

  // Mettre à jour l'utilisateur avec les dates d'acceptation et le statut ACTIVE
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE", // Passez le user au statut ACTIVE
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      status: true,
      role: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Vérifie si un utilisateur a accepté les CGU et la politique de confidentialité
 *
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur a accepté les deux, false sinon
 */
export async function hasUserAcceptedConsent(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
    },
  });

  if (!user) {
    return false;
  }

  return (
    user.status === "ACTIVE" &&
    user.termsAcceptedAt !== null &&
    user.privacyAcceptedAt !== null
  );
}

/**
 * Récupère le statut de consentement d'un utilisateur
 *
 * @param userId - ID de l'utilisateur
 * @returns Status et dates d'acceptation
 */
export async function getUserConsentStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      termsVersion: true,
      privacyVersion: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  return {
    userId: user.id,
    status: user.status,
    hasAcceptedTerms: user.termsAcceptedAt !== null,
    hasAcceptedPrivacy: user.privacyAcceptedAt !== null,
    termsAcceptedAt: user.termsAcceptedAt,
    privacyAcceptedAt: user.privacyAcceptedAt,
    termsVersion: user.termsVersion,
    privacyVersion: user.privacyVersion,
    needsConsent: user.status === "PENDING_CONSENT",
  };
}
