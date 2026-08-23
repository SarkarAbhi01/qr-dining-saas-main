import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import api from '@/api/client';
import { useAuthStore } from '@/store/authStore';

const ROLE_HOME = {
  SUPERADMIN: '/superadmin',
  OWNER: '/owner',
  MANAGER: '/owner',
  CHEF: '/kitchen',
  WAITER: '/waiter',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = data.data;
      setSession(user, accessToken);
      localStorage.setItem('qr-dining-refresh', refreshToken);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const redirectTo = location.state?.from || ROLE_HOME[user.role] || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="ticket-edge bg-white border border-line rounded-ticket shadow-sm p-8 w-full max-w-sm mt-2"
      >
        <p className="font-mono text-xs tracking-widest text-saffron-dark uppercase mb-2">
          QR Dining SaaS
        </p>
        <h1 className="font-display text-2xl text-ink mb-1">Sign in</h1>
        <p className="text-sm text-slate mb-6">Staff &amp; admin access.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="w-full border border-line rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cobalt/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-line rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cobalt/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
