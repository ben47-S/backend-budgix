import type { Router, Request, Response } from "express"
import { Router as ExpressRouter } from "express"
import { requireAdmin } from "../middleware/auth.js"
import { getLogs, getLogsStats } from "../services/log.service.js"
import type { GetLogsParams } from "../services/log.service.js"
import { LogLevel, LogScope } from "../generated/prisma/client.js"

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

    const params: GetLogsParams = {}

    // Pagination
    if (page) params.page = parseInt(page as string, 10)
    if (limit) params.limit = parseInt(limit as string, 10)

    // Filtres string -> enum pour scopes
    if (scopes) {
      const validScopes: LogScope[] = ["USER", "BUSINESS", "SECURITY", "ADMIN", "SYSTEM"]
      const scopesArray = Array.isArray(scopes) ? scopes : [scopes]
      const filteredScopes = scopesArray.filter((s): s is LogScope =>
        validScopes.includes(s as LogScope)
      )
      if (filteredScopes.length > 0) params.scopes = filteredScopes
    }

    // Filtres string -> enum pour levels
    if (levels) {
      const validLevels: LogLevel[] = ["INFO", "WARN", "ERROR"]
      const levelsArray = Array.isArray(levels) ? levels : [levels]
      const filteredLevels = levelsArray.filter((l): l is LogLevel =>
        validLevels.includes(l as LogLevel)
      )
      if (filteredLevels.length > 0) params.levels = filteredLevels
    }

    // Autres filtres
    if (action) params.action = action as string
    if (dateFrom) params.dateFrom = new Date(dateFrom as string)
    if (dateTo) params.dateTo = new Date(dateTo as string)
    if (actorType) params.actorType = actorType as "USER" | "ADMIN"
    if (searchId) params.searchId = searchId as string

    // Appel du service
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