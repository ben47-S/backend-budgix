/**
 * Middleware d'authentification
 * 
 * Ce middleware vérifie si l'utilisateur est authentifié
 * en vérifiant le token JWT dans le header Authorization.
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "./errorHandler.js";
import { verifyToken, extractTokenFromHeader, shouldRenewToken, generateToken } from "../services/jwt.service.js";
import { prisma } from "../lib/prisma.js";


/**
 * Middleware pour protéger les routes nécessitant une authentification
 * 
 * Renouvelle automatiquement le token si celui-ci est proche de l'expiration
 * (moins de 2 jours restants par défaut, configurable via JWT_RENEWAL_THRESHOLD_DAYS).
 * Le nouveau token est renvoyé dans le header X-New-Token pour que le frontend puisse le mettre à jour.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extraire le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    // Vérifier et décoder le token
    const decoded = verifyToken(token);

    // Ajouter les informations utilisateur à la requête
    req.userId = decoded.userId;

    // Construire l'objet user conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
    req.user = {
      id: decoded.userId,
      isPremium: decoded.isPremium,
    };

    // Ajouter phone, email et role seulement s'ils existent
    if (decoded.phone) {
      req.user.phone = decoded.phone;
    }
    if (decoded.email) {
      req.user.email = decoded.email;
    }
    if (decoded.role) {
      req.user.role = decoded.role;
    }

    // Vérifier si le token doit être renouvelé (proche de l'expiration)
    // On vérifie après la vérification du token pour s'assurer qu'il est valide
    if (shouldRenewToken(token)) {
      // Générer un nouveau token avec les mêmes informations utilisateur
      const newTokenPayload = {
        userId: decoded.userId,
        isPremium: decoded.isPremium,
        ...(decoded.phone && { phone: decoded.phone }),
        ...(decoded.email && { email: decoded.email }),
        ...(decoded.role && { role: decoded.role }),
      };

      const newToken = generateToken(newTokenPayload);

      // Renvoyer le nouveau token dans un header personnalisé
      // Le frontend pourra intercepter ce header et mettre à jour son token stocké
      res.setHeader("X-New-Token", newToken);
    }

    next();
  } catch (error: any) {
    // Si l'erreur est déjà une AppError, la passer directement
    if (error.statusCode) {
      return next(error);
    }
    // Sinon, créer une erreur générique
    return next(createError("Erreur d'authentification", 401, "AUTH_ERROR"));
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est premium
 * Vérifie le statut premium dans la base de données pour garantir
 * que le statut est à jour (même si le JWT contient une ancienne valeur)
 */
export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Vérifier d'abord l'authentification
  if (!req.user) {
    return next(
      createError("Authentification requise", 401, "UNAUTHORIZED")
    );
  }

  try {
    // Vérifier le statut premium dans la base de données
    // (garantit que le statut est à jour même si le JWT est ancien)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isPremium: true }
    });

    if (!user) {
      return next(
        createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND")
      );
    }

    if (!user.isPremium) {
      return next(
        createError(
          "Fonctionnalité premium - Abonnement requis",
          403,
          "PREMIUM_REQUIRED"
        )
      );
    }

    // Mettre à jour req.user.isPremium avec la valeur actuelle de la BD
    req.user.isPremium = true;

    next();
  } catch (error) {
    return next(
      createError("Erreur lors de la vérification du statut premium", 500, "PREMIUM_CHECK_ERROR")
    );
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 * 
 * Ce middleware doit être utilisé après requireAuth pour vérifier
 * que l'utilisateur authentifié a le rôle ADMIN.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Vérifier d'abord l'authentification
  if (!req.user) {
    return next(
      createError("Authentification requise", 401, "UNAUTHORIZED")
    );
  }

  // Vérifier le rôle administrateur
  if (req.user.role !== "ADMIN") {
    return next(
      createError(
        "Accès refusé - Droits administrateur requis",
        403,
        "ADMIN_REQUIRED"
      )
    );
  }

  next();
}

