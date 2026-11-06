/**
 * Contract check against the website backend, read-only. Set CITIUS_WEBSITE_DIR to a checkout of
 * CitiusHolidays/website to run it; without it the suite is skipped.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { staffFunctionManifest } from "./functions";
import { EXPENSE_CURRENCIES } from "./types";

const websiteDir = process.env.CITIUS_WEBSITE_DIR;
const describeWithWebsite = websiteDir ? describe : describe.skip;

describeWithWebsite("staff API contract with the website backend", () => {
  const convexDir = join(websiteDir ?? "", "convex");
  const generatedApi = websiteDir ? readFileSync(join(convexDir, "_generated/api.d.ts"), "utf8") : "";

  it.each(staffFunctionManifest.map((fn) => [`${fn.module}:${fn.name}`, fn] as const))(
    "%s is a public %s in the generated API",
    (_path, fn) => {
      expect(generatedApi).toContain(`"${fn.module}": typeof`);
      const source = readFileSync(join(convexDir, `${fn.module}.ts`), "utf8");
      const declaration = new RegExp(`export const ${fn.name}\\s*=\\s*${fn.kind}\\(`);
      expect(source).toMatch(declaration);
    }
  );

  it("offers the same expense currencies as the server validator", () => {
    const validators = readFileSync(join(convexDir, "crm/financeValidators.ts"), "utf8");
    const block = validators.match(/expenseCurrencyValidator = v\.union\(([\s\S]*?)\);/);
    const serverCurrencies = [...(block?.[1] ?? "").matchAll(/v\.literal\("([A-Z]{3})"\)/g)].map(
      (match) => match[1]
    );
    expect(serverCurrencies).toEqual([...EXPENSE_CURRENCIES]);
  });
});

describe("staff API manifest", () => {
  it("names each function once", () => {
    const paths = staffFunctionManifest.map((fn) => `${fn.module}:${fn.name}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("covers the field API and lists trips through the tour manager's own assignments", () => {
    const paths = staffFunctionManifest.map((fn) => `${fn.kind} ${fn.module}:${fn.name}`);
    expect(paths).toEqual(
      expect.arrayContaining([
        "query crm/jobCards:listMyAssignedPage",
        "mutation crm/fieldSync:pushHeadcountStop",
        "mutation crm/fieldSync:recordAnnouncement",
        "query crm/fieldPassports:listFieldPassports",
        "action crm/fieldPassportActions:getFieldPassportFile",
      ])
    );
    // The general Job Card list would show a tour manager every trip they can see, not theirs.
    expect(paths).not.toContain("query crm/jobCards:listPage");
  });

  it("records a server permission check for every function", () => {
    for (const fn of staffFunctionManifest) {
      expect(fn.serverCheck.length).toBeGreaterThan(10);
    }
  });
});
