import { Router } from 'express';
import { z } from 'zod';
import * as childrenController from '../controllers/children.controller';
import * as timelineController from '../controllers/timeline.controller';
import * as hospitalsController from '../controllers/hospitals.controller';
import * as parentController from '../controllers/parent.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const uuidSchema = z.string().uuid();

const profileSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  country: z.string().min(1).max(100),
});

const createChildSchema = z.object({
  name: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  sex: z.enum(['male', 'female', 'other']).optional(),
  notes: z.string().max(1000).optional(),
  preferredHospitalId: z.string().uuid().optional(),
});

const markCompleteSchema = z.object({
  cardPhotoUrl: z.string().url().optional(),
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  verifiedOnly: z.enum(['true', 'false']).optional(),
});

const preferredHospitalSchema = z.object({
  hospitalId: z.string().uuid(),
});

const fcmTokenSchema = z.object({
  token: z.string().min(1),
});

const childIdParamsSchema = z.object({ id: uuidSchema });
const hospitalIdParamsSchema = z.object({ id: uuidSchema });
const timelineItemParamsSchema = z.object({ itemId: uuidSchema });

router.use(authenticateToken, requireRole('parent'));

router.get('/profile', parentController.getProfile);
router.patch('/profile', validate(profileSchema), parentController.updateProfile);

router.get('/children', parentController.listChildren);
router.post('/children', validate(createChildSchema), childrenController.createChild);

router.get(
  '/children/:id/timeline',
  validate(childIdParamsSchema, 'params'),
  timelineController.getTimeline,
);

router.get(
  '/children/:id/upcoming-vaccines',
  validate(childIdParamsSchema, 'params'),
  timelineController.getUpcomingVaccines,
);

router.patch(
  '/timeline/:itemId',
  validate(timelineItemParamsSchema, 'params'),
  validate(markCompleteSchema),
  timelineController.markComplete,
);

router.get(
  '/hospitals/nearby',
  validate(nearbyQuerySchema, 'query'),
  hospitalsController.getNearbyHospitals,
);

router.post(
  '/hospitals/:id/register',
  validate(hospitalIdParamsSchema, 'params'),
  parentController.registerToHospital,
);

router.patch(
  '/children/:id/preferred-hospital',
  validate(childIdParamsSchema, 'params'),
  validate(preferredHospitalSchema),
  childrenController.setPreferredHospital,
);

router.post('/fcm-token', validate(fcmTokenSchema), parentController.registerFcmToken);

export default router;
