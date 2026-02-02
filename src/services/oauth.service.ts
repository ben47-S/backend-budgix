/**
 * Service OAuth - Gestion de l'authentification OAuth
 * 
 * Ce service gère :
 * - La connexion via Google OAuth
 * - La création/récupération d'utilisateur via OAuth
 * - La génération de token JWT après authentification OAuth
 */

import { prisma } from "../lib/prisma";
import { createUser, getUserByEmail } from "./auth.service";
import { generateToken } from "./jwt.service";
import { createError } from "../middleware/errorHandler";

/**
 * Interface pour les données OAuth Google
 */
export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string; verified?: boolean }>;
  displayName?: string;
  photos?: Array<{ value: string }>;
}

/**
 * Authentifie ou crée un utilisateur via Google OAuth
 * 
 * @param profile - Profil Google de l'utilisateur
 * @returns Token JWT et informations utilisateur
 */
export async function authenticateWithGoogle(profile: GoogleProfile) {
  // Vérifier que l'email existe dans le profil
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw createError(
      "Email non trouvé dans le profil Google",
      400,
      "EMAIL_NOT_FOUND"
    );
  }

  // Vérifier si l'utilisateur existe déjà
  let user;
  let isNewUser = false;

  const existingUser = await prisma.user.findUnique({
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

  if (existingUser) {
    user = existingUser;
    isNewUser = false;
  } else {
    // L'utilisateur n'existe pas, créer un nouvel utilisateur
    user = await createUserFromGoogle(profile, email);
    isNewUser = true;
  }

  // Générer un token JWT
  const tokenPayload: {
    userId: string;
    phone?: string;
    email?: string;
    isPremium: boolean;
    role?: string;
  } = {
    userId: user.id,
    isPremium: user.isPremium,
  };

  if (user.email) {
    tokenPayload.email = user.email;
  }
  if (user.phone) {
    tokenPayload.phone = user.phone;
  }
  if (user.role) {
    tokenPayload.role = user.role;
  }

  const token = generateToken(tokenPayload);

  return {
    user,
    token,
    isNewUser,
  };
}

/**
 * Crée un nouvel utilisateur à partir d'un profil Google
 * 
 * @param profile - Profil Google
 * @param email - Email de l'utilisateur
 * @returns Utilisateur créé
 */
async function createUserFromGoogle(profile: GoogleProfile, email: string) {
  // Créer le nouvel utilisateur
  // Note: La vérification d'existence est déjà faite dans authenticateWithGoogle
  const user = await prisma.user.create({
    data: {
      email,
      username: profile.displayName || null,
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

