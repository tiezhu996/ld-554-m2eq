export const EmployeeStatus = {
  ON_PROBATION: 'ON_PROBATION',
  ACTIVE: 'ACTIVE',
  RESIGNED: 'RESIGNED'
} as const;

export const EmployeeStatusLabel = {
  [EmployeeStatus.ON_PROBATION]: '试用',
  [EmployeeStatus.ACTIVE]: '在职',
  [EmployeeStatus.RESIGNED]: '离职'
} as const;

export const ShiftType = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  NIGHT: 'NIGHT',
  REST: 'REST'
} as const;

export const ShiftTypeLabel = {
  [ShiftType.MORNING]: '早班',
  [ShiftType.AFTERNOON]: '中班',
  [ShiftType.NIGHT]: '晚班',
  [ShiftType.REST]: '休息'
} as const;

export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
} as const;

export const TransactionTypeLabel = {
  [TransactionType.INCOME]: '收入',
  [TransactionType.EXPENSE]: '支出'
} as const;

export const TransactionCategory = {
  SALARY: 'SALARY',
  PURCHASE: 'PURCHASE',
  RENT: 'RENT',
  UTILITY: 'UTILITY',
  SALES: 'SALES',
  OTHER: 'OTHER'
} as const;

export const TransactionCategoryLabel = {
  [TransactionCategory.SALARY]: '工资',
  [TransactionCategory.PURCHASE]: '采购',
  [TransactionCategory.RENT]: '房租',
  [TransactionCategory.UTILITY]: '水电',
  [TransactionCategory.SALES]: '销售',
  [TransactionCategory.OTHER]: '其他'
} as const;

export const UserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
} as const;

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole];

export const ShiftSwapStatus = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export const ShiftSwapStatusLabel = {
  [ShiftSwapStatus.PENDING_ACCEPTANCE]: '待对方确认',
  [ShiftSwapStatus.PENDING_APPROVAL]: '待店长审批',
  [ShiftSwapStatus.APPROVED]: '已通过',
  [ShiftSwapStatus.REJECTED]: '已驳回',
  [ShiftSwapStatus.CANCELLED]: '已撤回'
} as const;
