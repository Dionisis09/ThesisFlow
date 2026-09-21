import { all, db, one } from './db.js';

// Εκτελεί ελέγχους ακεραιότητας και συγκεντρώνει βασικά πλήθη της SQLite βάσης.
const result = {
  integrity: one('PRAGMA integrity_check').integrity_check,
  foreignKeyViolations: all('PRAGMA foreign_key_check').length,
  users: one('SELECT COUNT(*) AS count FROM User').count,
  students: one('SELECT COUNT(*) AS count FROM Student').count,
  professors: one('SELECT COUNT(*) AS count FROM Professor').count,
  theses: one('SELECT COUNT(*) AS count FROM Thesis').count,
  thesisStatuses: all('SELECT status, COUNT(*) AS count FROM Thesis GROUP BY status ORDER BY status'),
  customIndexes: one("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").count,
};

console.log(JSON.stringify(result, null, 2));
if (result.integrity !== 'ok' || result.foreignKeyViolations !== 0) process.exitCode = 1;
db.close();
