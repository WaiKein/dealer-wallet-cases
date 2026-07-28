-- Add admin role (must be committed before policies/seed reference it)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
