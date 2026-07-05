import { Response } from 'express';

export interface SseEventPayload {
  type: 'token' | 'done' | 'flagged' | 'error';
  content?: string;
  messageId?: string;
  message?: string;
}

export function initSseResponse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

export function writeSseEvent(res: Response, payload: SseEventPayload): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function endSseResponse(res: Response): void {
  res.write('data: [DONE]\n\n');
  res.end();
}
