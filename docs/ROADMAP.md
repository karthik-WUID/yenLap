# YenLap construction roadmap

Web is first; Android follows a stable, accepted web/API milestone. Each phase includes local demo flows, appropriate permission/lifecycle tests and validation notes.

| Phase | Work | Current status |
|---|---|---|
| Foundation | Cinematic marketing site, mobile OTP demo, four roles, linked timelines, privacy/resale gates, persistent local state, encrypted free owner recovery delivery | Working MVP; production adapters pending |
| 1 | Private evidence submission/review, pickup proposal/confirmation, assigned collector/receipt records, itemized repair costs, QC pass/fail and WhatsApp preferences | Implemented and tested |
| 2 | Versioned restoration quote, owner acceptance, reminders, payment order/verified settlement, receipt/invoice, return schedule and owner handover confirmation | Next |
| 3 | Inventory search/filters, technician allocation, parts stock, resale buyer/payment, warranty/returns, reports/CSV and recycling evidence | Planned; basic inventory/resale already present |
| 4 | WhatsApp approved templates, signed delivery callbacks, retry/backoff/operator retry, SMS OTP production adapter and push registration | Local mocks work; provider onboarding needed |
| 5 | Private object storage/KMS, larger streaming recovery files, step-up verification, retention, hardware sanitization certificate evidence | Local encrypted adapter works; production/hardware work pending |
| 6 | Normalized PostgreSQL, Redis/BullMQ, migrations, staff MFA, backups/restore, metrics/error monitoring, HTTPS staging, accessibility/browser/mobile QA, privacy/terms/contact content | Planned; local backend and build working |
| 7 | Expo Android customer client using the same API, secure sessions, uploads, timeline, push, owner decision and free data return | Deferred under web-first instruction |

Provider credentials are configured locally/server-side when accounts exist. Creating or buying third-party accounts and proving business ownership require the user's business details and provider onboarding. Hardware recovery and disk erasure require real technician tools; software records the resulting evidence and enforces release/resale gates.
