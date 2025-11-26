import express from 'express';

import * as controller from '../controllers/payrollController';
import { protect, restrictTo } from '../middlewares/authMiddleware';
const router = express.Router();

router.use(protect);
router.get('/', controller.getAllPayrolls);
router.post('/', controller.createPayroll);
router.get('/:id', controller.getPayrollById);
router.post('/calculate', controller.calculatePayroll);
router.patch('/:id', controller.updatePayroll);
router.delete('/:id', controller.deletePayroll);

export default router;
