import { Router } from 'express';
import { z } from 'zod';
import * as hospitalAdminController from '../controllers/hospital-admin.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const dayHoursSchema = z.object({
  open: z.string().nullable(),
  close: z.string().nullable(),
  vaccination: z.boolean(),
});

const operatingHoursSchema = z.record(dayHoursSchema);

const hospitalSignupSchema = z.object({
  name: z.string().min(1).max(300),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  helpPhone: z.string().max(30).optional(),
  country: z.string().max(100).optional(),
  services: z.array(z.string()).optional(),
  operatingHours: operatingHoursSchema.optional(),
});

const updateHospitalSchema = hospitalSignupSchema.partial();

const vaccineBaseSchema = z.object({
  name: z.string().min(1).max(200),
  itemType: z.enum(['vaccine', 'checkup']),
  ageMinMonths: z.number().int().min(0),
  ageMaxMonths: z.number().int().min(0),
  milestoneAgeMonths: z.number().int().min(0),
  doseNumber: z.number().int().min(1).optional(),
  purpose: z.string().max(500).optional(),
  details: z.string().max(2000).optional(),
  reminderDays: z.array(z.number().int().min(0).max(30)).min(1).optional(),
});

const createVaccineSchema = vaccineBaseSchema
  .refine((d) => d.ageMaxMonths >= d.ageMinMonths, {
    message: 'ageMaxMonths must be >= ageMinMonths',
    path: ['ageMaxMonths'],
  })
  .refine((d) => d.milestoneAgeMonths >= d.ageMinMonths && d.milestoneAgeMonths <= d.ageMaxMonths, {
    message: 'milestoneAgeMonths must fall within age range',
    path: ['milestoneAgeMonths'],
  });

const updateVaccineSchema = vaccineBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const manualParentSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  country: z.string().max(100).optional(),
});

const manualChildSchema = z.object({
  parentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['male', 'female', 'other']).optional(),
  notes: z.string().max(1000).optional(),
});

const markCompleteSchema = z.object({
  cardPhotoUrl: z.string().url().optional(),
});

const idParamsSchema = z.object({ id: z.string().uuid() });

router.post('/signup', authenticateToken, validate(hospitalSignupSchema), hospitalAdminController.signup);

router.use(authenticateToken, requireRole('hospital'));

router.get('/profile', hospitalAdminController.getProfile);
router.patch('/profile', validate(updateHospitalSchema), hospitalAdminController.updateProfile);

router.post('/vaccines', validate(createVaccineSchema), hospitalAdminController.createVaccine);
router.get('/vaccines', hospitalAdminController.listVaccines);
router.put(
  '/vaccines/:id',
  validate(idParamsSchema, 'params'),
  validate(updateVaccineSchema),
  hospitalAdminController.updateVaccine,
);
router.delete(
  '/vaccines/:id',
  validate(idParamsSchema, 'params'),
  hospitalAdminController.deleteVaccine,
);

router.get('/parents', hospitalAdminController.listParents);
router.post('/parents', validate(manualParentSchema), hospitalAdminController.addParent);

router.get('/children', hospitalAdminController.listChildren);
router.post('/children', validate(manualChildSchema), hospitalAdminController.addChild);

router.patch(
  '/schedules/:id/complete',
  validate(idParamsSchema, 'params'),
  validate(markCompleteSchema),
  hospitalAdminController.markScheduleComplete,
);

router.get('/overdue', hospitalAdminController.getOverdue);
router.get('/stats', hospitalAdminController.getStats);

export default router;
