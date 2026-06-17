import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 60;

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
  if (!d) return '';
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 4) out += ') ' + d.slice(4, 7);
  if (d.length >= 7) out += '-' + d.slice(7, 9);
  if (d.length >= 9) out += '-' + d.slice(9, 11);
  return out;
}

function phoneDigits(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^8/, '7');
  return d.length === 11 ? '+' + d : '';
}

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  // Register fields
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [agreed, setAgreed] = useState(false);

  // OTP modal state
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpMode, setOtpMode] = useState<'login' | 'register'>('login');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpTarget, setOtpTarget] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!otpOpen || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [otpOpen, secondsLeft]);

  useEffect(() => {
    if (!otpOpen) return;
    const id = setTimeout(() => inputsRef.current[0]?.focus(), 250);
    return () => clearTimeout(id);
  }, [otpOpen]);

  const focusIndex = (i: number) => setTimeout(() => inputsRef.current[i]?.focus(), 0);
  const resetOtp = (focusFirst = true) => {
    setDigits(Array(OTP_LENGTH).fill(''));
    if (focusFirst) focusIndex(0);
  };

  const generateCode = () =>
    Math.floor(1000 + Math.random() * 9000).toString().padStart(OTP_LENGTH, '0');

  const openOtp = (mode: 'login' | 'register', target: string) => {
    const code = generateCode();
    setSentCode(code);
    setCodeExpiresAt(Date.now() + 5 * 60 * 1000);
    setOtpMode(mode);
    setOtpTarget(target);
    setDigits(Array(OTP_LENGTH).fill(''));
    setErrorMsg('');
    setSecondsLeft(RESEND_SECONDS);
    setOtpOpen(true);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = phoneDigits(loginPhone);
    const email = loginEmail.trim();
    if (!phone && !email) {
      setErrorMsg('Укажите телефон или email');
      return;
    }
    openOtp('login', email || phone);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = phoneDigits(regPhone);
    const email = regEmail.trim().toLowerCase();
    if (!phone) { 
      setErrorMsg('Введите корректный телефон'); 
      return; 
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { 
      setErrorMsg('Введите корректный email'); 
      return; 
    }
    if (!agreed) {
      setErrorMsg('Примите условия соглашения');
      return;
    }
    
    // Проверяем, есть ли уже такой номер
    try {
      const users = JSON.parse(localStorage.getItem('masterbul_users') || '[]');
      if (users.find((u: any) => u.phone === phone)) {
        setErrorMsg('Этот телефон уже зарегистрирован. Войдите в аккаунт.');
        return;
      }
    } catch (e) {
      console.log('Ошибка проверки пользователей:', e);
    }
    
    openOtp('register', phone);
  };

  // ✅ ПРОСТАЯ И РАБОЧАЯ ЛОГИКА ВХОДА
  const submitCode = (code: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    
    // Проверяем код
    if (code !== sentCode || Date.now() > codeExpiresAt) {
      setErrorMsg('Неверный или просроченный код. Попробуйте снова');
      resetOtp();
      submittingRef.current = false;
      return;
    }
    
    setLoading(true);
    
    try {
      const phone = phoneDigits(otpMode === 'login' ? loginPhone : regPhone);
      const email = otpMode === 'login' ? loginEmail.trim() : regEmail.trim().toLowerCase();
      const name = otpMode === 'register' ? regName.trim() : 'Пользователь';
      
      // Получаем список пользователей
      let users = [];
      try {
        users = JSON.parse(localStorage.getItem('masterbul_users') || '[]');
      } catch (e) {
        users = [];
      }
      
      // Ищем пользователя
      let user = users.find((u: any) => u.phone === phone);
      
      if (!user) {
        // Создаём нового пользователя
        user = {
          id: Date.now().toString(),
          name: name,
          phone: phone,
          email: email || '',
          registeredAt: new Date().toISOString(),
        };
        users.push(user);
        localStorage.setItem('masterbul_users', JSON.stringify(users));
      }
      
      // Сохраняем текущего пользователя
      localStorage.setItem('masterbul_current_user', JSON.stringify(user));
      
      // Закрываем модалку
      setOtpOpen(false);
      setLoading(false);
      submittingRef.current = false;
      
      // ✅ ПЕРЕЗАГРУЖАЕМ СТРАНИЦУ — ЭТО ВАЖНО!
      window.location.href = '/';
      
    } catch (err: any) {
      setErrorMsg('Ошибка: ' + err.message);
      setLoading(false);
      submittingRef.current = false;
      resetOtp();
    }
  };

  const handleDigitChange = (index: number, raw: string) => {
    if (errorMsg) setErrorMsg('');
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits]; next[index] = ''; setDigits(next); return;
    }
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH - index).split('');
      const next = [...digits];
      chars.forEach((c, i) => { next[index + i] = c; });
      setDigits(next);
      const nextEmpty = next.findIndex(d => d === '');
      if (next.every(d => d !== '')) { 
        focusIndex(OTP_LENGTH - 1); 
        submitCode(next.join('')); 
      } else { 
        focusIndex(nextEmpty); 
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
        const next = [...digits]; next[index] = ''; setDigits(next); e.preventDefault();
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ''; setDigits(next); focusIndex(index - 1); e.preventDefault();
      }
      if (errorMsg) setErrorMsg('');
    } else if (e.key === 'ArrowLeft' && index > 0) focusIndex(index - 1);
    else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const regValid = phoneDigits(regPhone) && /^\S+@\S+\.\S+$/.test(regEmail.trim()) && agreed;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wrench className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">МастерБул</CardTitle>
          <CardDescription>Найди мастера в своем городе</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Телефон</label>
                  <Input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={loginPhone}
                    onChange={e => setLoginPhone(formatPhone(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email <span className="text-muted-foreground font-normal">(опционально)</span></label>
                  <Input type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">
                  Получить код
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Телефон <span className="text-destructive">*</span></label>
                  <Input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={regPhone}
                    onChange={e => setRegPhone(formatPhone(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                  <Input type="email" placeholder="you@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Имя <span className="text-muted-foreground font-normal">(опционально)</span></label>
                  <Input placeholder="Как к вам обращаться" value={regName} onChange={e => setRegName(e.target.value)} />
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                  <span className="text-muted-foreground leading-snug">
                    Я принимаю условия{' '}
                    <Link to="/terms" target="_blank" className="text-primary underline">Пользовательского соглашения</Link>{' '}
                    и даю согласие на{' '}
                    <Link to="/privacy" target="_blank" className="text-primary underline">обработку персональных данных</Link>
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={!regValid}>
                  Зарегистрироваться
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={otpOpen} onOpenChange={() => {}}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="w-[90vw] max-w-[400px] p-7 sm:p-8 bg-white text-neutral-800 border-0 rounded-2xl shadow-2xl [&>button]:hidden"
        >
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-extrabold text-neutral-900 text-center">
              Введите код подтверждения
            </DialogTitle>
            <DialogDescription className="text-center text-neutral-500">
              Код отправлен на <span className="font-semibold text-neutral-800">{otpTarget}</span>
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
                      filled ? 'bg-[#FFC107] border-[#FFC107] text-[#333333]' : 'bg-white border-[#D1D5DB] text-[#333333]'
                    } focus:border-[#FFC107]`}
                    style={{ caretColor: '#333333' }}
                  />
                );
              })}
            </div>
            {errorMsg && <p className="text-sm font-medium text-red-600">{errorMsg}</p>}
            {loading && <p className="text-sm text-neutral-500">Проверка...</p>}
          </div>

          <div className="rounded-xl border-2 border-dashed border-[#FFC107] bg-amber-50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Ваш код подтверждения</p>
            <p className="text-3xl font-extrabold tracking-[0.4em] text-neutral-900">{sentCode}</p>
            <p className="text-xs text-neutral-500 mt-2">Код действует 5 минут</p>
          </div>

          <div className="text-center text-sm">
            {secondsLeft > 0 ? (
              <span className="text-neutral-500">
                Отправить код повторно через <span className="font-semibold text-neutral-700">{secondsLeft}с</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const code = generateCode();
                  setSentCode(code);
                  setCodeExpiresAt(Date.now() + 5 * 60 * 1000);
                  setSecondsLeft(RESEND_SECONDS);
                  resetOtp();
                  setErrorMsg('');
                }}
                className="text-primary font-semibold hover:underline"
              >
                Отправить код повторно
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOtpOpen(false);
              setDigits(Array(OTP_LENGTH).fill(''));
              setErrorMsg('');
              setSentCode('');
            }}
            className="mt-2 text-sm text-neutral-500 hover:text-neutral-800 hover:underline mx-auto"
          >
            Назад
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
