-- Comments, attachments, access helper, and storage for case files

CREATE OR REPLACE FUNCTION public.can_access_case(target_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = target_case_id
      AND (
        c.requester_id = auth.uid()
        OR public.get_my_role() IN ('operations_agent', 'approver')
      )
  );
$$;

CREATE TABLE public.case_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles (id),
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_comments_case_id ON public.case_comments (case_id, created_at DESC);

CREATE TABLE public.case_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles (id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_attachments_case_id ON public.case_attachments (case_id, created_at DESC);

ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view comments on accessible cases"
  ON public.case_comments FOR SELECT
  USING (public.can_access_case(case_id));

CREATE POLICY "Users add comments on accessible cases"
  ON public.case_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_case(case_id)
  );

CREATE POLICY "Users view attachments on accessible cases"
  ON public.case_attachments FOR SELECT
  USING (public.can_access_case(case_id));

CREATE POLICY "Users add attachments on accessible cases"
  ON public.case_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_access_case(case_id)
  );

CREATE POLICY "Users delete own attachments on accessible cases"
  ON public.case_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND public.can_access_case(case_id)
  );

-- Storage bucket for case files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-attachments',
  'case-attachments',
  false,
  5242880,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users read case attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-attachments');

CREATE POLICY "Authenticated users upload case attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users delete own case attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'case-attachments'
    AND owner = auth.uid()
  );

GRANT EXECUTE ON FUNCTION public.can_access_case(UUID) TO authenticated;
GRANT SELECT, INSERT ON public.case_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.case_attachments TO authenticated;
