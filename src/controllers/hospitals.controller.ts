import { NextFunction, Request, Response } from 'express';
import * as hospitalService from '../services/hospital.service';

export async function getNearbyHospitals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    const hospitals = await hospitalService.findNearbyHospitals(lat, lng, {
      limit: req.query.limit ? Number(req.query.limit) : 20,
      verifiedOnly: req.query.verifiedOnly === 'true',
    });

    res.json({ hospitals });
  } catch (err) {
    next(err);
  }
}
