import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AdminRole = 'admin' | 'moderator';

export function useAdminRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (supabase.from as any)('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data }: { data: { role: AdminRole }[] | null }) => {
        if (cancelled) return;
        setRoles((data ?? []).map(r => r.role));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    roles,
    loading,
    isAdmin: roles.includes('admin'),
    isModerator: roles.includes('moderator'),
    hasAccess: roles.includes('admin') || roles.includes('moderator'),
  };
}
