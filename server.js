import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { loadUser, requirePageRole, verifyCsrf } from './node_app/auth.js';
import { loginPage, PAGE_DEFINITIONS, roleHome, workspacePage } from './node_app/pages.js';
import { registerRoutes } from './node_app/routes.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATIC_FOLDER = path.join(ROOT, 'web', 'static');
const UPLOAD_FOLDER = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

// Δημιουργεί και ρυθμίζει ολόκληρη την εφαρμογή Express.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(session({
    name: 'thesisflow.sid',
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'local-development-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 },
  }));
  // Συνδέει κάθε request με τον χρήστη που υπάρχει στο session.
  app.use(loadUser);

  // Εφαρμόζει την ίδια πολιτική ασφαλείας σε σελίδες, APIs και στατικά αρχεία.
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(verifyCsrf);

  // Κρατά τα versioned αρχεία frontend περισσότερο στην cache από τα uploads.
  app.use('/static', express.static(STATIC_FOLDER, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      const longLived = ['.css', '.js', '.svg'].includes(path.extname(filePath).toLowerCase());
      res.setHeader('Cache-Control', longLived ? 'public, max-age=3600, must-revalidate' : 'public, max-age=300');
    },
  }));
  app.use('/uploads', express.static(UPLOAD_FOLDER, {
    etag: true,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=300'),
  }));

  app.get('/auth/login', (req, res) => {
    if (req.user) return res.redirect(roleHome(req.user.role));
    res.type('html').send(loginPage());
  });
  app.get('/', (req, res) => res.redirect(req.user ? roleHome(req.user.role) : '/auth/login'));

  for (const [route, pageDefinition] of Object.entries(PAGE_DEFINITIONS)) {
    // Το destructuring δίνει όνομα στα τρία στοιχεία κάθε ορισμού σελίδας.
    const [allowedRole, pageTitle, pageKey] = pageDefinition;
    app.get(route, requirePageRole(allowedRole), (req, res) => {
      const html = workspacePage(req.user, pageTitle, pageKey, req.session.csrfToken);
      res.type('html').send(html);
    });
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  });
  // Συνδέει όλα τα API routes με την εφαρμογή και τον μηχανισμό upload.
  registerRoutes(app, upload, UPLOAD_FOLDER);

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found.' });
    res.status(404).type('text').send('Page not found.');
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'The file is larger than 12 MB.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Unexpected server error.' });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Ξεκινά HTTP server μόνο όταν το αρχείο εκτελείται άμεσα, όχι στα tests.
  const port = Number(process.env.PORT || 5000);
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`ThesisFlow running at http://127.0.0.1:${port}`);
  });
}
