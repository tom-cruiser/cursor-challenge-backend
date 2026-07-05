/**
 * Seed 8 real Kigali-area hospitals via Supabase service role.
 *
 * Idempotent — upserts users (role=hospital) by normalized help phone and
 * updates hospitals by owner_id. Adds standard EPI vaccine catalog per hospital.
 *
 * Usage:
 *   npx tsx scripts/seed-kigali-hospitals.ts
 *   npm run seed:hospitals
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

/** Normalize Rwandan numbers to E.164 +250XXXXXXXXX (no spaces). */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('250') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+250${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+250${digits.slice(1)}`;
  }
  return raw.startsWith('+') ? raw.replace(/\s/g, '') : `+${digits}`;
}

/** Open 24h — vaccination offered Mon–Fri. */
function open24HoursOperatingHours(): HospitalSeed['operatingHours'] {
  const day = (vaccination: boolean) => ({
    open: '00:00',
    close: '23:59',
    vaccination,
  });
  return {
    monday: day(true),
    tuesday: day(true),
    wednesday: day(true),
    thursday: day(true),
    friday: day(true),
    saturday: day(false),
    sunday: day(false),
  };
}

function buildServices(type: string, sector: string, district: string, city: string): string[] {
  return ['vaccination', type, sector, district, city];
}

function buildAddress(street: string, city: string, district: string): string {
  return `${street}, ${district}, ${city}`;
}

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

const KIGALI_HOSPITALS: HospitalSeed[] = [
  {
    phone: normalizePhone('+250 788 123 200'),
    name: 'King Faisal Hospital',
    address: buildAddress('KG 544 St', 'Kigali', 'Gasabo'),
    latitude: -1.9436307,
    longitude: 30.0953563,
    helpPhone: normalizePhone('+250 788 123 200'),
    country: 'Rwanda',
    services: buildServices('hospital', 'private', 'Gasabo', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 788 304 005'),
    name: 'University Teaching Hospital of Kigali (CHUK)',
    address: buildAddress('KN 4 Ave', 'Kigali', 'Nyarugenge'),
    latitude: -1.9559588,
    longitude: 30.0604352,
    helpPhone: normalizePhone('+250 788 304 005'),
    country: 'Rwanda',
    services: buildServices('teaching hospital', 'public', 'Nyarugenge', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 733 444 444'),
    name: 'WIWO Specialized Hospital',
    address: buildAddress('43 KN 1 Ave', 'Kigali', 'Nyarugenge'),
    latitude: -1.9440809,
    longitude: 30.0675396,
    helpPhone: normalizePhone('+250 733 444 444'),
    country: 'Rwanda',
    services: buildServices('specialized hospital', 'private', 'Nyarugenge', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 785 246 882'),
    name: 'La Croix du Sud Hospital',
    address: buildAddress('KG 201 St', 'Kigali', 'Gasabo'),
    latitude: -1.9582816,
    longitude: 30.1061156,
    helpPhone: normalizePhone('+250 785 246 882'),
    country: 'Rwanda',
    services: buildServices('hospital', 'private', 'Gasabo', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 782 343 710'),
    name: 'Baho International Hospital',
    address: buildAddress('10 KG 268 St', 'Kigali', 'Gasabo'),
    latitude: -1.9491973,
    longitude: 30.1054281,
    helpPhone: normalizePhone('+250 782 343 710'),
    country: 'Rwanda',
    services: buildServices('hospital', 'private', 'Gasabo', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 790 666 663'),
    name: 'Nyarugenge District Hospital',
    address: buildAddress('KN 247 St', 'Kigali', 'Nyarugenge'),
    latitude: -1.981521,
    longitude: 30.0433428,
    helpPhone: normalizePhone('+250 790 666 663'),
    country: 'Rwanda',
    services: buildServices('district hospital', 'public', 'Nyarugenge', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 798 694 806'),
    name: 'Kibagabaga Level Two Teaching Hospital',
    address: buildAddress('KG 19 Ave', 'Kigali', 'Gasabo'),
    latitude: -1.9307663,
    longitude: 30.1119129,
    helpPhone: normalizePhone('+250 798 694 806'),
    country: 'Rwanda',
    services: buildServices('teaching hospital', 'public', 'Gasabo', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
  {
    phone: normalizePhone('+250 728 878 194'),
    name: 'Masaka Hospital',
    address: buildAddress('Masaka', 'Kigali', 'Kicukiro'),
    latitude: -1.9919478,
    longitude: 30.2119896,
    helpPhone: normalizePhone('+250 728 878 194'),
    country: 'Rwanda',
    services: buildServices('hospital', 'public', 'Kicukiro', 'Kigali'),
    operatingHours: open24HoursOperatingHours(),
    isVerified: true,
  },
];

async function ensureHospital(seed: HospitalSeed): Promise<{ id: string; action: 'created' | 'updated' }> {
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

  const payload = {
    name: seed.name,
    address: seed.address,
    latitude: seed.latitude,
    longitude: seed.longitude,
    help_phone: seed.helpPhone,
    country: seed.country,
    services: seed.services,
    operating_hours: seed.operatingHours,
    is_verified: seed.isVerified,
  };

  if (existingHospital) {
    const { error: updateError } = await supabase
      .from('hospitals')
      .update(payload)
      .eq('id', existingHospital.id);

    if (updateError) {
      throw new Error(`Failed to update hospital ${seed.name}: ${updateError.message}`);
    }

    return { id: existingHospital.id, action: 'updated' };
  }

  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .insert({ owner_id: ownerId, ...payload })
    .select('id')
    .single();

  if (hospitalError || !hospital) {
    throw new Error(`Failed to create hospital ${seed.name}: ${hospitalError?.message}`);
  }

  return { id: hospital.id, action: 'created' };
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
  console.log('\n=== Seeding Kigali hospitals (service role) ===\n');

  let created = 0;
  let updated = 0;
  const summary: Array<{ name: string; id: string; action: string; vaccinesAdded: number }> = [];

  for (const seed of KIGALI_HOSPITALS) {
    console.log(`Processing: ${seed.name}`);
    const { id, action } = await ensureHospital(seed);
    if (action === 'created') created++;
    else updated++;

    const vaccinesAdded = await seedVaccines(id, seed.name);
    console.log(`  ${action === 'created' ? 'Created' : 'Updated'}: ${seed.name} (${id})`);
    console.log(`  Vaccines added: ${vaccinesAdded}\n`);
    summary.push({ name: seed.name, id, action, vaccinesAdded });
  }

  console.log('=== Summary ===');
  console.log(`  Hospitals created: ${created}`);
  console.log(`  Hospitals updated: ${updated}`);
  console.log(`  Total processed: ${KIGALI_HOSPITALS.length}\n`);

  for (const row of summary) {
    console.log(`  [${row.action}] ${row.name}: ${row.id} (+${row.vaccinesAdded} vaccines)`);
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
