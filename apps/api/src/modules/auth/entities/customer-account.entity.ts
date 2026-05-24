export interface CustomerAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  loginPreference: boolean;
  phoneNumber?: string;
  birthDate: Date | null;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
