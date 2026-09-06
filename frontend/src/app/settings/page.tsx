'use client';
import { useState, useRef } from 'react';
import { useMutation } from 'react-query';
import { Camera } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { updateUser } from '@/store/slices/authSlice';

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [github, setGithub] = useState(user?.github || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  const updateProfile = useMutation(async () => {
    await apiClient.patch('/users/profile', { name, bio, github });
  }, {
    onSuccess: () => {
      dispatch(updateUser({ name, bio, github }));
    }
  });

  const uploadAvatar = useMutation(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/uploads/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data.avatar;
  }, {
    onSuccess: (url) => {
      setAvatar(url);
      dispatch(updateUser({ avatar: url }));
    }
  });

  return (
    <DashboardLayout>
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={avatar} name={name} size={64} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
            >
              <Camera className="w-3 h-3 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) uploadAvatar.mutate(e.target.files[0]); }}
            />
          </div>
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">GitHub username</label>
            <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="octocat" />
          </div>
          <Button loading={updateProfile.isLoading} onClick={() => updateProfile.mutate()}>Save Changes</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
