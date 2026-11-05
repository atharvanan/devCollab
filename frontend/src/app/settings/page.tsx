'use client';
import { useState, useRef, useEffect } from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Mail,
  Github,
  User,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { updateUser, clearAuth } from '@/store/slices/authSlice';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { user } = useAppSelector((s) => s.auth);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [github, setGithub] = useState(user?.github || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetCodeLoading, setResetCodeLoading] = useState(false);

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      toast.error('Please enter your password to confirm account deletion.');
      return;
    }
    try {
      setDeleteLoading(true);
      const res = await apiClient.delete('/users/account', {
        data: { password: deletePassword },
      });
      toast.success(res.data.message || 'Your account has been deleted.');
      setDeleteModalOpen(false);
      dispatch(clearAuth());
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete account. Please verify your password.');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Account Settings | DevCollab';
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setGithub(user.github || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  const updateProfile = useMutation(
    async () => {
      await apiClient.patch('/users/profile', {
        name: name.trim(),
        bio: bio.trim(),
        github: github.trim(),
      });
    },
    {
      onSuccess: () => {
        dispatch(updateUser({ name: name.trim(), bio: bio.trim(), github: github.trim() }));
        toast.success('Your profile settings have been updated successfully!');
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to update settings. Please try again.';
        toast.error(msg);
      },
    }
  );

  const uploadAvatar = useMutation(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/uploads/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data.avatar;
    },
    {
      onSuccess: (url) => {
        setAvatar(url);
        dispatch(updateUser({ avatar: url }));
        toast.success('Profile avatar updated successfully!');
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to upload avatar image.';
        toast.error(msg);
      },
    }
  );

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.patch('/users/password', {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      toast.success('Your password has been changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to change password. Please check your current password.';
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!user?.email) {
      toast.error('No email address associated with your account.');
      return;
    }

    setResetCodeLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: user.email });
      toast.success('Password reset verification code sent to your email!');

      const params = new URLSearchParams({ email: user.email });

      setTimeout(() => {
        router.push(`/reset-password?${params.toString()}`);
      }, 800);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send reset code.';
      toast.error(msg);
    } finally {
      setResetCodeLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your personal profile, developer presence, and account security.
          </p>
        </div>

        {/* Profile Card */}
        <div className="p-4 sm:p-6 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="relative group shrink-0">
            <Avatar src={avatar} name={name || user?.name || 'User'} size={72} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadAvatar.isLoading}
              title="Upload new avatar"
              aria-label="Upload new avatar"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) uploadAvatar.mutate(e.target.files[0]);
              }}
            />
          </div>

          <div className="text-center sm:text-left min-w-0 flex-1 space-y-1">
            <p className="text-base font-semibold text-foreground truncate">{name || user?.name}</p>
            {user?.email && (
              <a
                href={`mailto:${user.email}`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 justify-center sm:justify-start"
                title={`Send email to ${user.email}`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </a>
            )}
            {uploadAvatar.isLoading && (
              <p className="text-xs text-primary animate-pulse mt-1">Uploading avatar image...</p>
            )}
          </div>
        </div>

        {/* Profile Settings Form */}
        <div className="p-5 sm:p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">
            Public Profile
          </h2>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Developer Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Write a brief developer bio or team role..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground text-right mt-1">
              {bio.length}/200 characters
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">GitHub Username</label>
            <Input
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="e.g. torvalds"
            />
          </div>

          <Button
            loading={updateProfile.isLoading}
            onClick={() => updateProfile.mutate()}
            className="w-full sm:w-auto"
          >
            Save Profile Changes
          </Button>
        </div>

        {/* Security & Password Reset Section */}
        <div className="p-5 sm:p-6 rounded-xl border border-border bg-card space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" /> Security & Password
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update your account password or request a reset code if you forgot it.
              </p>
            </div>
          </div>

          {/* Direct Password Change Form */}
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              loading={passwordLoading}
              disabled={!newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" /> Update Password
            </Button>
          </form>

          {/* Forgot Password Section / Reset Code */}
          <div className="pt-4 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-foreground">Forgot your existing password?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send a 6-digit verification code to <span className="font-medium text-foreground">{user?.email}</span> to reset your credentials.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={resetCodeLoading}
              onClick={handleSendResetCode}
              className="shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Send Reset Code
            </Button>
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Danger Zone — Delete Account
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Permanently delete your DevCollab account, personal credentials, and project memberships.
                This action is irreversible and immediately wipes your active session.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeletePassword('');
                setDeleteModalOpen(true);
              }}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0 font-semibold"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete Account
            </Button>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        {deleteModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteModalOpen(false)}
          >
            <div
              className="bg-card border border-destructive/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Confirm Account Deletion</h3>
                    <p className="text-xs text-muted-foreground">Irreversible action</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive leading-relaxed">
                <p className="font-semibold mb-1">Warning: Permanent Data Removal</p>
                <p>
                  All your personal profile data, notifications, and memberships will be deleted.
                  If you are the Project Owner of projects with other team members, you must transfer project ownership first.
                </p>
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Confirm your current password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showDeletePassword ? 'text' : 'password'}
                      placeholder="Enter your password to verify identity"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                      className="pl-9 pr-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    >
                      {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    loading={deleteLoading}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Yes, Delete My Account
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
