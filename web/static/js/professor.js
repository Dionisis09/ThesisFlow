import { api } from './api.js?v=20260920-1';
import { STATUS_LABELS, dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, thesisSummary } from './ui.js?v=20260920-1';

const content = () => document.querySelector('#page-content');

// Δημιουργεί την αρχική σελίδα και τις βασικές επιλογές του διδάσκοντα.
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

// Δημιουργεί νέο θέμα από τα στοιχεία της φόρμας.
async function createTopic(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // POST: στέλνει τίτλο και σύνοψη για δημιουργία θέματος.
    await api('/api/prof/topics', {
      method: 'POST',
      body: { title: form.title.value, summary: form.summary.value },
    });
    showMessage('Το θέμα δημιουργήθηκε.');
    await topics();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Χειρίζεται δημοσίευση/απόκρυψη θέματος και ανέβασμα του PDF περιγραφής.
async function handleTopicAction(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.currentTarget;
  try {
    if (action === 'toggle') {
      // PATCH: ζητά από το backend να αλλάξει τη διαθεσιμότητα του θέματος.
      await api(`/api/prof/topics/${card.dataset.topic}`, {
        method: 'PATCH',
        body: { toggle: true },
      });
    }
    if (action === 'upload') {
      const file = card.querySelector('[data-role="pdf"]').files[0];
      if (!file) throw new Error('Επιλέξτε αρχείο PDF.');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('topicId', card.dataset.topic);
      // POST multipart: ανεβάζει το PDF μαζί με το id του θέματος.
      await api('/api/upload/topic-description', { method: 'POST', body: formData });
    }
    showMessage('Η αλλαγή αποθηκεύτηκε.');
    await topics();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Αποθηκεύει τις αλλαγές τίτλου και σύνοψης ενός μη ανατεθειμένου θέματος.
async function updateTopic(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const card = form.closest('[data-topic]');
  try {
    // PATCH: ενημερώνει το θέμα που αναγνωρίζεται από το URL.
    await api(`/api/prof/topics/${card.dataset.topic}`, {
      method: 'PATCH',
      body: { title: form.title.value, summary: form.summary.value },
    });
    showMessage('Το θέμα ενημερώθηκε.');
    await topics();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Φορτώνει τα θέματα από το backend και συνδέει τις φόρμες με τους handlers τους.
async function topics() {
  // GET: παίρνει όλα τα θέματα του συνδεδεμένου διδάσκοντα.
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

  document.querySelector('#topic-form').addEventListener('submit', createTopic);
  content().querySelectorAll('[data-topic]').forEach((card) => {
    card.addEventListener('click', handleTopicAction);
  });
  content().querySelectorAll('[data-role="edit-topic"]').forEach((form) => {
    form.addEventListener('submit', updateTopic);
  });
}

// Στέλνει το επιλεγμένο ζεύγος φοιτητή και θέματος για αρχική ανάθεση.
async function submitAssignment(event, reloadChoices) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    // POST: στέλνει studentId και topicId για δημιουργία ανάθεσης.
    await api('/api/prof/assign', {
      method: 'POST',
      body: {
        studentId: formData.get('studentId'),
        topicId: formData.get('topicId'),
      },
    });
    showMessage('Η αρχική ανάθεση ολοκληρώθηκε.');
    await reloadChoices();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Ζητά και εμφανίζει μόνο τους διαθέσιμους φοιτητές και τα διαθέσιμα θέματα.
async function renderAssignmentChoices(searchForm) {
  const query = encodeURIComponent(searchForm.q.value);
  // GET: περνά το κείμενο αναζήτησης ως query parameter q.
  const data = await api(`/api/prof/assign?q=${query}`);
  document.querySelector('#assign-results').innerHTML = `<form id="assign-form" class="stack">
      <div class="grid grid-2">
        <section class="card"><h2>Διαθέσιμοι φοιτητές</h2>${data.students.length ? data.students.map((student) => `<label class="choice-row"><input type="radio" name="studentId" value="${escapeHtml(student.id)}"><span>${escapeHtml(student.am)} · ${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</span></label>`).join('') : empty('Δεν βρέθηκαν διαθέσιμοι φοιτητές.')}</section>
        <section class="card"><h2>Διαθέσιμα θέματα</h2>${data.topics.length ? data.topics.map((topic) => `<label class="choice-row"><input type="radio" name="topicId" value="${escapeHtml(topic.id)}"><span class="choice-copy"><strong>${escapeHtml(topic.title)}</strong><span class="muted small">${escapeHtml(topic.summary)}</span></span></label>`).join('') : empty('Δεν βρέθηκαν διαθέσιμα θέματα.')}</section>
      </div><div><button class="button button-success">Ανάθεση θέματος</button></div>
    </form>`;
  document.querySelector('#assign-form').addEventListener('submit', (event) => {
    submitAssignment(event, () => renderAssignmentChoices(searchForm));
  });
}

// Δημιουργεί τη σελίδα αρχικής ανάθεσης και ενεργοποιεί την αναζήτηση.
async function assign() {
  content().innerHTML = `<form id="search-form" class="card inline">
    <input class="compact-input" name="q" placeholder="ΑΜ, όνομα ή θέμα"><button class="button button-secondary">Αναζήτηση</button>
  </form><div id="assign-results" class="section"></div>`;

  const searchForm = document.querySelector('#search-form');
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderAssignmentChoices(searchForm).catch((error) => showMessage(error.message, 'error'));
  });
  await renderAssignmentChoices(searchForm);
}

// Επιλέγει ποιες ενέργειες επιτρέπονται από τον ρόλο και την κατάσταση της διπλωματικής.
function thesisActions(thesis) {
  const actions = [];
  if (thesis.role === 'SUPERVISOR' && thesis.status === 'UNDER_ASSIGNMENT') {
    actions.push(`<button class="button button-danger button-small" data-action="cancel-initial">Αναίρεση ανάθεσης</button>`);
  }
  if (thesis.role === 'SUPERVISOR' && thesis.status === 'ACTIVE') {
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

// Μετατρέπει τα δεδομένα μιας διπλωματικής σε κάρτα του dashboard.
function thesisCard(thesis) {
  const members = thesis.members?.map((member) => member.fullName).join(', ') || 'Δεν έχει συμπληρωθεί';
  const gradeCount = thesis.grades?.filter((item) => item.value >= 0 && item.value <= 10).length || 0;
  const invitations = thesis.invitations?.length ? `<div class="table-wrap"><table><thead><tr><th>Πρόσκληση</th><th>Κατάσταση</th><th>Απάντηση</th></tr></thead><tbody>${thesis.invitations.map((item) => `<tr><td>${escapeHtml(item.professor.fullName)}<br><span class="muted small">${formatDate(item.createdAt)}</span></td><td>${escapeHtml(item.status)}</td><td>${formatDate(item.respondedAt)}</td></tr>`).join('')}</tbody></table></div>` : empty('Δεν υπάρχουν προσκλήσεις.');
  const history = thesis.history?.length ? `<ul class="timeline">${thesis.history.map((item) => `<li><strong>${escapeHtml(item.toStatus)}</strong><br><span class="muted small">${formatDate(item.createdAt)} · ${escapeHtml(item.note || '')}</span></li>`).join('')}</ul>` : empty('Δεν υπάρχει ιστορικό.');
  return `<article class="card" data-thesis="${escapeHtml(thesis.id)}">
    ${thesisSummary(thesis)}
    <div class="meta-list">
      <span><strong>Μέλη τριμελούς:</strong> ${escapeHtml(members)}</span>
      <span><strong>Ανακοίνωση παρουσίασης:</strong> ${thesis.presentation ? `${escapeHtml(thesis.presentation.title)} · ${formatDate(thesis.presentation.date)} · ${escapeHtml(thesis.presentation.room)}` : '—'}</span>
      <span><strong>Χρόνος από ανάθεση:</strong> ${escapeHtml(thesis.elapsedDays)} ημέρες</span>
      <span><strong>Τελικός βαθμός:</strong> ${thesis.finalGrade ?? '—'}</span>
      ${thesis.draftUrl ? `<span><a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Πρόχειρο PDF</a></span>` : ''}
      ${thesis.finalRepositoryUrl ? `<span><a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank" rel="noreferrer">Τελικό κείμενο στη Νημερτή</a></span>` : ''}
      ${['UNDER_EXAM', 'COMPLETED'].includes(thesis.status) && gradeCount === 3 ? `<span><a href="/api/theses/${escapeHtml(thesis.id)}/exam-record" target="_blank">Πρακτικό εξέτασης</a></span>` : ''}
    </div>
    <div class="inline section">${thesisActions(thesis)}</div>
    ${thesis.status === 'UNDER_ASSIGNMENT' ? `<details class="section"><summary>Προσκλήσεις τριμελούς</summary>${invitations}</details>` : ''}
    <details class="section"><summary>Χρονολόγιο ενεργειών</summary>${history}</details>
    <form data-role="note-form" class="inline section"><input class="compact-input" name="text" maxlength="300" placeholder="Ιδιωτική σημείωση"><button class="button button-secondary button-small">Προσθήκη</button><button type="button" class="button button-secondary button-small" data-action="notes">Οι σημειώσεις μου</button></form>
    <div data-role="notes" class="section" hidden></div>
  </article>`;
}

// Φορτώνει τις διπλωματικές του διδάσκοντα με τα επιλεγμένα φίλτρα.
async function theses() {
  content().innerHTML = `<div class="card inline">
    <label>Κατάσταση<select id="status-filter"><option value="ALL">Όλες</option><option value="UNDER_ASSIGNMENT">Υπό ανάθεση</option><option value="ACTIVE">Ενεργές</option><option value="UNDER_EXAM">Υπό εξέταση</option><option value="COMPLETED">Περατωμένες</option><option value="CANCELED">Ακυρωμένες</option></select></label>
    <label>Ρόλος<select id="role-filter"><option value="ALL">Όλοι</option><option value="SUPERVISOR">Επιβλέπων</option><option value="COMMITTEE_MEMBER">Μέλος τριμελούς</option></select></label>
    <a class="button button-secondary button-small" href="/api/prof/theses/export">CSV</a><a class="button button-secondary button-small" href="/api/prof/theses/export.json">JSON</a>
  </div><div id="thesis-list" class="section"></div>`;
  const load = async () => {
    const status = document.querySelector('#status-filter').value;
    const role = document.querySelector('#role-filter').value;
    // GET: ζητά τις διπλωματικές με φίλτρο κατάστασης και ρόλου.
    const data = await api(`/api/prof/theses?status=${status}&role=${role}`);
    const list = document.querySelector('#thesis-list');
    list.innerHTML = data.items.length ? data.items.map(thesisCard).join('') : empty('Δεν βρέθηκαν διπλωματικές.');
    bindThesisActions(load);
  };
  document.querySelector('#status-filter').addEventListener('change', load);
  document.querySelector('#role-filter').addEventListener('change', load);
  await load();
}

// Συνδέει κάθε κουμπί και φόρμα μιας κάρτας με τη σωστή named function.
function bindThesisActions(reload) {
  content().querySelectorAll('[data-thesis]').forEach((card) => {
    const thesisId = card.dataset.thesis;
    card.addEventListener('click', (event) => {
      handleThesisCardAction(event, card, thesisId, reload);
    });
    card.querySelector('[data-role="note-form"]')?.addEventListener('submit', (event) => {
      addPrivateNote(event, thesisId);
    });
    card.querySelector('[data-role="grade-form"]')?.addEventListener('submit', (event) => {
      submitGrade(event, thesisId, reload);
    });
    card.querySelector('[data-role="cancel-active"]')?.addEventListener('submit', (event) => {
      cancelActiveThesis(event, thesisId, reload);
    });
  });
}

// Αναιρεί μια αρχική ανάθεση που βρίσκεται ακόμη σε αναμονή επιτροπής.
async function cancelInitialAssignment(thesisId, reload) {
  if (!confirm('Να αναιρεθεί η αρχική ανάθεση;')) return;

  // POST: ζητά τη μετάβαση cancel_initial για τη συγκεκριμένη διπλωματική.
  await api('/api/thesis/transition', {
    method: 'POST',
    body: { thesisId, action: 'cancel_initial' },
  });
  showMessage('Η ενέργεια ολοκληρώθηκε.');
  await reload();
}

// Αλλάζει μια ενεργή διπλωματική σε κατάσταση «Υπό εξέταση».
async function moveThesisUnderExam(thesisId, reload) {
  // POST: ο επιβλέπων ζητά τη μετάβαση to_under_exam.
  await api('/api/thesis/transition', {
    method: 'POST',
    body: { thesisId, action: 'to_under_exam' },
  });
  showMessage('Η ενέργεια ολοκληρώθηκε.');
  await reload();
}

// Επιτρέπει στην τριμελή επιτροπή να καταχωρίσει βαθμούς.
async function openThesisGrading(thesisId, reload) {
  // POST: ενεργοποιεί τη βαθμολόγηση για τη συγκεκριμένη διπλωματική.
  await api('/api/thesis/transition', {
    method: 'POST',
    body: { thesisId, action: 'open_grading' },
  });
  showMessage('Η ενέργεια ολοκληρώθηκε.');
  await reload();
}

// Δημιουργεί τη λίστα των ιδιωτικών σημειώσεων του διδάσκοντα.
function privateNotesList(notes) {
  if (!notes.length) return empty('Δεν υπάρχουν σημειώσεις.');

  const items = notes.map((note) => `
    <li>${escapeHtml(note.text)} <span class="muted small">${formatDate(note.createdAt)}</span></li>
  `).join('');
  return `<ul>${items}</ul>`;
}

// Φορτώνει από το backend μόνο τις σημειώσεις του τρέχοντος διδάσκοντα.
async function showPrivateNotes(card, thesisId) {
  // GET: ζητά τις ιδιωτικές σημειώσεις της συγκεκριμένης διπλωματικής.
  const data = await api(`/api/prof/theses/${thesisId}/notes`);
  const notesContainer = card.querySelector('[data-role="notes"]');
  notesContainer.hidden = false;
  notesContainer.innerHTML = privateNotesList(data.items);
}

// Αντιστοιχίζει το data-action του κουμπιού στην κατάλληλη ενέργεια.
async function handleThesisCardAction(event, card, thesisId, reload) {
  const action = event.target.dataset.action;
  const actionHandlers = {
    'cancel-initial': () => cancelInitialAssignment(thesisId, reload),
    'under-exam': () => moveThesisUnderExam(thesisId, reload),
    'open-grading': () => openThesisGrading(thesisId, reload),
    notes: () => showPrivateNotes(card, thesisId),
  };
  const selectedAction = actionHandlers[action];
  if (!selectedAction) return;

  try {
    await selectedAction();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Αποθηκεύει μία ιδιωτική σημείωση που βλέπει μόνο ο δημιουργός της.
async function addPrivateNote(event, thesisId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // POST: στέλνει το κείμενο της σημείωσης για τη συγκεκριμένη διπλωματική.
    await api(`/api/prof/theses/${thesisId}/notes`, {
      method: 'POST',
      body: { text: form.text.value },
    });
    form.reset();
    showMessage('Η ιδιωτική σημείωση αποθηκεύτηκε.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Υποβάλλει τα τρία κριτήρια βαθμολόγησης και τα προαιρετικά σχόλια.
async function submitGrade(event, thesisId, reload) {
  event.preventDefault();
  const form = event.currentTarget;
  const criteria = {
    written: form.written.value,
    presentation: form.presentation.value,
    overall: form.overall.value,
  };

  try {
    // POST: στέλνει thesisId, σχόλια και τις τρεις επιμέρους βαθμολογίες.
    await api('/api/grades', {
      method: 'POST',
      body: { thesisId, comments: form.comments.value, criteria },
    });
    showMessage('Η αναλυτική βαθμολογία αποθηκεύτηκε.');
    await reload();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Ζητά οριστική ακύρωση ενεργής διπλωματικής μετά τη διετία.
async function cancelActiveThesis(event, thesisId, reload) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!confirm('Να ακυρωθεί οριστικά η διπλωματική;')) return;

  try {
    // POST: στέλνει την πράξη ΓΣ και τον λόγο ακύρωσης.
    await api('/api/thesis/transition', {
      method: 'POST',
      body: {
        thesisId,
        action: 'cancel_active',
        gsNumber: form.gsNumber.value,
        gsYear: form.gsYear.value,
        reason: form.reason.value,
      },
    });
    showMessage('Η διπλωματική ακυρώθηκε.');
    await reload();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Δημιουργεί την κάρτα μιας πρόσκλησης συμμετοχής στην τριμελή.
function invitationCard(invitation) {
  return `<article class="card split" data-invitation="${escapeHtml(invitation.id)}">
    <div><h3>${escapeHtml(invitation.topic)}</h3><div class="meta-list"><span><strong>Φοιτητής:</strong> ${escapeHtml(invitation.student)}</span><span><strong>Επιβλέπων:</strong> ${escapeHtml(invitation.supervisor)}</span><span>${formatDate(invitation.createdAt)}</span></div></div>
    <div class="inline"><button class="button button-success button-small" data-action="accept">Αποδοχή</button><button class="button button-danger button-small" data-action="decline">Απόρριψη</button></div>
  </article>`;
}

// Στέλνει αποδοχή ή απόρριψη μιας πρόσκλησης.
async function answerInvitation(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const invitationId = event.currentTarget.dataset.invitation;
  try {
    // PATCH: στέλνει το id της πρόσκλησης και action accept ή decline.
    await api('/api/committee/invitations', {
      method: 'PATCH',
      body: { id: invitationId, action },
    });
    showMessage('Η απάντηση αποθηκεύτηκε.');
    await invitations();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Φορτώνει τις εκκρεμείς προσκλήσεις του συνδεδεμένου διδάσκοντα.
async function invitations() {
  // GET: παίρνει τις ενεργές προσκλήσεις τριμελούς από το backend.
  const data = await api('/api/committee/invitations');
  content().innerHTML = data.items.length
    ? data.items.map(invitationCard).join('')
    : empty('Δεν υπάρχουν ενεργές προσκλήσεις.');

  content().querySelectorAll('[data-invitation]').forEach((card) => {
    card.addEventListener('click', answerInvitation);
  });
}

// Δημιουργεί μία ομάδα στατιστικών για επίβλεψη ή συμμετοχή σε τριμελή.
function statsGroup(title, data) {
  // Object.entries μετατρέπει το αντικείμενο counts σε ζεύγη [κατάσταση, πλήθος].
  const statusCounts = Object.entries(data.counts).map(([status, count]) => `
    <div class="status-count">
      <span>${escapeHtml(STATUS_LABELS[status] || status)}</span>
      <strong>${count}</strong>
    </div>
  `).join('');
  return `<section class="section"><h2 class="section-heading">${title}</h2><div class="grid grid-3">
    <div class="card metric"><span class="muted">Σύνολο</span><strong class="metric-value">${data.total}</strong></div>
    <div class="card metric"><span class="muted">Μέσος βαθμός</span><strong class="metric-value">${data.averageGrade ?? '—'}</strong></div>
    <div class="card metric"><span class="muted">Μέσος χρόνος ολοκλήρωσης</span><strong class="metric-value">${data.averageCompletionDays ?? '—'}${data.averageCompletionDays != null ? ' ημ.' : ''}</strong></div>
  </div><div class="card section"><h3>Πλήθος ανά κατάσταση</h3><div class="status-count-list">${statusCounts}</div></div></section>`;
}

// Φορτώνει και εμφανίζει τα στατιστικά του διδάσκοντα.
async function stats() {
  // GET: παίρνει ξεχωριστά στατιστικά ως επιβλέπων και ως μέλος τριμελούς.
  const data = await api('/api/prof/stats');
  content().innerHTML = statsGroup('Ως επιβλέπων', data.supervised) + statsGroup('Ως μέλος τριμελούς', data.committee);
}

// Επιλέγει τη σωστή σελίδα διδάσκοντα από το page key του main.js.
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
