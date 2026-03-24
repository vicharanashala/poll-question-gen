import { IUser } from '#root/shared/interfaces/models.js';
import { IsNotEmpty, IsOptional, IsString, IsEmail, IsUrl, IsBoolean, IsDateString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';

/**
 * Validator for Firebase UID parameter in user lookup endpoints.
 *
 * @category Users/Validators
 */
export class UserByFirebaseUIDParams {
  @JSONSchema({
    description: 'Firebase UID of the user to find',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  firebaseUID: string;
}

/**
 * Response type for successful user lookup by Firebase UID.
 *
 * @category Users/Validators
 */
export class UserByFirebaseUIDResponse implements IUser {
  @JSONSchema({
    description: 'Unique identifier for the user in the database',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @JSONSchema({
    description: 'Firebase UID of the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  firebaseUID: string;

  @JSONSchema({
    description: 'Email address of the user',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
    readOnly: true,
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    description: "User's first name",
    example: 'John',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  firstName: string;

  @JSONSchema({
    description: "User's last name",
    example: 'Smith',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  lastName: string;

  @JSONSchema({
    description: "User's role",
    example: 'student',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  role: string;
}

/**
 * Error response when user is not found.
 *
 * @category Users/Validators
 */
export class UserNotFoundErrorResponse {
  @JSONSchema({
    description: 'Error message indicating user was not found',
    example: 'User not found with the provided Firebase UID',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;
}

export class CreateUserProfileBody {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  role!: string;

  @IsOptional()
  @IsUrl({}, { message: 'avatar must be a valid URL address' })
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'phoneNumber must be a valid E.164 phone number' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'emergencyContact must be a valid E.164 phone number' })
  emergencyContact?: string;
}

export class UpdateUserProfileBody {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsUrl({}, { message: 'avatar must be a valid URL address' })
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() === '' ? null : value?.trim())
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'phoneNumber must be a valid E.164 phone number' })
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  institution?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  designation?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  bio?: string | null;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => value?.trim() === '' ? null : value?.trim())
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() === '' ? null : value?.trim())
  address?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() === '' ? null : value?.trim())
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'emergencyContact must be a valid E.164 phone number' })
  emergencyContact?: string | null;
}

export class UserProfileResponse {
  @IsString()
  id!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;
}

export const USER_VALIDATORS = [
  UserByFirebaseUIDParams,
  UserByFirebaseUIDResponse,
  UserNotFoundErrorResponse,
  CreateUserProfileBody,
  UpdateUserProfileBody,
  UserProfileResponse,
]