import { HospitalVaccine } from '../models/types';

export interface VaccineAgeInput {
  ageMinMonths: number;
  ageMaxMonths: number;
  milestoneAgeMonths: number;
}

export function validateVaccineAgeRange(input: VaccineAgeInput): string | null {
  if (input.ageMaxMonths < input.ageMinMonths) {
    return 'ageMaxMonths must be greater than or equal to ageMinMonths';
  }
  if (input.milestoneAgeMonths < input.ageMinMonths) {
    return 'milestoneAgeMonths must be at least ageMinMonths';
  }
  if (input.milestoneAgeMonths > input.ageMaxMonths) {
    return 'milestoneAgeMonths must not exceed ageMaxMonths';
  }
  return null;
}

export function vaccineAppliesAtMilestone(
  vaccine: Pick<HospitalVaccine, 'age_min_months' | 'age_max_months'>,
  milestoneAgeMonths: number,
): boolean {
  return (
    milestoneAgeMonths >= vaccine.age_min_months &&
    milestoneAgeMonths <= vaccine.age_max_months
  );
}

export function isUpcomingForChildAge(
  vaccine: Pick<HospitalVaccine, 'age_max_months'>,
  childAgeMonths: number,
  status: string,
): boolean {
  if (status === 'completed') return false;
  return childAgeMonths <= vaccine.age_max_months;
}

export function shouldSendReminderOnDay(
  reminderDays: number[],
  daysUntilDue: number,
): boolean {
  return reminderDays.includes(daysUntilDue);
}

export const TIMELINE_STATUS_ORDER: Record<string, number> = {
  overdue: 0,
  due_soon: 1,
  pending: 2,
  completed: 3,
};

export function compareTimelineItems(
  a: { status: string; due_date: string; completed_at: string | null },
  b: { status: string; due_date: string; completed_at: string | null },
): number {
  const statusDiff = TIMELINE_STATUS_ORDER[a.status] - TIMELINE_STATUS_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;

  if (a.status === 'completed' && b.status === 'completed') {
    const aCompleted = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bCompleted = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bCompleted - aCompleted;
  }

  return a.due_date.localeCompare(b.due_date);
}
