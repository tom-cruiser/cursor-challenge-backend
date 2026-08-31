import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { startReminderCron } from './tasks/reminder.cron';
import { attachHospitalWebSocket } from './ws/hospitals';

const app = createApp();
const server = http.createServer(app);

const wss = attachHospitalWebSocket(server);

let cronTask: ReturnType<typeof startReminderCron> | undefined;

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  console.log(`Hospital WebSocket: ws://localhost:${env.PORT}/ws/hospitals`);
  cronTask = startReminderCron();
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] Received ${signal}, shutting down gracefully...`);

  cronTask?.stop();

  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down');
  }
  wss.close();

  // Stop accepting new connections and let in-flight requests finish.
  server.close((err) => {
    if (err) {
      console.error('[server] Error during shutdown:', err);
      process.exit(1);
    }
    console.log('[server] Shutdown complete.');
    process.exit(0);
  });

  // Safety net in case some connection never drains (e.g. an open SSE stream).
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout — some connections did not close.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety net: log and exit rather than continuing in an
// undefined state (an unhandled rejection would otherwise silently leave
// requests hanging, or crash later with a confusing, unrelated error).
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException');
});
