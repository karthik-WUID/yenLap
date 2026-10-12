# ReByte product specification

ReByte buys old or dead laptops, attempts restoration, and offers the SAME device to its verified original owner first, at parts + labour cost. The acquisition payment is recorded separately. Declining closes the customer's relationship to the journey; internal restoration, refurbishment, sale or recycling continue. Recoverable personal data belongs to the verified owner and is returned free, regardless of whether the laptop is reclaimed.

## MVP roles and interfaces

- Public: emotional marketing, process, trust promises, entry to mobile OTP login.
- Customer: mobile OTP registration/login, device condition and photo submission, pickup location, each laptop's timeline, restoration price, reclaim/decline, consent withdrawal, close journey, in-app updates.
- Operations: scheduling and collection, acquisition source/location/price/date/person, serial, logistics, refurbishment, buyer/price, disposition.
- Technician: assigned devices only; diagnosis, repair/parts/labour costs, diagnosis/restoration/recovery/testing milestones.
- Admin: complete inventory, technician assignment, ownership verification, data disposition, cost/margin, all milestones, notification delivery and audit history.

## Lifecycle

Registered → pickup scheduled → collected → received → diagnosis → restoration started → data recovery (optional) → testing → restored → owner decision required.

Owner reclaim → returned to owner → completed. Owner decline AND resolved data return AND recorded storage sanitization → refurbished inventory → sold → completed. Diagnosis, restoration or testing may move to recycling; recycling completion requires disposition and storage/data evidence. Testing can return to restoration for rework. No automatic expiry of the owner's first opportunity.

Customer can decline or close their interest at any point. Subsequent internal events are hidden from the customer and do not send journey messages. A final closure entry remains visible; privacy/data-return messages remain enabled as a separate obligation. Restoration and data recovery are best-effort; neither is guaranteed.

## Three linked journeys

Each mutation produces an event with actor, timestamp, note, customer visibility and snapshots for the Customer Journey, Device Journey and Business Journey. The customer projection excludes acquisition cost, buyer, staff identity and sanitization information. Staff can switch between journey views. Business snapshots map lifecycle stages to acquisition leads, collection bookings, acquired assets, repair assessment/costs, owner offers, available stock and recorded sales. Never infer the inventory lifecycle from the closed customer projection.

## Screen map

`/`: public marketing. `/workspace`: OTP sign-in, role-aware overview, device tabs, registration, linked journeys, privacy and reclaim cards, staff forms and next-stage actions, notifications and admin audit history. Layout changes from desktop sidebar to mobile navigation. Staff accounts are seeded locally; public onboarding always creates a customer.

## Acceptance gates

Cross-owner reads/actions denied; unassigned technician reads denied. Lifecycle jumps denied. Consent + ownership verification required for recovery. First opportunity cannot be bypassed. Resale requires explicit decline + data resolution + sanitization certificate. Sale requires buyer + positive price. Customer closing journey does not end device work. Optimistic version checks reject stale writes. Customer projection hides internal events and business data. OTP failures persist and lock after five attempts. Audit and outbox entries commit atomically with domain changes.
