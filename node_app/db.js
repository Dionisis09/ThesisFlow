import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Επιλέγει το αρχείο SQLite από το DATABASE_URL ή χρησιμοποιεί το data/dev.db.
function databasePath() {
  const configured = (process.env.DATABASE_URL || '').trim();
  if (configured.startsWith('file:')) return path.resolve(ROOT, 'data', configured.slice(5));
  if (configured.startsWith('sqlite:///')) return path.resolve(configured.slice(10));
  return path.join(ROOT, 'data', 'dev.db');
}

export const db = new DatabaseSync(databasePath());
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

// Επιστρέφει όλες τις γραμμές ενός SELECT ως απλά αντικείμενα JavaScript.
export function all(sql, ...params) {
  return db.prepare(sql).all(...params).map((row) => ({ ...row }));
}

// Επιστρέφει μία γραμμή SELECT ή null όταν δεν βρεθεί αποτέλεσμα.
export function one(sql, ...params) {
  const row = db.prepare(sql).get(...params);
  if (!row) return null;
  return { ...row };
}

// Εκτελεί INSERT, UPDATE ή DELETE με δεσμευμένες παραμέτρους.
export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

// Εκτελεί πολλά queries ως μία ατομική συναλλαγή: όλα ή κανένα.
export function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function newId() {
  return randomUUID().replaceAll('-', '');
}

export function nowMs() {
  return Date.now();
}

// Μετατρέπει διαφορετικές μορφές ημερομηνίας σε milliseconds.
export function datetimeToMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric < 10_000_000_000) return numeric * 1000;
    return numeric;
  }
  const parsed = Date.parse(String(value));
  if (Number.isFinite(parsed)) return parsed;
  return null;
}

export function msToIso(value) {
  const ms = datetimeToMs(value);
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

// Ελέγχει ότι μία τιμή είναι πλήρες HTTP ή HTTPS URL.
export function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

// Μετατρέπει εγγραφή Professor στη μορφή που επιστρέφει το API.
export function professorData(professor) {
  if (!professor) return null;
  return {
    id: professor.id,
    code: professor.code,
    firstName: professor.firstName,
    lastName: professor.lastName,
    fullName: `${professor.firstName} ${professor.lastName}`.trim(),
  };
}

// Βρίσκει τον καθηγητή που αντιστοιχεί στον συνδεδεμένο χρήστη.
export function currentProfessor(userId) {
  return one('SELECT * FROM Professor WHERE userId = ?', userId);
}

// Βρίσκει τον φοιτητή και ενώνει το email του από τον πίνακα User.
export function currentStudent(userId) {
  return one(`
    SELECT Student.*, User.email
    FROM Student JOIN User ON User.id = Student.userId
    WHERE Student.userId = ?
  `, userId);
}

// Βρίσκει διπλωματικές όπου ο καθηγητής είναι επιβλέπων ή μέλος τριμελούς.
export function participatedThesisIds(professorId) {
  return all(`
    SELECT DISTINCT Thesis.id, Thesis.createdAt
    FROM Thesis
    LEFT JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id
    WHERE Thesis.supervisorId = ? OR CommitteeMember.professorId = ?
    ORDER BY Thesis.createdAt DESC
  `, professorId, professorId).map((row) => row.id);
}

// Μετατρέπει το αποθηκευμένο criteriaJson σε αντικείμενο βαθμολογικών κριτηρίων.
function gradeData(grade) {
  let criteria = {};
  try { criteria = JSON.parse(grade.criteriaJson || '{}'); } catch { criteria = {}; }
  return {
    id: grade.id,
    professorId: grade.professorId,
    professor: professorData(grade),
    value: grade.value,
    comments: grade.comments,
    criteria,
    createdAt: msToIso(grade.createdAt),
    updatedAt: msToIso(grade.updatedAt),
  };
}

// Συνθέτει το αντικείμενο API μιας διπλωματικής από τους κανονικοποιημένους πίνακες.
export function thesisData(thesisOrId, viewerProfessorId = null, detailed = true) {
  let thesis = thesisOrId;
  if (typeof thesisOrId === 'string') {
    thesis = one('SELECT * FROM Thesis WHERE id = ?', thesisOrId);
  }
  if (!thesis) return null;

  const student = one('SELECT * FROM Student WHERE id = ?', thesis.studentId);
  const supervisor = one('SELECT * FROM Professor WHERE id = ?', thesis.supervisorId);
  const topic = one('SELECT * FROM Topic WHERE id = ?', thesis.topicId);
  const memberRows = all(`
    SELECT Professor.*, CommitteeMember.role AS committeeRole
    FROM CommitteeMember JOIN Professor ON Professor.id = CommitteeMember.professorId
    WHERE CommitteeMember.thesisId = ? ORDER BY CommitteeMember.role
  `, thesis.id);
  const gradeRows = all(`
    SELECT Grade.*, Professor.code, Professor.firstName, Professor.lastName
    FROM Grade JOIN Professor ON Professor.id = Grade.professorId
    WHERE Grade.thesisId = ? ORDER BY Grade.createdAt
  `, thesis.id);
  // map μετατρέπει κάθε γραμμή Grade στη μορφή που χρειάζεται το frontend.
  const grades = gradeRows.map(gradeData);
  const numericGrades = grades.map((item) => Number(item.value));
  const validGrades = numericGrades.filter((value) => value >= 0 && value <= 10);
  const presentation = one('SELECT * FROM PresentationDetails WHERE thesisId = ?', thesis.id);
  const start = datetimeToMs(thesis.officialAssignedAt) ?? datetimeToMs(thesis.createdAt) ?? nowMs();
  const elapsedDays = Math.max(0, Math.floor((nowMs() - start) / 86_400_000));

  let role = null;
  if (viewerProfessorId === thesis.supervisorId) role = 'SUPERVISOR';
  else if (memberRows.some((member) => member.id === viewerProfessorId)) role = 'COMMITTEE_MEMBER';

  let finalGrade = null;
  // Υπολογίζει τελικό βαθμό μόνο όταν υπάρχουν ακριβώς τρεις έγκυροι βαθμοί.
  if (validGrades.length === 3) {
    const gradeSum = validGrades.reduce((sum, value) => sum + value, 0);
    finalGrade = Math.round((gradeSum / 3) * 100) / 100;
  }

  const result = {
    id: thesis.id,
    status: thesis.status,
    role,
    createdAt: msToIso(thesis.createdAt),
    updatedAt: msToIso(thesis.updatedAt),
    officialAssignedAt: msToIso(thesis.officialAssignedAt),
    elapsedDays,
    canSupervisorCancel: thesis.status === 'ACTIVE' && elapsedDays >= 730,
    assignmentGsNumber: thesis.assignmentGsNumber,
    assignmentGsYear: thesis.assignmentGsYear,
    draftUrl: thesis.draftUrl,
    finalRepositoryUrl: thesis.finalRepositoryUrl,
    gradingOpen: Boolean(thesis.gradingOpen),
    finalGrade,
    student: {
      id: student.id,
      am: student.am,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
    },
    supervisor: professorData(supervisor),
    topic: {
      id: topic.id,
      title: topic.title,
      summary: topic.summary,
      descriptionUrl: topic.descriptionUrl,
    },
    members: memberRows.map((member) => ({ ...professorData(member), committeeRole: member.committeeRole })),
    presentation: presentation ? {
      id: presentation.id,
      date: msToIso(presentation.date),
      room: presentation.room,
      title: presentation.title,
      mode: presentation.mode,
      meetingUrl: presentation.meetingUrl,
    } : null,
  };

  // Τα αναλυτικά δεδομένα φορτώνονται μόνο όπου χρειάζονται στο UI.
  if (detailed) {
    result.grades = grades;
    result.materials = all('SELECT * FROM ThesisMaterial WHERE thesisId = ? ORDER BY createdAt', thesis.id)
      .map((item) => ({ id: item.id, label: item.label, url: item.url, createdAt: msToIso(item.createdAt) }));
    result.history = all('SELECT * FROM ThesisHistory WHERE thesisId = ? ORDER BY createdAt', thesis.id)
      .map((item) => ({
        id: item.id,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        note: item.note,
        createdAt: msToIso(item.createdAt),
      }));
    result.invitations = all(`
      SELECT CommitteeInvitation.*, Professor.code, Professor.firstName, Professor.lastName
      FROM CommitteeInvitation JOIN Professor ON Professor.id = CommitteeInvitation.professorId
      WHERE CommitteeInvitation.thesisId = ? ORDER BY CommitteeInvitation.createdAt
    `, thesis.id).map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: msToIso(item.createdAt),
      respondedAt: msToIso(item.respondedAt),
      professor: professorData(item),
    }));
    result.cancellation = {
      gsNumber: thesis.cancellationGsNumber,
      gsYear: thesis.cancellationGsYear,
      reason: thesis.cancellationReason,
    };
  }
  return result;
}

// Καταγράφει κάθε αλλαγή κατάστασης στο ιστορικό της διπλωματικής.
export function addHistory(thesisId, fromStatus, toStatus, actorUserId, note) {
  run(`
    INSERT INTO ThesisHistory (id, thesisId, fromStatus, toStatus, actorUserId, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, newId(), thesisId, fromStatus, toStatus, actorUserId, note, nowMs());
}

// Τα indexes επιταχύνουν τα φίλτρα και τα JOIN που χρησιμοποιούν τα dashboards.
export function ensureIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS Topic_supervisor_status_idx ON Topic(supervisorId, status);
    CREATE INDEX IF NOT EXISTS Thesis_status_created_idx ON Thesis(status, createdAt);
    CREATE INDEX IF NOT EXISTS CommitteeInvitation_professor_status_idx ON CommitteeInvitation(professorId, status);
    CREATE INDEX IF NOT EXISTS CommitteeMember_professor_idx ON CommitteeMember(professorId);
    CREATE INDEX IF NOT EXISTS PresentationDetails_date_idx ON PresentationDetails(date);
    CREATE INDEX IF NOT EXISTS ThesisHistory_thesis_created_idx ON ThesisHistory(thesisId, createdAt);
    CREATE INDEX IF NOT EXISTS ThesisNote_thesis_professor_idx ON ThesisNote(thesisId, professorId);
    CREATE INDEX IF NOT EXISTS ThesisMaterial_thesis_idx ON ThesisMaterial(thesisId);
  `);
}

ensureIndexes();
