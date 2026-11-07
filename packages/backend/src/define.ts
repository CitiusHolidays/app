import { anyApi, type DefaultFunctionArgs, type FunctionReference } from "convex/server";

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
  // anyApi is a proxy: each property access extends the function path.
  let node: Record<string, unknown> = anyApi as unknown as Record<string, unknown>;
  for (const part of [...module.split("/"), name]) {
    node = node[part] as Record<string, unknown>;
  }
  return {
    kind,
    module,
    name,
    ref: node as unknown as FunctionReference<Kind, "public", Args, Result>,
    serverCheck,
  };
}
