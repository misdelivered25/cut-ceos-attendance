ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS attendees_session_student_idx ON public.attendees(session_id, student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendees_session_email_idx ON public.attendees(session_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendees_session_phone_idx ON public.attendees(session_id, phone);