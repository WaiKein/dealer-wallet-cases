-- Phase 9: service_role needs audit writes for delegation/config from API routes
GRANT ALL ON public.configuration_audit TO service_role;
GRANT ALL ON public.approval_rules TO service_role;
GRANT ALL ON public.approval_delegations TO service_role;
