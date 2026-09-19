import type { NextFunction, Request, Response } from 'express';
import * as swapService from '../services/shift-swap.service.js';
import { created, success } from '../utils/response.js';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.listSwaps(req.query, req.user));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await swapService.createSwap(req.body, req.user!));
  } catch (error) {
    next(error);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.acceptSwap(Number(req.params.id), req.user!), '已确认，等待店长审批');
  } catch (error) {
    next(error);
  }
}

export async function decline(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.declineSwap(Number(req.params.id), req.user!, req.body?.note), '已拒绝该换班申请');
  } catch (error) {
    next(error);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.cancelSwap(Number(req.params.id), req.user!), '已撤回换班申请');
  } catch (error) {
    next(error);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.approveSwap(Number(req.params.id), req.user!, req.body?.note), '已通过，班次已改派');
  } catch (error) {
    next(error);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.rejectSwap(Number(req.params.id), req.user!, req.body?.note), '已驳回，保留原排班');
  } catch (error) {
    next(error);
  }
}
