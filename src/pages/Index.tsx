import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import ClientDashboard from './ClientDashboard';
import MasterDashboard from './MasterDashboard';

export default function Index() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppLayout>
      {profile.role === 'master' ? <MasterDashboard /> : <ClientDashboard />}
    </AppLayout>
  );
}
