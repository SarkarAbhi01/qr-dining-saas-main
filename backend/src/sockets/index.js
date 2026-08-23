// Socket.io wiring.
//
// Two kinds of clients connect:
//  1. Staff (Owner/Manager/Chef/Waiter) — authenticated via the same JWT
//     access token used for REST calls, passed in the handshake `auth`.
//     They're auto-joined to role-relevant rooms on connect.
//  2. Customers (QR flow) — unauthenticated. They explicitly join a
//     `table:{tableId}` room via the `join-table` event so they can get
//     pushed live order-status updates instead of only polling.
//
// Room convention:
//   restaurant:{restaurantId}            -> all staff for a tenant (owner live view)
//   restaurant:{restaurantId}:kitchen    -> KDS clients (Chef)
//   restaurant:{restaurantId}:waiters    -> Waiter clients
//   table:{tableId}                      -> that table's customer session

const { verifyAccessToken } = require('../utils/jwt');

function initSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Unauthenticated customer socket — allowed, just no role rooms.
      socket.data.isStaff = false;
      return next();
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.isStaff = true;
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.restaurantId = payload.restaurantId;
      next();
    } catch {
      // Expired/invalid token — degrade to unauthenticated rather than
      // rejecting the connection outright.
      socket.data.isStaff = false;
      next();
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.isStaff && socket.data.restaurantId) {
      const { restaurantId, role } = socket.data;
      socket.join(`restaurant:${restaurantId}`);
      if (role === 'CHEF' || role === 'OWNER' || role === 'MANAGER') {
        socket.join(`restaurant:${restaurantId}:kitchen`);
      }
      if (role === 'WAITER' || role === 'OWNER' || role === 'MANAGER') {
        socket.join(`restaurant:${restaurantId}:waiters`);
      }
    }

    // Customer flow: join the room for their specific table so kitchen/
    // waiter actions push live updates to their order-tracking screen.
    socket.on('join-table', ({ tableId }) => {
      if (tableId) socket.join(`table:${tableId}`);
    });

    socket.on('disconnect', () => {
      // no-op — socket.io handles room cleanup automatically
    });
  });
}

module.exports = initSockets;
