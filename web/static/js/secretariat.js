import { api } from './api.js';
import { dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, thesisSummary, toLocalInput } from './ui.js';

const content = () => document.querySelector('#page-content');
const currentYear = new Date().getFullYear();

function dashboard() {
  const cards = [
    { href: '/admin/theses', icon: 'ΔΕ', title: 'Διπλωματικές', description: 'Πρακτικά ανάθεσης, ακυρώσεις και περάτωση.', tone: 'blue' },
    { href: '/admin/presentations', icon: 'ΠΡ', title: 'Παρουσιάσεις', description: 'Έλεγχος ημερομηνιών και αιθουσών.', tone: 'violet' },
    { href: '/admin/import', icon: 'ΕΙ', title: 'Εισαγωγή δεδομένων', description: 'Φοιτητές, διδάσκοντες και ακαδημαϊκή κατάσταση.', tone: 'green' },
    { href: '/api/public/presentations', icon: 'JS', title: 'Δημόσιο JSON feed', description: 'Ανακοινώσεις παρουσιάσεων σε JSON.', tone: 'amber', external: true },
    { href: '/api/public/presentations?format=xml', icon: 'XM', title: 'Δημόσιο XML feed', description: 'Μηχανικά αναγνώσιμη μορφή XML.', tone: 'slate', external: true },
  ];
  content().innerHTML = `
    ${dashboardHero('Χώρος γραμματείας', 'Η διαχείριση, συγκεντρωμένη.', 'Χειρίσου διπλωματικές, παρουσιάσεις και εισαγωγές δεδομένων από ένα σημείο.')}
    <div class="dashboard-section-title"><div><p class="eyebrow">Γρήγορη πρόσβαση</p><h2>Διαχείριση συστήματος</h2></div><span>${cards.length} επιλογές</span></div>
    <div class="grid dashboard-grid">${cards.map(dashboardCard).join('')}</div>`;
}

function managementControls(thesis) {
  const blocks = [];
  if (thesis.status === 'ACTIVE') {
    blocks.push(`<form data-role="assignment" class="inline">
      <input class="compact-input" name="gsNumber" value="${escapeHtml(thesis.assignmentGsNumber || '')}" placeholder="Αριθμός πρακτικού ΓΣ" required>
      <input class="compact-input" name="gsYear" type="number" value="${escapeHtml(thesis.assignmentGsYear || currentYear)}" required>
      <button class="button button-secondary button-small">Καταχώριση ανάθεσης</button>
    </form>`);
  }
  if (['ACTIVE', 'UNDER_EXAM'].includes(thesis.status)) {
    blocks.push(`<details><summary>Ακύρωση διπλωματικής</summary><form data-role="cancel" class="form-grid section">
      <label>Αριθμός ΓΣ<input name="gsNumber" required></label><label>Έτος ΓΣ<input name="gsYear" type="number" value="${currentYear}" required></label>
      <label class="full">Λόγος ακύρωσης<textarea name="reason" required></textarea></label>
      <div class="full"><button class="button button-danger button-small">Ακύρωση</button></div>
    </form></details>`);
  }
  if (thesis.status === 'UNDER_EXAM') {
    const ready = thesis.grades?.filter((grade) => grade.value >= 0 && grade.value <= 10).length === 3 && thesis.finalRepositoryUrl;
    blocks.push(`<button class="button button-success button-small" data-action="complete" ${ready ? '' : 'disabled'}>Περάτωση</button>${ready ? '' : '<span class="muted small">Απαιτούνται 3 βαθμοί και σύνδεσμος Νημερτή.</span>'}`);
  }
  return blocks.join('');
}

function adminThesisCard(thesis) {
  return `<article class="card" data-thesis="${escapeHtml(thesis.id)}">
    ${thesisSummary(thesis)}
    <div class="meta-list">
      <span><strong>Τριμελής:</strong> ${escapeHtml(thesis.members?.map((member) => member.fullName).join(', ') || '—')}</span>
      <span><strong>Παρουσίαση:</strong> ${thesis.presentation ? formatDate(thesis.presentation.date) : '—'}</span>
      <span><strong>Χρόνος από ανάθεση:</strong> ${escapeHtml(thesis.elapsedDays)} ημέρες</span>
      <span><strong>Βαθμοί:</strong> ${thesis.grades?.length || 0}/3 · <strong>Τελικό κείμενο:</strong> ${thesis.finalRepositoryUrl ? `<a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank">Νημερτής</a>` : '—'}</span>
    </div>
    <div class="stack section">${managementControls(thesis)}</div>
  </article>`;
}

async function theses() {
  content().innerHTML = `<div class="card inline"><label>Κατάσταση<select id="status-filter">
    <option value="ALL">Όλες</option><option value="UNDER_ASSIGNMENT">Υπό ανάθεση</option><option value="ACTIVE">Ενεργές</option><option value="UNDER_EXAM">Υπό εξέταση</option><option value="COMPLETED">Περατωμένες</option><option value="CANCELED">Ακυρωμένες</option>
  </select></label></div><div id="admin-thesis-list" class="section"></div>`;
  const load = async () => {
    const data = await api(`/api/admin/theses?status=${document.querySelector('#status-filter').value}`);
    const list = document.querySelector('#admin-thesis-list');
    list.innerHTML = data.items.length ? data.items.map(adminThesisCard).join('') : empty('Δεν βρέθηκαν διπλωματικές.');
    bindManagement(load);
  };
  document.querySelector('#status-filter').addEventListener('change', load);
  await load();
}

function bindManagement(reload) {
  content().querySelectorAll('[data-thesis]').forEach((card) => {
    const thesisId = card.dataset.thesis;
    card.addEventListener('click', async (event) => {
      const action = event.target.dataset.action; if (!action) return;
      try { await api('/api/admin/theses', { method: 'PATCH', body: { thesisId, action } }); showMessage('Η κατάσταση ενημερώθηκε.'); await reload(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
    card.querySelector('[data-role="assignment"]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget;
      try { await api('/api/admin/theses', { method: 'PATCH', body: { thesisId, action: 'record_assignment', gsNumber: form.gsNumber.value, gsYear: form.gsYear.value } }); showMessage('Το πρακτικό ανάθεσης καταχωρίστηκε.'); await reload(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
    card.querySelector('[data-role="cancel"]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget;
      if (!confirm('Να ακυρωθεί οριστικά η διπλωματική;')) return;
      try { await api('/api/admin/theses', { method: 'PATCH', body: { thesisId, action: 'cancel', gsNumber: form.gsNumber.value, gsYear: form.gsYear.value, reason: form.reason.value } }); showMessage('Η διπλωματική ακυρώθηκε.'); await reload(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
  });
}

async function presentations() {
  const data = await api('/api/admin/presentations');
  content().innerHTML = data.items.length ? data.items.map((item) => `<form class="card form-grid" data-presentation="${escapeHtml(item.id)}">
    <div class="full split"><div><h3>${escapeHtml(item.thesis.topic.title)}</h3><p class="muted">${escapeHtml(item.thesis.student.fullName)} · ${escapeHtml(item.thesis.supervisor.fullName)}</p></div>${statusBadge(item.thesis.status)}</div>
    <label>Ημερομηνία και ώρα<input name="date" type="datetime-local" value="${toLocalInput(item.date)}" required></label>
    <label>Αίθουσα<input name="room" value="${escapeHtml(item.room)}"></label>
    <div class="full"><button class="button button-primary button-small">Αποθήκευση</button></div>
  </form>`).join('') : empty('Δεν υπάρχουν παρουσιάσεις.');
  content().querySelectorAll('[data-presentation]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/api/admin/presentations', { method: 'PATCH', body: { id: form.dataset.presentation, date: form.date.value, room: form.room.value } }); showMessage('Η παρουσίαση ενημερώθηκε.'); }
    catch (error) { showMessage(error.message, 'error'); }
  }));
}

function readJsonFile(input) {
  const file = input.files[0];
  if (!file) return Promise.resolve(null);
  return file.text().then((text) => JSON.parse(text));
}

async function importData() {
  content().innerHTML = `<section class="card stack">
    <h2>Αρχεία εισαγωγής JSON</h2>
    <label>Φοιτητές και διδάσκοντες<input id="people-file" type="file" accept="application/json,.json" required></label>
    <label>Ακαδημαϊκή κατάσταση (προαιρετικό)<input id="academic-file" type="file" accept="application/json,.json"></label>
    <div class="inline"><button id="preview-button" class="button button-secondary">Προεπισκόπηση</button><button id="import-button" class="button button-success">Εισαγωγή</button></div>
  </section><section id="import-report" class="card section" hidden><h2>Αναφορά</h2><pre></pre></section>`;
  const report = (value) => {
    const section = document.querySelector('#import-report'); section.hidden = false;
    section.querySelector('pre').textContent = JSON.stringify(value, null, 2);
  };
  const people = () => readJsonFile(document.querySelector('#people-file'));
  const academic = () => readJsonFile(document.querySelector('#academic-file'));
  document.querySelector('#preview-button').addEventListener('click', async () => {
    try { const payload = await people(); if (!payload) throw new Error('Επιλέξτε People JSON.'); report(await api('/api/admin/import/people?dryRun=1', { method: 'POST', body: payload })); showMessage('Η προεπισκόπηση ολοκληρώθηκε.'); }
    catch (error) { showMessage(error.message, 'error'); }
  });
  document.querySelector('#import-button').addEventListener('click', async () => {
    try {
      const peoplePayload = await people(); if (!peoplePayload) throw new Error('Επιλέξτε People JSON.');
      const result = { people: await api('/api/admin/import/people', { method: 'POST', body: peoplePayload }) };
      const academicPayload = await academic();
      if (academicPayload) result.academic = await api('/api/admin/import/academic-status', { method: 'POST', body: academicPayload });
      report(result); showMessage('Η εισαγωγή ολοκληρώθηκε.');
    } catch (error) { showMessage(error.message, 'error'); }
  });
}

export async function renderAdmin(page) {
  const renderers = {
    'admin-dashboard': dashboard,
    'admin-theses': theses,
    'admin-presentations': presentations,
    'admin-import': importData,
  };
  return renderers[page]();
}
