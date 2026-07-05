import { differenceInMonths, addMonths, format } from 'date-fns';

export function calculateDueDate(dob: Date, milestoneAgeMonths: number): string {
  const dueDate = addMonths(dob, milestoneAgeMonths);
  return format(dueDate, 'yyyy-MM-dd');
}

export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return format(date, 'MMM d, yyyy');
}

export function addDaysToToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
}

export function todayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function ageInMonths(dob: Date, referenceDate: Date = new Date()): number {
  return Math.max(0, differenceInMonths(referenceDate, dob));
}

export function parseDateString(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}
