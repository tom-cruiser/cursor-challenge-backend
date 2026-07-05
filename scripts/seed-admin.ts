/**
 * Upsert hospital admin accounts for the admin portal (backend role: hospital).
 *
 * Primary account matches frontend mock auth (admin@demo.com → phone +250780000001).
 * Safe to re-run — creates or updates users + hospitals by phone.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *   npm run seed:admin
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AdminSeed {
  phone: string;
  email: string;
  name: string;
  mockEmail?: string;
  mockPassword?: string;
  hospital: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    helpPhone: string;
    country: string;
    services: string[];
    operatingHours: Record<string, { open: string | null; close: string | null; vaccination: boolean }>;
    isVerified: boolean;
  };
  vaccines?: Array<{
    name: string;
    itemType: 'vaccine' | 'checkup';
    ageMinMonths: number;
    ageMaxMonths: number;
    milestoneAgeMonths: number;
    doseNumber: number;
    purpose: string;
    details: string;
  }>;
}

const KUT_VACCINES: AdminSeed['vaccines'] = [
  { name: 'BCG', itemType: 'vaccine', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Tuberculosis protection', details: 'Given at birth' },
  { name: 'OPV-0', itemType: 'vaccine', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Polio prevention', details: 'Oral polio dose at birth' },
  { name: 'Birth Health Checkup', itemType: 'checkup', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Newborn assessment', details: 'Weight, reflexes, general health' },
  { name: 'Pentavalent-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Combined immunization', details: 'DPT, HepB, Hib — dose 1' },
  { name: 'OPV-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Polio prevention', details: 'Oral polio dose 1' },
  { name: 'Pentavalent-2', itemType: 'vaccine', ageMinMonths: 2, ageMaxMonths: 3, milestoneAgeMonths: 2, doseNumber: 1, purpose: 'Combined immunization', details: 'DPT, HepB, Hib — dose 2' },
  { name: 'Pentavalent-3', itemType: 'vaccine', ageMinMonths: 3, ageMaxMonths: 6, milestoneAgeMonths: 3, doseNumber: 1, purpose: 'Combined immunization', details: 'DPT, HepB, Hib — dose 3' },
  { name: 'Measles-Rubella-1', itemType: 'vaccine', ageMinMonths: 9, ageMaxMonths: 12, milestoneAgeMonths: 9, doseNumber: 1, purpose: 'Measles & rubella', details: 'First MR dose at 9 months' },
  { name: 'Measles-Rubella-2', itemType: 'vaccine', ageMinMonths: 15, ageMaxMonths: 24, milestoneAgeMonths: 18, doseNumber: 1, purpose: 'Measles & rubella', details: 'Second MR dose at 18 months' },
];

const ADMINS: AdminSeed[] = [
  {
    phone: '+250780000001',
    email: 'admin@demo.com',
    name: 'Dr. Marcus Webb',
    mockEmail: 'admin@demo.com',
    mockPassword: 'password123',
    hospital: {
      name: 'Kigali University Teaching Hospital',
      address: 'KN 4 Ave, Kigali',
      latitude: -1.9441,
      longitude: 30.0619,
      helpPhone: '+250788123456',
      country: 'Rwanda',
      services: ['vaccination', 'pediatrics', 'emergency'],
      operatingHours: {
        monday: { open: '07:30', close: '17:00', vaccination: true },
        tuesday: { open: '07:30', close: '17:00', vaccination: true },
        wednesday: { open: '07:30', close: '17:00', vaccination: true },
        thursday: { open: '07:30', close: '17:00', vaccination: true },
        friday: { open: '07:30', close: '17:00', vaccination: true },
        saturday: { open: '08:00', close: '12:00', vaccination: true },
        sunday: { open: null, close: null, vaccination: false },
      },
      isVerified: true,
    },
    vaccines: KUT_VACCINES,
  },
  {
    phone: '+250780000002',
    email: 'admin2@demo.com',
    name: 'King Faisal Admin',
    hospital: {
      name: 'King Faisal Hospital',
      address: 'KG 544 St, Kigali',
      latitude: -1.9536,
      longitude: 30.0925,
      helpPhone: '+250788654321',
      country: 'Rwanda',
      services: ['vaccination', 'maternity', 'general'],
      operatingHours: {
        monday: { open: '08:00', close: '18:00', vaccination: true },
        tuesday: { open: '08:00', close: '18:00', vaccination: true },
        wednesday: { open: '08:00', close: '18:00', vaccination: true },
        thursday: { open: '08:00', close: '18:00', vaccination: true },
        friday: { open: '08:00', close: '18:00', vaccination: true },
        saturday: { open: '09:00', close: '13:00', vaccination: false },
        sunday: { open: null, close: null, vaccination: false },
      },
      isVerified: true,
    },
  },
];

async function ensureAdmin(seed: AdminSeed): Promise<{ userId: string; hospitalId: string }> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('phone', seed.phone)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    const { error } = await supabase
      .from('users')
      .update({
        role: 'hospital',
        name: seed.name,
        email: seed.email,
        country: seed.hospital.country,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user ${seed.phone}: ${error.message}`);
    }
    console.log(`  User updated: ${seed.phone} (${userId})`);
  } else {
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        phone: seed.phone,
        role: 'hospital',
        name: seed.name,
        email: seed.email,
        country: seed.hospital.country,
      })
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create user ${seed.phone}: ${error?.message}`);
    }
    userId = created.id;
    console.log(`  User created: ${seed.phone} (${userId})`);
  }

  const { data: existingHospital } = await supabase
    .from('hospitals')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  const hospitalPayload = {
    name: seed.hospital.name,
    address: seed.hospital.address,
    latitude: seed.hospital.latitude,
    longitude: seed.hospital.longitude,
    help_phone: seed.hospital.helpPhone,
    country: seed.hospital.country,
    services: seed.hospital.services,
    operating_hours: seed.hospital.operatingHours,
    is_verified: seed.hospital.isVerified,
  };

  let hospitalId: string;

  if (existingHospital) {
    hospitalId = existingHospital.id;
    const { error } = await supabase
      .from('hospitals')
      .update(hospitalPayload)
      .eq('id', hospitalId);

    if (error) {
      throw new Error(`Failed to update hospital ${seed.hospital.name}: ${error.message}`);
    }
    console.log(`  Hospital updated: ${seed.hospital.name} (${hospitalId})`);
  } else {
    const { data: hospital, error } = await supabase
      .from('hospitals')
      .insert({ owner_id: userId, ...hospitalPayload })
      .select('id')
      .single();

    if (error || !hospital) {
      throw new Error(`Failed to create hospital ${seed.hospital.name}: ${error?.message}`);
    }
    hospitalId = hospital.id;
    console.log(`  Hospital created: ${seed.hospital.name} (${hospitalId})`);
  }

  return { userId, hospitalId };
}

async function seedVaccines(
  hospitalId: string,
  hospitalName: string,
  vaccines: NonNullable<AdminSeed['vaccines']>,
): Promise<number> {
  let inserted = 0;

  for (const v of vaccines) {
    const { data: existing } = await supabase
      .from('hospital_vaccines')
      .select('id')
      .eq('hospital_id', hospitalId)
      .eq('name', v.name)
      .eq('dose_number', v.doseNumber)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('hospital_vaccines').insert({
      hospital_id: hospitalId,
      name: v.name,
      item_type: v.itemType,
      age_min_months: v.ageMinMonths,
      age_max_months: v.ageMaxMonths,
      milestone_age_months: v.milestoneAgeMonths,
      dose_number: v.doseNumber,
      purpose: v.purpose,
      details: v.details,
      reminder_days: [3, 1],
    });

    if (error) {
      console.error(`    Failed to insert ${v.name} at ${hospitalName}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return inserted;
}

async function main(): Promise<void> {
  console.log('\n=== Seeding hospital admin accounts ===\n');

  const summary: Array<{
    phone: string;
    email: string;
    hospital: string;
    mockLogin?: string;
    userId: string;
    hospitalId: string;
    vaccinesAdded: number;
  }> = [];

  for (const seed of ADMINS) {
    console.log(`Processing: ${seed.name} (${seed.phone})`);
    const { userId, hospitalId } = await ensureAdmin(seed);

    let vaccinesAdded = 0;
    if (seed.vaccines?.length) {
      vaccinesAdded = await seedVaccines(hospitalId, seed.hospital.name, seed.vaccines);
      console.log(`  Vaccines added: ${vaccinesAdded}`);
    }

    summary.push({
      phone: seed.phone,
      email: seed.email,
      hospital: seed.hospital.name,
      mockLogin:
        seed.mockEmail && seed.mockPassword
          ? `${seed.mockEmail} / ${seed.mockPassword}`
          : undefined,
      userId,
      hospitalId,
      vaccinesAdded,
    });
    console.log('');
  }

  console.log('=== Admin credentials ===\n');
  for (const row of summary) {
    console.log(`  Hospital: ${row.hospital}`);
    console.log(`  Phone (JWT): ${row.phone}`);
    console.log(`  Email (DB): ${row.email}`);
    if (row.mockLogin) {
      console.log(`  Mock login: ${row.mockLogin}`);
    }
    console.log(`  User ID: ${row.userId}`);
    console.log(`  Hospital ID: ${row.hospitalId}`);
    console.log('');
  }

  console.log('Done. See docs/ADMIN_SETUP.md for login instructions.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
