import Badge from "#root/shared/database/models/Badge.js";
import UserAchievement from "#root/shared/database/models/UserAchievement.js";
import { checkRule } from "./ruleEvaluator.js";

export type UserRoomStats = {
  userId: string;
  roomCode: string;
  totalAnswers: number;
  correctAnswers: number;
  currentStreak: number;
  maxStreak: number;
  accuracy: number;
  fastestResponse?: number | null;
}


export async function evaluateBadges(userId:string, roomCode:string, stats: UserRoomStats){

  const badges = await Badge.find();
  const newlyUnlocked: any[] = [];

  for(const badge of badges){

    const alreadyEarned = await UserAchievement.findOne({
      userId,
      badgeId: badge._id,
      roomCode
    });

    if(alreadyEarned) continue;

    const unlocked = checkRule(badge.rule, stats);

    if(unlocked){

      const achievement = await UserAchievement.create({
        userId,
        badgeId: badge._id,
        roomCode
      });

      const populated = await achievement.populate("badgeId");
      newlyUnlocked.push(populated.toObject());

    }

  }

  return newlyUnlocked;

}
