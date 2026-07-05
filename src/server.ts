import { createApp } from './app';
import { env } from './config/env';
import { startReminderCron } from './tasks/reminder.cron';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  startReminderCron();
});
