'use client';
import { useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { setAccessToken } from '@/store/slices/authSlice';

export default function VerifyOTPPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const userId = searchParams.get('userId');

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[idx] = value.slice(-1);
    setDigits(next);
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputsRef.current[idx - 1]?.focus();
  };

  const handleSubmit = async () => {
    setError('');
    const otp = digits.join('');
    if (otp.length !== 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/verify-otp', { userId, otp });
      dispatch(setAccessToken(res.data.data.accessToken));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiClient.post('/auth/resend-otp', { userId });
    } catch {}
    finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mx-auto">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the 6-digit code we sent you</p>
        </div>

        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              maxLength={1}
              className="w-12 h-14 text-center text-xl font-bold border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} className="w-full" loading={loading}>Verify</Button>

        <button onClick={handleResend} disabled={resending} className="text-sm text-primary hover:underline">
          {resending ? 'Sending...' : "Didn't get the code? Resend"}
        </button>
      </div>
    </div>
  );
}
