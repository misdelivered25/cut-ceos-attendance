
-- Public read of active sessions by QR token (attendance flow has no auth)
DROP POLICY IF EXISTS "Public can view active sessions by QR token" ON public.sessions;
CREATE POLICY "Public can view active sessions by QR token"
ON public.sessions
FOR SELECT
TO anon, authenticated
USING (qr_token IS NOT NULL AND is_active = true);

GRANT SELECT ON public.sessions TO anon;

-- Duplicate attendance protection per session
CREATE UNIQUE INDEX IF NOT EXISTS unique_attendance_student_per_session
  ON public.attendees (session_id, lower(student_id))
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_attendance_email_per_session
  ON public.attendees (session_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_attendance_phone_per_session
  ON public.attendees (session_id, phone)
  WHERE phone IS NOT NULL;

-- Session defaults
ALTER TABLE public.sessions ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.sessions ALTER COLUMN qr_token SET DEFAULT gen_random_uuid()::text;
