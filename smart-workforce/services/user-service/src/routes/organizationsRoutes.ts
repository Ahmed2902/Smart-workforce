import { Router } from 'express';
import * as organizationController from '../controllers/organizationController';
import * as userMiddleware from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateRequest';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../validators/organizationValidator';

const router = Router();

router.use(userMiddleware.protect);
// Only admins can manage departments
router.post(
  '/',
  userMiddleware.restrictTo('SUPERADMIN'),
  validateBody(createOrganizationSchema),
  organizationController.createOrganization,
);
router.get('/', organizationController.getOrginzations);
router.patch(
  '/:id',
  userMiddleware.restrictTo('SUPERADMIN'),
  validateBody(updateOrganizationSchema),
  organizationController.updateOrganization,
);
router.delete(
  '/:id',
  userMiddleware.restrictTo('SUPERADMIN'),
  organizationController.deleteOrganization,
);

export default router;
