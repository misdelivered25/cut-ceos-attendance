-- Create enum for session mode
CREATE TYPE public.session_mode AS ENUM ('timed', 'open');

-- Add mode and time_limit_enabled columns to sessions
ALTER TABLE public.sessions 
ADD COLUMN mode session_mode NOT NULL DEFAULT 'timed',
ADD COLUMN time_limit_enabled boolean NOT NULL DEFAULT true;

-- Add DELETE policy for attendees (admin can delete entries)
CREATE POLICY "Session owners can delete attendees"
ON public.attendees
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM sessions
  WHERE sessions.id = attendees.session_id
  AND sessions.created_by = auth.uid()
));