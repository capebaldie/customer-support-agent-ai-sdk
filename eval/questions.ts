// Hand-written retrieval eval set. Phrased the way users type, not the way the docs are titled.
//
// A hit is a result with this docSlug, and — when expectedHeading is set — a headingPath containing
// it. The heading is there for near-miss pairs that live in the same doc (SYNC-101 vs SYNC-201):
// slug-level matching would pass either one for both.
//
// expectedSlug: null marks a question the docs do not answer. It is left out of recall and MRR and
// only feeds the score distribution, for picking MIN_SIMILARITY in app/api/chat/route.ts.
export type EvalQuestion = {
  question: string;
  expectedSlug: string | null;
  expectedHeading?: string;
};

export const questions: EvalQuestion[] = [
  // near-miss: same "authentication failed", opposite sides of the pipe
  { question: "why did my sync fail with 401", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-101" },
  { question: "SYNC-101 postgres password rotated", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-101" },
  { question: "snowflake login failing sync error destination auth", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-201" },
  { question: "SYNC-201 bigquery service account key deleted", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-201" },
  // near-miss: both rate limits, our API vs the customer's source
  { question: "api returns 429 too many requests how long do i wait", expectedSlug: "api-error-codes", expectedHeading: "rate_limit_exceeded" },
  { question: "salesforce api quota hit sync keeps getting throttled", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-103" },

  { question: "meridian 409 schema locked", expectedSlug: "api-error-codes", expectedHeading: "schema_locked" },
  { question: "api key expired error", expectedSlug: "api-error-codes", expectedHeading: "expired_api_key" },
  { question: "replication slot missing postgres cdc", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-104" },
  { question: "hit my MAR limit syncs stopped", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "SYNC-401" },
  { question: "duplicate rows showing up in warehouse", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "Duplicate rows" },
  { question: "sync says success but some rows are missing", expectedSlug: "troubleshooting-sync-failures", expectedHeading: "data is missing" },

  { question: "what counts as a monthly active row", expectedSlug: "plans-and-pricing" },
  { question: "how much do you charge if we go over our rows", expectedSlug: "plans-and-pricing", expectedHeading: "Overage" },
  { question: "is there a free trial", expectedSlug: "plans-and-pricing", expectedHeading: "Free trial" },
  { question: "discount for nonprofits?", expectedSlug: "plans-and-pricing" },
  { question: "card declined what happens to my account", expectedSlug: "billing-and-invoices", expectedHeading: "Failed payments" },
  { question: "can I get a refund", expectedSlug: "billing-and-invoices", expectedHeading: "Refunds" },

  { question: "how do i set up okta saml", expectedSlug: "authentication-and-sso", expectedHeading: "SAML" },
  { question: "lost my phone cant do 2fa", expectedSlug: "authentication-and-sso", expectedHeading: "Locked out of MFA" },
  { question: "make someone else the workspace owner", expectedSlug: "account-and-workspace", expectedHeading: "Transferring ownership" },
  { question: "only allow people with our company email to join", expectedSlug: "account-and-workspace", expectedHeading: "Restricting invites" },

  { question: "connect database behind firewall ssh tunnel", expectedSlug: "connectors-sources", expectedHeading: "Reaching a private database" },
  { question: "postgres read only user permissions for meridian", expectedSlug: "connectors-sources" },
  { question: "snowflake key pair auth setup", expectedSlug: "destinations", expectedHeading: "Key-pair" },
  { question: "rows deleted in source still in destination", expectedSlug: "destinations", expectedHeading: "soft" },

  { question: "incremental vs cdc which should i pick", expectedSlug: "sync-scheduling-and-modes", expectedHeading: "Choosing a mode" },
  { question: "run sync every day at 2am cron", expectedSlug: "sync-scheduling-and-modes", expectedHeading: "Cron" },
  { question: "verify webhook signature node", expectedSlug: "webhooks", expectedHeading: "Verifying signatures" },
  { question: "webhook retries how many times", expectedSlug: "webhooks", expectedHeading: "Delivery" },
  { question: "max columns per table", expectedSlug: "limits-and-quotas", expectedHeading: "Data shape" },
  { question: "are you soc 2 certified", expectedSlug: "data-security-and-compliance", expectedHeading: "Certifications" },
  { question: "can we keep data in the EU", expectedSlug: "data-security-and-compliance", expectedHeading: "residency" },
  { question: "what's your uptime guarantee", expectedSlug: "support-and-sla", expectedHeading: "Uptime SLA" },

  // not covered by the docs — should score below the escalation threshold
  { question: "what's the capital of France", expectedSlug: null },
  { question: "is there a meridian mobile app for iphone", expectedSlug: null },
  { question: "do you sync to google sheets", expectedSlug: null },
  { question: "who is the CEO of meridian", expectedSlug: null },
  { question: "write me a python script to scrape amazon", expectedSlug: null },
];
