-- Workers / test-control use service_role to read flags and templates.
GRANT ALL ON public.feature_flags TO service_role;
GRANT ALL ON public.notification_templates TO service_role;
