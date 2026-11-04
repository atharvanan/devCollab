'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Code2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const schema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    otp: z.string().length(6, 'Verification code must be exactly 6 digits').regex(/^\d+$/, 'Digits only'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const queryEmail = searchParams.get('email') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: queryEmail,
      otp: '',
      password: '',
      confirmPassword: '',
    },
  });

  const enteredPassword = watch('password') || '';

  // Auto-fill query email when URL is parsed
  useEffect(() => {
    if (queryEmail) setValue('email', queryEmail);
  }, [queryEmail, setValue]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: '', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 25;

    if (score <= 25) return { label: 'Weak', color: 'bg-destructive', percent: 25 };
    if (score <= 50) return { label: 'Fair', color: 'bg-amber-500', percent: 50 };
    if (score <= 75) return { label: 'Good', color: 'bg-sky-500', percent: 75 };
    return { label: 'Strong', color: 'bg-emerald-500', percent: 100 };
  };

  const strength = calculatePasswordStrength(enteredPassword);

  const onSubmit = async (data: ResetFormData) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: data.email,
        otp: data.otp,
        password: data.password,
      });

      toast.success('Your password has been successfully reset! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please check your verification code.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    const email = watch('email');
    if (!email) {
      toast.error('Please enter your email address first.');
      return;
    }

    setResending(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      toast.success('A new verification code has been dispatched to your email.');
      setCountdown(60);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid-subtle px-4 py-8 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group transition-transform hover:scale-105">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center mx-auto shadow-md shadow-primary/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Create New Password</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Set your new password</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Enter the 6-digit verification code from your email and your new password.
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-xl shadow-black/5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-sm font-medium text-foreground block">
                Email address
              </label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="reset-otp" className="text-sm font-medium text-foreground block">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resending || countdown > 0}
                  className="text-xs text-primary hover:underline font-medium disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                </button>
              </div>
              <Input
                id="reset-otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                className="font-mono text-center tracking-[0.35em] text-lg font-bold"
                {...register('otp')}
                error={errors.otp?.message}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="text-sm font-medium text-foreground block">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
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

              {/* Password strength bar */}
              {enteredPassword && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Strength: <span className="font-semibold text-foreground">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="text-sm font-medium text-foreground block">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  className="pl-10 pr-10"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Reset Password & Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Remember your password? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

