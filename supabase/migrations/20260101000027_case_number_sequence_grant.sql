-- Allow signed-in requesters to run the case-number trigger during case inserts.
-- Table INSERT privileges do not automatically include privileges on sequences.

GRANT USAGE, SELECT ON SEQUENCE public.case_number_seq TO authenticated;
