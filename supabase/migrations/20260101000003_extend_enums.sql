-- Extend existing enums in a dedicated transaction.
-- New enum labels cannot be referenced until this migration commits.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'team_lead';

ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'WAITING_FOR_EXTERNAL_PARTY';
