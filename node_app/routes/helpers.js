import fs from 'node:fs';
import path from 'node:path';
import { all, datetimeToMs, newId, one, thesisData } from '../db.js';

export const THESIS_STATUSES = ['UNDER_ASSIGNMENT', 'ACTIVE', 'UNDER_EXAM', 'COMPLETED', 'CANCELED'];
export const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

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

// An uploaded file is stored only when its contents start with the PDF signature.
export function savePdf(file, uploadFolder) {
  const hasPdfSignature = file?.buffer.subarray(0, 5).toString() === '%PDF-';
  if (!hasPdfSignature) return null;

  const filename = `${newId()}.pdf`;
  fs.writeFileSync(path.join(uploadFolder, filename), file.buffer);
  return `/uploads/${filename}`;
}

export function isProfessorParticipant(thesisId, professorId) {
  const participant = one(`
    SELECT Thesis.id FROM Thesis
    LEFT JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id
    WHERE Thesis.id = ? AND (Thesis.supervisorId = ? OR CommitteeMember.professorId = ?)
    LIMIT 1
  `, thesisId, professorId, professorId);
  return Boolean(participant);
}

export function csvEscape(value) {
  const raw = String(value ?? '');
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

// Both padded and compact professor codes are accepted, e.g. P002 and P2.
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

export function statisticsForTheses(thesisIds) {
  const theses = thesisIds.map((id) => thesisData(id));
  const completedTheses = theses.filter((thesis) => thesis.status === 'COMPLETED');

  const grades = completedTheses
    .flatMap((thesis) => thesis.grades.map((grade) => Number(grade.value)))
    .filter((grade) => grade >= 0 && grade <= 10);

  const completionDays = completedTheses.map((thesis) => {
    const dates = one('SELECT createdAt, officialAssignedAt, updatedAt FROM Thesis WHERE id = ?', thesis.id);
    const presentation = one('SELECT date FROM PresentationDetails WHERE thesisId = ?', thesis.id);
    const start = datetimeToMs(dates.officialAssignedAt) ?? datetimeToMs(dates.createdAt);
    const end = datetimeToMs(presentation?.date) ?? datetimeToMs(dates.updatedAt);
    return (end - start) / 86_400_000;
  }).filter((days) => Number.isFinite(days) && days >= 0);

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

export function validGradeCount(thesisId) {
  return one(
    'SELECT COUNT(*) AS count FROM Grade WHERE thesisId = ? AND value BETWEEN 0 AND 10',
    thesisId,
  ).count;
}

export function allThesisIdsForStatus(status) {
  if (status === 'ALL') return all('SELECT id FROM Thesis ORDER BY createdAt DESC');
  return all('SELECT id FROM Thesis WHERE status = ? ORDER BY createdAt DESC', status);
}
