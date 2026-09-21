import { all, datetimeToMs, msToIso } from '../db.js';
import { escapeXml } from './helpers.js';

// Επιστρέφει τις δημόσιες παρουσιάσεις σε JSON ή XML με προαιρετικό εύρος ημερομηνιών.
function publicPresentations(req, res) {
  const fromMs = req.query.from ? datetimeToMs(req.query.from) : null;
  const toMs = req.query.to ? datetimeToMs(req.query.to) : null;
  if (req.query.from && fromMs === null) return res.status(400).json({ error: 'Invalid request.' });
  if (req.query.to && toMs === null) return res.status(400).json({ error: 'Invalid request.' });

  const conditions = [];
  const parameters = [];
  if (fromMs !== null) {
    conditions.push('PresentationDetails.date >= ?');
    parameters.push(fromMs);
  }
  if (toMs !== null) {
    conditions.push('PresentationDetails.date <= ?');
    parameters.push(toMs);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Ενώνει παρουσίαση, διπλωματική, φοιτητή, θέμα και επιβλέποντα σε ένα αποτέλεσμα.
  const rows = all(`
    SELECT PresentationDetails.*, Thesis.id AS thesisId, Student.am, Student.firstName AS studentFirst,
           Student.lastName AS studentLast, Topic.title AS topicTitle,
           Professor.firstName AS supervisorFirst, Professor.lastName AS supervisorLast
    FROM PresentationDetails
    JOIN Thesis ON Thesis.id = PresentationDetails.thesisId
    JOIN Student ON Student.id = Thesis.studentId
    JOIN Topic ON Topic.id = Thesis.topicId
    JOIN Professor ON Professor.id = Thesis.supervisorId
    ${whereClause} ORDER BY PresentationDetails.date
  `, ...parameters);

  const items = rows.map((row) => ({
    id: row.id,
    date: msToIso(row.date),
    room: row.room,
    mode: row.mode,
    meetingUrl: row.meetingUrl,
    title: row.title,
    student: `${row.studentFirst} ${row.studentLast}`,
    studentAm: row.am,
    topic: row.topicTitle,
    supervisor: `${row.supervisorFirst} ${row.supervisorLast}`,
  }));

  res.set('Cache-Control', 'public, max-age=60');
  const format = String(req.query.format || 'json').toLowerCase();
  if (format !== 'xml') return res.json({ items });

  const presentationsXml = items.map((item) => {
    // Object.entries μετατρέπει κάθε πεδίο του αντικειμένου σε XML element.
    const fields = Object.entries(item)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
      .join('');
    return `<presentation id="${escapeXml(item.id)}">${fields}</presentation>`;
  }).join('');

  return res.type('application/xml')
    .send(`<?xml version="1.0" encoding="utf-8"?><presentations>${presentationsXml}</presentations>`);
}

// Συνδέει το δημόσιο endpoint παρουσιάσεων με τον handler του.
export function registerPublicRoutes(app) {
  app.get('/api/public/presentations', publicPresentations);
}
