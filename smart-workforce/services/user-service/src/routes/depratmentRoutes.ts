import { Router } from 'express';
import * as departmentController from '../controllers/departmentController';
import * as userMiddleware from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateRequest';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/departmentValidator';

const router = Router();

// Require authentication for all routes
router.use(userMiddleware.protect);

router.get('/', departmentController.getDepartments);

// Create department (org admin / superadmin checks happen in service)
router.post(
  '/',
  validateBody(createDepartmentSchema),
  departmentController.createDepartment,
);

// Update department (auth + service checks)
router.patch(
  '/:id',
  validateBody(updateDepartmentSchema),
  departmentController.updateDepartment,
);

// Delete department (auth + service checks)
router.delete('/:id', departmentController.deleteDepartment);

export default router;
