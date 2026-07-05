import { Router } from 'express';
import userRoutes from './user.routes';
import hospitalRoutes from './hospital.routes';

const router = Router();

router.use('/user', userRoutes);
router.use('/hospital', hospitalRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
