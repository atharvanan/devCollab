'use client';
import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Code2, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { setCredentials } from '@/store/slices/authSlice';
import { useToast } from '@/components/ui/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const OTP_LENGTH = 6;

function VerifyOTPContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const userId = searchParams.get('userId') || '';
  const initialEmail = searchParams.get('email') || '';
  const initialCode = searchParams.get('code') || '';

  // OTP was already triggered if we arrived from login/register with URL params
  const otpAlreadySent = !!(userId || initialEmail);

  const [digits, setDigits] = useState<string[]>(
    initialCode && initialCode.length === OTP_LENGTH ? initialCode.split('') : Array(OTP_LENGTH).fill('')
  );
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(otpAlreadySent);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    document.title = 'Verify Email | DevCollab';
  }, []);

  // Auto-focus first OTP input once OTP has been sent
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    }
  }, [otpSent]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH && digits.every((d) => d !== '');

  const handleChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    // Handle paste of multiple digits into a single box
    if (value.length > 1) {
      const stripped = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const arr = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < stripped.length; i++) arr[i] = stripped[i];
      setDigits(arr);
      const focusIdx = Math.min(stripped.length, OTP_LENGTH - 1);
      inputsRef.current[focusIdx]?.focus();
      return;
    }
    next[idx] = value;
    setDigits(next);
    setError('');
    if (value && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        setDigits(next);
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const arr = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) arr[i] = pasted[i];
    setDigits(arr);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
    setError('');
  };

  const handleVerify = useCallback(async (otpOverride?: string) => {
    const code = otpOverride || otp;
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    if (!userId && !email) {
      setError('Email address is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/verify-otp', {
        userId: userId || undefined,
        email: email || undefined,
        otp: code,
      });

      dispatch(
        setCredentials({
          user: res.data.data.user,
          accessToken: res.data.data.accessToken,
        })
      );

      setSuccess(true);
      toast.success('Email verified! Taking you to your dashboard...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Invalid code. Please check and try again.';
      setError(msg);
      // Shake the inputs
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [otp, userId, email, dispatch, router, toast]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (isComplete && !loading && !success) {
      handleVerify(otp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, otp]);

  /** Step 1 (manual flow only): user enters email and clicks Send OTP */
  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setSendingOtp(true);
    setError('');
    try {
      await apiClient.post('/auth/resend-otp', { email: trimmedEmail });
      setOtpSent(true);
      setResendCooldown(60);
      toast.success('Verification code sent to your email!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send code. Please check your email.';
      if (msg.toLowerCase().includes('already verified')) {
        setError('This account is already verified. Please sign in instead.');
      } else {
        setError(msg);
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResend = async () => {
    if (!userId && !email) {
      setError('Email address is required to resend');
      return;
    }
    setResending(true);
    setError('');
    try {
      await apiClient.post('/auth/resend-otp', {
        userId: userId || undefined,
        email: email || undefined,
      });

      toast.success('Verification code resent to your email!');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      setResendCooldown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to resend code';
      if (msg.toLowerCase().includes('already verified')) {
        toast.info('This account is already verified. Redirecting to sign in...');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
        </div>
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Verification Successful!</h2>
          <p className="text-muted-foreground text-sm">Redirecting you to your dashboard...</p>
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ─── STEP 1: No params → ask for email and trigger OTP send ────────────────
  if (!otpSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <Link href="/" className="inline-block group transition-transform hover:scale-105">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-lg">
                <Code2 className="w-6 h-6 text-white" />
              </div>
            </Link>
            <div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Enter verification code</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your account email to receive a 6-digit code
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="verify-email" className="text-sm font-medium block">
                Account email
              </label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium text-center">{error}</p>
            )}

            <Button
              onClick={handleSendOtp}
              className="w-full"
              size="lg"
              loading={sendingOtp}
              disabled={sendingOtp || !email.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Verification Code
            </Button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLoginMode = searchParams.get('mode') === 'login';

  // ─── STEP 2: OTP sent → show the 6-box entry UI ──────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle showLabel className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs px-3 py-1.5 rounded-lg" />
      </div>
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group transition-transform hover:scale-105">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-lg">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </Link>
          <div>
            <div className="w-12 h-12 bg-primary/10 rounded-sm flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isLoginMode ? 'Sign-In Verification' : 'Verify your email'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {email ? (
                <>
                  We sent a 6-digit code to{' '}
                  <strong className="text-foreground font-semibold">{email}</strong>
                </>
              ) : (
                'Enter the 6-digit verification code from your email'
              )}
            </p>
          </div>
        </div>

        {/* OTP Input Boxes */}
        <div className="space-y-3">
          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                maxLength={1}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                className={`w-11 sm:w-14 h-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-sm border-2 focus:outline-none transition-all duration-150 bg-background text-foreground
                  ${d
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-input hover:border-muted-foreground/50'
                  }
                  ${error ? 'border-destructive animate-shake' : ''}
                  focus:border-primary focus:ring-0`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium text-center">{error}</p>
          )}

          {loading && (
            <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Verifying...
            </p>
          )}

          {isComplete && !loading && !error && (
            <p className="text-xs text-muted-foreground text-center">
              ✓ Code complete — verifying automatically
            </p>
          )}
        </div>

        {/* Manual verify button (shown when not auto-submitting) */}
        {!isComplete && (
          <Button
            onClick={() => handleVerify()}
            className="w-full"
            size="lg"
            disabled={loading || otp.length === 0}
            loading={loading}
          >
            Verify & Continue
          </Button>
        )}

        {/* Resend & navigation */}
        <div className="space-y-3 text-center">
          <div>
            {resendCooldown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend available in{' '}
                <span className="font-semibold text-foreground">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50 flex items-center gap-1.5 mx-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Sending new code...' : "Didn't receive the code? Resend"}
              </button>
            )}
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyOTPContent />
    </Suspense>
  );
}
