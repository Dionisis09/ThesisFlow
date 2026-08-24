# ThesisFlow Node.js validation report

Validation date: 2026-08-24

## Outcome

The application uses Node.js/Express, SQLite and vanilla JavaScript. The server, role workflows and browser UI are maintained in one active JavaScript codebase.

## Automated evidence

- `npm run check`: passed for `server.js`, database, page, authentication and route modules.
- `npm test`: 6/6 integration tests passed.
- The tests use a temporary database copy and do not alter `prisma/dev.db`.
- A complete lifecycle passed through HTTP: topic creation, assignment, two committee acceptances, activation, presentation, examination, grading by three professors, repository link and secretariat completion.
- Security checks passed for anonymous protection, role separation and CSRF rejection.
- JSON/XML feeds and cache headers passed.
- Required custom indexes were found.

## Live browser evidence

- Login rendered and authenticated successfully with the secretariat demo account.
- Secretariat dashboard loaded its five actions through the JavaScript modules.
- Thesis management loaded all records and lifecycle states from the Node API.
- Live login and dashboard rendering passed for secretariat, professor and student.
- Browser console inspection showed no errors or warnings on the tested pages.
- Responsive test at 390x844 showed no document-level horizontal overflow (`clientWidth = scrollWidth = 375`).
- A mobile navigation height defect was detected during testing and fixed; final height is 81px.

Screenshots:

- `docs/live_node/01-login.png`
- `docs/live_node/02-secretariat-dashboard.png`
- `docs/live_node/03-thesis-management.png`
- `docs/live_node/04-mobile-thesis-management.png`
- `docs/live_node/05-professor-dashboard.png`
- `docs/live_node/06-student-dashboard.png`

## Database snapshot

Run `npm run db:verify` for current counts, integrity, foreign-key checks, statuses and custom-index count. The command exits with failure if integrity or foreign-key validation fails.

## Remaining presentation note

The project keeps the old Python and Next.js implementations only as recoverable history. They are not active dependencies. The final submission archive should omit both legacy folders so that the evaluator sees the simple Node.js/JavaScript solution first.
