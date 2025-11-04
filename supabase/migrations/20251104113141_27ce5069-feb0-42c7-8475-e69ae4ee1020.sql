-- Allow public access to sessions via QR token for attendance marking
CREATE POLICY "Anyone can view sessions by QR token"
ON public.sessions
FOR SELECT
USING (qr_token IS NOT NULL AND is_active = true);