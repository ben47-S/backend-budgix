import type { Router, Request, Response } from "express"
import { Router as ExpressRouter } from "express"
import { requireAdmin } from "../middleware/auth"
import { getLogs, getLogsStats } from "../services/log.service"
import { LogLevel, LogScope } from "../../generated/prisma/client"

const router: Router = ExpressRouter()

/**
 * GET /api/admin/logs
 * Récupère les logs systèmes avec filtres et pagination
 * Accessible uniquement aux administrateurs
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      scopes,
      levels,
      action,
      dateFrom,
      dateTo,
      actorType,
      searchId,
    } = req.query

    // Parser les paramètres
    const params = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
      scopes: scopes
        ? Array.isArray(scopes)
          ? (scopes as string[])
          : ([scopes] as string[])
        : undefined,
      levels: levels
        ? Array.isArray(levels)
          ? (levels as string[])
          : ([levels] as string[])
        : undefined,
      action: action as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      actorType: actorType as "USER" | "ADMIN" | undefined,
      searchId: searchId as string | undefined,
    }

    // Valider les enums
    if (params.scopes) {
      const validScopes: LogScope[] = ["USER", "BUSINESS", "SECURITY", "ADMIN", "SYSTEM"]
      params.scopes = params.scopes.filter((s): s is LogScope =>
        validScopes.includes(s as LogScope)
      )
    }

    if (params.levels) {
      const validLevels: LogLevel[] = ["INFO", "WARN", "ERROR"]
      params.levels = params.levels.filter((l): l is LogLevel =>
        validLevels.includes(l as LogLevel)
      )
    }

    const result = await getLogs(params)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("[Admin Logs] Error fetching logs:", error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des logs",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * GET /api/admin/logs/stats
 * Récupère les statistiques des logs
 * Accessible uniquement aux administrateurs
 */
router.get("/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getLogsStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error("[Admin Logs] Error fetching log stats:", error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

export default router
