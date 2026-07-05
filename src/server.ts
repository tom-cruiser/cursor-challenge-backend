import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { startReminderCron } from './tasks/reminder.cron';
import { attachHospitalWebSocket } from './ws/hospitals';

const app = createApp();
const server = http.createServer(app);

attachHospitalWebSocket(server);

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  console.log(`Hospital WebSocket: ws://localhost:${env.PORT}/ws/hospitals`);
  startReminderCron();
});
