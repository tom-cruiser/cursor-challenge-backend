export type UserRole = 'parent' | 'hospital';
export type CatalogItemType = 'vaccine' | 'checkup';
export type ScheduleStatus = 'pending' | 'due_soon' | 'completed' | 'overdue';
export type ChildSex = 'male' | 'female' | 'other';
export type RegistrationSource = 'self' | 'manual';

export interface User {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  country: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Hospital {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  help_phone: string | null;
  country: string | null;
  services: string[];
  operating_hours: OperatingHours;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DayHours {
  open: string | null;
  close: string | null;
  vaccination: boolean;
}

export type OperatingHours = Record<string, DayHours>;

export interface HospitalVaccine {
  id: string;
  hospital_id: string;
  name: string;
  item_type: CatalogItemType;
  age_min_months: number;
  age_max_months: number;
  milestone_age_months: number;
  dose_number: number;
  purpose: string | null;
  details: string | null;
  reminder_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParentHospitalRegistration {
  id: string;
  parent_id: string;
  hospital_id: string;
  source: RegistrationSource;
  registered_by: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  date_of_birth: string;
  sex: ChildSex | null;
  notes: string | null;
  preferred_hospital_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildSchedule {
  id: string;
  child_id: string;
  hospital_id: string;
  hospital_vaccine_id: string;
  due_date: string;
  status: ScheduleStatus;
  completed_at: string | null;
  completed_by: string | null;
  card_photo_url: string | null;
  created_at: string;
}

export interface ChildScheduleWithVaccine extends ChildSchedule {
  vaccine: HospitalVaccine;
}

export interface ChildWithAge extends Child {
  age_months: number;
}

export interface FcmToken {
  id: string;
  user_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface NearbyHospital extends Hospital {
  distance_km: number;
  vaccination_days: string[] | null;
}

export interface HospitalDashboardStats {
  total_registered_parents: number;
  total_children: number;
  schedules_completed: number;
  schedules_overdue: number;
  schedules_due_soon: number;
  schedules_pending: number;
  completion_rate: number;
  delinquency_rate: number;
  active_vaccines: number;
}

export interface ParentWithChildren {
  parent: User;
  children: Child[];
  registered_at: string;
}

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  name: string | null;
  hospitalId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
