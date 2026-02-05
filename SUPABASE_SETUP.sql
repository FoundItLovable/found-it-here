CREATE TABLE public.organizations (
  organization_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) > 0),
  billing_plan text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (organization_id)
);

CREATE TABLE public.offices (
  office_id uuid NOT NULL DEFAULT gen_random_uuid(),
  office_name character varying,
  office_address character varying,
  building_name character varying,
  organization_id uuid,
  CONSTRAINT offices_pkey PRIMARY KEY (office_id),
  CONSTRAINT offices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone_number text,
  student_id text,
  office_id uuid,
  campus_location text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  role text CHECK (role = ANY (ARRAY['admin'::text, 'owner'::text, 'staff'::text, 'user'::text])),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(office_id),
  CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id)
);

CREATE TABLE public.found_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  color text,
  brand text,
  found_location text NOT NULL,
  found_date date NOT NULL,
  current_location text,
  verification_details jsonb,
  image_urls ARRAY,
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'claimed'::text, 'returned'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT found_items_pkey PRIMARY KEY (id),
  CONSTRAINT found_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.lost_item_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  color text,
  brand text,
  lost_location text NOT NULL,
  lost_date date NOT NULL,
  verification_details jsonb,
  image_urls ARRAY,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'found'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lost_item_reports_pkey PRIMARY KEY (id),
  CONSTRAINT lost_item_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.claims (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  found_item_id uuid NOT NULL,
  claimant_id uuid NOT NULL,
  claim_message text NOT NULL,
  verification_answers text,
  reviewed_by uuid,
  review_status text NOT NULL DEFAULT 'pending'::text CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  review_notes text,
  reviewed_at timestamp with time zone,
  pickup_scheduled_date timestamp with time zone,
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT claims_pkey PRIMARY KEY (id),
  CONSTRAINT claims_found_item_id_fkey FOREIGN KEY (found_item_id) REFERENCES public.found_items(id),
  CONSTRAINT claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id),
  CONSTRAINT claims_claimant_id_fkey FOREIGN KEY (claimant_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL,
  related_item_id uuid,
  related_item_type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- View to get item counts per office (replaces denormalized item_count column)
CREATE VIEW public.office_item_counts AS
SELECT
  o.office_id,
  o.office_name,
  COUNT(fi.id) FILTER (WHERE fi.status = 'available') AS available_item_count,
  COUNT(fi.id) AS total_item_count
FROM public.offices o
LEFT JOIN public.profiles p ON p.office_id = o.office_id
LEFT JOIN public.found_items fi ON fi.staff_id = p.id
GROUP BY o.office_id, o.office_name;
