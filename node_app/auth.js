import { randomBytes, timingSafeEqual } from 'node:crypto';
import { one } from './db.js';

function newCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function loadUser(req, _res, next) {
  req.user = req.session?.userId ? one('SELECT id, email, role FROM User WHERE id = ?', req.session.userId) : null;
  if (req.user && !req.session.csrfToken) req.session.csrfToken = newCsrfToken();
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Login is required.' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied.' });
    next();
  };
}

export function requirePageRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect(`/auth/login?next=${encodeURIComponent(req.path)}`);
    if (req.user.role !== role) return res.redirect('/');
    next();
  };
}

// Only state-changing API requests require a matching session token.
export function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/api/auth/login') return next();
  if (!req.path.startsWith('/api/')) return next();
  if (!req.user) return res.status(401).json({ error: 'Login is required.' });
  const expected = String(req.session.csrfToken || '');
  const supplied = String(req.get('X-CSRF-Token') || '');
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (!expected || left.length !== right.length || !timingSafeEqual(left, right)) {
    return res.status(400).json({ error: 'The session expired. Refresh the page and try again.' });
  }
  next();
}
