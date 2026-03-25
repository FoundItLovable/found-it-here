-- Schema cleanup migration
-- Removes redundant data storage per SCHEMA_CHANGES.txt

-- ============================================================
-- 1. Remove user_roles table (roles stored in profiles.role)
-- ============================================================

-- Drop policies first (avoids dependency errors)
DROP POLICY IF EXISTS "Admins can view all roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Users can view their own roles" ON "public"."user_roles";

-- Drop the table (cascades constraints/indexes)
DROP TABLE IF EXISTS "public"."user_roles" CASCADE;

-- Drop functions that only existed to serve user_roles
DROP FUNCTION IF EXISTS "public"."create_user_role"("uuid", "public"."app_role");
DROP FUNCTION IF EXISTS "public"."has_role"("uuid", "public"."app_role");

-- ============================================================
-- 2. Remove offices.staff_id (relationship tracked via profiles.office_id)
-- ============================================================

ALTER TABLE "public"."offices"
    DROP CONSTRAINT IF EXISTS "offices_staff_id_key",
    DROP CONSTRAINT IF EXISTS "offices_staff_id_fkey",
    DROP COLUMN IF EXISTS "staff_id";

-- ============================================================
-- 3. Remove offices.item_count and replace with a view
-- ============================================================

-- Drop triggers that maintained the cached count
DROP TRIGGER IF EXISTS "update_office_count_on_delete" ON "public"."found_items";
DROP TRIGGER IF EXISTS "update_office_count_on_insert" ON "public"."found_items";
DROP TRIGGER IF EXISTS "update_office_count_on_update" ON "public"."found_items";

-- Drop the function those triggers called
DROP FUNCTION IF EXISTS "public"."update_office_item_count"();

-- Drop the now-unnecessary cached column
ALTER TABLE "public"."offices"
    DROP COLUMN IF EXISTS "item_count";

-- Create view that computes counts dynamically
-- Usage: SELECT * FROM office_item_counts WHERE office_id = ?
CREATE OR REPLACE VIEW "public"."office_item_counts" AS
SELECT
    o.office_id,
    COUNT(CASE WHEN fi.status = 'available' THEN 1 END) AS available_item_count,
    COUNT(fi.id) AS total_item_count
FROM "public"."offices" o
LEFT JOIN "public"."profiles" p ON p.office_id = o.office_id
LEFT JOIN "public"."found_items" fi ON fi.staff_id = p.id
GROUP BY o.office_id;
