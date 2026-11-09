/**
 * The proposal's itinerary text as timeline steps. The text is free-form ("Day 1: Arrive
 * Denpasar.\nDay 2: Ubud tour."), so this only recognises "Day N" openings; anything else is
 * kept word for word.
 */

type StepState = 'done' | 'current' | 'upcoming' | 'undated';

export interface ScheduleStep {
  /** "Day 2", or null for a line without a day. */
  dayLabel: string | null;
  /** Local midnight of the step's day, when the trip has a start date. */
  date: number | null;
  key: string;
  state: StepState;
  text: string;
}

const DAY_OPENING = /^day\s*(\d{1,3})\s*[:.\-–—)]?\s*(.*)$/i;
const BULLET = /^[-•*·]\s*/;
/** A "Day N:" that starts a new sentence in the middle of a line. */
const INLINE_DAY = /([.;!?])\s+(?=day\s*\d{1,3}\s*[:\-–—)])/gi;

function dayStart(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function todayStart(now: number) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function scheduleSteps(itineraryText: string, travelStartDate: string, now: number): ScheduleStep[] {
  const lines = itineraryText
    .replace(/\r\n?/g, '\n')
    .replace(INLINE_DAY, '$1\n')
    .split('\n')
    .map((line) => line.trim().replace(BULLET, ''))
    .filter(Boolean);
  const start = dayStart(travelStartDate);
  const today = todayStart(now);
  const steps: ScheduleStep[] = [];
  const hasDays = lines.some((line) => DAY_OPENING.test(line));
  for (const line of lines) {
    const match = DAY_OPENING.exec(line);
    if (match) {
      const day = Number(match[1]);
      let date: number | null = null;
      if (start && day >= 1) {
        const value = new Date(start);
        value.setDate(value.getDate() + day - 1);
        date = value.getTime();
      }
      const state: StepState = date === null ? 'undated' : date < today ? 'done' : date === today ? 'current' : 'upcoming';
      steps.push({ date, dayLabel: `Day ${day}`, key: `day-${day}-${steps.length}`, state, text: match[2]?.trim() ?? '' });
      continue;
    }
    const previous = steps.at(-1);
    if (hasDays && previous) {
      // A line under a day belongs to that day.
      previous.text = previous.text ? `${previous.text}\n${line}` : line;
      continue;
    }
    steps.push({ date: null, dayLabel: null, key: `line-${steps.length}`, state: 'undated', text: line });
  }
  return steps;
}

const MAX_TRIP_DAYS = 60;

/**
 * One step per trip day from the travel dates alone, for a programme that has no day-by-day text
 * yet. Days carry no invented content: the text is empty and the screen shows the date.
 */
export function tripDays(travelStartDate: string, travelEndDate: string, now: number): ScheduleStep[] {
  const start = dayStart(travelStartDate);
  const end = dayStart(travelEndDate);
  if (!start || !end || end < start) return [];
  const today = todayStart(now);
  const steps: ScheduleStep[] = [];
  for (let day = 1; day <= MAX_TRIP_DAYS; day += 1) {
    const value = new Date(start);
    value.setDate(value.getDate() + day - 1);
    if (value > end) break;
    const date = value.getTime();
    const state: StepState = date < today ? 'done' : date === today ? 'current' : 'upcoming';
    steps.push({ date, dayLabel: `Day ${day}`, key: `trip-day-${day}`, state, text: '' });
  }
  return steps;
}

/** Day steps from the itinerary when it has them, otherwise from the travel dates. */
export function tripSchedule(itineraryText: string, travelStartDate: string, travelEndDate: string, now: number) {
  const steps = scheduleSteps(itineraryText, travelStartDate, now);
  if (steps.some((step) => step.dayLabel)) return { steps, summary: null };
  const days = tripDays(travelStartDate, travelEndDate, now);
  if (days.length === 0) return { steps, summary: null };
  return { steps: days, summary: itineraryText.trim() || null };
}
