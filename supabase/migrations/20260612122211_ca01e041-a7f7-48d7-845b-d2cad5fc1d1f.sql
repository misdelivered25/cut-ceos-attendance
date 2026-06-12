DROP POLICY IF EXISTS "Public can view active sessions by QR token" ON public.sessions;

REVOKE SELECT ON public.sessions FROM anon;