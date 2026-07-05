import { NextFunction, Request, Response } from 'express';
import * as scheduleService from '../services/schedule.service';

export async function getTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timeline = await scheduleService.getTimelineForChild(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ timeline });
  } catch (err) {
    next(err);
  }
}

export async function getUpcomingVaccines(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const upcoming = await scheduleService.getUpcomingVaccinesForChild(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ upcoming });
  } catch (err) {
    next(err);
  }
}

export async function markComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const item = await scheduleService.markTimelineItemComplete(
      req.params.itemId as string,
      req.user!.id,
      { cardPhotoUrl: req.body.cardPhotoUrl, actorRole: 'parent' },
    );
    res.json({ item });
  } catch (err) {
    next(err);
  }
}
