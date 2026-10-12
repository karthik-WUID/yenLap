# YenLap

**Keep the memories. Give it another life.**

YenLap acquires dead or very old laptops, attempts restoration, and gives the verified original owner the first opportunity to reclaim the same laptop by paying its restoration cost. If the owner declines, the laptop can enter refurbished inventory after its privacy obligations are resolved.

Recoverable personal data is returned securely to the verified original owner **free of charge**. Recovery requires consent and reviewed ownership evidence; resale requires resolved data handling and a recorded sanitization certificate.

This repository contains the responsive public website, customer portal, admin dashboard, and technician/operations workspace with a shared TypeScript backend. Public branding is **YenLap**; internal package names and some device IDs still use `rebyte`.

## Current status

The web MVP and Phase 1 workflows are implemented and run locally. **Android comes after the web milestone; no Android app or APK is included yet.**

| Area | Available now | Remaining work |
| --- | --- | --- |
| Public website | Supplied cinematic hero video, poster fallback, HTML/SVG branding and CTAs, responsive layout | Final business/contact/privacy/terms content and browser QA |
| Authentication | Mobile OTP flow, expiry, cooldown, failed-attempt lockout, sessions and four server-managed roles | Live SMS provider, staff MFA and distributed limits |
| Customer journeys | Device registration/photos, pickup confirmation, timeline, recovery consent, reclaim/decline and graceful closure | Versioned quotes, payments and structured return handover |
| Ownership | Encrypted private evidence, admin review, serial matching, approval/rejection reason and audit | Verification escalation, step-up checks and evidence retention |
| Collection | Future pickup proposal, collector assignment, owner confirmation, condition/serial/price and handover/payment references | Serviceable areas, dispatch capacity and uploaded signed collection documents |
| Repair | Assigned technician access, diagnosis, itemized parts/labour, six QC checks and rework gates | Parts stock/reservation and hardware test evidence |
| Inventory | Acquisition details, restoration costs, owner decision, basic resale/buyer/price/margin and recycling records | Search/filters, reports/export, warranties, returns and payment reconciliation |
| Data return | AES-256-GCM encrypted local uploads, owner-only one-use download links and receipt confirmation | Production object storage/KMS, larger streaming uploads and retention automation |
| Notifications | In-app updates, WhatsApp opt-in/out, persistent outbox, local WhatsApp/push mocks | Approved WhatsApp templates, real SMS/push delivery, signed callbacks and queue backoff |
| Infrastructure | Persistent local state, optional PostgreSQL aggregate adapter, lifecycle/RBAC tests | Normalized PostgreSQL, Redis worker, backups, monitoring and HTTPS deployment |

**Local mocks do not send real SMS, WhatsApp messages or push notifications.** Acquisition payment references are recorded manually; the app does not transfer money or verify bank settlement. Hardware recovery and disk erasure are performed externally; this application records their results and enforces lifecycle gates.

## Open the local app

| Screen | Address |
| --- | --- |
| Homepage | [http://localhost:3000/](http://localhost:3000/) |
| Customer/admin/technician/operations | [http://localhost:3000/workspace](http://localhost:3000/workspace) |
| Backend health | [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health) |

If the servers are already running, open these addresses directly. The app runs on this machine; local hosting is not a public deployment.

## Quick start

From the project directory, with Node.js 22 or newer:

```sh
bash run-local.sh
```

The launcher creates missing local environment files, installs dependencies, runs checks, and starts the web and API together. Stop it with **Ctrl+C**. Local data survives normal restarts.

## Manual setup on another machine

Requirements: **Node.js 22 or newer**, npm with workspace support, and the complete project including `package-lock.json` and public media. Docker is optional for PostgreSQL/Redis development.

From the project directory:

```sh
npm ci
cp -n .env.example apps/api/.env
cp -n .env.example apps/web/.env.local
npm run dev
```

The API reads `apps/api/.env`; Next.js reads `apps/web/.env.local`. `cp -n` preserves existing files.

Key local settings:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DEMO_MODE` | Enables local OTP codes and role-switch login | `true` |
| `NEXT_PUBLIC_DEMO_MODE` | Shows local demo login buttons | `true` |
| `WEB_ORIGIN` | Allowed web origin for the API | `http://localhost:3000` |
| `PORT` | API port | `4000` |
| `API_URL` | Server-side web proxy destination | `http://127.0.0.1:4000` |
| `DATA_FILE` | Persistent local state file, relative to API directory | `./data/state.json` |
| `NEXT_PUBLIC_HERO_VIDEO` | Homepage video asset | `/yenlap-hero.mp4` |
| `DATABASE_URL` | Optional PostgreSQL connection | Unset in local file mode |
| `STORAGE_DIR` | Private encrypted object directory | `./data/private` |
| `STORAGE_KEY` | Optional 64-hex-character encryption key | Generated privately in local mode |

Provider credentials belong in server-side configuration, never in browser-exposed `NEXT_PUBLIC_*` variables. Production adapters currently fail closed until real integrations are implemented.

## Demo accounts and devices

On the workspace login page, select a local demo role or use mobile OTP registration. In demo mode the random OTP is displayed on the login screen. Public OTP registration creates customer accounts; clients cannot choose an admin/staff role.

| Role | Demo person | Mobile |
| --- | --- | --- |
| Customer | Karthik | `+919876543210` |
| Admin | Ananya | `+919876543211` |
| Technician | Arun | `+919876543212` |
| Operations | Meera | `+919876543213` |

Use **Logout** to switch roles and **Refresh** to see updates made in another session.

- **HP Pavilion 15 / RB-1042:** restored, awaiting the original owner's decision.
- **Dell Latitude 5490:** registered and ready for pickup scheduling.
- **Lenovo ThinkPad T480:** awaiting technician QC.

Fresh datastores use `RB-DEMO-PICKUP` and `RB-DEMO-QC` for the last two examples. The current local datastore uses `RB-a2e7ee4d` and `RB-178e8dad`. Demo ownership approvals, receipts, payment references and recovered files are synthetic examples.

## End-to-end workflow

1. **Customer:** register the laptop, condition/photos and collection address. Submit ownership proof and grant recovery consent if desired. Enable WhatsApp journey updates in Notifications.
2. **Operations:** propose a future pickup slot and assign a collector.
3. **Customer:** confirm the slot. Rescheduling clears the previous confirmation.
4. **Collector:** inspect the laptop and record serial, condition, purchase price, acquisition source, signed handover receipt reference and payment reference. Move the collected device to Received.
5. **Admin:** privately open ownership evidence, compare the declared serial against the inspected laptop and handover, and approve/reject with a reason. Phone OTP alone does not satisfy ownership review.
6. **Technician:** move the assigned laptop into Diagnosis; record repair work, parts quantities/unit costs and labour. Advance restoration and consent-gated data recovery as appropriate.
7. **Technician:** record boot, display, keyboard, network, battery and storage test results. Every check must pass before Restored. Rework or repair changes invalidate earlier QC.
8. **Admin:** open the original-owner offer after restoration and ownership approval. The customer chooses reclaim or decline. Online payment and structured return scheduling are the next phase.
9. **Data return:** admin uploads recoverable files through the private recovery endpoint; the verified original owner downloads them free and separately confirms receipt. Data return remains available after customer journey closure.
10. **Resale/disposition:** after explicit owner decline, resolved data handling and recorded sanitization evidence, operations can move the laptop to refurbished inventory, record buyer/price, sale and completion or recycling.

The application links **Customer Journey**, **Device Journey** and **Business Journey** events. Customer closure hides later internal progress and suppresses pending external journey updates while the device/business lifecycle continues.

Lifecycle stages:

```text
registered → pickup_scheduled → collected → received → diagnosis
→ restoration_started → data_recovery (when applicable) → testing
→ restored → owner_decision_required
→ returned_to_owner OR refurbished_inventory → sold
→ journey_completed
```

Diagnosis/restoration/testing also support recycling, and testing can return to restoration for rework. Recycling completion requires data resolution, sanitization and disposition records.

## Project structure

```text
apps/
  web/                 Next.js / React marketing and authenticated web UI
  api/                 Express / TypeScript API, storage and outbox worker
packages/
  domain/              Shared lifecycle rules, authorization and projections
docs/
  PRODUCT.md           Product requirements and roles
  ARCHITECTURE.md      API, data model, security and infrastructure limits
  WORKFLOWS.md         Detailed Phase 1 walkthrough
  ROADMAP.md           Step-by-step construction milestones
  PROVIDERS.md         WhatsApp/SMS/payment recommendations and onboarding
  VALIDATION.md        Completed checks and unverified areas
run-local.sh           Local setup/check/start launcher
.env.example           Example configuration
```

This recovered source copy omits the optional standalone `preview.html`. See [source recovery notes](docs/SOURCE_RECOVERY.md) for restored setup files.

## Checks and build

```sh
npm test
npm run typecheck
npm run typecheck -w apps/web
npm run build
```

As of **30 September 2026**, all **29 automated tests** pass, TypeScript checks and the Next.js production build pass, and the latest dependency audit reports zero known vulnerabilities. Live HTTP checks cover homepage/portal rendering, API proxy, video range delivery and safe customer/staff API views.

Tests cover lifecycle transitions, role/owner isolation, OTP lockout, stale writes, private evidence review, pickup confirmation/rescheduling, QC/rework, WhatsApp preferences, encrypted storage and owner-only free data delivery. Full API scenarios exercise both decline/resale and same-device reclaim paths.

Browser click-through/screenshot QA, PostgreSQL/Docker execution and real provider delivery remain unverified. A successful production build does not mean production integrations or deployment are complete.

## Optional PostgreSQL mode

```sh
docker compose up -d
```

Set this in `apps/api/.env` and restart the API:

```dotenv
DATABASE_URL=postgresql://rebyte:rebyte@localhost:5432/rebyte
```

The current adapter stores one locked JSONB aggregate. It is not the final normalized schema. Existing local JSON data is not automatically imported into PostgreSQL. Redis is provisioned by Compose for future worker integration; the current outbox worker polls persisted state without Redis.

Local state and encrypted files live under `apps/api/data/`. Preserve the private encryption key with the encrypted objects when backing up; files cannot be decrypted without their key. Local file mode supports one API instance.

## Video and branding

The supplied assets are included unchanged:

- `apps/web/public/yenlap-hero.mp4`: 10-second, 1280×720 cinematic hero video.
- `apps/web/public/yenlap-reference.png`: poster/reference fallback.

Logo, tagline, navigation, principles and CTAs are HTML/SVG overlays. Video supports muted looping, pause, reduced-motion and data-saver preferences. Existing branding inside the supplied footage remains part of that asset.

## Next milestones

1. Versioned restoration quotes, payment verification, receipts and return handover.
2. Inventory filters, parts stock, reporting, warranty/returns and stronger disposition evidence.
3. Live WhatsApp/SMS/push providers with approved templates and verified callbacks.
4. Production storage/KMS/retention, database/queue infrastructure, staff MFA and deployment validation.
5. Expo Android customer app using the same backend after the web milestone.

**WhatsApp is the primary external notification channel.** MSG91 is the current recommendation for WhatsApp and SMS OTP; Razorpay is a candidate for the payments phase. Accounts are not yet connected. See [provider setup](docs/PROVIDERS.md) and the [full roadmap](docs/ROADMAP.md).

## Troubleshooting

- **Port already in use:** check whether the existing app is already running; open the local URLs before starting another instance.
- **Node module/runtime error:** use Node 22+ before running the supplied launcher.
- **Record changed:** refresh the device before retrying; writes require the current record version.
- **Forbidden:** check the signed-in role, original owner and assigned technician/collector.
- **Transition blocked:** complete the required pickup confirmation, ownership review, QC, data-return or sanitization step.
- **No real WhatsApp message:** current delivery is mocked. Check local Notifications and complete provider onboarding for the later live integration.

[Product requirements](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Workflow guide](docs/WORKFLOWS.md) · [Validation](docs/VALIDATION.md)
