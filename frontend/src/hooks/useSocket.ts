'use client';
import { useEffect, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

export function useSocket(event: string, handler: (...args: any[]) => void) {
  useEffect(() => {
    const socket = getSocket();
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, handler]);
}

export function useJoinRoom(room: string | null) {
  useEffect(() => {
    if (!room) return;
    const socket = getSocket();
    socket.emit(`${room.split(':')[0]}:join`, room.split(':')[1]);
    return () => { socket.emit(`${room.split(':')[0]}:leave`, room.split(':')[1]); };
  }, [room]);
}

export function useSocketEmit() {
  return useCallback((event: string, ...args: any[]) => {
    getSocket().emit(event, ...args);
  }, []);
}
