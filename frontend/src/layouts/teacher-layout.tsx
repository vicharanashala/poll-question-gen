import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { logout } from "@/lib/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut, Home, Users, PlusCircle,
  //Settings,
  User, ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// import React from "react";

/*const AuroraText = ({
  children,
  colors = ["#2563eb", "#1d4ed8", "#1e40af"],
}: {
  children: React.ReactNode;
  colors?: string[];
}) => (
  <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent dark:from-blue-400 dark:via-blue-500 dark:to-blue-600">
    {children}
  </span>
);*/

export default function TeacherLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    console.log("Logging out...");
    navigate({ to: "/auth" });
  };

  const handleProfileClick = () => {
    navigate({ to: "/teacher/profile" });
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950">
      {/* Background elements - more subtle */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-blue-300/20 rounded-full blur-3xl dark:from-blue-800/10 dark:to-blue-900/10"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-100/20 to-indigo-200/20 rounded-full blur-3xl dark:from-blue-800/10 dark:to-indigo-900/10"></div>
      </div>

      {/* Header - more formal styling */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm dark:bg-gray-900/95 dark:border-gray-800">
        <div className="flex h-16 sm:h-20 items-center justify-between px-3 sm:px-6 lg:px-8 gap-2 sm:gap-0">
          {/* Logo */}
          <div className="flex items-center">
              <div className="relative top-5 h-70 sm:h-50 w-20 sm:w-50">
                <img
                  src="/VLED 4.png"
                  alt="EduPoll Logo"
                  className="h-full object-contain"
                />
              </div>
          </div>

          {/* Navigation Menu - icon only */}
          <nav className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto max-w-full whitespace-nowrap scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
            <Button
              variant="ghost"
              size="sm"
              className={`relative h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center transition-all duration-300 flex-shrink-0 rounded-lg ${isActiveRoute('/teacher/home')
                ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800'
                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800 border border-transparent dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-100'
                }`}
              asChild
              aria-label="Dashboard"
            >
              <Link to="/teacher/home">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`relative h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center transition-all duration-300 flex-shrink-0 rounded-lg ${isActiveRoute('/teacher/pollroom')
                ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800'
                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800 border border-transparent dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-100'
                }`}
              asChild
              aria-label="Create Room"
            >
              <Link to="/teacher/pollroom">
                <PlusCircle className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`relative h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center transition-all duration-300 flex-shrink-0 rounded-lg ${isActiveRoute('/teacher/manage-rooms')
                ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800'
                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800 border border-transparent dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-100'
                }`}
              asChild
              aria-label="Manage Rooms"
            >
              <Link to="/teacher/manage-rooms">
                <Users className="h-5 w-5" />
              </Link>
            </Button>

            {/* <Button
              variant="ghost"
              size="sm"
              className={`relative h-10 px-4 text-sm font-medium transition-all duration-300 ${
                isActiveRoute('/teacher/settings')
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800'
                  : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800 border border-transparent dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-100'
              }`}
              asChild
            >
              <Link to="/teacher/settings">
                <Settings className="h-4 w-4 mr-2" />
                <span className="relative z-10">Settings</span>
              </Link>
            </Button> */}
          </nav>

          {/* Right side - more subdued */}
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />

            {/* User Profile Dropdown - more professional */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-auto p-1.5 sm:p-2 rounded-full hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 dark:hover:bg-blue-900/20"
                >
                  <div className="relative flex items-center gap-2">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white shadow-sm dark:border-gray-800">
                      <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-medium text-lg dark:from-blue-500 dark:to-blue-700">
                        {user?.name?.charAt(0).toUpperCase() || 'T'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block text-left">
                      <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-gray-100">
                        {user?.name || 'Teacher'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400">
                        {user?.email || 'teacher@example.com'}
                      </div>
                    </div>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 dark:text-gray-400" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 sm:w-64 p-2 bg-white border border-slate-200 shadow-lg dark:bg-gray-900 dark:border-gray-800"
              >
                {/* User Info Header */}
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 mb-2 bg-blue-50 rounded-lg dark:bg-blue-900/30">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white shadow-sm dark:border-gray-800">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-medium dark:from-blue-500 dark:to-blue-700">
                      {user?.name?.charAt(0).toUpperCase() || 'T'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                      {user?.name || 'Teacher'}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400 truncate">
                      {user?.email || 'teacher@example.com'}
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="bg-slate-200 dark:bg-gray-700" />

                {/* Profile Link */}
                <DropdownMenuItem
                  onClick={handleProfileClick}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-blue-50 transition-all duration-200 dark:hover:bg-blue-900/30"
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/50">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-gray-100">
                      View Profile
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400">
                      Manage your account
                    </div>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-200 dark:bg-gray-700" />

                {/* Logout */}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-red-50 transition-all duration-200 dark:hover:bg-red-900/30"
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900/50">
                    <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-gray-100">
                      Log Out
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - cleaner */}
      <main className="relative flex-1 p-3 sm:p-6 lg:p-8">
        <div className="relative z-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}