-- =============================================================================
-- Email Alerts System
-- Tracks email notifications sent to users for lost items and matches
-- =============================================================================

-- Add email_notifications_enabled to profiles (default true)
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "email_notifications_enabled" boolean DEFAULT true;

-- Table to track email alerts sent
CREATE TABLE IF NOT EXISTS "public"."email_alerts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "found_item_id" "uuid",
    "alert_type" "text" NOT NULL, -- 'lost_item_submitted', 'match_found'
    "email_sent_at" timestamp with time zone DEFAULT "now"(),
    "email_address" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text", -- 'sent', 'failed', 'bounced'
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

COMMENT ON TABLE "public"."email_alerts" IS 'Tracks email alerts sent to users for lost items and potential matches';
COMMENT ON COLUMN "public"."email_alerts"."alert_type" IS 'Type of alert: lost_item_submitted, match_found';
COMMENT ON COLUMN "public"."email_alerts"."status" IS 'Email delivery status: sent, failed, bounced';

-- Primary key
ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_pkey" PRIMARY KEY ("id");

-- Foreign keys
ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."lost_item_reports"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_alerts"
    ADD CONSTRAINT "email_alerts_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "public"."found_items"("id") ON DELETE CASCADE;

-- Indexes for efficient querying
CREATE INDEX "idx_email_alerts_user" ON "public"."email_alerts" USING "btree" ("user_id");
CREATE INDEX "idx_email_alerts_report" ON "public"."email_alerts" USING "btree" ("report_id");
CREATE INDEX "idx_email_alerts_found_item" ON "public"."email_alerts" USING "btree" ("found_item_id");
CREATE INDEX "idx_email_alerts_type" ON "public"."email_alerts" USING "btree" ("alert_type");
CREATE INDEX "idx_email_alerts_status" ON "public"."email_alerts" USING "btree" ("status");
CREATE INDEX "idx_email_alerts_created" ON "public"."email_alerts" USING "btree" ("created_at" DESC);

-- Function to record email alert
CREATE OR REPLACE FUNCTION "public"."record_email_alert"(
    "p_user_id" "uuid",
    "p_alert_type" "text",
    "p_email" "text",
    "p_subject" "text",
    "p_report_id" "uuid" DEFAULT NULL::"uuid",
    "p_found_item_id" "uuid" DEFAULT NULL::"uuid",
    "p_status" "text" DEFAULT 'sent'::"text",
    "p_error_message" "text" DEFAULT NULL::"text"
) RETURNS "uuid"
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

-- RLS Policies
ALTER TABLE "public"."email_alerts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_email_alerts" ON "public"."email_alerts" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "service_role_insert_email_alerts" ON "public"."email_alerts" FOR INSERT WITH CHECK (true);

-- Grants
GRANT ALL ON TABLE "public"."email_alerts" TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."record_email_alert"("p_user_id" "uuid", "p_alert_type" "text", "p_email" "text", "p_subject" "text", "p_report_id" "uuid", "p_found_item_id" "uuid", "p_status" "text", "p_error_message" "text") TO "anon", "authenticated", "service_role";
