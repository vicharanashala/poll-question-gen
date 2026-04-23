import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SubmitPollDifficultyDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty: 'easy' | 'medium' | 'hard';
}

