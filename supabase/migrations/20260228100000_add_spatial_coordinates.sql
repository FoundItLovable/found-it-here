-- Add latitude/longitude for map display and spatial queries
-- Both nullable for backward compatibility with existing text-only locations

-- Found items: where the item was found
ALTER TABLE "public"."found_items"
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision;

COMMENT ON COLUMN "public"."found_items"."latitude" IS 'Latitude of found location (optional, for map display)';
COMMENT ON COLUMN "public"."found_items"."longitude" IS 'Longitude of found location (optional, for map display)';

-- Lost item reports: where the item was lost
ALTER TABLE "public"."lost_item_reports"
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision;

COMMENT ON COLUMN "public"."lost_item_reports"."latitude" IS 'Latitude of lost location (optional, for map display)';
COMMENT ON COLUMN "public"."lost_item_reports"."longitude" IS 'Longitude of lost location (optional, for map display)';

-- Optional: indexes for bounding box queries (when querying by viewport)
CREATE INDEX IF NOT EXISTS "idx_found_items_coords"
  ON "public"."found_items" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_lost_item_reports_coords"
  ON "public"."lost_item_reports" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
