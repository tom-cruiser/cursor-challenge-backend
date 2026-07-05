import { NextFunction, Request, Response } from 'express';
import * as hospitalAdminService from '../services/hospital-admin.service';

export async function signup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await hospitalAdminService.signupHospital(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const hospital = await hospitalAdminService.getHospitalProfile(req.user!.id);
    res.json({ hospital });
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
    const hospital = await hospitalAdminService.updateHospitalProfile(req.user!.id, req.body);
    res.json({ hospital });
  } catch (err) {
    next(err);
  }
}

export async function createVaccine(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await hospitalAdminService.createHospitalVaccine(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listVaccines(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vaccines = await hospitalAdminService.listHospitalVaccines(req.user!.id);
    res.json({ vaccines });
  } catch (err) {
    next(err);
  }
}

export async function updateVaccine(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vaccine = await hospitalAdminService.updateHospitalVaccine(
      req.user!.id,
      req.params.id as string,
      req.body,
    );
    res.json({ vaccine });
  } catch (err) {
    next(err);
  }
}

export async function deleteVaccine(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await hospitalAdminService.deleteHospitalVaccine(
      req.user!.id,
      req.params.id as string,
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listParents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parents = await hospitalAdminService.listRegisteredParents(req.user!.id);
    res.json({ parents });
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
    const children = await hospitalAdminService.listHospitalChildren(req.user!.id);
    res.json({ children });
  } catch (err) {
    next(err);
  }
}

export async function addParent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parent = await hospitalAdminService.manuallyAddParent(req.user!.id, req.body);
    res.status(201).json({ parent });
  } catch (err) {
    next(err);
  }
}

export async function addChild(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await hospitalAdminService.manuallyAddChild(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function markScheduleComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const item = await hospitalAdminService.markScheduleCompleteByHospital(
      req.user!.id,
      req.params.id as string,
      req.body.cardPhotoUrl,
    );
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function getOverdue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overdue = await hospitalAdminService.getOverdueChildren(req.user!.id);
    res.json({ overdue });
  } catch (err) {
    next(err);
  }
}

export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await hospitalAdminService.getHospitalStats(req.user!.id);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
}
