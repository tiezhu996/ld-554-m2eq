import { request } from '@/utils/request';

export function fetchShifts(params = {}) {
  return request.get('/shifts', { params });
}

export function createShift(data: Record<string, unknown>) {
  return request.post('/shifts', data);
}

export function autoGenerateShifts(data: { storeId: number; date: string }) {
  return request.post('/shifts/auto-generate', data);
}

export function fetchShiftSwaps(params = {}) {
  return request.get('/shifts/swaps', { params });
}

export function createShiftSwap(data: { shiftId: number; targetEmployeeId: number; reason: string }) {
  return request.post('/shifts/swaps', data);
}

export function acceptShiftSwap(id: number) {
  return request.post(`/shifts/swaps/${id}/accept`);
}

export function declineShiftSwap(id: number, note?: string) {
  return request.post(`/shifts/swaps/${id}/decline`, { note });
}

export function cancelShiftSwap(id: number) {
  return request.post(`/shifts/swaps/${id}/cancel`);
}

export function approveShiftSwap(id: number, note?: string) {
  return request.post(`/shifts/swaps/${id}/approve`, { note });
}

export function rejectShiftSwap(id: number, note?: string) {
  return request.post(`/shifts/swaps/${id}/reject`, { note });
}
