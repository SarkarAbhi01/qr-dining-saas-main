import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

// Lazily-created singleton so we don't open a socket before the app
// actually needs real-time features (KDS / Waiter / customer table).
let socket = null;

// Multiple components (e.g. DashboardShell + a page's own useSocket call,
// or quick navigation between Waiter sub-pages) can hold the socket at
// once. Reference-count so we only actually disconnect once nobody is
// listening anymore, instead of yanking it out from under a sibling.
let refCount = 0;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      autoConnect: false,
      auth: (cb) => {
        const token = useAuthStore.getState().accessToken;
        cb({ token });
      },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  refCount += 1;
  if (!s.connected) s.connect();
  return s;
}

export function releaseSocket() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket?.connected) {
    socket.disconnect();
  }
}

// Kept for callers that intentionally want to force-close regardless of
// how many consumers think they still need it (e.g. on logout).
export function disconnectSocket() {
  refCount = 0;
  if (socket?.connected) socket.disconnect();
}
