CREATE TABLE public.meeting_minutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  chairperson TEXT NOT NULL,
  venue TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  minutes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own minutes"
ON public.meeting_minutes FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Admins can create minutes"
ON public.meeting_minutes FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their own minutes"
ON public.meeting_minutes FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete their own minutes"
ON public.meeting_minutes FOR DELETE
USING (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.update_meeting_minutes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_meeting_minutes_updated_at
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW EXECUTE FUNCTION public.update_meeting_minutes_updated_at();

CREATE INDEX idx_meeting_minutes_created_by ON public.meeting_minutes(created_by);
CREATE INDEX idx_meeting_minutes_date ON public.meeting_minutes(meeting_date DESC);