-- 報價單草稿：每個專案一份。只新增一張表，不動任何既有資料。
CREATE TABLE IF NOT EXISTS "project_quote_draft" (
    "projectId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_quote_draft_pkey" PRIMARY KEY ("projectId"),
    CONSTRAINT "project_quote_draft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
