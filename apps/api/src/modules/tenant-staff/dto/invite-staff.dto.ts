import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

const STAFF_TYPES = [
  'cashier',
  'delivery_admin',
  'kitchen',
  'manager',
  'host',
  'other',
] as const;
type StaffTypeLiteral = (typeof STAFF_TYPES)[number];

export class StoreAssignmentDto {
  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000001' })
  @IsUUID('4')
  storeId: string;

  @ApiProperty({ enum: STAFF_TYPES, example: 'cashier' })
  @IsIn(STAFF_TYPES as unknown as string[])
  role: StaffTypeLiteral;
}

export class InviteStaffDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Aylin Staff' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  fullName: string;

  @ApiProperty({ enum: STAFF_TYPES, example: 'cashier' })
  @IsIn(STAFF_TYPES as unknown as string[])
  staffType: StaffTypeLiteral;

  @ApiProperty({ required: false, example: '+41 41 555 00 00' })
  @IsOptional()
  @IsString()
  @Length(3, 40)
  phoneNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Optional home store for the staff (must be owned by this tenant).',
  })
  @IsOptional()
  @IsUUID('4')
  defaultStoreId?: string;

  @ApiProperty({
    description:
      'Stores the staff is granted access to. Each storeId must belong to this tenant.',
    type: [StoreAssignmentDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StoreAssignmentDto)
  stores: StoreAssignmentDto[];
}

export class UpdateStaffDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  fullName?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 40)
  phoneNumber?: string | null;

  @ApiProperty({ required: false, enum: STAFF_TYPES })
  @IsOptional()
  @IsIn(STAFF_TYPES as unknown as string[])
  staffType?: StaffTypeLiteral;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID('4')
  defaultStoreId?: string | null;

  @ApiProperty({
    required: false,
    description: 'Replaces the staff store assignments. Each storeId must belong to this tenant.',
    type: [StoreAssignmentDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StoreAssignmentDto)
  stores?: StoreAssignmentDto[];
}

export class AcceptStaffInviteDto {
  @ApiProperty({ example: 'GLh3p2-...base64url-from-invite-link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'StaffPass123' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;
}
