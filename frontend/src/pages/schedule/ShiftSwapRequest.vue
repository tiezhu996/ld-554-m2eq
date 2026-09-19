<template>
  <div class="swap-box">
    <el-steps :active="activeStep" finish-status="success" align-center>
      <el-step title="员工发起" />
      <el-step title="对方确认" />
      <el-step title="店长审批" />
      <el-step title="完成" />
    </el-steps>
    <el-alert title="换班流转已纳入审计范围，审批后会记录到操作日志。审批通过前原班次保持有效，且同一班次不可重复申请。" type="info" show-icon />

    <el-form v-if="myEmployeeId" class="swap-form" inline @submit.prevent>
      <el-form-item label="我的当周班次">
        <el-select v-model="form.shiftId" placeholder="选择班次" class="shift-select">
          <el-option
            v-for="shift in myWeekShifts"
            :key="shift.id"
            :label="`${shift.date} ${ShiftTypeLabel[shift.shiftType]} ${shift.startTime}-${shift.endTime}`"
            :value="shift.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="换给">
        <el-select v-model="form.targetEmployeeId" placeholder="同店且当天无班" class="target-select">
          <el-option v-for="emp in candidates" :key="emp.id" :label="`${emp.name}（${emp.employeeNo}）`" :value="emp.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="原因">
        <el-input v-model="form.reason" placeholder="换班原因" maxlength="120" class="reason-input" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="submit">发起申请</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="swaps" size="small" empty-text="暂无换班申请">
      <el-table-column label="班次" min-width="170">
        <template #default="{ row }">
          <span v-if="row.shift">{{ row.shift.date }} {{ shiftTypeLabel(row) }}</span>
          <small v-if="row.shift"> {{ row.shift.startTime }}-{{ row.shift.endTime }}</small>
        </template>
      </el-table-column>
      <el-table-column label="申请人 → 目标" min-width="130">
        <template #default="{ row }">{{ row.requester?.name ?? row.requesterId }} → {{ row.target?.name ?? row.targetEmployeeId }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTagType[row.status]">{{ statusLabel(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="对方确认" width="150">
        <template #default="{ row }">{{ formatTime(row.respondedAt) }}</template>
      </el-table-column>
      <el-table-column label="审批" min-width="160">
        <template #default="{ row }">
          <span>{{ formatTime(row.approvedAt) }}</span>
          <small v-if="row.decisionNote">（{{ row.decisionNote }}）</small>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === ShiftSwapStatus.PENDING_TARGET && row.targetEmployeeId === myEmployeeId">
            <el-button size="small" type="success" @click="act(() => acceptShiftSwap(row.id))">接受</el-button>
            <el-button size="small" type="danger" plain @click="decline(row.id)">拒绝</el-button>
          </template>
          <el-button
            v-if="isActive(row.status) && row.requesterId === myEmployeeId"
            size="small"
            plain
            @click="act(() => cancelShiftSwap(row.id))"
          >撤回</el-button>
          <template v-if="row.status === ShiftSwapStatus.PENDING_APPROVAL && canApprove">
            <el-button size="small" type="primary" @click="act(() => approveShiftSwap(row.id))">通过</el-button>
            <el-button size="small" type="danger" plain @click="reject(row.id)">驳回</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  acceptShiftSwap,
  approveShiftSwap,
  cancelShiftSwap,
  createShiftSwap,
  declineShiftSwap,
  fetchShiftSwaps,
  rejectShiftSwap
} from '@/api/shift';
import { fetchEmployees } from '@/api/employee';
import { ShiftSwapStatus, ShiftSwapStatusLabel, ShiftTypeLabel } from '@/constants/enums';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import { usePermission } from '@/hooks/usePermission';
import type { Employee } from '@/types/employee';
import type { ShiftSwap } from '@/types/shift';

const auth = useAuthStore();
const shifts = useShiftStore();
const { can } = usePermission();

const swaps = ref<ShiftSwap[]>([]);
const employees = ref<Employee[]>([]);
const submitting = ref(false);
const form = reactive<{ shiftId?: number; targetEmployeeId?: number; reason: string }>({ reason: '' });

const myEmployeeId = computed(() => auth.user?.employeeId ?? null);
const canApprove = computed(() => can(['OWNER', 'MANAGER']));
const statusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  [ShiftSwapStatus.PENDING_TARGET]: 'info',
  [ShiftSwapStatus.PENDING_APPROVAL]: 'warning',
  [ShiftSwapStatus.APPROVED]: 'success',
  [ShiftSwapStatus.REJECTED]: 'danger',
  [ShiftSwapStatus.CANCELLED]: 'info'
};

function weekRange() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

const myWeekShifts = computed(() => {
  const { start, end } = weekRange();
  return shifts.list.filter(
    (shift) => shift.employeeId === myEmployeeId.value && shift.date >= start && shift.date <= end && shift.shiftType !== 'REST'
  );
});

const candidates = computed(() => employees.value.filter((emp) => emp.id !== myEmployeeId.value && emp.status !== 'RESIGNED'));

const activeStep = computed(() => {
  const latest = swaps.value[0];
  if (!latest) return 1;
  if (latest.status === ShiftSwapStatus.PENDING_TARGET) return 1;
  if (latest.status === ShiftSwapStatus.PENDING_APPROVAL) return 2;
  return 4;
});

function isActive(status: string) {
  return status === ShiftSwapStatus.PENDING_TARGET || status === ShiftSwapStatus.PENDING_APPROVAL;
}

function shiftTypeLabel(swap: ShiftSwap) {
  return swap.shift ? ShiftTypeLabel[swap.shift.shiftType] : '';
}

function statusLabel(swap: ShiftSwap) {
  return ShiftSwapStatusLabel[swap.status];
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function loadSwaps() {
  const response = await fetchShiftSwaps({ pageSize: 50 }) as { data: { list: ShiftSwap[] } };
  swaps.value = response.data.list;
}

async function submit() {
  if (!form.shiftId || !form.targetEmployeeId || !form.reason.trim()) {
    ElMessage.warning('请选择班次、目标员工并填写原因');
    return;
  }
  submitting.value = true;
  try {
    await createShiftSwap({ shiftId: form.shiftId, targetEmployeeId: form.targetEmployeeId, reason: form.reason.trim() });
    ElMessage.success('换班申请已提交，等待对方确认');
    form.shiftId = undefined;
    form.targetEmployeeId = undefined;
    form.reason = '';
    await loadSwaps();
  } finally {
    submitting.value = false;
  }
}

async function act(action: () => Promise<unknown>) {
  await action();
  await Promise.all([loadSwaps(), shifts.load()]);
}

async function decline(id: number) {
  const { value } = await ElMessageBox.prompt('可填写拒绝原因', '拒绝换班', { inputPlaceholder: '对方拒绝换班' });
  await act(() => declineShiftSwap(id, value));
}

async function reject(id: number) {
  const { value } = await ElMessageBox.prompt('可填写驳回原因', '驳回换班', { inputPlaceholder: '店长驳回' });
  await act(() => rejectShiftSwap(id, value));
}

onMounted(async () => {
  if (!shifts.list.length) await shifts.load();
  await loadSwaps();
  if (auth.user?.storeId) {
    const response = await fetchEmployees({ storeId: auth.user.storeId, pageSize: 100 }) as { data: { list: Employee[] } };
    employees.value = response.data.list;
  }
});
</script>

<style scoped>
.swap-box {
  display: grid;
  gap: 16px;
}

.swap-form {
  row-gap: 8px;
}

.shift-select {
  width: 230px;
}

.target-select {
  width: 180px;
}

.reason-input {
  width: 200px;
}
</style>
