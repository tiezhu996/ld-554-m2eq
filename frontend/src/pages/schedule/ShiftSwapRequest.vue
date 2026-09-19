<template>
  <div class="swap-box">
    <el-steps :active="3" finish-status="success" align-center>
      <el-step title="员工发起" />
      <el-step title="对方确认" />
      <el-step title="店长审批" />
    </el-steps>
    <el-alert title="仅支持本人当周班次；目标员工须同店且当天无班。审批通过前原班次保持有效，且同一班次只允许一条进行中的申请。" type="info" show-icon />

    <el-form class="swap-form" label-width="80px" @submit.prevent>
      <el-form-item label="我的班次">
        <el-select v-model="form.shiftId" placeholder="选择本人当周班次" filterable>
          <el-option
            v-for="shift in myWeekShifts"
            :key="shift.id"
            :value="shift.id"
            :label="shiftLabel(shift)"
            :disabled="lockedShiftIds.has(shift.id)"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="换给">
        <el-select v-model="form.targetEmployeeId" placeholder="同店且当天无班的同事" filterable>
          <el-option v-for="emp in candidates" :key="emp.id" :value="emp.id" :label="`${emp.name}（${emp.employeeNo}）`" />
        </el-select>
      </el-form-item>
      <el-form-item label="原因">
        <el-input v-model="form.reason" type="textarea" :rows="2" maxlength="240" show-word-limit placeholder="请填写换班原因" />
      </el-form-item>
      <el-button type="primary" :loading="submitting" @click="submit">发起换班申请</el-button>
    </el-form>

    <el-table v-loading="loading" :data="swaps" empty-text="暂无换班申请">
      <el-table-column label="班次" min-width="170">
        <template #default="{ row }">
          <span v-if="row.shift">{{ row.shift.date }} {{ shiftTypeLabel(row.shift.shiftType) }} {{ row.shift.startTime }}-{{ row.shift.endTime }}</span>
          <span v-else>班次 #{{ row.shiftId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="申请人" width="90">
        <template #default="{ row }">{{ row.requester?.name ?? `员工 ${row.requesterId}` }}</template>
      </el-table-column>
      <el-table-column label="换给" width="90">
        <template #default="{ row }">{{ row.targetEmployee?.name ?? `员工 ${row.targetEmployeeId}` }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="140" show-overflow-tooltip />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)">{{ swapStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="对方确认" width="150">
        <template #default="{ row }">{{ row.respondedAt ? formatTime(row.respondedAt) : '未确认' }}</template>
      </el-table-column>
      <el-table-column label="审批" min-width="180">
        <template #default="{ row }">
          <div v-if="row.approvedAt">
            <span>{{ row.approver?.name ?? '管理员' }} · {{ formatTime(row.approvedAt) }}</span>
            <small v-if="row.reviewNote" class="note">意见：{{ row.reviewNote }}</small>
          </div>
          <span v-else>未审批</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canAccept(row)" size="small" type="primary" @click="accept(row)">接受</el-button>
          <el-button v-if="canCancel(row)" size="small" @click="cancel(row)">撤回</el-button>
          <template v-if="canReview(row)">
            <el-button size="small" type="success" @click="approve(row)">通过</el-button>
            <el-button size="small" type="danger" @click="reject(row)">驳回</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchShifts, fetchShiftSwaps, createShiftSwap, acceptShiftSwap, cancelShiftSwap, reviewShiftSwap } from '@/api/shift';
import { fetchEmployees } from '@/api/employee';
import { ShiftSwapStatus, ShiftSwapStatusLabel, ShiftTypeLabel, UserRole } from '@/constants/enums';
import { useAuthStore } from '@/stores/authStore';
import type { Employee } from '@/types/employee';
import type { Shift, ShiftSwap } from '@/types/shift';

const auth = useAuthStore();
const swaps = ref<ShiftSwap[]>([]);
const myWeekShifts = ref<Shift[]>([]);
const candidates = ref<Employee[]>([]);
const loading = ref(false);
const submitting = ref(false);
const form = reactive<{ shiftId?: number; targetEmployeeId?: number; reason: string }>({ reason: '' });

function fmt(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function weekRange() {
  const now = new Date();
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmt(monday), end: fmt(sunday) };
}

const lockedShiftIds = computed(() => {
  const inFlight = [ShiftSwapStatus.PENDING_ACCEPTANCE, ShiftSwapStatus.PENDING_APPROVAL] as string[];
  return new Set(swaps.value.filter((swap) => inFlight.includes(swap.status)).map((swap) => swap.shiftId));
});

function shiftLabel(shift: Shift) {
  const locked = lockedShiftIds.value.has(shift.id) ? '（已有进行中申请）' : '';
  return `${shift.date} ${ShiftTypeLabel[shift.shiftType]} ${shift.startTime}-${shift.endTime}${locked}`;
}

function shiftTypeLabel(type: Shift['shiftType']) {
  return ShiftTypeLabel[type];
}

function swapStatusLabel(status: ShiftSwap['status']) {
  return ShiftSwapStatusLabel[status];
}

function formatTime(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

function tagType(status: ShiftSwap['status']) {
  if (status === ShiftSwapStatus.APPROVED) return 'success';
  if (status === ShiftSwapStatus.REJECTED) return 'danger';
  if (status === ShiftSwapStatus.CANCELLED) return 'info';
  return 'warning';
}

function canAccept(row: ShiftSwap) {
  return row.status === ShiftSwapStatus.PENDING_ACCEPTANCE && row.targetEmployeeId === auth.user?.employeeId;
}

function canCancel(row: ShiftSwap) {
  const inFlight = row.status === ShiftSwapStatus.PENDING_ACCEPTANCE || row.status === ShiftSwapStatus.PENDING_APPROVAL;
  return inFlight && row.requesterId === auth.user?.employeeId;
}

function canReview(row: ShiftSwap) {
  const reviewer = auth.user?.role === UserRole.OWNER || auth.user?.role === UserRole.MANAGER;
  return reviewer && row.status === ShiftSwapStatus.PENDING_APPROVAL;
}

async function load() {
  loading.value = true;
  try {
    const week = weekRange();
    const [swapRes, shiftRes, employeeRes] = await Promise.all([
      fetchShiftSwaps({ pageSize: 100 }) as Promise<{ data: { list: ShiftSwap[] } }>,
      fetchShifts({ startDate: week.start, endDate: week.end, pageSize: 100 }) as Promise<{ data: { list: Shift[] } }>,
      fetchEmployees({ pageSize: 100 }) as Promise<{ data: { list: Employee[] } }>
    ]);
    swaps.value = swapRes.data.list;
    myWeekShifts.value = shiftRes.data.list.filter((shift) => shift.employeeId === auth.user?.employeeId);
    candidates.value = employeeRes.data.list.filter((emp) => emp.id !== auth.user?.employeeId && emp.status !== 'RESIGNED');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!form.shiftId || !form.targetEmployeeId || !form.reason.trim()) {
    ElMessage.warning('请选择班次、目标同事并填写原因');
    return;
  }
  submitting.value = true;
  try {
    await createShiftSwap({ shiftId: form.shiftId, targetEmployeeId: form.targetEmployeeId, reason: form.reason.trim() });
    ElMessage.success('换班申请已提交，等待对方确认');
    form.shiftId = undefined;
    form.targetEmployeeId = undefined;
    form.reason = '';
    await load();
  } finally {
    submitting.value = false;
  }
}

async function accept(row: ShiftSwap) {
  await acceptShiftSwap(row.id);
  ElMessage.success('已确认换班，等待店长审批');
  await load();
}

async function cancel(row: ShiftSwap) {
  await ElMessageBox.confirm('撤回后原排班保持不变，确认撤回该换班申请？', '撤回换班', { type: 'warning' });
  await cancelShiftSwap(row.id);
  ElMessage.success('换班申请已撤回');
  await load();
}

async function approve(row: ShiftSwap) {
  await ElMessageBox.confirm('通过后班次将立即改派给目标员工并标记为已确认，确认通过？', '审批通过', { type: 'warning' });
  await reviewShiftSwap(row.id, { approve: true });
  ElMessage.success('已通过，班次完成改派');
  await load();
}

async function reject(row: ShiftSwap) {
  const { value } = await ElMessageBox.prompt('请填写驳回原因', '驳回换班', {
    inputValidator: (input) => Boolean(input?.trim()) || '驳回原因不能为空'
  });
  await reviewShiftSwap(row.id, { approve: false, note: String(value).trim() });
  ElMessage.success('已驳回，原排班保持不变');
  await load();
}

onMounted(load);
</script>

<style scoped>
.swap-box {
  display: grid;
  gap: 16px;
}

.swap-form {
  max-width: 520px;
}

.note {
  display: block;
  color: #8a8578;
}
</style>
