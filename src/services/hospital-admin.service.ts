import { supabase } from '../config/database';
import {
  Child,
  Hospital,
  HospitalDashboardStats,
  HospitalVaccine,
  OperatingHours,
  ParentWithChildren,
  User,
} from '../models/types';
import { AppError } from '../utils/errors';
import { ageInMonths, parseDateString } from '../utils/dates';
import { validateVaccineAgeRange } from '../utils/vaccine-rules';
import {
  createChild,
  ensureParentRegistered,
  markTimelineItemComplete,
  syncVaccineToHospitalChildren,
} from './schedule.service';

export interface HospitalSignupInput {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  helpPhone?: string;
  country?: string;
  services?: string[];
  operatingHours?: OperatingHours;
}

export interface UpdateHospitalProfileInput {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  helpPhone?: string;
  country?: string;
  services?: string[];
  operatingHours?: OperatingHours;
}

export interface CreateVaccineInput {
  name: string;
  itemType: 'vaccine' | 'checkup';
  ageMinMonths: number;
  ageMaxMonths: number;
  milestoneAgeMonths: number;
  doseNumber?: number;
  purpose?: string;
  details?: string;
  reminderDays?: number[];
}

export interface ManualParentInput {
  phone: string;
  name: string;
  email?: string;
  country?: string;
}

export interface ManualChildInput {
  parentId: string;
  name: string;
  dateOfBirth: string;
  sex?: 'male' | 'female' | 'other';
  notes?: string;
}

async function getHospitalByOwner(ownerId: string): Promise<Hospital> {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('owner_id', ownerId)
    .single();

  if (error || !data) {
    throw new AppError(404, 'Hospital not found for this account');
  }

  return data as Hospital;
}

export async function signupHospital(
  ownerId: string,
  input: HospitalSignupInput,
): Promise<{ hospital: Hospital; user: User }> {
  const { data: existingHospital } = await supabase
    .from('hospitals')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existingHospital) {
    throw new AppError(409, 'Hospital account already registered');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .update({ role: 'hospital', name: input.name, country: input.country ?? null })
    .eq('id', ownerId)
    .select('*')
    .single();

  if (userError || !user) {
    throw new AppError(500, 'Failed to update user role', userError);
  }

  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .insert({
      owner_id: ownerId,
      name: input.name,
      address: input.address ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      help_phone: input.helpPhone ?? null,
      country: input.country ?? null,
      services: input.services ?? ['vaccination'],
      operating_hours: input.operatingHours ?? {},
      is_verified: false,
    })
    .select('*')
    .single();

  if (hospitalError || !hospital) {
    throw new AppError(500, 'Failed to create hospital', hospitalError);
  }

  return { hospital: hospital as Hospital, user: user as User };
}

export async function getHospitalProfile(ownerId: string): Promise<Hospital> {
  return getHospitalByOwner(ownerId);
}

export async function updateHospitalProfile(
  ownerId: string,
  input: UpdateHospitalProfileInput,
): Promise<Hospital> {
  const hospital = await getHospitalByOwner(ownerId);
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.address !== undefined) updates.address = input.address;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;
  if (input.helpPhone !== undefined) updates.help_phone = input.helpPhone;
  if (input.country !== undefined) updates.country = input.country;
  if (input.services !== undefined) updates.services = input.services;
  if (input.operatingHours !== undefined) updates.operating_hours = input.operatingHours;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No fields provided to update');
  }

  const { data, error } = await supabase
    .from('hospitals')
    .update(updates)
    .eq('id', hospital.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to update hospital profile', error);
  }

  return data as Hospital;
}

export async function createHospitalVaccine(
  ownerId: string,
  input: CreateVaccineInput,
): Promise<{ vaccine: HospitalVaccine; childrenSynced: number }> {
  const hospital = await getHospitalByOwner(ownerId);

  const ageError = validateVaccineAgeRange({
    ageMinMonths: input.ageMinMonths,
    ageMaxMonths: input.ageMaxMonths,
    milestoneAgeMonths: input.milestoneAgeMonths,
  });
  if (ageError) {
    throw new AppError(400, ageError);
  }

  const { data, error } = await supabase
    .from('hospital_vaccines')
    .insert({
      hospital_id: hospital.id,
      name: input.name,
      item_type: input.itemType,
      age_min_months: input.ageMinMonths,
      age_max_months: input.ageMaxMonths,
      milestone_age_months: input.milestoneAgeMonths,
      dose_number: input.doseNumber ?? 1,
      purpose: input.purpose ?? null,
      details: input.details ?? null,
      reminder_days: input.reminderDays ?? [3, 1],
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Vaccine with this name and dose already exists');
    }
    throw new AppError(500, 'Failed to create vaccine', error);
  }

  const vaccine = data as HospitalVaccine;
  const childrenSynced = await syncVaccineToHospitalChildren(hospital.id, vaccine);

  return { vaccine, childrenSynced };
}

export async function listHospitalVaccines(ownerId: string): Promise<HospitalVaccine[]> {
  const hospital = await getHospitalByOwner(ownerId);

  const { data, error } = await supabase
    .from('hospital_vaccines')
    .select('*')
    .eq('hospital_id', hospital.id)
    .order('milestone_age_months', { ascending: true });

  if (error) {
    throw new AppError(500, 'Failed to list vaccines', error);
  }

  return (data ?? []) as HospitalVaccine[];
}

export async function updateHospitalVaccine(
  ownerId: string,
  vaccineId: string,
  input: Partial<CreateVaccineInput> & { isActive?: boolean },
): Promise<HospitalVaccine> {
  const hospital = await getHospitalByOwner(ownerId);
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.itemType !== undefined) updates.item_type = input.itemType;
  if (input.ageMinMonths !== undefined) updates.age_min_months = input.ageMinMonths;
  if (input.ageMaxMonths !== undefined) updates.age_max_months = input.ageMaxMonths;
  if (input.milestoneAgeMonths !== undefined) updates.milestone_age_months = input.milestoneAgeMonths;
  if (input.doseNumber !== undefined) updates.dose_number = input.doseNumber;
  if (input.purpose !== undefined) updates.purpose = input.purpose;
  if (input.details !== undefined) updates.details = input.details;
  if (input.reminderDays !== undefined) updates.reminder_days = input.reminderDays;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No fields provided to update');
  }

  const { data: current, error: fetchError } = await supabase
    .from('hospital_vaccines')
    .select('*')
    .eq('id', vaccineId)
    .eq('hospital_id', hospital.id)
    .single();

  if (fetchError || !current) {
    throw new AppError(404, 'Vaccine not found');
  }

  const ageError = validateVaccineAgeRange({
    ageMinMonths: (updates.age_min_months as number) ?? current.age_min_months,
    ageMaxMonths: (updates.age_max_months as number) ?? current.age_max_months,
    milestoneAgeMonths: (updates.milestone_age_months as number) ?? current.milestone_age_months,
  });
  if (ageError) {
    throw new AppError(400, ageError);
  }

  const { data, error } = await supabase
    .from('hospital_vaccines')
    .update(updates)
    .eq('id', vaccineId)
    .eq('hospital_id', hospital.id)
    .select('*')
    .single();

  if (error) {
    throw new AppError(500, 'Failed to update vaccine', error);
  }

  return data as HospitalVaccine;
}

export async function deleteHospitalVaccine(
  ownerId: string,
  vaccineId: string,
): Promise<void> {
  const hospital = await getHospitalByOwner(ownerId);

  const { error } = await supabase
    .from('hospital_vaccines')
    .update({ is_active: false })
    .eq('id', vaccineId)
    .eq('hospital_id', hospital.id);

  if (error) {
    throw new AppError(500, 'Failed to deactivate vaccine', error);
  }
}

export async function listRegisteredParents(ownerId: string): Promise<ParentWithChildren[]> {
  const hospital = await getHospitalByOwner(ownerId);

  const { data: registrations, error } = await supabase
    .from('parent_hospital_registrations')
    .select('*, parent:users(*)')
    .eq('hospital_id', hospital.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch registered parents', error);
  }

  const results: ParentWithChildren[] = [];

  for (const reg of registrations ?? []) {
    const parentRaw = reg.parent as unknown;
    const parent = (Array.isArray(parentRaw) ? parentRaw[0] : parentRaw) as User;

    const { data: children } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', parent.id)
      .eq('preferred_hospital_id', hospital.id);

    results.push({
      parent,
      children: (children ?? []) as Child[],
      registered_at: reg.created_at as string,
    });
  }

  return results;
}

export async function listHospitalChildren(ownerId: string): Promise<Array<Child & { age_months: number; parent: User }>> {
  const hospital = await getHospitalByOwner(ownerId);

  const { data, error } = await supabase
    .from('children')
    .select('*, parent:users(*)')
    .eq('preferred_hospital_id', hospital.id)
    .order('date_of_birth', { ascending: true });

  if (error) {
    throw new AppError(500, 'Failed to fetch hospital children', error);
  }

  return (data ?? []).map((row) => {
    const parentRaw = row.parent as unknown;
    const parent = (Array.isArray(parentRaw) ? parentRaw[0] : parentRaw) as User;
    const dob = parseDateString(row.date_of_birth as string);
    return {
      ...(row as Child),
      age_months: ageInMonths(dob),
      parent,
    };
  });
}

export async function manuallyAddParent(
  ownerId: string,
  input: ManualParentInput,
): Promise<User> {
  const hospital = await getHospitalByOwner(ownerId);

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', input.phone)
    .maybeSingle();

  let parent: User;

  if (existing) {
    parent = existing as User;
    if (parent.role === 'hospital') {
      throw new AppError(400, 'Phone number belongs to a hospital account');
    }
  } else {
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        phone: input.phone,
        name: input.name,
        email: input.email ?? null,
        country: input.country ?? null,
        role: 'parent',
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new AppError(500, 'Failed to create parent', error);
    }
    parent = created as User;
  }

  await ensureParentRegistered(parent.id, hospital.id, 'manual', ownerId);
  return parent;
}

export async function manuallyAddChild(
  ownerId: string,
  input: ManualChildInput,
): Promise<{ child: Child; schedule: Awaited<ReturnType<typeof createChild>>['schedule'] }> {
  const hospital = await getHospitalByOwner(ownerId);

  await ensureParentRegistered(input.parentId, hospital.id, 'manual', ownerId);

  const { child, schedule } = await createChild(input.parentId, {
    name: input.name,
    dateOfBirth: input.dateOfBirth,
    sex: input.sex,
    notes: input.notes,
    preferredHospitalId: hospital.id,
  });

  return { child, schedule };
}

export async function markScheduleCompleteByHospital(
  ownerId: string,
  scheduleId: string,
  cardPhotoUrl?: string,
): Promise<Awaited<ReturnType<typeof markTimelineItemComplete>>> {
  const hospital = await getHospitalByOwner(ownerId);

  const { data: schedule, error } = await supabase
    .from('child_schedules')
    .select('id, hospital_id')
    .eq('id', scheduleId)
    .single();

  if (error || !schedule) {
    throw new AppError(404, 'Schedule item not found');
  }

  if (schedule.hospital_id !== hospital.id) {
    throw new AppError(403, 'This vaccination does not belong to your hospital');
  }

  return markTimelineItemComplete(scheduleId, ownerId, {
    cardPhotoUrl,
    actorRole: 'hospital',
  });
}

export async function getOverdueChildren(ownerId: string) {
  const hospital = await getHospitalByOwner(ownerId);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('child_schedules')
    .select(`
      *,
      child:children!inner(id, name, date_of_birth, parent_id, parent:users(id, name, phone)),
      vaccine:hospital_vaccines!inner(name, purpose)
    `)
    .eq('hospital_id', hospital.id)
    .lt('due_date', today)
    .neq('status', 'completed')
    .order('due_date', { ascending: true });

  if (error) {
    throw new AppError(500, 'Failed to fetch overdue children', error);
  }

  return data ?? [];
}

export async function getHospitalStats(ownerId: string): Promise<HospitalDashboardStats> {
  const hospital = await getHospitalByOwner(ownerId);

  const [
    parentsResult,
    childrenResult,
    completedResult,
    overdueResult,
    dueSoonResult,
    pendingResult,
    vaccinesResult,
  ] = await Promise.all([
    supabase
      .from('parent_hospital_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id),
    supabase
      .from('children')
      .select('id', { count: 'exact', head: true })
      .eq('preferred_hospital_id', hospital.id),
    supabase
      .from('child_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id)
      .eq('status', 'completed'),
    supabase
      .from('child_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id)
      .eq('status', 'overdue'),
    supabase
      .from('child_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id)
      .eq('status', 'due_soon'),
    supabase
      .from('child_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id)
      .eq('status', 'pending'),
    supabase
      .from('hospital_vaccines')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospital.id)
      .eq('is_active', true),
  ]);

  const completed = completedResult.count ?? 0;
  const overdue = overdueResult.count ?? 0;
  const dueSoon = dueSoonResult.count ?? 0;
  const pending = pendingResult.count ?? 0;
  const totalNonPending = completed + overdue + dueSoon;
  const delinquencyDenominator = overdue + pending + dueSoon;

  return {
    total_registered_parents: parentsResult.count ?? 0,
    total_children: childrenResult.count ?? 0,
    schedules_completed: completed,
    schedules_overdue: overdue,
    schedules_due_soon: dueSoon,
    schedules_pending: pending,
    completion_rate: totalNonPending > 0 ? Math.round((completed / totalNonPending) * 10000) / 10000 : 0,
    delinquency_rate: delinquencyDenominator > 0 ? Math.round((overdue / delinquencyDenominator) * 10000) / 10000 : 0,
    active_vaccines: vaccinesResult.count ?? 0,
  };
}

export async function getHospitalIdForOwner(ownerId: string): Promise<string> {
  const hospital = await getHospitalByOwner(ownerId);
  return hospital.id;
}
