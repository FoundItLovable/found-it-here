-- Add show_in_public_catalog column to found_items
-- When false: item is hidden from public browse/search but still appears in matching
-- Existing items default to true (visible) for backward compatibility

ALTER TABLE "public"."found_items"
ADD COLUMN IF NOT EXISTS "show_in_public_catalog" boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN "public"."found_items"."show_in_public_catalog" IS 'When true, item appears in public browse/search. When false, hidden from catalog but still included in lost-item matching.';
