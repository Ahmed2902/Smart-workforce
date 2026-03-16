import { Router } from 'express';
import {
  checkIn,
  checkOut,
  createAttendanceRecord,
  getEmployeeAttendance,
  getEmployeeHours,
} from '../controllers/attendanceController';

import { protect, restrictTo } from '../utils/authMiddleware';
import { validateBody } from '../middlewares/validateRequest';
import { createAttendanceSchema } from '../validators/attendanceValidator';

const router = Router();

// Apply the protect middleware to all routes
router.use(protect);

// ====== Attendance Routes ====== //

// Create attendance record (admin/manager/superadmin)
router.post(
  '/',
  restrictTo('ADMIN', 'MANAGER', 'SUPERADMIN'),
  validateBody(createAttendanceSchema),
  createAttendanceRecord,
);

// ✅ Employee manually checks in
router.patch('/check-in/', checkIn);

// ✅ Employee manually checks out
router.patch('/check-out/', checkOut);

// ✅ Get all attendances (admin or manager)
router.get('/', getEmployeeAttendance);

router.get('/hours/:employeeId', getEmployeeHours);

export default router;
