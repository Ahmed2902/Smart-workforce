import { Router } from 'express';
import * as shiftController from '../controllers/shiftController';
import * as scheduleController from '../controllers/scheduleController';
import * as authMiddleware from '../middleware/authMiddleware';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validateRequest';
import {
  createShiftSchema,
  updateShiftSchema,
  listShiftsQuerySchema,
  idParamSchema,
  assignEmployeeSchema,
} from '../validators/shiftValdiator';

import {
  createScheduleSchema,
  updateScheduleSchema,
  listSchedulesQuerySchema,
} from '../validators/scheduleValidator';

const router = Router();

// Health check
router.get('/health', (req, res) =>
  res.json({ status: 'ok', message: 'Schedule service is up' }),
);

// ========== SCHEDULE MANAGEMENT ========== //
// Base path: /api/schedules/

// Create Schedule (ADMIN or MANAGER)
router.post(
  '/schedules',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  validateBody(createScheduleSchema),
  scheduleController.createSchedule,
);

// Get all schedules (with optional filters)
router.get(
  '/schedules',
  authMiddleware.protect,
  validateQuery(listSchedulesQuerySchema),
  scheduleController.getSchedules,
);

// Get single schedule by ID
router.get(
  '/schedules/:id',
  authMiddleware.protect,
  //validateParams(idParamSchema),
  scheduleController.getScheduleById,
);

// Update Schedule (ADMIN or MANAGER)
router.patch(
  '/schedules/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  validateBody(updateScheduleSchema),
  scheduleController.updateSchedule,
);

// Delete Schedule (ADMIN or MANAGER)
router.delete(
  '/schedules/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  scheduleController.deleteSchedule,
);

// ========== SHIFT MANAGEMENT ========== //
// Base path: /api/schedules/shifts

// Create a shift (ADMIN or MANAGER)
router.post(
  '/schedules/shifts',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  validateBody(createShiftSchema),
  shiftController.createShift,
);

// List all shifts
router.get(
  '/schedules/shifts',
  authMiddleware.protect,
  validateQuery(listShiftsQuerySchema),
  shiftController.getShifts,
);

// Get shift by ID
router.get(
  '/schedules/shifts/:id',
  authMiddleware.protect,
  shiftController.getShiftById,
);

// Update shift (ADMIN or MANAGER)
router.patch(
  '/schedules/shifts/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  validateBody(updateShiftSchema),
  shiftController.updateShift,
);

// Delete shift (ADMIN or MANAGER)
router.delete(
  '/schedules/shifts/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  shiftController.deleteShift,
);

// ========== SHIFT ASSIGNMENTS ========== //
// Base path: /api/schedules/shiftAssignment

// Assign employee to shift
router.post(
  '/schedules/shiftAssignment',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  //validateBody(assignEmployeeSchema),
  shiftController.assignEmployee,
);

// Unassign employee from shift
router.delete(
  '/schedules/shiftAssignment/:shiftId/:employeeId',
  authMiddleware.protect,
  authMiddleware.restrictTo('ADMIN', 'MANAGER'),
  shiftController.unassignEmployee,
);

// ========== CONVENIENCE ROUTES ========== //
// Base path: /api/shifts/

// List all shifts across schedules
router.get(
  '/shifts',
  authMiddleware.protect,
  validateQuery(listShiftsQuerySchema),
  shiftController.getShifts,
);

// Get any shift by ID directly
router.get(
  '/shifts/:id',
  authMiddleware.protect,
  validateParams(idParamSchema),
  shiftController.getShiftById,
);

export default router;
