-- Supprimer la colonne improvementSuggestion de la table Review
ALTER TABLE "Review" DROP COLUMN IF EXISTS "improvementSuggestion";

-- CreateTable pour les suggestions d'amélioration
CREATE TABLE "ImprovementSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprovementSuggestion_userId_idx" ON "ImprovementSuggestion"("userId");

-- CreateIndex
CREATE INDEX "ImprovementSuggestion_createdAt_idx" ON "ImprovementSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "ImprovementSuggestion_userId_createdAt_idx" ON "ImprovementSuggestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImprovementSuggestion" ADD CONSTRAINT "ImprovementSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

