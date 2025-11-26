import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as userMiddleware from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateRequest';
import {
  createUserSchema,
  updateUserSchema,
} from '../validators/userValidator';

const router = Router();

router.patch('/me', validateBody(updateUserSchema), userController.updateMe);
// protect all routes below
router.use(userMiddleware.protect);

// Debug endpoint to inspect token payload and DB lookups
router.get('/me', userController.getUsers);
router.get(
  '/:id',
  userMiddleware.restrictTo('SYSTEMADMIN'),
  userController.getUserById,
);
router.patch(
  '/:id',
  userMiddleware.restrictTo('SYSTEMADMIN'),
  validateBody(updateUserSchema),
  userController.updateUser,
);
router.delete(
  '/:id',
  userMiddleware.restrictTo('SYSTEMADMIN'),
  userController.DeleteUser,
);

export default router;
