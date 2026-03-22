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
// Authenticated users can create organizations
router.post(
  '/',
  userMiddleware.requireSystemRole('SUPERADMIN'),
  validateBody(createOrganizationSchema),
  organizationController.createOrganization,
);
router.get('/', organizationController.getOrginzations);
router.patch(
  '/:id',
  userMiddleware.requireSystemRole('SUPERADMIN'),
  validateBody(updateOrganizationSchema),
  organizationController.updateOrganization,
);
router.delete(
  '/:id',
  userMiddleware.requireSystemRole('SUPERADMIN'),
  organizationController.deleteOrganization,
);

export default router;
