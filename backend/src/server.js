require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const initSockets = require('./sockets');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL?.split(',') || '*',
    credentials: true,
  },
});

// Make io accessible inside Express controllers via req.app.get('io')
app.set('io', io);

initSockets(io);

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    server.listen(PORT, () => {
      console.log(`🚀 API + Socket.io server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
