import { NextFunction, Request, Response } from 'express';
import * as scheduleService from '../services/schedule.service';

export async function createChild(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await scheduleService.createChild(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function setPreferredHospital(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await scheduleService.setPreferredHospital(
      req.params.id as string,
      req.user!.id,
      req.body.hospitalId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
