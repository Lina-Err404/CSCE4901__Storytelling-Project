ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firebase_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_firebase_uid_unique
  ON public.profiles (firebase_uid)
  WHERE firebase_uid IS NOT NULL;

ALTER TABLE public.story_segments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_story_segment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_segments_set_updated_at ON public.story_segments;
CREATE TRIGGER story_segments_set_updated_at
  BEFORE UPDATE ON public.story_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_story_segment_updated_at();
