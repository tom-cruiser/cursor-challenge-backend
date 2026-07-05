import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { Hospital } from '../models/types';

export type HospitalWsEventType = 'hospital:created' | 'hospital:updated';

export interface HospitalWsEvent {
  type: HospitalWsEventType;
  hospital: Hospital;
}

const clients = new Set<WebSocket>();

export function attachHospitalWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/hospitals' });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcastHospitalEvent(
  type: HospitalWsEventType,
  hospital: Hospital,
): void {
  const message = JSON.stringify({ type, hospital } satisfies HospitalWsEvent);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
