import cron from 'node-cron';
import { env } from '../config/env';
import { sendVaccinationReminder } from '../services/notification.service';
import {
  getOverdueSchedules,
  getSchedulesForReminderOffset,
  markDueSoonSchedules,
  markOverdueSchedules,
  ReminderScheduleRow,
} from '../services/schedule.service';
import { formatDateForDisplay } from '../utils/dates';

type ReminderType = 'upcoming' | 'overdue';

interface ParentNotification {
  parentId: string;
  title: string;
  body: string;
}

function buildNotification(
  rows: ReminderScheduleRow[],
  type: ReminderType,
  daysAhead?: number,
): ParentNotification[] {
  const grouped = new Map<string, ReminderScheduleRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.parent_id) ?? [];
    existing.push(row);
    grouped.set(row.parent_id, existing);
  }

  const notifications: ParentNotification[] = [];

  for (const [parentId, items] of grouped) {
    const lines = items.map((item) => {
      const dueFormatted = formatDateForDisplay(item.due_date);
      if (type === 'overdue') {
        return `${item.child_name}: ${item.item_name} was due ${dueFormatted}`;
      }
      if (daysAhead === 1) {
        return `${item.child_name}: ${item.item_name} due tomorrow`;
      }
      return `${item.child_name}: ${item.item_name} on ${dueFormatted}`;
    });

    let title: string;
    if (type === 'overdue') {
      title = 'Overdue Vaccination Alert';
    } else if (daysAhead === 1) {
      title = 'Vaccination Due Tomorrow';
    } else {
      title = 'Upcoming Vaccination Reminder';
    }

    notifications.push({ parentId, title, body: lines.join('\n') });
  }

  return notifications;
}

export async function processDailyReminders(): Promise<void> {
  console.log(`[reminder.cron] Starting daily reminder processing at ${new Date().toISOString()}`);

  const overdueMarked = await markOverdueSchedules();
  const dueSoonMarked = await markDueSoonSchedules();

  console.log(`[reminder.cron] Marked ${overdueMarked} overdue, ${dueSoonMarked} due-soon`);

  const [threeDayRows, oneDayRows, overdueRows] = await Promise.all([
    getSchedulesForReminderOffset(3),
    getSchedulesForReminderOffset(1),
    getOverdueSchedules(),
  ]);

  const allNotifications = [
    ...buildNotification(threeDayRows, 'upcoming', 3),
    ...buildNotification(oneDayRows, 'upcoming', 1),
    ...buildNotification(overdueRows, 'overdue'),
  ];

  const deduped = new Map<string, ParentNotification>();
  for (const notification of allNotifications) {
    const existing = deduped.get(notification.parentId);
    if (existing) {
      existing.body += `\n${notification.body}`;
    } else {
      deduped.set(notification.parentId, { ...notification });
    }
  }

  let sent = 0;
  let failed = 0;

  for (const notification of deduped.values()) {
    try {
      const result = await sendVaccinationReminder({
        userId: notification.parentId,
        title: notification.title,
        body: notification.body,
      });
      console.log(
        `[reminder.cron] Sent to ${notification.parentId}: FCM=${result.fcmSent}, failed=${result.fcmFailed}, resend=${result.resendSent}, sms=${result.smsSent}`,
      );
      sent++;
    } catch (err) {
      console.error(`[reminder.cron] Failed for parent ${notification.parentId}:`, err);
      failed++;
    }
  }

  console.log(
    `[reminder.cron] Completed: ${sent} parents notified, ${failed} failures, ${deduped.size} total`,
  );
}

export function startReminderCron(): void {
  cron.schedule(
    '0 6 * * *',
    () => {
      processDailyReminders().catch((err) => {
        console.error('[reminder.cron] Unhandled error in daily job:', err);
      });
    },
    { timezone: env.CRON_TZ },
  );

  console.log(`[reminder.cron] Scheduled daily at 6:00 AM (${env.CRON_TZ})`);
}
