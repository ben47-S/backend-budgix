/**
 * Service de gestion des catégories
 * 
 * Ce service gère :
 * - La récupération des catégories (globales + personnalisées)
 * - La création de catégories personnalisées
 * - La validation des catégories
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import type { CategoryType } from "../generated/prisma/client.js";

/**
 * Récupère toutes les catégories disponibles pour un utilisateur
 * Inclut les catégories globales et les catégories personnalisées de l'utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param type - Type de catégorie (INCOME ou EXPENSE), optionnel
 * @returns Liste des catégories
 */
export async function getCategories(userId: string, type?: CategoryType) {
  // Construire la condition de filtrage
  const where: any = {
    OR: [
      { userId: null }, // Catégories globales
      { userId }, // Catégories personnalisées de l'utilisateur
    ],
  };

  // Ajouter le filtre par type si fourni
  if (type) {
    where.type = type;
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [
      { userId: "asc" }, // Catégories globales en premier
      { name: "asc" }, // Puis triées par nom
    ],
    select: {
      id: true,
      name: true,
      type: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return categories;
}

/**
 * Crée une nouvelle catégorie personnalisée pour un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param name - Nom de la catégorie
 * @param type - Type de catégorie (INCOME ou EXPENSE)
 * @returns La catégorie créée
 */
export async function createCategory(
  userId: string,
  name: string,
  type: CategoryType
) {
  // Normaliser le nom (trim et capitaliser la première lettre)
  const normalizedName = name.trim();

  if (!normalizedName || normalizedName.length === 0) {
    throw createError("Le nom de la catégorie ne peut pas être vide", 400, "INVALID_NAME");
  }

  // Vérifier si une catégorie avec le même nom et type existe déjà pour cet utilisateur
  const existingCategory = await prisma.category.findUnique({
    where: {
      userId_name_type: {
        userId,
        name: normalizedName,
        type,
      },
    },
  });

  if (existingCategory) {
    throw createError(
      `Une catégorie "${normalizedName}" de type "${type}" existe déjà`,
      409,
      "CATEGORY_EXISTS"
    );
  }

  // Vérifier si une catégorie globale avec le même nom et type existe
  // Utiliser findFirst car userId peut être null pour les catégories globales
  const existingGlobalCategory = await prisma.category.findFirst({
    where: {
      userId: null, // Catégorie globale
      name: normalizedName,
      type,
    },
  });

  if (existingGlobalCategory) {
    throw createError(
      `Une catégorie globale "${normalizedName}" de type "${type}" existe déjà. Vous ne pouvez pas créer une catégorie personnalisée avec le même nom.`,
      409,
      "GLOBAL_CATEGORY_EXISTS"
    );
  }

  // Créer la catégorie
  const category = await prisma.category.create({
    data: {
      name: normalizedName,
      type,
      userId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return category;
}

/**
 * Récupère une catégorie par son ID
 * Vérifie que la catégorie appartient à l'utilisateur ou est globale
 * 
 * @param categoryId - ID de la catégorie
 * @param userId - ID de l'utilisateur
 * @returns La catégorie trouvée
 */
export async function getCategoryById(categoryId: string, userId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [
        { userId: null }, // Catégorie globale
        { userId }, // Catégorie de l'utilisateur
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!category) {
    throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
  }

  return category;
}

