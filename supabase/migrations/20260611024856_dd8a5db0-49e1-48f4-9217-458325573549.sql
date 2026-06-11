
-- 1) Admin role system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed existing creators as admins so they retain access
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT created_by, 'admin'::public.app_role
FROM public.sessions
WHERE created_by IS NOT NULL
UNION
SELECT DISTINCT created_by, 'admin'::public.app_role
FROM public.members
WHERE created_by IS NOT NULL
UNION
SELECT DISTINCT created_by, 'admin'::public.app_role
FROM public.meeting_minutes
WHERE created_by IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Sessions: remove broad anonymous read; add safe lookup function
DROP POLICY IF EXISTS "Anyone can view sessions by QR token" ON public.sessions;

CREATE OR REPLACE FUNCTION public.get_session_by_qr_token(_token text)
RETURNS TABLE (
  id uuid,
  title text,
  is_active boolean,
  mode public.session_mode,
  start_time timestamptz,
  end_time timestamptz,
  time_limit_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, is_active, mode, start_time, end_time, time_limit_enabled
  FROM public.sessions
  WHERE qr_token = _token
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_session_by_qr_token(text) TO anon, authenticated;

-- 3) Attendees: remove blanket public insert (edge function uses service role)
DROP POLICY IF EXISTS "Anyone can mark attendance" ON public.attendees;

-- Add server-side validation constraints
ALTER TABLE public.attendees
  ADD CONSTRAINT attendees_name_length CHECK (length(name) BETWEEN 1 AND 100),
  ADD CONSTRAINT attendees_phone_format CHECK (phone ~ '^[0-9+\-\s()]{10,15}$'),
  ADD CONSTRAINT attendees_student_id_length CHECK (student_id IS NULL OR length(student_id) BETWEEN 1 AND 50),
  ADD CONSTRAINT attendees_email_length CHECK (email IS NULL OR length(email) <= 254);

-- 4) Members: require admin role for writes
DROP POLICY IF EXISTS "Admins can create members" ON public.members;
DROP POLICY IF EXISTS "Admins can update members" ON public.members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.members;

CREATE POLICY "Admins can view members"
  ON public.members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create members"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = created_by);

CREATE POLICY "Admins can update members"
  ON public.members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Profile pictures storage policies: admin-only writes
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile pictures" ON storage.objects;

CREATE POLICY "Admins can upload profile pictures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-pictures' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profile pictures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-pictures' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profile pictures"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-pictures' AND public.has_role(auth.uid(), 'admin'));

-- 6) Realtime: stop broadcasting attendees data
ALTER PUBLICATION supabase_realtime DROP TABLE public.attendees;
