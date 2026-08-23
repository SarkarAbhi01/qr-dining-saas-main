import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center px-4">
      <p className="font-mono text-sm text-chili">403</p>
      <h1 className="font-display text-3xl text-ink">Not on your ticket.</h1>
      <p className="text-slate max-w-sm">Your role doesn't have access to this area.</p>
      <Link to="/login" className="mt-4 text-cobalt underline text-sm">Sign in with a different account</Link>
    </div>
  );
}
