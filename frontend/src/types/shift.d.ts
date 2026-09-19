import type { ShiftType, ShiftSwapStatus } from '@/constants/enums';

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
  target?: { id: number; name: string; employeeNo: string };
  storeId: number;
  reason: string;
  status: keyof typeof ShiftSwapStatus;
  respondedAt: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  decisionNote: string | null;
  createdAt?: string;
}
