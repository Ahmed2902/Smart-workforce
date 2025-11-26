import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getEmployeeAttendance,
  getEmployeeHours,
} from '../controllers/attendanceController';

import { protect } from '../utils/authMiddleware';

const router = Router();

// Apply the protect middleware to all routes
router.use(protect);

// ====== Attendance Routes ====== //

// ✅ Employee manually checks in
router.patch('/check-in/', checkIn);

// ✅ Employee manually checks out
router.patch('/check-out/', checkOut);

// ✅ Get all attendances (admin or manager)
router.get('/', getEmployeeAttendance);

router.get('/hours/:employeeId', getEmployeeHours);

export default router;
