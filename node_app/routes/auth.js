import bcrypt from 'bcryptjs';
import { newId, one } from '../db.js';
import { roleHome } from '../pages.js';
import { cleanText } from './helpers.js';

async function login(req, res) {
  const email = cleanText(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) return res.status(400).json({ error: 'Invalid request.' });

  const user = one('SELECT * FROM User WHERE email = ?', email);
  const correctPassword = user && await bcrypt.compare(password, user.passwordHash);
  if (!correctPassword) return res.status(401).json({ error: 'Invalid request.' });

  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'Invalid request.' });
    req.session.userId = user.id;
    req.session.csrfToken = newId();
    return res.json({ redirect: roleHome(user.role) });
  });
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/auth/login'));
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', login);
  app.get('/api/auth/logout', logout);
}
