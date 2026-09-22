---
title: Support and Service Level Agreement
slug: support-and-sla
category: support
url: https://docs.meridiandata.com/support-and-sla
updated: 2026-08-08
audience: all
---

# Support and Service Level Agreement

## How to reach support

| Channel | Available on | How |
| --- | --- | --- |
| Documentation | All | [docs.meridiandata.com](https://docs.meridiandata.com) |
| Community forum | All | [community.meridiandata.com](https://community.meridiandata.com) |
| Email | All | support@meridiandata.com, or **Help → Contact support** in the app |
| In-app chat | Scale, Enterprise | The chat bubble, bottom right |
| Dedicated Slack channel | Enterprise | Set up during onboarding |
| Phone escalation | Enterprise | Number issued with your contract, P1 only |
| Customer Success Manager | Enterprise | Named contact, scheduled reviews |

Opening a ticket from inside the app attaches your workspace ID, plan, and recent run history automatically. It is the fastest route and saves a round trip.

## Response time targets

First response, measured from when you send the ticket.

| Severity | Starter | Growth | Scale | Enterprise |
| --- | --- | --- | --- | --- |
| **P1** — Critical | 3 business days | 1 business day | 4 business hours | **1 hour, 24/7** |
| **P2** — High | 3 business days | 1 business day | 8 business hours | 4 hours |
| **P3** — Normal | 3 business days | 1 business day | 1 business day | 8 business hours |
| **P4** — Low | Best effort | 2 business days | 1 business day | 1 business day |

Business hours are **09:00–18:00 US Mountain Time, Monday to Friday**, excluding US public holidays. Enterprise P1 coverage is 24/7/365 including holidays.

These are **first response** targets, not resolution targets. Resolution depends on the problem — a permissions fix takes minutes, a connector defect takes a release cycle. Meridian commits to updating you at least once per business day on any open P1 or P2 until it is closed.

## Severity definitions

**P1 — Critical.** Production is down or data is at risk. All syncs failing, data corruption in a destination, a security incident, or a total inability to access the workspace.

**P2 — High.** Major functionality is impaired with no workaround. One important sync failing repeatedly, a connector broken after a source-side change, or severely degraded performance.

**P3 — Normal.** Functionality is impaired but there is a workaround, or you have a question about behavior. A single non-critical table failing, a confusing error, a configuration question.

**P4 — Low.** Feature requests, documentation issues, general questions, cosmetic problems.

You set the severity when you open a ticket. Meridian may reclassify, and will tell you why if it does. **Do not file everything as P1** — it does not make anything faster, and on plans with per-severity targets it makes genuine emergencies harder to spot.

## What support can and cannot do

**Can:**

- Diagnose failed runs from Meridian's logs.
- Explain error codes and confirm which side a failure is on.
- Investigate MAR figures and issue credits when a charge was wrong.
- Escalate connector defects to engineering with a tracked issue.
- Advise on sync mode, scheduling, and cost optimization.
- Raise soft limits.

**Cannot:**

- Read back your stored credentials. Nobody can — see [Data Security and Compliance](https://docs.meridiandata.com/data-security-and-compliance).
- Access your row data without your explicit written approval for a specific case.
- Make changes inside your source or destination systems.
- Debug your dbt models, warehouse performance, or downstream tooling.
- Restore data deleted from your destination by someone else.

## Filing a useful ticket

Include these five things and most tickets are resolved in one exchange rather than three:

1. **Workspace ID**, found at **Settings → General**.
2. **Run ID** (`run_2c9f14`) or **request ID** (`req_7d3f9a2b8c1e`).
3. **The error code and full message**, copied rather than paraphrased.
4. **When it last worked**, and what changed around then — a credential rotation, a schema migration, a firewall change, a plan downgrade.
5. **What you already tried.**

Screenshots of the run detail page help. Screenshots of a wall of terminal text do not — paste the text.

## Uptime SLA

Uptime commitments apply to **Scale and Enterprise**. Starter and Growth are provided without an uptime guarantee.

| Plan | Monthly uptime commitment |
| --- | --- |
| Starter | None |
| Growth | None |
| Scale | 99.9% |
| Enterprise | 99.95% |

### What uptime measures

The availability of the Meridian **control plane** — the app, the API, and the sync scheduler. It is measured as the percentage of one-minute intervals in a calendar month during which the service responded successfully to Meridian's synthetic health checks.

Explicitly excluded from the calculation:

- **Scheduled maintenance**, announced at least 72 hours in advance on the status page. Meridian targets under 4 hours of scheduled maintenance per quarter and schedules it during low-traffic windows.
- **Failures caused by your source or destination systems** being unavailable, misconfigured, or rate limiting.
- **Failures caused by your own configuration** — wrong credentials, revoked permissions, firewall changes.
- **Suspension for non-payment.**
- **Force majeure**, including a regional outage at an upstream cloud provider.

A sync that fails because your database was down is not Meridian downtime.

### Service credits

If uptime falls below the commitment in a calendar month:

| Monthly uptime | Credit |
| --- | --- |
| Below 99.9% but at or above 99.5% | 10% of that month's fee |
| Below 99.5% but at or above 99.0% | 25% of that month's fee |
| Below 99.0% | 50% of that month's fee |

Credits are the **sole and exclusive remedy** for missed uptime.

To claim, email support@meridiandata.com within **30 days** of the end of the affected month with your workspace ID and the dates and times of impact. Meridian verifies against its own monitoring and applies approved credits to the next invoice. Credits are account credit, not cash refunds, and do not expire.

Credits are not issued automatically. You must request them.

## Status and incident communication

[status.meridiandata.com](https://status.meridiandata.com) is the single source of truth during an incident. It is hosted separately from Meridian's infrastructure so it stays up when Meridian does not.

Subscribe there for email, SMS, RSS, Slack, or webhook notifications. Subscribe **before** you need it.

You can subscribe to individual components rather than the whole page. If you only sync to one destination, subscribing to that component alone keeps the noise down without missing an incident that affects you.

During an incident Meridian posts an initial acknowledgment within 15 minutes of detection, then updates at least every 30 minutes until resolution. A public post-mortem follows within 5 business days for any P1, covering what happened, the root cause, the customer impact, and the specific changes made to prevent recurrence.

## Enterprise support

Enterprise adds:

- A **named Customer Success Manager** who knows your setup.
- **Quarterly business reviews** covering usage, cost, and roadmap.
- A **dedicated Slack Connect channel** with the support engineers who handle your account.
- **Phone escalation** for P1, 24/7.
- **Onboarding and migration assistance**, including help planning backfills to control the first bill.
- **Early access** to new connectors and features.
- **Influence on the roadmap** — Enterprise requests are reviewed in a monthly prioritization cycle.

## Professional services

Beyond support, available to any plan:

| Engagement | Typical scope | Indicative cost |
| --- | --- | --- |
| Implementation | Initial setup, connector configuration, first syncs | From $5,000 |
| Migration | Moving from another pipeline tool | From $10,000 |
| Architecture review | Cost and reliability audit of an existing setup | $2,500 |
| Custom connector | A source Meridian does not support | From $25,000, 6–8 weeks |
| Training | Team workshop, half or full day | $1,500 / $2,800 |

Contact sales@meridiandata.com for scoping.

## Feature requests

File them at [community.meridiandata.com/ideas](https://community.meridiandata.com/ideas), where you can see what others have requested and add votes and context. This is a genuine input to planning — the top-voted items are reviewed each month.

Filing a P4 ticket for a feature request also works; it gets routed to the same place.

## Deprecation policy

When Meridian retires something, you get notice proportional to the disruption:

| What | Notice |
| --- | --- |
| API major version | 12 months |
| API date version | 6 months |
| A connector | 6 months |
| A feature with a replacement | 3 months |
| A feature with no replacement | 6 months |
| Egress IP address change | 30 days |

Notices go to workspace Owners and Admins by email, are posted on the status page, and appear as an in-app banner. Anything deprecated is documented with a migration path before the notice period starts.
