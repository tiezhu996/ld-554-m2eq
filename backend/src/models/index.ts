import { Employee } from './employee.model.js';
import { Store } from './store.model.js';
import { Shift } from './shift.model.js';
import { ShiftSwap } from './shift-swap.model.js';
import { Transaction } from './transaction.model.js';
import { User } from './user.model.js';
import { AuditLog } from './audit-log.model.js';

Store.hasMany(Employee, { foreignKey: 'storeId' });
Employee.belongsTo(Store, { foreignKey: 'storeId' });

Store.belongsTo(Employee, { as: 'manager', foreignKey: 'managerId' });
Employee.hasMany(Store, { as: 'managedStores', foreignKey: 'managerId' });

Employee.hasMany(Shift, { foreignKey: 'employeeId' });
Shift.belongsTo(Employee, { foreignKey: 'employeeId' });
Store.hasMany(Shift, { foreignKey: 'storeId' });
Shift.belongsTo(Store, { foreignKey: 'storeId' });

Shift.hasMany(ShiftSwap, { foreignKey: 'shiftId' });
ShiftSwap.belongsTo(Shift, { foreignKey: 'shiftId' });
ShiftSwap.belongsTo(Employee, { as: 'requester', foreignKey: 'requesterId' });
ShiftSwap.belongsTo(Employee, { as: 'target', foreignKey: 'targetEmployeeId' });
ShiftSwap.belongsTo(Store, { foreignKey: 'storeId' });

Employee.hasMany(Transaction, { as: 'employeeTransactions', foreignKey: 'relatedEmployeeId' });
Transaction.belongsTo(Employee, { as: 'relatedEmployee', foreignKey: 'relatedEmployeeId' });
Store.hasMany(Transaction, { foreignKey: 'storeId' });
Transaction.belongsTo(Store, { foreignKey: 'storeId' });

User.belongsTo(Employee, { foreignKey: 'employeeId' });
User.belongsTo(Store, { foreignKey: 'storeId' });
AuditLog.belongsTo(User, { foreignKey: 'operatorId' });

export { Employee, Store, Shift, ShiftSwap, Transaction, User, AuditLog };
