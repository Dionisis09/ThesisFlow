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
  app.use(loadUser);

  // Apply the same security policy to pages, APIs and static files.
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

  // Cache versioned front-end assets longer than uploaded documents.
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
  const port = Number(process.env.PORT || 5000);
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`ThesisFlow running at http://127.0.0.1:${port}`);
  });
}
