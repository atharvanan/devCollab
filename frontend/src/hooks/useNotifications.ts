'use client';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch, useAppSelector } from './useRedux';
import { notificationActions } from '@/store/slices/notificationSlice';
import { useSocket } from './useSocket';

export function useNotifications() {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const { data } = useQuery('notifications', async () => {
    const res = await apiClient.get('/notifications?limit=20');
    return res.data.data;
  }, {
    enabled: !!accessToken,
    onSuccess: (data) => {
      dispatch(notificationActions.setNotifications({ items: data.notifications, unreadCount: data.unreadCount }));
    },
  });

  useSocket('notification:new', () => {
    if (accessToken) qc.invalidateQueries('notifications');
  });

  const markRead = useMutation(async (id: string) => {
    await apiClient.patch(`/notifications/${id}/read`);
    dispatch(notificationActions.markAsRead(id));
  });

  const markAllRead = useMutation(async () => {
    await apiClient.patch('/notifications/read-all');
    dispatch(notificationActions.markAllRead());
  });

  return { notifications: data?.notifications || [], unreadCount: data?.unreadCount || 0, markRead, markAllRead };
}
