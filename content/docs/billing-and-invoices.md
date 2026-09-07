---
title: Billing, Invoices, and Payments
slug: billing-and-invoices
category: billing
url: https://docs.meridiandata.com/billing-and-invoices
updated: 2026-07-30
audience: all
---

# Billing, Invoices, and Payments

This page covers how Meridian charges you, how to change payment details, and what happens when a payment fails. For what each plan costs and how usage is counted, see [Plans and Pricing](https://docs.meridiandata.com/plans-and-pricing).

## Who can manage billing

Only members with the **Owner** or **Billing** role can view invoices, change payment methods, or change plans. Admins cannot — this is deliberate, so you can give someone full technical control without exposing company payment details.

To grant billing access, go to **Settings → Members**, click the member, and add the `Billing` role. A member can hold `Billing` alongside any other role.

## Billing cycle

Your billing period starts on the day you first subscribed and renews on the same day each month. If you subscribed on the 31st, months without a 31st bill on the last day.

Each invoice contains:

1. **The plan fee**, charged in advance for the coming period.
2. **Overage from the previous period**, charged in arrears, because usage is only known after the period ends.
3. **Add-ons**, charged in advance and prorated if added mid-period.
4. **Tax**, where applicable.

This means your first invoice has no overage line, and your final invoice after cancelling may contain only overage.

## Payment methods

Meridian accepts:

- **Credit and debit cards** — Visa, Mastercard, American Express, Discover. Cards are charged automatically on the renewal date.
- **ACH direct debit** (US bank accounts) — available on Growth and above. Setup takes 2–3 business days for microdeposit verification.
- **SEPA direct debit** (EU bank accounts) — available on Growth and above.
- **Invoice and wire transfer** — Enterprise only, on annual contracts, with net-30 terms by default. Net-60 is available on request during contracting.

Payment card details are handled entirely by Stripe and never touch Meridian's servers. Meridian stores only the card brand, last four digits, and expiry date.

### Changing your payment method

Go to **Settings → Billing → Payment method → Update**. The new method is used for the next charge; it does not retry past failed charges automatically. If you are updating a card because a payment failed, click **Retry payment now** after saving to settle the outstanding invoice immediately.

## Invoices and receipts

Find every invoice at **Settings → Billing → Invoices**. Each row links to a PDF and to the itemized usage breakdown for that period.

- Invoices are emailed automatically to the workspace Owner.
- Add more recipients at **Settings → Billing → Billing email recipients**. These addresses receive invoices and payment failure notices but do not need to be Meridian users. Up to 5 addresses.
- To add a PO number, VAT ID, company legal name, or a remittance address to future invoices, edit **Settings → Billing → Billing details**. Changes apply to invoices issued after you save — Meridian cannot reissue a past invoice with different details.

### Usage breakdown

Click **View usage** on any invoice to see MAR attributed per sync, per table, and per destination for that period. This is the fastest way to answer "why was this month expensive" — sort by MAR descending and the culprit is almost always at the top.

Usage data is also available from the API at `GET /v1/usage`. See the [API Reference](https://docs.meridiandata.com/api-reference).

## Tax

Meridian charges sales tax, VAT, or GST where it is legally required based on your billing address.

- **United States** — sales tax is applied in states where Meridian has nexus. If you are tax exempt, email your exemption certificate to support@meridiandata.com and it is applied within two business days.
- **European Union** — VAT is charged at your country's rate. If you supply a valid VAT ID at **Settings → Billing → Billing details**, the reverse charge mechanism applies and no VAT is added. Meridian validates VAT IDs against VIES at save time; an invalid ID is rejected with an explanation.
- **United Kingdom** — UK VAT is charged unless a valid UK VAT number is on file.
- **Canada, Australia, and others** — GST is charged where required.

Tax is calculated at the moment an invoice is issued. Adding a VAT ID does not retroactively remove tax from earlier invoices.

## Failed payments and dunning

When a charge fails, Meridian retries on a fixed schedule and emails the Owner and all billing recipients at each step.

| Day | What happens |
| --- | --- |
| 0 | Charge fails. First email sent. `invoice.payment_failed` webhook fires. |
| 3 | First automatic retry. |
| 7 | Second automatic retry. Warning banner appears in the app for all members. |
| 14 | Third and final automatic retry. |
| 21 | Syncs are **paused**. Configuration, connections, and destination data are untouched. |
| 45 | Workspace is suspended. The app is read-only. |
| 90 | Workspace and all Meridian-held configuration are permanently deleted. |

Nothing is deleted from your destination warehouse at any point — that data is in your infrastructure and Meridian never removes it.

To recover at any stage before day 90, add a working payment method and click **Retry payment now**. Syncs resume within 5 minutes. Data that changed at the source while syncs were paused is picked up on the next run; CDC tables may need a resync if the pause outlasted your source's log retention (see `SYNC-105` in [Troubleshooting Sync Failures](https://docs.meridiandata.com/troubleshooting-sync-failures)).

## Refunds and credits

- **Monthly plans** are not refunded for partial months. Cancel and you keep access until the period ends.
- **Annual plans** are refundable on a prorated basis within the first 30 days. After 30 days, annual fees are non-refundable except where a contract says otherwise.
- **Overage disputes** — if you believe a MAR figure is wrong, email support@meridiandata.com with the invoice number within 60 days. Meridian reviews the sync logs behind the number and issues a credit if the charge was incorrect.
- **SLA credits** for missed uptime commitments are described in [Support and SLA](https://docs.meridiandata.com/support-and-sla). They are issued as account credit, not cash, and must be requested within 30 days of the incident.

Account credit is applied automatically against the next invoice and never expires.

## Cancelling

Cancel at **Settings → Billing → Cancel plan**. You are asked to type the workspace name to confirm.

On cancellation:

- Syncs continue until the end of the current billing period.
- At period end, the workspace moves to Starter. It is not deleted.
- A final invoice covering any outstanding overage is issued within 24 hours of the period ending.
- Configuration is retained for 90 days on Starter, so reactivating later restores everything.

To delete the workspace entirely rather than downgrade it, see [Account and Workspace Management](https://docs.meridiandata.com/account-and-workspace).
