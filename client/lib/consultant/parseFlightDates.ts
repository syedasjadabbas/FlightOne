/**
 * Parse calendar dates from natural-language flight requests.
 * Exact dates resolve to YYYY-MM-DD. Vague phrases (mid-September) return a range
 * without inventing a single search date — callers must clarify or ask to search around it.
 */
import { daysFromToday } from "@/lib/inventory/places";

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_PATTERN =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/** Optional "of" between day and month: "11th of Sept", "10 of September". */
const OF = "(?:\\s+of)?";

export type VagueDateBand = {
  label: string;
  rangeStart: string;
  rangeEnd: string;
};

export type ParsedFlightDates = {
  /** Exact departure when known. Absent when only a vague band was found. */
  departureDate?: string;
  returnDate?: string;
  /** True when month/day were explicit but year was inferred from today. */
  yearInferred?: boolean;
  /** Vague month band — never silently pick one day for search. */
  vague?: VagueDateBand;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return null;
  }
  return iso;
}

function inferYear(month: number, day: number, todayIso: string): number {
  const [y, m, d] = todayIso.split("-").map(Number);
  const todayUtc = Date.UTC(y, (m || 1) - 1, d || 1);
  const candidateUtc = Date.UTC(y, month - 1, day);
  return candidateUtc < todayUtc ? y + 1 : y;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseNamedDate(
  monthRaw: string,
  dayRaw: string,
  yearRaw: string | undefined,
  todayIso: string,
): { iso: string; yearInferred: boolean } | null {
  const month = MONTH_NAMES[monthRaw.toLowerCase()];
  if (!month) return null;
  const day = Number(dayRaw);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (yearRaw) {
    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
    const iso = toIsoDate(year, month, day);
    return iso ? { iso, yearInferred: false } : null;
  }
  const year = inferYear(month, day, todayIso);
  const iso = toIsoDate(year, month, day);
  return iso ? { iso, yearInferred: true } : null;
}

function addDaysIsoLocal(iso: string, days: number): string {
  const t = Date.parse(`${iso}T12:00:00Z`);
  const d = new Date(t + days * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function weekdayUtc(iso: string): number {
  return new Date(Date.parse(`${iso}T12:00:00Z`)).getUTCDay();
}

/** Midpoint of a vague band — only when the user opts into "search around". */
export function midpointOfVagueBand(band: VagueDateBand): string {
  const a = Date.parse(`${band.rangeStart}T12:00:00Z`);
  const b = Date.parse(`${band.rangeEnd}T12:00:00Z`);
  const mid = new Date((a + b) / 2);
  return `${mid.getUTCFullYear()}-${pad2(mid.getUTCMonth() + 1)}-${pad2(mid.getUTCDate())}`;
}

function capitalizeMonth(raw: string): string {
  const key = raw.toLowerCase();
  const full: Record<string, string> = {
    jan: "January",
    january: "January",
    feb: "February",
    february: "February",
    mar: "March",
    march: "March",
    apr: "April",
    april: "April",
    may: "May",
    jun: "June",
    june: "June",
    jul: "July",
    july: "July",
    aug: "August",
    august: "August",
    sep: "September",
    sept: "September",
    september: "September",
    oct: "October",
    october: "October",
    nov: "November",
    november: "November",
    dec: "December",
    december: "December",
  };
  return full[key] ?? raw;
}

/** "early / mid / late / middle of September" → vague band, not a single day. */
function parseVagueMonthBand(text: string, todayIso: string): ParsedFlightDates | null {
  const re = new RegExp(
    `\\b(early|mid(?:dle)?|late)\\s+(?:of\\s+)?(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const band = m[1].toLowerCase();
  const month = MONTH_NAMES[m[2].toLowerCase()];
  if (!month) return null;
  const [ty] = todayIso.split("-").map(Number);
  let year = m[3] ? Number(m[3]) : ty;
  if (!m[3]) {
    const [, tm] = todayIso.split("-").map(Number);
    if (month < tm) year = ty + 1;
  }
  const last = daysInMonth(year, month);
  let startDay: number;
  let endDay: number;
  let label: string;
  if (band.startsWith("early")) {
    startDay = 1;
    endDay = 10;
    label = `early ${capitalizeMonth(m[2])}`;
  } else if (band.startsWith("late")) {
    startDay = Math.max(21, last - 9);
    endDay = last;
    label = `late ${capitalizeMonth(m[2])}`;
  } else {
    startDay = 11;
    endDay = Math.min(20, last);
    label = `mid-${capitalizeMonth(m[2])}`;
  }
  const rangeStart = toIsoDate(year, month, startDay);
  const rangeEnd = toIsoDate(year, month, endDay);
  if (!rangeStart || !rangeEnd) return null;
  return {
    yearInferred: !m[3],
    vague: { label, rangeStart, rangeEnd },
  };
}

/** "tomorrow", "next Friday", "this weekend", "next weekend" */
function parseRelativeDates(text: string, todayIso: string): ParsedFlightDates | null {
  const lower = text.toLowerCase();

  if (/\btomorrow\b/.test(lower)) {
    return { departureDate: addDaysIsoLocal(todayIso, 1), yearInferred: true };
  }

  if (/\bnext\s+weekend\b/.test(lower)) {
    let daysUntilSat = (6 - weekdayUtc(todayIso) + 7) % 7;
    if (daysUntilSat === 0) daysUntilSat = 7;
    daysUntilSat += 7;
    const sat = addDaysIsoLocal(todayIso, daysUntilSat);
    return {
      departureDate: sat,
      returnDate: addDaysIsoLocal(sat, 2),
      yearInferred: true,
    };
  }

  if (/\bthis\s+weekend\b/.test(lower)) {
    const dow = weekdayUtc(todayIso);
    if (dow === 0) {
      return {
        departureDate: addDaysIsoLocal(todayIso, -2),
        returnDate: todayIso,
        yearInferred: true,
      };
    }
    if (dow === 6) {
      return {
        departureDate: todayIso,
        returnDate: addDaysIsoLocal(todayIso, 1),
        yearInferred: true,
      };
    }
    const daysUntilFri = (5 - dow + 7) % 7;
    const fri = addDaysIsoLocal(todayIso, daysUntilFri);
    return {
      departureDate: fri,
      returnDate: addDaysIsoLocal(fri, 2),
      yearInferred: true,
    };
  }

  const dowMap: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  const nextDow = lower.match(
    /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/,
  );
  if (nextDow) {
    const target = dowMap[nextDow[2]];
    if (target == null) return null;
    const todayDow = weekdayUtc(todayIso);
    let delta = (target - todayDow + 7) % 7;
    if (delta === 0) delta = 7;
    return { departureDate: addDaysIsoLocal(todayIso, delta), yearInferred: true };
  }

  return null;
}

function parseDayFirstNamed(text: string, todayIso: string): ParsedFlightDates | null {
  const withYear = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?${OF}\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`,
    "gi",
  );
  const matches = [...text.matchAll(withYear)];
  if (matches.length > 0) {
    const first = parseNamedDate(matches[0][2], matches[0][1], matches[0][3], todayIso);
    if (!first) return null;
    const out: ParsedFlightDates = { departureDate: first.iso, yearInferred: first.yearInferred };
    if (matches.length >= 2) {
      const second = parseNamedDate(matches[1][2], matches[1][1], matches[1][3], todayIso);
      if (second) out.returnDate = second.iso;
    }
    return out;
  }

  const noYear = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?${OF}\\s+(${MONTH_PATTERN})\\b(?!\\s*\\d{4})`,
    "gi",
  );
  const bare = [...text.matchAll(noYear)];
  if (bare.length === 0) return null;
  const first = parseNamedDate(bare[0][2], bare[0][1], undefined, todayIso);
  if (!first) return null;
  const out: ParsedFlightDates = { departureDate: first.iso, yearInferred: true };
  if (bare.length >= 2) {
    const second = parseNamedDate(bare[1][2], bare[1][1], undefined, todayIso);
    if (second) out.returnDate = second.iso;
  }
  return out;
}

function parseMonthFirstNamed(text: string, todayIso: string): ParsedFlightDates | null {
  const withYear = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "gi",
  );
  const matches = [...text.matchAll(withYear)];
  if (matches.length > 0) {
    const first = parseNamedDate(matches[0][1], matches[0][2], matches[0][3], todayIso);
    if (!first) return null;
    const out: ParsedFlightDates = { departureDate: first.iso };
    if (matches.length >= 2) {
      const second = parseNamedDate(matches[1][1], matches[1][2], matches[1][3], todayIso);
      if (second) out.returnDate = second.iso;
    }
    return out;
  }

  const noYear = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\b(?!\\s*,?\\s*\\d{4})`, "gi");
  const bare = [...text.matchAll(noYear)];
  if (bare.length === 0) return null;
  const first = parseNamedDate(bare[0][1], bare[0][2], undefined, todayIso);
  if (!first) return null;
  const out: ParsedFlightDates = { departureDate: first.iso, yearInferred: true };
  if (bare.length >= 2) {
    const second = parseNamedDate(bare[1][1], bare[1][2], undefined, todayIso);
    if (second) out.returnDate = second.iso;
  }
  return out;
}

function parseMonthRange(text: string, todayIso: string): ParsedFlightDates | null {
  const re = new RegExp(
    `\\b(?:from\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2})\\s+to\\s+(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const dep = parseNamedDate(m[1], m[2], m[5], todayIso);
  const retMonth = m[3] || m[1];
  const ret = parseNamedDate(retMonth, m[4], m[5], todayIso);
  if (!dep || !ret) return null;
  return { departureDate: dep.iso, returnDate: ret.iso };
}

function parseDepartReturn(text: string, todayIso: string): ParsedFlightDates | null {
  const re = new RegExp(
    `\\bdepart\\s+(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s+and\\s+return\\s+(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const depYear = m[3] ?? m[6];
  const dep = parseNamedDate(m[1], m[2], depYear, todayIso);
  const ret = parseNamedDate(m[4], m[5], m[6], todayIso);
  if (!dep || !ret) return null;
  return {
    departureDate: dep.iso,
    returnDate: ret.iso,
    yearInferred: dep.yearInferred || ret.yearInferred,
  };
}

function parseNumericDates(text: string): ParsedFlightDates | null {
  const iso = [...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)];
  if (iso.length > 0) {
    const out: ParsedFlightDates = {
      departureDate: `${iso[0][1]}-${iso[0][2]}-${iso[0][3]}`,
    };
    if (iso.length >= 2) {
      out.returnDate = `${iso[1][1]}-${iso[1][2]}-${iso[1][3]}`;
    }
    return out;
  }

  const slash = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
  if (slash.length === 0) return null;

  const toIso = (a: string, b: string, y: string): string | null => {
    const n1 = Number(a);
    const n2 = Number(b);
    const year = Number(y);
    let month = n1;
    let day = n2;
    if (n1 > 12 && n2 <= 12) {
      day = n1;
      month = n2;
    } else if (n1 <= 12 && n2 <= 12) {
      month = n1;
      day = n2;
    }
    return toIsoDate(year, month, day);
  };

  const first = toIso(slash[0][1], slash[0][2], slash[0][3]);
  if (!first) return null;
  const out: ParsedFlightDates = { departureDate: first };
  if (slash.length >= 2) {
    const second = toIso(slash[1][1], slash[1][2], slash[1][3]);
    if (second) out.returnDate = second;
  }
  return out;
}

/**
 * Extract departure (and optional return) dates from a message.
 * Vague bands set `vague` without `departureDate` — do not invent a search day.
 */
export function parseFlightDatesFromMessage(
  message: string,
  todayIso: string = daysFromToday(0),
): ParsedFlightDates | null {
  const text = message.trim();
  if (!text) return null;

  const exact =
    parseDepartReturn(text, todayIso) ??
    parseMonthRange(text, todayIso) ??
    parseMonthFirstNamed(text, todayIso) ??
    parseDayFirstNamed(text, todayIso) ??
    parseNumericDates(text);

  if (exact?.departureDate) return exact;

  const vague = parseVagueMonthBand(text, todayIso);
  if (vague) return vague;

  return parseRelativeDates(text, todayIso);
}
