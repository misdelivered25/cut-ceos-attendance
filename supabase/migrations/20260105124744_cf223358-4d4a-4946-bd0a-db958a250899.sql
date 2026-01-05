-- Create members table for full member onboarding
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  program TEXT,
  department TEXT,
  profile_picture_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Policies for members table
CREATE POLICY "Admins can view all members"
ON public.members
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Admins can create members"
ON public.members
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update members"
ON public.members
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete members"
ON public.members
FOR DELETE
USING (auth.uid() = created_by);

-- Add threshold notification settings to sessions
ALTER TABLE public.sessions
ADD COLUMN notification_threshold INTEGER DEFAULT NULL,
ADD COLUMN notification_email TEXT DEFAULT NULL,
ADD COLUMN notification_sent BOOLEAN NOT NULL DEFAULT false;

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true);

-- Storage policies for profile pictures
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'profile-pictures' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update profile pictures"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'profile-pictures' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete profile pictures"
ON storage.objects
FOR DELETE
USING (bucket_id = 'profile-pictures' AND auth.role() = 'authenticated');

-- Enable realtime for attendees table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendees;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.update_members_updated_at();

-- Function to generate unique member ID
CREATE OR REPLACE FUNCTION public.generate_member_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := 'CUT-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.members WHERE member_id = new_id) INTO id_exists;
    EXIT WHEN NOT id_exists;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;