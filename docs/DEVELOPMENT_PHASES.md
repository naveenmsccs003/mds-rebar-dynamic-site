# Development Phases

Built in this order; each phase ends with tests passing, migrations
applied cleanly, docs updated, and a phase completion report before the
next phase starts.

| # | Phase | Scope |
|---|---|---|
| 1 | Architecture + Project Setup | Repo structure, Django project + app skeletons, Vite/React/TS scaffold, Docker Compose, env config, base CI, docs (this set) |
| 2 | Database Foundation | Custom user model, core models for every app, migrations, admin registration, indexes |
| 3 | Authentication + RBAC | Login/logout, password reset, sessions/CSRF, roles/permissions, brute-force protection |
| 4 | CMS | Page/section models, versioning, publishing workflow, SEO fields, rich-text sanitization |
| 5 | Public Website | Homepage + static-content pages wired to CMS API, design system components, SEO head |
| 6 | Services | Reusable service template + service data model + API + admin CRUD |
| 7 | Portfolio + Resources + News | Models, filtered/paginated list APIs, public pages, admin CRUD |
| 8 | Careers + Applications | Job postings, application form, resume upload security |
| 9 | Quote + Contact + Enquiries | Quote/contact forms, public reference numbers, admin workflow, notifications |
| 10 | Documents + Media | Object storage abstraction, presigned uploads, private file access, download logging |
| 11 | SEO + Search | Sitemap/robots, structured data, Postgres FTS + search API |
| 12 | Security Hardening | Headers, CSP, rate limiting review, upload validation audit, audit log review |
| 13 | Testing | Backend/frontend/E2E suites filled out to the levels in `TESTING.md` |
| 14 | Performance | Query/caching audit, Core Web Vitals pass, load-testing key endpoints |
| 15 | Docker + CI/CD | Full pipeline per `CI_CD.md`, staging/production deploy config |
| 16 | Production Readiness | Backup/DR verification, monitoring/health checks, final acceptance test per spec §81 |

## Per-phase checklist
1. State the objective.
2. List files to be created/changed.
3. Implement the smallest coherent unit satisfying the objective.
4. Run relevant tests; fix failures.
5. Review security, performance, accessibility implications.
6. Update the relevant `/docs` file(s).
7. Produce a phase completion report (implemented, files touched, DB
   changes, API changes, security changes, tests run + results, known
   issues, remaining work, performance notes, docs updated, next phase).
8. Get explicit confirmation before starting the next phase on a project
   this size — phases are not skipped silently.
