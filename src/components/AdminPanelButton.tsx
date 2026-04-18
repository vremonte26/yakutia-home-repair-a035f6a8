import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';

export function AdminPanelButton() {
  const navigate = useNavigate();
  const { hasAccess, loading } = useAdminRole();
  if (loading || !hasAccess) return null;
  return (
    <Button variant="outline" className="w-full" onClick={() => navigate('/admin')}>
      <Shield className="h-4 w-4 mr-2" />
      Админ-панель
    </Button>
  );
}
