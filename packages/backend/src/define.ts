import { type DefaultFunctionArgs, type FunctionReference, makeFunctionReference } from "convex/server";

export type FunctionKind = "query" | "mutation" | "action";

/**
 * One Convex function an app calls. `module` and `name` are the path in the website's
 * `convex/` folder (`crm/staff` + `getMyPortalAccess` = `api.crm.staff.getMyPortalAccess`).
 * `serverCheck` records the permission the server enforces, so reviewers can see what protects
 * each call without opening the website repo.
 */
export interface FunctionSpec<Kind extends FunctionKind, Args extends DefaultFunctionArgs, Result> {
  kind: Kind;
  module: string;
  name: string;
  ref: FunctionReference<Kind, "public", Args, Result>;
  serverCheck: string;
}

export function define<Kind extends FunctionKind, Args extends DefaultFunctionArgs, Result>(
  kind: Kind,
  module: string,
  name: string,
  serverCheck: string
): FunctionSpec<Kind, Args, Result> {
  return {
    kind,
    module,
    name,
    // The same reference `api.crm.staff.getMyPortalAccess` gives: Convex names it "module:name".
    ref: makeFunctionReference<Kind, Args, Result>(`${module}:${name}`),
    serverCheck,
  };
}
