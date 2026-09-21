import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN_HTML = fs.readFileSync(path.join(ROOT, 'web', 'login.html'), 'utf8');
const WORKSPACE_HTML = fs.readFileSync(path.join(ROOT, 'web', 'workspace.html'), 'utf8');
const ROLE_LABELS = { STUDENT: 'Student', PROFESSOR: 'Professor', SECRETARIAT: 'Secretariat' };
const ROLE_HOME = { STUDENT: '/student', PROFESSOR: '/prof', SECRETARIAT: '/admin' };
const NAV = {
  STUDENT: [
    ['/student', 'Overview'],
    ['/student/thesis', 'My thesis'],
    ['/student/invitations', 'Committee'],
    ['/student/upload', 'Files and links'],
    ['/student/presentation', 'Presentation'],
    ['/student/profile', 'Profile'],
  ],
  PROFESSOR: [
    ['/prof', 'Overview'],
    ['/prof/topics', 'Topics'],
    ['/prof/assign', 'Initial assignment'],
    ['/prof/theses', 'Theses'],
    ['/prof/invitations', 'Invitations'],
    ['/prof/stats', 'Statistics'],
  ],
  SECRETARIAT: [
    ['/admin', 'Overview'],
    ['/admin/theses', 'Theses'],
    ['/admin/presentations', 'Presentations'],
    ['/admin/import', 'Data import'],
  ],
};

export const PAGE_DEFINITIONS = {
  '/student': ['STUDENT', 'Student dashboard', 'student-dashboard'],
  '/student/thesis': ['STUDENT', 'My thesis', 'student-thesis'],
  '/student/profile': ['STUDENT', 'Student profile', 'student-profile'],
  '/student/invitations': ['STUDENT', 'Committee management', 'student-invitations'],
  '/student/upload': ['STUDENT', 'Thesis material', 'student-upload'],
  '/student/presentation': ['STUDENT', 'Presentation details', 'student-presentation'],
  '/prof': ['PROFESSOR', 'Professor dashboard', 'prof-dashboard'],
  '/prof/topics': ['PROFESSOR', 'My topics', 'prof-topics'],
  '/prof/assign': ['PROFESSOR', 'Initial assignment', 'prof-assign'],
  '/prof/theses': ['PROFESSOR', 'My theses', 'prof-theses'],
  '/prof/invitations': ['PROFESSOR', 'Committee invitations', 'prof-invitations'],
  '/prof/stats': ['PROFESSOR', 'Statistics', 'prof-stats'],
  '/admin': ['SECRETARIAT', 'Secretariat dashboard', 'admin-dashboard'],
  '/admin/theses': ['SECRETARIAT', 'Thesis management', 'admin-theses'],
  '/admin/presentations': ['SECRETARIAT', 'Presentations', 'admin-presentations'],
  '/admin/import': ['SECRETARIAT', 'Data import', 'admin-import'],
};

// Κωδικοποιεί δυναμικές τιμές πριν τοποθετηθούν στα HTML templates.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

// Επιστρέφει το στατικό HTML της σελίδας σύνδεσης.
export function loginPage() {
  return LOGIN_HTML;
}

// Αντιστοιχίζει κάθε ρόλο στην αρχική του σελίδα.
export function roleHome(role) {
  return ROLE_HOME[role] || '/auth/login';
}

// Συμπληρώνει το κοινό HTML template με χρήστη, πλοήγηση και CSRF token.
export function workspacePage(user, title, pageKey, csrfToken) {
  const navigation = (NAV[user.role] || [])
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join('');
  const values = {
    '{{CSRF_TOKEN}}': escapeHtml(csrfToken),
    '{{PAGE_TITLE}}': escapeHtml(title),
    '{{ROLE_LABEL}}': escapeHtml(ROLE_LABELS[user.role] || user.role),
    '{{USER_EMAIL}}': escapeHtml(user.email),
    '{{NAVIGATION}}': navigation,
    '{{PAGE_KEY}}': escapeHtml(pageKey),
  };
  // reduce αντικαθιστά διαδοχικά κάθε placeholder μέσα στο ίδιο template.
  return Object.entries(values).reduce((html, [token, value]) => html.replaceAll(token, value), WORKSPACE_HTML);
}
