-- Ensure service_role can persist integration executions from workers / domain jobs
GRANT ALL ON public.case_integration_executions TO service_role;
GRANT ALL ON public.case_integration_attempts TO service_role;
