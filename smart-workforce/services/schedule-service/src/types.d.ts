export interface AuthenticatedUser {
  id: string;
  userId: string;
  authUserId?: string;
  email: string;
  systemRole: string;
  organizationId?: string | null;
  organizationRole?: string | null;
}

export interface ScheduleInput {
  id: string;
  name?: string;
  startDate: Date;
  endDate: Date;
  createdById: string; // FK → CachedUser.id
  organizationId: string; // FK → CachedOrganization.id
  departmentId?: string; // FK → CachedDepartment.id | nullable

  // Relations
  // createdBy?: CachedUser;
  // organization?: CachedOrganization;
  // department?: CachedDepartment | null;
  // shifts?: Shift[];

  createdAt: Date;
  updatedAt: Date;
}

// Cached models (from user-service events)
export interface CachedUser {
  id: string;
  email: string;
  fullName?: string;
  departmentId?: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CachedOrganization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CachedDepartment {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface ShiftInput {
  id?: string;
  scheduleId: string;
  name?: string;
  location?: string;
  startTime: Date;
  createdById: string;
  endTime: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface shiftAssignmentInput {
  id?: string;
  shiftId: string;
  employeeId: string;
  assignedBy?: string;
}
