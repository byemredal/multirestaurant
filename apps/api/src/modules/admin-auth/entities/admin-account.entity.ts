export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  REVIEW_ADMIN = 'review_admin',
  OPERATIONS_ADMIN = 'operations_admin',
}

export interface AdminAccount {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
