/**
 * Hand-written shapes for the fields Citius Connect reads. The server returns more fields than
 * these; the app maps each response to its own model before caching anything, so a field that
 * is not named here never reaches the device store.
 */

export interface PaginationOpts {
  cursor: string | null;
  numItems: number;
}

export interface PaginationResult<Row> {
  continueCursor: string;
  isDone: boolean;
  page: Row[];
}

export interface IdResult {
  id: string;
}

export interface PortalAccess {
  allowed: boolean;
  email: string;
  name: string;
  permissions: string[];
  reason?: "UNAUTHENTICATED" | "NOT_STAFF";
  roles: string[];
  staffId?: string;
}

export interface JobCardRow {
  clientName: string;
  confirmedPax: number;
  destination: string;
  id: string;
  jobCode: string;
  operationsOwnerName: string;
  status: string;
  ticketingOwnerName: string;
  tourManagerName: string;
  travelBatchCount: number;
  travelEndDate: string;
  travelStartDate: string;
  updatedAt: string;
}

export interface CommandCenter {
  jobCard: JobCardRow;
  proposal: {
    itinerarySummary: string;
    proposalCode: string;
  } | null;
}

export interface TravelBatchRow {
  batchCode: string;
  batchReference: string;
  confirmedPax: number;
  destination: string;
  id: string;
  jobCardId: string;
  travelEndDate: string;
  travelStartDate: string;
}

export interface TravellerRow {
  callingStatus: string;
  cancellation: boolean;
  contactNo: string;
  fullName: string;
  guestType: string;
  id: string;
  jobCardId: string;
  lastMinuteDrop: boolean;
  passportStatus: string;
  travelBatchCode: string;
  travelBatchId: string;
  visaStatus: string;
}

export interface TourManagerRow {
  id: string;
  jobCardId: string | null;
  name: string;
  phone: string;
  reportingInstructions: string;
  status: string;
  travelBatchId: string | null;
}

export interface ExpenseRow {
  amount: number;
  approvalStatus: string;
  category: string;
  createdAt: string;
  currency: string;
  expenseDate: string;
  id: string;
  jobCardId: string | null;
  jobCode: string;
  managerReviewStatus: string;
  notes: string;
  particulars: string;
  proofAttachment: unknown;
  submittedForApprovalAt: string | null;
}

export interface CreateExpenseArgs {
  [key: string]: unknown;
  amount: number;
  category: string;
  currency: ExpenseCurrency;
  expenseDate: string;
  jobCardId: string;
  notes?: string;
  paidBy: string;
  particulars?: string;
}

export interface NotificationRow {
  body: string;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  readAt: string | null;
  title: string;
}

/** Same lists as the website's portal constants; the contract test checks the currencies. */
export const EXPENSE_CURRENCIES = ["INR", "USD", "AED", "EUR", "THB", "SGD"] as const;
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];

export const EXPENSE_CATEGORIES = [
  "F&B",
  "Transport",
  "Hotel",
  "Activity",
  "Visa",
  "Tips",
  "Miscellaneous",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CALLING_STATUSES = ["Pending", "Done", "No response"] as const;

export const TOUR_MANAGER_ROLE = "Tour Manager";
