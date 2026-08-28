import { useEffect, useState } from 'react';
import { useParams, Outlet, useOutletContext } from 'react-router-dom';
import { QrCode, MessageSquarePlus } from 'lucide-react';

import { customerApi } from '@/api/customer';
import { useCartStore } from '@/store/cartStore';
import { connectSocket, releaseSocket, getSocket } from '@/sockets/socketClient';
import FeedbackModal from '@/components/customer/FeedbackModal';

export default function CustomerApp() {
  const { restaurantSlug, tableId } = useParams();
  const [context, setContext] = useState(null);
  const [error, setError] = useState(null);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const syncSession = useCartStore((s) => s.syncSession);

  async function loadTable() {
    try {
      const data = await customerApi.resolveTable(restaurantSlug, tableId);
      setContext(data);
      syncSession(data.session.id);
    } catch (err) {
      setError(err.response?.data?.message || 'This QR code could not be loaded');
    }
  }

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug, tableId]);

  // Once the bill is settled, the table frees up for the NEXT customer.
  // This tab's session is now historical — block every screen (menu,
  // cart, tracking) rather than letting them keep browsing/ordering
  // against a session that's already closed. A real-time push (not
  // just polling) means this fires the instant a waiter confirms
  // payment, even if the customer is mid-browse on the menu.
  useEffect(() => {
    if (!tableId) return;
    const socket = connectSocket();
    socket.emit('join-table', { tableId });

    const handleClosed = () => setSessionClosed(true);
    socket.on('session:closed', handleClosed);

    return () => {
      socket.off('session:closed', handleClosed);
      releaseSocket();
    };
  }, [tableId]);

  async function refreshSession() {
    if (!context) return;
    try {
      const { session } = await customerApi.getSession(context.session.id);
      setContext((c) => ({ ...c, session }));
      if (session.status === 'CLOSED') setSessionClosed(true);
    } catch {
      // silent — polling failures shouldn't interrupt the customer
    }
  }

  // Restaurant-specific overrides for the shared --customer-* variables
  // (see index.css). Only present once `context` has loaded; falls back
  // to `{}` beforehand so nothing breaks pre-load.
  const theme = context?.restaurant?.theme || {};
  const themeStyle = {
    '--customer-body': theme.bodyColor || undefined,
    '--customer-header': theme.headerColor || undefined,
    '--customer-menu': theme.menuColor || undefined,
    '--customer-menu-hover': theme.hoverColor || undefined,
    '--customer-font': theme.fontFamily ? `'${theme.fontFamily}', var(--font-sans)` : undefined,
    '--customer-font-size': theme.fontSize ? `${theme.fontSize}px` : undefined,
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center px-6 bg-paper">
        <p className="font-mono text-sm text-chili">Unable to open menu</p>
        <p className="text-slate text-sm max-w-xs">{error}</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm text-slate">Loading your table…</p>
      </div>
    );
  }

  if (sessionClosed || context.session.status === 'CLOSED') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6"
        style={{ ...themeStyle, backgroundColor: 'var(--customer-body)', fontFamily: 'var(--customer-font)', fontSize: 'var(--customer-font-size)' }}
      >
        <QrCode size={40} className="customer-menu-accent" />
        <h2 className="font-display text-2xl text-ink">Your bill is settled</h2>
        <p className="text-slate text-sm max-w-xs">
          Aapka bill generate ho chuka hai. Ab aapko dubara QR scan karna hoga to start a new order.
          <br />
          <span className="text-xs">(Your bill has already been generated — please scan the table QR code again to start a new order.)</span>
        </p>

        <button
          onClick={() => setFeedbackOpen(true)}
          className="customer-menu-btn fixed bottom-6 right-6 flex items-center gap-2 rounded-full shadow-lg px-4 py-3 text-sm font-medium"
        >
          <MessageSquarePlus size={16} /> Feedback / Complaint
        </button>
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          sessionId={context.session.id}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ ...themeStyle, backgroundColor: 'var(--customer-body)', fontFamily: 'var(--customer-font)', fontSize: 'var(--customer-font-size)' }}
    >
      <header
        className="sticky top-0 z-10 border-b border-line px-4 py-3"
        style={{ backgroundColor: 'var(--customer-header)' }}
      >
        <p className="font-mono text-[10px] tracking-widest customer-menu-accent uppercase">
          {context.restaurant.name}
        </p>
        <h1 className="font-display text-lg text-ink leading-tight">Table {context.table.tableNumber}</h1>
      </header>

      <Outlet context={{ ...context, refreshSession }} />
    </div>
  );
}

export function useCustomerContext() {
  return useOutletContext();
}
