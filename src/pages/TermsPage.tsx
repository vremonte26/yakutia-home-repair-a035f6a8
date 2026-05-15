import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Link>
      <h1 className="text-2xl font-extrabold mb-4">Пользовательское соглашение</h1>
      <div className="prose prose-sm text-muted-foreground space-y-3">
        <p>Настоящее Пользовательское соглашение регулирует отношения между сервисом «Времонте» и пользователем.</p>
        <p>Регистрируясь в приложении, вы соглашаетесь с правилами использования сервиса, добросовестным поведением и соблюдением законодательства РФ.</p>
        <p>Сервис не несёт ответственности за качество услуг, оказываемых мастерами, но обеспечивает площадку для коммуникации, рейтинги и систему жалоб.</p>
        <p>Полный текст соглашения будет опубликован при выходе сервиса в продакшн.</p>
      </div>
    </div>
  );
}
