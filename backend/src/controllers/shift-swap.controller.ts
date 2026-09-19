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
    success(res, await swapService.acceptSwap(Number(req.params.id), req.user!), '已确认换班，等待店长审批');
  } catch (error) {
    next(error);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.cancelSwap(Number(req.params.id), req.user!), '换班申请已撤回');
  } catch (error) {
    next(error);
  }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    success(res, await swapService.reviewSwap(Number(req.params.id), req.body, req.user!), '审批完成');
  } catch (error) {
    next(error);
  }
}
