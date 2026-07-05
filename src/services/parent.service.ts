import { supabase } from '../config/database';
import { User } from '../models/types';
import { AppError } from '../utils/errors';
import { ensureParentRegistered } from './schedule.service';

export interface UpdateParentProfileInput {
  name: string;
  email?: string;
  country: string;
}

export async function updateParentProfile(
  parentId: string,
  input: UpdateParentProfileInput,
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      name: input.name,
      email: input.email ?? null,
      country: input.country,
    })
    .eq('id', parentId)
    .eq('role', 'parent')
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to update parent profile', error);
  }

  return data as User;
}

export async function getParentProfile(parentId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', parentId)
    .eq('role', 'parent')
    .single();

  if (error || !data) {
    throw new AppError(404, 'Parent profile not found');
  }

  return data as User;
}

export async function registerParentToHospital(
  parentId: string,
  hospitalId: string,
): Promise<{ registration: Awaited<ReturnType<typeof ensureParentRegistered>> }> {
  const { data: hospital, error } = await supabase
    .from('hospitals')
    .select('id')
    .eq('id', hospitalId)
    .single();

  if (error || !hospital) {
    throw new AppError(404, 'Hospital not found');
  }

  const registration = await ensureParentRegistered(parentId, hospitalId, 'self');
  return { registration };
}

export async function registerFcmTokenForUser(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('fcm_tokens').upsert(
    {
      user_id: userId,
      token,
      is_active: true,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  if (error) {
    throw new AppError(500, 'Failed to register FCM token', error);
  }
}
