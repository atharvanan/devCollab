'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code2, Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotFormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      toast.success('Password reset instructions sent! Check your inbox.');
      setSubmittedEmail(data.email);

      const params = new URLSearchParams({ email: data.email });

      setTimeout(() => {
        router.push(`/reset-password?${params.toString()}`);
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send reset code. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid-subtle px-4 py-8 relative">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group transition-transform hover:scale-105">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center mx-auto shadow-md shadow-primary/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Account Recovery</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot your password?</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Enter your registered email address and we&apos;ll send you a 6-digit verification code to reset it.
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
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="pl-10"
                  {...register('email')}
                  error={errors.email?.message}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Send Verification Code <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

