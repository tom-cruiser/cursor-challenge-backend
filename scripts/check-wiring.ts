/**
 * Verifies app wiring: env validation, Express boot, route mounting.
 * Run: npm run check:wiring
 */

process.env.PORT = '3000';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-with-enough-length';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM_EMAIL = 'test@example.com';
process.env.CRON_TZ = 'Africa/Kigali';
process.env.AFRICASTALKING_ENABLED = 'false';

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

async function main(): Promise<void> {
  console.log('\n=== Wiring Checks ===\n');

  // Env loads without error
  console.log('Config:');
  try {
    const { env } = await import('../src/config/env');
    assert(env.SUPABASE_URL.includes('supabase.co'), 'env.ts loads and parses');
    assert(env.africasTalkingConfigured === false, 'Africa\'s Talking disabled by default');
  } catch (err) {
    failed++;
    console.error('  ✗ env.ts failed to load:', err);
  }

  // Express app factory
  console.log('\nExpress app:');
  try {
    const { createApp } = await import('../src/app');
    const routes = await import('../src/routes/index');
    const app = createApp();
    assert(typeof app === 'function', 'createApp() returns Express app');
    assert(routes.default !== undefined, 'routes/index exports router');
  } catch (err) {
    failed++;
    console.error('  ✗ createApp failed:', err);
  }

  // Route modules export routers
  console.log('\nRoute modules:');
  const userRoutes = await import('../src/routes/user.routes');
  const hospitalRoutes = await import('../src/routes/hospital.routes');
  assert(userRoutes.default !== undefined, 'user.routes exports router');
  assert(hospitalRoutes.default !== undefined, 'hospital.routes exports router');

  // Service exports
  console.log('\nService exports:');
  const schedule = await import('../src/services/schedule.service');
  const parent = await import('../src/services/parent.service');
  const hospitalAdmin = await import('../src/services/hospital-admin.service');
  const notification = await import('../src/services/notification.service');

  assert(typeof schedule.generateTimelineForChild === 'function', 'schedule.generateTimelineForChild');
  assert(typeof schedule.createChild === 'function', 'schedule.createChild');
  assert(typeof schedule.getUpcomingVaccinesForChild === 'function', 'schedule.getUpcomingVaccinesForChild');
  assert(typeof parent.updateParentProfile === 'function', 'parent.updateParentProfile');
  assert(typeof hospitalAdmin.signupHospital === 'function', 'hospitalAdmin.signupHospital');
  assert(typeof hospitalAdmin.createHospitalVaccine === 'function', 'hospitalAdmin.createHospitalVaccine');
  assert(typeof schedule.syncVaccineToHospitalChildren === 'function', 'schedule.syncVaccineToHospitalChildren');
  assert(typeof notification.sendVaccinationReminder === 'function', 'notification.sendVaccinationReminder');

  // Cron module
  console.log('\nCron:');
  const cron = await import('../src/tasks/reminder.cron');
  assert(typeof cron.startReminderCron === 'function', 'reminder.cron exports startReminderCron');
  assert(typeof cron.processDailyReminders === 'function', 'reminder.cron exports processDailyReminders');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Wiring check crashed:', err);
  process.exit(1);
});
