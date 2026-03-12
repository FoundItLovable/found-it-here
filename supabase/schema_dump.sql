


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_reunited_items"() RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::bigint FROM found_items WHERE status = 'returned';
$$;


ALTER FUNCTION "public"."count_reunited_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid" DEFAULT NULL::"uuid", "p_related_item_type" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    notification_type,
    related_item_id,
    related_item_type
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_notification_type,
    p_related_item_id,
    p_related_item_type
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid", "p_related_item_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") RETURNS TABLE("id" "uuid", "category" "text", "color" "text", "brand" "text", "found_location" "text", "found_date" "date", "current_location" "text", "match_score" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fi.id,
    fi.category,
    fi.color,
    fi.brand,
    fi.found_location,
    fi.found_date,
    fi.current_location,
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


ALTER FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "latitude" double precision,
    "longitude" double precision,
    CONSTRAINT "lost_item_reports_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'found'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."lost_item_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lost_item_reports"."latitude" IS 'Latitude of lost location (optional, for map display)';



COMMENT ON COLUMN "public"."lost_item_reports"."longitude" IS 'Longitude of lost location (optional, for map display)';



CREATE OR REPLACE FUNCTION "public"."get_org_lost_reports"() RETURNS SETOF "public"."lost_item_reports"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select r.*
  from public.lost_item_reports r
  join public.profiles reporter on reporter.id = r.student_id
  join public.profiles me on me.id = auth.uid()
  where me.role = any (array['staff'::text,'admin'::text,'owner'::text])
    and reporter.organization_id = me.organization_id;
$$;


ALTER FUNCTION "public"."get_org_lost_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      'user'
    );
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_claim_reviewed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'rejected')) THEN
    PERFORM create_notification(
      NEW.claimant_id,
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


ALTER FUNCTION "public"."notify_claim_reviewed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid" DEFAULT NULL::"uuid", "p_found_item_id" "uuid" DEFAULT NULL::"uuid", "p_status" "text" DEFAULT 'sent'::"text", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO email_alerts (
    user_id,
    alert_type,
    email_address,
    subject,
    report_id,
    found_item_id,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_alert_type,
    p_email,
    p_subject,
    p_report_id,
    p_found_item_id,
    p_status,
    p_error_message
  )
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$;


ALTER FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid", "p_found_item_id" "uuid", "p_status" "text", "p_error_message" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."found_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "office_id" "uuid" NOT NULL,
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
    "latitude" double precision,
    "longitude" double precision,
    CONSTRAINT "found_items_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'claimed'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."found_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."found_items"."high_value" IS 'Labels an item as high value';



COMMENT ON COLUMN "public"."found_items"."latitude" IS 'Latitude of found location (optional, for map display)';



COMMENT ON COLUMN "public"."found_items"."longitude" IS 'Longitude of found location (optional, for map display)';



CREATE OR REPLACE FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."found_items"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM found_items
  WHERE status = 'available'
    AND (
      search_category IS NULL 
      OR category = search_category
    )
    AND (
      item_name ILIKE '%' || search_query || '%'
      OR description ILIKE '%' || search_query || '%'
      OR brand ILIKE '%' || search_query || '%'
      OR color ILIKE '%' || search_query || '%'
    )
  ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


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
    CONSTRAINT "claims_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_alerts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "found_item_id" "uuid",
    "alert_type" "text" NOT NULL,
    "email_sent_at" timestamp with time zone DEFAULT "now"(),
    "email_address" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_alerts" IS 'Tracks email alerts sent to users for lost items and potential matches';



COMMENT ON COLUMN "public"."email_alerts"."alert_type" IS 'Type of alert: lost_item_submitted, match_found';



COMMENT ON COLUMN "public"."email_alerts"."status" IS 'Email delivery status: sent, failed, bounced';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "related_item_id" "uuid",
    "related_item_type" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offices" (
    "office_name" character varying,
    "office_address" character varying,
    "building_name" character varying,
    "office_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "lat" double precision,
    "lng" double precision
);


ALTER TABLE "public"."offices" OWNER TO "postgres";


COMMENT ON TABLE "public"."offices" IS 'contains physical office information';



COMMENT ON COLUMN "public"."offices"."office_name" IS 'Human-readable office name';



COMMENT ON COLUMN "public"."offices"."office_address" IS 'Office mailing address';



COMMENT ON COLUMN "public"."offices"."building_name" IS 'Building name or campus building';



COMMENT ON COLUMN "public"."offices"."office_id" IS 'Primary key (uuid) for office; referenced by profiles.office_id';



COMMENT ON COLUMN "public"."offices"."organization_id" IS 'Foreign key to organizations table (if present); groups offices by organization';



COMMENT ON COLUMN "public"."offices"."lat" IS 'Latitude for map display';



COMMENT ON COLUMN "public"."offices"."lng" IS 'Longitude for map display';



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
    "email_notifications_enabled" boolean DEFAULT true,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'owner'::"text", 'staff'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


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



CREATE OR REPLACE VIEW "public"."office_item_counts" WITH ("security_invoker"='on') AS
 SELECT "o"."office_id",
    "count"(
        CASE
            WHEN ("fi"."status" = 'available'::"text") THEN 1
            ELSE NULL::integer
        END) AS "available_item_count",
    "count"("fi"."id") AS "total_item_count"
   FROM (("public"."offices" "o"
     LEFT JOIN "public"."profiles" "p" ON (("p"."office_id" = "o"."office_id")))
     LEFT JOIN "public"."found_items" "fi" ON (("fi"."office_id" = "p"."id")))
  GROUP BY "o"."office_id";


ALTER VIEW "public"."office_item_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "organization_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "billing_plan" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organizations_name_not_empty" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."potential_matches" (
    "report_id" "uuid" NOT NULL,
    "lost_item_id" "uuid" NOT NULL,
    "match_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "score" real
);


ALTER TABLE "public"."potential_matches" OWNER TO "postgres";


ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_found_item_id_student_id_key" UNIQUE ("found_item_id", "claimant_id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."found_items"
    ADD CONSTRAINT "found_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lost_item_reports"
    ADD CONSTRAINT "lost_item_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offices"
    ADD CONSTRAINT "offices_pkey" PRIMARY KEY ("office_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."potential_matches"
    ADD CONSTRAINT "potential_matches_pkey" PRIMARY KEY ("match_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_claims_found_item" ON "public"."claims" USING "btree" ("found_item_id");



CREATE INDEX "idx_claims_status" ON "public"."claims" USING "btree" ("review_status");



CREATE INDEX "idx_claims_student" ON "public"."claims" USING "btree" ("claimant_id");



CREATE INDEX "idx_email_alerts_created" ON "public"."email_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_email_alerts_found_item" ON "public"."email_alerts" USING "btree" ("found_item_id");



CREATE INDEX "idx_email_alerts_report" ON "public"."email_alerts" USING "btree" ("report_id");



CREATE INDEX "idx_email_alerts_status" ON "public"."email_alerts" USING "btree" ("status");



CREATE INDEX "idx_email_alerts_type" ON "public"."email_alerts" USING "btree" ("alert_type");



CREATE INDEX "idx_email_alerts_user" ON "public"."email_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_found_items_category" ON "public"."found_items" USING "btree" ("category");



CREATE INDEX "idx_found_items_coords" ON "public"."found_items" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_found_items_created_at" ON "public"."found_items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_found_items_status" ON "public"."found_items" USING "btree" ("status");



CREATE INDEX "idx_lost_item_reports_coords" ON "public"."lost_item_reports" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_lost_reports_status" ON "public"."lost_item_reports" USING "btree" ("status");



CREATE INDEX "idx_lost_reports_student" ON "public"."lost_item_reports" USING "btree" ("student_id");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_potential_matches_lost_item_id" ON "public"."potential_matches" USING "btree" ("lost_item_id");



CREATE INDEX "idx_potential_matches_report_id" ON "public"."potential_matches" USING "btree" ("report_id");



CREATE UNIQUE INDEX "idx_potential_matches_report_lost_unique" ON "public"."potential_matches" USING "btree" ("report_id", "lost_item_id");



CREATE INDEX "idx_profiles_office_id" ON "public"."profiles" USING "btree" ("office_id");



CREATE INDEX "idx_profiles_organization_id" ON "public"."profiles" USING "btree" ("organization_id");



CREATE OR REPLACE TRIGGER "on_claim_reviewed" AFTER UPDATE ON "public"."claims" FOR EACH ROW WHEN (("old"."review_status" IS DISTINCT FROM "new"."review_status")) EXECUTE FUNCTION "public"."notify_claim_reviewed"();



CREATE OR REPLACE TRIGGER "update_claims_updated_at" BEFORE UPDATE ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_found_items_updated_at" BEFORE UPDATE ON "public"."found_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lost_reports_updated_at" BEFORE UPDATE ON "public"."lost_item_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "public"."found_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "public"."found_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."lost_item_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."found_items"
    ADD CONSTRAINT "found_items_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("office_id");



ALTER TABLE ONLY "public"."lost_item_reports"
    ADD CONSTRAINT "lost_item_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offices"
    ADD CONSTRAINT "offices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."potential_matches"
    ADD CONSTRAINT "potential_matches_lost_item_id_fkey" FOREIGN KEY ("lost_item_id") REFERENCES "public"."found_items"("id");



ALTER TABLE ONLY "public"."potential_matches"
    ADD CONSTRAINT "potential_matches_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."lost_item_reports"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("office_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL;



CREATE POLICY "Admins can modify offices" ON "public"."offices" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Anyone can view available found items" ON "public"."found_items" FOR SELECT USING ((("status" = 'available'::"text") OR ("auth"."uid"() = "office_id")));



CREATE POLICY "Authenticated users can view offices" ON "public"."offices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Staff can update claims for their items" ON "public"."claims" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."found_items"
  WHERE (("found_items"."id" = "claims"."found_item_id") AND ("found_items"."office_id" = "auth"."uid"())))));



CREATE POLICY "Staff can update own found items" ON "public"."found_items" FOR UPDATE USING (("auth"."uid"() = "office_id"));



CREATE POLICY "Staff can view claims for their items" ON "public"."claims" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."found_items"
  WHERE (("found_items"."id" = "claims"."found_item_id") AND ("found_items"."office_id" = "auth"."uid"())))));



CREATE POLICY "Users can create claims" ON "public"."claims" FOR INSERT WITH CHECK (("auth"."uid"() = "claimant_id"));



CREATE POLICY "Users can create lost reports" ON "public"."lost_item_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can delete own lost reports" ON "public"."lost_item_reports" FOR DELETE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can insert their own reports" ON "public"."lost_item_reports" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own reports" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Users can update own lost reports" ON "public"."lost_item_reports" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own claims" ON "public"."claims" FOR SELECT USING (("auth"."uid"() = "claimant_id"));



CREATE POLICY "Users can view own lost reports" ON "public"."lost_item_reports" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "claims_delete_own_pending" ON "public"."claims" FOR DELETE USING ((("auth"."uid"() = "claimant_id") AND ("review_status" = 'pending'::"text")));



CREATE POLICY "claims_insert_student" ON "public"."claims" FOR INSERT WITH CHECK (("auth"."uid"() = "claimant_id"));



CREATE POLICY "claims_select_own_student" ON "public"."claims" FOR SELECT USING (("auth"."uid"() = "claimant_id"));



CREATE POLICY "claims_select_safe" ON "public"."claims" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "claimant_id") OR ("auth"."uid"() IN ( SELECT "found_items"."office_id" AS "staff_id"
   FROM "public"."found_items"
  WHERE ("found_items"."id" = "claims"."found_item_id")))));



CREATE POLICY "claims_update_own_pending" ON "public"."claims" FOR UPDATE USING ((("auth"."uid"() = "claimant_id") AND ("review_status" = 'pending'::"text")));



CREATE POLICY "claims_update_safe" ON "public"."claims" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "found_items"."office_id" AS "staff_id"
   FROM "public"."found_items"
  WHERE ("found_items"."id" = "claims"."found_item_id"))));



ALTER TABLE "public"."email_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."found_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "found_items_delete_staff" ON "public"."found_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))));



CREATE POLICY "found_items_insert_safe" ON "public"."found_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'owner'::"text"])) AND ("p"."office_id" = "found_items"."office_id")))));



CREATE POLICY "found_items_select_all" ON "public"."found_items" FOR SELECT USING (true);



CREATE POLICY "found_items_update_staff" ON "public"."found_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))));



ALTER TABLE "public"."lost_item_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lost_reports_delete_own" ON "public"."lost_item_reports" FOR DELETE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "lost_reports_insert_own" ON "public"."lost_item_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "lost_reports_select_own_safe" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "lost_reports_update_own" ON "public"."lost_item_reports" FOR UPDATE USING (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_insert_authenticated" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."offices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offices_delete_same_office" ON "public"."offices" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text") AND ("profiles"."office_id" = "offices"."office_id")))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "offices_insert_admin" ON "public"."offices" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text")))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "offices_select_all" ON "public"."offices" FOR SELECT USING (true);



CREATE POLICY "offices_update_same_office" ON "public"."offices" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'staff'::"text") AND ("profiles"."office_id" = "offices"."office_id")))));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_all_for_signup" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "pm_delete_user_own" ON "public"."potential_matches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lost_item_reports" "r"
  WHERE (("r"."id" = "potential_matches"."report_id") AND ("r"."student_id" = "auth"."uid"())))));



CREATE POLICY "pm_insert_user_own" ON "public"."potential_matches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lost_item_reports" "r"
  WHERE (("r"."id" = "potential_matches"."report_id") AND ("r"."student_id" = "auth"."uid"())))));



CREATE POLICY "pm_select_user_own" ON "public"."potential_matches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lost_item_reports" "r"
  WHERE (("r"."id" = "potential_matches"."report_id") AND ("r"."student_id" = "auth"."uid"())))));



ALTER TABLE "public"."potential_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "potential_matches_delete_own_reports" ON "public"."potential_matches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lost_item_reports" "lr"
  WHERE (("lr"."id" = "potential_matches"."report_id") AND ("lr"."student_id" = "auth"."uid"())))));



CREATE POLICY "potential_matches_insert_staff_org" ON "public"."potential_matches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "me"
     JOIN "public"."found_items" "fi" ON (("fi"."id" = "potential_matches"."lost_item_id")))
     JOIN "public"."offices" "o" ON (("o"."office_id" = "fi"."office_id")))
  WHERE (("me"."id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'owner'::"text"])) AND ("me"."organization_id" IS NOT NULL) AND ("o"."organization_id" = "me"."organization_id")))));



CREATE POLICY "potential_matches_select_own_reports" ON "public"."potential_matches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lost_item_reports" "lr"
  WHERE (("lr"."id" = "potential_matches"."report_id") AND ("lr"."student_id" = "auth"."uid"())))));



CREATE POLICY "potential_matches_select_staff_org" ON "public"."potential_matches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "me"
     JOIN "public"."found_items" "fi" ON (("fi"."id" = "potential_matches"."lost_item_id")))
     JOIN "public"."offices" "o" ON (("o"."office_id" = "fi"."office_id")))
  WHERE (("me"."id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'owner'::"text"])) AND ("me"."organization_id" IS NOT NULL) AND ("o"."organization_id" = "me"."organization_id")))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own_safe" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "service_role_insert_email_alerts" ON "public"."email_alerts" FOR INSERT WITH CHECK (true);



CREATE POLICY "staff_select_all_lost_reports" ON "public"."lost_item_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "me"
     JOIN "public"."profiles" "reporter" ON (("reporter"."id" = "lost_item_reports"."student_id")))
  WHERE (("me"."id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'owner'::"text"])) AND ("reporter"."organization_id" = "me"."organization_id")))));



CREATE POLICY "users read only own org" ON "public"."organizations" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."organization_id" = "organizations"."organization_id"))));



CREATE POLICY "users_view_own_email_alerts" ON "public"."email_alerts" FOR SELECT USING (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."claims";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."found_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."lost_item_reports";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."count_reunited_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_reunited_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_reunited_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid", "p_related_item_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid", "p_related_item_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_notification_type" "text", "p_related_item_id" "uuid", "p_related_item_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_best_match"("p_category" "text", "p_color" "text", "p_brand" "text", "p_lost_location" "text", "p_lost_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."lost_item_reports" TO "anon";
GRANT ALL ON TABLE "public"."lost_item_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."lost_item_reports" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_lost_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_lost_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_lost_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_claim_reviewed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_claim_reviewed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_claim_reviewed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid", "p_found_item_id" "uuid", "p_status" "text", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid", "p_found_item_id" "uuid", "p_status" "text", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid", "p_found_item_id" "uuid", "p_status" "text", "p_error_message" "text") TO "service_role";



GRANT ALL ON TABLE "public"."found_items" TO "anon";
GRANT ALL ON TABLE "public"."found_items" TO "authenticated";
GRANT ALL ON TABLE "public"."found_items" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_found_items"("search_query" "text", "search_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";



GRANT ALL ON TABLE "public"."email_alerts" TO "anon";
GRANT ALL ON TABLE "public"."email_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offices" TO "anon";
GRANT ALL ON TABLE "public"."offices" TO "authenticated";
GRANT ALL ON TABLE "public"."offices" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."office_item_counts" TO "anon";
GRANT ALL ON TABLE "public"."office_item_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."office_item_counts" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."potential_matches" TO "anon";
GRANT ALL ON TABLE "public"."potential_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."potential_matches" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































