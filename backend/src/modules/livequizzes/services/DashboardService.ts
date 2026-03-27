import { injectable } from 'inversify';
import { Room } from '../../../shared/database/models/Room.js';
import UserAchievement from '#root/shared/database/models/UserAchievement.js';
import Badge from '#root/shared/database/models/Badge.js';
import UserRoomStats from '#root/shared/database/models/UserRoomStats.js';

@injectable()
export class DashboardService {
    async getStudentDashboardData(studentId: string) {
       
        const joinedRooms = await Room.find({ joinedStudents: studentId }).lean();

        let totalPolls = 0;
        let takenPolls = 0;
        let absentPolls = 0;
        let unattemptedPolls = 0;
        let totalScore = 0;
        let totalMaxPoints = 0;


        let pollResults: any[] = [];
        let pollDetails: any[] = [];
        let activePolls: any[] = [];
        let upcomingPolls: any[] = [];  // leave empty if you don’t have upcoming logic
        let scoreProgression: any[] = [];
        let roomWiseScores: any[] = [];

        for (const room of joinedRooms) {

            let roomScore = 0;
            let roomMaxPoints = 0;
            let attendedPolls = 0;
            let roomUnattemptedPolls = 0;

            for (const poll of room.polls ?? []) {
                totalPolls++;

                const answer = poll.answers?.find((a: any) => a.userId === studentId);
                if (answer) {
                    takenPolls++;
                    attendedPolls++;

                    const score = answer.points ?? 0;
                    const maxPoints = poll.maxPoints ?? 20;
                    roomScore += score;
                    roomMaxPoints += maxPoints;
                    totalScore += score;
                    totalMaxPoints += maxPoints;

                    // Add to pollResults
                    pollResults.push({
                        name: poll.question || 'Untitled Poll',
                        score,
                        maxPoints: maxPoints,
                        points: answer.points ?? 0,
                        date: poll.createdAt || new Date()
                    });

                    // For score progression chart
                    scoreProgression.push({
                        poll: poll.question || 'Poll',
                        score: answer.points ?? 0,
                        maxPoints: poll.maxPoints ?? 20
                    });
                } else {
                    // No answer - check if poll was missed
                    if (!(poll.lockedActiveUsers ?? []).includes(studentId)) {
                        // Absent: student was not present when poll launched
                        absentPolls++;
                    } else {
                        // Unattempted: student was present but didn't answer
                        unattemptedPolls++;
                        roomUnattemptedPolls++;
                        const maxPoints = poll.maxPoints ?? 20;
                        roomMaxPoints += maxPoints;
                        totalMaxPoints += maxPoints;

                        pollResults.push({
                            name: poll.question || 'Untitled Poll',
                            score: 0,
                            maxPoints: maxPoints,
                            points: 0,
                            date: poll.createdAt || new Date()
                        });

                        scoreProgression.push({
                            poll: poll.question || 'Poll',
                            score: 0,
                            maxPoints: poll.maxPoints ?? 20
                        });
                    }
                }

                // Always add poll details
                pollDetails.push({
                    title: poll.question || 'Untitled Poll',
                    type: 'MCQ',           // fixed value, since no type field
                    timer: poll.timer?.toString() || 'N/A'
                });

                // Active polls: based on room.status
                if (room.status === 'active') {
                    activePolls.push({
                        name: poll.question || 'Active Poll',
                        status: 'Ongoing'
                    });
                }

                // (optional) upcoming polls: you could add logic if you store startTime
            }

            // Add room-wise score if student has any activity in the room (taken or unattempted polls)
            if (attendedPolls > 0 || roomUnattemptedPolls > 0) {
                const avgScore = roomMaxPoints > 0 ? Math.round((roomScore / roomMaxPoints) * 100) : 0;
                roomWiseScores.push({
                    roomName: room.name,
                    roomCode: room.roomCode,
                    totalPolls: room.polls.length,
                    attendedPolls,
                    taken: attendedPolls,
                    score: roomScore,
                    maxPossiblePoints: roomMaxPoints,
                    avgScore,
                    averageScore: `${avgScore}%`,
                    status: room.status,
                    createdAt: room.createdAt
                });
            }
        }

        const avgScore = totalMaxPoints > 0 ? Math.round((totalScore / totalMaxPoints) * 100) : 0;
        const participationRate = totalPolls > 0 ? `${Math.round((takenPolls / totalPolls) * 100)}%` : '0%';

        return {
            pollStats: {
                total: totalPolls,
                taken: takenPolls,
                absent: absentPolls,
                unattempted: unattemptedPolls,
                earnedPoints: totalScore
            },
            pollResults,
            pollDetails,
            activePolls,
            upcomingPolls,
            scoreProgression,
            performanceSummary: {
                avgScore: `${avgScore}%`,
                participationRate,
                bestSubject: 'N/A'
            },
            roomWiseScores
        };
    }

    async getTeacherDashboardData(teacherId: string) {
        const rooms = await Room.find({ teacherId }).lean();

        let totalPolls = 0;
        let totalResponses = 0;
        let activeRooms: any[] = [];
        let recentRooms: any[] = [];
        let responsesPerRoom: { roomName: string, totalResponses: number }[] = [];

        for (const room of rooms) {
            const pollCount = room.polls?.length || 0;
            const responseCount = room.polls?.reduce((sum, poll) => sum + (poll.answers?.length || 0), 0) || 0;
            const uniqueStudents = new Set(room.students?.map((s: any) => s.toString()) || []);
            const studentCount = uniqueStudents.size;

            totalPolls += pollCount;
            totalResponses += responseCount;

            const roomData = {
                roomName: room.name,
                roomCode: room.roomCode,
                createdAt: room.createdAt,
                status: room.status,
                totalPolls: pollCount,
                totalResponses: responseCount,
                totalStudents: studentCount,
            };

            if (room.status === 'active') {
                activeRooms.push(roomData);
            }

            recentRooms.push(roomData);

            responsesPerRoom.push({
                roomName: room.name,
                totalResponses: responseCount
            });
        }

        // Sort recentRooms and activeRooms by createdAt descending
        recentRooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        activeRooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        responsesPerRoom.sort((a, b) => b.totalResponses - a.totalResponses); // Optional: Sort descending

        const participationRate = totalPolls > 0 ? `${Math.round((totalResponses / totalPolls) * 100)}%` : '0%';

        return {
            summary: {
                totalAssessmentRooms: rooms.length,
                totalPolls,
                totalResponses,
                participationRate
            },
            activeRooms,
            recentRooms,
            responsesPerRoom,
            faqs: [
                { question: "How to create a room?", answer: "Click on 'Create Room' button from the dashboard." },
                { question: "How are scores calculated?", answer: "Each correct answer gives 20 points." }
            ]
        };
    }

    //get user achievement progress
    async getUserAchievementProgress(userId: string) {
        const [earnedBadgeIds, totalBadges] = await Promise.all([
            UserAchievement.distinct('badgeId', { userId }),
            Badge.countDocuments(),
        ]);

        const earned = earnedBadgeIds.length;
        const percent = totalBadges > 0 ? Math.round((earned / totalBadges) * 100) : 0;

        return {
            earned,
            total: totalBadges,
            percent,
        };
    }
}
