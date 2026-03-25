-- Fix notify_claim_reviewed: was referencing NEW.student_id but claims uses claimant_id
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
