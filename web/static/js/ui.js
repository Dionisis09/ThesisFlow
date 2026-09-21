export const STATUS_LABELS = {
  UNDER_ASSIGNMENT: 'Υπό ανάθεση',
  ACTIVE: 'Ενεργή',
  UNDER_EXAM: 'Υπό εξέταση',
  COMPLETED: 'Περατωμένη',
  CANCELED: 'Ακυρωμένη',
};

// Μετατρέπει ειδικούς χαρακτήρες σε ασφαλές HTML πριν εμφανιστούν στη σελίδα.
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Δημιουργεί το κοινό επάνω τμήμα των dashboards.
export function dashboardHero(label, title, description) {
  return `<section class="dashboard-hero">
    <div class="dashboard-hero-copy">
      <p class="dashboard-kicker">${escapeHtml(label)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="dashboard-hero-status"><span aria-hidden="true"></span> Σύστημα διαθέσιμο</div>
  </section>`;
}

// Δημιουργεί μία επαναχρησιμοποιήσιμη κάρτα πλοήγησης.
export function dashboardCard({ href, icon, title, description, tone = 'blue', external = false }) {
  return `<a class="card dashboard-link dashboard-tone-${escapeHtml(tone)}" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>
    <span class="dashboard-icon" aria-hidden="true">${escapeHtml(icon)}</span>
    <span class="dashboard-card-copy">
      <strong>${escapeHtml(title)}</strong>
      <span class="muted">${escapeHtml(description)}</span>
    </span>
    <span class="dashboard-arrow" aria-hidden="true">→</span>
  </a>`;
}

// Μετατρέπει την εσωτερική κατάσταση της βάσης σε ορατό badge.
export function statusBadge(status) {
  return `<span class="status status-${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

// Εμφανίζει ημερομηνία της βάσης με ελληνική τοπική μορφή.
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('el-GR');
}

// Προσαρμόζει την ημερομηνία για input τύπου datetime-local.
export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// Εμφανίζει κοινό μήνυμα επιτυχίας ή σφάλματος στην κορυφή της σελίδας.
export function showMessage(text, type = 'success') {
  const node = document.querySelector('#page-message');
  if (!node) return;
  node.textContent = text;
  node.className = `message message-${type}`;
  node.hidden = false;
  node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function clearMessage() {
  const node = document.querySelector('#page-message');
  if (node) node.hidden = true;
}

export function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

// Δημιουργεί την κοινή σύνοψη μιας διπλωματικής για καθηγητή ή γραμματεία.
export function thesisSummary(thesis) {
  return `
    <div class="split">
      <div>
        <h3>${escapeHtml(thesis.topic?.title || 'Χωρίς τίτλο')}</h3>
        <p class="topic-summary">${escapeHtml(thesis.topic?.summary || '')}</p>
      </div>
      ${statusBadge(thesis.status)}
    </div>
    <div class="meta-list">
      <span><strong>Φοιτητής:</strong> ${escapeHtml(thesis.student?.fullName)} (${escapeHtml(thesis.student?.am)})</span>
      <span><strong>Επιβλέπων:</strong> ${escapeHtml(thesis.supervisor?.fullName)}</span>
      ${thesis.role ? `<span><strong>Ρόλος:</strong> ${thesis.role === 'SUPERVISOR' ? 'Επιβλέπων' : 'Μέλος τριμελούς'}</span>` : ''}
    </div>`;
}
