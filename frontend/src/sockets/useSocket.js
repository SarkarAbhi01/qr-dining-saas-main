import { useEffect } from 'react';
import { connectSocket, releaseSocket, getSocket } from './socketClient';

/**
 * Connects the shared socket for the lifetime of the owning component
 * and registers event listeners. Safe to use from multiple components
 * at once (e.g. navigating between Waiter sub-pages, or a layout +
 * page both listening) — the underlying socket is reference-counted
 * and only actually disconnects once every consumer has unmounted.
 *
 *   useSocket({ 'order:new': handleNewOrder, 'order:update': handleUpdate });
 */
export function useSocket(handlers) {
  useEffect(() => {
    const socket = connectSocket();
    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));

    return () => {
      Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
      releaseSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return getSocket();
}
