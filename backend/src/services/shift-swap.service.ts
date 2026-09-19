import { Op, type WhereOptions } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, Shift, ShiftSwap } from '../models/index.js';
import { ShiftSwapStatus, ShiftType, UserRole } from '../constants/enums.js';
import { getPagination } from '../utils/pagination.js';
import type { AuthUser } from '../types/request.js';

const ACTIVE_STATUSES = [ShiftSwapStatus.PENDING_TARGET, ShiftSwapStatus.PENDING_APPROVAL];

function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentWeekRange() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

function swapScope(user?: AuthUser): WhereOptions {
  if (!user || user.role === UserRole.OWNER) return {};
  if (user.role === UserRole.MANAGER && user.storeId) return { storeId: user.storeId };
  return { [Op.or]: [{ requesterId: user.employeeId ?? -1 }, { targetEmployeeId: user.employeeId ?? -1 }] };
}

const swapIncludes = [
  { model: Shift, include: [Employee] },
  { model: Employee, as: 'requester' },
  { model: Employee, as: 'target' }
];

export async function listSwaps(query: Record<string, unknown>, user?: AuthUser) {
  const { page, pageSize, limit, offset } = getPagination(query);
  const where: WhereOptions = { ...swapScope(user) };
  if (query.status) Object.assign(where, { status: query.status });
  if (query.storeId) Object.assign(where, { storeId: query.storeId });
  const { rows, count } = await ShiftSwap.findAndCountAll({ where, limit, offset, include: swapIncludes, order: [['id', 'DESC']] });
  return { list: rows, total: count, page, pageSize };
}

export async function createSwap(payload: Record<string, unknown>, user: AuthUser) {
  if (!user.employeeId) fail(403, '当前账号未关联员工档案，无法发起换班');
  const shift = await Shift.findByPk(Number(payload.shiftId));
  if (!shift) fail(404, '排班不存在');
  if (shift.employeeId !== user.employeeId) fail(403, '只能为本人班次发起换班申请');
  const { start, end } = currentWeekRange();
  if (shift.date < start || shift.date > end) fail(400, '只能申请当周班次的换班');
  const targetEmployeeId = Number(payload.targetEmployeeId);
  if (targetEmployeeId === user.employeeId) fail(400, '不能与自己换班');
  const target = await Employee.findByPk(targetEmployeeId);
  if (!target) fail(404, '目标员工不存在');
  if (target.storeId !== shift.storeId) fail(400, '目标员工须为同店员工');
  const targetBusy = await Shift.count({
    where: { employeeId: targetEmployeeId, date: shift.date, shiftType: { [Op.ne]: ShiftType.REST } }
  });
  if (targetBusy > 0) fail(409, '目标员工当天已有班次，无法换班');
  const duplicated = await ShiftSwap.count({ where: { shiftId: shift.id, status: { [Op.in]: ACTIVE_STATUSES } } });
  if (duplicated > 0) fail(409, '该班次已有进行中的换班申请，请勿重复提交');
  const reason = String(payload.reason ?? '').trim();
  if (!reason) fail(400, '请填写换班原因');
  return ShiftSwap.create({
    shiftId: shift.id,
    requesterId: user.employeeId,
    targetEmployeeId,
    storeId: shift.storeId,
    reason,
    status: ShiftSwapStatus.PENDING_TARGET
  });
}

async function transition(id: number, from: string | string[], patch: Record<string, unknown>) {
  const [affected] = await ShiftSwap.update(patch, { where: { id, status: Array.isArray(from) ? { [Op.in]: from } : from } });
  if (!affected) fail(409, '该申请已被处理，请刷新后重试');
  return ShiftSwap.findByPk(id, { include: swapIncludes });
}

export async function acceptSwap(id: number, user: AuthUser) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) fail(404, '换班申请不存在');
  if (swap.targetEmployeeId !== user.employeeId) fail(403, '仅目标员工可以确认该申请');
  return transition(id, ShiftSwapStatus.PENDING_TARGET, { status: ShiftSwapStatus.PENDING_APPROVAL, respondedAt: new Date() });
}

export async function declineSwap(id: number, user: AuthUser, note?: string) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) fail(404, '换班申请不存在');
  if (swap.targetEmployeeId !== user.employeeId) fail(403, '仅目标员工可以拒绝该申请');
  return transition(id, ShiftSwapStatus.PENDING_TARGET, {
    status: ShiftSwapStatus.REJECTED,
    respondedAt: new Date(),
    decisionNote: note?.trim() || '对方拒绝换班'
  });
}

export async function cancelSwap(id: number, user: AuthUser) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) fail(404, '换班申请不存在');
  if (swap.requesterId !== user.employeeId) fail(403, '仅申请人可以撤回该申请');
  return transition(id, ACTIVE_STATUSES, { status: ShiftSwapStatus.CANCELLED });
}

function assertApprovable(swap: ShiftSwap, user: AuthUser) {
  if (user.role === UserRole.MANAGER && swap.storeId !== user.storeId) fail(403, '只能审批本门店的换班申请');
}

export async function approveSwap(id: number, user: AuthUser, note?: string) {
  return sequelize.transaction(async (transaction) => {
    const swap = await ShiftSwap.findByPk(id, { transaction });
    if (!swap) fail(404, '换班申请不存在');
    assertApprovable(swap, user);
    const [affected] = await ShiftSwap.update(
      { status: ShiftSwapStatus.APPROVED, approvedBy: user.id, approvedAt: new Date(), decisionNote: note?.trim() || null },
      { where: { id, status: ShiftSwapStatus.PENDING_APPROVAL }, transaction }
    );
    if (!affected) fail(409, '该申请已不在待审批状态，请勿重复审批');
    await Shift.update(
      { employeeId: swap.targetEmployeeId, status: 'CONFIRMED' },
      { where: { id: swap.shiftId }, transaction }
    );
    return ShiftSwap.findByPk(id, { include: swapIncludes, transaction });
  });
}

export async function rejectSwap(id: number, user: AuthUser, note?: string) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) fail(404, '换班申请不存在');
  assertApprovable(swap, user);
  return transition(id, ShiftSwapStatus.PENDING_APPROVAL, {
    status: ShiftSwapStatus.REJECTED,
    approvedBy: user.id,
    approvedAt: new Date(),
    decisionNote: note?.trim() || '店长驳回'
  });
}
