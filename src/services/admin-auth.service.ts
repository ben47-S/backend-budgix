/**
 * Service d'authentification Admin - Connexion admin avec email + mot de passe
 * 
 * Ce service gère :
 * - L'authentification des administrateurs avec email + mot de passe
 * - La vérification du rôle ADMIN
 * - La génération de tokens JWT pour les admins
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { generateToken } from "./jwt.service.js";
import bcrypt from "bcrypt";

/**
 * Authentifie un administrateur avec email + mot de passe
 * 
 * @param email - Email de l'administrateur
 * @param password - Mot de passe en clair
 * @returns Token JWT et informations utilisateur
 * @throws Erreur si l'email ou le mot de passe est incorrect, ou si l'utilisateur n'est pas admin
 */
export async function authenticateAdmin(email: string, password: string) {
  // Vérifier que l'email est fourni
  if (!email || !email.trim()) {
    throw createError("Email requis", 400, "EMAIL_REQUIRED");
  }

  // Vérifier que le mot de passe est fourni
  if (!password || !password.trim()) {
    throw createError("Mot de passe requis", 400, "PASSWORD_REQUIRED");
  }

  // Récupérer l'utilisateur par email
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      password: true, // Inclure le mot de passe pour vérification
      isPremium: true,
      role: true,
      createdAt: true,
    },
  });

  // Vérifier que l'utilisateur existe
  if (!user) {
    // Log pour déboguer
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin Auth] Utilisateur non trouvé pour:", email.trim().toLowerCase());
    }
    throw createError("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
  }

  // Vérifier que l'utilisateur a le rôle ADMIN
  if (user.role !== "ADMIN") {
    // Log pour déboguer
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin Auth] Utilisateur n'est pas ADMIN. Role:", user.role);
    }
    throw createError(
      "Accès refusé - Cette route est réservée aux administrateurs",
      403,
      "ADMIN_REQUIRED"
    );
  }

  // Vérifier que l'utilisateur a un mot de passe défini
  if (!user.password) {
    // Log pour déboguer
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin Auth] Aucun mot de passe défini pour l'utilisateur");
    }
    throw createError(
      "Aucun mot de passe défini pour ce compte. Veuillez définir un mot de passe.",
      400,
      "PASSWORD_NOT_SET"
    );
  }

  // Vérifier le mot de passe
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Log pour déboguer
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin Auth] Mot de passe incorrect");
    }
    throw createError("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
  }

  // Générer un token JWT pour l'administrateur
  const tokenPayload: {
    userId: string;
    email?: string;
    phone?: string;
    isPremium: boolean;
    role?: string;
  } = {
    userId: user.id,
    isPremium: user.isPremium,
    role: user.role,
  };

  // Ajouter email et phone seulement s'ils existent
  if (user.email) {
    tokenPayload.email = user.email;
  }
  if (user.phone) {
    tokenPayload.phone = user.phone;
  }

  const token = generateToken(tokenPayload);

  // Retourner les informations utilisateur (sans le mot de passe)
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token,
  };
}

/**
 * Définit ou met à jour le mot de passe d'un administrateur
 * 
 * @param userId - ID de l'utilisateur
 * @param password - Nouveau mot de passe en clair
 * @returns Utilisateur mis à jour (sans le mot de passe)
 */
export async function setAdminPassword(userId: string, password: string) {
  // Vérifier que le mot de passe est fourni
  if (!password || !password.trim()) {
    throw createError("Mot de passe requis", 400, "PASSWORD_REQUIRED");
  }

  // Vérifier la longueur minimale du mot de passe (recommandation : minimum 8 caractères)
  if (password.length < 8) {
    throw createError(
      "Le mot de passe doit contenir au moins 8 caractères",
      400,
      "PASSWORD_TOO_SHORT"
    );
  }

  // Vérifier que l'utilisateur existe et est admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  if (user.role !== "ADMIN") {
    throw createError(
      "Seuls les administrateurs peuvent définir un mot de passe via cette méthode",
      403,
      "ADMIN_REQUIRED"
    );
  }

  // Hasher le mot de passe avec bcrypt (10 rounds)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Mettre à jour le mot de passe
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

/**
 * Définit ou met à jour le mot de passe d'un administrateur par email
 * 
 * @param email - Email de l'administrateur
 * @param password - Nouveau mot de passe en clair
 * @returns Utilisateur mis à jour (sans le mot de passe)
 */
export async function setAdminPasswordByEmail(email: string, password: string) {
  // Vérifier que l'email est fourni
  if (!email || !email.trim()) {
    throw createError("Email requis", 400, "EMAIL_REQUIRED");
  }

  // Vérifier que le mot de passe est fourni
  if (!password || !password.trim()) {
    throw createError("Mot de passe requis", 400, "PASSWORD_REQUIRED");
  }

  // Vérifier la longueur minimale du mot de passe
  if (password.length < 8) {
    throw createError(
      "Le mot de passe doit contenir au moins 8 caractères",
      400,
      "PASSWORD_TOO_SHORT"
    );
  }

  // Vérifier que l'utilisateur existe et est admin
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  if (user.role !== "ADMIN") {
    throw createError(
      "Seuls les administrateurs peuvent définir un mot de passe via cette méthode",
      403,
      "ADMIN_REQUIRED"
    );
  }

  // Hasher le mot de passe avec bcrypt (10 rounds)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Mettre à jour le mot de passe
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      isPremium: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

