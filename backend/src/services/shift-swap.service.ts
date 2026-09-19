import { Op, type WhereOptions } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, Shift, ShiftSwap } from '../models/index.js';
import { EmployeeStatus, ShiftSwapStatus, ShiftType, UserRole } from '../constants/enums.js';
import { getPagination } from '../utils/pagination.js';
import type { AuthUser } from '../types/request.js';

const IN_FLIGHT_STATUSES = [ShiftSwapStatus.PENDING_ACCEPTANCE, ShiftSwapStatus.PENDING_APPROVAL];

const swapIncludes = [
  { model: Shift },
  { model: Employee, as: 'requester', attributes: ['id', 'name', 'employeeNo'] },
  { model: Employee, as: 'targetEmployee', attributes: ['id', 'name', 'employeeNo'] },
  { model: Employee, as: 'approver', attributes: ['id', 'name', 'employeeNo'] }
];

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function formatDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function currentWeekRange(now = new Date()) {
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

export async function listSwaps(query: Record<string, unknown>, user?: AuthUser) {
  const { page, pageSize, limit, offset } = getPagination(query);
  const where: WhereOptions = {};
  if (user?.role === UserRole.MANAGER && user.storeId) Object.assign(where, { storeId: user.storeId });
  if (user?.role === UserRole.EMPLOYEE) {
    Object.assign(where, { [Op.or]: [{ requesterId: user.employeeId }, { targetEmployeeId: user.employeeId }] });
  }
  if (query.status) Object.assign(where, { status: query.status });
  const { rows, count } = await ShiftSwap.findAndCountAll({ where, include: swapIncludes, limit, offset, order: [['id', 'DESC']] });
  return { list: rows, total: count, page, pageSize };
}

export async function createSwap(payload: { shiftId: number; targetEmployeeId: number; reason: string }, user: AuthUser) {
  const requesterId = user.employeeId;
  if (!requesterId) throw httpError(403, '当前账号未关联员工，无法发起换班');
  const reason = String(payload.reason ?? '').trim();
  if (!reason) throw httpError(400, '请填写换班原因');
  return sequelize.transaction(async (transaction) => {
    // 锁定班次行，串行化同一班次的并发申请，防止重复提交
    const shift = await Shift.findByPk(Number(payload.shiftId), { transaction, lock: transaction.LOCK.UPDATE });
    if (!shift) throw httpError(404, '排班不存在');
    if (shift.employeeId !== requesterId) throw httpError(403, '只能为本人班次申请换班');
    const week = currentWeekRange();
    if (shift.date < week.start || shift.date > week.end) throw httpError(400, '仅支持申请当周（周一至周日）班次换班');
    const target = await Employee.findByPk(Number(payload.targetEmployeeId), { transaction });
    if (!target || target.status === EmployeeStatus.RESIGNED) throw httpError(404, '目标员工不存在或已离职');
    if (target.id === requesterId) throw httpError(400, '不能与自己换班');
    if (target.storeId !== shift.storeId) throw httpError(400, '目标员工须为同店员工');
    const targetBusy = await Shift.count({
      where: { employeeId: target.id, date: shift.date, shiftType: { [Op.ne]: ShiftType.REST } },
      transaction
    });
    if (targetBusy > 0) throw httpError(409, '目标员工当天已有班次，无法换班');
    const inFlight = await ShiftSwap.count({ where: { shiftId: shift.id, status: { [Op.in]: IN_FLIGHT_STATUSES } }, transaction });
    if (inFlight > 0) throw httpError(409, '该班次已有进行中的换班申请');
    return ShiftSwap.create(
      {
        shiftId: shift.id,
        requesterId,
        targetEmployeeId: target.id,
        storeId: shift.storeId,
        reason,
        status: ShiftSwapStatus.PENDING_ACCEPTANCE,
        reviewNote: null,
        respondedAt: null,
        approverId: null,
        approvedAt: null
      },
      { transaction }
    );
  });
}

export async function acceptSwap(id: number, user: AuthUser) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) throw httpError(404, '换班申请不存在');
  if (swap.targetEmployeeId !== user.employeeId) throw httpError(403, '只有被换班的员工可以确认');
  // 条件更新保证并发接受只成功一次，原班次在等待审批期间保持在线
  const [affected] = await ShiftSwap.update(
    { status: ShiftSwapStatus.PENDING_APPROVAL, respondedAt: new Date() },
    { where: { id: swap.id, status: ShiftSwapStatus.PENDING_ACCEPTANCE } }
  );
  if (affected === 0) throw httpError(409, '该申请已被处理，请刷新后查看');
  return ShiftSwap.findByPk(id, { include: swapIncludes });
}

export async function cancelSwap(id: number, user: AuthUser) {
  const swap = await ShiftSwap.findByPk(id);
  if (!swap) throw httpError(404, '换班申请不存在');
  if (swap.requesterId !== user.employeeId) throw httpError(403, '只有申请人可以撤回换班');
  const [affected] = await ShiftSwap.update(
    { status: ShiftSwapStatus.CANCELLED },
    { where: { id: swap.id, status: { [Op.in]: IN_FLIGHT_STATUSES } } }
  );
  if (affected === 0) throw httpError(409, '该申请已进入终态，无法撤回');
  return ShiftSwap.findByPk(id, { include: swapIncludes });
}

export async function reviewSwap(id: number, payload: { approve: boolean | string; note?: string }, user: AuthUser) {
  const approve = payload.approve === true || payload.approve === 'true';
  const note = String(payload.note ?? '').trim();
  if (!approve && !note) throw httpError(400, '驳回时请填写审批意见');
  return sequelize.transaction(async (transaction) => {
    // 行锁保证并发审批只成功一次
    const swap = await ShiftSwap.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!swap) throw httpError(404, '换班申请不存在');
    if (user.role === UserRole.MANAGER && swap.storeId !== user.storeId) throw httpError(403, '只能审批本门店的换班申请');
    if (swap.status !== ShiftSwapStatus.PENDING_APPROVAL) throw httpError(409, '该申请已审批或已关闭，请勿重复操作');
    if (approve) {
      const shift = await Shift.findByPk(swap.shiftId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!shift) throw httpError(404, '关联排班不存在');
      const targetBusy = await Shift.count({
        where: { employeeId: swap.targetEmployeeId, date: shift.date, shiftType: { [Op.ne]: ShiftType.REST } },
        transaction
      });
      if (targetBusy > 0) throw httpError(409, '目标员工当天已有班次，无法改派');
      // 同一事务内原子改派并标记班次为已确认
      await shift.update({ employeeId: swap.targetEmployeeId, status: 'CONFIRMED' }, { transaction });
    }
    await swap.update(
      {
        status: approve ? ShiftSwapStatus.APPROVED : ShiftSwapStatus.REJECTED,
        reviewNote: note || null,
        approverId: user.employeeId,
        approvedAt: new Date()
      },
      { transaction }
    );
    return ShiftSwap.findByPk(id, { include: swapIncludes, transaction });
  });
}
