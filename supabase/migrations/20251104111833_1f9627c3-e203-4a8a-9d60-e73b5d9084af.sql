-- Create sessions table
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  qr_token text NOT NULL UNIQUE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Create attendees table
CREATE TABLE public.attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  UNIQUE(session_id, phone)
);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
-- Admins can do everything with their own sessions
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for attendees
-- Admins can view attendees for their sessions
CREATE POLICY "Users can view attendees for their sessions"
  ON public.attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = attendees.session_id
      AND sessions.created_by = auth.uid()
    )
  );

-- Anyone can insert attendance (public form)
CREATE POLICY "Anyone can mark attendance"
  ON public.attendees FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_sessions_qr_token ON public.sessions(qr_token);
CREATE INDEX idx_sessions_created_by ON public.sessions(created_by);
CREATE INDEX idx_attendees_session_id ON public.attendees(session_id);
CREATE INDEX idx_attendees_phone ON public.attendees(phone);