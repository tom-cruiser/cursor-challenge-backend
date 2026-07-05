/**
 * Pure business-logic checks — no database or env required.
 * Run: npm run check:logic
 */

import { addMonths, format } from 'date-fns';
import { calculateDueDate, ageInMonths, parseDateString } from '../src/utils/dates';
import { haversineDistanceKm } from '../src/utils/haversine';
import {
  validateVaccineAgeRange,
  vaccineAppliesAtMilestone,
  isUpcomingForChildAge,
  shouldSendReminderOnDay,
  compareTimelineItems,
  TIMELINE_STATUS_ORDER,
} from '../src/utils/vaccine-rules';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log('\n=== Business Logic Checks ===\n');

// --- Vaccine age rules ---
console.log('Vaccine age validation:');
assert(
  validateVaccineAgeRange({ ageMinMonths: 0, ageMaxMonths: 12, milestoneAgeMonths: 6 }) === null,
  'valid range passes',
);
assert(
  validateVaccineAgeRange({ ageMinMonths: 6, ageMaxMonths: 3, milestoneAgeMonths: 4 }) !== null,
  'rejects max < min',
);
assert(
  validateVaccineAgeRange({ ageMinMonths: 2, ageMaxMonths: 6, milestoneAgeMonths: 1 }) !== null,
  'rejects milestone below min',
);
assert(
  validateVaccineAgeRange({ ageMinMonths: 0, ageMaxMonths: 3, milestoneAgeMonths: 9 }) !== null,
  'rejects milestone above max',
);

console.log('\nVaccine applicability:');
assert(
  vaccineAppliesAtMilestone({ age_min_months: 0, age_max_months: 1 }, 0),
  'BCG at birth applies',
);
assert(
  !vaccineAppliesAtMilestone({ age_min_months: 9, age_max_months: 12 }, 6),
  '9-month vaccine does not apply at 6 months milestone',
);

// --- Due date calculation ---
console.log('\nSchedule due dates:');
const dob = parseDateString('2024-06-15');
assert(
  calculateDueDate(dob, 0) === '2024-06-15',
  'milestone 0 = birth date',
);
assert(
  calculateDueDate(dob, 1) === format(addMonths(dob, 1), 'yyyy-MM-dd'),
  'milestone 1 = DOB + 1 month',
);
assert(
  ageInMonths(dob, parseDateString('2025-06-15')) === 12,
  'age in months at 1st birthday = 12',
);

// --- Upcoming filter ---
console.log('\nUpcoming vaccine filter:');
assert(
  isUpcomingForChildAge({ age_max_months: 12 }, 10, 'pending'),
  'pending vaccine within age range is upcoming',
);
assert(
  !isUpcomingForChildAge({ age_max_months: 6 }, 10, 'pending'),
  'child past age_max is not upcoming',
);
assert(
  !isUpcomingForChildAge({ age_max_months: 12 }, 10, 'completed'),
  'completed is never upcoming',
);

// --- Cron reminder days ---
console.log('\nReminder day matching:');
assert(shouldSendReminderOnDay([3, 1], 3), 'fires 3 days before');
assert(shouldSendReminderOnDay([3, 1], 1), 'fires 1 day before');
assert(!shouldSendReminderOnDay([3, 1], 2), 'does not fire 2 days before');

// --- Timeline sort ---
console.log('\nTimeline sort order:');
assert(TIMELINE_STATUS_ORDER.overdue < TIMELINE_STATUS_ORDER.pending, 'overdue before pending');
assert(
  compareTimelineItems(
    { status: 'overdue', due_date: '2026-01-01', completed_at: null },
    { status: 'pending', due_date: '2026-06-01', completed_at: null },
  ) < 0,
  'overdue sorts before pending',
);
assert(
  compareTimelineItems(
    { status: 'completed', due_date: '2026-01-01', completed_at: '2026-01-05T00:00:00Z' },
    { status: 'completed', due_date: '2026-02-01', completed_at: '2026-01-01T00:00:00Z' },
  ) < 0,
  'completed sorts by completed_at DESC',
);

// --- Haversine (Kigali hospitals ~1km apart) ---
console.log('\nHaversine proximity:');
const dist = haversineDistanceKm(-1.9441, 30.0619, -1.9536, 30.0925);
assert(dist > 0 && dist < 10, `Kigali seed hospitals ~${dist.toFixed(2)} km apart`);

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
