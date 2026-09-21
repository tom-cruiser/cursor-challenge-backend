import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller';
import { authRateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';

const router = Router();

const phoneSchema = z.string().trim().regex(/^\+?\d[\d\s-]{7,18}$/, 'Enter a valid phone number');

const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().min(1).max(200).optional(),
});

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(128),
});

router.post('/register', authRateLimit, validate(registerSchema), authController.register);
router.post('/login', authRateLimit, validate(loginSchema), authController.login);

export default router;
