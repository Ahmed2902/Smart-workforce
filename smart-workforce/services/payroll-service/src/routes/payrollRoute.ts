import express from 'express';

import * as controller from '../controllers/payrollController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
const router = express.Router();

router.use(protect);
router.get('/', controller.getAllPayrolls);
router.get('/:id', controller.getPayrollById);
router.post('/', restrictTo('ADMIN', 'MANAGER'), controller.createPayroll);
router.post(
  '/calculate',
  restrictTo('ADMIN', 'MANAGER'),
  controller.calculatePayroll,
);
router.patch('/:id', restrictTo('ADMIN', 'MANAGER'), controller.updatePayroll);
router.delete(
  '/:id',
  restrictTo('ADMIN', 'MANAGER'),
  controller.deletePayroll,
);

export default router;
