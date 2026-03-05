drop extension if exists "pg_net";

create type "public"."app_role" as enum ('admin', 'user');


  create table "public"."claims" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "found_item_id" uuid not null,
    "claimant_id" uuid not null,
    "claim_message" text not null,
    "verification_answers" text,
    "reviewed_by" uuid,
    "review_status" text not null default 'pending'::text,
    "review_notes" text,
    "reviewed_at" timestamp with time zone,
    "pickup_scheduled_date" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."claims" enable row level security;


  create table "public"."found_items" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "staff_id" uuid not null,
    "item_name" text not null,
    "category" text not null,
    "description" text not null,
    "color" text,
    "brand" text,
    "found_location" text not null,
    "found_date" date not null,
    "current_location" text,
    "verification_details" jsonb,
    "image_urls" text[],
    "status" text not null default 'available'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "high_value" boolean not null default false
      );


alter table "public"."found_items" enable row level security;


  create table "public"."lost_item_reports" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "student_id" uuid not null,
    "item_name" text not null,
    "category" text not null,
    "description" text not null,
    "color" text,
    "brand" text,
    "lost_location" text not null,
    "lost_date" date not null,
    "verification_details" jsonb,
    "image_urls" text[],
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."lost_item_reports" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "title" text not null,
    "message" text not null,
    "notification_type" text not null,
    "related_item_id" uuid,
    "related_item_type" text,
    "is_read" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."notifications" enable row level security;


  create table "public"."offices" (
    "staff_id" uuid,
    "office_name" character varying,
    "office_address" character varying,
    "building_name" character varying,
    "item_count" integer,
    "office_id" uuid not null default gen_random_uuid(),
    "organization_id" uuid
      );


alter table "public"."offices" enable row level security;


  create table "public"."organizations" (
    "organization_id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "billing_plan" text,
    "settings" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."organizations" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "email" text not null,
    "full_name" text not null,
    "phone_number" text,
    "student_id" text,
    "office_id" uuid,
    "campus_location" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "organization_id" uuid,
    "role" text
      );


alter table "public"."profiles" enable row level security;


  create table "public"."user_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "role" public.app_role not null default 'user'::public.app_role,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."user_roles" enable row level security;

CREATE UNIQUE INDEX claims_found_item_id_student_id_key ON public.claims USING btree (found_item_id, claimant_id);

CREATE UNIQUE INDEX claims_pkey ON public.claims USING btree (id);

CREATE UNIQUE INDEX found_items_pkey ON public.found_items USING btree (id);

CREATE INDEX idx_claims_found_item ON public.claims USING btree (found_item_id);

CREATE INDEX idx_claims_status ON public.claims USING btree (review_status);

CREATE INDEX idx_claims_student ON public.claims USING btree (claimant_id);

CREATE INDEX idx_found_items_category ON public.found_items USING btree (category);

CREATE INDEX idx_found_items_created_at ON public.found_items USING btree (created_at DESC);

CREATE INDEX idx_found_items_status ON public.found_items USING btree (status);

CREATE INDEX idx_lost_reports_status ON public.lost_item_reports USING btree (status);

CREATE INDEX idx_lost_reports_student ON public.lost_item_reports USING btree (student_id);

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);

CREATE INDEX idx_profiles_office_id ON public.profiles USING btree (office_id);

CREATE INDEX idx_profiles_organization_id ON public.profiles USING btree (organization_id);

CREATE UNIQUE INDEX lost_item_reports_pkey ON public.lost_item_reports USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX offices_pkey ON public.offices USING btree (office_id);

CREATE UNIQUE INDEX offices_staff_id_key ON public.offices USING btree (staff_id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (organization_id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);

CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);

alter table "public"."claims" add constraint "claims_pkey" PRIMARY KEY using index "claims_pkey";

alter table "public"."found_items" add constraint "found_items_pkey" PRIMARY KEY using index "found_items_pkey";

alter table "public"."lost_item_reports" add constraint "lost_item_reports_pkey" PRIMARY KEY using index "lost_item_reports_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."offices" add constraint "offices_pkey" PRIMARY KEY using index "offices_pkey";

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "public"."claims" add constraint "claims_claimant_id_fkey" FOREIGN KEY (claimant_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."claims" validate constraint "claims_claimant_id_fkey";

alter table "public"."claims" add constraint "claims_found_item_id_fkey" FOREIGN KEY (found_item_id) REFERENCES public.found_items(id) ON DELETE CASCADE not valid;

alter table "public"."claims" validate constraint "claims_found_item_id_fkey";

alter table "public"."claims" add constraint "claims_found_item_id_student_id_key" UNIQUE using index "claims_found_item_id_student_id_key";

alter table "public"."claims" add constraint "claims_review_status_check" CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."claims" validate constraint "claims_review_status_check";

alter table "public"."claims" add constraint "claims_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."claims" validate constraint "claims_reviewed_by_fkey";

alter table "public"."found_items" add constraint "found_items_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."found_items" validate constraint "found_items_staff_id_fkey";

alter table "public"."found_items" add constraint "found_items_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'claimed'::text, 'returned'::text]))) not valid;

alter table "public"."found_items" validate constraint "found_items_status_check";

alter table "public"."lost_item_reports" add constraint "lost_item_reports_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'found'::text, 'cancelled'::text]))) not valid;

alter table "public"."lost_item_reports" validate constraint "lost_item_reports_status_check";

alter table "public"."lost_item_reports" add constraint "lost_item_reports_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."lost_item_reports" validate constraint "lost_item_reports_student_id_fkey";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."offices" add constraint "offices_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."offices" validate constraint "offices_organization_id_fkey";

alter table "public"."offices" add constraint "offices_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."offices" validate constraint "offices_staff_id_fkey";

alter table "public"."offices" add constraint "offices_staff_id_key" UNIQUE using index "offices_staff_id_key";

alter table "public"."organizations" add constraint "organizations_name_not_empty" CHECK ((char_length(name) > 0)) not valid;

alter table "public"."organizations" validate constraint "organizations_name_not_empty";

alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_office_id_fkey" FOREIGN KEY (office_id) REFERENCES public.offices(office_id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_office_id_fkey";

alter table "public"."profiles" add constraint "profiles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_organization_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'owner'::text, 'staff'::text, 'user'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_roles" validate constraint "user_roles_user_id_fkey";

alter table "public"."user_roles" add constraint "user_roles_user_id_role_key" UNIQUE using index "user_roles_user_id_role_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_notification_type text, p_related_item_id uuid DEFAULT NULL::uuid, p_related_item_type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_user_role(p_user_id uuid, p_role public.app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_best_match(p_category text, p_color text, p_brand text, p_lost_location text, p_lost_date date)
 RETURNS TABLE(id uuid, category text, color text, brand text, found_location text, found_date date, current_location text, match_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  $function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.notify_claim_reviewed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'rejected')) THEN
    PERFORM create_notification(
      NEW.student_id,
      CASE 
        WHEN NEW.review_status = 'approved' THEN 'Claim Approved! 🎉'
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_found_items(search_query text, search_category text DEFAULT NULL::text)
 RETURNS SETOF public.found_items
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_office_item_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_office_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT office_id INTO target_office_id
    FROM profiles
    WHERE id = OLD.staff_id;
  ELSE
    SELECT office_id INTO target_office_id
    FROM profiles
    WHERE id = NEW.staff_id;
  END IF;

  IF target_office_id IS NOT NULL THEN
    UPDATE offices
    SET item_count = (
      SELECT COUNT(*)
      FROM found_items fi
      JOIN profiles p ON fi.staff_id = p.id
      WHERE p.office_id = target_office_id
      AND fi.status = 'available'
    )
    WHERE office_id = target_office_id;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."claims" to "anon";

grant insert on table "public"."claims" to "anon";

grant references on table "public"."claims" to "anon";

grant select on table "public"."claims" to "anon";

grant trigger on table "public"."claims" to "anon";

grant truncate on table "public"."claims" to "anon";

grant update on table "public"."claims" to "anon";

grant delete on table "public"."claims" to "authenticated";

grant insert on table "public"."claims" to "authenticated";

grant references on table "public"."claims" to "authenticated";

grant select on table "public"."claims" to "authenticated";

grant trigger on table "public"."claims" to "authenticated";

grant truncate on table "public"."claims" to "authenticated";

grant update on table "public"."claims" to "authenticated";

grant delete on table "public"."claims" to "service_role";

grant insert on table "public"."claims" to "service_role";

grant references on table "public"."claims" to "service_role";

grant select on table "public"."claims" to "service_role";

grant trigger on table "public"."claims" to "service_role";

grant truncate on table "public"."claims" to "service_role";

grant update on table "public"."claims" to "service_role";

grant delete on table "public"."found_items" to "anon";

grant insert on table "public"."found_items" to "anon";

grant references on table "public"."found_items" to "anon";

grant select on table "public"."found_items" to "anon";

grant trigger on table "public"."found_items" to "anon";

grant truncate on table "public"."found_items" to "anon";

grant update on table "public"."found_items" to "anon";

grant delete on table "public"."found_items" to "authenticated";

grant insert on table "public"."found_items" to "authenticated";

grant references on table "public"."found_items" to "authenticated";

grant select on table "public"."found_items" to "authenticated";

grant trigger on table "public"."found_items" to "authenticated";

grant truncate on table "public"."found_items" to "authenticated";

grant update on table "public"."found_items" to "authenticated";

grant delete on table "public"."found_items" to "service_role";

grant insert on table "public"."found_items" to "service_role";

grant references on table "public"."found_items" to "service_role";

grant select on table "public"."found_items" to "service_role";

grant trigger on table "public"."found_items" to "service_role";

grant truncate on table "public"."found_items" to "service_role";

grant update on table "public"."found_items" to "service_role";

grant delete on table "public"."lost_item_reports" to "anon";

grant insert on table "public"."lost_item_reports" to "anon";

grant references on table "public"."lost_item_reports" to "anon";

grant select on table "public"."lost_item_reports" to "anon";

grant trigger on table "public"."lost_item_reports" to "anon";

grant truncate on table "public"."lost_item_reports" to "anon";

grant update on table "public"."lost_item_reports" to "anon";

grant delete on table "public"."lost_item_reports" to "authenticated";

grant insert on table "public"."lost_item_reports" to "authenticated";

grant references on table "public"."lost_item_reports" to "authenticated";

grant select on table "public"."lost_item_reports" to "authenticated";

grant trigger on table "public"."lost_item_reports" to "authenticated";

grant truncate on table "public"."lost_item_reports" to "authenticated";

grant update on table "public"."lost_item_reports" to "authenticated";

grant delete on table "public"."lost_item_reports" to "service_role";

grant insert on table "public"."lost_item_reports" to "service_role";

grant references on table "public"."lost_item_reports" to "service_role";

grant select on table "public"."lost_item_reports" to "service_role";

grant trigger on table "public"."lost_item_reports" to "service_role";

grant truncate on table "public"."lost_item_reports" to "service_role";

grant update on table "public"."lost_item_reports" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."offices" to "anon";

grant insert on table "public"."offices" to "anon";

grant references on table "public"."offices" to "anon";

grant select on table "public"."offices" to "anon";

grant trigger on table "public"."offices" to "anon";

grant truncate on table "public"."offices" to "anon";

grant update on table "public"."offices" to "anon";

grant delete on table "public"."offices" to "authenticated";

grant insert on table "public"."offices" to "authenticated";

grant references on table "public"."offices" to "authenticated";

grant select on table "public"."offices" to "authenticated";

grant trigger on table "public"."offices" to "authenticated";

grant truncate on table "public"."offices" to "authenticated";

grant update on table "public"."offices" to "authenticated";

grant delete on table "public"."offices" to "service_role";

grant insert on table "public"."offices" to "service_role";

grant references on table "public"."offices" to "service_role";

grant select on table "public"."offices" to "service_role";

grant trigger on table "public"."offices" to "service_role";

grant truncate on table "public"."offices" to "service_role";

grant update on table "public"."offices" to "service_role";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."user_roles" to "anon";

grant insert on table "public"."user_roles" to "anon";

grant references on table "public"."user_roles" to "anon";

grant select on table "public"."user_roles" to "anon";

grant trigger on table "public"."user_roles" to "anon";

grant truncate on table "public"."user_roles" to "anon";

grant update on table "public"."user_roles" to "anon";

grant delete on table "public"."user_roles" to "authenticated";

grant insert on table "public"."user_roles" to "authenticated";

grant references on table "public"."user_roles" to "authenticated";

grant select on table "public"."user_roles" to "authenticated";

grant trigger on table "public"."user_roles" to "authenticated";

grant truncate on table "public"."user_roles" to "authenticated";

grant update on table "public"."user_roles" to "authenticated";

grant delete on table "public"."user_roles" to "service_role";

grant insert on table "public"."user_roles" to "service_role";

grant references on table "public"."user_roles" to "service_role";

grant select on table "public"."user_roles" to "service_role";

grant trigger on table "public"."user_roles" to "service_role";

grant truncate on table "public"."user_roles" to "service_role";

grant update on table "public"."user_roles" to "service_role";


  create policy "Staff can update claims for their items"
  on "public"."claims"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.found_items
  WHERE ((found_items.id = claims.found_item_id) AND (found_items.staff_id = auth.uid())))));



  create policy "Staff can view claims for their items"
  on "public"."claims"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.found_items
  WHERE ((found_items.id = claims.found_item_id) AND (found_items.staff_id = auth.uid())))));



  create policy "Users can create claims"
  on "public"."claims"
  as permissive
  for insert
  to public
with check ((auth.uid() = claimant_id));



  create policy "Users can view own claims"
  on "public"."claims"
  as permissive
  for select
  to public
using ((auth.uid() = claimant_id));



  create policy "claims_delete_own_pending"
  on "public"."claims"
  as permissive
  for delete
  to public
using (((auth.uid() = claimant_id) AND (review_status = 'pending'::text)));



  create policy "claims_insert_student"
  on "public"."claims"
  as permissive
  for insert
  to public
with check ((auth.uid() = claimant_id));



  create policy "claims_select_own_student"
  on "public"."claims"
  as permissive
  for select
  to public
using ((auth.uid() = claimant_id));



  create policy "claims_select_safe"
  on "public"."claims"
  as permissive
  for select
  to authenticated
using (((auth.uid() = claimant_id) OR (auth.uid() IN ( SELECT found_items.staff_id
   FROM public.found_items
  WHERE (found_items.id = claims.found_item_id)))));



  create policy "claims_update_own_pending"
  on "public"."claims"
  as permissive
  for update
  to public
using (((auth.uid() = claimant_id) AND (review_status = 'pending'::text)));



  create policy "claims_update_safe"
  on "public"."claims"
  as permissive
  for update
  to authenticated
using ((auth.uid() IN ( SELECT found_items.staff_id
   FROM public.found_items
  WHERE (found_items.id = claims.found_item_id))));



  create policy "Anyone can view available found items"
  on "public"."found_items"
  as permissive
  for select
  to public
using (((status = 'available'::text) OR (auth.uid() = staff_id)));



  create policy "Staff can update own found items"
  on "public"."found_items"
  as permissive
  for update
  to public
using ((auth.uid() = staff_id));



  create policy "found_items_delete_staff"
  on "public"."found_items"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text)))));



  create policy "found_items_insert_safe"
  on "public"."found_items"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = staff_id));



  create policy "found_items_select_all"
  on "public"."found_items"
  as permissive
  for select
  to public
using (true);



  create policy "found_items_update_staff"
  on "public"."found_items"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text)))));



  create policy "Users can create lost reports"
  on "public"."lost_item_reports"
  as permissive
  for insert
  to public
with check ((auth.uid() = student_id));



  create policy "Users can delete own lost reports"
  on "public"."lost_item_reports"
  as permissive
  for delete
  to public
using ((auth.uid() = student_id));



  create policy "Users can insert their own reports"
  on "public"."lost_item_reports"
  as permissive
  for insert
  to authenticated
with check ((student_id = auth.uid()));



  create policy "Users can read their own reports"
  on "public"."lost_item_reports"
  as permissive
  for select
  to authenticated
using ((student_id = auth.uid()));



  create policy "Users can update own lost reports"
  on "public"."lost_item_reports"
  as permissive
  for update
  to public
using ((auth.uid() = student_id));



  create policy "Users can view own lost reports"
  on "public"."lost_item_reports"
  as permissive
  for select
  to public
using ((auth.uid() = student_id));



  create policy "lost_reports_delete_own"
  on "public"."lost_item_reports"
  as permissive
  for delete
  to public
using ((auth.uid() = student_id));



  create policy "lost_reports_insert_own"
  on "public"."lost_item_reports"
  as permissive
  for insert
  to public
with check ((auth.uid() = student_id));



  create policy "lost_reports_select_own_safe"
  on "public"."lost_item_reports"
  as permissive
  for select
  to authenticated
using ((auth.uid() = student_id));



  create policy "lost_reports_update_own"
  on "public"."lost_item_reports"
  as permissive
  for update
  to public
using ((auth.uid() = student_id));



  create policy "staff_select_all_lost_reports"
  on "public"."lost_item_reports"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['staff'::text, 'admin'::text, 'owner'::text]))))));



  create policy "Service role can insert notifications"
  on "public"."notifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update own notifications"
  on "public"."notifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own notifications"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "notifications_delete_own"
  on "public"."notifications"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "notifications_insert_authenticated"
  on "public"."notifications"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "notifications_select_own"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "notifications_update_own"
  on "public"."notifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Admins can modify offices"
  on "public"."offices"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));



  create policy "Authenticated users can view offices"
  on "public"."offices"
  as permissive
  for select
  to authenticated
using (true);



  create policy "offices_delete_same_office"
  on "public"."offices"
  as permissive
  for delete
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text) AND (profiles.office_id = offices.office_id)))) OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)));



  create policy "offices_insert_admin"
  on "public"."offices"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text)))) OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)));



  create policy "offices_select_all"
  on "public"."offices"
  as permissive
  for select
  to public
using (true);



  create policy "offices_update_same_office"
  on "public"."offices"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text) AND (profiles.office_id = offices.office_id)))));



  create policy "users read only own org"
  on "public"."organizations"
  as permissive
  for select
  to public
using ((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.organization_id = organizations.organization_id))));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "profiles_delete_own"
  on "public"."profiles"
  as permissive
  for delete
  to public
using ((auth.uid() = id));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "profiles_select_own_safe"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = id));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Admins can view all roles"
  on "public"."user_roles"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Users can view their own roles"
  on "public"."user_roles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));


CREATE TRIGGER on_claim_reviewed AFTER UPDATE ON public.claims FOR EACH ROW WHEN ((old.review_status IS DISTINCT FROM new.review_status)) EXECUTE FUNCTION public.notify_claim_reviewed();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_found_items_updated_at BEFORE UPDATE ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_office_count_on_delete AFTER DELETE ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.update_office_item_count();

CREATE TRIGGER update_office_count_on_insert AFTER INSERT ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.update_office_item_count();

CREATE TRIGGER update_office_count_on_update AFTER UPDATE OF status ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.update_office_item_count();

CREATE TRIGGER update_lost_reports_updated_at BEFORE UPDATE ON public.lost_item_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy " Authenticated users can upload 10abb02_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "Authenticated users can upload images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'item-images'::text));



  create policy "Public image access 10abb02_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (true);



  create policy "Staff can delete images 10abb02_0"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text)))));



  create policy "Users can update own uploads 10abb02_0"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((auth.uid() = owner));



