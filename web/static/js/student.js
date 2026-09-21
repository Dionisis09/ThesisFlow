import { api } from './api.js?v=20260920-1';
import { clearMessage, dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, toLocalInput } from './ui.js?v=20260920-1';

const content = () => document.querySelector('#page-content');

// Δημιουργεί την αρχική σελίδα και τις βασικές επιλογές του φοιτητή.
function dashboard() {
  const cards = [
    { href: '/student/thesis', icon: 'ΔΕ', title: 'Η διπλωματική μου', description: 'Κατάσταση, επιτροπή, βαθμοί και ιστορικό.', tone: 'blue' },
    { href: '/student/invitations', icon: 'ΤΜ', title: 'Τριμελής επιτροπή', description: 'Επιλογή διδασκόντων και πορεία προσκλήσεων.', tone: 'violet' },
    { href: '/student/upload', icon: 'ΑΡ', title: 'Αρχεία και σύνδεσμοι', description: 'Πρόχειρο κείμενο και υποστηρικτικό υλικό.', tone: 'green' },
    { href: '/student/presentation', icon: 'ΠΡ', title: 'Παρουσίαση', description: 'Ημερομηνία, αίθουσα ή τηλεδιάσκεψη.', tone: 'amber' },
    { href: '/student/profile', icon: 'ΠΦ', title: 'Προφίλ', description: 'Στοιχεία επικοινωνίας και προσωπικά δεδομένα.', tone: 'slate' },
  ];
  content().innerHTML = `
    ${dashboardHero('Χώρος φοιτητή', 'Η διπλωματική σου, οργανωμένη.', 'Βρες γρήγορα την κατάσταση, την επιτροπή, τα αρχεία και την παρουσίασή σου.')}
    <div class="dashboard-section-title"><div><p class="eyebrow">Γρήγορη πρόσβαση</p><h2>Οι βασικές ενέργειες</h2></div><span>${cards.length} επιλογές</span></div>
    <div class="grid dashboard-grid">${cards.map(dashboardCard).join('')}</div>`;
}

// Αποθηκεύει τον σύνδεσμο του τελικού κειμένου μετά την ολοκλήρωση της βαθμολόγησης.
async function saveFinalRepository(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  try {
    // POST: στέλνει το URL του τελικού κειμένου στη Νημερτή.
    await api('/api/student/final-repository', {
      method: 'POST',
      body: { url: form.url.value },
    });
    showMessage('Ο σύνδεσμος τελικού κειμένου αποθηκεύτηκε.');
    await studentThesis();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Ενημερώνει τα στοιχεία επικοινωνίας του φοιτητή.
async function updateProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // PATCH: στέλνει διεύθυνση, email και τηλέφωνα στο backend.
    await api('/api/student/profile', {
      method: 'PATCH',
      body: {
        address: form.address.value,
        email: form.email.value,
        mobile: form.mobile.value,
        landline: form.landline.value,
      },
    });
    showMessage('Το προφίλ ενημερώθηκε.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Συλλέγει τους επιλεγμένους κωδικούς διδασκόντων και στέλνει προσκλήσεις.
async function sendCommitteeInvitations(event) {
  event.preventDefault();
  const checkedBoxes = event.currentTarget.querySelectorAll('input[name="codes"]:checked');
  // Το spread μετατρέπει το NodeList σε array ώστε να χρησιμοποιηθεί map.
  const professorCodes = [...checkedBoxes].map((checkbox) => checkbox.value);
  try {
    // POST: στέλνει τους professorCodes για δημιουργία προσκλήσεων τριμελούς.
    await api('/api/committee/invitations', {
      method: 'POST',
      body: { professorCodes },
    });
    showMessage('Οι προσκλήσεις στάλθηκαν.');
    await invitations();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Ανεβάζει το πρόχειρο κείμενο ως multipart PDF.
async function uploadDraft(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData();
  formData.append('file', form.file.files[0]);
  try {
    // POST multipart: στέλνει το επιλεγμένο PDF στο backend.
    await api('/api/upload/thesis-draft', { method: 'POST', body: formData });
    showMessage('Το PDF ανέβηκε επιτυχώς.');
    await upload();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Προσθέτει έναν σύνδεσμο υποστηρικτικού υλικού στη διπλωματική.
async function addMaterial(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // POST: στέλνει περιγραφή και URL υποστηρικτικού υλικού.
    await api('/api/student/materials', {
      method: 'POST',
      body: { label: form.label.value, url: form.url.value },
    });
    showMessage('Ο σύνδεσμος προστέθηκε.');
    form.reset();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Εμφανίζει μόνο το πεδίο αίθουσας ή τηλεδιάσκεψης ανάλογα με τον τρόπο παρουσίασης.
function updatePresentationFields(form) {
  document.querySelector('#room-field').hidden = form.mode.value === 'ONLINE';
  document.querySelector('#meeting-field').hidden = form.mode.value !== 'ONLINE';
}

// Δημιουργεί ή ενημερώνει τα στοιχεία της παρουσίασης.
async function savePresentation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    // POST: στέλνει ημερομηνία, τρόπο, τίτλο και χώρο ή σύνδεσμο.
    await api('/api/student/presentation', {
      method: 'POST',
      body: {
        date: form.date.value,
        mode: form.mode.value,
        title: form.title.value,
        room: form.room.value,
        meetingUrl: form.meetingUrl.value,
      },
    });
    showMessage('Τα στοιχεία παρουσίασης αποθηκεύτηκαν.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Μετατρέπει τα κριτήρια μιας βαθμολογίας σε αναγνώσιμο κείμενο.
function gradeCriteriaText(grade) {
  const hasCriteria = Object.keys(grade.criteria || {}).length > 0;
  if (!hasCriteria) return '—';

  return `Γραπτό ${escapeHtml(grade.criteria.written)} · Παρουσίαση ${escapeHtml(grade.criteria.presentation)} · Σύνολο ${escapeHtml(grade.criteria.overall)}`;
}

// Δημιουργεί τον πίνακα βαθμών της τριμελούς επιτροπής.
function gradeRows(thesis) {
  if (!thesis.grades?.length) return empty('Δεν έχουν καταχωριστεί βαθμοί.');
  return `<div class="table-wrap"><table>
    <thead><tr><th>Διδάσκων</th><th>Κριτήρια</th><th>Βαθμός</th><th>Σχόλια</th></tr></thead>
    <tbody>${thesis.grades.map((grade) => `<tr>
      <td>${escapeHtml(grade.professor.fullName)}</td>
      <td>${gradeCriteriaText(grade)}</td>
      <td>${escapeHtml(grade.value)}</td>
      <td>${escapeHtml(grade.comments || '—')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// Δημιουργεί το χρονολόγιο μεταβάσεων της διπλωματικής.
function thesisHistory(thesis) {
  if (!thesis.history?.length) {
    return empty('Δεν υπάρχουν ακόμη καταγεγραμμένες μεταβάσεις.');
  }

  const items = thesis.history.map((historyItem) => `
    <li><strong>${escapeHtml(historyItem.toStatus)}</strong><br><span class="muted small">${formatDate(historyItem.createdAt)} · ${escapeHtml(historyItem.note || '')}</span></li>
  `).join('');
  return `<ul class="timeline">${items}</ul>`;
}

// Δημιουργεί τη λίστα συνδέσμων του υποστηρικτικού υλικού.
function thesisMaterials(thesis) {
  if (!thesis.materials?.length) return '<span class="muted">—</span>';

  const items = thesis.materials.map((material) => `
    <li><a href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">${escapeHtml(material.label)}</a></li>
  `).join('');
  return `<ul>${items}</ul>`;
}

// Μετρά μόνο βαθμούς μέσα στο επιτρεπτό διάστημα 0–10.
function validGradeCount(thesis) {
  return thesis.grades?.filter((grade) => grade.value >= 0 && grade.value <= 10).length || 0;
}

// Εμφανίζει τη φόρμα τελικού κειμένου μόνο όταν υπάρχουν και οι τρεις βαθμοί.
function finalRepositoryForm(thesis, gradeCount) {
  const canAddRepository = thesis.status === 'UNDER_EXAM'
    && gradeCount === 3
    && !thesis.finalRepositoryUrl;
  if (!canAddRepository) return '';

  return `<form id="repository-form" class="inline section"><input class="compact-input" name="url" type="url" placeholder="Σύνδεσμος Νημερτή" required><button class="button button-primary">Καταχώριση τελικού κειμένου</button></form>`;
}

// Επιστρέφει σύνδεσμο για το πρόχειρο PDF ή παύλα όταν δεν υπάρχει.
function draftLink(thesis) {
  if (!thesis.draftUrl) return '—';
  return `<a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Προβολή PDF</a>`;
}

// Επιστρέφει σύνδεσμο Νημερτή ή παύλα όταν δεν έχει καταχωριστεί.
function finalRepositoryLink(thesis) {
  if (!thesis.finalRepositoryUrl) return '—';
  return `<a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank" rel="noreferrer">Νημερτής</a>`;
}

// Δημιουργεί τη λίστα της τριμελούς και επισημαίνει το πρώτο μέλος ως επιβλέποντα.
function committeeMemberList(members) {
  return members.map((member, index) => {
    let role = '';
    if (index === 0) role = ' (επιβλέπων)';
    return `<li>${escapeHtml(member.fullName)}${role}</li>`;
  }).join('');
}

// Εμφανίζει τα στοιχεία παρουσίασης ή ενημερωτικό μήνυμα όταν δεν υπάρχουν.
function presentationDetails(presentation) {
  if (!presentation) return '<p class="muted">Δεν έχουν οριστεί στοιχεία.</p>';

  let location = presentation.room;
  if (presentation.mode === 'ONLINE') location = 'Διαδικτυακά';
  return `<p><strong>${formatDate(presentation.date)}</strong></p><p>${escapeHtml(location)}</p>`;
}

// Εμφανίζει το πρακτικό εξέτασης μόνο όταν υπάρχουν και οι τρεις βαθμοί.
function examRecordLink(thesis, gradeCount) {
  if (gradeCount !== 3) return '';
  return `<p class="section"><a href="/api/theses/${escapeHtml(thesis.id)}/exam-record" target="_blank">Πρακτικό εξέτασης</a></p>`;
}

// Φορτώνει και εμφανίζει ολόκληρη την τρέχουσα διπλωματική του φοιτητή.
async function studentThesis() {
  // GET: παίρνει τη διπλωματική μαζί με επιτροπή, βαθμούς, υλικό και ιστορικό.
  const data = await api('/api/student/thesis');
  if (!data.thesis) {
    content().innerHTML = empty('Δεν έχει γίνει ακόμη αρχική ανάθεση θέματος.');
    return;
  }
  const thesis = data.thesis;
  // Το spread ενώνει τον επιβλέποντα με τα υπόλοιπα μέλη σε έναν νέο array.
  const members = [thesis.supervisor, ...(thesis.members || [])];
  const history = thesisHistory(thesis);
  const materials = thesisMaterials(thesis);
  const gradeCount = validGradeCount(thesis);
  const repositoryForm = finalRepositoryForm(thesis, gradeCount);
  const draft = draftLink(thesis);
  const finalRepository = finalRepositoryLink(thesis);
  const committeeMembers = committeeMemberList(members);
  const presentation = presentationDetails(thesis.presentation);
  const examRecord = examRecordLink(thesis, gradeCount);

  content().innerHTML = `
    <section class="card">
      <div class="split"><div><h2>${escapeHtml(thesis.topic.title)}</h2><p class="topic-summary">${escapeHtml(thesis.topic.summary)}</p></div>${statusBadge(thesis.status)}</div>
      <dl class="details-grid section">
        <div><dt>Φοιτητής</dt><dd>${escapeHtml(data.student.fullName)}</dd></div>
        <div><dt>Επιβλέπων</dt><dd>${escapeHtml(thesis.supervisor.fullName)}</dd></div>
        <div><dt>Οριστική ανάθεση</dt><dd>${formatDate(thesis.officialAssignedAt)}<br><span class="muted small">${escapeHtml(thesis.elapsedDays)} ημέρες</span></dd></div>
        <div><dt>Τελικός βαθμός</dt><dd>${thesis.finalGrade ?? '—'}</dd></div>
        <div><dt>Πρόχειρο</dt><dd>${draft}</dd></div>
        <div><dt>Τελικό κείμενο</dt><dd>${finalRepository}</dd></div>
      </dl>
      ${repositoryForm}
    </section>
    <section class="grid grid-2 section">
      <div class="card"><h2 class="section-heading">Τριμελής επιτροπή</h2><ul>${committeeMembers}</ul></div>
      <div class="card"><h2 class="section-heading">Παρουσίαση</h2>${presentation}</div>
    </section>
    <section class="card section"><h2 class="section-heading">Βαθμολογία</h2>${gradeRows(thesis)}${examRecord}</section>
    <section class="grid grid-2 section">
      <div class="card"><h2 class="section-heading">Ιστορικό</h2>${history}</div>
      <div class="card"><h2 class="section-heading">Υποστηρικτικό υλικό</h2>${materials}</div>
    </section>`;

  document.querySelector('#repository-form')?.addEventListener('submit', saveFinalRepository);
}

// Φορτώνει τα στοιχεία προφίλ και συνδέει τη φόρμα ενημέρωσης.
async function profile() {
  // GET: παίρνει τα στοιχεία επικοινωνίας του συνδεδεμένου φοιτητή.
  const data = await api('/api/student/profile');
  content().innerHTML = `<form id="profile-form" class="card form-grid">
    <label class="full">Πλήρης ταχυδρομική διεύθυνση<textarea name="address">${escapeHtml(data.address)}</textarea></label>
    <label>Email επικοινωνίας<input name="email" type="email" value="${escapeHtml(data.email)}" required></label>
    <label>Κινητό τηλέφωνο<input name="mobile" value="${escapeHtml(data.mobile)}"></label>
    <label>Σταθερό τηλέφωνο<input name="landline" value="${escapeHtml(data.landline)}"></label>
    <div class="full"><button class="button button-primary">Αποθήκευση</button></div>
  </form>`;
  document.querySelector('#profile-form').addEventListener('submit', updateProfile);
}

// Δημιουργεί Set με τα ids που έχουν ήδη αποδεχτεί πρόσκληση.
function acceptedProfessorIds(invitations) {
  const acceptedInvitations = invitations.filter((invitation) => invitation.status === 'ACCEPTED');
  return new Set(acceptedInvitations.map((invitation) => invitation.professor.id));
}

// Αφαιρεί από τις επιλογές τον επιβλέποντα και τα ήδη αποδεκτά μέλη.
function availableProfessorChoices(professors, thesis, invitations) {
  const acceptedIds = acceptedProfessorIds(invitations);
  return professors.filter((professor) => (
    professor.id !== thesis.supervisor.id && !acceptedIds.has(professor.id)
  ));
}

// Δημιουργεί μία επιλογή checkbox για διαθέσιμο διδάσκοντα.
function professorChoice(professor) {
  return `<label class="card"><span><input type="checkbox" name="codes" value="${escapeHtml(professor.code)}" style="width:auto"> ${escapeHtml(professor.fullName)} (${escapeHtml(professor.code)})</span></label>`;
}

// Δημιουργεί κάρτα με την τρέχουσα κατάσταση μιας πρόσκλησης.
function invitationProgressCard(invitation) {
  return `<article class="card split"><span>${escapeHtml(invitation.professor.fullName)} (${escapeHtml(invitation.professor.code)})<br><span class="muted small">Αποστολή: ${formatDate(invitation.createdAt)} · Απάντηση: ${formatDate(invitation.respondedAt)}</span></span><strong>${escapeHtml(invitation.status)}</strong></article>`;
}

// Φορτώνει παράλληλα διπλωματική, διδάσκοντες και προσκλήσεις τριμελούς.
async function invitations() {
  // Promise.all εκτελεί τα τρία ανεξάρτητα GET requests ταυτόχρονα.
  const [thesisData, professorData, invitationData] = await Promise.all([
    api('/api/student/thesis'),
    api('/api/profs/list'),
    api('/api/committee/invitations'),
  ]);
  if (!thesisData.thesis) {
    content().innerHTML = empty('Χρειάζεται πρώτα αρχική ανάθεση θέματος από διδάσκοντα.');
    return;
  }
  const thesis = thesisData.thesis;
  const invitationItems = invitationData.items || [];
  const choices = availableProfessorChoices(professorData.items, thesis, invitationItems);
  const canInvite = thesis.status === 'UNDER_ASSIGNMENT';
  let invitationProgress = empty('Δεν υπάρχουν προσκλήσεις.');
  if (invitationItems.length) {
    invitationProgress = invitationItems.map(invitationProgressCard).join('');
  }

  content().innerHTML = `
    <section class="card">
      <div class="split"><h2>Επιλογή διδασκόντων</h2>${statusBadge(thesis.status)}</div>
      ${canInvite ? `<form id="invite-form" class="stack">
        <div class="grid grid-2">${choices.map(professorChoice).join('')}</div>
        <div><button class="button button-primary">Αποστολή προσκλήσεων</button></div>
      </form>` : '<p class="muted">Η τριμελής έχει οριστικοποιηθεί.</p>'}
    </section>
    <section class="section"><h2 class="section-heading">Πορεία προσκλήσεων</h2>
      ${invitationProgress}
    </section>`;
  document.querySelector('#invite-form')?.addEventListener('submit', sendCommitteeInvitations);
}

// Εμφανίζει τις φόρμες πρόχειρου PDF και υποστηρικτικού υλικού.
async function upload() {
  // GET: ελέγχει πρώτα την ύπαρξη και την κατάσταση της διπλωματικής.
  const { thesis } = await api('/api/student/thesis');
  if (!thesis) {
    content().innerHTML = empty('Δεν υπάρχει διπλωματική.');
    return;
  }
  if (thesis.status !== 'UNDER_EXAM') {
    content().innerHTML = empty('Τα αρχεία και οι σύνδεσμοι ενεργοποιούνται όταν ο επιβλέπων θέσει τη διπλωματική σε κατάσταση «Υπό εξέταση».');
    return;
  }
  let currentDraftLink = '';
  if (thesis.draftUrl) {
    currentDraftLink = `<a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Τρέχον πρόχειρο</a>`;
  }

  content().innerHTML = `
    <div class="grid grid-2">
      <form id="draft-form" class="card stack">
        <h2>Πρόχειρο κείμενο</h2>
        <p class="muted small">Έγκυρο PDF έως 12 MB για διπλωματική υπό εξέταση.</p>
        <input name="file" type="file" accept="application/pdf" required>
        <button class="button button-primary">Ανέβασμα PDF</button>
        ${currentDraftLink}
      </form>
      <form id="material-form" class="card stack">
        <h2>Υποστηρικτικό υλικό</h2>
        <label>Περιγραφή<input name="label" placeholder="π.χ. Κώδικας εφαρμογής" required></label>
        <label>Σύνδεσμος<input name="url" type="url" placeholder="https://…" required></label>
        <button class="button button-primary">Προσθήκη συνδέσμου</button>
      </form>
    </div>`;
  document.querySelector('#draft-form').addEventListener('submit', uploadDraft);
  document.querySelector('#material-form').addEventListener('submit', addMaterial);
}

// Εμφανίζει και συμπληρώνει τη φόρμα προγραμματισμού παρουσίασης.
async function presentation() {
  // GET: παίρνει την τρέχουσα διπλωματική και τυχόν υπάρχουσα παρουσίαση.
  const { thesis } = await api('/api/student/thesis');
  if (!thesis) {
    content().innerHTML = empty('Δεν υπάρχει διπλωματική.');
    return;
  }
  if (thesis.status !== 'UNDER_EXAM') {
    content().innerHTML = empty('Τα στοιχεία παρουσίασης ενεργοποιούνται όταν ο επιβλέπων θέσει τη διπλωματική σε κατάσταση «Υπό εξέταση».');
    return;
  }
  const item = thesis.presentation || {};
  let inPersonSelected = 'selected';
  let onlineSelected = '';
  if (item.mode === 'ONLINE') {
    inPersonSelected = '';
    onlineSelected = 'selected';
  }

  content().innerHTML = `<form id="presentation-form" class="card form-grid">
    <label>Ημερομηνία και ώρα<input name="date" type="datetime-local" value="${toLocalInput(item.date)}" required></label>
    <label>Τρόπος παρουσίασης<select name="mode"><option value="IN_PERSON" ${inPersonSelected}>Δια ζώσης</option><option value="ONLINE" ${onlineSelected}>Διαδικτυακά</option></select></label>
    <label class="full">Τίτλος ανακοίνωσης<input name="title" value="${escapeHtml(item.title || `Παρουσίαση: ${thesis.topic.title}`)}" required></label>
    <label id="room-field">Αίθουσα<input name="room" value="${escapeHtml(item.room || '')}"></label>
    <label id="meeting-field">Σύνδεσμος τηλεδιάσκεψης<input name="meetingUrl" type="url" value="${escapeHtml(item.meetingUrl || '')}"></label>
    <div class="full"><button class="button button-primary">Αποθήκευση</button></div>
  </form>`;
  const form = document.querySelector('#presentation-form');
  form.mode.addEventListener('change', () => updatePresentationFields(form));
  updatePresentationFields(form);
  form.addEventListener('submit', savePresentation);
}

// Επιλέγει τη σωστή σελίδα φοιτητή από το page key του main.js.
export async function renderStudent(page) {
  const renderers = {
    'student-dashboard': dashboard,
    'student-thesis': studentThesis,
    'student-profile': profile,
    'student-invitations': invitations,
    'student-upload': upload,
    'student-presentation': presentation,
  };
  return renderers[page]();
}
