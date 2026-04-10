import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export interface InMemoryPollResponse {
  userResponses: any;
  pollId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  responses: Record<string, number>;
  totalResponses: number;
  timer: number;
  startTime?: number;
  timeLeft: number;
  roomCode: string;
}

export interface InMemoryPollResult extends InMemoryPollResponse {
  responses: Record<number, number>; // optionIndex -> count
  totalResponses: number;
  correctPercentage: number;
}

export class InMemoryPollResponseDto {
  userResponses: any;
  pollId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  responses: Record<string, number>;
  totalResponses: number;
  timer: number;
  startTime?: number;
  timeLeft: number;
  roomCode: string;
}

export class CreateInMemoryPollDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  options: string[];

  @IsInt()
  @Min(0)
  correctOptionIndex: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  timer?: number;
}

export class SubmitInMemoryAnswerDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsInt()
  @Min(0)
  answerIndex: number;

  @IsOptional()
  @IsString()
  confidenceLevel?: string;
}
