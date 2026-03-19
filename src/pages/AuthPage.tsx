import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Wrench, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TEST_OTP_CODE = '123456';

export default function AuthPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    // Test mode: just move to OTP step
    await new Promise(r => setTimeout(r, 500));
    setStep('otp');
    toast({ title: 'Код отправлен', description: `Тестовый код: ${TEST_OTP_CODE}` });
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpValue !== TEST_OTP_CODE) {
      toast({ title: 'Неверный код', description: 'Попробуйте ещё раз', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Use phone-derived email for Supabase auth
      const fakeEmail = `${phone.replace(/\D/g, '')}@vremonte.local`;
      const password = `otp_${phone.replace(/\D/g, '')}_secure`;
      
      try {
        await signIn(fakeEmail, password);
      } catch {
        // If sign in fails, sign up
        await signUp(fakeEmail, password, '', phone);
      }
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wrench className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Времонте</CardTitle>
          <CardDescription>Мастера и заказы в Якутии</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Номер телефона</label>
                <Input
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Отправка...' : 'Получить код'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Тестовый режим: код всегда <span className="font-mono font-bold">123456</span>
              </p>
            </form>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtpValue(''); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Изменить номер
              </button>
              
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  Код отправлен на <span className="font-semibold text-foreground">{phone}</span>
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full"
                disabled={loading || otpValue.length < 6}
                onClick={handleVerifyOtp}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
