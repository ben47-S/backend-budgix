/**
 * Service OAuth - Gestion de l'authentification OAuth
 *
 * Ce service gère :
 * - La connexion via Google OAuth
 * - La validation des tokens Google ID
 * - La création/récupération d'utilisateur via OAuth
 * - La génération de token JWT après authentification OAuth
 */

import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import { createUser, getUserByEmail } from "./auth.service.js";
import { generateToken } from "./jwt.service.js";
import { createError } from "../middleware/errorHandler.js";

// Client OAuth2 pour valider les tokens Google
const googleClient = new OAuth2Client();

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
 * Interface pour le payload du token Google ID
 */
export interface GoogleIdTokenPayload {
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  sub: string; // Google user ID
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

/**
 * Valide un token Google ID et authentifie l'utilisateur
 *
 * @param idToken - Token ID Google reçu du frontend
 * @returns Token JWT et informations utilisateur
 */
export async function verifyGoogleIdToken(idToken: string) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    throw createError(
      "Configuration Google OAuth manquante. Veuillez configurer GOOGLE_CLIENT_ID.",
      500,
      "OAUTH_CONFIG_MISSING"
    );
  }

  try {
    // Valider le token avec l'API Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw createError(
        "Token Google invalide",
        401,
        "INVALID_GOOGLE_TOKEN"
      );
    }

    const { email, name, email_verified } = payload;

    if (!email) {
      throw createError(
        "Email non trouvé dans le token Google",
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
      // Créer un nouvel utilisateur
      user = await prisma.user.create({
        data: {
          email,
          username: name || null,
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
  } catch (error: any) {
    // Si c'est déjà une erreur formatée, la propager
    if (error.statusCode) {
      throw error;
    }

    // Erreur de validation du token Google
    console.error("Erreur de validation du token Google:", error.message);
    throw createError(
      "Token Google invalide ou expiré",
      401,
      "INVALID_GOOGLE_TOKEN"
    );
  }
}

