/**
 * Customer API contract with the website backend, read-only. Set CITIUS_WEBSITE_DIR to a checkout
 * of CitiusHolidays/website to run it; without it the suite is skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  CUSTOMER_ERRORS,
  CUSTOMER_FUNCTIONS_PENDING_ON_WEBSITE,
  customerFunctionManifest,
  PARENTAL_CONSENT_TEXT_VERSION,
  SIGN_IN_DEVICE_HEADER,
} from "./customer";

const websiteDir = process.env.CITIUS_WEBSITE_DIR;
const describeWithWebsite = websiteDir ? describe : describe.skip;
const convexDir = join(websiteDir ?? "", "convex");

function source(module: string) {
  return readFileSync(join(convexDir, `${module}.ts`), "utf8");
}

describeWithWebsite("customer API contract with the website backend", () => {
  const generatedApi = websiteDir ? readFileSync(join(convexDir, "_generated/api.d.ts"), "utf8") : "";

  it.each(customerFunctionManifest.map((fn) => [`${fn.module}:${fn.name}`, fn] as const))(
    "%s is a public function in the generated API",
    (_path, fn) => {
      if (fn.pendingOnWebsite && !existsSync(join(convexDir, `${fn.module}.ts`))) {
        // Built in a website PR that has not landed; the app shows its fallback until it does.
        return;
      }
      expect(generatedApi).toContain(`${fn.module.includes("/") ? `"${fn.module}"` : fn.module}: typeof`);
      expect(source(fn.module)).toMatch(new RegExp(`export const ${fn.name}\\s*=\\s*${fn.kind}\\(`));
    }
  );

  it("accepts the consent wording version the app shows", () => {
    expect(source("lib/customerTripInvites")).toContain(`"${PARENTAL_CONSENT_TEXT_VERSION}"`);
  });

  it("throws the invite errors the app explains", () => {
    const invites = source("lib/customerTripInvites");
    for (const code of [CUSTOMER_ERRORS.alreadyOnTrip, CUSTOMER_ERRORS.inviteInvalid, CUSTOMER_ERRORS.inviteMinor]) {
      expect(invites).toContain(`"${code}"`);
    }
  });

  it("matches the website's account deletion contract", () => {
    const contract = source("lib/accountDeletionContract");
    expect(contract).toContain(`ACCOUNT_DELETION_CONFIRMATION_PHRASE = "${ACCOUNT_DELETION_CONFIRMATION}"`);
    for (const code of [CUSTOMER_ERRORS.deletionConfirmation, CUSTOMER_ERRORS.deletionReauth, CUSTOMER_ERRORS.deletionStaff]) {
      expect(contract).toContain(`"${code}"`);
    }
  });

  it("binds sign-in links to the phone with the header the website checks", () => {
    expect(source("lib/customerAppSignIn")).toContain(`SIGN_IN_DEVICE_HEADER = "${SIGN_IN_DEVICE_HEADER}"`);
  });

  it("hands sign-in and invite links to the app's own scheme", () => {
    const handoff = readFileSync(join(websiteDir ?? "", "src/components/customerApp/appHandoff.ts"), "utf8");
    expect(handoff).toContain('CUSTOMER_APP_SCHEME = "citius"');
    expect(readFileSync(join(convexDir, "lib/nativeAppOrigins.ts"), "utf8")).toContain('"citius://"');
  });
});

describe("customer API manifest", () => {
  it("names each function once and records a server check for each", () => {
    const paths = customerFunctionManifest.map((fn) => `${fn.module}:${fn.name}`);
    expect(new Set(paths).size).toBe(paths.length);
    for (const fn of customerFunctionManifest) {
      expect(fn.serverCheck.length).toBeGreaterThan(10);
    }
  });

  it("calls no staff (crm) function", () => {
    for (const fn of customerFunctionManifest) {
      expect(fn.module.startsWith("crm/")).toBe(false);
    }
  });

  it("waits on no website function", () => {
    expect([...CUSTOMER_FUNCTIONS_PENDING_ON_WEBSITE]).toEqual([]);
  });

  it("keeps the staff list out of the customer entry", () => {
    const entry = readFileSync(join(__dirname, "customer.ts"), "utf8");
    expect(entry).not.toMatch(/from "\.\/functions"|from "\.\/index"|from "\."/);
  });
});
