# Provider recommendation and onboarding

Checked 30 September 2026. Recommendation for this India-focused application: MSG91 for WhatsApp journey notifications and SMS OTP, then Razorpay for restoration payments. This is a recommendation, not an account purchase or completed live integration. The app continues to work locally with mocks.

## WhatsApp first

1. Create an MSG91 account and a Meta Business Portfolio owned by your business.
2. Follow MSG91's Meta/business verification and WhatsApp number onboarding guide. A dedicated business number makes this setup easier to manage; existing WhatsApp Business App numbers have a separate coexistence flow. Choose the route appropriate to your existing number.
3. Confirm YenLap business name, website, country and the other business information requested by the provider. Complete number verification yourself.
4. Configure approved message templates and their language/variables. Suggested lifecycle messages: pickup proposal/confirmation, device received, restoration milestone, restored owner offer, recovery ready and return confirmation. Provider/Meta review decides category/approval; draft names below are suggestions only.
5. Send a test to an opted-in business test number, then connect provider keys on the server, verify signed callbacks and confirm delivered/failed statuses before live use.

The website already records explicit WhatsApp opt-in/withdrawal and suppresses pending sends after opt-out. In-app notifications continue. Recovered files and private ownership photos must never be attached to lifecycle WhatsApp notifications; messages direct the owner to the authenticated portal.

MSG91 currently documents a ₹500/month platform fee per WhatsApp number, with the onboarding month and following month exempt, plus applicable template/message charges. Confirm the rate card, taxes and current commercial terms in your account before recharge; message costs vary. Auto-recharge is optional business spending and should be set by the account owner.

Official references: [MSG91 onboarding](https://msg91.com/help/whatsapp/whatsapp-number-integration---onboarding), [Meta portfolio setup through MSG91](https://msg91.com/help/whatsapp/how-to-begin-with-whatsapp), [MSG91 charges](https://msg91.com/help/all-service-deductions-), [WhatsApp pricing](https://msg91.com/in/pricing/whatsapp), [channel API setup](https://docs.msg91.com/).

## SMS OTP

Use MSG91's SMS/OTP onboarding and required sender/template approvals from its dashboard/documentation. Start with SMS login so access does not depend on WhatsApp authentication-template availability. OTP expiry, rate limiting, failed-attempt lockout and server-managed customer roles already exist locally. Live OTP must use approved templates and server-only credentials; never display or log production codes.

## Payments later

Razorpay is a suitable candidate for Indian restoration payments. Its published standard plan lists 2% + GST and no setup/annual maintenance charges; payment methods/promotions can have different conditions. Payment activation requires provider onboarding. Before enabling returns, implement server-verified paid amount/currency/order ownership, signed webhooks, duplicate handling, receipts and refunds. A browser success screen alone must not mark a restoration bill paid.

Official reference: [Razorpay pricing](https://razorpay.com/pricing/).

## Draft template content

| Suggested template name | Event | Draft content |
|---|---|---|
| yenlap_pickup_proposed | pickup_scheduled | Your YenLap pickup for {{device_id}} is proposed for {{slot}}. Sign in to confirm. |
| yenlap_device_received | received | YenLap has received {{device_id}}. Follow its restoration journey in your account. |
| yenlap_restored_offer | owner_decision_required | Your old laptop is alive again. You have the first choice to bring {{device_id}} home for the recorded restoration cost of {{amount}}. Sign in to choose. |
| yenlap_recovery_ready | recovery_uploaded | Recoverable data for {{device_id}} is ready for a secure free return. Sign in to your verified YenLap account. |
| yenlap_return_update | returned_to_owner | The return of {{device_id}} has been recorded. View your journey and receipt in your account. |

Template approval and business verification are external steps. No production credentials, subscription or provider account has been created by this implementation.
