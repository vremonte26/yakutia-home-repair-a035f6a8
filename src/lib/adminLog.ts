import { supabase } from '@/integrations/supabase/client';

export async function logAdminAction(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  await (supabase.from as any)('admin_logs').insert({
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    details: params.details ?? {},
  });
}
