# Validation — 30 September 2026

## Passed

- All 29 automated tests: lifecycle and permissions, authentication/OTP lockout, owner isolation, assigned technician restrictions, optimistic concurrency, single-use owner downloads, receipt confirmation, encrypted storage and tamper/traversal rejection.
- Full API flow: registration → collection → diagnosis → restoration → data recovery → testing → restored → owner offer → decline → free encrypted data return → receipt → sanitization evidence → refurbished inventory → sale → completion.
- Separate reclaim flow: the same immutable device ID is preserved through owner return and completion.
- Root/API TypeScript checks and Next.js production build, including web TypeScript checks.
- Dependency audit after upgrading to Next.js 16.3.7: zero reported vulnerabilities.
- Live HTTP checks: homepage/portal render, web-to-API proxy, partial-range video delivery, safe customer projection, admin inventory and availability of the original owner's encrypted demo archive.

## Running locally

Homepage: http://localhost:3000/
Customer / admin / technician / operations: http://localhost:3000/workspace
Backend health: http://127.0.0.1:4000/health

The production web build is serving on loopback port 3000. API is running on loopback port 4000 with persistent local state and mock OTP/WhatsApp/push providers. Seed laptop RB-1042 remains at the owner-decision stage for user review. Its encrypted recovery archive contains explicitly synthetic demonstration memories. Automated tests used a separate temporary datastore.

## Limits

Browser screenshot and interactive click-through QA remain unverified because the browser automation provider is unavailable. PostgreSQL/Docker mode and real providers are unverified. Hardware recovery/sanitization, payments, production KMS/retention and verification escalation/retention are separate deployment work documented in ARCHITECTURE.md. Android is deferred under the web-first instruction.

## Media

The supplied video was copied unchanged to apps/web/public/yenlap-hero.mp4 (1280×720, 10.006 seconds). The supplied image is the poster fallback. HTML/SVG supplies branding, tagline, principles and CTAs. Player code supports mute/loop, pause and reduced-motion/data-saver preferences; live video delivery passed.

## Phase 1 update

Passed root/API and web typechecks, Next.js production build, all 29 tests and live homepage/portal/proxy/video checks. Added coverage for encrypted private ownership review access, approval bypass/serial mismatch, pickup confirmation/rescheduling/receipt gates, failed QC/rework/cost calculation and WhatsApp opt-in/withdrawal. Both full decline/resale and same-device reclaim flows now use the structured collection/repair/review/QC APIs.

Local example journeys: Dell Latitude 5490 (`RB-a2e7ee4d`) is ready for pickup scheduling; Lenovo ThinkPad T480 (`RB-178e8dad`) is awaiting technician QC. They are clearly labeled synthetic local demonstrations. Original `RB-1042` owner choice is unchanged. Web production server and API remain on ports 3000/4000. Browser interaction/screenshot QA remains unavailable because the browser automation inventory is empty; no claim of browser click-through verification is made.
