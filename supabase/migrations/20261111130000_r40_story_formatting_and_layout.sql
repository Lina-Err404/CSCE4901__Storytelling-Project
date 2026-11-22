ALTER TABLE public.story_segments
  ADD COLUMN IF NOT EXISTS writing_document jsonb
    NOT NULL DEFAULT '{"version":1,"runs":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS text_box_size jsonb
    NOT NULL DEFAULT '{"widthPercent":86,"heightPercent":77}'::jsonb;

UPDATE public.story_segments
SET writing_document = CASE
  WHEN COALESCE(writing_content, '') = '' THEN '{"version":1,"runs":[]}'::jsonb
  ELSE jsonb_build_object(
    'version', 1,
    'runs', jsonb_build_array(
      jsonb_build_object(
        'text', writing_content,
        'marks', '{}'::jsonb
      )
    )
  )
END
WHERE writing_document = '{"version":1,"runs":[]}'::jsonb;
