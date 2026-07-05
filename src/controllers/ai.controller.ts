import { NextFunction, Request, Response } from 'express';
import * as chatService from '../services/ai/chat.service';
import { getUserGroundingContext } from '../services/ai/grounding.service';
import { streamOpenRouterCompletion } from '../services/ai/orchestrator.service';
import {
  isEmergencyPrompt,
  SAFETY_DISCLAIMER_RESPONSE,
} from '../services/ai/safety.service';
import { AppError } from '../utils/errors';
import { endSseResponse, initSseResponse, writeSseEvent } from '../utils/sse';

export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await chatService.createChatSession(req.user!.id);
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

export async function getSessionMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const messages = await chatService.listChatMessages(sessionId, req.user!.id);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function streamSessionMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.params.sessionId as string;
  const userId = req.user!.id;
  const userPrompt = req.body.message as string;

  try {
    await chatService.getChatSessionForUser(sessionId, userId);

    const history = await chatService.listChatMessages(sessionId, userId);

    await chatService.insertChatMessage({
      sessionId,
      role: 'user',
      content: userPrompt,
    });

    initSseResponse(res);

    if (isEmergencyPrompt(userPrompt)) {
      const flaggedMessage = await chatService.insertChatMessage({
        sessionId,
        role: 'assistant',
        content: SAFETY_DISCLAIMER_RESPONSE,
        isFlagged: true,
      });

      writeSseEvent(res, {
        type: 'flagged',
        content: SAFETY_DISCLAIMER_RESPONSE,
        messageId: flaggedMessage.id,
      });
      endSseResponse(res);
      return;
    }

    const [groundingJson] = await Promise.all([getUserGroundingContext(userId)]);

    const fullAssistantText = await streamOpenRouterCompletion({
      userPrompt,
      groundingJson,
      history,
      onToken: (token) => {
        writeSseEvent(res, { type: 'token', content: token });
      },
    });

    const assistantMessage = await chatService.insertChatMessage({
      sessionId,
      role: 'assistant',
      content: fullAssistantText,
      isFlagged: false,
    });

    writeSseEvent(res, {
      type: 'done',
      content: fullAssistantText,
      messageId: assistantMessage.id,
    });
    endSseResponse(res);
  } catch (err) {
    if (res.headersSent) {
      const message =
        err instanceof AppError ? err.message : 'An unexpected error occurred during streaming';
      writeSseEvent(res, { type: 'error', message });
      endSseResponse(res);
      return;
    }

    next(err);
  }
}
