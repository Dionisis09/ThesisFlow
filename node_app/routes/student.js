import { requireRole } from '../auth.js';
import {
  currentStudent,
  isHttpUrl,
  newId,
  nowMs,
  one,
  all,
  professorData,
  run,
  thesisData,
  transaction,
  datetimeToMs,
} from '../db.js';
import {
  cleanText,
  normalizeProfessorCodes,
  savePdf,
  validGradeCount,
} from './helpers.js';

// Επιστρέφει τη διπλωματική του συνδεδεμένου φοιτητή με όλα τα αναλυτικά στοιχεία.
function getStudentThesis(req, res) {
  const student = currentStudent(req.user.id);
  if (!student) return res.status(404).json({ error: 'Invalid request.' });

  // Αναζητά αν ο φοιτητής έχει ήδη εγγραφή Thesis.
  const thesis = one('SELECT id FROM Thesis WHERE studentId = ?', student.id);
  return res.json({
    student: {
      id: student.id,
      am: student.am,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
    },
    thesis: thesis ? thesisData(thesis.id) : null,
  });
}

// Επιστρέφει τα στοιχεία επικοινωνίας του φοιτητή.
function getStudentProfile(req, res) {
  const student = currentStudent(req.user.id);
  if (!student) return res.status(404).json({ error: 'Invalid request.' });

  return res.json({
    address: student.address || '',
    email: student.email,
    mobile: student.mobile || '',
    landline: student.landline || '',
  });
}

// Ελέγχει και ενημερώνει προφίλ και email μέσα στην ίδια συναλλαγή.
function updateStudentProfile(req, res) {
  const student = currentStudent(req.user.id);
  if (!student) return res.status(404).json({ error: 'Invalid request.' });

  const email = cleanText(req.body?.email, student.email).toLowerCase();
  if (!email || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // Ελέγχει ότι το νέο email δεν χρησιμοποιείται από διαφορετικό χρήστη.
  const existingUser = one('SELECT id FROM User WHERE email = ?', email);
  if (existingUser && existingUser.id !== student.userId) {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  const address = cleanText(req.body?.address, student.address).slice(0, 500);
  const mobile = cleanText(req.body?.mobile, student.mobile).slice(0, 30);
  const landline = cleanText(req.body?.landline, student.landline).slice(0, 30);
  transaction(() => {
    run(
      'UPDATE Student SET address = ?, mobile = ?, landline = ? WHERE id = ?',
      address,
      mobile,
      landline,
      student.id,
    );
    run('UPDATE User SET email = ? WHERE id = ?', email, student.userId);
  });
  return res.json({ ok: true });
}

// Επιστρέφει τους διαθέσιμους διδάσκοντες ταξινομημένους κατά κωδικό.
function listProfessors(_req, res) {
  const professors = all('SELECT * FROM Professor ORDER BY code').map(professorData);
  res.json({ items: professors });
}

// Δημιουργεί ή επαναφέρει σε εκκρεμότητα τις προσκλήσεις τριμελούς.
function createCommitteeInvitations(req, res) {
  const student = currentStudent(req.user.id);
  const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
  if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
  if (thesis.status !== 'UNDER_ASSIGNMENT') {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  const professorCodes = normalizeProfessorCodes(req.body?.professorCodes);
  if (!professorCodes.length) return res.status(400).json({ error: 'Invalid request.' });

  const placeholders = professorCodes.map(() => '?').join(',');
  // Αναζητά μόνο τους κωδικούς που έστειλε το frontend και αφαιρεί τον επιβλέποντα.
  const professors = all(
    `SELECT * FROM Professor WHERE code IN (${placeholders})`,
    ...professorCodes,
  ).filter((professor) => professor.id !== thesis.supervisorId);
  if (!professors.length) return res.status(400).json({ error: 'Invalid request.' });

  // Η transaction εγγυάται ότι όλες οι προσκλήσεις αποθηκεύονται μαζί.
  const createdInvitations = transaction(() => professors.flatMap((professor) => {
    const invitation = one(
      'SELECT * FROM CommitteeInvitation WHERE thesisId = ? AND professorId = ?',
      thesis.id,
      professor.id,
    );
    if (invitation?.status === 'ACCEPTED') return [];

    const invitationId = invitation?.id || newId();
    if (invitation) {
      run(
        'UPDATE CommitteeInvitation SET status = ?, createdAt = ?, respondedAt = NULL WHERE id = ?',
        'PENDING',
        nowMs(),
        invitationId,
      );
    } else {
      run(
        'INSERT INTO CommitteeInvitation (id, thesisId, professorId, status, createdAt, respondedAt) VALUES (?, ?, ?, ?, ?, NULL)',
        invitationId,
        thesis.id,
        professor.id,
        'PENDING',
        nowMs(),
      );
    }
    return [{ id: invitationId, code: professor.code }];
  }));

  return res.status(201).json({
    created: createdInvitations.map((invitation) => invitation.id),
    matchedCodes: createdInvitations.map((invitation) => invitation.code),
  });
}

// Επιστρέφει handler που αποθηκεύει το πρόχειρο PDF της διπλωματικής.
function uploadThesisDraft(uploadFolder) {
  return (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    if (thesis.status !== 'UNDER_EXAM') {
      return res.status(409).json({ error: 'Thesis must be under examination.' });
    }

    const url = savePdf(req.file, uploadFolder);
    if (!url) return res.status(400).json({ error: 'Invalid request.' });

    run('UPDATE Thesis SET draftUrl = ?, updatedAt = ? WHERE id = ?', url, nowMs(), thesis.id);
    return res.json({ url });
  };
}

// Αποθηκεύει σύνδεσμο υποστηρικτικού υλικού για διπλωματική υπό εξέταση.
function addThesisMaterial(req, res) {
  const student = currentStudent(req.user.id);
  const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
  if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
  if (thesis.status !== 'UNDER_EXAM') {
    return res.status(409).json({ error: 'Thesis must be under examination.' });
  }

  const label = cleanText(req.body?.label);
  const url = cleanText(req.body?.url);
  if (!label || label.length > 120 || !isHttpUrl(url)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const materialId = newId();
  // Προσθέτει νέο υλικό με περιγραφή, URL και χρόνο δημιουργίας.
  run(
    'INSERT INTO ThesisMaterial (id, thesisId, label, url, createdAt) VALUES (?, ?, ?, ?, ?)',
    materialId,
    thesis.id,
    label,
    url,
    nowMs(),
  );
  return res.status(201).json({ id: materialId });
}

// Δημιουργεί ή ενημερώνει τα στοιχεία παρουσίασης του φοιτητή.
function savePresentation(req, res) {
  const student = currentStudent(req.user.id);
  const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
  if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
  if (thesis.status !== 'UNDER_EXAM') {
    return res.status(409).json({ error: 'Thesis must be under examination.' });
  }

  const date = datetimeToMs(req.body?.date);
  const title = cleanText(req.body?.title);
  const mode = cleanText(req.body?.mode, 'IN_PERSON').toUpperCase();
  const room = cleanText(req.body?.room);
  const meetingUrl = cleanText(req.body?.meetingUrl);
  if (!date || !title) return res.status(400).json({ error: 'Invalid request.' });
  if (!['IN_PERSON', 'ONLINE'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  if (mode === 'IN_PERSON' && !room) return res.status(400).json({ error: 'Invalid request.' });
  if (mode === 'ONLINE' && !isHttpUrl(meetingUrl)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // Ελέγχει αν υπάρχει ήδη παρουσίαση ώστε να επιλέξει UPDATE ή INSERT.
  const existing = one('SELECT id FROM PresentationDetails WHERE thesisId = ?', thesis.id);
  const presentationId = existing?.id || newId();
  const shownRoom = mode === 'IN_PERSON' ? room : 'Online';
  const savedMeetingUrl = mode === 'ONLINE' ? meetingUrl : null;
  const timestamp = nowMs();

  if (existing) {
    run(
      'UPDATE PresentationDetails SET date = ?, room = ?, title = ?, mode = ?, meetingUrl = ?, updatedAt = ? WHERE id = ?',
      date,
      shownRoom,
      title,
      mode,
      savedMeetingUrl,
      timestamp,
      presentationId,
    );
  } else {
    run(
      'INSERT INTO PresentationDetails (id, thesisId, date, room, title, createdAt, updatedAt, mode, meetingUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      presentationId,
      thesis.id,
      date,
      shownRoom,
      title,
      timestamp,
      timestamp,
      mode,
      savedMeetingUrl,
    );
  }
  return res.json({ id: presentationId });
}

// Αποθηκεύει το τελικό repository μόνο μετά από τρεις έγκυρους βαθμούς.
function saveFinalRepository(req, res) {
  const student = currentStudent(req.user.id);
  const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
  if (!thesis) return res.status(400).json({ error: 'Invalid request.' });

  if (thesis.status !== 'UNDER_EXAM' || validGradeCount(thesis.id) !== 3) {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  const url = cleanText(req.body?.url);
  if (!isHttpUrl(url)) return res.status(400).json({ error: 'Invalid request.' });

  run('UPDATE Thesis SET finalRepositoryUrl = ?, updatedAt = ? WHERE id = ?', url, nowMs(), thesis.id);
  return res.json({ ok: true });
}

// Συνδέει τα student URLs με handlers και έλεγχο ρόλου.
export function registerStudentRoutes(app, upload, uploadFolder) {
  app.get('/api/student/thesis', requireRole('STUDENT'), getStudentThesis);
  app.get('/api/student/profile', requireRole('STUDENT'), getStudentProfile);
  app.patch('/api/student/profile', requireRole('STUDENT'), updateStudentProfile);
  app.get('/api/profs/list', requireRole('STUDENT', 'PROFESSOR', 'SECRETARIAT'), listProfessors);
  app.post('/api/committee/invitations', requireRole('STUDENT'), createCommitteeInvitations);
  app.post(
    '/api/upload/thesis-draft',
    requireRole('STUDENT'),
    upload.single('file'),
    uploadThesisDraft(uploadFolder),
  );
  app.post('/api/student/materials', requireRole('STUDENT'), addThesisMaterial);
  app.post('/api/student/presentation', requireRole('STUDENT'), savePresentation);
  app.post('/api/student/final-repository', requireRole('STUDENT'), saveFinalRepository);
}
