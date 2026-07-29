-- Worker/service paths must read approval linkage when executing wallet jobs.
-- Migration 00012 granted authenticated only; 00020 covered rules/delegations but
-- omitted approval_requests / approval_steps, so integration workers failed with
-- "Execution is not linked to an approved request." despite APPROVED rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_steps TO service_role;
