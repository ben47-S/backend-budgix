/**
 * Utilitaires pour le health check
 * 
 * Fournit des fonctions pour vérifier l'état de santé
 * de l'application et de ses dépendances (base de données, etc.)
 */

import { prisma } from "../lib/prisma.js";

/**
 * Interface pour le résultat d'un health check
 */
export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  message: string;
  timestamp: string;
  checks?: {
    database?: {
      status: "ok" | "error";
      message: string;
      responseTime?: number;
    };
  };
}

/**
 * Vérifie la connexion à la base de données
 * 
 * @returns Résultat du check de la base de données
 */
async function checkDatabase(): Promise<{
  status: "ok" | "error";
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    // Exécuter une requête simple pour vérifier la connexion
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: "ok",
      message: "Connexion à la base de données réussie",
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: "error",
      message: `Erreur de connexion à la base de données: ${error.message}`,
      responseTime,
    };
  }
}

/**
 * Effectue un health check complet de l'application
 * 
 * Vérifie :
 * - La connexion à la base de données
 * 
 * @returns Résultat du health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  
  // Vérifier la base de données
  const databaseCheck = await checkDatabase();
  
  // Déterminer le statut global
  const isHealthy = databaseCheck.status === "ok";
  
  return {
    status: isHealthy ? "healthy" : "unhealthy",
    message: isHealthy
      ? "Tous les services sont opérationnels"
      : "Un ou plusieurs services rencontrent des problèmes",
    timestamp,
    checks: {
      database: databaseCheck,
    },
  };
}

/**
 * Health check simple (sans vérification de la base de données)
 * Utile pour des checks rapides sans surcharger la DB
 * 
 * @returns Résultat du health check simple
 */
export function simpleHealthCheck(): HealthCheckResult {
  return {
    status: "healthy",
    message: "Serveur opérationnel",
    timestamp: new Date().toISOString(),
  };
}

