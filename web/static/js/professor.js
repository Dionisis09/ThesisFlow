import { api } from './api.js';
import { STATUS_LABELS, dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, thesisSummary } from './ui.js';

const content = () => document.querySelector('#page-content');

function dashboard() {
  const cards = [
    { href: '/prof/topics', icon: 'ΘΕ', title: 'Θέματα', description: 'Δημιουργία, επεξεργασία και PDF περιγραφής.', tone: 'blue' },
    { href: '/prof/assign', icon: 'ΑΝ', title: 'Αρχική ανάθεση', description: 'Ανάθεση διαθέσιμου θέματος σε φοιτητή.', tone: 'violet' },
    { href: '/prof/theses', icon: 'ΔΕ', title: 'Διπλωματικές', description: 'Επίβλεψη, σημειώσεις, εξέταση και βαθμολογία.', tone: 'green' },
    { href: '/prof/invitations', icon: 'ΠΡ', title: 'Προσκλήσεις τριμελούς', description: 'Αποδοχή ή απόρριψη ενεργών προσκλήσεων.', tone: 'amber' },
    { href: '/prof/stats', icon: 'ΣΤ', title: 'Στατιστικά', description: 'Χρόνος ολοκλήρωσης, βαθμοί και πλήθος.', tone: 'slate' },
  ];
  content().innerHTML = `
    ${dashboardHero('Χώρος διδάσκοντα', 'Όλες οι διπλωματικές σε καθαρή εικόνα.', 'Διαχειρίσου θέματα, αναθέσεις, επιτροπές και βαθμολογίες με λιγότερα βήματα.')}
    <div class="dashboard-section-title"><div><p class="eyebrow">Γρήγορη πρόσβαση</p><h2>Ακαδημαϊκές ενέργειες</h2></div><span>${cards.length + 1} επιλογές</span></div>
    <div class="grid dashboard-grid">
      ${cards.map(dashboardCard).join('')}
      <div class="card dashboard-link dashboard-resource dashboard-tone-blue">
        <span class="dashboard-icon" aria-hidden="true">EX</span>
        <span class="dashboard-card-copy"><strong>Εξαγωγές</strong><span class="muted">Κατέβασε τη λίστα διπλωματικών.</span><span class="dashboard-export-links"><a href="/api/prof/theses/export">CSV</a><a href="/api/prof/theses/export.json">JSON</a></span></span>
      </div>
    </div>`;
}

async function topics() {
  const data = await api('/api/prof/topics');
  content().innerHTML = `
    <form id="topic-form" class="card form-grid">
      <label>Τίτλος<input name="title" maxlength="200" required></label>
      <label class="full">Σύνοψη<textarea name="summary" maxlength="3000" required></textarea></label>
      <div class="full"><button class="button button-primary">Δημιουργία θέματος</button></div>
    </form>
    <section class="section"><h2 class="section-heading">Καταχωρισμένα θέματα</h2>
      ${data.items.length ? data.items.map((topic) => `<article class="card" data-topic="${escapeHtml(topic.id)}">
        <div class="split"><div><h3>${escapeHtml(topic.title)}</h3><p class="topic-summary">${escapeHtml(topic.summary)}</p></div><span class="status">${topic.status === 'AVAILABLE' ? 'Διαθέσιμο' : 'Κρυφό'}</span></div>
        <div class="inline">
          ${topic.descriptionUrl ? `<a href="${escapeHtml(topic.descriptionUrl)}" target="_blank">PDF περιγραφής</a>` : ''}
          ${!topic.assigned ? `<button class="button button-secondary button-small" data-action="toggle">${topic.status === 'AVAILABLE' ? 'Απόκρυψη' : 'Δημοσίευση'}</button>
          <input data-role="pdf" type="file" accept="application/pdf" class="compact-input"><button class="button button-secondary button-small" data-action="upload">Ανέβασμα PDF</button>` : '<span class="muted small">Το θέμα έχει ανατεθεί.</span>'}
        </div>
        ${!topic.assigned ? `<details class="section"><summary>Επεξεργασία θέματος</summary><form data-role="edit-topic" class="stack section">
          <label>Τίτλος<input name="title" value="${escapeHtml(topic.title)}" required></label>
          <label>Σύνοψη<textarea name="summary" required>${escapeHtml(topic.summary)}</textarea></label>
          <div><button class="button button-primary button-small">Αποθήκευση αλλαγών</button></div>
        </form></details>` : ''}
      </article>`).join('') : empty('Δεν υπάρχουν θέματα.')}
    </section>`;

  document.querySelector('#topic-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { await api('/api/prof/topics', { method: 'POST', body: { title: form.title.value, summary: form.summary.value } }); showMessage('Το θέμα δημιουργήθηκε.'); await topics(); }
    catch (error) { showMessage(error.message, 'error'); }
  });
  content().querySelectorAll('[data-topic]').forEach((card) => card.addEventListener('click', async (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    try {
      if (action === 'toggle') await api(`/api/prof/topics/${card.dataset.topic}`, { method: 'PATCH', body: { toggle: true } });
      if (action === 'upload') {
        const file = card.querySelector('[data-role="pdf"]').files[0];
        if (!file) throw new Error('Επιλέξτε αρχείο PDF.');
        const formData = new FormData(); formData.append('file', file); formData.append('topicId', card.dataset.topic);
        await api('/api/upload/topic-description', { method: 'POST', body: formData });
      }
      showMessage('Η αλλαγή αποθηκεύτηκε.'); await topics();
    } catch (error) { showMessage(error.message, 'error'); }
  }));
  content().querySelectorAll('[data-role="edit-topic"]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const card = form.closest('[data-topic]');
    try {
      await api(`/api/prof/topics/${card.dataset.topic}`, { method: 'PATCH', body: { title: form.title.value, summary: form.summary.value } });
      showMessage('Το θέμα ενημερώθηκε.'); await topics();
    } catch (error) { showMessage(error.message, 'error'); }
  }));
}

async function assign() {
  content().innerHTML = `<form id="search-form" class="card inline">
    <input class="compact-input" name="q" placeholder="ΑΜ, όνομα ή θέμα"><button class="button button-secondary">Αναζήτηση</button>
  </form><div id="assign-results" class="section"></div>`;
  const renderResults = async () => {
    const form = document.querySelector('#search-form');
    const data = await api(`/api/prof/assign?q=${encodeURIComponent(form.q.value)}`);
    document.querySelector('#assign-results').innerHTML = `<form id="assign-form" class="stack">
      <div class="grid grid-2">
        <section class="card"><h2>Διαθέσιμοι φοιτητές</h2>${data.students.length ? data.students.map((student) => `<label><span><input style="width:auto" type="radio" name="studentId" value="${escapeHtml(student.id)}"> ${escapeHtml(student.am)} · ${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</span></label>`).join('') : empty('Δεν βρέθηκαν διαθέσιμοι φοιτητές.')}</section>
        <section class="card"><h2>Διαθέσιμα θέματα</h2>${data.topics.length ? data.topics.map((topic) => `<label><span><input style="width:auto" type="radio" name="topicId" value="${escapeHtml(topic.id)}"> ${escapeHtml(topic.title)}</span><span class="muted small">${escapeHtml(topic.summary)}</span></label>`).join('') : empty('Δεν βρέθηκαν διαθέσιμα θέματα.')}</section>
      </div><div><button class="button button-success">Ανάθεση θέματος</button></div>
    </form>`;
    document.querySelector('#assign-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const formData = new FormData(event.currentTarget);
      try { await api('/api/prof/assign', { method: 'POST', body: { studentId: formData.get('studentId'), topicId: formData.get('topicId') } }); showMessage('Η αρχική ανάθεση ολοκληρώθηκε.'); await renderResults(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
  };
  document.querySelector('#search-form').addEventListener('submit', (event) => { event.preventDefault(); renderResults().catch((error) => showMessage(error.message, 'error')); });
  await renderResults();
}

function thesisActions(thesis) {
  const actions = [];
  if (thesis.role === 'SUPERVISOR' && thesis.status === 'UNDER_ASSIGNMENT') {
    actions.push(`<button class="button button-danger button-small" data-action="cancel-initial">Αναίρεση ανάθεσης</button>`);
  }
  if (thesis.role === 'SUPERVISOR' && thesis.status === 'ACTIVE' && thesis.presentation) {
    actions.push(`<button class="button button-primary button-small" data-action="under-exam">Μετάβαση σε υπό εξέταση</button>`);
  }
  if (thesis.role === 'SUPERVISOR' && thesis.canSupervisorCancel) {
    actions.push(`<details><summary>Ακύρωση μετά τη διετία</summary><form data-role="cancel-active" class="form-grid section">
      <label>Αριθμός ΓΣ<input name="gsNumber" required></label><label>Έτος ΓΣ<input name="gsYear" type="number" value="${new Date().getFullYear()}" required></label>
      <label class="full">Λόγος ακύρωσης<textarea name="reason" required></textarea></label>
      <div class="full"><button class="button button-danger button-small">Ακύρωση</button></div>
    </form></details>`);
  }
  if (thesis.role === 'SUPERVISOR' && thesis.status === 'UNDER_EXAM' && !thesis.gradingOpen) {
    actions.push(`<button class="button button-primary button-small" data-action="open-grading">Ενεργοποίηση βαθμολόγησης</button>`);
  }
  if (thesis.status === 'UNDER_EXAM' && thesis.gradingOpen) {
    actions.push(`<details><summary>Αναλυτική βαθμολόγηση</summary><form data-role="grade-form" class="form-grid section">
      <label>Γραπτό κείμενο<input name="written" type="number" min="0" max="10" step="0.1" required></label>
      <label>Παρουσίαση<input name="presentation" type="number" min="0" max="10" step="0.1" required></label>
      <label>Συνολική επίδοση<input name="overall" type="number" min="0" max="10" step="0.1" required></label>
      <label>Σχόλια<input name="comments"></label>
      <div class="full"><button class="button button-success button-small">Καταχώριση μέσου όρου</button></div>
    </form></details>`);
  }
  return actions.join('');
}

function thesisCard(thesis) {
  const members = thesis.members?.map((member) => member.fullName).join(', ') || 'Δεν έχει συμπληρωθεί';
  const invitations = thesis.invitations?.length ? `<div class="table-wrap"><table><thead><tr><th>Πρόσκληση</th><th>Κατάσταση</th><th>Απάντηση</th></tr></thead><tbody>${thesis.invitations.map((item) => `<tr><td>${escapeHtml(item.professor.fullName)}<br><span class="muted small">${formatDate(item.createdAt)}</span></td><td>${escapeHtml(item.status)}</td><td>${formatDate(item.respondedAt)}</td></tr>`).join('')}</tbody></table></div>` : empty('Δεν υπάρχουν προσκλήσεις.');
  const history = thesis.history?.length ? `<ul class="timeline">${thesis.history.map((item) => `<li><strong>${escapeHtml(item.toStatus)}</strong><br><span class="muted small">${formatDate(item.createdAt)} · ${escapeHtml(item.note || '')}</span></li>`).join('')}</ul>` : empty('Δεν υπάρχει ιστορικό.');
  return `<article class="card" data-thesis="${escapeHtml(thesis.id)}">
    ${thesisSummary(thesis)}
    <div class="meta-list">
      <span><strong>Μέλη τριμελούς:</strong> ${escapeHtml(members)}</span>
      <span><strong>Παρουσίαση:</strong> ${thesis.presentation ? `${formatDate(thesis.presentation.date)} · ${escapeHtml(thesis.presentation.room)}` : '—'}</span>
      <span><strong>Χρόνος από ανάθεση:</strong> ${escapeHtml(thesis.elapsedDays)} ημέρες</span>
      <span><strong>Τελικός βαθμός:</strong> ${thesis.finalGrade ?? '—'}</span>
      ${thesis.draftUrl ? `<span><a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Πρόχειρο PDF</a></span>` : ''}
      ${thesis.finalRepositoryUrl ? `<span><a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank" rel="noreferrer">Τελικό κείμενο στη Νημερτή</a></span>` : ''}
    </div>
    <div class="inline section">${thesisActions(thesis)}</div>
    ${thesis.status === 'UNDER_ASSIGNMENT' ? `<details class="section"><summary>Προσκλήσεις τριμελούς</summary>${invitations}</details>` : ''}
    <details class="section"><summary>Χρονολόγιο ενεργειών</summary>${history}</details>
    <form data-role="note-form" class="inline section"><input class="compact-input" name="text" maxlength="300" placeholder="Ιδιωτική σημείωση"><button class="button button-secondary button-small">Προσθήκη</button><button type="button" class="button button-secondary button-small" data-action="notes">Οι σημειώσεις μου</button></form>
    <div data-role="notes" class="section" hidden></div>
  </article>`;
}

async function theses() {
  content().innerHTML = `<div class="card inline">
    <label>Κατάσταση<select id="status-filter"><option value="ALL">Όλες</option><option value="UNDER_ASSIGNMENT">Υπό ανάθεση</option><option value="ACTIVE">Ενεργές</option><option value="UNDER_EXAM">Υπό εξέταση</option><option value="COMPLETED">Περατωμένες</option><option value="CANCELED">Ακυρωμένες</option></select></label>
    <label>Ρόλος<select id="role-filter"><option value="ALL">Όλοι</option><option value="SUPERVISOR">Επιβλέπων</option><option value="COMMITTEE_MEMBER">Μέλος τριμελούς</option></select></label>
    <a class="button button-secondary button-small" href="/api/prof/theses/export">CSV</a><a class="button button-secondary button-small" href="/api/prof/theses/export.json">JSON</a>
  </div><div id="thesis-list" class="section"></div>`;
  const load = async () => {
    const status = document.querySelector('#status-filter').value;
    const role = document.querySelector('#role-filter').value;
    const data = await api(`/api/prof/theses?status=${status}&role=${role}`);
    const list = document.querySelector('#thesis-list');
    list.innerHTML = data.items.length ? data.items.map(thesisCard).join('') : empty('Δεν βρέθηκαν διπλωματικές.');
    bindThesisActions(load);
  };
  document.querySelector('#status-filter').addEventListener('change', load);
  document.querySelector('#role-filter').addEventListener('change', load);
  await load();
}

function bindThesisActions(reload) {
  content().querySelectorAll('[data-thesis]').forEach((card) => {
    const thesisId = card.dataset.thesis;
    card.addEventListener('click', async (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      try {
        if (action === 'cancel-initial') {
          if (!confirm('Να αναιρεθεί η αρχική ανάθεση;')) return;
          await api('/api/thesis/transition', { method: 'POST', body: { thesisId, action: 'cancel_initial' } });
        }
        if (action === 'under-exam') await api('/api/thesis/transition', { method: 'POST', body: { thesisId, action: 'to_under_exam' } });
        if (action === 'open-grading') await api('/api/thesis/transition', { method: 'POST', body: { thesisId, action: 'open_grading' } });
        if (action === 'notes') {
          const data = await api(`/api/prof/theses/${thesisId}/notes`);
          const target = card.querySelector('[data-role="notes"]');
          target.hidden = false;
          target.innerHTML = data.items.length ? `<ul>${data.items.map((note) => `<li>${escapeHtml(note.text)} <span class="muted small">${formatDate(note.createdAt)}</span></li>`).join('')}</ul>` : empty('Δεν υπάρχουν σημειώσεις.');
          return;
        }
        showMessage('Η ενέργεια ολοκληρώθηκε.'); await reload();
      } catch (error) { showMessage(error.message, 'error'); }
    });
    card.querySelector('[data-role="note-form"]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget;
      try { await api(`/api/prof/theses/${thesisId}/notes`, { method: 'POST', body: { text: form.text.value } }); form.reset(); showMessage('Η ιδιωτική σημείωση αποθηκεύτηκε.'); }
      catch (error) { showMessage(error.message, 'error'); }
    });
    card.querySelector('[data-role="grade-form"]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget;
      try { await api('/api/grades', { method: 'POST', body: { thesisId, comments: form.comments.value, criteria: { written: form.written.value, presentation: form.presentation.value, overall: form.overall.value } } }); showMessage('Η αναλυτική βαθμολογία αποθηκεύτηκε.'); await reload(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
    card.querySelector('[data-role="cancel-active"]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget;
      if (!confirm('Να ακυρωθεί οριστικά η διπλωματική;')) return;
      try { await api('/api/thesis/transition', { method: 'POST', body: { thesisId, action: 'cancel_active', gsNumber: form.gsNumber.value, gsYear: form.gsYear.value, reason: form.reason.value } }); showMessage('Η διπλωματική ακυρώθηκε.'); await reload(); }
      catch (error) { showMessage(error.message, 'error'); }
    });
  });
}

async function invitations() {
  const data = await api('/api/committee/invitations');
  content().innerHTML = data.items.length ? data.items.map((item) => `<article class="card split" data-invitation="${escapeHtml(item.id)}">
    <div><h3>${escapeHtml(item.topic)}</h3><div class="meta-list"><span><strong>Φοιτητής:</strong> ${escapeHtml(item.student)}</span><span><strong>Επιβλέπων:</strong> ${escapeHtml(item.supervisor)}</span><span>${formatDate(item.createdAt)}</span></div></div>
    <div class="inline"><button class="button button-success button-small" data-action="accept">Αποδοχή</button><button class="button button-danger button-small" data-action="decline">Απόρριψη</button></div>
  </article>`).join('') : empty('Δεν υπάρχουν ενεργές προσκλήσεις.');
  content().querySelectorAll('[data-invitation]').forEach((card) => card.addEventListener('click', async (event) => {
    const action = event.target.dataset.action; if (!action) return;
    try { await api('/api/committee/invitations', { method: 'PATCH', body: { id: card.dataset.invitation, action } }); showMessage('Η απάντηση αποθηκεύτηκε.'); await invitations(); }
    catch (error) { showMessage(error.message, 'error'); }
  }));
}

function statsGroup(title, data) {
  const maxCount = Math.max(1, ...Object.values(data.counts));
  const bars = Object.entries(data.counts).map(([status, count]) => `<div class="bar-row"><span>${escapeHtml(STATUS_LABELS[status] || status)}</span><div class="bar-track"><div class="bar-fill" style="width:${(count / maxCount) * 100}%"></div></div><strong>${count}</strong></div>`).join('');
  return `<section class="section"><h2 class="section-heading">${title}</h2><div class="grid grid-3">
    <div class="card metric"><span class="muted">Σύνολο</span><strong class="metric-value">${data.total}</strong></div>
    <div class="card metric"><span class="muted">Μέσος βαθμός</span><strong class="metric-value">${data.averageGrade ?? '—'}</strong></div>
    <div class="card metric"><span class="muted">Μέσος χρόνος ολοκλήρωσης</span><strong class="metric-value">${data.averageCompletionDays ?? '—'}${data.averageCompletionDays != null ? ' ημ.' : ''}</strong></div>
  </div><div class="card section"><h3>Πλήθος ανά κατάσταση</h3><div class="bar-chart">${bars}</div></div></section>`;
}

async function stats() {
  const data = await api('/api/prof/stats');
  content().innerHTML = statsGroup('Ως επιβλέπων', data.supervised) + statsGroup('Ως μέλος τριμελούς', data.committee);
}

export async function renderProfessor(page) {
  const renderers = {
    'prof-dashboard': dashboard,
    'prof-topics': topics,
    'prof-assign': assign,
    'prof-theses': theses,
    'prof-invitations': invitations,
    'prof-stats': stats,
  };
  return renderers[page]();
}
