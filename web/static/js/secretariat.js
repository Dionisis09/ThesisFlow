import { api } from './api.js?v=20260920-1';
import { dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, thesisSummary, toLocalInput } from './ui.js?v=20260920-1';

const content = () => document.querySelector('#page-content');
const currentYear = new Date().getFullYear();

// Δημιουργεί την αρχική σελίδα και τις βασικές επιλογές της γραμματείας.
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

// Επιλέγει τις επιτρεπόμενες διοικητικές ενέργειες από την κατάσταση της διπλωματικής.
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
    const validGrades = thesis.grades?.filter((grade) => grade.value >= 0 && grade.value <= 10);
    const readyToComplete = validGrades?.length === 3 && thesis.finalRepositoryUrl;
    let disabledAttribute = 'disabled';
    let requirementMessage = '<span class="muted small">Απαιτούνται 3 βαθμοί και σύνδεσμος Νημερτή.</span>';
    if (readyToComplete) {
      disabledAttribute = '';
      requirementMessage = '';
    }
    blocks.push(`<button class="button button-success button-small" data-action="complete" ${disabledAttribute}>Περάτωση</button>${requirementMessage}`);
  }
  return blocks.join('');
}

// Μετατρέπει μία διπλωματική σε κάρτα διαχείρισης της γραμματείας.
function adminThesisCard(thesis) {
  let presentationDate = '—';
  if (thesis.presentation) presentationDate = formatDate(thesis.presentation.date);

  let repositoryLink = '—';
  if (thesis.finalRepositoryUrl) {
    repositoryLink = `<a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank">Νημερτής</a>`;
  }

  return `<article class="card" data-thesis="${escapeHtml(thesis.id)}">
    ${thesisSummary(thesis)}
    <div class="meta-list">
      <span><strong>Τριμελής:</strong> ${escapeHtml(thesis.members?.map((member) => member.fullName).join(', ') || '—')}</span>
      <span><strong>Παρουσίαση:</strong> ${presentationDate}</span>
      <span><strong>Χρόνος από ανάθεση:</strong> ${escapeHtml(thesis.elapsedDays)} ημέρες</span>
      <span><strong>Βαθμοί:</strong> ${thesis.grades?.length || 0}/3 · <strong>Τελικό κείμενο:</strong> ${repositoryLink}</span>
    </div>
    <div class="stack section">${managementControls(thesis)}</div>
  </article>`;
}

// Φορτώνει τις διπλωματικές και εφαρμόζει το επιλεγμένο φίλτρο κατάστασης.
async function theses() {
  content().innerHTML = `<div class="card inline"><label>Κατάσταση<select id="status-filter">
    <option value="ALL">Όλες</option><option value="UNDER_ASSIGNMENT">Υπό ανάθεση</option><option value="ACTIVE">Ενεργές</option><option value="UNDER_EXAM">Υπό εξέταση</option><option value="COMPLETED">Περατωμένες</option><option value="CANCELED">Ακυρωμένες</option>
  </select></label></div><div id="admin-thesis-list" class="section"></div>`;
  const load = async () => {
    const selectedStatus = document.querySelector('#status-filter').value;
    // GET: ζητά τις διπλωματικές της επιλεγμένης κατάστασης.
    const data = await api(`/api/admin/theses?status=${selectedStatus}`);
    const list = document.querySelector('#admin-thesis-list');
    let thesisCards = empty('Δεν βρέθηκαν διπλωματικές.');
    if (data.items.length) thesisCards = data.items.map(adminThesisCard).join('');
    list.innerHTML = thesisCards;
    bindManagement(load);
  };
  document.querySelector('#status-filter').addEventListener('change', load);
  await load();
}

// Ολοκληρώνει τη διπλωματική όταν υπάρχουν τρεις βαθμοί και τελικό κείμενο.
async function completeThesis(event, thesisId, reload) {
  const action = event.target.dataset.action;
  if (action !== 'complete') return;
  try {
    // PATCH: στέλνει thesisId και action complete.
    await api('/api/admin/theses', { method: 'PATCH', body: { thesisId, action } });
    showMessage('Η κατάσταση ενημερώθηκε.');
    await reload();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Καταχωρίζει τον αριθμό και το έτος της επίσημης απόφασης ανάθεσης.
async function recordAssignment(event, thesisId, reload) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // PATCH: στέλνει τα στοιχεία της πράξης ΓΣ για την ανάθεση.
    await api('/api/admin/theses', {
      method: 'PATCH',
      body: {
        thesisId,
        action: 'record_assignment',
        gsNumber: form.gsNumber.value,
        gsYear: form.gsYear.value,
      },
    });
    showMessage('Το πρακτικό ανάθεσης καταχωρίστηκε.');
    await reload();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Ακυρώνει διοικητικά μία διπλωματική και καταγράφει την αιτιολογία.
async function cancelThesis(event, thesisId, reload) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!confirm('Να ακυρωθεί οριστικά η διπλωματική;')) return;

  try {
    // PATCH: στέλνει πράξη ΓΣ, έτος και λόγο ακύρωσης.
    await api('/api/admin/theses', {
      method: 'PATCH',
      body: {
        thesisId,
        action: 'cancel',
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

// Συνδέει τις φόρμες κάθε κάρτας με τις αντίστοιχες διοικητικές ενέργειες.
function bindManagement(reload) {
  content().querySelectorAll('[data-thesis]').forEach((card) => {
    const thesisId = card.dataset.thesis;
    card.addEventListener('click', (event) => completeThesis(event, thesisId, reload));
    card.querySelector('[data-role="assignment"]')?.addEventListener(
      'submit',
      (event) => recordAssignment(event, thesisId, reload),
    );
    card.querySelector('[data-role="cancel"]')?.addEventListener(
      'submit',
      (event) => cancelThesis(event, thesisId, reload),
    );
  });
}

// Ενημερώνει ημερομηνία και αίθουσα μιας παρουσίασης.
async function updatePresentation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // PATCH: στέλνει id παρουσίασης, νέα ημερομηνία και αίθουσα.
    await api('/api/admin/presentations', {
      method: 'PATCH',
      body: {
        id: form.dataset.presentation,
        date: form.date.value,
        room: form.room.value,
      },
    });
    showMessage('Η παρουσίαση ενημερώθηκε.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Φορτώνει όλες τις παρουσιάσεις για έλεγχο από τη γραμματεία.
async function presentations() {
  // GET: παίρνει τις παρουσιάσεις μαζί με τα στοιχεία των διπλωματικών.
  const data = await api('/api/admin/presentations');

  let presentationForms = empty('Δεν υπάρχουν παρουσιάσεις.');
  if (data.items.length) {
    presentationForms = data.items.map((item) => `<form class="card form-grid" data-presentation="${escapeHtml(item.id)}">
    <div class="full split"><div><h3>${escapeHtml(item.thesis.topic.title)}</h3><p class="muted">${escapeHtml(item.thesis.student.fullName)} · ${escapeHtml(item.thesis.supervisor.fullName)}</p></div>${statusBadge(item.thesis.status)}</div>
    <label>Ημερομηνία και ώρα<input name="date" type="datetime-local" value="${toLocalInput(item.date)}" required></label>
    <label>Αίθουσα<input name="room" value="${escapeHtml(item.room)}"></label>
    <div class="full"><button class="button button-primary button-small">Αποθήκευση</button></div>
  </form>`).join('');
  }

  content().innerHTML = presentationForms;
  content().querySelectorAll('[data-presentation]').forEach((form) => {
    form.addEventListener('submit', updatePresentation);
  });
}

// Διαβάζει το επιλεγμένο τοπικό αρχείο και μετατρέπει το JSON σε αντικείμενο.
function readJsonFile(input) {
  const file = input.files[0];
  if (!file) return Promise.resolve(null);
  return file.text().then((text) => JSON.parse(text));
}

// Βρίσκει ένα file input και επιστρέφει το περιεχόμενο JSON του.
function selectedJsonFile(inputSelector) {
  const input = document.querySelector(inputSelector);
  return readJsonFile(input);
}

// Εμφανίζει την αναφορά εισαγωγής σε μορφοποιημένο JSON.
function showImportReport(value) {
  const reportSection = document.querySelector('#import-report');
  reportSection.hidden = false;
  reportSection.querySelector('pre').textContent = JSON.stringify(value, null, 2);
}

// Ελέγχει το αρχείο προσώπων χωρίς να γράψει δεδομένα στη βάση.
async function previewPeopleImport() {
  try {
    const peoplePayload = await selectedJsonFile('#people-file');
    if (!peoplePayload) throw new Error('Επιλέξτε People JSON.');

    // POST dryRun: ζητά μόνο έλεγχο και αναφορά, χωρίς εισαγωγή.
    const preview = await api('/api/admin/import/people?dryRun=1', {
      method: 'POST',
      body: peoplePayload,
    });
    showImportReport(preview);
    showMessage('Η προεπισκόπηση ολοκληρώθηκε.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Εκτελεί την πραγματική εισαγωγή προσώπων και προαιρετικά ακαδημαϊκής κατάστασης.
async function submitDataImport() {
  try {
    const peoplePayload = await selectedJsonFile('#people-file');
    if (!peoplePayload) throw new Error('Επιλέξτε People JSON.');

    // POST: εισάγει ή ενημερώνει φοιτητές και διδάσκοντες.
    const peopleResult = await api('/api/admin/import/people', {
      method: 'POST',
      body: peoplePayload,
    });
    const result = { people: peopleResult };

    const academicPayload = await selectedJsonFile('#academic-file');
    if (academicPayload) {
      // POST: ενημερώνει την ακαδημαϊκή κατάσταση με βάση τον ΑΜ.
      result.academic = await api('/api/admin/import/academic-status', {
        method: 'POST',
        body: academicPayload,
      });
    }

    showImportReport(result);
    showMessage('Η εισαγωγή ολοκληρώθηκε.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Δημιουργεί τη σελίδα εισαγωγής και συνδέει τα δύο κουμπιά.
async function importData() {
  content().innerHTML = `<section class="card stack">
    <h2>Αρχεία εισαγωγής JSON</h2>
    <label>Φοιτητές και διδάσκοντες<input id="people-file" type="file" accept="application/json,.json" required></label>
    <label>Ακαδημαϊκή κατάσταση (προαιρετικό)<input id="academic-file" type="file" accept="application/json,.json"></label>
    <div class="inline"><button id="preview-button" class="button button-secondary">Προεπισκόπηση</button><button id="import-button" class="button button-success">Εισαγωγή</button></div>
  </section><section id="import-report" class="card section" hidden><h2>Αναφορά</h2><pre></pre></section>`;
  document.querySelector('#preview-button').addEventListener('click', previewPeopleImport);
  document.querySelector('#import-button').addEventListener('click', submitDataImport);
}

// Επιλέγει τη σωστή σελίδα γραμματείας από το page key του main.js.
export async function renderAdmin(page) {
  const renderers = {
    'admin-dashboard': dashboard,
    'admin-theses': theses,
    'admin-presentations': presentations,
    'admin-import': importData,
  };
  return renderers[page]();
}
