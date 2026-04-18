import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OTP_LENGTH = 4;
const TEST_OTP_CODE = '1234';
const RESEND_SECONDS = 60;

export default function AuthPage() {
  const [otpOpen, setOtpOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const submittingRef = useRef(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!otpOpen) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [otpOpen, secondsLeft]);

  const focusIndex = (i: number) => {
    setTimeout(() => inputsRef.current[i]?.focus(), 0);
  };

  useEffect(() => {
    if (!otpOpen) return;
    const id = setTimeout(() => inputsRef.current[0]?.focus(), 250);
    return () => clearTimeout(id);
  }, [otpOpen]);

  const resetOtp = (focusFirst = true) => {
    setDigits(Array(OTP_LENGTH).fill(''));
    if (focusFirst) focusIndex(0);
  };

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
    resetOtp(false);
    setErrorMsg('');
    setOtpOpen(true);
    toast({ title: 'Код отправлен', description: `Тестовый код: ${TEST_OTP_CODE}` });
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    await sendOtp();
    resetOtp();
    setErrorMsg('');
    toast({ title: 'Код отправлен повторно', description: `Тестовый код: ${TEST_OTP_CODE}` });
  };

  const submitCode = async (code: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (code !== TEST_OTP_CODE) {
      setErrorMsg('Неверный код. Попробуйте ещё раз');
      resetOtp();
      submittingRef.current = false;
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
      resetOtp();
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleDigitChange = (index: number, raw: string) => {
    if (errorMsg) setErrorMsg('');
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      // cleared via typing
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Handle paste / multi-char
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH - index).split('');
      const next = [...digits];
      chars.forEach((c, i) => { next[index + i] = c; });
      setDigits(next);
      const lastFilled = Math.min(index + chars.length, OTP_LENGTH) - 1;
      const nextEmpty = next.findIndex(d => d === '');
      if (next.every(d => d !== '')) {
        focusIndex(OTP_LENGTH - 1);
        submitCode(next.join(''));
      } else {
        focusIndex(nextEmpty === -1 ? lastFilled : nextEmpty);
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (index < OTP_LENGTH - 1) focusIndex(index + 1);
    if (next.every(d => d !== '')) {
      submitCode(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
        if (errorMsg) setErrorMsg('');
        e.preventDefault();
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        focusIndex(index - 1);
        if (errorMsg) setErrorMsg('');
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
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
              Тестовый режим: код всегда <span className="font-mono font-bold">{TEST_OTP_CODE}</span>
            </p>
          </form>
        </CardContent>
      </Card>

      <Dialog open={otpOpen} onOpenChange={() => { /* locked */ }}>
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

          <div className="flex flex-col items-center py-2 gap-3">
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                const filled = digits[i] !== '';
                return (
                  <input
                    key={i}
                    ref={el => (inputsRef.current[i] = el)}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digits[i]}
                    disabled={loading}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`h-14 w-14 text-center text-2xl font-bold rounded-lg border-2 outline-none transition-colors ${
                      filled
                        ? 'bg-[#FFC107] border-[#FFC107] text-[#333333]'
                        : 'bg-white border-[#D1D5DB] text-[#333333]'
                    } focus:border-[#FFC107]`}
                    style={{ caretColor: '#333333' }}
                  />
                );
              })}
            </div>
            {errorMsg && (
              <p className="text-sm text-neutral-600">{errorMsg}</p>
            )}
            {loading && (
              <p className="text-sm text-neutral-500">Проверка...</p>
            )}
          </div>

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
