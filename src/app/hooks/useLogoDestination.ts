import { useState, useEffect } from 'react';
import { getCurrentUserWithProfile } from '../../lib/auth';

/**
 * Returns the path the logo should link to based on the current user:
 * - Guest/unauthenticated → / (landing page)
 * - Staff/Admin/Owner → /admin (catalogue/inventory)
 * - Student → /dashboard (report item page)
 */
export function useLogoDestination(): string {
  const [path, setPath] = useState('/');

  useEffect(() => {
    getCurrentUserWithProfile().then((user) => {
      if (!user) {
        setPath('/');
      } else if (['staff', 'admin', 'owner'].includes(user.profile?.role ?? '')) {
        setPath('/admin');
      } else {
        setPath('/dashboard');
      }
    });
  }, []);

  return path;
}
