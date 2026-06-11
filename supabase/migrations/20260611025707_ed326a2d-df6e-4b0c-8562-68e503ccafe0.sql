CREATE POLICY "Public can view active sessions by QR token"
ON public.sessions
FOR SELECT
TO anon, authenticated
USING (qr_token IS NOT NULL AND is_active = true);

GRANT SELECT ON public.sessions TO anon;