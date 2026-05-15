import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Link>
      <h1 className="text-2xl font-extrabold mb-4">Согласие на обработку персональных данных</h1>
      <div className="prose prose-sm text-muted-foreground space-y-3">
        <p>Регистрируясь, вы даёте согласие на обработку ваших персональных данных (ФИО, телефон, email, геолокация, фото) сервисом «Времонте».</p>
        <p>Данные обрабатываются с целью предоставления сервиса, связи между клиентом и мастером, поддержки и улучшения качества услуг.</p>
        <p>Вы можете отозвать согласие в любой момент, удалив аккаунт в настройках профиля.</p>
        <p>Данные не передаются третьим лицам, кроме случаев, предусмотренных законодательством РФ.</p>
      </div>
    </div>
  );
}
