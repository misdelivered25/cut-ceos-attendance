GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO authenticated;
GRANT ALL ON public.attendees TO service_role;

DROP POLICY IF EXISTS "Session owners can add attendees" ON public.attendees;
CREATE POLICY "Session owners can add attendees"
ON public.attendees
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = attendees.session_id AND s.created_by = auth.uid()
));

DROP POLICY IF EXISTS "Session owners can update attendees" ON public.attendees;
CREATE POLICY "Session owners can update attendees"
ON public.attendees
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = attendees.session_id AND s.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = attendees.session_id AND s.created_by = auth.uid()
));