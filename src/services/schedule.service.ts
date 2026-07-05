import { supabase } from '../config/database';
import {
  Child,
  ChildSchedule,
  ChildScheduleWithVaccine,
  HospitalVaccine,
  ParentHospitalRegistration,
  User,
} from '../models/types';
import { AppError } from '../utils/errors';
import { ageInMonths, calculateDueDate, parseDateString } from '../utils/dates';
import {
  compareTimelineItems,
  isUpcomingForChildAge,
  vaccineAppliesAtMilestone,
} from '../utils/vaccine-rules';

async function getHospitalVaccines(hospitalId: string): Promise<HospitalVaccine[]> {
  const { data, error } = await supabase
    .from('hospital_vaccines')
    .select('*')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true)
    .order('milestone_age_months', { ascending: true });

  if (error) {
    throw new AppError(500, 'Failed to fetch hospital vaccines', error);
  }

  return (data ?? []) as HospitalVaccine[];
}

export async function syncVaccineToHospitalChildren(
  hospitalId: string,
  vaccine: HospitalVaccine,
): Promise<number> {
  if (!vaccineAppliesAtMilestone(vaccine, vaccine.milestone_age_months)) {
    return 0;
  }

  const { data: children, error } = await supabase
    .from('children')
    .select('id, date_of_birth')
    .eq('preferred_hospital_id', hospitalId);

  if (error) {
    throw new AppError(500, 'Failed to fetch children for vaccine sync', error);
  }

  let synced = 0;

  for (const child of children ?? []) {
    const { data: existing } = await supabase
      .from('child_schedules')
      .select('id')
      .eq('child_id', child.id)
      .eq('hospital_vaccine_id', vaccine.id)
      .maybeSingle();

    if (existing) continue;

    const dob = parseDateString(child.date_of_birth as string);
    const dueDate = calculateDueDate(dob, vaccine.milestone_age_months);

    const { error: insertError } = await supabase.from('child_schedules').insert({
      child_id: child.id,
      hospital_id: hospitalId,
      hospital_vaccine_id: vaccine.id,
      due_date: dueDate,
      status: 'pending',
    });

    if (!insertError) synced++;
  }

  return synced;
}

export async function generateTimelineForChild(
  childId: string,
  hospitalId: string,
  dob: Date,
): Promise<ChildSchedule[]> {
  const vaccines = await getHospitalVaccines(hospitalId);

  if (vaccines.length === 0) {
    return [];
  }

  const applicable = vaccines.filter((v) =>
    vaccineAppliesAtMilestone(v, v.milestone_age_months),
  );

  if (applicable.length === 0) {
    return [];
  }

  const rows = applicable.map((vaccine) => ({
    child_id: childId,
    hospital_id: hospitalId,
    hospital_vaccine_id: vaccine.id,
    due_date: calculateDueDate(dob, vaccine.milestone_age_months),
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('child_schedules')
    .insert(rows)
    .select('*');

  if (error) {
    throw new AppError(500, 'Failed to generate child schedule timeline', error);
  }

  return (data ?? []) as ChildSchedule[];
}

async function regenerateTimelineForChild(child: Child): Promise<ChildSchedule[]> {
  if (!child.preferred_hospital_id) {
    return [];
  }

  await supabase
    .from('child_schedules')
    .delete()
    .eq('child_id', child.id)
    .neq('status', 'completed');

  const dob = parseDateString(child.date_of_birth);
  return generateTimelineForChild(child.id, child.preferred_hospital_id, dob);
}

export async function createChild(
  parentId: string,
  input: {
    name: string;
    dateOfBirth: string;
    sex?: 'male' | 'female' | 'other';
    notes?: string;
    preferredHospitalId?: string;
  },
): Promise<{ child: Child; schedule: ChildSchedule[] }> {
  if (input.preferredHospitalId) {
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id')
      .eq('id', input.preferredHospitalId)
      .single();

    if (hospitalError || !hospital) {
      throw new AppError(404, 'Preferred hospital not found');
    }

    await ensureParentRegistered(parentId, input.preferredHospitalId, 'self');
  }

  const { data: child, error } = await supabase
    .from('children')
    .insert({
      parent_id: parentId,
      name: input.name,
      date_of_birth: input.dateOfBirth,
      sex: input.sex ?? null,
      notes: input.notes ?? null,
      preferred_hospital_id: input.preferredHospitalId ?? null,
    })
    .select('*')
    .single();

  if (error || !child) {
    throw new AppError(500, 'Failed to create child profile', error);
  }

  let schedule: ChildSchedule[] = [];
  if (input.preferredHospitalId) {
    const dob = parseDateString(input.dateOfBirth);
    schedule = await generateTimelineForChild(child.id, input.preferredHospitalId, dob);
  }

  return { child: child as Child, schedule };
}

export async function ensureParentRegistered(
  parentId: string,
  hospitalId: string,
  source: 'self' | 'manual',
  registeredBy?: string,
): Promise<ParentHospitalRegistration> {
  const { data: existing } = await supabase
    .from('parent_hospital_registrations')
    .select('*')
    .eq('parent_id', parentId)
    .eq('hospital_id', hospitalId)
    .maybeSingle();

  if (existing) {
    return existing as ParentHospitalRegistration;
  }

  const { data, error } = await supabase
    .from('parent_hospital_registrations')
    .insert({
      parent_id: parentId,
      hospital_id: hospitalId,
      source,
      registered_by: registeredBy ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to register parent to hospital', error);
  }

  return data as ParentHospitalRegistration;
}

async function verifyChildOwnership(childId: string, parentId: string): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .single();

  if (error || !data) {
    throw new AppError(404, 'Child not found or access denied');
  }

  return data as Child;
}

export async function getChildrenForParent(parentId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch children', error);
  }

  return (data ?? []) as Child[];
}

export async function getTimelineForChild(
  childId: string,
  parentId: string,
): Promise<ChildScheduleWithVaccine[]> {
  await verifyChildOwnership(childId, parentId);

  const { data, error } = await supabase
    .from('child_schedules')
    .select('*, vaccine:hospital_vaccines(*)')
    .eq('child_id', childId);

  if (error) {
    throw new AppError(500, 'Failed to fetch child timeline', error);
  }

  const items = (data ?? []) as ChildScheduleWithVaccine[];

  return items.sort(compareTimelineItems);
}

export async function getUpcomingVaccinesForChild(
  childId: string,
  parentId: string,
): Promise<ChildScheduleWithVaccine[]> {
  const child = await verifyChildOwnership(childId, parentId);

  if (!child.preferred_hospital_id) {
    throw new AppError(400, 'Child has no hospital selected. Choose a hospital first.');
  }

  const dob = parseDateString(child.date_of_birth);
  const currentAge = ageInMonths(dob);

  const timeline = await getTimelineForChild(childId, parentId);

  return timeline.filter((item) => {
    if (!item.vaccine) return item.status !== 'completed';
    return isUpcomingForChildAge(item.vaccine, currentAge, item.status);
  });
}

export async function markTimelineItemComplete(
  itemId: string,
  actorId: string,
  options: { cardPhotoUrl?: string; actorRole?: 'parent' | 'hospital' } = {},
): Promise<ChildSchedule> {
  const { data: item, error: fetchError } = await supabase
    .from('child_schedules')
    .select('*, child:children(parent_id, preferred_hospital_id)')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError(404, 'Timeline item not found');
  }

  const childRaw = item.child as unknown;
  const child = (Array.isArray(childRaw) ? childRaw[0] : childRaw) as {
    parent_id: string;
    preferred_hospital_id: string | null;
  };

  if (options.actorRole === 'parent' && child.parent_id !== actorId) {
    throw new AppError(403, 'Access denied to this timeline item');
  }

  const { data: updated, error: updateError } = await supabase
    .from('child_schedules')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: actorId,
      card_photo_url: options.cardPhotoUrl ?? null,
    })
    .eq('id', itemId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new AppError(500, 'Failed to mark timeline item as completed', updateError);
  }

  return updated as ChildSchedule;
}

export async function setPreferredHospital(
  childId: string,
  parentId: string,
  hospitalId: string,
): Promise<{ child: Child; schedule: ChildSchedule[] }> {
  await verifyChildOwnership(childId, parentId);

  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .select('id')
    .eq('id', hospitalId)
    .single();

  if (hospitalError || !hospital) {
    throw new AppError(404, 'Hospital not found');
  }

  await ensureParentRegistered(parentId, hospitalId, 'self');

  const { data: updated, error } = await supabase
    .from('children')
    .update({ preferred_hospital_id: hospitalId })
    .eq('id', childId)
    .select('*')
    .single();

  if (error || !updated) {
    throw new AppError(500, 'Failed to update preferred hospital', error);
  }

  const schedule = await regenerateTimelineForChild(updated as Child);
  return { child: updated as Child, schedule };
}

export interface ReminderScheduleRow {
  schedule_id: string;
  child_id: string;
  child_name: string;
  parent_id: string;
  item_name: string;
  due_date: string;
  status: string;
  reminder_days: number[];
}

export async function getSchedulesDueOn(date: string): Promise<ReminderScheduleRow[]> {
  const { data, error } = await supabase
    .from('child_schedules')
    .select(`
      id,
      due_date,
      status,
      child:children!inner(id, name, parent_id),
      vaccine:hospital_vaccines!inner(name, reminder_days)
    `)
    .eq('due_date', date)
    .neq('status', 'completed');

  if (error) {
    throw new AppError(500, 'Failed to fetch schedules due on date', error);
  }

  return (data ?? []).map((row) => mapReminderRow(row as Record<string, unknown>));
}

function mapReminderRow(row: Record<string, unknown>): ReminderScheduleRow {
  const childRaw = row.child as unknown;
  const vaccineRaw = row.vaccine as unknown;
  const child = (Array.isArray(childRaw) ? childRaw[0] : childRaw) as {
    id: string;
    name: string;
    parent_id: string;
  };
  const vaccine = (Array.isArray(vaccineRaw) ? vaccineRaw[0] : vaccineRaw) as {
    name: string;
    reminder_days: number[];
  };
  return {
    schedule_id: row.id as string,
    child_id: child.id,
    child_name: child.name,
    parent_id: child.parent_id,
    item_name: vaccine.name,
    due_date: row.due_date as string,
    status: row.status as string,
    reminder_days: vaccine.reminder_days ?? [3, 1],
  };
}

export async function getOverdueSchedules(): Promise<ReminderScheduleRow[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('child_schedules')
    .select(`
      id,
      due_date,
      status,
      child:children!inner(id, name, parent_id),
      vaccine:hospital_vaccines!inner(name, reminder_days)
    `)
    .lt('due_date', today)
    .neq('status', 'completed');

  if (error) {
    throw new AppError(500, 'Failed to fetch overdue schedules', error);
  }

  return (data ?? []).map((row) => mapReminderRow(row as Record<string, unknown>));
}

export async function getSchedulesForReminderOffset(daysAhead: number): Promise<ReminderScheduleRow[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const dateStr = targetDate.toISOString().split('T')[0];

  const allDue = await getSchedulesDueOn(dateStr);
  return allDue.filter((row) => row.reminder_days.includes(daysAhead));
}

export async function markOverdueSchedules(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('child_schedules')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .neq('status', 'completed')
    .select('id');

  if (error) {
    throw new AppError(500, 'Failed to mark overdue schedules', error);
  }

  return data?.length ?? 0;
}

export async function markDueSoonSchedules(): Promise<number> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const todayStr = today.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('child_schedules')
    .update({ status: 'due_soon' })
    .gte('due_date', todayStr)
    .lte('due_date', endStr)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    throw new AppError(500, 'Failed to mark due-soon schedules', error);
  }

  return data?.length ?? 0;
}
