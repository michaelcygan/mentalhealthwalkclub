/**
 * Age gate + safety realm constants.
 *
 * Youth realm is reserved in the schema but is not activated in this launch.
 * Do not create youth accounts, waitlists, or guardian flows.
 */
export const YOUTH_REALM_ENABLED = false;

export const TERMS_VERSION = "v2026-07-26-18plus";
export const PRIVACY_VERSION = "v2026-07-26-18plus";

export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 120;

export type EligibilityStatus =
  | "pending_age"
  | "adult_active"
  | "underage_blocked"
  | "age_review"
  | "safety_suspended";

export type SafetyRealm = "unknown" | "adult" | "future_youth" | "blocked";

export interface Eligibility {
  eligibilityStatus: EligibilityStatus;
  safetyRealm: SafetyRealm;
  ageBand: string | null;
}

/** Client-side sanity check only. Server is authoritative. */
export function isPlausibleAdultDob(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(dob + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (d > now) return false;
  const eighteen = new Date(now.getFullYear() - MIN_AGE_YEARS, now.getMonth(), now.getDate());
  if (d > eighteen) return false;
  const oldest = new Date(now.getFullYear() - MAX_AGE_YEARS, now.getMonth(), now.getDate());
  if (d < oldest) return false;
  return true;
}
