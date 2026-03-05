-- Allow authenticated users to read persisted potential matches
-- for reports they own.
DROP POLICY IF EXISTS "potential_matches_select_own_reports" ON "public"."potential_matches";

CREATE POLICY "potential_matches_select_own_reports"
ON "public"."potential_matches"
FOR SELECT
TO "authenticated"
USING (
  EXISTS (
    SELECT 1
    FROM "public"."lost_item_reports" lr
    WHERE lr.id = "potential_matches"."report_id"
      AND lr.student_id = auth.uid()
  )
);
