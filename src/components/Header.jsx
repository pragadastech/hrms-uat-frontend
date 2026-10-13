import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  HelpCircle,
  X,
  Check,
  Clock,
  MessageSquare,
  Calendar,
  FileText,
  AlertCircle,
  Command,
  List,
  Loader2,
  Users,
  Briefcase,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { 
  notificationAPI, 
  employeeAPI, 
  adminAPI, 
  unifiedEmployeeAPI, 
  documentAPI, 
  holidayCalendarAPI 
} from "../services/api";

const mapTypeToIcon = (notification) => {
  const moduleName = String(notification?.module || "").toUpperCase();
  if (moduleName === "LEAVE") return Calendar;
  if (moduleName === "WFH") return Calendar;
  if (moduleName === "NOTICE") return MessageSquare;
  if (moduleName === "TIMESHEET") return Clock;
  if (moduleName === "DOCUMENT") return FileText;
  if (moduleName === "TASK") return List;
  if (moduleName === "COMPLAINT") return AlertCircle;
  if (moduleName === "EXPENSE") return FileText;
  if (moduleName === "EXIT") return AlertCircle;
  return FileText;
};

const mapTypeToClass = (notification) => {
  const moduleName = String(notification?.module || "").toUpperCase();
  if (moduleName === "LEAVE") return "leave";
  if (moduleName === "WFH") return "leave";
  if (moduleName === "NOTICE") return "announcement";
  if (moduleName === "TIMESHEET") return "document";
  if (moduleName === "DOCUMENT") return "document";
  if (moduleName === "TASK") return "leave";
  if (moduleName === "COMPLAINT") return "reminder";
  if (moduleName === "EXIT") return "reminder";
  if (moduleName === "EXPENSE") return "document";
  return "document";
};

const getNotificationLink = (notification, sessionType, userRole) => {
  const moduleName = String(notification?.module || "").toUpperCase();
  const direction = String(notification?.direction || "").toUpperCase();
  const eventType = String(notification?.eventType || "").toUpperCase();
  const message = String(notification?.message || "").toUpperCase();

  const isAdmin =
    sessionType === "admin" ||
    sessionType === "super-admin" ||
    userRole === "ADMIN" ||
    userRole === "HR" ||
    userRole === "CEO";
  const isManager = userRole === "MANAGER" || userRole === "HR" || userRole === "CEO";

  // TOP_TO_BOTTOM = admin/manager acted on the user's own item (approved/rejected)
  // BOTTOM_TO_TOP = subordinate submitted something for the user to review
  const isOwnItem = direction === "TOP_TO_BOTTOM";

  // Special: "Task Assigned" where the user IS the assignee
  if (
    moduleName === "TASK" &&
    eventType === "TASK_ASSIGNED" &&
    message.includes("YOU HAVE BEEN ASSIGNED")
  ) {
    return "/employee/planner";
  }

  switch (moduleName) {
    case "LEAVE":
      if (isOwnItem) return isAdmin ? "/admin/my-leaves" : "/employee/leaves";
      if (isAdmin) return "/admin/leaves";
      if (isManager) return "/manager/team?tab=approvals";
      return "/employee/leaves";

    case "WFH":
      if (isOwnItem) return "/employee/wfh";
      if (isAdmin) return "/admin/wfh";
      if (isManager) return "/manager/team?tab=approvals";
      return "/employee/wfh";

    case "EXPENSE":
      if (isOwnItem) return "/employee/expenses";
      if (isAdmin) return "/admin/expenses";
      if (isManager) return "/manager/team?tab=approvals";
      return "/employee/expenses";

    case "TIMESHEET":
      if (isOwnItem) return "/employee/time-office";
      if (isAdmin) return "/admin/time-office";
      if (isManager) return "/manager/team?tab=timesheets";
      return "/employee/time-office";

    case "TASK":
      if (isOwnItem) return "/employee/planner";
      if (eventType === "TASK_CREATED") {
        if (isAdmin) return "/admin/projects?tab=approvals";
        if (isManager) return "/manager/projects?tab=approvals";
      }
      if (isAdmin || isManager) return "/manager/team?tab=tasks";
      return "/employee/planner";

    case "NOTICE":
      return isAdmin ? "/admin/notices" : "/notices";
    case "COMPLAINT":
      return isAdmin ? "/admin/complaints" : "/complaints";
    case "DOCUMENT":
      if (isAdmin) return "/admin/documents";
      if (isManager) return "/manager/team?tab=documents";
      return "/employee/dashboard";
    case "EXIT":
      if (isOwnItem) return "/exit";
      if (isAdmin) return "/admin/exit";
      if (isManager) return "/manager/team?tab=approvals";
      return "/exit";
    default:
      if (isAdmin) return "/admin/dashboard";
      return "/employee/dashboard";
  }
};

const toRelativeTime = (isoDate) => {
  if (!isoDate) return "";
  
  // Ensure the date is parsed correctly. 
  // If the server sends a date without Z but it's meant to be UTC/IST, 
  // JS Date will parse it in the browser's local time.
  const parsedDate = new Date(isoDate);
  
  // Basic validation
  if (isNaN(parsedDate.getTime())) return "";

  const now = new Date();
  let diffMs = now.getTime() - parsedDate.getTime();
  
  // Handle future dates (e.g. server/client clock drift or timezone mismatch)
  if (diffMs < 0) {
    if (diffMs > -3600000) return "just now"; // Within 1 hour drift, show as just now
    return "just now";
  }

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
};

let cachedProfile = null;
let profileCacheTime = 0;
let fetchProfilePromise = null;

let cachedNotifications = null;
let notificationsCacheTime = 0;
let fetchNotificationsPromise = null;

let globalHeaderListeners = [];
let globalHeaderProps = {
  title: "",
  subtitle: "",
  greeting: "",
  greetingSubtitle: ""
};

export const setGlobalHeaderProps = (props) => {
  globalHeaderProps = { ...globalHeaderProps, ...props };
  globalHeaderListeners.forEach(listener => listener(globalHeaderProps));
};

export default function Header({
  title,
  subtitle,
  greeting,
  greetingSubtitle,
  global
}) {
  const {
    user,
    adminUser,
    sessionType,
    logout,
    isAuthenticated,
    getCurrentUser,
  } = useAuth();

  const [headerProps, setHeaderProps] = useState(globalHeaderProps);

  useEffect(() => {
    if (global) {
      const listener = (newProps) => setHeaderProps(newProps);
      globalHeaderListeners.push(listener);
      return () => {
        globalHeaderListeners = globalHeaderListeners.filter(l => l !== listener);
      };
    }
  }, [global]);

  useEffect(() => {
    if (!global) {
      setGlobalHeaderProps({ title, subtitle, greeting, greetingSubtitle });
    }
  }, [title, subtitle, greeting, greetingSubtitle, global]);

  // Use values from headerProps if we are the global instance, otherwise use props passed in
  const currentTitle = global ? headerProps.title : title;
  const currentSubtitle = global ? headerProps.subtitle : subtitle;
  const currentGreeting = global ? headerProps.greeting : greeting;
  const currentGreetingSubtitle = global ? headerProps.greetingSubtitle : greetingSubtitle;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  // Live role fetched from backend to ensure stale sessions show the correct badge
  const [liveRoleName, setLiveRoleName] = useState(null);
  // Live position/designation fetched from backend to show in the navbar
  const [livePosition, setLivePosition] = useState(null);

  // Global Search states
  const [allEmployees, setAllEmployees] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [allHolidays, setAllHolidays] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setShowNotifications(false);
    setShowSearch(false);
  }, [location.pathname]);

  // Determine user role Upper for routing logic
  const liveRoleUpper = liveRoleName ? String(liveRoleName).trim().toUpperCase() : "";

  // Pages configured by access
  const getPagesList = () => {
    const isAdmin =
      sessionType === "admin" ||
      sessionType === "super-admin" ||
      liveRoleUpper === "ADMIN" ||
      liveRoleUpper === "HR" ||
      liveRoleUpper === "CEO";

    if (isAdmin) {
      const rolesSource = Array.isArray(user?.roles)
        ? user.roles
        : Array.isArray(adminUser?.roles)
          ? adminUser.roles
          : [];
      const hasHrOrCeoRole =
        liveRoleUpper === "HR" ||
        liveRoleUpper === "CEO" ||
        rolesSource.some((role) => ["HR", "CEO"].includes(String(role).trim().toUpperCase()));

      const adminPages = [
        { name: "Dashboard", path: "/admin/dashboard", icon: "LayoutDashboard" },
        { name: "Employees", path: "/admin/employees", icon: "Users" },
        { name: "Reporting & Hierarchy", path: "/admin/reporting-management", icon: "Briefcase" },
        { name: "Departments", path: "/admin/departments", icon: "Briefcase" },
        { name: "Time Office / Timesheets", path: "/admin/time-office", icon: "Clock" },
        { name: "Expenses", path: "/admin/expenses", icon: "FileText" },
        { name: "Leaves", path: "/admin/leaves", icon: "Calendar" },
        { name: "Leave Adjustments", path: "/admin/leave-adjustments", icon: "Calendar" },
        // Apply Leave is self-service for HR/CEO only — not pure Admin
        ...(hasHrOrCeoRole
          ? [{ name: "Apply Leave", path: "/admin/my-leaves", icon: "Calendar" }]
          : []),
        { name: "WFH Requests", path: "/admin/wfh", icon: "Calendar" },
        { name: "Holidays Calendar", path: "/admin/holidays", icon: "Calendar" },
        { name: "Notice Board", path: "/admin/notices", icon: "MessageSquare" },
        { name: "Documents Vault", path: "/admin/documents", icon: "FileText" },
        { name: "Complaints & Tickets", path: "/admin/complaints", icon: "AlertCircle" },
        { name: "Payroll Management", path: "/admin/payroll", icon: "FileText" },
        { name: "Payroll Sync", path: "/admin/payroll-sync", icon: "RefreshCw" },
        { name: "System Settings", path: "/admin/settings", icon: "Settings" },
        { name: "Exit Management", path: "/admin/exit", icon: "AlertCircle" },
        { name: "Achievements & KRs", path: "/admin/achievements", icon: "List" },
        { name: "Fun & Wellness Games", path: "/admin/fun-wellness", icon: "MessageSquare" },
        { name: "Settings", path: "/admin/settings", icon: "Settings" }
      ];
      return adminPages;
    }

    return [
      { name: "Dashboard", path: "/employee/dashboard", icon: "LayoutDashboard" },
      { name: "My Leaves", path: "/employee/leaves", icon: "Calendar" },
      { name: "Attendance & Logs", path: "/employee/attendance", icon: "Clock" },
      { name: "Time Office / Timesheet", path: "/employee/time-office", icon: "Clock" },
      { name: "Holidays List", path: "/employee/holidays", icon: "Calendar" },
      { name: "Notice Board", path: "/notices", icon: "MessageSquare" },
      { name: "Documents", path: "/documents", icon: "FileText" },
      { name: "Complaints", path: "/complaints", icon: "AlertCircle" },
      { name: "My Payslips", path: "/payroll", icon: "FileText" },
      { name: "Exit Process", path: "/exit", icon: "AlertCircle" },
      { name: "Achievements", path: "/achievements", icon: "List" },
      { name: "Fun & Wellness Games", path: "/employee/fun-wellness", icon: "MessageSquare" },
      { name: "Leaderboard", path: "/employee/leaderboard", icon: "List" },
      { name: "Planner Board", path: "/employee/planner", icon: "LayoutDashboard" },
      { name: "My Profile", path: "/employee/profile", icon: "User" }
    ];
  };

  const renderSearchIcon = (iconName) => {
    const iconsMap = {
      LayoutDashboard,
      Users,
      Clock,
      Calendar,
      FileText,
      MessageSquare,
      AlertCircle,
      Settings,
      User,
      Briefcase,
      List
    };
    const IconComponent = iconsMap[iconName] || FileText;
    return <IconComponent size={16} />;
  };

  // Fetch search data concurrently when search modal is opened
  useEffect(() => {
    if (!showSearch) return;

    let isMounted = true;
    const fetchSearchData = async () => {
      setSearchLoading(true);
      const isAdmin =
        sessionType === "admin" ||
        sessionType === "super-admin" ||
        liveRoleUpper === "ADMIN" ||
        liveRoleUpper === "HR" ||
        liveRoleUpper === "CEO";

      const fetchEmployees = async () => {
        try {
          if (isAdmin) {
            const res = await adminAPI.getAllEmployees();
            return Array.isArray(res?.data) ? res.data : [];
          } else {
            const res = await unifiedEmployeeAPI.getEmployees("ORG");
            return Array.isArray(res?.data) ? res.data : [];
          }
        } catch (err) {
          console.error("Error fetching search employees:", err);
          return [];
        }
      };

      const fetchDocuments = async () => {
        try {
          if (isAdmin) {
            const res = await documentAPI.getAllDocuments();
            return Array.isArray(res?.data) ? res.data : [];
          } else {
            const res = await documentAPI.getMyDocuments();
            return Array.isArray(res?.data) ? res.data : [];
          }
        } catch (err) {
          console.error("Error fetching search documents:", err);
          return [];
        }
      };

      const fetchHolidays = async () => {
        try {
          if (isAdmin) {
            const res = await holidayCalendarAPI.getAllHolidays();
            return Array.isArray(res?.data) ? res.data : [];
          } else {
            const res = await holidayCalendarAPI.getActiveHolidays();
            return Array.isArray(res?.data) ? res.data : [];
          }
        } catch (err) {
          console.error("Error fetching search holidays:", err);
          return [];
        }
      };

      try {
        const [empRes, docRes, holRes] = await Promise.allSettled([
          fetchEmployees(),
          fetchDocuments(),
          fetchHolidays(),
        ]);

        if (isMounted) {
          setAllEmployees(empRes.status === "fulfilled" ? empRes.value : []);
          setAllDocuments(docRes.status === "fulfilled" ? docRes.value : []);
          setAllHolidays(holRes.status === "fulfilled" ? holRes.value : []);
        }
      } catch (err) {
        console.error("Error fetching search data:", err);
      } finally {
        if (isMounted) {
          setSearchLoading(false);
        }
      }
    };

    fetchSearchData();
    return () => {
      isMounted = false;
    };
  }, [showSearch, sessionType, liveRoleUpper]);

  const getFilteredResults = () => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase().trim();
    const pagesList = getPagesList();

    const filteredPages = pagesList.filter(p =>
      p.name.toLowerCase().includes(query)
    );

    const filteredEmployees = allEmployees.filter(emp => {
      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.toLowerCase();
      const email = (emp.email || "").toLowerCase();
      const empId = (emp.employeeId || emp.id || "").toString().toLowerCase();
      const designation = (emp.designation || emp.positionName || emp.jobTitle || "").toLowerCase();
      return fullName.includes(query) || email.includes(query) || empId.includes(query) || designation.includes(query);
    });

    const filteredDocuments = allDocuments.filter(doc => {
      const name = (doc.fileName || doc.name || doc.documentType || "").toLowerCase();
      const type = (doc.documentType || "").toLowerCase();
      const ownerName = doc.employeeName ? doc.employeeName.toLowerCase() : "";
      return name.includes(query) || type.includes(query) || ownerName.includes(query);
    });

    const filteredHolidays = allHolidays.filter(hol => {
      const name = (hol.name || "").toLowerCase();
      const type = (hol.type || "").toLowerCase();
      const date = hol.date ? new Date(hol.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase() : "";
      return name.includes(query) || type.includes(query) || date.includes(query);
    });

    return {
      pages: filteredPages,
      employees: filteredEmployees,
      documents: filteredDocuments,
      holidays: filteredHolidays,
      totalCount: filteredPages.length + filteredEmployees.length + filteredDocuments.length + filteredHolidays.length
    };
  };

  const filteredResults = getFilteredResults();
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);

  const currentUser = getCurrentUser();

  // Robust name resolution for different user object structures
  const userName = (() => {
    if (!currentUser) return "User";

    const isGeneric = (n) =>
      !n || n === "Admin user" || n === "Admin" || n === "User";

    const fullName =
      `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim();
    if (fullName && !isGeneric(fullName)) return fullName;

    if (currentUser.name && !isGeneric(currentUser.name))
      return currentUser.name;
    if (currentUser.fullName && !isGeneric(currentUser.fullName))
      return currentUser.fullName;
    if (currentUser.displayName && !isGeneric(currentUser.displayName))
      return currentUser.displayName;

    return currentUser.username || "User";
  })();

  // Robust email resolution
  const userEmail =
    currentUser?.email ||
    currentUser?.username ||
    currentUser?.login ||
    "user@company.com";
  const { isCollapsed, toggle, toggleMobileMenu, isMobileMenuOpen } = useSidebar() || {
    isCollapsed: false,
    toggle: () => {},
    toggleMobileMenu: () => {},
    isMobileMenuOpen: false
  };

  // Generate default greeting if not provided
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const defaultGreeting =
    currentGreeting ||
    `${getTimeBasedGreeting()}, ${userName.split(" ")[0] || "User"}!`;
  const defaultSubtitle =
    currentGreetingSubtitle || currentSubtitle || "Welcome back to your dashboard";
  const displayTitle = currentTitle || "Dashboard";

  // Fetch live role from backend so the badge is always up-to-date
  // (handles cases where admin changed the role while user was logged in)
  useEffect(() => {
    if (sessionType !== "employee") return;
    
    const now = Date.now();
    if (cachedProfile && now - profileCacheTime < 60000) {
        // use cache
        const data = cachedProfile?.data || {};
        let rn = "";
        if (data.role?.name) rn = data.role.name;
        else if (data.employeeRoleName) rn = data.employeeRoleName;
        else if (Array.isArray(data.roles) && data.roles.length > 0) {
          const first = data.roles[0];
          rn = typeof first === "object" ? (first.name || "") : String(first || "");
        }
        if (rn) setLiveRoleName(String(rn).trim().toUpperCase());

        const pos = data.designation || data.positionName || data.position?.title || data.position || data.jobTitle || data.positionTitle || "";
        if (pos) setLivePosition(String(pos).trim());
        return;
    }

    if (!fetchProfilePromise) {
        fetchProfilePromise = employeeAPI.getProfile().finally(() => {
            fetchProfilePromise = null;
        });
    }

    fetchProfilePromise
      .then((res) => {
        cachedProfile = res;
        profileCacheTime = Date.now();
        const data = res?.data || {};
        // Prefer role.name → employeeRoleName → roles[0].name → roles[0]
        let rn = "";
        if (data.role?.name) {
          rn = data.role.name;
        } else if (data.employeeRoleName) {
          rn = data.employeeRoleName;
        } else if (Array.isArray(data.roles) && data.roles.length > 0) {
          const first = data.roles[0];
          rn = typeof first === "object" ? (first.name || "") : String(first || "");
        }
        if (rn) setLiveRoleName(String(rn).trim().toUpperCase());

        const pos = data.designation || data.positionName || data.position?.title || data.position || data.jobTitle || data.positionTitle || "";
        if (pos) setLivePosition(String(pos).trim());
      })
      .catch(() => { /* silently ignore – fall back to session data */ });
  }, [sessionType]);

  // Determine user role - prioritize actual role from user data over session type
  let userRole = "Employee"; // default
  let roleValue = "";
  if (sessionType === "admin") {
    userRole = "Administrator";
  } else if (sessionType === "super-admin") {
    userRole = "Super Administrator";
  } else if (currentUser) {
    // Check roles array first (from login response)
    if (
      currentUser.roles &&
      Array.isArray(currentUser.roles) &&
      currentUser.roles.length > 0
    ) {
      // Prioritize CEO, HR, ADMIN, MANAGER roles
      // roles[] may contain plain strings OR objects with a .name property
      const rolesUpper = currentUser.roles.map((r) => {
        const raw = typeof r === "object" && r !== null ? (r.name || "") : r;
        return String(raw).trim().toUpperCase();
      });
      if (rolesUpper.includes("CEO")) {
        roleValue = "CEO";
      } else if (rolesUpper.includes("HR")) {
        roleValue = "HR";
      } else if (rolesUpper.includes("ADMIN")) {
        roleValue = "ADMIN";
      } else if (rolesUpper.includes("MANAGER")) {
        roleValue = "MANAGER";
      } else {
        // Use first role if no priority role found
        const first = currentUser.roles[0];
        roleValue = typeof first === "object" && first !== null ? (first.name || "") : first;
      }
    } else {
      // Fallback to old role fields for backward compatibility
      // Prefer role.name (most up-to-date from backend) over employeeRoleName
      if (currentUser.role) {
        if (typeof currentUser.role === "string") {
          roleValue = currentUser.role;
        } else if (currentUser.role.name) {
          roleValue = currentUser.role.name;
        }
      }
      if (!roleValue) {
        roleValue = currentUser.employeeRoleName || "";
      }
    }

    if (roleValue) {
      // Keep common roles in uppercase (HR, ADMIN, etc.), otherwise capitalize properly
      const upperRole = String(roleValue).trim().toUpperCase();
      
      // Dynamic Check: If role is HR or generic but designation is CEO, use CEO
      const upperDesignation = String(currentUser?.designation || currentUser?.jobTitle || "").trim().toUpperCase();
      let effectiveRole = upperRole;
      
      if (upperDesignation === "CEO" || upperDesignation.includes("CHIEF EXECUTIVE OFFICER")) {
        if (upperRole === "HR" || upperRole === "EMPLOYEE" || upperRole === "ADMIN") {
          effectiveRole = "CEO";
        }
      }

      if (
        effectiveRole === "HR" ||
        effectiveRole === "CEO" ||
        effectiveRole === "ADMIN" ||
        effectiveRole === "MANAGER"
      ) {
        userRole = effectiveRole;
      } else {
        // Capitalize first letter of each word for other roles
        userRole = String(roleValue)
          .trim()
          .split(" ")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ");
      }
    }

  }

  // Override with live role from backend if available (handles stale sessions after role change)
  if (liveRoleName && sessionType === "employee") {
    userRole = liveRoleName;
  }

  // Determine fallback and final badge display text (show designation/position for employees, keep admin role for admins)
  const currentUserPosition = currentUser?.designation || currentUser?.positionName || currentUser?.position?.title || currentUser?.position || currentUser?.jobTitle || currentUser?.positionTitle || "";
  const isAdminSession = 
    sessionType === "admin" ||
    sessionType === "super-admin" ||
    userRole.toUpperCase() === "ADMIN" ||
    userRole.toUpperCase() === "ADMINISTRATOR" ||
    userRole.toUpperCase() === "SUPER ADMINISTRATOR";

  const displayBadgeText = isAdminSession 
    ? userRole 
    : (livePosition || currentUserPosition || userRole);

  // Get role badge styling based on role
  const getRoleBadgeStyle = () => {
    const roleUpper = userRole.toUpperCase();
    if (roleUpper === "HR" || roleUpper === "CEO") {
      return {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        display: "inline-block",
      };
    } else if (roleUpper === "ADMIN" || roleUpper === "ADMINISTRATOR") {
      return {
        backgroundColor: "#dbeafe",
        color: "#1e40af",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        display: "inline-block",
      };
    } else if (roleUpper === "MANAGER") {
      return {
        backgroundColor: "#d1fae5",
        color: "#065f46",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        display: "inline-block",
      };
    } else {
      return {
        backgroundColor: "#e0e7ff",
        color: "#3730a3",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        display: "inline-block",
      };
    }
  };

  const userAvatar =
    currentUser?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`;

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (sessionType === "super-admin") return;

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const now = Date.now();
        if (cachedNotifications && now - notificationsCacheTime < 30000) {
          const list = Array.isArray(cachedNotifications?.data) ? cachedNotifications.data : [];
          if (isMounted) setNotifications(list);
          return;
        }

        if (!fetchNotificationsPromise) {
            fetchNotificationsPromise = notificationAPI.getMyNotifications(false).finally(() => {
                fetchNotificationsPromise = null;
            });
        }

        const response = await fetchNotificationsPromise;
        cachedNotifications = response;
        notificationsCacheTime = Date.now();

        const list = Array.isArray(response?.data) ? response.data : [];
        if (isMounted) {
          setNotifications(list);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
        }
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionType]);

  const handleLogout = () => {
    logout();
  };

  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    if (cachedNotifications && Array.isArray(cachedNotifications.data)) {
      cachedNotifications.data = cachedNotifications.data.map((n) => (n.id === id ? { ...n, read: true } : n));
    }
    window.dispatchEvent(new CustomEvent('notification-read-internal', { detail: id }));
    try {
      await notificationAPI.markAsRead(id);
    } catch {
      // ignore and keep optimistic update
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read in background, navigate immediately
    markAsRead(notification.id);
    setShowNotifications(false);
    const notificationsPath = (sessionType === "admin" || sessionType === "super-admin") 
      ? "/admin/notifications" 
      : "/notifications";
    navigate(notificationsPath, { state: { openedNotificationId: notification.id } });
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (cachedNotifications && Array.isArray(cachedNotifications.data)) {
      cachedNotifications.data = cachedNotifications.data.map((n) => ({ ...n, read: true }));
    }
    window.dispatchEvent(new CustomEvent('notification-read-all-internal'));
    try {
      await notificationAPI.markAllAsRead();
    } catch {
      // ignore and keep optimistic update
    }
  };

  useEffect(() => {
    const handleRead = (e) => {
      const id = e.detail;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (cachedNotifications && Array.isArray(cachedNotifications.data)) {
        cachedNotifications.data = cachedNotifications.data.map((n) => (n.id === id ? { ...n, read: true } : n));
      }
    };
    const handleReadAll = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (cachedNotifications && Array.isArray(cachedNotifications.data)) {
        cachedNotifications.data = cachedNotifications.data.map((n) => ({ ...n, read: true }));
      }
    };
    window.addEventListener('notification-read', handleRead);
    window.addEventListener('notification-read-all', handleReadAll);
    return () => {
      window.removeEventListener('notification-read', handleRead);
      window.removeEventListener('notification-read-all', handleReadAll);
    };
  }, []);

  const navigateToProfile = () => {
    if (sessionType === "employee") {
      navigate("/employee/profile");
    } else {
      navigate("/admin/profile");
    }
    setShowUserMenu(false);
  };

  if (!isAuthenticated()) {
    return null;
  }

  if (!global) {
    return null;
  }

  return (
    <>
      <header className="header-premium">
        <div className="header-left">
          {/* Collapse button positioned left of title */}
          <button
            type="button"
            className="collapse-btn header-collapse mobile-nav-toggle"
            onClick={(e) => {
              if (window.innerWidth <= 1024) {
                toggleMobileMenu();
              } else {
                toggle();
              }
            }}
            aria-expanded={isMobileMenuOpen}
            aria-label="Open Navigation Menu"
            title="Open Navigation Menu"
          >
            <Menu size={22} />
          </button>
          {currentGreeting || !currentTitle ? (
            <div className="header-title-block">
              <h1 className="header-title">{defaultGreeting}</h1>
              <span className="header-subtitle">{defaultSubtitle}</span>
            </div>
          ) : (
            <div className="header-title-block">
              <h1 className="header-title">{displayTitle}</h1>
              <span className="header-subtitle">{currentSubtitle || ""}</span>
            </div>
          )}
        </div>

        <div className="header-right">
          {/* Global Search */}
          <button
            className="header-search-btn"
            onClick={() => setShowSearch(true)}
          >
            <Search size={18} />
            <span className="search-placeholder">Search...</span>
            <kbd className="search-shortcut">
              <Command size={12} /> K
            </kbd>
          </button>

          {/* Notifications */}
          {sessionType !== "super-admin" && (
          <div className="header-notifications" ref={notificationRef}>
            <button
              className={`notification-btn ${showNotifications ? "active" : ""}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-dropdown animate-scaleIn">
                <div className="notification-header">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="mark-all-read">
                      <Check size={14} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="notification-empty">
                      <Bell size={32} className="text-gray-300" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const NotificationIcon = mapTypeToIcon(notification);
                      return (
                        <div
                          key={notification.id}
                          className={`notification-item ${!notification.read ? "unread" : ""}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div
                            className={`notification-icon ${mapTypeToClass(notification)}`}
                          >
                            <NotificationIcon size={16} />
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">
                              {notification.title}
                            </div>
                            <div className="notification-message">
                              {notification.message}
                            </div>
                            <div className="notification-time">
                              <Clock size={12} />{" "}
                              {toRelativeTime(notification.createdAt)}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="notification-dot" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="notification-footer">
                  <button onClick={() => {
                    setShowNotifications(false);
                    navigate(sessionType === "admin" || sessionType === "super-admin" ? "/admin/notifications" : "/notifications");
                  }}>
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* User Menu */}
          <div
            className="header-user-section"
            ref={sessionType !== "super-admin" ? userMenuRef : null}
          >
            {sessionType === "super-admin" ? (
              <div
                className="user-btn user-btn-static"
                aria-label={`Signed in as ${userName}`}
              >
                <div
                  className="user-avatar"
                  style={{
                    backgroundImage: `url(${userAvatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                <div className="user-info">
                  <span className="user-name">{userName}</span>
                  <span className="user-role-badge" style={getRoleBadgeStyle()}>
                    {displayBadgeText}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <button
                  className={`user-btn ${showUserMenu ? "active" : ""}`}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div
                    className="user-avatar"
                    style={{
                      backgroundImage: `url(${userAvatar})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  <div className="user-info">
                    <span className="user-name">{userName}</span>
                    <span className="user-role-badge" style={getRoleBadgeStyle()}>
                      {displayBadgeText}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`chevron ${showUserMenu ? "rotated" : ""}`}
                  />
                </button>

                {showUserMenu && (
                  <div className="user-dropdown animate-scaleIn">
                    <div className="user-dropdown-header">
                      <div
                        className="user-avatar"
                        style={{
                          backgroundImage: `url(${userAvatar})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px'
                        }}
                      />
                      <div>
                        <div className="user-dropdown-name">{userName}</div>
                        <div className="user-dropdown-email">{userEmail}</div>
                      </div>
                    </div>

                    <div className="user-dropdown-menu">
                      <button onClick={navigateToProfile} className="dropdown-item">
                        <User size={16} /> My Profile
                      </button>
                      <button
                        onClick={() => navigate("/help")}
                        className="dropdown-item"
                      >
                        <HelpCircle size={16} /> Help & Support
                      </button>
                    </div>

                    <div className="user-dropdown-footer">
                      <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      {showSearch && (
        <div
          className="search-modal-overlay"
          onClick={() => setShowSearch(false)}
        >
          <div
            className="search-modal animate-slideDown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-input-wrapper">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search employees, documents, pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{ paddingLeft: '4px' }}
              />
              <button
                onClick={() => setShowSearch(false)}
                className="search-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="search-results">
              {searchLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--gray-500)' }}>
                  <Loader2 className="animate-spin" size={32} style={{ marginBottom: '12px', color: 'var(--primary-500)' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Indexing workspace data...</p>
                </div>
              ) : searchQuery ? (
                filteredResults && filteredResults.totalCount > 0 ? (
                  <div className="search-results-list">
                    {/* Pages */}
                    {filteredResults.pages.length > 0 && (
                      <div className="search-category">
                        <span className="category-label">Pages & Modules</span>
                        {filteredResults.pages.map((page, idx) => (
                          <div
                            key={`page-${idx}`}
                            className="search-item"
                            onClick={() => {
                              navigate(page.path);
                              setShowSearch(false);
                            }}
                          >
                            <span style={{ color: 'var(--primary-500)', display: 'flex', alignItems: 'center' }}>
                              {renderSearchIcon(page.icon)}
                            </span>
                            <span style={{ fontWeight: 500 }}>{page.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Employees */}
                    {filteredResults.employees.length > 0 && (
                      <div className="search-category">
                        <span className="category-label">Employees</span>
                        {filteredResults.employees.slice(0, 5).map((emp) => {
                          const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
                          const avatar = emp.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;
                          return (
                            <div
                              key={`emp-${emp.id}`}
                              className="search-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                              onClick={() => {
                                const isAdmin = sessionType === "admin" || sessionType === "super-admin" || liveRoleUpper === "ADMIN" || liveRoleUpper === "HR" || liveRoleUpper === "CEO";
                                if (isAdmin) {
                                  navigate(`/admin/employees/${emp.id}`);
                                } else {
                                  navigate(`/employee/profile`);
                                }
                                setShowSearch(false);
                              }}
                            >
                              <img src={avatar} alt={fullName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>{fullName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                  {emp.employeeId ? `#${emp.employeeId} • ` : ""}{emp.designation || emp.positionName || emp.jobTitle || "Employee"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Documents */}
                    {filteredResults.documents.length > 0 && (
                      <div className="search-category">
                        <span className="category-label">Documents</span>
                        {filteredResults.documents.slice(0, 5).map((doc) => (
                          <div
                            key={`doc-${doc.id}`}
                            className="search-item"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                            onClick={() => {
                              const isAdmin = sessionType === "admin" || sessionType === "super-admin" || liveRoleUpper === "ADMIN" || liveRoleUpper === "HR" || liveRoleUpper === "CEO";
                              navigate(isAdmin ? "/admin/documents" : "/documents");
                              setShowSearch(false);
                            }}
                          >
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
                              <FileText size={16} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500, fontSize: '13px' }}>{doc.fileName || doc.name || doc.documentType}</span>
                              <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                {doc.documentType || "General Document"} {doc.employeeName ? `• ${doc.employeeName}` : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Holidays */}
                    {filteredResults.holidays.length > 0 && (
                      <div className="search-category">
                        <span className="category-label">Holidays</span>
                        {filteredResults.holidays.slice(0, 5).map((hol) => (
                          <div
                            key={`hol-${hol.id}`}
                            className="search-item"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                            onClick={() => {
                              const isAdmin = sessionType === "admin" || sessionType === "super-admin" || liveRoleUpper === "ADMIN" || liveRoleUpper === "HR" || liveRoleUpper === "CEO";
                              navigate(isAdmin ? "/admin/holidays" : "/employee/holidays");
                              setShowSearch(false);
                            }}
                          >
                            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                              <Calendar size={16} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500, fontSize: '13px' }}>{hol.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                {hol.date ? new Date(hol.date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' }) : ""} • {hol.isOptional || hol.optional ? "Optional Holiday" : "Public Holiday"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-500)' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>No results found for "{searchQuery}"</p>
                  </div>
                )
              ) : (
                <div className="search-suggestions">
                  <p style={{ fontWeight: 500, fontSize: '13px', marginBottom: '12px', textAlign: 'left', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Try searching for:</p>
                  <div className="suggestion-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span onClick={() => setSearchQuery("leave")} style={{ padding: '6px 12px', background: 'var(--gray-5)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px' }}>
                      Leave requests
                    </span>
                    <span onClick={() => setSearchQuery("attendance")} style={{ padding: '6px 12px', background: 'var(--gray-5)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px' }}>
                      Attendance
                    </span>
                    <span onClick={() => setSearchQuery("payslip")} style={{ padding: '6px 12px', background: 'var(--gray-5)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px' }}>
                      Payslips
                    </span>
                    <span onClick={() => setSearchQuery("holiday")} style={{ padding: '6px 12px', background: 'var(--gray-5)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px' }}>
                      Holidays
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
