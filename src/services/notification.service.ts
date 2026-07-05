import { sendSms } from '../config/africastalking';
import { env } from '../config/env';
import { getMessaging } from '../config/firebase';
import { resend, resendFromEmail } from '../config/resend';
import { supabase } from '../config/database';
import { AppError } from '../utils/errors';

export interface SendReminderInput {
  userId: string;
  title: string;
  body: string;
}

export interface SendReminderResult {
  fcmSent: number;
  fcmFailed: number;
  resendSent: boolean;
  smsSent: boolean;
}

const FCM_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function sendVaccinationReminder(
  input: SendReminderInput,
): Promise<SendReminderResult> {
  const { userId, title, body } = input;

  const { data: tokens, error: tokenError } = await supabase
    .from('fcm_tokens')
    .select('id, token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (tokenError) {
    throw new AppError(500, 'Failed to fetch FCM tokens', tokenError);
  }

  let fcmSent = 0;
  let fcmFailed = 0;
  let hadMessagingFailure = false;

  const messaging = getMessaging();

  for (const row of tokens ?? []) {
    try {
      await messaging.send({
        token: row.token,
        notification: { title, body },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icon.png',
          },
        },
      });

      fcmSent++;
      await supabase
        .from('fcm_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id);
    } catch (err: unknown) {
      fcmFailed++;
      hadMessagingFailure = true;

      const errorCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';

      if (FCM_TOKEN_ERRORS.has(errorCode)) {
        await supabase
          .from('fcm_tokens')
          .update({ is_active: false })
          .eq('id', row.id);
      }
    }
  }

  const needsFallback = hadMessagingFailure || (tokens ?? []).length === 0;
  let resendSent = false;
  let smsSent = false;

  if (needsFallback) {
    resendSent = await attemptResendFallback(userId, title, body);

    if (!resendSent) {
      smsSent = await attemptSmsFallback(userId, title, body);
    }
  }

  return { fcmSent, fcmFailed, resendSent, smsSent };
}

async function attemptResendFallback(
  userId: string,
  title: string,
  body: string,
): Promise<boolean> {
  const { data: user, error } = await supabase
    .from('users')
    .select('email, phone')
    .eq('id', userId)
    .single();

  if (error || !user?.email) {
    return false;
  }

  try {
    const { error: sendError } = await resend.emails.send({
      from: resendFromEmail,
      to: user.email,
      subject: title,
      html: `
        <h2>${title}</h2>
        <p>${body}</p>
        <p><small>Sent as a fallback notification for phone ${user.phone}</small></p>
      `,
    });

    if (sendError) {
      console.error('Resend fallback failed:', sendError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Resend fallback error:', err);
    return false;
  }
}

async function attemptSmsFallback(
  userId: string,
  title: string,
  body: string,
): Promise<boolean> {
  if (!env.NOTIFICATION_SMS_FALLBACK || !env.africasTalkingConfigured) {
    return false;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('phone')
    .eq('id', userId)
    .single();

  if (error || !user?.phone) {
    console.warn(`SMS fallback skipped for user ${userId}: no phone on file`);
    return false;
  }

  const message = `${title}\n${body}`;
  const result = await sendSms({ to: user.phone, message });

  if (!result.sent) {
    console.error(`SMS fallback failed for user ${userId}:`, result.error);
    return false;
  }

  return true;
}

export async function registerFcmToken(
  userId: string,
  token: string,
): Promise<void> {
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
