'use client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '@/store';
import { useEffect, useRef } from 'react';
import { refreshAccessToken, fetchMe } from '@/store/slices/authSlice';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAppSelector } from '@/hooks/useRedux';
import { useNotifications } from '@/hooks/useNotifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function GlobalNotificationSync() {
  useNotifications();
  return null;
}

function AppInit({ children }: { children: React.ReactNode }) {
  const { accessToken, initialized } = useAppSelector((s) => s.auth);
  const initDone = useRef(false);

  useEffect(() => {
    if (!initDone.current) {
      initDone.current = true;
      store.dispatch(refreshAccessToken()).then((action: any) => {
        if (action.meta.requestStatus === 'fulfilled') {
          store.dispatch(fetchMe());
        }
      });
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [accessToken]);

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppInit>
          <GlobalNotificationSync />
          {children}
        </AppInit>
      </QueryClientProvider>
    </Provider>
  );
}
