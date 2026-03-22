import { RequestHandler, Router } from 'express';
import * as authController from '../controllers/authController';
import protect from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';
import { validateBody, validateQuery } from '../middlewares/validateRequest';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from '../validators/authValidator';

const loginWindowMs = Number(
  process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
);
const loginMax = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10);

const loginLimiter = rateLimit({
  windowMs: loginWindowMs,
  max: loginMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Public routes
router.post(
  '/register',
  validateBody(registerSchema),
  loginLimiter as unknown as RequestHandler,
  authController.register,
);
router.post(
  '/login',
  validateBody(loginSchema),
  loginLimiter as unknown as RequestHandler,
  authController.login,
);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.use(protect); // All routes after this require authentication

router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.get(
  '/users',
  authController.restrictTo('ADMIN'),
  authController.getUsers,
);

router.get('/', authController.getActiveSessions);

// DELETE a specific session
router.delete('/:sessionId', authController.revokeSession);

// DELETE all sessions except current
router.delete('/keep-current/only', authController.revokeAllSessionsExcept);

export default router;
