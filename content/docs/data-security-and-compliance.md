---
title: Data Security and Compliance
slug: data-security-and-compliance
category: security
url: /docs/data-security-and-compliance
updated: 2026-07-15
audience: all
---

# Data Security and Compliance

## Certifications and attestations

| Framework | Status | Evidence |
| --- | --- | --- |
| SOC 2 Type II | Certified, audited annually | Report available under NDA |
| ISO 27001:2022 | Certified | Certificate on the Trust Center |
| GDPR | Compliant | DPA and SCCs available |
| CCPA / CPRA | Compliant | Covered by the standard DPA |
| HIPAA | Available on Enterprise | BAA required |
| PCI DSS | Not applicable | Meridian never processes cardholder data; payments are handled by Stripe |

Request the SOC 2 Type II report, penetration test summary, and ISO certificate from the [Trust Center](https://trust.meridiandata.com) or by emailing security@meridiandata.com. The SOC 2 report requires a signed NDA and is typically delivered within one business day.

The current SOC 2 Type II covers the period **1 January 2026 to 30 June 2026** and was issued 12 August 2026.

## How Meridian handles your data

The most important architectural fact: **Meridian is a pipeline, not a data store.** Your data passes through Meridian on its way from source to destination. It is not retained afterward.

### In transit

All connections use TLS 1.2 or higher, with TLS 1.3 preferred. TLS 1.0 and 1.1 are disabled. Certificate validation is enforced on both source and destination connections and cannot be turned off.

### In processing

Data is held in memory and, for large batches, on encrypted ephemeral disk while a run is in flight. Ephemeral volumes are encrypted with AES-256 and destroyed when the worker terminates.

### After a run

| Data | Retention |
| --- | --- |
| Row data from a successful run | Purged within 24 hours |
| Row data from a failed run | Retained 7 days for debugging, then purged |
| Row counts and table names | Retained per your plan's log retention |
| Actual row *values* in logs | Never logged |

Meridian's logs record that 48,213 rows moved from `public.orders`. They never record what was in those rows.

### At rest

The only customer data Meridian stores long-term is configuration: connection settings, sync definitions, schedules, table and column selections, and run metadata. All of it is encrypted at rest with AES-256.

Credentials get an extra layer: they are encrypted with per-workspace data keys held in AWS KMS, and they are **write-only**. No Meridian employee, and no customer Admin or Owner, can read a stored credential back. This is enforced in the data model, not by policy.

## Data residency

| Region | Code | Available on |
| --- | --- | --- |
| US East (Virginia) | `us-east` | All plans, default |
| EU West (Ireland) | `eu-west` | Scale, Enterprise |
| Asia Pacific (Sydney) | `ap-southeast` | Enterprise |

All processing and all stored configuration for a workspace stay inside its region. Data does not leave the region during a sync.

The region is fixed at workspace creation and **cannot be changed**. Moving means creating a new workspace in the target region and rebuilding. Decide before you build.

## Access controls inside Meridian

- Employee access to production requires SSO with hardware-key MFA and is granted by role, reviewed quarterly.
- Production access is **just-in-time**: engineers request time-boxed elevation with a stated reason, and every session is logged and recorded.
- **No employee can access customer row data by default.** Doing so requires your explicit written approval for a specific support case, is limited to the scope you approve, expires automatically, and is recorded in an audit trail you can request.
- Infrastructure changes go through peer-reviewed code. Nobody applies changes by hand in production.
- Offboarding revokes all access within 4 hours of a termination request.

## Network security

Meridian connects **outbound** to your systems from static egress IP addresses per region — listed in [Getting Started](/docs/getting-started). You never open an inbound path to Meridian, and you can restrict source access to exactly those addresses.

These IPs are stable and Meridian gives **30 days' notice** by email before changing them.

Where you cannot allowlist, use an SSH tunnel through a bastion, or the reverse-tunnel agent on Enterprise, which requires no inbound access at all. Both are covered in [Sources and Connectors](/docs/connectors-sources).

Dedicated egress IP ranges are available on Enterprise for $500/month.

## Column-level controls

You control what leaves your systems.

**Column exclusion** — deselect any column and Meridian never reads it. This is the strongest control available: excluded data never enters Meridian's infrastructure at any point. Use it for anything you have no analytical need for.

**Column hashing** — apply SHA-256 with a per-workspace salt at extraction time. The destination receives only the hash. Joins on the hashed value still work; the original value does not leave your source. Available on Growth and above.

**Column masking** — replace values with a fixed pattern such as `***`. Useful when a column must exist for schema compatibility but its contents must not travel. Available on Growth and above.

Configure all three at **Syncs → [sync] → Tables → [table] → Columns**.

Changing a column's treatment does not rewrite history. Data already in the destination stays as it was written; apply a resync if you need historical rows treated the new way.

## Subprocessors

| Subprocessor | Purpose | Data accessed | Location |
| --- | --- | --- | --- |
| Amazon Web Services | Infrastructure hosting | All, encrypted | Per workspace region |
| Datadog | Monitoring and logging | Operational metadata only, never row data | US, EU |
| Stripe | Payment processing | Billing data only | US |
| Postmark | Transactional email | Email addresses and names | US |
| Anthropic | In-app support assistant | Support conversation text only | US |

The current list is maintained at [meridiandata.com/subprocessors](https://meridiandata.com/subprocessors). Subscribe there to be notified **30 days before** any addition, which is also the window in which you may object under the DPA.

## GDPR

Meridian acts as a **data processor**; you are the controller. The [Data Processing Agreement](https://meridiandata.com/dpa) is incorporated into the standard terms and needs no separate signature, though Meridian will countersign a copy on request.

Standard Contractual Clauses cover transfers out of the EEA. Choosing `eu-west` residency keeps processing inside the EU entirely.

### Data subject requests

Because Meridian does not retain row data after a sync, most DSRs are satisfied entirely in your own systems. Delete or anonymize the record at the source, and the change propagates on the next sync — as a soft delete by default, or a hard delete if you have enabled it.

For personal data Meridian holds directly — the name and email of a Meridian user — write to privacy@meridiandata.com. Meridian responds within **30 days**, and typically within 5 business days.

### Deletion

Deleting a workspace triggers a 30-day soft delete, after which everything Meridian holds is irreversibly destroyed. Backups age out on their own 35-day cycle. A signed certificate of deletion is available on request.

Data already in your destination warehouse is in your infrastructure and Meridian never touches it.

## HIPAA

Available on **Enterprise only**, and only with a signed BAA in place before any PHI is synced.

Requirements:

- A signed Business Associate Agreement. Contact sales; expect 1–2 weeks for legal review.
- The workspace must be provisioned as HIPAA-enabled. This cannot be applied to an existing workspace — a new one is required.
- Audit logging is mandatory and cannot be disabled.
- Failed-run payload retention is reduced from 7 days to 24 hours.

Syncing PHI without a BAA violates the terms of service. If you are unsure whether your data is PHI, ask before you connect it.

## Vulnerability management

- **Penetration testing** — full-scope external test by an independent firm annually, plus a targeted test after any major architectural change. An executive summary is available under NDA.
- **Bug bounty** — a public program at [meridiandata.com/security](https://meridiandata.com/security). Rewards from $250 to $25,000 by severity. Safe harbor is granted for good-faith research within scope.
- **Dependency scanning** — automated on every build; critical vulnerabilities block deployment.
- **Patching SLA** — critical within 24 hours, high within 7 days, medium within 30 days.

Report a vulnerability to security@meridiandata.com. A PGP key is published at [meridiandata.com/.well-known/security.txt](https://meridiandata.com/.well-known/security.txt). Meridian acknowledges reports within one business day.

## Business continuity

- Configuration databases are backed up continuously with point-in-time recovery to any moment in the last 35 days.
- Backups are encrypted and replicated across at least three availability zones within the workspace region.
- Recovery objectives: **RPO 5 minutes, RTO 4 hours.**
- Disaster recovery is tested twice a year, and the test results are summarized in the SOC 2 report.

A Meridian outage does not put your data at risk. Data already in your warehouse is unaffected, and syncs resume from their last committed position when service is restored — the one caveat being CDC sources whose log retention is shorter than the outage, covered under `SYNC-105` in [Troubleshooting Sync Failures](/docs/troubleshooting-sync-failures).

## Incident response

Meridian classifies security incidents by severity and notifies affected customers of any confirmed breach of their data within **72 hours** of confirmation, meeting GDPR Article 33 timelines.

Notifications go to the workspace Owner and all security contacts configured at **Settings → Security → Security contacts**. Set at least one address that is monitored by a team rather than an individual.

Service incidents — outages and degradations, as opposed to security events — are posted at [status.meridiandata.com](https://status.meridiandata.com). Subscribe for email, RSS, or webhook updates.

## Security questionnaires

Meridian maintains completed CAIQ and SIG Lite questionnaires in the [Trust Center](https://trust.meridiandata.com), which answers most vendor reviews without any back-and-forth. Check there first.

For a custom questionnaire, email security@meridiandata.com. Turnaround is 5–10 business days, and is prioritized for Scale and Enterprise.
