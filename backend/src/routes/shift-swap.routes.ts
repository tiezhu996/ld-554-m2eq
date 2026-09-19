import { Router } from 'express';
import * as controller from '../controllers/shift-swap.controller.js';
import { UserRole } from '../constants/enums.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { requireFields } from '../middlewares/validator.middleware.js';

export const shiftSwapRoutes = Router();

shiftSwapRoutes.get('/', controller.index);
shiftSwapRoutes.post('/', requireFields(['shiftId', 'targetEmployeeId', 'reason']), auditMiddleware('CREATE_SHIFT_SWAP', 'shift_swaps'), controller.create);
shiftSwapRoutes.post('/:id/accept', controller.accept);
shiftSwapRoutes.post('/:id/cancel', controller.cancel);
shiftSwapRoutes.post('/:id/review', requireRoles([UserRole.OWNER, UserRole.MANAGER]), requireFields(['approve']), auditMiddleware('REVIEW_SHIFT_SWAP', 'shift_swaps'), controller.review);
