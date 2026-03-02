/**
 * Pool of gig templates for software and accounting/audit/tax.
 * Amounts: software 1,000–20,000 KSh; accounting 500–10,000 KSh.
 */

import type { GigCategory } from "../types";

export interface GigTemplate {
  title: string;
  category: GigCategory;
  amountMin: number;
  amountMax: number;
  /** Estimated hours for a mid-level professional (optional; defaults by category if not set) */
  estimatedHoursMin?: number;
  estimatedHoursMax?: number;
  shortDescription: string;
  fullDescription: string;
}

const DEFAULT_HOURS: Record<GigCategory, { min: number; max: number }> = {
  software: { min: 2, max: 8 },
  accounting: { min: 2, max: 7 },
};

export const GIG_TEMPLATES: GigTemplate[] = [
  // Software (1,000 - 20,000)
  {
    title: "Bug fix – mobile app",
    category: "software",
    amountMin: 2000,
    amountMax: 8000,
    estimatedHoursMin: 1,
    estimatedHoursMax: 4,
    shortDescription: "Fix a critical bug in an existing mobile application.",
    fullDescription:
      "The client has a mobile app (React Native / Flutter) with a bug affecting login or payments. You will get access to the repo, reproduce the issue, implement a fix, and provide a short summary. Expected delivery within 1–2 weeks.",
  },
  {
    title: "API integration",
    category: "software",
    amountMin: 3000,
    amountMax: 15000,
    estimatedHoursMin: 4,
    estimatedHoursMax: 10,
    shortDescription: "Integrate a third-party API (e.g. payment or SMS) into an existing system.",
    fullDescription:
      "Integrate a specified third-party API into the client's backend (e.g. M-Pesa, SMS gateway, or external CRM). Includes reading docs, implementing the integration, error handling, and basic tests. Delivery and payment after successful testing.",
  },
  {
    title: "Small feature – web app",
    category: "software",
    amountMin: 1500,
    amountMax: 10000,
    estimatedHoursMin: 3,
    estimatedHoursMax: 7,
    shortDescription: "Add a small feature or form to an existing web application.",
    fullDescription:
      "Add one clearly scoped feature to an existing web app (e.g. a new form, report, or dashboard widget). You will work in their codebase and follow their stack. Timeline and payment agreed upfront.",
  },
  {
    title: "Database script or migration",
    category: "software",
    amountMin: 1000,
    amountMax: 6000,
    estimatedHoursMin: 1,
    estimatedHoursMax: 4,
    shortDescription: "Write a one-off script or migration for data cleanup or reporting.",
    fullDescription:
      "Write a safe, documented script (e.g. SQL or a small app) to migrate data, fix inconsistencies, or generate a one-off report. Includes a short doc on how to run and roll back if needed.",
  },
  {
    title: "Code review – backend",
    category: "software",
    amountMin: 2000,
    amountMax: 7000,
    estimatedHoursMin: 2,
    estimatedHoursMax: 5,
    shortDescription: "Review a backend or API codebase and provide a written report.",
    fullDescription:
      "Review a backend/API codebase (e.g. Node, Python, or .NET) for security, performance, and maintainability. Deliver a concise written report with prioritized findings and optional short call to discuss.",
  },
  {
    title: "UI fix or small redesign",
    category: "software",
    amountMin: 1500,
    amountMax: 9000,
    estimatedHoursMin: 2,
    estimatedHoursMax: 6,
    shortDescription: "Fix UI bugs or implement a small redesign for a web or mobile screen.",
    fullDescription:
      "Fix specific UI bugs or implement a small redesign (e.g. one screen or flow) in a web or mobile app. You will receive designs or a clear spec and work in their repo. Payment on acceptance.",
  },
  {
    title: "Documentation or runbook",
    category: "software",
    amountMin: 1000,
    amountMax: 5000,
    estimatedHoursMin: 2,
    estimatedHoursMax: 5,
    shortDescription: "Write technical documentation or an operations runbook for a system.",
    fullDescription:
      "Produce clear documentation (setup, API, or runbook) for an existing system. Includes steps for running, deploying, and handling common issues. Format agreed with the client (e.g. Markdown or Confluence).",
  },
  {
    title: "Small automation script",
    category: "software",
    amountMin: 1000,
    amountMax: 6000,
    estimatedHoursMin: 1,
    estimatedHoursMax: 4,
    shortDescription: "Automate a repetitive task (e.g. file processing or reporting).",
    fullDescription:
      "Build a small script or tool to automate a defined task (e.g. file processing, report generation, or backup). Delivered with brief instructions and, if needed, a one-off handover call.",
  },
  {
    title: "Security or performance check",
    category: "software",
    amountMin: 3000,
    amountMax: 12000,
    estimatedHoursMin: 3,
    estimatedHoursMax: 7,
    shortDescription: "Perform a focused security or performance assessment of an app or API.",
    fullDescription:
      "Carry out a scoped security or performance review (e.g. OWASP top 10, N+1 queries, slow endpoints). Deliver a short report with findings and practical recommendations. No full penetration test unless agreed separately.",
  },
  {
    title: "Setup CI/CD pipeline",
    category: "software",
    amountMin: 5000,
    amountMax: 20000,
    estimatedHoursMin: 4,
    estimatedHoursMax: 10,
    shortDescription: "Set up or fix a CI/CD pipeline for build, test, and deploy.",
    fullDescription:
      "Set up or repair a CI/CD pipeline (e.g. GitHub Actions, GitLab CI, or Jenkins) for build, test, and deploy. Includes basic docs and a short handover. Scope and environment (staging/production) agreed upfront.",
  },
  // Accounting / audit / tax (500 - 10,000)
  {
    title: "Bookkeeping – one month",
    category: "accounting",
    amountMin: 1500,
    amountMax: 6000,
    estimatedHoursMin: 3,
    estimatedHoursMax: 7,
    shortDescription: "Prepare books and reconciliations for one month for a small business.",
    fullDescription:
      "Record transactions, reconcile bank and key accounts, and produce a trial balance (and optionally management accounts) for one month. Client provides bank statements and supporting documents. Delivery within agreed deadline.",
  },
  {
    title: "VAT return preparation",
    category: "accounting",
    amountMin: 1000,
    amountMax: 5000,
    estimatedHoursMin: 1,
    estimatedHoursMax: 4,
    shortDescription: "Prepare and file a single VAT return for a small business.",
    fullDescription:
      "Prepare the VAT return from the client's records (or from provided data), reconcile to the ledger, and file the return. You may also advise on payment. Scope is one return period unless otherwise agreed.",
  },
  {
    title: "Payroll – one run",
    category: "accounting",
    amountMin: 500,
    amountMax: 4000,
    estimatedHoursMin: 2,
    estimatedHoursMax: 4,
    shortDescription: "Process one payroll run and produce payslips and summary.",
    fullDescription:
      "Process one payroll run: calculate gross and net pay, statutory deductions (e.g. PAYE, NSSF), and produce payslips and a payroll summary. Assumes employee list and rates are provided. One-off or first-month gig.",
  },
  {
    title: "Internal audit – small area",
    category: "accounting",
    amountMin: 3000,
    amountMax: 10000,
    estimatedHoursMin: 4,
    estimatedHoursMax: 8,
    shortDescription: "Review one process or area (e.g. cash, inventory) and write a short report.",
    fullDescription:
      "Perform an internal audit of one process or area (e.g. cash handling, inventory, or procurement). Document process, test controls, note gaps, and deliver a short written report with recommendations. Scope agreed before starting.",
  },
  {
    title: "Tax computation – draft",
    category: "accounting",
    amountMin: 2000,
    amountMax: 8000,
    estimatedHoursMin: 3,
    estimatedHoursMax: 7,
    shortDescription: "Draft income tax computation and supporting schedules for a small entity.",
    fullDescription:
      "Prepare a draft income tax computation and key schedules from the client's accounts or records. Does not include filing or representation unless agreed. Suitable for sole traders or small companies with straightforward affairs.",
  },
  {
    title: "Bank and ledger reconciliation",
    category: "accounting",
    amountMin: 500,
    amountMax: 3000,
    shortDescription: "Reconcile bank statements and key ledger accounts for a given period.",
    fullDescription:
      "Reconcile bank statement(s) and selected ledger accounts (e.g. receivables, payables) for a specified period. List and classify unreconciled items. Client provides statements and access to books or export.",
  },
  {
    title: "Expense review and coding",
    category: "accounting",
    amountMin: 500,
    amountMax: 4000,
    shortDescription: "Review and correctly code a batch of expenses for accounting/tax.",
    fullDescription:
      "Review a batch of expense documents (receipts, invoices), code them to the correct accounts and cost centres, and flag any missing or invalid items. Output in a format agreed with the client (e.g. spreadsheet or import file).",
  },
  {
    title: "Financial report summary",
    category: "accounting",
    amountMin: 1000,
    amountMax: 5000,
    shortDescription: "Summarise financial statements or a report for management or board.",
    fullDescription:
      "From provided financial statements or a longer report, produce a short summary (narrative and/or key metrics) suitable for management or the board. One round of revisions included. Scope (e.g. one quarter, one year) agreed upfront.",
  },
  {
    title: "Compliance checklist – small entity",
    category: "accounting",
    amountMin: 1500,
    amountMax: 6000,
    shortDescription: "Prepare a compliance checklist (filing dates, registrations) for a small business.",
    fullDescription:
      "Prepare a compliance checklist for a small business covering key filings (tax, statutory, regulatory), due dates, and registrations. Based on entity type and industry. Deliver as a simple document or spreadsheet with short notes.",
  },
  {
    title: "Chart of accounts setup",
    category: "accounting",
    amountMin: 1000,
    amountMax: 5000,
    shortDescription: "Design and set up a chart of accounts for a new or small business.",
    fullDescription:
      "Design a chart of accounts suitable for the business (e.g. SME, sole trader) and, if needed, set it up in their accounting software. Include a short guide on usage and common postings. One round of tweaks included.",
  },
  // --- Additional software variants (11–50) ---
  { title: "Bug fix – web app", category: "software", amountMin: 1500, amountMax: 7000, shortDescription: "Fix a critical bug in an existing web application.", fullDescription: "The client has a web app with a bug affecting checkout or auth. You will get repo access, reproduce, fix, and document. Delivery 1–2 weeks." },
  { title: "REST API design and implementation", category: "software", amountMin: 4000, amountMax: 18000, shortDescription: "Design and implement a REST API for a new or existing product.", fullDescription: "Design endpoints, implement in the client's stack (Node, Python, etc.), add validation and error handling. Docs and basic tests included." },
  { title: "React component library audit", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Audit a React component library for accessibility and consistency.", fullDescription: "Review component API, a11y, and patterns. Deliver a short report and optional refactor list. Scope agreed upfront." },
  { title: "Data export or ETL script", category: "software", amountMin: 2000, amountMax: 9000, shortDescription: "Build a one-off data export or ETL script between two systems.", fullDescription: "Extract from source (DB, API, or file), transform as specified, load to destination. Document and hand over with run instructions." },
  { title: "Unit test suite for legacy module", category: "software", amountMin: 3000, amountMax: 12000, shortDescription: "Add unit tests for an existing legacy codebase module.", fullDescription: "Identify critical paths, write unit tests (e.g. Jest, pytest), aim for agreed coverage. No refactor unless agreed." },
  { title: "Mobile app – one screen", category: "software", amountMin: 5000, amountMax: 18000, shortDescription: "Implement one new screen in an existing React Native or Flutter app.", fullDescription: "One screen from design/spec: layout, navigation, and API wiring. Follow existing patterns. Payment on acceptance." },
  { title: "Docker and deployment setup", category: "software", amountMin: 3500, amountMax: 14000, shortDescription: "Containerise an app and document deployment steps.", fullDescription: "Dockerfile(s), optional compose, and a short runbook for deploy (e.g. to a VPS or cloud). One round of tweaks." },
  { title: "GraphQL schema and resolvers", category: "software", amountMin: 4000, amountMax: 16000, shortDescription: "Add or extend GraphQL schema and resolvers for an existing backend.", fullDescription: "Design schema changes, implement resolvers, and basic tests. Align with existing auth and data layer." },
  { title: "Email or notification integration", category: "software", amountMin: 2000, amountMax: 8000, shortDescription: "Integrate email or push notifications into an existing app.", fullDescription: "Wire up sending (e.g. SendGrid, FCM) per spec: templates, triggers, and error handling. Docs included." },
  { title: "Logging and monitoring setup", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Set up structured logging and basic monitoring for an app.", fullDescription: "Add logging (e.g. structured JSON), optional log aggregation, and basic health/uptime checks. Short runbook." },
  { title: "Fix failing CI tests", category: "software", amountMin: 1500, amountMax: 7000, shortDescription: "Diagnose and fix failing tests or builds in an existing CI pipeline.", fullDescription: "Reproduce locally, fix tests or config, and ensure pipeline is green. One-off engagement." },
  { title: "Database indexing review", category: "software", amountMin: 2000, amountMax: 9000, shortDescription: "Review DB queries and suggest or add indexes for performance.", fullDescription: "Identify slow queries, suggest/add indexes, document changes. No schema redesign unless agreed." },
  { title: "OAuth or SSO integration", category: "software", amountMin: 4000, amountMax: 15000, shortDescription: "Integrate OAuth2 or SSO (e.g. Google, Microsoft) into an app.", fullDescription: "Implement login flow per provider docs, handle tokens and refresh. Basic tests and docs." },
  { title: "Admin dashboard – CRUD", category: "software", amountMin: 5000, amountMax: 18000, shortDescription: "Build a simple admin dashboard with CRUD for one entity.", fullDescription: "One entity: list, create, edit, delete, with validation. Uses existing API and auth. Timeline agreed upfront." },
  { title: "PDF generation feature", category: "software", amountMin: 2500, amountMax: 11000, shortDescription: "Add PDF generation (report or document) to an existing app.", fullDescription: "Generate PDF from template and data (e.g. invoice, report). Library and format agreed. One round of layout tweaks." },
  { title: "Search implementation", category: "software", amountMin: 3500, amountMax: 14000, shortDescription: "Add full-text or filtered search to an existing app.", fullDescription: "Implement search (DB full-text or external) per spec: filters, sorting, pagination. Basic performance check." },
  { title: "Cron or scheduled job", category: "software", amountMin: 2000, amountMax: 8000, shortDescription: "Implement a scheduled task or cron job for a defined workflow.", fullDescription: "One recurring job: logic, error handling, idempotency. Deploy and monitor approach agreed. Document run and failure handling." },
  { title: "API versioning or deprecation", category: "software", amountMin: 3000, amountMax: 12000, shortDescription: "Introduce API versioning or manage deprecation of an endpoint.", fullDescription: "Versioning strategy and implementation (e.g. URL or header). Optional deprecation path and client notice." },
  { title: "Front-end form validation overhaul", category: "software", amountMin: 2000, amountMax: 9000, shortDescription: "Improve client-side validation and error messages on key forms.", fullDescription: "Review forms, add/improve validation and UX. Align with backend rules. One round of changes." },
  { title: "Backup and restore procedure", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Document and optionally automate backup and restore for a system.", fullDescription: "Document current state, propose backup strategy, and optional scripts. Runbook for restore." },
  { title: "Rate limiting or throttling", category: "software", amountMin: 2000, amountMax: 8000, shortDescription: "Add rate limiting or throttling to an API or app.", fullDescription: "Implement per-IP or per-user limits per spec. Document limits and behaviour. Basic tests." },
  { title: "Webhook handler", category: "software", amountMin: 3000, amountMax: 12000, shortDescription: "Implement a webhook receiver and processor for a third-party service.", fullDescription: "Receive webhooks, verify signature, process payload, idempotency. Retry and failure handling per spec." },
  { title: "Cache layer (e.g. Redis)", category: "software", amountMin: 3500, amountMax: 13000, shortDescription: "Add a cache layer (e.g. Redis) to improve performance.", fullDescription: "Identify hot paths, add caching, invalidation strategy. Document and optional monitoring." },
  { title: "Localisation (i18n) setup", category: "software", amountMin: 3000, amountMax: 11000, shortDescription: "Add i18n/l10n to an existing app for one or more locales.", fullDescription: "Extract strings, add i18n library, implement for agreed locales. No new copywriting unless agreed." },
  { title: "Error tracking integration", category: "software", amountMin: 1500, amountMax: 6000, shortDescription: "Integrate an error-tracking service (e.g. Sentry) into an app.", fullDescription: "Install SDK, configure envs, add source maps if needed. Short doc for team." },
  { title: "Load test and report", category: "software", amountMin: 3500, amountMax: 14000, shortDescription: "Run load tests and produce a short performance report.", fullDescription: "Define scenarios, run load tests, document bottlenecks and recommendations. No fixes unless agreed." },
  { title: "Dependency upgrade – security", category: "software", amountMin: 2000, amountMax: 9000, shortDescription: "Upgrade dependencies to address known security issues.", fullDescription: "Audit deps, upgrade and test. Document breaking changes and any config updates." },
  { title: "Feature flags setup", category: "software", amountMin: 3000, amountMax: 11000, shortDescription: "Introduce a simple feature-flag mechanism in an app.", fullDescription: "Add feature flags (config or service), document usage. No product decisions." },
  { title: "Audit log for sensitive actions", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Add an audit log for login and sensitive actions.", fullDescription: "Log defined events (e.g. login, role change) to DB or external. Query/view agreed. Retention as per policy." },
  { title: "Slack or Teams bot – small", category: "software", amountMin: 4000, amountMax: 15000, shortDescription: "Build a small Slack or Microsoft Teams bot for a defined workflow.", fullDescription: "One or two commands or actions, deploy and document. Scope agreed upfront." },
  { title: "Excel/CSV import", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Implement Excel or CSV import for a defined data model.", fullDescription: "Parse file, validate, map to model, report errors. Format and rules agreed. One round of changes." },
  { title: "Health check endpoint", category: "software", amountMin: 1000, amountMax: 5000, shortDescription: "Add health/readiness endpoints for an API or service.", fullDescription: "Implement /health and optional /ready, document. Used for load balancer or orchestrator." },
  { title: "Config externalisation", category: "software", amountMin: 2000, amountMax: 8000, shortDescription: "Move config from code to env or config service.", fullDescription: "Externalise secrets and config, document env vars and defaults. No new features." },
  { title: "Static site or landing page", category: "software", amountMin: 5000, amountMax: 16000, shortDescription: "Build a static marketing site or single landing page.", fullDescription: "Design-to-code or from copy. Responsive, fast. One round of content/layout tweaks." },
  { title: "WebSocket or real-time feature", category: "software", amountMin: 4000, amountMax: 15000, shortDescription: "Add a real-time feature (e.g. WebSocket) to an existing app.", fullDescription: "Implement real-time updates per spec: auth, scaling considerations. Document and test." },
  { title: "Microservice extraction – one endpoint", category: "software", amountMin: 6000, amountMax: 20000, shortDescription: "Extract one bounded capability into a small service.", fullDescription: "Define API, extract logic, deploy and wire from existing app. Docs and runbook." },
  { title: "Codebase documentation – overview", category: "software", amountMin: 2000, amountMax: 8000, shortDescription: "Produce a high-level overview and architecture doc for a codebase.", fullDescription: "Read codebase, document structure, main flows, and deployment. One round of edits." },
  { title: "Test data seeding", category: "software", amountMin: 1500, amountMax: 6000, shortDescription: "Create or improve seed data for dev/staging environments.", fullDescription: "Script or fixture set for key entities. Document how to run and reset." },
  { title: "Accessibility (a11y) audit – 5 pages", category: "software", amountMin: 3000, amountMax: 12000, shortDescription: "Audit up to 5 key pages for accessibility and suggest fixes.", fullDescription: "WCAG-focused review, list of issues with severity. Optional fix implementation as separate scope." },
  { title: "Database backup automation", category: "software", amountMin: 2500, amountMax: 10000, shortDescription: "Automate database backups and verify restore.", fullDescription: "Schedule backups, optional off-site copy, document restore steps. One round of tweaks." },
  // --- Additional accounting variants (51–100) ---
  { title: "Bookkeeping – quarter", category: "accounting", amountMin: 4000, amountMax: 14000, shortDescription: "Prepare books and reconciliations for one quarter for a small business.", fullDescription: "Record transactions, reconcile bank and key accounts, produce trial balance and management accounts for the quarter. Client provides statements and supporting documents." },
  { title: "VAT return – multiple periods", category: "accounting", amountMin: 2500, amountMax: 9000, shortDescription: "Prepare and file VAT returns for 2–3 periods.", fullDescription: "Prepare returns from client records, reconcile to ledger, file and advise on payment. Scope agreed upfront." },
  { title: "Payroll – three months", category: "accounting", amountMin: 1500, amountMax: 8000, shortDescription: "Process payroll for three consecutive months.", fullDescription: "Three payroll runs: gross/net, statutory deductions, payslips and summary. Employee data provided by client." },
  { title: "Internal audit – two areas", category: "accounting", amountMin: 5000, amountMax: 15000, shortDescription: "Review two processes or areas and write a short report.", fullDescription: "Audit two areas (e.g. cash and inventory), document and test controls, deliver report with recommendations." },
  { title: "Tax computation – full year", category: "accounting", amountMin: 4000, amountMax: 12000, shortDescription: "Draft full-year income tax computation and schedules.", fullDescription: "Full-year computation and key schedules from client accounts. No filing unless agreed. One round of revisions." },
  { title: "Reconciliation – multi-account", category: "accounting", amountMin: 1500, amountMax: 6000, shortDescription: "Reconcile bank and several ledger accounts for a period.", fullDescription: "Bank and multiple control accounts, list unreconciled items. Client provides statements and ledger export." },
  { title: "Expense audit – sample", category: "accounting", amountMin: 2000, amountMax: 7000, shortDescription: "Audit a sample of expenses for policy and coding.", fullDescription: "Sample-based review of expenses: policy compliance, correct coding. Report and recommendations." },
  { title: "Management accounts – draft", category: "accounting", amountMin: 3500, amountMax: 11000, shortDescription: "Prepare draft management accounts for one period.", fullDescription: "P&L, balance sheet, cash flow from trial balance. One round of management adjustments." },
  { title: "Compliance calendar – annual", category: "accounting", amountMin: 2000, amountMax: 7000, shortDescription: "Prepare annual compliance calendar for a small business.", fullDescription: "List filings, due dates, and responsibilities for the year. Document or spreadsheet with notes." },
  { title: "Chart of accounts – review", category: "accounting", amountMin: 1500, amountMax: 5500, shortDescription: "Review and refine an existing chart of accounts.", fullDescription: "Review current COA, suggest consolidation or new accounts. Short guide on usage. One round of changes." },
  { title: "Fixed asset register", category: "accounting", amountMin: 2000, amountMax: 8000, shortDescription: "Create or update a fixed asset register.", fullDescription: "List assets, depreciation policy, and values. Format agreed (e.g. spreadsheet). Optional integration with ledger." },
  { title: "Cash flow forecast – 3 months", category: "accounting", amountMin: 3000, amountMax: 9000, shortDescription: "Prepare a 3-month cash flow forecast.", fullDescription: "Build forecast from receivables, payables, and known timing. One round of assumptions review." },
  { title: "Intercompany reconciliation", category: "accounting", amountMin: 2500, amountMax: 9000, shortDescription: "Reconcile intercompany balances between two entities.", fullDescription: "Match balances, identify differences, propose adjustments. Scope: two related entities, one period." },
  { title: "Audit prep – schedules", category: "accounting", amountMin: 4000, amountMax: 12000, shortDescription: "Prepare selected audit schedules for external audit.", fullDescription: "Prepare agreed schedules (e.g. receivables, payables) from ledger. Format per auditor request." },
  { title: "Budget vs actual – one period", category: "accounting", amountMin: 2000, amountMax: 7000, shortDescription: "Prepare budget vs actual report for one period.", fullDescription: "Compare actual to budget, variance commentary. One round of revisions." },
  { title: "Grant or donor report", category: "accounting", amountMin: 3000, amountMax: 10000, shortDescription: "Prepare financial report for a grant or donor.", fullDescription: "Report per grant agreement: spend by category, supporting detail. One round of donor feedback." },
  { title: "Inventory count – observation", category: "accounting", amountMin: 2500, amountMax: 8000, shortDescription: "Observe inventory count and reconcile to records.", fullDescription: "Attend count, test counts, reconcile to perpetual records. Short memo on findings." },
  { title: "Policies and procedures – draft", category: "accounting", amountMin: 3500, amountMax: 11000, shortDescription: "Draft accounting or finance policies and procedures.", fullDescription: "Draft 3–5 key policies (e.g. expenses, approvals). One round of management edits." },
  { title: "QuickBooks or Xero setup", category: "accounting", amountMin: 3000, amountMax: 9000, shortDescription: "Set up a new QuickBooks or Xero file for a small business.", fullDescription: "Chart of accounts, opening balances, basic automation. One training session and short guide." },
  { title: "Year-end closing support", category: "accounting", amountMin: 4000, amountMax: 12000, shortDescription: "Support year-end closing and draft financial statements.", fullDescription: "Closing entries, draft statements, notes. Scope agreed (e.g. single entity, no consolidation)." },
  { title: "Cost allocation model", category: "accounting", amountMin: 3500, amountMax: 11000, shortDescription: "Design a simple cost allocation model (e.g. by department).", fullDescription: "Design allocation basis and model, document assumptions. Implement in spreadsheet or with client." },
  { title: "Due diligence – financial", category: "accounting", amountMin: 8000, amountMax: 20000, shortDescription: "Perform financial due diligence for a small acquisition.", fullDescription: "Review accounts, key contracts, and trends. Written report with findings and adjustments. Scope agreed." },
  { title: "Revenue recognition review", category: "accounting", amountMin: 4000, amountMax: 12000, shortDescription: "Review revenue recognition for a few key contracts.", fullDescription: "Apply policy to selected contracts, document treatment. One round of questions." },
  { title: "Statutory accounts – draft", category: "accounting", amountMin: 5000, amountMax: 15000, shortDescription: "Draft statutory accounts for a small company.", fullDescription: "Draft accounts and notes per local GAAP. One round of director/auditor feedback." },
  { title: "Training – accounting software", category: "accounting", amountMin: 1500, amountMax: 6000, shortDescription: "Train staff on accounting software (e.g. QuickBooks, Xero).", fullDescription: "1–2 sessions on day-to-day use: posting, reconciliations, reports. Materials provided." },
  { title: "Expense policy draft", category: "accounting", amountMin: 2000, amountMax: 6000, shortDescription: "Draft an expense and approval policy.", fullDescription: "Policy document: categories, limits, approval flow. One round of edits." },
  { title: "Credit control review", category: "accounting", amountMin: 2500, amountMax: 8000, shortDescription: "Review receivables and suggest credit control improvements.", fullDescription: "Age analysis, bad debt risk, suggest process changes. Short report and optional templates." },
  { title: "Prepayments and accruals", category: "accounting", amountMin: 1500, amountMax: 5500, shortDescription: "Calculate and post prepayments and accruals for a period.", fullDescription: "Compute prepayments and accruals from supporting docs, post to ledger. One period, one entity." },
  { title: "Bank feed setup and rules", category: "accounting", amountMin: 2000, amountMax: 6000, shortDescription: "Set up bank feeds and coding rules in accounting software.", fullDescription: "Connect feeds, create rules for common transactions. Short guide for staff." },
  { title: "Depreciation schedule", category: "accounting", amountMin: 1500, amountMax: 5500, shortDescription: "Prepare or update depreciation schedule for the year.", fullDescription: "Schedule of assets, rates, and depreciation. Reconcile to ledger. One round of changes." },
  { title: "Trial balance review", category: "accounting", amountMin: 1500, amountMax: 6000, shortDescription: "Review trial balance and suggest reclass or correction entries.", fullDescription: "Review TB for misclassifications and errors. List suggested entries. No posting unless agreed." },
  { title: "Petty cash reconciliation", category: "accounting", amountMin: 500, amountMax: 2500, shortDescription: "Reconcile petty cash and document procedures.", fullDescription: "Count cash, reconcile to records, note discrepancies. Short procedure note." },
  { title: "Payroll year-end", category: "accounting", amountMin: 2500, amountMax: 8000, shortDescription: "Process payroll year-end and produce P60/equivalent.", fullDescription: "Year-end payroll run, statutory forms, and summary. One entity, one tax year." },
  { title: "VAT registration support", category: "accounting", amountMin: 2000, amountMax: 6000, shortDescription: "Support VAT registration application and initial return.", fullDescription: "Gather info, complete application, prepare first return. No ongoing compliance unless agreed." },
  { title: "Management report – KPIs", category: "accounting", amountMin: 3000, amountMax: 9000, shortDescription: "Design and produce a one-off management report with KPIs.", fullDescription: "Define KPIs with management, build report (spreadsheet or BI). One round of revisions." },
  { title: "Contract review – payment terms", category: "accounting", amountMin: 2000, amountMax: 7000, shortDescription: "Review contracts for payment terms and accounting impact.", fullDescription: "Extract payment terms and key dates, note accounting implications. Summary report." },
  { title: "Disbursements reconciliation", category: "accounting", amountMin: 1000, amountMax: 4500, shortDescription: "Reconcile client disbursements to bank and ledger.", fullDescription: "Match disbursements to transactions, list exceptions. One period." },
  { title: "Opening balance entry", category: "accounting", amountMin: 1500, amountMax: 5000, shortDescription: "Prepare and post opening balance entries for a new system.", fullDescription: "From prior TB or statements, prepare opening entries. Document and post. One round of corrections." },
  { title: "Audit inquiry responses", category: "accounting", amountMin: 2500, amountMax: 8000, shortDescription: "Draft responses to auditor inquiries and provide support.", fullDescription: "Draft responses to audit questions, gather supporting evidence. Scope per audit plan." },
  { title: "Segment or division report", category: "accounting", amountMin: 3500, amountMax: 10000, shortDescription: "Prepare segment or division P&L and balance sheet.", fullDescription: "Allocate revenue and costs to segments, produce report. One period, agreed allocation basis." },
  { title: "Tax incentive review", category: "accounting", amountMin: 3000, amountMax: 10000, shortDescription: "Review eligibility for a specific tax incentive or relief.", fullDescription: "Assess eligibility, document position, optional application support. One relief type." },
];

export const RECENTLY_USED_GIG_MAX = 40;

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `count` pool indices, preferring ones not recently used, for variety. */
export function pickGigPoolIndices(count: number, recentlyUsed: number[]): number[] {
  const usedSet = new Set(recentlyUsed);
  const preferred = GIG_TEMPLATES.map((_, i) => i).filter((i) => !usedSet.has(i));
  const rest = GIG_TEMPLATES.map((_, i) => i).filter((i) => usedSet.has(i));
  const shuffled = [...shuffleArray(preferred), ...shuffleArray(rest)];
  const indices: number[] = [];
  const chosen = new Set<number>();
  for (let i = 0; i < shuffled.length && indices.length < count; i++) {
    if (!chosen.has(shuffled[i])) {
      chosen.add(shuffled[i]);
      indices.push(shuffled[i]);
    }
  }
  return indices;
}

export function createGigFromTemplate(template: GigTemplate, id: number): {
  id: number;
  title: string;
  category: GigCategory;
  amount: number;
  estimatedHours: number;
  shortDescription: string;
  fullDescription: string;
} {
  const range = template.amountMax - template.amountMin;
  const amount =
    template.amountMin + Math.round(Math.random() * range);
  const hoursRange = template.estimatedHoursMin != null && template.estimatedHoursMax != null
    ? { min: template.estimatedHoursMin, max: template.estimatedHoursMax }
    : DEFAULT_HOURS[template.category];
  const hoursSpan = hoursRange.max - hoursRange.min;
  const estimatedHours = hoursRange.min + Math.round(Math.random() * hoursSpan);
  return {
    id,
    title: template.title,
    category: template.category,
    amount,
    estimatedHours: Math.max(1, estimatedHours),
    shortDescription: template.shortDescription,
    fullDescription: template.fullDescription,
  };
}
