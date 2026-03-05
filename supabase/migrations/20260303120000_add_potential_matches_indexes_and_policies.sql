-- Persisted potential matches hardening:
-- - dedupe by (report_id, lost_item_id)
-- - lookup indexes
-- - org-scoped staff/admin/owner RLS for select/insert

CREATE UNIQUE INDEX IF NOT EXISTS "idx_potential_matches_report_lost_unique"
ON "public"."potential_matches" ("report_id", "lost_item_id");

CREATE INDEX IF NOT EXISTS "idx_potential_matches_report_id"
ON "public"."potential_matches" ("report_id");

CREATE INDEX IF NOT EXISTS "idx_potential_matches_lost_item_id"
ON "public"."potential_matches" ("lost_item_id");

ALTER TABLE "public"."potential_matches" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "potential_matches_select_staff_org" ON "public"."potential_matches";
CREATE POLICY "potential_matches_select_staff_org"
ON "public"."potential_matches"
FOR SELECT
TO "authenticated"
USING (
  EXISTS (
    SELECT 1
    FROM "public"."profiles" me
    JOIN "public"."found_items" fi
      ON fi.id = "potential_matches"."lost_item_id"
    JOIN "public"."offices" o
      ON o.office_id = fi.office_id
    WHERE me.id = auth.uid()
      AND me.role = ANY (ARRAY['staff'::text, 'admin'::text, 'owner'::text])
      AND me.organization_id IS NOT NULL
      AND o.organization_id = me.organization_id
  )
);

DROP POLICY IF EXISTS "potential_matches_insert_staff_org" ON "public"."potential_matches";
CREATE POLICY "potential_matches_insert_staff_org"
ON "public"."potential_matches"
FOR INSERT
TO "authenticated"
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."profiles" me
    JOIN "public"."found_items" fi
      ON fi.id = "potential_matches"."lost_item_id"
    JOIN "public"."offices" o
      ON o.office_id = fi.office_id
    WHERE me.id = auth.uid()
      AND me.role = ANY (ARRAY['staff'::text, 'admin'::text, 'owner'::text])
      AND me.organization_id IS NOT NULL
      AND o.organization_id = me.organization_id
  )
);
