import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TEST_OTP_CODE = '123456';
const RESEND_SECONDS = 60;

export default function AuthPage() {
  const [otpOpen, setOtpOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Countdown timer for resend
  useEffect(() => {
    if (!otpOpen) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [otpOpen, secondsLeft]);

  // Autofocus OTP input when modal opens (mobile keyboard)
  useEffect(() => {
    if (!otpOpen) return;
    const id = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-input-otp="true"]');
      input?.focus();
    }, 250);
    return () => clearTimeout(id);
  }, [otpOpen]);

  const sendOtp = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    setSecondsLeft(RESEND_SECONDS);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    await sendOtp();
    setOtpValue('');
    setOtpOpen(true);
    toast({ title: 'Код отправлен', description: `Тестовый код: ${TEST_OTP_CODE}` });
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    await sendOtp();
    toast({ title: 'Код отправлен повторно', description: `Тестовый код: ${TEST_OTP_CODE}` });
  };

  const handleVerifyOtp = async () => {
    if (otpValue !== TEST_OTP_CODE) {
      setOtpValue('');
      setErrorMsg('Неверный код. Попробуйте ещё раз');
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('[data-input-otp="true"]');
        input?.focus();
      }, 50);
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const fakeEmail = `${phone.replace(/\D/g, '')}@vremonte.local`;
      const password = `otp_${phone.replace(/\D/g, '')}_secure`;
      try {
        await signIn(fakeEmail, password);
      } catch {
        await signUp(fakeEmail, password, '', phone);
      }
      setOtpOpen(false);
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
        </CardContent>
      </Card>

      {/* OTP Modal */}
      <Dialog open={otpOpen} onOpenChange={() => { /* locked: cannot dismiss by outside click */ }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="w-[90vw] max-w-[400px] p-7 sm:p-8 bg-white text-neutral-800 border-0 rounded-2xl shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 [&>button]:hidden"
        >
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-extrabold text-neutral-900 text-center">
              Введите код подтверждения
            </DialogTitle>
            <DialogDescription className="text-center text-neutral-500">
              Код отправлен на <span className="font-semibold text-neutral-800">{phone}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-2">
            <InputOTP
              ref={otpInputRef}
              maxLength={6}
              value={otpValue}
              onChange={setOtpValue}
              autoFocus
              data-input-otp="true"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-14 w-11 sm:w-12 text-2xl font-bold border-2 border-neutral-300 rounded-lg text-neutral-900 first:rounded-l-lg last:rounded-r-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading || otpValue.length < 6}
            onClick={handleVerifyOtp}
          >
            {loading ? 'Проверка...' : 'Подтвердить'}
          </Button>

          <div className="text-center text-sm">
            {secondsLeft > 0 ? (
              <span className="text-neutral-500">
                Отправить код повторно через <span className="font-semibold text-neutral-700">{secondsLeft}с</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-primary font-semibold hover:underline"
              >
                Отправить код повторно
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
