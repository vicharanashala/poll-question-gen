import {
  Router,
  redirect,
  createRoute,
  createRootRoute,
  createMemoryHistory,
  Outlet,
  NotFoundRoute,
  useNavigate
} from '@tanstack/react-router'
import { useAuthStore } from '@/lib/store/auth-store'
import { useEffect } from 'react'

// Import pages and layouts
import AuthPage from '@/pages/auth-page'
import TeacherLayout from '@/layouts/teacher-layout'
import StudentLayout from '@/layouts/student-layout'
import { NotFoundComponent } from '@/components/not-found'
//import GenAIHomePage from '@/pages/teacher/genai-home'
import TeacherPollRoom from '@/pages/teacher/TeacherPollRoom'
import CreatePollRoom from '@/pages/teacher/CreatePollRoom'
import JoinPollRoom from '@/pages/student/JoinPollRoom'
import StudentPollRoom from '@/pages/student/StudentPollRoom'
import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import StudentDashboard from '@/pages/student/StudentDashboard'
import StudentProfile from '@/pages/student/StudentProfile'
import TeacherCohostedRooms from '@/pages/teacher/TeacherCohostedRooms'
import TeacherProfile from '@/pages/teacher/TeacherProfile'
import TeacherSettings from '@/pages/teacher/TeacherSettings'
import StudentSettings from '@/pages/student/StudentSettings'
import ManageRoom from '@/pages/teacher/TeacherManageRooms'
import TeacherPollAnalysis from '@/pages/teacher/TeacherPollAnalysis'
import StudentPollAnalysis from '@/pages/student/StudentPollAnalysis'
import MyPolls from '@/pages/student/MyPolls'
import RoleSelectionPage from '@/pages/roleselect'
import CohostInvite from '@/pages/teacher/CohostInvite'
import Badges from '@/pages/student/Badges'

// Root route with error and notFound handling
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ({ error }) => {
    console.error('Router error:', error);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center p-8 bg-red-50 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Something went wrong</h1>
          <p className="text-red-600 mb-6">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.href = '/auth'}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
});

// Auth route - accessible only when NOT authenticated
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    // Redirect to appropriate dashboard if already authenticated
    if (isAuthenticated && user?.role) {
      if (user.role === 'teacher') {
        throw redirect({ to: '/teacher' });
      } else if (user.role === 'student') {
        throw redirect({ to: '/student' });
      }
    } else if (isAuthenticated && user && !user.role) {
      throw redirect({ to: '/select-role' });
    }
  },
});

// Index route with redirect
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // Redirect to appropriate dashboard or auth
    const { isAuthenticated, user } = useAuthStore.getState();
    if (isAuthenticated && user?.role) {
      if (user.role === 'teacher') {
        throw redirect({ to: '/teacher/home' });
      } else if (user.role === 'student') {
        throw redirect({ to: '/student/home' });
      }
    } else if (isAuthenticated && user && !user.role) {
      throw redirect({ to: '/select-role' });
    }
    // Default redirect to auth if not authenticated or role unknown
    throw redirect({ to: '/auth' });
  },
  component: () => null,
});

// Teacher layout route with auth check and role verification
const teacherLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teacher',
  notFoundComponent: NotFoundComponent,
  beforeLoad: ({ location }) => {
    // Auth and role check
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Role check - must be a teacher
    if (user?.role !== 'teacher') {
      if (user?.role === 'student') {
        throw redirect({ to: '/student' }); // Redirect students to their dashboard
      } else {
        throw redirect({ to: '/auth' }); // Redirect others to auth
      }
    }
    
    if (location.pathname === '/teacher' || location.pathname === '/teacher/') {
      throw redirect({ to: '/teacher/home' });
    }
  },
  component: TeacherLayout,
});

// Student layout route with auth check and role verification
const studentLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/student',
  notFoundComponent: NotFoundComponent,
  beforeLoad: ({ location }) => {
    // Auth and role check
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Role check - must be a student
    if (user?.role !== 'student') {
      if (user?.role === 'teacher') {
        throw redirect({ to: '/teacher/home' }); // Redirect teachers to their dashboard
      } else {
        throw redirect({ to: '/auth' }); // Redirect others to auth
      }
    }
    
    if (location.pathname === '/student' || location.pathname === '/student/') {
      throw redirect({ to: '/student/home' });
    }
  },
  component: StudentLayout,
});

// Role Select Page
const roleSelectRoute = createRoute({
  getParentRoute: () => rootRoute, 
  path: '/select-role',
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/auth' });
    
    // If user already has a role, redirect to appropriate dashboard
    if (user?.role === 'teacher') {
      throw redirect({ to: '/teacher/home' });
    } else if (user?.role === 'student') {
      throw redirect({ to: '/student/home' });
    }
  },
  component: RoleSelectionPage,
});


// Teacher dashboard route
const teacherDashboardRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/home',
  component: TeacherDashboard,
});

// Teacher profile route
const teacherProfileRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/profile',
  component: TeacherProfile,
});

/* Teacher genAI home route
const teacherGenAIHomeRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/genai',
  component: GenAIHomePage,
});*/

// Teacher manage rooms route
const teacherManageRoomsRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/manage-rooms',
  component: ManageRoom,
}); 

// Teacher cohosted rooms route
const teacherCohostedRoomsRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/cohosted-rooms',
  component: TeacherCohostedRooms,
});

// Teacher poll analysis route
const teacherPollAnalysisRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/manage-rooms/pollanalysis/$roomId',
  component: TeacherPollAnalysis,
});

// Cohost invite route
// Cohost invite route - MUST BE PUBLIC
const cohostInviteRoute = createRoute({
  getParentRoute: () => rootRoute, // <--- Changed from teacherLayoutRoute to rootRoute
  path: '/teacher/cohost-invite/$token', 
  component: CohostInvite,
});

// Teacher poll room route
export const teacherPollRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teacher/pollroom/$code',
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }
    if (user?.role !== 'teacher') {
      if (user?.role === 'student') {
        throw redirect({ to: '/student' });
      } else {
        throw redirect({ to: '/auth' });
      }
    }
  },
  component: TeacherPollRoom,
});

// Teacher Create live Poll Room route
const teacherCreateRoomRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/pollroom',
  component: CreatePollRoom,
});

// Teacher settings route
const teacherSettingsRoute = createRoute({
  getParentRoute: () => teacherLayoutRoute,
  path: '/settings',
  component: TeacherSettings,
});

// Student dashboard route
const studentDashboardRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/home',
  component: StudentDashboard,
});

// Student profile route
const studentProfileRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/profile',
  component: StudentProfile,
});

// Student poll room route
const studentPollRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/student/pollroom/$code',
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }
    if (user?.role !== 'student') {
      if (user?.role === 'teacher') {
        throw redirect({ to: '/teacher' });
      } else {
        throw redirect({ to: '/auth' });
      }
    }
  },
  component: StudentPollRoom,
});

// Student join room route
const studentJoinRoomRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/pollroom',
  component: JoinPollRoom,
});

// Student badges route
const studentBadgesRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/badges',
  component: Badges,
});

// Student My Poll route
const studentMyPollRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/my-polls',
  component: MyPolls,
});

// Student poll analysis route
const studentPollAnalysisRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/my-polls/$code',
  component: StudentPollAnalysis,
});

// Student settings route
const studentSettingsRoute = createRoute({
  getParentRoute: () => studentLayoutRoute,
  path: '/settings',
  component: StudentSettings,
});

// Create a catch-all not found route
const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: NotFoundComponent,
});

// Create the router with the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  roleSelectRoute,
  cohostInviteRoute,
  teacherLayoutRoute.addChildren([
    // teacherGenAIHomeRoute,
    teacherPollRoomRoute,
    teacherCreateRoomRoute,
    teacherDashboardRoute,
    teacherProfileRoute,
    teacherSettingsRoute,
    teacherManageRoomsRoute,
    teacherCohostedRoomsRoute,
    teacherPollAnalysisRoute,
  ]),
  studentLayoutRoute.addChildren([
    studentPollRoomRoute,
    studentJoinRoomRoute,
    studentDashboardRoute,
    studentProfileRoute,
    studentSettingsRoute,
    studentPollAnalysisRoute,
    studentMyPollRoute,
    studentBadgesRoute,
  ]),
]);

// For server-side rendering compatibility
const memoryHistory = typeof window !== 'undefined' ? undefined : createMemoryHistory();

// Create router instance with additional options
export const router = new Router({
  routeTree,
  defaultPreload: 'intent',
  // Use memory history for SSR
  history: memoryHistory,
  // Global not found component
  defaultNotFoundComponent: NotFoundComponent,
  notFoundRoute,
});

// Add a navigation guard for redirecting based on roles
export const useRedirectBasedOnRole = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const path = window.location.pathname;

      // If the user is at root or auth page and already authenticated, redirect to their role's dashboard
      if (path === '/' || path === '/auth') {
        navigate({ to: `/${user.role.toLowerCase()}` });
      }

      // If user is trying to access a different role's route, redirect to their proper route
      else if (
        (path.startsWith('/teacher') && user.role !== 'teacher') ||
        (path.startsWith('/student') && user.role !== 'student')
      ) {
        navigate({ to: `/${user.role.toLowerCase()}` });
      }
    }
  }, [isAuthenticated, user, navigate]);
};

// Export the types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
