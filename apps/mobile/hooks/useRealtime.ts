import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL, USE_MOCKS } from '@/services/config';
import { useAuthStore } from '@/stores/auth';
import { qk } from './queries';

/** Notifications temps réel (WebSocket) : rafraîchit soldes et notifications. */
export function useRealtime() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  useEffect(() => {
    if (USE_MOCKS || !token) return;
    const socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
    socket.on('notification', () => void qc.invalidateQueries({ queryKey: qk.notifications }));
    socket.on('balance:changed', () => {
      void qc.invalidateQueries({ queryKey: qk.summary });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [token, qc]);
}
