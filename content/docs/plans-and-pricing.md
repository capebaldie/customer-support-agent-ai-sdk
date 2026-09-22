---
title: Plans and Pricing
slug: plans-and-pricing
category: billing
url: /docs/plans-and-pricing
updated: 2026-08-28
audience: all
---

# Plans and Pricing

Meridian Sync is priced on **Monthly Active Rows (MAR)**, not on connectors, seats, or compute. You pick a plan with an included MAR allowance, and you pay overage if you exceed it.

## Plan comparison

| | Starter | Growth | Scale | Enterprise |
| --- | --- | --- | --- | --- |
| **Monthly price** | Free | $499 | $1,900 | Custom, from $40,000/year |
| **Included MAR / month** | 100,000 | 5,000,000 | 25,000,000 | Negotiated |
| **Overage rate** | Not available | $18 per additional 1M MAR | $14 per additional 1M MAR | Negotiated |
| **Seats** | 2 | 10 | 25 | Unlimited |
| **Source connections** | 3 | Unlimited | Unlimited | Unlimited |
| **Destinations** | 1 | 3 | 10 | Unlimited |
| **Minimum sync frequency** | 24 hours | 1 hour | 15 minutes | 5 minutes |
| **Log-based CDC** | No | Yes | Yes | Yes |
| **Concurrent syncs** | 1 | 5 | 20 | Custom |
| **Sync log retention** | 7 days | 30 days | 90 days | 365 days |
| **SAML SSO** | No | No | Yes | Yes |
| **SCIM provisioning** | No | No | No | Yes |
| **Data residency choice** | No (`us-east`) | No (`us-east`) | `us-east`, `eu-west` | All regions |
| **Uptime SLA** | None | None | 99.9% | 99.95% |
| **Support** | Community + email, 3 business days | Email, 1 business day | Email + chat, 4 business hours | Dedicated CSM, 1 hour for P1, 24/7 |

Annual billing saves 16.7% — you pay for ten months and get twelve. Annual plans are billed in full on the start date.

## What a Monthly Active Row is

A Monthly Active Row is **one distinct primary key that Meridian inserted, updated, or deleted in a destination during a calendar month.**

The important word is *distinct*. Counting works like this:

- A row synced once in a month counts as **1 MAR**.
- The same row updated 50 times in that month still counts as **1 MAR**, not 50.
- A row that exists at the source but did not change is read, compared, and skipped. It counts as **0 MAR**.
- A row deleted at the source and marked deleted in the destination counts as **1 MAR**.
- The same primary key synced to **two different destinations** counts as **2 MAR**, once per destination.
- The counter resets on the first day of each calendar month at 00:00 UTC.

This means an incremental sync running every 15 minutes costs no more than the same sync running daily, as long as the same rows are changing. Frequency does not drive cost. **Change volume does.**

### Worked example

A `orders` table has 2,000,000 rows. During March:

- 40,000 new orders are created.
- 120,000 existing orders are updated, some of them several times.
- 3,000 orders are deleted.
- The other rows never change.

March MAR for this table is 40,000 + 120,000 + 3,000 = **163,000**, regardless of whether the sync ran hourly or every five minutes.

### What does not count toward MAR

- Rows read from the source but not written because nothing changed.
- Failed sync runs. If a run errors before writing, the rows it read are not billed. Partially completed runs bill only what was actually written.
- Rows in the `Meridian Sandbox` destination.
- Schema and metadata operations.
- API requests. The REST API is not metered separately.

## Historical backfills

The first run of any sync is a full historical backfill and every row it loads counts toward MAR in the month the backfill runs. A 12 million row backfill on the Growth plan consumes your entire 5 million allowance and bills 7 million MAR of overage — $126 at $18 per million.

Three ways to control this:

1. **Select fewer tables.** Most first bills are large because someone selected an entire schema. Sync what analysts actually query.
2. **Limit the backfill window.** In sync settings, set **Historical sync window** to a number of days. Meridian then loads only rows whose cursor column falls inside that window. This is available on incremental and CDC tables.
3. **Ask for a backfill credit.** For a first backfill on a new paid plan, contact support@meridiandata.com *before you run it*. Meridian routinely grants a one-time credit covering the initial load on Growth and above. Credits are not granted retroactively for backfills you have already run.

## Overage billing

Overage is calculated at the end of each billing period, rounded up to the nearest million MAR, and added to the next invoice as a separate line item.

There is no cap by default. If you want a hard stop, enable **Settings → Billing → Hard usage cap**. When enabled, all syncs pause once you reach your configured limit and resume on the first of the next month or when you raise the cap. Paused syncs emit a `usage.threshold_reached` webhook and error code `SYNC-401`.

Starter accounts always behave as if a hard cap is set. There is no overage on Starter — syncs stop at 100,000 MAR.

## Changing plans

**Upgrades take effect immediately.** You are charged a prorated amount for the remainder of the current billing period, and the higher MAR allowance applies at once. Your MAR already consumed this month carries over; it is not reset by an upgrade.

**Downgrades take effect at the end of the current billing period.** You keep your current features until then. Meridian will not let you downgrade while you are over the target plan's limits — for example, you cannot move from Scale to Growth while you have five destinations connected, because Growth allows three. Remove the excess first.

Change plans at **Settings → Billing → Plan**. Owners and members with the `Billing` role can do this.

## Add-ons

| Add-on | Price | Available on |
| --- | --- | --- |
| Additional seat | $30/seat/month | Growth, Scale |
| Extra destination | $150/month | Growth, Scale |
| Extended log retention (365 days) | $200/month | Scale |
| `eu-west` data residency | Included | Scale, Enterprise |
| HIPAA compliance and BAA | Custom | Enterprise only |
| Dedicated egress IP range | $500/month | Enterprise only |

## Free trial

Every new workspace gets a **14-day Growth trial** with 5,000,000 MAR included. No credit card is required to start. When the trial ends the workspace drops to Starter unless you add a payment method, and any configuration that exceeds Starter limits — a fourth connection, a second destination, an hourly schedule — is paused rather than deleted. Add a card and it resumes exactly as configured.

Trials can be extended once by 14 days. Ask support@meridiandata.com before the trial expires.

## Nonprofit and startup discounts

- **Nonprofits** with registered charitable status get 50% off Growth and Scale. Email support@meridiandata.com with your registration number.
- **Startups** under $2M raised and under 3 years old get Growth free for 12 months through the Meridian for Startups program. Apply at [meridiandata.com/startups](https://meridiandata.com/startups).

Discounts do not stack and do not apply to overage.
