
-- 1. Tighten meeting_minutes write policies to admins only
DROP POLICY IF EXISTS "Admins can create minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Admins can update their own minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Admins can delete their own minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Admins can view their own minutes" ON public.meeting_minutes;

CREATE POLICY "Admins can view their own minutes"
ON public.meeting_minutes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Admins can create minutes"
ON public.meeting_minutes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Admins can update their own minutes"
ON public.meeting_minutes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by)
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Admins can delete their own minutes"
ON public.meeting_minutes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

-- 2. Lock down SECURITY DEFINER helper functions from PostgREST exposure.
-- `has_role` and `generate_member_id` are internal helpers and should not be
-- callable directly by anon or authenticated clients.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_member_id() FROM anon, authenticated, PUBLIC;

-- Trigger functions: revoke from API roles
REVOKE EXECUTE ON FUNCTION public.update_members_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_meeting_minutes_updated_at() FROM anon, authenticated, PUBLIC;

-- `get_session_by_qr_token` must stay callable by anon for the public attendance flow.
GRANT EXECUTE ON FUNCTION public.get_session_by_qr_token(text) TO anon, authenticated;
