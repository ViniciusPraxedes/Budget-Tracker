// Number of milliseconds in a single day, used for date difference math
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Shape of the resolved payday cycle information for a given viewed month
export interface PaydayCycleInfo {
    // First calendar date of the cycle
    startDate: Date;
    // Last calendar date of the cycle
    endDate: Date;
    // Total duration of the cycle in days
    lengthInDays: number;
    // How many days of the cycle have elapsed as of today, clamped to the cycle bounds
    daysElapsed: number;
    // Percentage of the cycle elapsed as of today, 0-100
    elapsedPct: number;
    // Short human-readable description of the cycle boundaries, e.g. "25th - 24th"
    label: string;
}

// Append the correct English ordinal suffix to a day-of-month number
const ordinal = (day: number) => {
    // Handle the 11th-13th exceptions before the general rule
    if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
    // Apply the standard suffix based on the final digit
    switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
    }
};

/**
 * Resolve the payday cycle boundaries and elapsed progress for the month being viewed.
 *
 * Elapsed days are measured from the cycle start to today and clamped to the cycle, so a
 * month that has already finished reports 100% elapsed and a future month reports 0%,
 * rather than reporting today's position in the current cycle regardless of the month shown.
 */
export const resolvePaydayCycle = (
    paydayStartDay: number | undefined,
    paydayEndDay: number | undefined,
    viewedMonth: number,
    viewedYear: number,
    today: Date = new Date()
): PaydayCycleInfo => {
    // Default the cycle start to the 25th when unset, matching the app's default payday
    const startDay = paydayStartDay || 25;
    // Resolve the configured cycle end day, falling back to the day before the start day
    const endDay = paydayEndDay ?? (startDay === 1 ? new Date(viewedYear, viewedMonth + 1, 0).getDate() : startDay - 1);

    // A cycle starting on the 1st sits entirely inside the viewed month, otherwise it opens in the previous month
    const startDate = new Date(viewedYear, startDay === 1 ? viewedMonth : viewedMonth - 1, startDay);
    // The cycle always closes within the viewed month
    const endDate = new Date(viewedYear, viewedMonth, endDay);

    // Total inclusive duration of the cycle in days
    const lengthInDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

    // Normalise today to midnight so partial days don't skew the difference
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Inclusive count of days from the cycle start through today
    const rawDaysElapsed = Math.floor((todayMidnight.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
    // Clamp to the cycle so past months read as complete and future months as not started
    const daysElapsed = Math.max(0, Math.min(rawDaysElapsed, lengthInDays));

    // Percentage of the cycle elapsed, guarding against a zero-length cycle
    const elapsedPct = lengthInDays > 0 ? Math.min(100, Math.round((daysElapsed / lengthInDays) * 100)) : 0;

    // Return the resolved cycle description
    return {
        startDate,
        endDate,
        lengthInDays,
        daysElapsed,
        elapsedPct,
        label: `${ordinal(startDay)} - ${ordinal(endDay)}`
    };
};
