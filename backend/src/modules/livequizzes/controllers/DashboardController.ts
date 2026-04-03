import { JsonController, Get, Param, Authorized } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { DashboardService } from '../services/DashboardService.js';
import { OpenAPI } from 'routing-controllers-openapi';

@injectable()
@JsonController()
@OpenAPI({ tags: ['Dashboards'], })
// @Authorized(['admin', 'teacher']) // only teachers/admins can fetch other students
export class DashboardController {
    constructor(
        @inject(DashboardService) private dashboardService: DashboardService
    ) { }

    // Student Dashboard
    @Authorized(['student'])
    @Get('/students/dashboard/:studentId')
    async getStudentDashboard(@Param('studentId') studentId: string) {
        return await this.dashboardService.getStudentDashboardData(studentId);
    }

    // Teacher Dashboard
    @Authorized(['teacher'])
    @Get('/teachers/dashboard/:teacherId')
    async getTeacherDashboard(@Param('teacherId') teacherId: string) {
        return await this.dashboardService.getTeacherDashboardData(teacherId);
    }

    // User Achievement Progress
    @Get('/students/dashboard/achievement/:userId/progress')
  async getUserAchievementProgress(@Param('userId') userId: string) {
    return await this.dashboardService.getUserAchievementProgress(userId);
  }

}
