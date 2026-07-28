-- Phase 11: attachment storage scoping, internal comment visibility

ALTER TABLE public.case_comments
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- Internal comments visible only to operations roles (not requesters).
DROP POLICY IF EXISTS "Users view comments on accessible cases" ON public.case_comments;
CREATE POLICY "Users view comments on accessible cases"
  ON public.case_comments FOR SELECT
  USING (
    public.can_access_case(case_id)
    AND (
      NOT is_internal
      OR public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users add comments on accessible cases" ON public.case_comments;
CREATE POLICY "Users add comments on accessible cases"
  ON public.case_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_case(case_id)
    AND (
      NOT is_internal
      OR public.get_my_role() IN ('operations_agent', 'team_lead', 'approver', 'admin')
    )
  );

-- Scope storage reads to cases the caller can access (path: {caseId}/filename).
DROP POLICY IF EXISTS "Authenticated users read case attachment files" ON storage.objects;
CREATE POLICY "Authenticated users read case attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'case-attachments'
    AND public.can_access_case(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Authenticated users upload case attachment files" ON storage.objects;
CREATE POLICY "Authenticated users upload case attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND auth.role() = 'authenticated'
    AND public.can_access_case(((storage.foldername(name))[1])::uuid)
  );
