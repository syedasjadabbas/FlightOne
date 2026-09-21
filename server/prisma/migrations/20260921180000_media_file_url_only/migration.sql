-- Group photos: store public/local file URL only (drop opaque storageKey + hash).
ALTER TABLE "GroupPhoto" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;

UPDATE "GroupPhoto"
SET "fileUrl" = CASE
  WHEN "storageKey" LIKE 'http%' THEN "storageKey"
  WHEN "storageKey" LIKE 'local://%' THEN "storageKey"
  ELSE 'local://' || "storageKey"
END
WHERE ("fileUrl" IS NULL OR "fileUrl" = '')
  AND "storageKey" IS NOT NULL
  AND "storageKey" <> '';

-- Safety for empty galleries / unexpected nulls before NOT NULL.
UPDATE "GroupPhoto"
SET "fileUrl" = 'local://missing/' || "id"
WHERE "fileUrl" IS NULL OR "fileUrl" = '';

ALTER TABLE "GroupPhoto" ALTER COLUMN "fileUrl" SET NOT NULL;

ALTER TABLE "GroupPhoto" DROP COLUMN IF EXISTS "storageKey";
ALTER TABLE "GroupPhoto" DROP COLUMN IF EXISTS "contentSha256";
