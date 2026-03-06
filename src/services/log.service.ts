import { prisma } from "../lib/prisma"
import { LogLevel, LogScope } from "../generated/prisma/client"

/**
 * Tronque un ID pour n'afficher que les 8 premiers caractères
 */
function truncateId(id: string | null): string | null {
  if (!id) return null
  if (id.length <= 8) return id
  return id.substring(0, 8) + "..."
}

/**
 * Tronque les métadonnées pour limiter leur taille
 */
function truncateMetadata(metadata: unknown): Record<string, any> | null {
  if (!metadata) return null;

  if (typeof metadata === "string") {
    return { message: metadata }; // transforme string en objet
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return { value: metadata }; // transforme tout autre type en objet
  }

  const truncated: Record<string, any> = {};
  const entries = Object.entries(metadata as Record<string, any>).slice(0, 3);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > 20) {
      truncated[key] = value.substring(0, 20) + "...";
    } else if (Array.isArray(value)) {
      truncated[key] = `[${value.length} items]`;
    } else if (typeof value === "object" && value !== null) {
      truncated[key] = "{...}";
    } else {
      truncated[key] = value;
    }
  }

  return truncated;
}

export interface LogEventParams {
  level?: LogLevel
  scope?: LogScope
  action: string
  userId?: string
  adminId?: string
  targetId?: string
  metadata?: Record<string, any>
  ip?: string
  userAgent?: string
}

export interface GetLogsParams {
  page?: number
  limit?: number
  scopes?: LogScope[]
  levels?: LogLevel[]
  action?: string
  dateFrom?: Date
  dateTo?: Date
  actorType?: "USER" | "ADMIN"
  searchId?: string
}

/**
 * Enregistre un événement dans les logs système
 * Fire-and-forget : ne bloque pas l'exécution principale
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    // En développement, on log aussi dans la console
    if (process.env.NODE_ENV === "development") {
      console.log("[LOG EVENT]", {
        level: params.level || "INFO",
        scope: params.scope || "USER",
        action: params.action,
        userId: params.userId,
        adminId: params.adminId,
        targetId: params.targetId,
      })
    }

    // Créer le log en base de données (non-bloquant)
    prisma.log
      .create({
        data: {
          level: params.level || "INFO",
          scope: params.scope || "USER",
          action: params.action,
          userId: params.userId || null,
          adminId: params.adminId || null,
          targetId: params.targetId || null,
          ...(params.metadata && { metadata: params.metadata }),
          ip: params.ip || null,
          userAgent: params.userAgent || null,
        },
      })
      .catch((error) => {
        // En cas d'erreur, on log dans la console mais on ne bloque pas
        console.error("[LOG ERROR] Failed to save log event:", error)
      })
  } catch (error) {
    // Ne jamais faire échouer l'opération principale à cause d'un log
    console.error("[LOG ERROR] Unexpected error in logEvent:", error)
  }
}

/**
 * Récupère les logs avec filtres et pagination
 */
export async function getLogs(params: GetLogsParams) {
  const {
    page = 1,
    limit = 25,
    scopes,
    levels,
    action,
    dateFrom,
    dateTo,
    actorType,
    searchId,
  } = params

  const skip = (page - 1) * limit

  // Construire les filtres
  const where: any = {}

  if (scopes && scopes.length > 0) {
    where.scope = { in: scopes }
  }

  if (levels && levels.length > 0) {
    where.level = { in: levels }
  }

  if (action) {
    where.action = { contains: action, mode: "insensitive" }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) {
      where.createdAt.gte = dateFrom
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo.setHours(23, 59, 59, 999))
    }
  }

  if (actorType) {
    if (actorType === "USER") {
      where.userId = { not: null }
    } else if (actorType === "ADMIN") {
      where.adminId = { not: null }
    }
  }

  if (searchId) {
    where.OR = [
      { userId: { contains: searchId, mode: "insensitive" } },
      { adminId: { contains: searchId, mode: "insensitive" } },
      { targetId: { contains: searchId, mode: "insensitive" } },
    ]
  }

  // Exécuter la requête avec pagination
  const [logsRaw, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.log.count({ where }),
  ])

  // Tronquer les données sensibles et convertir les dates en ISO 8601
  const logs = logsRaw.map((log) => ({
    ...log,
    userId: truncateId(log.userId),
    adminId: truncateId(log.adminId),
    targetId: truncateId(log.targetId),
    metadata: truncateMetadata(log.metadata),
    createdAt: log.createdAt.toISOString(), // Format ISO 8601
  }))

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Récupère les statistiques des logs
 */
export async function getLogsStats() {
  const [total, byLevel, byScope, recentErrors] = await Promise.all([
    prisma.log.count(),
    prisma.log.groupBy({
      by: ["level"],
      _count: { level: true },
    }),
    prisma.log.groupBy({
      by: ["scope"],
      _count: { scope: true },
    }),
    prisma.log.findMany({
      where: { level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
      },
    }),
  ])

  return {
    total,
    byLevel: byLevel.reduce((acc, curr) => {
      acc[curr.level] = curr._count.level
      return acc
    }, {} as Record<LogLevel, number>),
    byScope: byScope.reduce((acc, curr) => {
      acc[curr.scope] = curr._count.scope
      return acc
    }, {} as Record<LogScope, number>),
    recentErrors,
  }
}
