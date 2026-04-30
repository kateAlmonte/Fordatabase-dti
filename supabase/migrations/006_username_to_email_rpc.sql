-- Allow the login page to translate a username (e.g. "enc_rafael") into the
-- email stored in profiles, without exposing the whole profiles table to
-- anonymous users.
--
-- This function is SECURITY DEFINER so it runs with the privileges of its
-- owner (postgres) and bypasses RLS. It only returns the email column for a
-- single username, which is safe to expose to anon users (the email is
-- needed to call supabase.auth.signInWithPassword).

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT email
    FROM public.profiles
    WHERE username = lower(trim(p_username))
    LIMIT 1;
$$;

-- Allow anonymous (logged-out) users to call it via PostgREST/RPC.
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
