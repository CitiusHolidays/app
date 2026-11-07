import { scheduleSteps, tripDays, tripSchedule } from './schedule';

const at = (year: number, month: number, day: number, hour = 10) => new Date(year, month - 1, day, hour).getTime();

describe('schedule steps', () => {
  it('turns "Day N" lines into dated steps and marks them done, today and upcoming', () => {
    const steps = scheduleSteps('Day 1: Arrive Denpasar.\nDay 2: Ubud tour.\nDay 3 - Free day', '2026-11-05', at(2026, 11, 6));
    expect(steps.map((step) => [step.dayLabel, step.text, step.state])).toEqual([
      ['Day 1', 'Arrive Denpasar.', 'done'],
      ['Day 2', 'Ubud tour.', 'current'],
      ['Day 3', 'Free day', 'upcoming'],
    ]);
    expect(steps[1]?.date).toBe(new Date(2026, 10, 6).getTime());
  });

  it('keeps lines under a day with that day, and splits days written on one line', () => {
    const steps = scheduleSteps('Day 1: Arrive. Day 2: Temple visit.\n- Lunch at the beach\n\nDay 3: Fly home', '2026-11-05', at(2026, 11, 1));
    expect(steps.map((step) => step.text)).toEqual(['Arrive.', 'Temple visit.\nLunch at the beach', 'Fly home']);
    expect(steps.every((step) => step.state === 'upcoming')).toBe(true);
  });

  it('leaves steps undated when the trip has no start date, and keeps free text as written', () => {
    expect(scheduleSteps('Day 1: Arrive', '', at(2026, 11, 6))[0]).toMatchObject({ date: null, state: 'undated' });
    expect(scheduleSteps('Airport pickup\nCity tour', '2026-11-05', at(2026, 11, 6))).toEqual([
      { date: null, dayLabel: null, key: 'line-0', state: 'undated', text: 'Airport pickup' },
      { date: null, dayLabel: null, key: 'line-1', state: 'undated', text: 'City tour' },
    ]);
    expect(scheduleSteps('   \n ', '2026-11-05', at(2026, 11, 6))).toEqual([]);
  });

  it('does not split on a day mentioned mid-sentence', () => {
    expect(scheduleSteps('Day 1: Arrive. Return flight on Day 3.', '2026-11-05', at(2026, 11, 6))).toHaveLength(1);
  });
});

describe('tripSchedule', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();

  it('falls back to one step per travel day when the itinerary has no days', () => {
    const { steps, summary } = tripSchedule('7-day Bali programme', '2026-11-04', '2026-11-06', at(2026, 11, 5));
    expect(summary).toBe('7-day Bali programme');
    expect(steps.map((step) => [step.dayLabel, step.state, step.text])).toEqual([
      ['Day 1', 'done', ''],
      ['Day 2', 'current', ''],
      ['Day 3', 'upcoming', ''],
    ]);
  });

  it('keeps the itinerary days when there are some', () => {
    const { steps, summary } = tripSchedule('Day 1: Arrive\nDay 2: Tour', '2026-11-04', '2026-11-10', at(2026, 11, 5));
    expect(summary).toBeNull();
    expect(steps).toHaveLength(2);
  });

  it('gives nothing extra without usable dates', () => {
    expect(tripSchedule('Programme', '', '', at(2026, 11, 5)).steps).toHaveLength(1);
    expect(tripDays('2026-11-10', '2026-11-04', at(2026, 11, 5))).toEqual([]);
  });
});
