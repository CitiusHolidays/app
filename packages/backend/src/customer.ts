import { define } from "./define";

/**
 * The customer app's whole API surface (`@citius/backend/customer`). It is a separate entry from
 * the staff list on purpose: the customer bundle imports only this file, so no staff function
 * name ships in it. Every read starts from the caller's own Journey Entitlements on the server
 * (website ADR 0020), so a trip id that is not the caller's returns nothing.
 *
 * The shapes below name only the fields the app reads; the app keeps no other field.
 */

export type TripPhase = "upcoming" | "ongoing" | "past";

/** A destination photo: a website path and the BlurHash shown before it loads. */
export interface DestinationPhoto {
  path: string;
  placeholder: string;
}

export interface TripSummary {
  /** The destination's photo, or null when Citius has no sharp enough photo of it yet. */
  cover: DestinationPhoto | null;
  destination: string;
  groupName: string;
  jobCode: string;
  minorCount: number;
  phase: TripPhase;
  role: "organizer" | "traveller";
  travelEndDate: string | null;
  travelStartDate: string | null;
  travellerName: string | null;
  tripId: string;
}

export type ConsentState = "granted" | "withdrawn" | "none";

export interface TripDetail {
  announcements: { authorName: string; body: string; id: string; sharedAt: number }[];
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    reportingInstructions: string | null;
    scope: "trip" | "group";
  }[];
  documents: {
    fullName: string;
    isMinor: boolean;
    passportStatus: string | null;
    ticketStatus: string | null;
    travellerId: string;
    visaRequired: boolean;
    visaStatus: string | null;
  }[];
  me: { fullName: string; groupCode: string | null; travellerId: string } | null;
  minors: { consent: ConsentState; fullName: string; travellerId: string }[];
  plan: { content: string; title: string; updatedAt: number; version: number } | null;
  trip: TripSummary;
  updatedAt: number;
}

export type InvitePreview =
  | { status: "invalid" | "expired" | "used" }
  | { status: "claimed_by_you"; tripId: string }
  | {
      firstName: string;
      minors: { firstName: string; travellerId: string }[];
      status: "valid";
      trip: {
        cover: DestinationPhoto | null;
        destination: string;
        travelEndDate: string | null;
        travelStartDate: string | null;
      } | null;
    };

export interface CustomerProfile {
  email: string;
  name: string;
  phoneNumber: string;
}

export type DeletionEligibility =
  | null
  | { status: "staff_account" }
  | { status: "reauthentication_required" }
  | { reauthenticateBy: number; status: "ready" };

/** The guardian consent wording version the app shows; the server accepts only known versions. */
export const PARENTAL_CONSENT_TEXT_VERSION = "2026-11-07";

/** The header that carries the phone's sign-in secret when the app opens an email link. */
export const SIGN_IN_DEVICE_HEADER = "x-citius-sign-in-device";

/** Error data the server throws (ConvexError) that the app turns into words. */
export const CUSTOMER_ERRORS = {
  alreadyOnTrip: "TRIP_INVITE_ALREADY_ON_TRIP",
  deletionConfirmation: "ACCOUNT_DELETION_CONFIRMATION_REQUIRED",
  deletionReauth: "REAUTHENTICATION_REQUIRED",
  deletionStaff: "STAFF_ACCOUNT_DELETION_REFUSED",
  inviteInvalid: "TRIP_INVITE_INVALID",
  inviteMinor: "TRIP_INVITE_MINOR",
} as const;

/** The word the server expects before it deletes an account. */
export const ACCOUNT_DELETION_CONFIRMATION = "DELETE";

export const customerApi = {
  claimInvite: define<
    "mutation",
    { consent?: { minorTravellerIds: string[]; textVersion: string }; token: string },
    { tripId: string }
  >(
    "mutation",
    "customerApp",
    "claimInvite",
    "signed in; single-use invite token (SHA-256 stored), pending and unexpired; adult Traveller not held by another account; consent only for minors naming the invited Traveller as guardian"
  ),
  deleteMyAccount: define<"mutation", { confirmation: string }, { deletedAt: number; reference: string; status: "deleted" }>(
    "mutation",
    "accountDeletion",
    "deleteMyAccount",
    "signed in; refuses staff logins; confirmation word; session signed in within the last 10 minutes (website ADR 0019)"
  ),
  ensureMyProfile: define<"mutation", Record<string, never>, CustomerProfile>(
    "mutation",
    "userProfiles",
    "ensureMyProfile",
    "signed in; links the canonical identity and creates or returns the caller's own profile"
  ),
  getMyAccountDeletionEligibility: define<"query", { referenceNow: number }, DeletionEligibility>(
    "query",
    "accountDeletion",
    "getMyAccountDeletionEligibility",
    "signed in; the caller's own login and session only"
  ),
  getMyProfile: define<"query", Record<string, never>, CustomerProfile | null>(
    "query",
    "userProfiles",
    "getMyProfile",
    "signed in; the caller's own profile only"
  ),
  getMyTrip: define<"query", { referenceNow: number; tripId: string }, TripDetail | null>(
    "query",
    "customerApp",
    "getMyTrip",
    "the caller's own active entitlement; Job Card app pilot on; own Traveller row and the minors naming it as guardian; status words only, no files or prices"
  ),
  listMyTrips: define<"query", { referenceNow: number }, TripSummary[]>(
    "query",
    "customerApp",
    "listMyTrips",
    "the caller's own active entitlements; only Job Cards whose app pilot is on"
  ),
  previewInvite: define<"query", { referenceNow: number; token: string }, InvitePreview>(
    "query",
    "customerApp",
    "previewInvite",
    "holding the token; first names only; the trip only once its app pilot is on"
  ),
  setParentalConsent: define<
    "mutation",
    { action: "granted" | "withdrawn"; minorTravellerId: string; textVersion: string; tripId: string },
    null
  >(
    "mutation",
    "customerApp",
    "setParentalConsent",
    "the caller's own trip; the minor names the caller's Traveller row as a guardian; append-only record"
  ),
} as const;

export type CustomerApi = typeof customerApi;

/**
 * Functions built in website PRs that may land after this app. The contract test checks them only
 * once the website has them. Empty: account deletion landed with website PR 312. The app still
 * shows the support email if a deployment answers "Could not find public function".
 */
export const CUSTOMER_FUNCTIONS_PENDING_ON_WEBSITE = new Set<keyof CustomerApi>([]);

export const customerFunctionManifest = (Object.keys(customerApi) as (keyof CustomerApi)[]).map((key) => ({
  key,
  kind: customerApi[key].kind,
  module: customerApi[key].module,
  name: customerApi[key].name,
  pendingOnWebsite: CUSTOMER_FUNCTIONS_PENDING_ON_WEBSITE.has(key),
  serverCheck: customerApi[key].serverCheck,
}));
