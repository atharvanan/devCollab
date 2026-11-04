'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code2, Eye, EyeOff, Mail, Lock, ArrowRight, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { loginUser } from '@/store/slices/authSlice';
import { useToast } from '@/components/ui/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const TEST_BOTS = [
  { name: 'Alex Rivera', role: 'Frontend Dev', email: 'alex.frontend@devcollab.com', badge: 'Frontend' },
  { name: 'Sarah Chen', role: 'Backend Dev', email: 'sarah.backend@devcollab.com', badge: 'Backend' },
  { name: 'David Kim', role: 'QA Tester', email: 'david.qa@devcollab.com', badge: 'QA' },
  { name: 'Emma Watson', role: 'UI/UX Designer', email: 'emma.designer@devcollab.com', badge: 'Designer' },
  { name: 'Lucas Vance', role: 'DevOps Engineer', email: 'lucas.devops@devcollab.com', badge: 'DevOps' },
];

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginFormData = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { toast } = useToast();
  const { loading, error } = useAppSelector((s) => s.auth);
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedData, setUnverifiedData] = useState<{
    userId?: string;
    email?: string;
  } | null>(null);

  useEffect(() => {
    document.title = 'Sign In | DevCollab';
  }, []);

  const handleTestBotLogin = async (botEmail: string) => {
    setValue('email', botEmail);
    setValue('password', 'DevCollab123!');
    await onSubmit({ email: botEmail, password: 'DevCollab123!' });
  };

  const onSubmit = async (data: LoginFormData) => {
    setUnverifiedData(null);
    const result = await dispatch(loginUser(data));

    if (loginUser.fulfilled.match(result)) {
      const payload = result.payload as any;
      if (payload?.requiresOTP) {
        toast.info('OTP verification code sent to your email.');
        const params = new URLSearchParams();
        if (payload.userId) params.set('userId', payload.userId);
        if (payload.email) params.set('email', payload.email);
        params.set('mode', 'login');
        router.push(`/verify-otp?${params.toString()}`);
        return;
      }
      toast.success('Welcome back! Redirecting to your dashboard...');
      router.push('/dashboard');
    } else if (
      result.payload &&
      typeof result.payload === 'object' &&
      (result.payload as any).isUnverified
    ) {
      const payload = result.payload as any;
      const userId = payload.userId || '';
      const email = payload.email || data.email;
      setUnverifiedData({ userId, email });
    } else {
      const errMessage =
        (result.payload as string) ||
        'Invalid email or password. Please try again.';
      toast.error(errMessage);
    }
  };

  const goToVerify = () => {
    if (!unverifiedData) return;
    const { userId, email } = unverifiedData;
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (email) params.set('email', email);
    router.push(`/verify-otp?${params.toString()}`);
  };

  // If unverified, show a dedicated state instead of the form
  if (unverifiedData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
        </div>
        <div className="w-full max-w-sm space-y-6 text-center">
          {/* Logo */}
          <Link href="/" className="inline-block">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-lg">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </Link>

          {/* Email icon with animation */}
          <div className="space-y-3">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
              <MailCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit verification code to{' '}
              <strong className="text-foreground">{unverifiedData.email}</strong>.
              Please check your inbox (and spam folder).
            </p>
          </div>



          <div className="space-y-3">
            <Button onClick={goToVerify} className="w-full" size="lg">
              Enter Verification Code <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <button
              onClick={() => setUnverifiedData(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid-subtle px-4 py-8 relative">
      {/* Top Bar Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group transition-transform hover:scale-105">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center mx-auto shadow-md shadow-primary/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your DevCollab collaborative workspace
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-xl shadow-black/5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-sm font-medium block">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                className="pl-10"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium block">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pl-10 pr-10"
                {...register('password')}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && !error.toLowerCase().includes('verify') && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive text-center font-medium">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Sign In
          </Button>
        </form>

        {/* 1-Click Test Bot Quick Sign-In */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold">
              🤖 Quick Test Bot Sign-In
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground text-center mb-2">
            Click any bot to sign in instantly without needing email OTP:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEST_BOTS.map((bot) => (
              <button
                key={bot.email}
                type="button"
                onClick={() => handleTestBotLogin(bot.email)}
                disabled={loading}
                className="flex flex-col items-start p-2 text-left rounded-lg border border-border/80 hover:border-primary/50 hover:bg-muted/50 transition-all text-xs group cursor-pointer"
              >
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-[11px] truncate w-full">
                  {bot.name}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {bot.badge} • Instant Sign In
                </span>
              </button>
            ))}
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Create one free
            </Link>
          </p>
          <p>
            <Link
              href="/verify-otp"
              className="text-xs hover:text-primary transition-colors"
            >
              Have a verification code?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
