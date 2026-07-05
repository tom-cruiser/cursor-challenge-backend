import { supabase } from '../config/database';
import { Hospital, NearbyHospital, OperatingHours } from '../models/types';
import { AppError } from '../utils/errors';
import { haversineDistanceKm } from '../utils/haversine';

export interface NearbySearchOptions {
  limit?: number;
  verifiedOnly?: boolean;
}

export async function findNearbyHospitals(
  lat: number,
  lng: number,
  options: NearbySearchOptions = {},
): Promise<NearbyHospital[]> {
  const limit = options.limit ?? 20;
  const verifiedOnly = options.verifiedOnly ?? true;

  const latMin = lat - 0.5;
  const latMax = lat + 0.5;
  const lngMin = lng - 0.5;
  const lngMax = lng + 0.5;

  let query = supabase
    .from('hospitals')
    .select('*')
    .gte('latitude', latMin)
    .lte('latitude', latMax)
    .gte('longitude', lngMin)
    .lte('longitude', lngMax);

  if (verifiedOnly) {
    query = query.eq('is_verified', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(500, 'Failed to search nearby hospitals', error);
  }

  const hospitals = (data ?? []) as Hospital[];

  const withDistance: NearbyHospital[] = hospitals.map((h) => ({
    ...h,
    distance_km: haversineDistanceKm(lat, lng, h.latitude, h.longitude),
    vaccination_days: extractVaccinationDays(h.operating_hours),
  }));

  return withDistance
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}

function extractVaccinationDays(hours: OperatingHours): string[] | null {
  const days: string[] = [];
  for (const [day, schedule] of Object.entries(hours)) {
    if (schedule.vaccination) {
      days.push(day);
    }
  }
  return days.length > 0 ? days : null;
}

export async function getHospitalById(hospitalId: string): Promise<Hospital> {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('id', hospitalId)
    .single();

  if (error || !data) {
    throw new AppError(404, 'Hospital not found');
  }

  return data as Hospital;
}
