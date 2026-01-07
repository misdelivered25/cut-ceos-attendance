-- Add member_id column to attendees table to link attendance to member profiles
ALTER TABLE public.attendees 
ADD COLUMN member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_attendees_member_id ON public.attendees(member_id);

-- Update RLS policy to allow viewing member attendance
CREATE POLICY "Session owners can view attendee member links"
ON public.attendees
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM sessions 
  WHERE sessions.id = attendees.session_id 
  AND sessions.created_by = auth.uid()
));