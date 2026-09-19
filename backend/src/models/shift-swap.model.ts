import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ShiftSwapStatus, type ShiftSwapStatusValue } from '../constants/enums.js';

export class ShiftSwap extends Model<InferAttributes<ShiftSwap>, InferCreationAttributes<ShiftSwap>> {
  declare id: CreationOptional<number>;
  declare shiftId: number;
  declare requesterId: number;
  declare targetEmployeeId: number;
  declare storeId: number;
  declare reason: string;
  declare status: ShiftSwapStatusValue;
  declare respondedAt: CreationOptional<Date | null>;
  declare approvedBy: CreationOptional<number | null>;
  declare approvedAt: CreationOptional<Date | null>;
  declare decisionNote: CreationOptional<string | null>;
}

ShiftSwap.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    shiftId: { type: DataTypes.INTEGER, allowNull: false },
    requesterId: { type: DataTypes.INTEGER, allowNull: false },
    targetEmployeeId: { type: DataTypes.INTEGER, allowNull: false },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(240), allowNull: false },
    status: { type: DataTypes.ENUM(...Object.values(ShiftSwapStatus)), allowNull: false, defaultValue: ShiftSwapStatus.PENDING_TARGET },
    respondedAt: { type: DataTypes.DATE, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    decisionNote: { type: DataTypes.STRING(240), allowNull: true }
  },
  { sequelize, tableName: 'shift_swap_requests' }
);
