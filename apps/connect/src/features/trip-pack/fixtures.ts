import type { CommandCenter, JobCardRow, TourManagerRow, TravelBatchRow, TravellerRow } from '@citius/backend';

/** Synthetic data only. Names, phones and codes are invented. */
export const jobCard: JobCardRow = {
  clientName: 'Example Cement Dealers',
  confirmedPax: 4,
  destination: 'Bali',
  id: 'jc_test_1',
  jobCode: 'JC-TEST-001',
  operationsOwnerName: 'Ops Person',
  status: 'On Tour',
  ticketingOwnerName: 'Ticketing Person',
  tourManagerName: 'Test Tour Manager',
  travelBatchCount: 2,
  travelEndDate: '2026-11-10',
  travelStartDate: '2026-11-05',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

export const commandCenter: CommandCenter & Record<string, unknown> = {
  invoices: [{ balanceAmount: 1000, id: 'inv_1' }],
  jobCard,
  proposal: { itinerarySummary: 'Day 1: Arrive Denpasar.\nDay 2: Ubud tour.', proposalCode: 'PR-TEST-1' },
};

export const batches: TravelBatchRow[] = [
  { batchCode: 'B2', batchReference: 'Bus 2', confirmedPax: 2, destination: 'Bali', id: 'tb_2', jobCardId: 'jc_test_1', travelEndDate: '2026-11-10', travelStartDate: '2026-11-05' },
  { batchCode: 'B1', batchReference: 'Bus 1', confirmedPax: 2, destination: 'Bali', id: 'tb_1', jobCardId: 'jc_test_1', travelEndDate: '2026-11-10', travelStartDate: '2026-11-05' },
];

function traveller(overrides: Partial<TravellerRow> & Pick<TravellerRow, 'id' | 'fullName'>): TravellerRow & Record<string, unknown> {
  return {
    callingStatus: 'Pending',
    cancellation: false,
    contactNo: '+91 90000 00000',
    email: 'someone@example.test',
    guestType: 'Client',
    hasPassportScan: true,
    jobCardId: 'jc_test_1',
    lastMinuteDrop: false,
    passportExpiryDate: '2030-01-01',
    passportStatus: 'Received',
    travelBatchCode: 'B1',
    travelBatchId: 'tb_1',
    visaStatus: 'Approved',
    ...overrides,
  };
}

export const travellers = [
  traveller({ fullName: 'Zed Example', id: 't_1' }),
  traveller({ fullName: 'Asha Example', id: 't_2', guestType: 'VIP', callingStatus: 'Done' }),
  traveller({ fullName: 'Bina Example', id: 't_3', travelBatchCode: 'B2', travelBatchId: 'tb_2', contactNo: '(+91) 90000-00001' }),
  traveller({ fullName: 'Chand Example', id: 't_4', travelBatchCode: 'B2', travelBatchId: 'tb_2', cancellation: true }),
];

export const tourManagers: TourManagerRow[] = [
  { id: 'tm_1', jobCardId: 'jc_test_1', name: 'Test Tour Manager', phone: '+91 90000 00009', reportingInstructions: 'Lobby at 07:30', status: 'Assigned', travelBatchId: 'tb_1' },
  { id: 'tm_2', jobCardId: 'jc_test_1', name: 'Former Manager', phone: '+91 90000 00008', reportingInstructions: '', status: 'Released', travelBatchId: null },
];
