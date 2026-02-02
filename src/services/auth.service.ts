/**
 * Service d'authentification
 * 
 * Ce service gère :
 * - La création d'utilisateurs (inscription)
 * - La récupération d'utilisateurs (connexion)
 * - La gestion des sessions/tokens (à implémenter plus tard)
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";

/**
 * Crée un nouvel utilisateur
 * 
 * @param phone - Numéro de téléphone de l'utilisateur
 * @returns L'utilisateur créé
 */
export async function createUser(phone: string) {
  // Vérifier si l'utilisateur existe déjà
  const existingUser = await prisma.user.findUnique({
    where: { phone },
  });

  if (existingUser) {
    throw createError("Un utilisateur avec ce numéro existe déjà", 409, "USER_EXISTS");
  }

  // Créer le nouvel utilisateur
  const user = await prisma.user.create({
    data: {
      phone,
    },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Récupère un utilisateur par son numéro de téléphone
 * 
 * @param phone - Numéro de téléphone
 * @returns L'utilisateur trouvé
 * @throws Erreur si l'utilisateur n'existe pas
 */
export async function getUserByPhone(phone: string) {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  return user;
}

/**
 * Récupère un utilisateur par son email
 * 
 * @param email - Email de l'utilisateur
 * @returns L'utilisateur trouvé
 * @throws Erreur si l'utilisateur n'existe pas
 */
export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  return user;
}

/**
 * Récupère un utilisateur par son ID
 * 
 * @param userId - ID de l'utilisateur
 * @returns L'utilisateur trouvé
 * @throws Erreur si l'utilisateur n'existe pas
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  return user;
}

