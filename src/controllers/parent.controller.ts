import { NextFunction, Request, Response } from 'express';
import * as parentService from '../services/parent.service';
import * as scheduleService from '../services/schedule.service';

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await parentService.getParentProfile(req.user!.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await parentService.updateParentProfile(req.user!.id, req.body);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function listChildren(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const children = await scheduleService.getChildrenForParent(req.user!.id);
    res.json({ children });
  } catch (err) {
    next(err);
  }
}

export async function registerToHospital(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await parentService.registerParentToHospital(
      req.user!.id,
      req.params.id as string,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function registerFcmToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await parentService.registerFcmTokenForUser(req.user!.id, req.body.token);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
