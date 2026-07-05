import { env } from './env';

export interface SmsSendInput {
  to: string;
  message: string;
}

export interface SmsSendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Africa's Talking SMS sender.
 * Wire-up target for notification.service.ts SMS fallback.
 * Docs: https://developers.africastalking.com/docs/sms/overview
 */
export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  if (!env.africasTalkingConfigured) {
    return { sent: false, error: 'Africa\'s Talking is not configured' };
  }

  const url = 'https://api.africastalking.com/version1/messaging';
  const body = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to: input.to,
    message: input.message,
    from: env.AFRICASTALKING_SENDER_ID!,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey: env.AFRICASTALKING_API_KEY!,
      },
      body: body.toString(),
    });

    const data = (await response.json()) as {
      SMSMessageData?: { Recipients?: Array<{ status: string; messageId?: string }> };
    };

    if (!response.ok) {
      return { sent: false, error: `SMS API returned ${response.status}` };
    }

    const recipient = data.SMSMessageData?.Recipients?.[0];
    const sent = recipient?.status === 'Success';

    return {
      sent,
      messageId: recipient?.messageId,
      error: sent ? undefined : recipient?.status ?? 'Unknown SMS failure',
    };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'SMS request failed',
    };
  }
}
