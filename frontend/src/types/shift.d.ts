import type { ShiftSwapStatus, ShiftType } from '@/constants/enums';

export interface Shift {
  id: number;
  employeeId: number;
  employee?: { name: string; employeeNo: string };
  date: string;
  shiftType: keyof typeof ShiftType;
  startTime: string;
  endTime: string;
  storeId: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN';
}

export interface ShiftSwap {
  id: number;
  shiftId: number;
  shift?: Shift;
  requesterId: number;
  requester?: { id: number; name: string; employeeNo: string };
  targetEmployeeId: number;
  targetEmployee?: { id: number; name: string; employeeNo: string };
  approverId?: number | null;
  approver?: { id: number; name: string; employeeNo: string } | null;
  storeId: number;
  reason: string;
  status: keyof typeof ShiftSwapStatus;
  reviewNote?: string | null;
  respondedAt?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}
