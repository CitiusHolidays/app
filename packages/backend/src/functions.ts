import { anyApi, type DefaultFunctionArgs, type FunctionReference } from "convex/server";

import type {
  CommandCenter,
  CreateExpenseArgs,
  ExpenseRow,
  IdResult,
  JobCardRow,
  NotificationRow,
  PaginationOpts,
  PaginationResult,
  PortalAccess,
  TourManagerRow,
  TravelBatchRow,
  TravellerRow,
} from "./types";

export type FunctionKind = "query" | "mutation" | "action";

/**
 * One Convex function the staff app calls. `module` and `name` are the path in the website's
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

function define<Kind extends FunctionKind, Args extends DefaultFunctionArgs, Result>(
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

type EmptyArgs = Record<string, never>;

/** The whole staff API surface Citius Connect uses. Nothing else is called. */
export const staffApi = {
  attachExpenseProof: define<
    "action",
    { expenseId: string; fileName: string; fileSize: number; mimeType: string; storageId: string },
    { success: boolean }
  >(
    "action",
    "crm/expenseAttachmentActions",
    "attachProof",
    "create:expenses, manage:expenses or manageAll:expenses; expense mutate scope; MIME and 15 MB size checked against the stored blob"
  ),
  createExpense: define<"mutation", CreateExpenseArgs, IdResult>(
    "mutation",
    "crm/finance",
    "createExpense",
    "create:expenses; a Job Card must be visible to the caller (getVisibleJob)"
  ),
  generateExpenseUploadUrl: define<"action", { expenseId: string }, string>(
    "action",
    "crm/expenseAttachmentActions",
    "generateUploadUrl",
    "create:expenses, manage:expenses or manageAll:expenses; expense mutate scope"
  ),
  getExpenseRow: define<"query", { expenseId: string }, ExpenseRow | null>(
    "query",
    "crm/finance",
    "getExpenseListRow",
    "view:expenses; the row is hidden unless its Job Card is visible or the caller created or approves it"
  ),
  getJobCardCommandCenter: define<"query", { jobCardId: string }, CommandCenter>(
    "query",
    "crm/jobCards",
    "getCommandCenter",
    "view:jobCards; canSeeJobCardRecord (Tour Manager: assigned staff id or legacy name match)"
  ),
  getJobCardDetail: define<"query", { jobCardId: string }, JobCardRow | null>(
    "query",
    "crm/jobCards",
    "getDetail",
    "view:jobCards; canSeeJobCardRecord, null when not visible"
  ),
  getMyPortalAccess: define<"query", EmptyArgs, PortalAccess>(
    "query",
    "crm/staff",
    "getMyPortalAccess",
    "none; resolves the signed-in identity to one active staff record or returns allowed: false"
  ),
  listExpenses: define<
    "query",
    { jobCardId?: string; paginationOpts: PaginationOpts },
    PaginationResult<ExpenseRow>
  >(
    "query",
    "crm/finance",
    "listExpenses",
    "view:expenses; each row filtered by Job Card visibility or creator/approver"
  ),
  listJobCards: define<
    "query",
    { paginationOpts: PaginationOpts; status?: string },
    PaginationResult<JobCardRow>
  >(
    "query",
    "crm/jobCards",
    "listPage",
    "view:jobCards; each row filtered by canSeeJobCardRecord after pagination"
  ),
  listNotifications: define<"query", { limit?: number }, NotificationRow[]>(
    "query",
    "crm/activity",
    "listNotifications",
    "requireStaff (any active staff); only notifications addressed to the caller"
  ),
  listTourManagers: define<
    "query",
    { jobCardId?: string; paginationOpts: PaginationOpts },
    PaginationResult<TourManagerRow>
  >(
    "query",
    "crm/ops",
    "listTourManagers",
    "view:tourManagers; rows on Job Cards the caller cannot see are dropped"
  ),
  listTravelBatches: define<
    "query",
    { jobCardId: string; paginationOpts: PaginationOpts },
    PaginationResult<TravelBatchRow>
  >(
    "query",
    "crm/jobCards",
    "listTravelBatches",
    "view:jobCards; canSeeJobCardRecord on the parent Job Card"
  ),
  listTravellers: define<
    "query",
    { jobCardId: string; paginationOpts: PaginationOpts },
    PaginationResult<TravellerRow>
  >(
    "query",
    "crm/travellers",
    "listPage",
    "view:travellers; each row filtered by canSeeJobCardRecord on its Job Card"
  ),
  submitExpense: define<"mutation", { expenseId: string }, IdResult>(
    "mutation",
    "crm/finance",
    "submitExpenseForApproval",
    "create:expenses, manage:expenses or manageAll:expenses; expense mutate scope; blocked when no reporting manager is set"
  ),
} as const;

export type StaffApi = typeof staffApi;
export type StaffFunctionName = keyof StaffApi;

/** Plain manifest for the contract test and the report. */
export const staffFunctionManifest = (
  Object.entries(staffApi) as [StaffFunctionName, StaffApi[StaffFunctionName]][]
).map(([key, spec]) => ({
  key,
  kind: spec.kind,
  module: spec.module,
  name: spec.name,
  serverCheck: spec.serverCheck,
}));
