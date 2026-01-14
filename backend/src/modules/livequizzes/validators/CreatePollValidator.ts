import { IsArray, IsNotEmpty, IsString, ArrayMinSize, IsNumber, IsOptional, Min } from "class-validator";

export class CreatePollValidator {
  @IsString()
  @IsNotEmpty({ message: "Question is required" })
  question: string;

  @IsArray()
  @ArrayMinSize(2, { message: "At least two options are required" })
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsNumber()
  @Min(0, { message: "Timer must be a positive number" })
  timer?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: "Maximum points must be at least 1" })
  maxPoints?: number;
}
