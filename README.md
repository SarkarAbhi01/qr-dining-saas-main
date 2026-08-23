# QR Contactless Dining & Restaurant Management SaaS

A multi-tenant SaaS platform for QR-based contactless ordering and full
restaurant operations management, built across 6 phases:

1. Project scaffold — Vite React frontend, Express backend, Prisma schema
2. JWT auth + RBAC + Superadmin dashboard (restaurant CRUD, credentials, plans)
3. Owner/Manager dashboard — menu management, table & QR generation, staff
4. Customer QR ordering flow — scan, browse, cart, place order, call waiter, split bill
5. Real-time KDS (Kitchen Display) + Waiter dashboard via Socket.io
6. Cash checkout flow + Reports & Analytics (revenue, top items, peak hours, staff performance)

## Tech stack

- **Frontend:** React (Vite), Tailwind CSS v4, Zustand, Framer Motion, Socket.io client, Recharts
- **Backend:** Node.js, Express, Prisma ORM, Socket.io, JWT
- **Database:** PostgreSQL

## Project structure

```
backend/
  prisma/schema.prisma      # full data model (tenants, users, orders, payments, etc.)
  prisma/seed.js            # bootstraps a Superadmin + subscription plans
  src/
    controllers/            # one per domain (auth, superadmin, menu, tables, staff, kds, waiter, customer, reports)
    routes/                 # Express routers, mounted with role-specific middleware
    middlewares/             # authenticate, authorize, tenantScope, validate, upload
    sockets/                 # Socket.io room wiring
    services/                 # token issuance/rotation
    validators/               # Joi schemas per domain
frontend/
  src/
    pages/{superadmin,owner,kitchen,waiter,customer,auth}/
    components/               # shared UI (Modal, StatCard, CreateRestaurantModal, etc.)
    api/                       # one client module per domain, thin wrappers over axios
    store/                     # Zustand stores (auth, cart)
    sockets/                   # socket client + useSocket hook (ref-counted connection)
    layouts/                   # DashboardShell (desktop sidebar / mobile bottom nav)
```

## Getting started

### 1. Database

You need a PostgreSQL instance. Locally:

```bash
createdb qr_dining_saas
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, etc.
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed          # creates a Superadmin + subscription plans
npm run dev                 # http://localhost:5000
```

The seeded Superadmin credentials come from `SUPERADMIN_EMAIL` /
`SUPERADMIN_PASSWORD` in your `.env` (defaults are in `.env.example` —
change the password before any real deployment).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to `localhost:5000`
(see `vite.config.js`), so both should be running together.

### 4. Try it out

1. Log in as Superadmin → create a restaurant (this also creates its
   Owner account and shows a one-time temporary password).
2. Log in as that Owner → add menu categories/items, generate tables
   (each gets a QR code), add Chef/Waiter staff accounts.
3. Open the QR link for a table (`/order/:slug/:tableId`) in another
   tab/device — no login needed — to try the customer ordering flow.
4. Log in as the Chef to see orders arrive live on the KDS.
5. Log in as the Waiter to see the table grid, service queue, and
   payment collection update in real time as the customer orders.

## Notes & known limitations

- **Payments are cash-only** by design for this build. The schema
  reserves `STRIPE`/`RAZORPAY` as valid `PaymentMethod` values, so wiring
  in a real gateway later is additive rather than a rework.
- The `Payment` model is scoped to a `DiningSession` (not a single
  `Order`), because split-bill checkout can span every order placed
  during that table's sitting.
- CORS/socket origin defaults to `http://localhost:5173` — update
  `CLIENT_URL` in `backend/.env` for other environments.
