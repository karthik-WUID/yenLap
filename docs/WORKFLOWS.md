# Phase 1 walkthrough

Open http://localhost:3000/workspace. Local role buttons are demonstrations only. Use Logout to switch role and Refresh to reload changes made in another tab.

1. Customer: register a laptop; submit original-owner declaration, serial sticker/purchase proof and explanation in Ownership verification. Enable WhatsApp journey updates in Notifications if desired.
2. Operations: choose the registered device, propose a future pickup slot/address and assign Meera (collector).
3. Customer: open the device and confirm the proposed pickup. Rescheduling requires a fresh confirmation.
4. Operations: as the assigned collector, inspect the serial/condition and record price, signed handover receipt reference and payment reference (or zero-value acknowledgement). This records collection; it does not transfer money. Move the device to Received.
5. Admin: open the private evidence, compare it to the physically inspected serial and handover, then approve/reject with a reason. Rejection is visible to the owner; corrected proof can be submitted. Only original owner/admin can access private evidence images. Phone OTP alone is insufficient.
6. Technician: advance to Diagnosis, record diagnosis, repair part quantities/unit costs and labour. Move to Restoration started, Data recovery when consent/approved ownership permit, then Testing.
7. Technician: record actual boot/display/keyboard/network/battery/storage results and observations. Any failed check blocks Restored. Rework or edited repair costs clears previous QC.
8. Admin: after restored and verified ownership, move to Owner decision required. Customer sees the restoration cost and chooses reclaim or decline. The payment/return workflow is the next construction phase; no online payment is currently processed.
9. Admin/customer: use encrypted recovery upload, authenticated free download and separate owner receipt confirmation. Record externally issued sanitization evidence before resale. Decline closes the customer journey while internal inventory/sale continues.

Local examples include a pickup-ready Dell and a Lenovo awaiting QC, plus the original HP owner-offer demo. Fresh datastores seed these as RB-DEMO-PICKUP and RB-DEMO-QC; the already-running datastore uses RB-a2e7ee4d and RB-178e8dad. All are synthetic examples. Never submit private recovered files as condition photos. Ownership evidence is separately encrypted; production retention/reauthentication remains a later milestone.
