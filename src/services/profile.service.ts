/**
 * Service de gestion du profil utilisateur
 * 
 * Ce service gère :
 * - La mise à jour du numéro de téléphone d'un utilisateur
 * - La mise à jour de l'email d'un utilisateur
 * - La vérification des informations avant mise à jour
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { getUserById } from "./auth.service.js";
import { verifyOTP } from "./otp.service.js";
import { verifyEmailCode } from "./email-verification.service.js";
import { normalizePhone, isValidPhone } from "../utils/validation.js";
import { normalizeEmail, isValidEmail } from "./email-verification.service.js";

/**
 * Met à jour le numéro de téléphone d'un utilisateur après vérification OTP
 * 
 * @param userId - ID de l'utilisateur
 * @param phone - Nouveau numéro de téléphone
 * @param code - Code OTP de vérification
 * @returns L'utilisateur mis à jour
 */
export async function updateUserPhone(
  userId: string,
  phone: string,
  code: string
) {
  // Valider le numéro de téléphone
  if (!isValidPhone(phone)) {
    throw createError("Numéro de téléphone invalide", 400, "INVALID_PHONE");
  }

  // Normaliser le numéro de téléphone
  const normalizedPhone = normalizePhone(phone);

  // Vérifier si le numéro est déjà utilisé par un autre utilisateur
  const existingUser = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (existingUser && existingUser.id !== userId) {
    throw createError(
      "Ce numéro de téléphone est déjà utilisé par un autre compte",
      409,
      "PHONE_ALREADY_EXISTS"
    );
  }

  // Vérifier le code OTP (avec userId pour s'assurer que c'est bien pour cet utilisateur)
  await verifyOTP(normalizedPhone, code, userId);

  // Mettre à jour le numéro de téléphone de l'utilisateur
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { phone: normalizedPhone },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      createdAt: true,
    },
  });

  return updatedUser;
}

/**
 * Met à jour l'email d'un utilisateur après vérification du code
 * 
 * @param userId - ID de l'utilisateur
 * @param email - Nouvel email
 * @param code - Code de vérification d'email
 * @returns L'utilisateur mis à jour
 */
export async function updateUserEmail(
  userId: string,
  email: string,
  code: string
) {
  // Valider l'email
  if (!isValidEmail(email)) {
    throw createError("Format d'email invalide", 400, "INVALID_EMAIL");
  }

  // Normaliser l'email
  const normalizedEmail = normalizeEmail(email);

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

  // Vérifier le code de vérification d'email
  await verifyEmailCode(normalizedEmail, code, userId);

  // Mettre à jour l'email de l'utilisateur
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { email: normalizedEmail },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      createdAt: true,
    },
  });

  return updatedUser;
}

/**
 * Récupère le profil complet d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Le profil de l'utilisateur
 */
export async function getUserProfile(userId: string) {
  return await getUserById(userId);
}

/**
 * Met à jour le username d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param username - Nouveau nom d'utilisateur
 * @returns L'utilisateur mis à jour
 */
export async function updateUserUsername(userId: string, username: string) {
  // Vérifier si le username est déjà utilisé par un autre utilisateur
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser && existingUser.id !== userId) {
    throw createError(
      "Ce nom d'utilisateur est déjà utilisé",
      409,
      "USERNAME_ALREADY_EXISTS"
    );
  }

  // Mettre à jour le username de l'utilisateur
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { username },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      createdAt: true,
    },
  });

  return updatedUser;
}

/**
 * Met à jour la date du dernier refus de rappel de notification
 * 
 * @param userId - ID de l'utilisateur
 * @param dismissedAt - Date du refus (null pour reset)
 * @returns L'utilisateur mis à jour
 */
export async function updateUserNotificationReminder(userId: string, dismissedAt: Date | null) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { notificationReminderDismissedAt: dismissedAt },
  });

  return updatedUser;
}

