import { Router } from 'express';
import { z } from 'zod';
import * as aiController from '../controllers/ai.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const streamMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

router.use(authenticateToken, requireRole('parent'));

router.post('/sessions', aiController.createSession);

router.get(
  '/sessions/:sessionId/messages',
  validate(sessionIdParamsSchema, 'params'),
  aiController.getSessionMessages,
);

router.post(
  '/sessions/:sessionId/stream',
  validate(sessionIdParamsSchema, 'params'),
  validate(streamMessageSchema),
  aiController.streamSessionMessage,
);

export default router;
