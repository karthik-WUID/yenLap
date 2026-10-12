# Architecture and security

## Monorepo

- `apps/web`: Next.js App Router, React/TypeScript, marketing and role-aware authenticated web UI.
- `apps/api`: Express 5 TypeScript API (the equivalent lightweight alternative to NestJS), sessions, OTP, RBAC, repository, event outbox worker and mock provider boundaries.
- `packages/domain`: shared stages, transition policies, actor authorization and customer projection.
- `apps/mobile`: planned Expo customer client after the web milestone; shares the API and domain vocabulary.
- `docs`: product, architecture and runbook.

## Persistence

Local mode uses a serialized transaction queue and atomic rename of JSON state. PostgreSQL mode uses a single JSONB aggregate with row lock and transaction. This is a real persistence adapter suitable for MVP semantics, not the final normalized schema. It serializes writes and needs migration to normalized tables for volume. Do not run multiple API instances against the same local file.

Data entities: User (verified phone, name, server-managed role), Session (hashed random token, expiry), OTP (hashed challenge, expiry, failed attempts), Device (original owner, immutable ID, brand/model/serial, condition/photos, address/pickup, acquisition person/date/price, assigned technician, diagnosis, parts/labour, consent, identity verification, data return, sanitization, owner decision, buyer/price, disposition, version), LifecycleEvent (three linked snapshots), Notification (event ID, recipient, channel, attempts/status/read), AuditEntry (actor/action/device/time). All money is INR in this demo; production should use integer minor units.

Recommended normalized PostgreSQL schema: users, phone_challenges, sessions, devices, acquisition_records, pickup_jobs, work_orders, repair_costs, ownership_evidence, consent_records, data_recovery_jobs, recovery_deliveries, sanitization_certificates, owner_offers, owner_decisions, sales, dispositions, lifecycle_events, notification_outbox, notification_deliveries, audit_entries. Foreign keys bind every record to immutable device and original owner IDs. Resale buyer is a separate party. Preserve owner identity after closure according to an approved retention schedule.

## API

POST `/auth/otp/request`, `/auth/otp/verify`, `/auth/demo` (explicit local mode only), `/auth/logout`; GET `/me`. GET/POST `/devices`; PATCH `/devices/:id` (staff fields); POST `/devices/:id/action` with action, value and expected version (decision, close, consent, transition). POST `/devices/:id/recovery/upload` (admin, encrypted object), POST `/devices/:id/recovery/request` (verified original owner), GET `/recovery/:token` (owner-authenticated, one-use two-minute link), POST `/devices/:id/recovery/confirm` (owner receipt); GET `/notifications`, POST `/notifications/:id/read`; GET `/audit` admin-only; GET `/health`.

Cookie session for web: HttpOnly, SameSite Strict, Secure in production. Android can use bearer token in encrypted SecureStore. API refuses client-selected roles. Authentication and authorization are enforced server-side. Versions provide optimistic concurrency; repository lock serializes mutation/outbox/audit. JSON inputs are bounded; image photos are restricted to JPEG/PNG/WebP and four files. Proxy `/api` keeps browser requests same-origin. Global request rate limit and OTP expiry/cooldown/attempt lock are enabled. Production needs distributed limits/session lifecycle, phone-risk controls and stronger staff MFA.

## Notifications and providers

OTPProvider, MessagingProvider and ObjectStorage interfaces isolate vendor concerns. One domain event creates in-app and push outbox records, plus WhatsApp records only for an explicitly opted-in original owner. Opt-out suppresses pending WhatsApp records; closing a customer chapter suppresses pending external journey updates. In-app records are immediate. A local persistent polling worker retries external channels up to five times and supplies stable event/channel idempotency keys. MOCK DELIVERY output does not mean real WhatsApp or push delivery. API demo mode exposes random OTP codes and seeded role selection ONLY when explicitly enabled.

Redis is provisioned in Compose for the later BullMQ worker; current MVP uses a transactional database/file outbox and polling, not Redis. This preserves local functionality without services. Production requires actual OTP, WhatsApp Business approved-template/opt-in and push adapters, delivery callback validation, exponential retry, operator retry UI, and a separate worker. Production providers currently fail closed. Do not set production mode and treat mocks as live integrations.

## Privacy

Consent and structured, admin-reviewed ownership verification gate recovery and owner reclaim offers. Private ownership photos use the encrypted object-storage adapter; they never appear in public condition-photo arrays. The admin must open the evidence before recording a review, match its declared serial to the collected device, and record a reason. Raw PATCH cannot mark identity verified. Recovered bytes must never be included in device photos, application logs, event notes, notification payloads or WhatsApp messages. Production recovery artifacts require encrypted object storage, KMS keys, verified owner reauthentication, short-lived authorized links, audited delivery, revocation and retention deletion. Staff record data status, verified secure delivery reference and storage sanitization certificate before resale. A claimed `returned` status requires prior recovered state and verified delivery reference. The local MVP implements AES-256-GCM encrypted recovery objects, admin uploads gated by consent/ownership, authenticated owner-only one-use two-minute download links, download auditing and owner receipt confirmation. The filesystem encryption key is private and generated locally; this is a development adapter, requiring KMS/private object storage, step-up reauthentication, retention automation and larger streamed uploads before production. Serving a download is not proof of receipt; the owner confirms it separately. Actual forensic recovery and physical disk erasure must occur through approved external processes. Do not upload personal recovered files to the photo endpoint.

Consent withdrawal stops future recovery. Already recovered data remains an owner-return/deletion obligation. Journey closure is distinct from consent and privacy records. Recording a certificate does not erase hardware; evidence must be issued from the approved sanitization tool/workflow. Audit is append-only through the API but the MVP datastore is editable by its operator; production needs tamper-evident/WORM audit export and retention policy.

## Before live operation

Configure and validate all real provider adapters and private encrypted storage; migrate data model; add staff MFA, verification escalation and ownership evidence retention; implement payment verification/refunds/receipts (the current reclaim choice arranges payment manually); harden owner secure recovery delivery (step-up, streaming, retention) and certificate evidence; distributed limiting, queue backoff/webhooks/opt-out preferences; accessibility/device QA; backups/restore and observability; conduct independent security review. These are explicit deployment gaps, not hidden production claims.

## Phase 1 workflow APIs

- GET `/staff`: admin/operations directory of collector/technician IDs and names.
- PATCH `/me/preferences`: customer explicit WhatsApp opt-in/out, with consent timestamp and audit event.
- POST `/devices/:id/ownership`: original owner declaration, claimed serial, explanation and JPG/PNG/WebP proof up to 1MB; encrypted private object. Safe customer projection exposes review status/reason only.
- GET `/devices/:id/ownership/evidence`: authorized original owner/admin only; no-store, audited private read. Operations and technicians cannot access images.
- POST `/devices/:id/ownership/review`: admin only, opened submitted proof, inspected serial and collection handover required for approval; reviewer/time/reason persisted.
- POST `/devices/:id/pickup/schedule`: operations/admin proposes a future time, address and valid collector; rescheduling clears customer confirmation.
- POST `/devices/:id/pickup/confirm`: original owner confirms the proposed slot.
- POST `/devices/:id/pickup/collect`: assigned collector/admin records actual handover, serial, condition, acquisition price and receipt/payment references and emits `collected`.
- POST `/devices/:id/repair`: assigned technician/admin writes diagnosis, bounded parts items/quantities/INR costs and labour. Server computes parts total. Editing costs invalidates QC; costs freeze after restored/offer.
- POST `/devices/:id/quality`: assigned technician/admin records boot/display/keyboard/network/battery/storage checks and observations during testing. Every result must be true before `restored`; rework clears previous QC.

Workflow writes require expected device version. Generic PATCH cannot bypass pickup, identity approval or repair-cost workflows. Next-stage lists are role filtered. Serviceability, dispatch capacity, signed-document collection uploads, part stock reservation and instrumented hardware test evidence are still pending.

Existing unstructured identity flags do not satisfy the new ownership guard. Only explicit synthetic demonstration records receive approved demo metadata. Real existing records must undergo a documented evidence/collection-history review; a boolean alone never grants recovery downloads.
