---
title: Authentication, MFA, and SSO
slug: authentication-and-sso
category: security
url: /docs/authentication-and-sso
updated: 2026-06-19
audience: admin
---

# Authentication, MFA, and SSO

## Sign-in methods

Meridian supports four ways to sign in:

| Method | Available on | Notes |
| --- | --- | --- |
| Email and password | All plans | Default |
| Google Workspace | All plans | One click, no configuration |
| Microsoft Entra ID (OAuth) | All plans | One click, no configuration |
| SAML 2.0 SSO | Scale, Enterprise | Requires configuration by an Admin |

Google and Microsoft sign-in are social login shortcuts, not SSO. They do not give you enforcement, provisioning, or centralized deprovisioning. If you need those, configure SAML.

## Passwords

Meridian requires passwords to be at least 12 characters. Meridian also checks every new password against the Have I Been Pwned breach corpus using k-anonymity — your password is never sent to that service, only a partial hash prefix. Passwords found in a known breach are rejected regardless of complexity.

Meridian does **not** force periodic password rotation. Forced rotation is no longer recommended by NIST and reliably produces weaker passwords.

### Resetting a forgotten password

Click **Forgot password** on the sign-in page. The reset link is valid for **1 hour** and can be used once.

If the email does not arrive:

1. Check spam. The sender is `no-reply@meridiandata.com`.
2. Confirm you are using the exact address on the account. Meridian does not reveal whether an address exists, so the confirmation screen looks identical either way.
3. If your workspace enforces SSO, password reset is disabled and the email is never sent. Sign in through your identity provider instead.
4. Ask your IT team to allowlist `meridiandata.com` if your mail gateway is aggressive.

Resetting a password signs out every active session on the account.

## Multi-factor authentication

### Enrolling

Go to **Account settings → Security → Enable MFA**. Meridian supports:

- **Authenticator apps (TOTP)** — 1Password, Authy, Google Authenticator, or any RFC 6238 app. Scan the QR code and enter a code to confirm.
- **Hardware security keys (WebAuthn / FIDO2)** — YubiKey and similar. Register up to 5 keys.
- **Passkeys** — platform authenticators such as Touch ID, Windows Hello, or a phone. Registered the same way as security keys.

**SMS is not supported.** SIM-swap attacks make it unsuitable for an account with production data access.

### Recovery codes

Enrolling generates **10 single-use recovery codes**. Save them somewhere you can reach without your phone. Each code works once. Regenerate the set at any time from **Account settings → Security → Recovery codes**; regenerating invalidates all previous codes immediately.

### Locked out of MFA

If you have lost both your device and your recovery codes:

- **If your workspace has another Admin or Owner**, ask them to reset your MFA at **Settings → Members → [you] → Reset MFA**. This clears your MFA enrollment so you can enroll again on next sign-in. This is the fastest route and takes seconds.
- **If nobody else can help**, email support@meridiandata.com from the address on the account. Meridian requires identity verification and the process takes **2–3 business days**. Meridian cannot shorten this; it exists so that an attacker with mailbox access alone cannot take over an account.

### Requiring MFA for everyone

Owners and Admins can enforce MFA workspace-wide at **Settings → Security → Require MFA**.

When enabled, members without MFA are prompted to enroll at their next sign-in and cannot reach anything else until they do. Existing sessions are not terminated. Members who have not enrolled after 7 days are blocked from signing in until they enroll or an Admin exempts them.

## SAML 2.0 single sign-on

SAML SSO is available on **Scale and Enterprise**. It has been tested against Okta, Microsoft Entra ID, OneLogin, JumpCloud, Google Workspace, and Ping Identity, and it works with any spec-compliant IdP.

### Configuring SSO

1. Go to **Settings → Security → SAML SSO → Configure**.
2. Copy Meridian's service provider values into your IdP:

   | Field | Value |
   | --- | --- |
   | ACS URL / Reply URL | `https://app.meridiandata.com/auth/saml/callback` |
   | Entity ID / Audience URI | `https://app.meridiandata.com/saml/metadata` |
   | Name ID format | `EmailAddress` |
   | Signature algorithm | RSA-SHA256 |

3. Configure these attribute statements in your IdP:

   | Attribute | Required | Purpose |
   | --- | --- | --- |
   | `email` | Yes | Must match the Name ID |
   | `firstName` | No | Display name |
   | `lastName` | No | Display name |
   | `meridianRole` | No | Role assignment on JIT provisioning |

4. Paste your IdP's metadata XML — or its SSO URL, Entity ID, and X.509 certificate — back into Meridian.
5. Verify your email domain if you have not already. SSO cannot be enabled without a verified domain.
6. Click **Test connection**. Meridian runs a full round trip and reports exactly which assertion failed if it does not work. **Do not skip this step.**
7. Click **Enable**.

### Just-in-time provisioning

With JIT enabled, a user who authenticates through your IdP and has no Meridian account gets one created automatically on first sign-in.

New users receive the role in the `meridianRole` attribute if present, otherwise the default role set at **Settings → Security → SAML SSO → Default role**. The default is `Viewer`, which is the right choice — widen it deliberately per person rather than by accident for everyone.

JIT provisioning creates users but never removes them. Use SCIM for deprovisioning.

### Enforcing SSO

Turn on **Settings → Security → Enforce SSO** to disable password and social sign-in for everyone on your verified domains.

Before you enable it, understand what changes:

- Password sign-in stops working for all members on verified domains.
- Password reset emails are no longer sent.
- Existing sessions stay valid until they expire. To cut them immediately, click **Sign out all members**.
- Meridian preserves one **break-glass path**: the workspace Owner can always sign in with a password at `https://app.meridiandata.com/login?sso=bypass`. Keep the Owner's password and MFA somewhere your team can reach in an emergency. Without this, a misconfigured IdP would lock you out of your own workspace permanently.
- **API keys are unaffected.** They are workspace credentials, not user credentials, and continue working regardless of SSO settings.

### SCIM provisioning

SCIM 2.0 is **Enterprise only** and automates both provisioning and deprovisioning.

Enable at **Settings → Security → SCIM**, then copy the base URL and bearer token into your IdP:

```
Base URL: https://api.meridiandata.com/scim/v2
Token:    generated once, shown once, rotate at any time
```

Supported operations: create user, update user, deactivate user, list users, create group, update group membership, delete group.

Map IdP groups to Meridian roles at **Settings → Security → SCIM → Group mapping**. A user's role is the union of the roles from every mapped group they belong to.

When a user is deactivated in your IdP, SCIM removes them from the workspace and terminates their sessions within 60 seconds.

### Common SAML problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| "SAML assertion is invalid" | Clock skew between IdP and Meridian over 3 minutes | Fix NTP on the IdP |
| "Email not found in assertion" | `email` attribute not mapped, or Name ID is not an email | Set Name ID format to `EmailAddress` and map `email` |
| "Certificate validation failed" | IdP signing certificate rotated | Paste the new certificate into Meridian |
| Redirect loop at sign-in | Enforce SSO on with a broken IdP config | Use the Owner break-glass URL, then disable enforcement and retest |
| User signs in but has no access | JIT off and no matching account | Enable JIT or invite the user manually |

Certificate expiry is the most common cause of a sudden total SSO outage. Meridian emails all Admins **30, 14, and 3 days** before a configured IdP certificate expires.

## Session policy

| Setting | Default | Configurable range | Plans |
| --- | --- | --- | --- |
| Session lifetime | 30 days | 1 hour to 90 days | Scale, Enterprise |
| Idle timeout | None | 15 minutes to 30 days | Scale, Enterprise |
| Concurrent sessions per user | Unlimited | 1 to unlimited | Enterprise |

Configure at **Settings → Security → Session policy**. Shortening a lifetime applies to new sessions; use **Sign out all members** to apply it retroactively.

## API keys

API keys authenticate to the REST API and are independent of user sign-in. Full details are in the [API Reference](/docs/api-reference). The short version:

- Keys belong to the workspace, not the person who made them, and survive that person leaving.
- The secret is shown **once**, at creation. Meridian stores only a hash. If you lose it, rotate the key.
- Scope every key to the minimum permissions it needs. A key used for monitoring should be read-only.
- Set an expiry date on creation. Meridian emails Admins 14 days before a key expires.
- Rotate at **Settings → API keys → Rotate**. Rotation issues a new secret and keeps the old one valid for a grace period you choose, up to 7 days, so you can deploy without downtime.
