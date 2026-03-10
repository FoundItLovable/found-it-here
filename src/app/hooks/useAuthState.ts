import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, subscribeToAuthChanges } from '../../lib/auth';

export function useAuthState(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const { unsubscribe } = subscribeToAuthChanges((_event, session) => {
      setUser(session?.user ?? null);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}
