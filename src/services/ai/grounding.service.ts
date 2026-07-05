import { supabase } from '../../config/database';
import { ageInMonths, parseDateString } from '../../utils/dates';
import { AppError } from '../../utils/errors';

interface GroundingChild {
  id: string;
  name: string;
  ageMonths: number;
  sex: string | null;
  preferredHospitalId: string | null;
}

interface GroundingScheduleItem {
  childId: string;
  childName: string;
  vaccineName: string;
  doseNumber: number;
  purpose: string | null;
  dueDate: string;
  status: string;
  hospitalName: string;
}

interface GroundingHospital {
  id: string;
  name: string;
  address: string | null;
  services: string[];
  isVerified: boolean;
  helpPhone: string | null;
}

interface GroundingPayload {
  children: GroundingChild[];
  upcomingSchedules: GroundingScheduleItem[];
  preferredHospitals: GroundingHospital[];
}

export async function getUserGroundingContext(userId: string): Promise<string> {
  const childrenPromise = supabase
    .from('children')
    .select('id, name, date_of_birth, sex, preferred_hospital_id')
    .eq('parent_id', userId);

  const [childrenResult] = await Promise.all([childrenPromise]);

  if (childrenResult.error) {
    throw new AppError(500, 'Failed to load children for AI grounding', childrenResult.error);
  }

  const childrenRows = childrenResult.data ?? [];
  const childIds = childrenRows.map((child) => child.id);
  const preferredHospitalIds = [
    ...new Set(
      childrenRows
        .map((child) => child.preferred_hospital_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const schedulesPromise =
    childIds.length > 0
      ? supabase
          .from('child_schedules')
          .select(
            `
            id,
            child_id,
            due_date,
            status,
            children!inner(id, name),
            hospital_vaccines(name, dose_number, purpose),
            hospitals(name)
          `,
          )
          .in('child_id', childIds)
          .in('status', ['pending', 'due_soon', 'overdue'])
          .order('due_date', { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const hospitalsPromise =
    preferredHospitalIds.length > 0
      ? supabase
          .from('hospitals')
          .select('id, name, address, services, is_verified, help_phone')
          .in('id', preferredHospitalIds)
      : Promise.resolve({ data: [], error: null });

  const [schedulesResult, hospitalsResult] = await Promise.all([
    schedulesPromise,
    hospitalsPromise,
  ]);

  if (schedulesResult.error) {
    throw new AppError(500, 'Failed to load schedules for AI grounding', schedulesResult.error);
  }

  if (hospitalsResult.error) {
    throw new AppError(500, 'Failed to load hospitals for AI grounding', hospitalsResult.error);
  }

  const children: GroundingChild[] = childrenRows.map((child) => ({
    id: child.id,
    name: child.name,
    ageMonths: ageInMonths(parseDateString(child.date_of_birth)),
    sex: child.sex,
    preferredHospitalId: child.preferred_hospital_id,
  }));

  const upcomingSchedules: GroundingScheduleItem[] = (schedulesResult.data ?? []).map((row) => {
    const childJoin = row.children as unknown;
    const vaccineJoin = row.hospital_vaccines as unknown;
    const hospitalJoin = row.hospitals as unknown;

    const childRecord = (Array.isArray(childJoin) ? childJoin[0] : childJoin) as {
      id: string;
      name: string;
    };
    const vaccineRecord = (Array.isArray(vaccineJoin) ? vaccineJoin[0] : vaccineJoin) as {
      name: string;
      dose_number: number;
      purpose: string | null;
    };
    const hospitalRecord = (Array.isArray(hospitalJoin) ? hospitalJoin[0] : hospitalJoin) as {
      name: string;
    };

    return {
      childId: childRecord.id,
      childName: childRecord.name,
      vaccineName: vaccineRecord.name,
      doseNumber: vaccineRecord.dose_number,
      purpose: vaccineRecord.purpose,
      dueDate: row.due_date,
      status: row.status,
      hospitalName: hospitalRecord.name,
    };
  });

  const preferredHospitals: GroundingHospital[] = (hospitalsResult.data ?? []).map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    address: hospital.address,
    services: hospital.services ?? [],
    isVerified: hospital.is_verified,
    helpPhone: hospital.help_phone,
  }));

  const payload: GroundingPayload = {
    children,
    upcomingSchedules,
    preferredHospitals,
  };

  return JSON.stringify(payload);
}
