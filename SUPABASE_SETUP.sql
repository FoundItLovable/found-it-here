-- =============================================================================
-- SUPABASE SCHEMA — Full dump from remote database
-- Last updated: 2026-02-17
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- =============================================================================
-- TYPES
-- =============================================================================

CREATE TYPE "public"."app_role" AS ENUM ('admin', 'user');

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "organization_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "billing_plan" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "organizations_name_not_empty" CHECK (("char_length"("name") > 0))
);

CREATE TABLE IF NOT EXISTS "public"."offices" (
    "office_name" character varying,
    "office_address" character varying,
    "building_name" character varying,
    "office_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    CONSTRAINT "offices_pkey" PRIMARY KEY ("office_id")
);

COMMENT ON TABLE "public"."offices" IS 'contains physical office information';
COMMENT ON COLUMN "public"."offices"."office_name" IS 'Human-readable office name';
COMMENT ON COLUMN "public"."offices"."office_address" IS 'Office mailing address';
COMMENT ON COLUMN "public"."offices"."building_name" IS 'Building name or campus building';
COMMENT ON COLUMN "public"."offices"."office_id" IS 'Primary key (uuid) for office; referenced by profiles.office_id';
COMMENT ON COLUMN "public"."offices"."organization_id" IS 'Foreign key to organizations table (if present); groups offices by organization';

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text",
    "student_id" "text",
    "office_id" "uuid",
    "campus_location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid",
    "role" "text",
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_email_key" UNIQUE ("email"),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'owner'::"text", 'staff'::"text", 'user'::"text"])))
);

COMMENT ON COLUMN "public"."profiles"."id" IS 'Primary key (uuid) for the profile; matches auth.users.id';
COMMENT ON COLUMN "public"."profiles"."email" IS 'User email (denormalized for quick access); canonical source: auth.users.email';
COMMENT ON COLUMN "public"."profiles"."full_name" IS 'User full name / display name';
COMMENT ON COLUMN "public"."profiles"."phone_number" IS 'User phone number; canonical source: auth.users.phone when present';
COMMENT ON COLUMN "public"."profiles"."student_id" IS 'Student identifier (institution-specific)';
COMMENT ON COLUMN "public"."profiles"."office_id" IS 'Foreign key to public.offices(office_id); nullable — null means no office assigned';
COMMENT ON COLUMN "public"."profiles"."campus_location" IS 'Preferred campus location or building';
COMMENT ON COLUMN "public"."profiles"."created_at" IS 'Profile creation timestamp';
COMMENT ON COLUMN "public"."profiles"."updated_at" IS 'Profile last-updated timestamp';
COMMENT ON COLUMN "public"."profiles"."organization_id" IS 'Foreign key to organizations table; groups users by organization';
COMMENT ON COLUMN "public"."profiles"."role" IS 'User role within the organization (e.g., admin, user)';

CREATE TABLE IF NOT EXISTS "public"."found_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "color" "text",
    "brand" "text",
    "found_location" "text" NOT NULL,
    "found_date" "date" NOT NULL,
    "current_location" "text",
    "verification_details" "jsonb",
    "image_urls" "text"[],
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "high_value" boolean DEFAULT false NOT NULL,
    "show_in_public_catalog" boolean DEFAULT true NOT NULL,
    CONSTRAINT "found_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "found_items_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'claimed'::"text", 'returned'::"text"])))
);

COMMENT ON COLUMN "public"."found_items"."high_value" IS 'Labels an item as high value';
COMMENT ON COLUMN "public"."found_items"."show_in_public_catalog" IS 'When true, item appears in public browse/search. When false, hidden from catalog but still included in lost-item matching.';

CREATE TABLE IF NOT EXISTS "public"."lost_item_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "color" "text",
    "brand" "text",
    "lost_location" "text" NOT NULL,
    "lost_date" "date" NOT NULL,
    "verification_details" "jsonb",
    "image_urls" "text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lost_item_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lost_item_reports_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'found'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."claims" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "found_item_id" "uuid" NOT NULL,
    "claimant_id" "uuid" NOT NULL,
    "claim_message" "text" NOT NULL,
    "verification_answers" "text",
    "reviewed_by" "uuid",
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "pickup_scheduled_date" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "claims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "claims_found_item_id_student_id_key" UNIQUE ("found_item_id", "claimant_id"),
    CONSTRAINT "claims_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "related_item_id" "uuid",
    "related_item_type" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Replaces the former offices.item_count cached column.
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

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX "idx_claims_found_item" ON "public"."claims" USING "btree" ("found_item_id");
CREATE INDEX "idx_claims_status" ON "public"."claims" USING "btree" ("review_status");
CREATE INDEX "idx_claims_student" ON "public"."claims" USING "btree" ("claimant_id");
CREATE INDEX "idx_found_items_category" ON "public"."found_items" USING "btree" ("category");
CREATE INDEX "idx_found_items_created_at" ON "public"."found_items" USING "btree" ("created_at" DESC);
CREATE INDEX "idx_found_items_status" ON "public"."found_items" USING "btree" ("status");
CREATE INDEX "idx_lost_reports_status" ON "public"."lost_item_reports" USING "btree" ("status");
CREATE INDEX "idx_lost_reports_student" ON "public"."lost_item_reports" USING "btree" ("student_id");
CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);
CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");
CREATE INDEX "idx_profiles_office_id" ON "public"."profiles" USING "btree" ("office_id");
CREATE INDEX "idx_profiles_organization_id" ON "public"."profiles" USING "btree" ("organization_id");

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "public"."found_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."found_items"
    ADD CONSTRAINT "found_items_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."lost_item_reports"
    ADD CONSTRAINT "lost_item_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."offices"
    ADD CONSTRAINT "offices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("office_id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, organization_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      'user',
      NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid
    );
    RETURN NEW;
  END;
  $$;

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Send a notification to a user
CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid" DEFAULT NULL::"uuid", "p_related_item_type" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, title, message, notification_type, related_item_id, related_item_type
  ) VALUES (
    p_user_id, p_title, p_message, p_notification_type, p_related_item_id, p_related_item_type
  )
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;

-- Notify claimant when their claim is reviewed
CREATE OR REPLACE FUNCTION "public"."notify_claim_reviewed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'rejected')) THEN
    PERFORM create_notification(
      NEW.student_id,
      CASE
        WHEN NEW.review_status = 'approved' THEN 'Claim Approved!'
        ELSE 'Claim Update'
      END,
      CASE
        WHEN NEW.review_status = 'approved' THEN 'Your claim has been approved! Please schedule a pickup.'
        ELSE 'Your claim was not approved. ' || COALESCE(NEW.review_notes, '')
      END,
      'claim_' || NEW.review_status,
      NEW.id,
      'claim'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Find best matching found item for a lost item report
CREATE OR REPLACE FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") RETURNS TABLE("id" "uuid", "category" "text", "color" "text", "brand" "text", "found_location" "text", "found_date" "date", "current_location" "text", "match_score" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.id, fi.category, fi.color, fi.brand,
    fi.found_location, fi.found_date, fi.current_location,
    (
      CASE WHEN LOWER(fi.category) = LOWER(p_category) THEN 3 ELSE 0 END +
      CASE WHEN LOWER(fi.color) = LOWER(p_color) AND p_color IS NOT NULL THEN 2 ELSE 0 END +
      CASE WHEN LOWER(fi.brand) = LOWER(p_brand) AND p_brand IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN LOWER(fi.found_location) = LOWER(p_lost_location) THEN 3 ELSE 0 END +
      CASE WHEN fi.found_date >= p_lost_date AND fi.found_date <= p_lost_date + INTERVAL '7 days' THEN 1 ELSE 0 END
    ) AS match_score
  FROM public.found_items fi
  WHERE fi.status = 'available'
  ORDER BY match_score DESC
  LIMIT 1;
END;
$$;

-- Full-text search across found items
CREATE OR REPLACE FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."found_items"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM found_items
  WHERE status = 'available'
    AND (search_category IS NULL OR category = search_category)
    AND (
      item_name ILIKE '%' || search_query || '%'
      OR description ILIKE '%' || search_query || '%'
      OR brand ILIKE '%' || search_query || '%'
      OR color ILIKE '%' || search_query || '%'
    )
  ORDER BY created_at DESC;
END;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-create profile on user signup
-- NOTE: This trigger is on auth.users, created via Supabase dashboard:
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE TRIGGER "update_claims_updated_at" BEFORE UPDATE ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_found_items_updated_at" BEFORE UPDATE ON "public"."found_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_lost_reports_updated_at" BEFORE UPDATE ON "public"."lost_item_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Notify user when claim is reviewed
CREATE OR REPLACE TRIGGER "on_claim_reviewed" AFTER UPDATE ON "public"."claims" FOR EACH ROW WHEN (("old"."review_status" IS DISTINCT FROM "new"."review_status")) EXECUTE FUNCTION "public"."notify_claim_reviewed"();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE "public"."found_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lost_item_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Found Items policies
CREATE POLICY "found_items_select_all" ON "public"."found_items" FOR SELECT USING (true);
CREATE POLICY "Anyone can view available found items" ON "public"."found_items" FOR SELECT USING ((("status" = 'available'::"text") OR ("auth"."uid"() = "staff_id")));
CREATE POLICY "found_items_insert_safe" ON "public"."found_items" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "staff_id"));
CREATE POLICY "Staff can update own found items" ON "public"."found_items" FOR UPDATE USING (("auth"."uid"() = "staff_id"));
CREATE POLICY "found_items_update_staff" ON "public"."found_items" FOR UPDATE USING ((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))));
CREATE POLICY "found_items_delete_staff" ON "public"."found_items" FOR DELETE USING ((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))));

-- Claims policies
CREATE POLICY "Users can create claims" ON "public"."claims" FOR INSERT WITH CHECK (("auth"."uid"() = "claimant_id"));
CREATE POLICY "claims_insert_student" ON "public"."claims" FOR INSERT WITH CHECK (("auth"."uid"() = "claimant_id"));
CREATE POLICY "Users can view own claims" ON "public"."claims" FOR SELECT USING (("auth"."uid"() = "claimant_id"));
CREATE POLICY "claims_select_own_student" ON "public"."claims" FOR SELECT USING (("auth"."uid"() = "claimant_id"));
CREATE POLICY "claims_select_safe" ON "public"."claims" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "claimant_id") OR ("auth"."uid"() IN ( SELECT "found_items"."staff_id" FROM "public"."found_items" WHERE ("found_items"."id" = "claims"."found_item_id")))));
CREATE POLICY "Staff can view claims for their items" ON "public"."claims" FOR SELECT USING ((EXISTS ( SELECT 1 FROM "public"."found_items" WHERE (("found_items"."id" = "claims"."found_item_id") AND ("found_items"."staff_id" = "auth"."uid"())))));
CREATE POLICY "Staff can update claims for their items" ON "public"."claims" FOR UPDATE USING ((EXISTS ( SELECT 1 FROM "public"."found_items" WHERE (("found_items"."id" = "claims"."found_item_id") AND ("found_items"."staff_id" = "auth"."uid"())))));
CREATE POLICY "claims_update_safe" ON "public"."claims" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "found_items"."staff_id" FROM "public"."found_items" WHERE ("found_items"."id" = "claims"."found_item_id"))));
CREATE POLICY "claims_update_own_pending" ON "public"."claims" FOR UPDATE USING ((("auth"."uid"() = "claimant_id") AND ("review_status" = 'pending'::"text")));
CREATE POLICY "claims_delete_own_pending" ON "public"."claims" FOR DELETE USING ((("auth"."uid"() = "claimant_id") AND ("review_status" = 'pending'::"text")));

-- Lost Item Reports policies
CREATE POLICY "Users can create lost reports" ON "public"."lost_item_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));
CREATE POLICY "Users can insert their own reports" ON "public"."lost_item_reports" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = "auth"."uid"()));
CREATE POLICY "Users can read their own reports" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING (("student_id" = "auth"."uid"()));
CREATE POLICY "Users can view own lost reports" ON "public"."lost_item_reports" FOR SELECT USING (("auth"."uid"() = "student_id"));
CREATE POLICY "lost_reports_select_own_safe" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "student_id"));
CREATE POLICY "Users can update own lost reports" ON "public"."lost_item_reports" FOR UPDATE USING (("auth"."uid"() = "student_id"));
CREATE POLICY "lost_reports_update_own" ON "public"."lost_item_reports" FOR UPDATE USING (("auth"."uid"() = "student_id"));
CREATE POLICY "Users can delete own lost reports" ON "public"."lost_item_reports" FOR DELETE USING (("auth"."uid"() = "student_id"));
CREATE POLICY "lost_reports_delete_own" ON "public"."lost_item_reports" FOR DELETE USING (("auth"."uid"() = "student_id"));
CREATE POLICY "lost_reports_insert_own" ON "public"."lost_item_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));

-- Staff/admin/owner can view all lost reports (needed for metrics & matching)
CREATE POLICY "staff_select_all_lost_reports" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'owner'::"text"]))))));

-- Notifications policies
CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "notifications_insert_authenticated" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
CREATE POLICY "Service role can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
CREATE POLICY "profiles_select_own_safe" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));
CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

-- Offices policies
CREATE POLICY "offices_select_all" ON "public"."offices" FOR SELECT USING (true);
CREATE POLICY "Authenticated users can view offices" ON "public"."offices" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins can modify offices" ON "public"."offices" USING ((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));
CREATE POLICY "offices_insert_admin" ON "public"."offices" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));
CREATE POLICY "offices_update_same_office" ON "public"."offices" FOR UPDATE USING ((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text") AND ("profiles"."office_id" = "offices"."office_id")))));
CREATE POLICY "offices_delete_same_office" ON "public"."offices" FOR DELETE USING (((EXISTS ( SELECT 1 FROM "public"."profiles" WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text") AND ("profiles"."office_id" = "offices"."office_id")))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));

-- Organizations policies
CREATE POLICY "users read only own org" ON "public"."organizations" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id" FROM "public"."profiles" WHERE ("profiles"."organization_id" = "organizations"."organization_id"))));
CREATE POLICY "organizations_select_all_for_signup" ON "public"."organizations" FOR SELECT USING (true);

-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."claims";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."found_items";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."lost_item_reports";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON TABLE "public"."found_items" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."claims" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."lost_item_reports" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."notifications" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."offices" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."organizations" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."office_item_counts" TO "anon", "authenticated", "service_role";

GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid", "p_related_item_type" "text") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."notify_claim_reviewed"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";
