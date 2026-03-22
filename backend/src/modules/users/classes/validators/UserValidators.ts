import { IUser } from '#root/shared/interfaces/models.js';
import { IsNotEmpty, IsOptional, IsString, IsEmail, IsUrl, IsBoolean, IsDateString } from 'class-validator';
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
  @IsString()
  firstName!: string;

  @IsString()
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
}

export class UpdateUserProfileBody extends CreateUserProfileBody { }

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

export class UpdateRoleBody {
  @IsString()
  @IsNotEmpty()
  role!: string;
}

export const USER_VALIDATORS = [
  UserByFirebaseUIDParams,
  UserByFirebaseUIDResponse,
  UserNotFoundErrorResponse,
  CreateUserProfileBody,
  UpdateUserProfileBody,
  UserProfileResponse,
  UpdateRoleBody,
]