'use client';
import { useState, useRef, useEffect } from 'react';
import { useMutation } from 'react-query';
import { Camera, Check, AlertCircle, Mail, Github, User } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { updateUser } from '@/store/slices/authSlice';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { user } = useAppSelector((s) => s.auth);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [github, setGithub] = useState(user?.github || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

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
      await apiClient.patch('/users/profile', { name: name.trim(), bio: bio.trim(), github: github.trim() });
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

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your personal profile, bio, and developer presence.
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
            {/* Clickable email */}
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

        {/* Settings Form */}
        <div className="space-y-4">
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
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
