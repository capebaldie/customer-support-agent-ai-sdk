---
title: Account and Workspace Management
slug: account-and-workspace
category: account
url: https://docs.meridiandata.com/account-and-workspace
updated: 2026-08-05
audience: all
---

# Account and Workspace Management

## Accounts versus workspaces

These are different things and the distinction matters when you are troubleshooting access problems.

- An **account** is a person. It has an email address, a password or SSO identity, and MFA settings. One person has one account.
- A **workspace** is a company or team container. It holds connections, syncs, members, usage, and billing.

One account can belong to many workspaces with a different role in each. Switch between them with the workspace picker in the top-left corner of the app.

Deleting your account does not delete a workspace, and leaving a workspace does not delete your account.

## Roles and permissions

Meridian has six roles. Assign the narrowest one that lets someone do their job.

| Permission | Owner | Admin | Engineer | Analyst | Billing | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| View syncs and run history | Yes | Yes | Yes | Yes | Yes | Yes |
| Trigger a manual sync | Yes | Yes | Yes | Yes | No | No |
| Create and edit syncs | Yes | Yes | Yes | No | No | No |
| Create and edit connections | Yes | Yes | Yes | No | No | No |
| View connection credentials | No | No | No | No | No | No |
| Pause and resume syncs | Yes | Yes | Yes | No | No | No |
| Manage API keys | Yes | Yes | Yes | No | No | No |
| Manage webhooks | Yes | Yes | Yes | No | No | No |
| Invite and remove members | Yes | Yes | No | No | No | No |
| Change member roles | Yes | Yes | No | No | No | No |
| Configure SSO and SCIM | Yes | Yes | No | No | No | No |
| View invoices and usage | Yes | No | No | No | Yes | No |
| Change payment method | Yes | No | No | No | Yes | No |
| Change plan | Yes | No | No | No | Yes | No |
| Transfer ownership | Yes | No | No | No | No | No |
| Delete workspace | Yes | No | No | No | No | No |

Two rules that surprise people:

- **Nobody can read a stored credential, including the Owner.** Once saved, connection passwords and API secrets are write-only. You can replace a credential but never view it. This is a security property, not a missing feature.
- **Admins cannot see billing.** Give an Admin the additional `Billing` role if they need it.

A member can hold more than one role. Permissions are the union of all roles held.

## Inviting members

Go to **Settings → Members → Invite**, enter an email address, and pick roles. The invitee gets an email with a link valid for **7 days**.

- If the address already has a Meridian account, accepting adds the workspace to their existing account.
- If not, they are prompted to create an account first.
- Resend or revoke a pending invite from the same page. Revoking invalidates the link immediately.

Invites count against your plan's seat limit as soon as they are sent, not when accepted. If you are at your limit, revoke a stale invite or add a seat.

### Restricting invites to your domain

At **Settings → Security → Domain restriction**, add one or more verified email domains. When set, invites to any other domain are rejected. Verify a domain by adding the TXT record Meridian shows you to your DNS, then clicking **Verify**. Propagation usually takes a few minutes and Meridian rechecks automatically for 24 hours.

## Removing members

Go to **Settings → Members**, click the member, and choose **Remove from workspace**. Their access ends immediately and any active session is terminated within 60 seconds.

Removing a member does **not** break anything they built. Connections, syncs, webhooks, and API keys are owned by the workspace, not by the person who created them, so they keep running. The one exception is OAuth-based source connections authorized against that person's own account at the source system — for example, a Salesforce connection authorized with their Salesforce login. Those break with `SYNC-101` when their source-side access is revoked. Reauthorize with a service account to avoid this; see [Sources and Connectors](https://docs.meridiandata.com/connectors-sources).

## Transferring ownership

Every workspace has exactly one Owner. To transfer:

1. The current Owner goes to **Settings → Members**.
2. Click the member who should take over. They must already be a workspace member with an accepted invite.
3. Click **Transfer ownership** and confirm with your password (or SSO reauthentication).

The previous Owner is automatically demoted to Admin and keeps all other roles they held. The transfer is immediate and cannot be undone by the previous Owner.

If the only Owner has left the company and cannot be reached, email support@meridiandata.com from an address on the workspace's verified domain. Meridian requires written confirmation from a second Admin on the workspace, and the process takes 2–3 business days.

## Multiple workspaces

Create another workspace from the workspace picker → **New workspace**. Reasons to do this:

- **Separate production from staging**, so a test sync cannot write to the production warehouse.
- **Separate business units** that need isolated access or separate invoices.
- **Agency or consultancy work**, keeping each client's connections apart.

Each workspace has its own plan and its own bill. Two Growth workspaces cost $998/month and their MAR allowances do not pool. If you need a shared allowance across many workspaces, that is an Enterprise arrangement — contact sales.

There is no way to move a sync or connection between workspaces. Recreate it in the target workspace and delete the original.

## Changing your own account settings

At **Account settings** (click your avatar, top right):

- **Name and avatar** — cosmetic, shown in audit logs and member lists.
- **Email address** — changing it sends a confirmation link to the new address. The change applies only after you click that link. If your workspace uses SSO, your email is managed by your identity provider and cannot be changed here.
- **Password** — requires your current password. Changing it signs out all other sessions.
- **MFA** — see [Authentication and SSO](https://docs.meridiandata.com/authentication-and-sso).
- **Active sessions** — lists every signed-in browser with its last-used time, approximate location, and device. Revoke any of them individually, or click **Sign out everywhere**.

## Leaving a workspace

At **Settings → Members**, find yourself and click **Leave workspace**. An Owner cannot leave; transfer ownership first.

## Deleting a workspace

Only the Owner can delete a workspace, from **Settings → General → Delete workspace**. You must type the workspace name to confirm.

Deletion is a **30-day soft delete**:

- All syncs stop immediately.
- All members lose access immediately.
- For 30 days, the Owner can restore the workspace intact by emailing support@meridiandata.com.
- After 30 days, everything Meridian holds is permanently and irreversibly destroyed: connection metadata, encrypted credentials, sync configuration, run history, and logs.

Data already written to your destination warehouse is never touched. That data lives in your infrastructure.

Any outstanding balance is invoiced on deletion. You cannot delete a workspace with an unpaid invoice; settle it first or contact support.

## Deleting your account

At **Account settings → Delete account**. You must first leave or transfer ownership of every workspace where you are the Owner. Account deletion is immediate and cannot be undone. Your name is replaced with "Deleted user" in audit logs, which are retained for compliance.

## Audit log

Growth and above record an audit log of every configuration change: member added, role changed, connection created, credential rotated, sync deleted, plan changed, SSO reconfigured.

View it at **Settings → Audit log**. Each entry has a timestamp, the acting account, the source IP, and a before/after diff where applicable.

Retention matches your plan's log retention: 30 days on Growth, 90 on Scale, 365 on Enterprise. Enterprise workspaces can stream the audit log to an S3 bucket or a SIEM via webhook for indefinite retention.
