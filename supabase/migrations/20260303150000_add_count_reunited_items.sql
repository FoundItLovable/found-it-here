-- Returns the count of found items with status 'returned'.
-- SECURITY DEFINER bypasses RLS so the anon key can read the count.
CREATE OR REPLACE FUNCTION count_reunited_items()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint FROM found_items WHERE status = 'returned';
$$;

GRANT EXECUTE ON FUNCTION count_reunited_items() TO anon, authenticated;
