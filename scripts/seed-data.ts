/**
 * Seed hospitals and vaccine catalogs via Supabase service role (no JWT/curl).
 *
 * Usage: npx tsx scripts/seed-data.ts
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

interface HospitalSeed {
  phone: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  helpPhone: string;
  country: string;
  services: string[];
  operatingHours: Record<string, { open: string | null; close: string | null; vaccination: boolean }>;
  isVerified: boolean;
}

interface VaccineSeed {
  name: string;
  itemType: 'vaccine' | 'checkup';
  ageMinMonths: number;
  ageMaxMonths: number;
  milestoneAgeMonths: number;
  doseNumber: number;
  purpose: string;
  details: string;
  reminderDays: number[];
}

const HOSPITALS: HospitalSeed[] = [
  {
    phone: '+250788001001',
    name: 'Kigali Health Center',
    address: 'KN 4 Ave, Nyarugenge, Kigali',
    latitude: -1.9441,
    longitude: 30.0619,
    helpPhone: '+250788123456',
    country: 'Rwanda',
    services: ['vaccination', 'pediatrics', 'general'],
    operatingHours: {
      monday: { open: '08:00', close: '17:00', vaccination: true },
      tuesday: { open: '08:00', close: '17:00', vaccination: true },
      wednesday: { open: '08:00', close: '17:00', vaccination: true },
      thursday: { open: '08:00', close: '17:00', vaccination: true },
      friday: { open: '08:00', close: '17:00', vaccination: true },
      saturday: { open: '08:00', close: '12:00', vaccination: true },
      sunday: { open: null, close: null, vaccination: false },
    },
    isVerified: true,
  },
  {
    phone: '+250788001002',
    name: 'Remera Health Centre',
    address: 'KG 11 Ave, Remera, Kigali',
    latitude: -1.9597,
    longitude: 30.1126,
    helpPhone: '+250788234567',
    country: 'Rwanda',
    services: ['vaccination', 'maternity', 'pediatrics'],
    operatingHours: {
      monday: { open: '07:30', close: '18:00', vaccination: true },
      tuesday: { open: '07:30', close: '18:00', vaccination: true },
      wednesday: { open: '07:30', close: '18:00', vaccination: true },
      thursday: { open: '07:30', close: '18:00', vaccination: true },
      friday: { open: '07:30', close: '18:00', vaccination: true },
      saturday: { open: '09:00', close: '13:00', vaccination: true },
      sunday: { open: null, close: null, vaccination: false },
    },
    isVerified: true,
  },
  {
    phone: '+250788001003',
    name: 'Nyamata District Hospital',
    address: 'Nyamata, Bugesera District',
    latitude: -2.1536,
    longitude: 30.1234,
    helpPhone: '+250788345678',
    country: 'Rwanda',
    services: ['vaccination', 'emergency', 'general'],
    operatingHours: {
      monday: { open: '08:00', close: '16:30', vaccination: true },
      tuesday: { open: '08:00', close: '16:30', vaccination: true },
      wednesday: { open: '08:00', close: '16:30', vaccination: true },
      thursday: { open: '08:00', close: '16:30', vaccination: true },
      friday: { open: '08:00', close: '16:30', vaccination: true },
      saturday: { open: '08:00', close: '12:00', vaccination: true },
      sunday: { open: null, close: null, vaccination: false },
    },
    isVerified: false,
  },
];

const VACCINE_CATALOG: VaccineSeed[] = [
  { name: 'BCG', itemType: 'vaccine', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Tuberculosis protection', details: 'Given at birth', reminderDays: [3, 1] },
  { name: 'OPV-0', itemType: 'vaccine', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Polio prevention', details: 'Oral polio dose at birth', reminderDays: [3, 1] },
  { name: 'Birth Health Checkup', itemType: 'checkup', ageMinMonths: 0, ageMaxMonths: 1, milestoneAgeMonths: 0, doseNumber: 1, purpose: 'Newborn assessment', details: 'Weight, reflexes, general health', reminderDays: [3, 1] },
  { name: 'Pentavalent-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Combined immunization', details: 'DTaP, HepB, Hib — dose 1', reminderDays: [3, 1] },
  { name: 'OPV-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Polio prevention', details: 'Oral polio dose 1', reminderDays: [3, 1] },
  { name: 'Pentavalent-2', itemType: 'vaccine', ageMinMonths: 2, ageMaxMonths: 3, milestoneAgeMonths: 2, doseNumber: 1, purpose: 'Combined immunization', details: 'DTaP, HepB, Hib — dose 2', reminderDays: [3, 1] },
  { name: 'Pentavalent-3', itemType: 'vaccine', ageMinMonths: 3, ageMaxMonths: 6, milestoneAgeMonths: 3, doseNumber: 1, purpose: 'Combined immunization', details: 'DTaP, HepB, Hib — dose 3', reminderDays: [3, 1] },
  { name: 'PCV-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Pneumococcal disease', details: 'Pneumococcal conjugate dose 1', reminderDays: [3, 1] },
  { name: 'Rotavirus-1', itemType: 'vaccine', ageMinMonths: 1, ageMaxMonths: 2, milestoneAgeMonths: 1, doseNumber: 1, purpose: 'Rotavirus gastroenteritis', details: 'First rotavirus dose', reminderDays: [3, 1] },
  { name: 'Measles-Rubella-1', itemType: 'vaccine', ageMinMonths: 9, ageMaxMonths: 12, milestoneAgeMonths: 9, doseNumber: 1, purpose: 'Measles & rubella', details: 'First MR dose at 9 months', reminderDays: [7, 3, 1] },
  { name: 'Measles-Rubella-2', itemType: 'vaccine', ageMinMonths: 15, ageMaxMonths: 24, milestoneAgeMonths: 18, doseNumber: 1, purpose: 'Measles & rubella', details: 'Second MR dose at 18 months', reminderDays: [7, 3, 1] },
];

async function ensureHospital(seed: HospitalSeed): Promise<string> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('phone', seed.phone)
    .maybeSingle();

  let ownerId: string;

  if (existingUser) {
    ownerId = existingUser.id;
    if (existingUser.role !== 'hospital') {
      const { error } = await supabase
        .from('users')
        .update({ role: 'hospital', name: seed.name, country: seed.country })
        .eq('id', ownerId);
      if (error) throw new Error(`Failed to update user role for ${seed.phone}: ${error.message}`);
    }
  } else {
    const { data: created, error } = await supabase
      .from('users')
      .insert({ phone: seed.phone, role: 'hospital', name: seed.name, country: seed.country })
      .select('id')
      .single();
    if (error || !created) throw new Error(`Failed to create user ${seed.phone}: ${error?.message}`);
    ownerId = created.id;
  }

  const { data: existingHospital } = await supabase
    .from('hospitals')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existingHospital) {
    console.log(`  Hospital exists: ${seed.name} (${existingHospital.id})`);
    return existingHospital.id;
  }

  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .insert({
      owner_id: ownerId,
      name: seed.name,
      address: seed.address,
      latitude: seed.latitude,
      longitude: seed.longitude,
      help_phone: seed.helpPhone,
      country: seed.country,
      services: seed.services,
      operating_hours: seed.operatingHours,
      is_verified: seed.isVerified,
    })
    .select('id')
    .single();

  if (hospitalError || !hospital) {
    throw new Error(`Failed to create hospital ${seed.name}: ${hospitalError?.message}`);
  }

  console.log(`  Created hospital: ${seed.name} (${hospital.id})`);
  return hospital.id;
}

async function seedVaccines(hospitalId: string, hospitalName: string): Promise<number> {
  let inserted = 0;

  for (const v of VACCINE_CATALOG) {
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
      reminder_days: v.reminderDays,
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
  console.log('\n=== Seeding hospitals & vaccines (service role) ===\n');

  const summary: Array<{ name: string; id: string; vaccinesAdded: number }> = [];

  for (const seed of HOSPITALS) {
    console.log(`Processing: ${seed.name}`);
    const hospitalId = await ensureHospital(seed);
    const vaccinesAdded = await seedVaccines(hospitalId, seed.name);
    console.log(`  Vaccines added: ${vaccinesAdded} (${VACCINE_CATALOG.length} in catalog)\n`);
    summary.push({ name: seed.name, id: hospitalId, vaccinesAdded });
  }

  console.log('=== Summary ===');
  for (const row of summary) {
    console.log(`  ${row.name}: ${row.id} (+${row.vaccinesAdded} vaccines)`);
  }

  const { count } = await supabase
    .from('hospital_vaccines')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`\nTotal active vaccines in DB: ${count ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
