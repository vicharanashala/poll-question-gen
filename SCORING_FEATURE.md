# Time-Aware Scoring System

## Overview
This feature implements a time-aware scoring system for the live quiz platform that rewards correct answers while factoring in response time, encouraging both accuracy and timely participation.

## Feature Implementation - Issue #20

### Key Features

1. **Point Allocation Logic**
   - Points are awarded only for correct answers
   - Each question has a configurable maximum score (default: 100 points)
   - Incorrect answers receive 0 points

2. **Time-Based Scoring Model**
   - Scoring is delay-sensitive
   - Points decrease as response time increases
   - Formula: `points = maxPoints * (1 - (responseTime / totalTime) * 0.5)`
   - This gives 100% points at t=0 and 50% points at t=timerLimit

3. **Timing Rules**
   - Timer starts when the question is released to the student (`releasedAt`)
   - Timer ends when the student submits an answer (`answeredAt`)
   - Response time is tracked in milliseconds
   - Time tracking is handled server-side to prevent manipulation

4. **Edge Case Handling**
   - No response within allowed time: 0 points awarded
   - Network latency handled using server-side timestamps
   - Questions without timers award full points for correct answers

## API Endpoints

### 1. Create Poll (Updated)
**POST** `/livequizzes/rooms/:code/polls`

```json
{
  "question": "What is the capital of France?",
  "options": ["London", "Paris", "Berlin", "Madrid"],
  "correctOptionIndex": 1,
  "timer": 30,
  "maxPoints": 100,
  "creatorId": "teacher-id"
}
```

### 2. Submit Answer (Updated)
**POST** `/livequizzes/rooms/:code/polls/:pollId/answers`

Response includes:
```json
{
  "pointsEarned": 85,
  "responseTime": 3500,
  "isCorrect": true
}
```

### 3. Get Leaderboard
**GET** `/livequizzes/rooms/:code/leaderboard`

Returns:
```json
{
  "success": true,
  "roomCode": "ABC123",
  "leaderboard": [
    {
      "userId": "user-1",
      "userName": "John Doe",
      "totalPoints": 450,
      "rank": 1
    },
    {
      "userId": "user-2",
      "userName": "Jane Smith",
      "totalPoints": 380,
      "rank": 2
    }
  ]
}
```

### 4. Get User Score
**GET** `/livequizzes/rooms/:code/score/:userId`

Returns:
```json
{
  "success": true,
  "roomCode": "ABC123",
  "score": {
    "userId": "user-1",
    "totalPoints": 450,
    "correctAnswers": 5,
    "totalAnswers": 6,
    "accuracy": 83
  }
}
```

## Database Schema Changes

### Poll Schema
Added fields:
- `maxPoints`: Number (default: 100) - Maximum points for correct answer
- `releasedAt`: Date - When the poll was released to students

### Answer Schema
Added fields:
- `responseTime`: Number - Time taken to answer in milliseconds
- `pointsEarned`: Number (default: 0) - Points earned for this answer

## Services

### ScoringService
Main service for scoring calculations:
- `calculatePoints()` - Calculates points based on correctness and response time
- `calculateResponseTime()` - Calculates time between poll release and answer
- `getLeaderboard()` - Generates ranked leaderboard from user scores

### PollService (Updated)
- `createPoll()` - Updated to accept `maxPoints` and set `releasedAt`
- `submitAnswer()` - Updated to calculate and store points and response time
- `getLeaderboard()` - New method to retrieve room leaderboard
- `getUserScore()` - New method to get individual user statistics

## Usage Example

```typescript
// Teacher creates a poll with custom max points
const poll = await pollService.createPoll('ROOM123', {
  question: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctOptionIndex: 1,
  timer: 30,
  maxPoints: 50
});

// Student submits answer
const result = await pollService.submitAnswer(
  'ROOM123',
  poll._id,
  'student-id',
  1 // correct answer
);
// Returns: { pointsEarned: 42, responseTime: 5000, isCorrect: true }

// Get leaderboard
const leaderboard = await pollService.getLeaderboard('ROOM123');

// Get specific user score
const userScore = await pollService.getUserScore('ROOM123', 'student-id');
```

## Testing

### Manual Testing Steps
1. Create a room
2. Create a poll with timer and maxPoints
3. Submit answers at different times
4. Verify points decrease with time
5. Check leaderboard shows correct rankings
6. Verify user score endpoint returns accurate stats

### Expected Behavior
- Fastest correct answers get maximum points
- Points decay linearly with time (50% reduction at timer limit)
- Incorrect answers always get 0 points
- Late answers (after timer) get 0 points
- Leaderboard ranks users by total points

## Benefits

1. **Encourages Speed**: Rewards students who answer quickly
2. **Maintains Accuracy**: Only correct answers earn points
3. **Fair Competition**: Server-side timing prevents cheating
4. **Flexible Configuration**: Teachers can set custom max points
5. **Transparent Feedback**: Students see their points immediately

## Future Enhancements
- Different scoring algorithms (exponential decay, step-based)
- Bonus points for streak of correct answers
- Configurable scoring formulas per poll
- Real-time leaderboard updates via WebSocket
- Historical score tracking and analytics
