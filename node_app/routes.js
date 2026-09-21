import { registerAuthRoutes } from './routes/auth.js';
import { registerExamRecordRoute } from './routes/exam-record.js';
import { registerProfessorRoutes } from './routes/professor.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerSecretariatRoutes } from './routes/secretariat.js';
import { registerStudentRoutes } from './routes/student.js';

// Το server.js έχει ένα σημείο σύνδεσης, ενώ κάθε ρόλος κρατά τα δικά του routes.
export function registerRoutes(app, upload, uploadFolder) {
  registerAuthRoutes(app);
  registerPublicRoutes(app);
  registerStudentRoutes(app, upload, uploadFolder);
  registerProfessorRoutes(app, upload, uploadFolder);
  registerExamRecordRoute(app);
  registerSecretariatRoutes(app);
}
