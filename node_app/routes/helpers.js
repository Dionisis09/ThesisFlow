import fs from 'node:fs';
import path from 'node:path';
import { all, datetimeToMs, newId, one, thesisData } from '../db.js';

export const THESIS_STATUSES = ['UNDER_ASSIGNMENT', 'ACTIVE', 'UNDER_EXAM', 'COMPLETED', 'CANCELED'];
export const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// Καθαρίζει κείμενο εισόδου και αφαιρεί κενά από την αρχή και το τέλος.
export function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

// Υπολογίζει αριθμητικό μέσο όρο με συγκεκριμένα δεκαδικά ψηφία.
export function average(values, digits) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(digits));
}

export function escapeHtml(value) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  };
  return String(value ?? '').replace(/[&<>'"]/g, (character) => replacements[character]);
}

export function escapeXml(value) {
  const replacements = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  };
  return String(value ?? '').replace(/[<>&'"]/g, (character) => replacements[character]);
}

// Αποθηκεύει upload μόνο όταν τα πρώτα bytes περιέχουν την υπογραφή PDF.
export function savePdf(file, uploadFolder) {
  const hasPdfSignature = file?.buffer.subarray(0, 5).toString() === '%PDF-';
  if (!hasPdfSignature) return null;

  const filename = `${newId()}.pdf`;
  fs.writeFileSync(path.join(uploadFolder, filename), file.buffer);
  return `/uploads/${filename}`;
}

// Ελέγχει αν ο καθηγητής είναι επιβλέπων ή μέλος της συγκεκριμένης τριμελούς.
export function isProfessorParticipant(thesisId, professorId) {
  // Το LEFT JOIN καλύπτει και τον επιβλέποντα και τα μέλη CommitteeMember.
  const participant = one(`
    SELECT Thesis.id FROM Thesis
    LEFT JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id
    WHERE Thesis.id = ? AND (Thesis.supervisorId = ? OR CommitteeMember.professorId = ?)
    LIMIT 1
  `, thesisId, professorId, professorId);
  return Boolean(participant);
}

// Προστατεύει ειδικούς χαρακτήρες πριν δημιουργηθεί γραμμή CSV.
export function csvEscape(value) {
  const raw = String(value ?? '');
  if (/[",\n\r]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
}

// Δέχεται κωδικούς καθηγητών και με μηδενικά και χωρίς αυτά, π.χ. P002 και P2.
export function normalizeProfessorCodes(rawCodes) {
  if (!Array.isArray(rawCodes)) return [];

  const codes = [];
  for (const rawCode of rawCodes) {
    const code = cleanText(rawCode).toUpperCase();
    if (!code) continue;

    codes.push(code);
    const compactCode = code.match(/^([A-Z]+)0+(\d+)$/);
    if (compactCode) codes.push(`${compactCode[1]}${compactCode[2]}`);
  }
  return [...new Set(codes)];
}

// Υπολογίζει πλήθος, μέσο βαθμό, χρόνο ολοκλήρωσης και πλήθος ανά κατάσταση.
export function statisticsForTheses(thesisIds) {
  const theses = thesisIds.map((id) => thesisData(id));
  const completedTheses = theses.filter((thesis) => thesis.status === 'COMPLETED');

  const completedGradeLists = completedTheses.map((thesis) => thesis.grades);
  const completedGrades = completedGradeLists.flat();
  const numericGrades = completedGrades.map((grade) => Number(grade.value));
  const grades = numericGrades.filter((grade) => grade >= 0 && grade <= 10);

  const completionDays = completedTheses.map((thesis) => {
    // Βρίσκει την αρχή ανάθεσης και το τέλος παρουσίασης για κάθε ολοκληρωμένη εργασία.
    const dates = one('SELECT createdAt, officialAssignedAt, updatedAt FROM Thesis WHERE id = ?', thesis.id);
    const presentation = one('SELECT date FROM PresentationDetails WHERE thesisId = ?', thesis.id);
    const start = datetimeToMs(dates.officialAssignedAt) ?? datetimeToMs(dates.createdAt);
    const end = datetimeToMs(presentation?.date) ?? datetimeToMs(dates.updatedAt);
    return (end - start) / 86_400_000;
  }).filter((days) => Number.isFinite(days) && days >= 0);

  // Object.fromEntries δημιουργεί αντικείμενο { κατάσταση: πλήθος }.
  const counts = Object.fromEntries(
    THESIS_STATUSES.map((status) => [status, theses.filter((thesis) => thesis.status === status).length]),
  );

  return {
    total: theses.length,
    averageGrade: average(grades, 2),
    averageCompletionDays: average(completionDays, 1),
    counts,
  };
}

// Μετρά μόνο τους έγκυρους βαθμούς 0–10 μιας διπλωματικής.
export function validGradeCount(thesisId) {
  return one(
    'SELECT COUNT(*) AS count FROM Grade WHERE thesisId = ? AND value BETWEEN 0 AND 10',
    thesisId,
  ).count;
}

// Επιστρέφει ids όλων των διπλωματικών ή μόνο μιας κατάστασης.
export function allThesisIdsForStatus(status) {
  if (status === 'ALL') return all('SELECT id FROM Thesis ORDER BY createdAt DESC');
  return all('SELECT id FROM Thesis WHERE status = ? ORDER BY createdAt DESC', status);
}
