import { Router } from 'express';
import * as controller from '../controllers/shift.controller.js';
import * as swapController from '../controllers/shift-swap.controller.js';
import { UserRole } from '../constants/enums.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { requireFields } from '../middlewares/validator.middleware.js';

export const shiftRoutes = Router();

shiftRoutes.get('/', controller.index);
shiftRoutes.post('/', requireRoles([UserRole.OWNER, UserRole.MANAGER]), requireFields(['employeeId', 'date', 'shiftType', 'startTime', 'endTime', 'storeId']), auditMiddleware('CREATE_SHIFT', 'shifts'), controller.create);
shiftRoutes.post('/auto-generate', requireRoles([UserRole.OWNER, UserRole.MANAGER]), requireFields(['storeId', 'date']), auditMiddleware('AUTO_GENERATE_SHIFT', 'shifts'), controller.autoGenerate);
shiftRoutes.get('/swaps', swapController.index);
shiftRoutes.post('/swaps', requireFields(['shiftId', 'targetEmployeeId', 'reason']), auditMiddleware('CREATE_SHIFT_SWAP', 'shift_swap_requests'), swapController.create);
shiftRoutes.post('/swaps/:id/accept', auditMiddleware('ACCEPT_SHIFT_SWAP', 'shift_swap_requests'), swapController.accept);
shiftRoutes.post('/swaps/:id/decline', auditMiddleware('DECLINE_SHIFT_SWAP', 'shift_swap_requests'), swapController.decline);
shiftRoutes.post('/swaps/:id/cancel', auditMiddleware('CANCEL_SHIFT_SWAP', 'shift_swap_requests'), swapController.cancel);
shiftRoutes.post('/swaps/:id/approve', requireRoles([UserRole.OWNER, UserRole.MANAGER]), auditMiddleware('APPROVE_SHIFT_SWAP', 'shift_swap_requests'), swapController.approve);
shiftRoutes.post('/swaps/:id/reject', requireRoles([UserRole.OWNER, UserRole.MANAGER]), auditMiddleware('REJECT_SHIFT_SWAP', 'shift_swap_requests'), swapController.reject);
shiftRoutes.put('/:id', requireRoles([UserRole.OWNER, UserRole.MANAGER]), auditMiddleware('UPDATE_SHIFT', 'shifts'), controller.update);
