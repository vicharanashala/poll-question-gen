"use client"

import * as React from "react"
import {
  Home,
  PlusCircle,
  Users,
  User,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/store/auth-store"
import { logout } from "@/lib/api/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const teacherNavData = [
  {
    title: "Dashboard",
    url: "/teacher/home",
    icon: Home,
  },
  {
    title: "Create Room",
    url: "/teacher/pollroom",
    icon: PlusCircle,
  },
  {
    title: "Manage Rooms",
    url: "/teacher/manage-rooms",
    icon: Users,
  },
]

export function TeacherSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { setOpenMobile, isMobile } = useSidebar()

  const handleLogout = () => {
    logout()
    console.log("Logging out...")
    navigate({ to: "/auth" })
  }

  const handleProfileClick = () => {
    navigate({ to: "/teacher/profile" })
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  return (
    <Sidebar collapsible="icon" {...props} data-tour="sidebar">
      <SidebarHeader className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="h-8 w-8 flex-shrink-0">
            <img
              src="/VLED 4.png"
              alt="EduPoll Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Spandan
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Teacher Portal
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {teacherNavData.map((item) => (
            <SidebarMenuItem key={item.title}>
              <Link to={item.url} onClick={handleNavClick}>
                <SidebarMenuButton
                  isActive={isActiveRoute(item.url)}
                  className={`w-full justify-start ${
                    isActiveRoute(item.url)
                      ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full group-data-[collapsible=icon]:justify-center justify-start h-auto p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-8 w-8 border-2 border-white shadow-sm dark:border-gray-800 flex-shrink-0">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-medium text-sm dark:from-blue-500 dark:to-blue-700">
                    {user?.name?.charAt(0).toUpperCase() || 'T'}
                  </AvatarFallback>
                </Avatar>
                <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                    {user?.name || 'Teacher'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 truncate">
                    {user?.email || 'teacher@example.com'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 dark:text-gray-400 group-data-[collapsible=icon]:hidden" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            className="w-56 p-2 bg-white border border-slate-200 shadow-lg dark:bg-gray-900 dark:border-gray-800"
          >
            <div className="flex items-center gap-3 p-3 mb-2 bg-blue-50 rounded-lg dark:bg-blue-900/30">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm dark:border-gray-800">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-medium dark:from-blue-500 dark:to-blue-700">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                  {user?.name || 'Teacher'}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400 truncate">
                  {user?.email || 'teacher@example.com'}
                </div>
              </div>
            </div>

            <DropdownMenuSeparator className="bg-slate-200 dark:bg-gray-700" />

            <DropdownMenuItem
              onClick={handleProfileClick}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-blue-50 transition-all duration-200 dark:hover:bg-blue-900/30"
            >
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/50">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-gray-100">
                  View Profile
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Manage your account
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-slate-200 dark:bg-gray-700" />

            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-red-50 transition-all duration-200 dark:hover:bg-red-900/30"
            >
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900/50">
                <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-gray-100">
                  Log Out
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}