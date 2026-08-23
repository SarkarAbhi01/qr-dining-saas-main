import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center px-4">
      <p className="font-mono text-sm text-slate">404</p>
      <h1 className="font-display text-3xl text-ink">This table isn't set.</h1>
      <p className="text-slate max-w-sm">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-4 text-cobalt underline text-sm">Back to home</Link>
    </div>
  );
}
