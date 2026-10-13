import React, { useEffect, useState, useMemo } from "react";
import Header from "../components/Header";
import {
  Bell,
  Calendar,
  MessageSquare,
  FileText,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  MousePointer2,
  Filter,
  Inbox,
  LayoutGrid,
  Check,
  X,
  Loader2,
  List,
  Search
} from "lucide-react";
import { notificationAPI, respondToLeaveRequest, wfhAPI, getLeaveRequestById, adminAPI, timesheetAPI, noticeAPI, employeeExpenseAPI, managerExpenseAPI, projectAPI, employeeProjectAPI, managerAssetAPI, employeeAPI } from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Notifications.css";

const iconMap = {
  leave: Calendar,
  wfh: Calendar,
  timesheet: Clock,
  task: List,
  announcement: MessageSquare,
  reminder: AlertCircle,
  document: FileText,
  assets: ShieldCheck,
  expense: FileText,
};

const moduleToType = (n) => {
  if (!n) return "announcement";
  
  const titleLower = String(n.title || "").toLowerCase();
  const eventType = String(n.eventType || "").toUpperCase();
  const senderKey = String(n.senderKey || "").toUpperCase();
  
  if (
    ["MISSED_CLOCK_IN", "PENDING_CLOCK_OUT", "TIMESHEET_SUBMISSION_REQUIRED", "PENDING_APPROVAL_DIGEST", "SUBSCRIPTION_EXPIRING"].includes(eventType) ||
    titleLower.includes("reminder") ||
    titleLower.includes("warning") ||
    titleLower.includes("notification") ||
    senderKey === "SYSTEM"
  ) {
    return "reminder";
  }

  const module = n.module;
  if (!module) return "announcement";
  const value = String(module).toUpperCase();
  if (value === "LEAVE") return "leave";
  if (value === "WFH") return "wfh";
  if (value === "WFH_REQUEST") return "wfh";
  if (value === "LEAVE_REQUEST") return "leave";
  if (value === "NOTICE") return "announcement";
  if (value === "TIMESHEET") return "timesheet";
  if (value === "DOCUMENT") return "document";
  if (value === "TASK") return "task";
  if (value === "COMPLAINT") return "reminder";
  if (value === "EXPENSE" || value === "EXPENSE_REQUEST") return "expense";
  if (value === "EXIT") return "reminder";
  if (value === "ASSETS") return "assets";
  return "document";
};

const formatWeekRange = (start, end) => {
  if (!start || !end) return "N/A";
  const s = new Date(start);
  const e = new Date(end);
  const sMonth = s.toLocaleString('default', { month: 'short' });
  const eMonth = e.toLocaleString('default', { month: 'short' });
  if (sMonth === eMonth && s.getFullYear() === e.getFullYear()) {
    return `${sMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
};

const getEnhancedMessage = (notification, details) => {
  if (!notification) return "";
  let msg = notification.message;
  if (String(notification.module).toUpperCase() === 'TIMESHEET' && details) {
    if (!msg.includes("Week:") && details.weekStartDate) {
      msg += `. Week: ${formatWeekRange(details.weekStartDate, details.weekEndDate)}.`;
    }
    if (!msg.toLowerCase().includes("hours logged:") && details.totalHours) {
      msg += ` Total hours logged: ${details.totalHours}h.`;
    }
  }
  return msg;
};

const toRelativeTime = (isoDate) => {
  if (!isoDate) return "";
  
  let dateStr = String(isoDate);
  if (!dateStr.includes("Z") && !dateStr.includes("+") && dateStr.includes("T")) {
    dateStr += "Z";
  }
  const parsedDate = new Date(dateStr);
  
  if (isNaN(parsedDate.getTime())) return "";

  const now = new Date();
  let diffMs = now.getTime() - parsedDate.getTime();
  
  if (diffMs < 0) {
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

const groupNotificationsByDate = (notifications) => {
  const groups = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Older': []
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  notifications.forEach(n => {
    let dateStr = n.createdAt;
    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+') && dateStr.includes('T')) {
      dateStr += 'Z';
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      groups['Older'].push(n);
      return;
    }
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      groups['Today'].push(n);
    } else if (diffDays === 1) {
      groups['Yesterday'].push(n);
    } else if (diffDays > 1 && diffDays <= 7) {
      groups['This Week'].push(n);
    } else if (diffDays > 7 && diffDays <= 30) {
      groups['This Month'].push(n);
    } else {
      groups['Older'].push(n);
    }
  });

  return groups;
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

  const isOwnItem = direction === "TOP_TO_BOTTOM";

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
    case "TASK": {
      if (isOwnItem) return "/employee/planner";
      if (eventType === "TASK_CREATED") {
        if (isAdmin) return "/admin/projects?tab=approvals";
        if (isManager) return "/manager/projects?tab=approvals";
      }
      if (isAdmin || isManager) return "/manager/team?tab=tasks";
      return "/employee/planner";
    }
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
    case "ASSETS":
      if (isAdmin) return "/admin/assets";
      if (isManager) return "/manager/assets";
      return "/employee/assets";
    default:
      if (isAdmin) return "/admin/dashboard";
      return "/employee/dashboard";
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionType, getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [liveRequestStatus, setLiveRequestStatus] = useState(null);
  const [requestDetails, setRequestDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  let userRole = "Employee";
  if (sessionType === "admin") userRole = "ADMIN";
  else if (sessionType === "super-admin") userRole = "SUPER-ADMIN";
  else if (currentUser) {
    if (currentUser.roles && currentUser.roles.length > 0) {
      const rolesUpper = currentUser.roles.map((r) => String(r).trim().toUpperCase());
      if (rolesUpper.includes("HR") || rolesUpper.includes("CEO")) userRole = "HR";
      else if (rolesUpper.includes("ADMIN")) userRole = "ADMIN";
      else if (rolesUpper.includes("MANAGER")) userRole = "MANAGER";
    }
  }

  const isReminderOrAlert = selectedNotification ? (
    (
      ["MISSED_CLOCK_IN", "PENDING_CLOCK_OUT", "TIMESHEET_SUBMISSION_REQUIRED", "PENDING_APPROVAL_DIGEST", "SUBSCRIPTION_EXPIRING", "ASSET_TRANSFERRED"].includes(selectedNotification.eventType) ||
      String(selectedNotification.title || "").toLowerCase().includes("reminder") ||
      String(selectedNotification.title || "").toLowerCase().includes("warning") ||
      String(selectedNotification.title || "").toLowerCase().includes("notification") ||
      String(selectedNotification.title || "").toLowerCase().includes("transferred") ||
      selectedNotification.senderKey === "system" ||
      selectedNotification.senderKey === "SYSTEM"
    ) && String(selectedNotification.module).toUpperCase() !== 'ASSETS'
  ) : false;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await notificationAPI.getMyNotifications(false);
        const list = Array.isArray(response?.data) ? response.data : [];
        if (isMounted) {
          setNotifications(list);
          if (location.state?.openedNotificationId) {
            const found = list.find(n => n.id === location.state.openedNotificationId);
            if (found) setSelectedNotification(found);
          } else if (list.length > 0 && !selectedNotification && window.innerWidth > 768) {
            setSelectedNotification(list[0]);
          }
        }
      } catch {
        if (isMounted) setNotifications([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [location.state]);

  // Fetch live status and full details of the referenced request
  useEffect(() => {
    const fetchFullDetails = async () => {
      if (!selectedNotification || !selectedNotification.referenceId) {
        setLiveRequestStatus(null);
        setRequestDetails(null);
        return;
      }

      setIsLoadingDetails(true);
      const module = String(selectedNotification.module).toUpperCase();
      try {
        let status = null;
        let details = null;

        if (module === "LEAVE" || module === "LEAVE_REQUEST") {
          details = await getLeaveRequestById(selectedNotification.referenceId);
          status = details.status;
        } else if (module === "WFH" || module === "WFH_REQUEST") {
          const response = await wfhAPI.getById(selectedNotification.referenceId);
          details = response.data;
          status = details?.status;
        } else if (module === "EXPENSE") {
          const response = await adminAPI.getExpenseById(selectedNotification.referenceId);
          details = response.data;
          status = details?.status;
        } else if (module === "TIMESHEET") {
          try {
            const response = await timesheetAPI.getTimesheetById(selectedNotification.referenceId);
            details = response.data || response;
            status = details?.status;
          } catch (tsErr) {
            console.warn('Failed to fetch timesheet details', tsErr);
          }
        } else if (module === "NOTICE") {
          try {
            const response = await noticeAPI.getNoticeById(selectedNotification.referenceId);
            details = response.data || response;
            status = details?.active ? "ACTIVE" : "INACTIVE";
          } catch (noticeErr) {
            console.warn('Failed to fetch notice details', noticeErr);
          }
        } else if (module === "EXPENSE" || module === "EXPENSE_REQUEST") {
          try {
            let response;
            try {
              response = await employeeExpenseAPI.getExpenseById(selectedNotification.referenceId);
            } catch (err) {
              try {
                response = await managerExpenseAPI.getExpenseById(selectedNotification.referenceId);
              } catch (mErr) {
                response = await adminAPI.getExpenseById(selectedNotification.referenceId);
              }
            }
            details = response.data || response;
            status = details?.status;
          } catch (expErr) {
            console.warn('Failed to fetch expense details', expErr);
          }
        } else if (module === "TASK") {
          try {
            let response;
            if (sessionType === "admin" || sessionType === "super-admin" || userRole === "ADMIN" || userRole === "HR") {
              response = await projectAPI.getTaskAssignmentById(selectedNotification.referenceId);
            } else {
              try {
                response = await employeeProjectAPI.getSelfAssignment(selectedNotification.referenceId);
              } catch {
                response = await projectAPI.getTaskAssignmentById(selectedNotification.referenceId);
              }
            }
            details = response.data || response;
            status = details?.status || details?.approvalStatus;
          } catch (taskErr) {
            console.warn('Failed to fetch task assignment details', taskErr);
          }
        } else if (module === "ASSETS" || module === "ASSET_TICKET") {
          try {
            let response;
            if (sessionType === "admin" || sessionType === "super-admin" || userRole === "ADMIN" || userRole === "HR") {
              response = await adminAPI.getAssetTickets();
            } else if (userRole === "MANAGER") {
              response = await managerAssetAPI.getTickets();
            } else {
              response = await employeeAPI.getMyAssetTickets();
            }
            const tickets = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
            details = tickets.find(t => String(t.id) === String(selectedNotification.referenceId));
            status = details?.status;
          } catch (assetErr) {
            console.warn('Failed to fetch asset ticket details', assetErr);
          }
        }

        setRequestDetails(details);
        setLiveRequestStatus(status ? String(status).toUpperCase().trim() : null);
      } catch (err) {
        console.warn(`Could not fetch details for ${module}:`, selectedNotification.referenceId);
        setLiveRequestStatus("ARCHIVED");
        setRequestDetails(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchFullDetails();
  }, [selectedNotification]);

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    window.dispatchEvent(new CustomEvent('notification-read', { detail: id }));
    try { await notificationAPI.markAsRead(id); } catch { }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new CustomEvent('notification-read-all'));
    try { await notificationAPI.markAllAsRead(); } catch { }
  };

  useEffect(() => {
    const handleReadInternal = (e) => {
      const id = e.detail;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };
    const handleReadAllInternal = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };
    window.addEventListener('notification-read-internal', handleReadInternal);
    window.addEventListener('notification-read-all-internal', handleReadAllInternal);
    return () => {
      window.removeEventListener('notification-read-internal', handleReadInternal);
      window.removeEventListener('notification-read-all-internal', handleReadAllInternal);
    };
  }, []);

  const handleQuickAction = async (action) => {
    if (!selectedNotification?.referenceId) return;
    const isApprove = action === "APPROVE";
    if (!isApprove && !actionComment.trim()) {
      setActionStatus({ message: "Please provide a reason for rejection.", type: "error" });
      return;
    }

    if (isApprove) setIsApproving(true);
    else setIsRejecting(true);
    setActionStatus(null);

    try {
      const payload = {
        status: isApprove ? "APPROVED" : "REJECTED",
        response: actionComment
      };

      if (String(selectedNotification.module).toUpperCase() === "LEAVE" || String(selectedNotification.module).toUpperCase() === "LEAVE_REQUEST") {
        await respondToLeaveRequest(selectedNotification.referenceId, payload);
      } else if (String(selectedNotification.module).toUpperCase() === "WFH" || String(selectedNotification.module).toUpperCase() === "WFH_REQUEST") {
        await wfhAPI.respond(selectedNotification.referenceId, payload);
      } else if (String(selectedNotification.module).toUpperCase() === "TIMESHEET") {
        if (isApprove) {
          await timesheetAPI.approveTimesheet(selectedNotification.referenceId, actionComment);
        } else {
          await timesheetAPI.rejectTimesheet(selectedNotification.referenceId, actionComment);
        }
      }

      setActionStatus({ message: `Successfully ${isApprove ? "approved" : "rejected"} the request.`, type: "success" });
      setActionComment("");
      
      // Mark as read if not already
      if (!selectedNotification.read) {
        markAsRead(selectedNotification.id);
      }

      // Automatically clear the notification from the list after 1.5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== selectedNotification.id));
        setSelectedNotification(null);
        setActionStatus(null);
        setLiveRequestStatus(null);
      }, 1500);

    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to process request.";
      setActionStatus({ message: errorMsg, type: "error" });
    } finally {
      setIsApproving(false);
      setIsRejecting(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const title = String(n.title || "");
      const message = String(n.message || "");
      const matchesSearch = (title + message).toLowerCase().includes(searchTerm.toLowerCase());
      
      if (activeFilter === 'all') return matchesSearch;
      if (activeFilter === 'unread') return matchesSearch && !n.read;
      
      const type = moduleToType(n);
      if (activeFilter === 'leave') {
        return matchesSearch && (type === 'leave' || type === 'wfh');
      }
      if (activeFilter === 'document') {
        return matchesSearch && (type === 'document' || type === 'timesheet');
      }
      if (activeFilter === 'reminder') {
        const titleLower = title.toLowerCase();
        return matchesSearch && (
          ["MISSED_CLOCK_IN", "PENDING_CLOCK_OUT", "TIMESHEET_SUBMISSION_REQUIRED", "PENDING_APPROVAL_DIGEST", "SUBSCRIPTION_EXPIRING"].includes(n.eventType) ||
          titleLower.includes("reminder") ||
          titleLower.includes("warning") ||
          titleLower.includes("notification") ||
          n.senderKey === "system" ||
          type === "reminder"
        );
      }
      
      return matchesSearch && type === activeFilter;
    });
  }, [notifications, activeFilter, searchTerm]);

  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      leave: notifications.filter(n => {
        const type = moduleToType(n);
        return type === 'leave' || type === 'wfh';
      }).length,
      announcement: notifications.filter(n => moduleToType(n) === 'announcement').length,
      document: notifications.filter(n => {
        const type = moduleToType(n);
        return type === 'document' || type === 'timesheet';
      }).length,
      task: notifications.filter(n => moduleToType(n) === 'task').length,
      reminder: notifications.filter(n => moduleToType(n) === 'reminder').length,
    };
  }, [notifications]);

  const filters = [
    { id: 'all', label: 'All Activity', icon: <Inbox size={14} />, color: '#6366f1', count: counts.all },
    { id: 'unread', label: 'Unread', icon: <AlertCircle size={14} />, color: '#f43f5e', count: counts.unread },
    { id: 'leave', label: 'Leaves & WFH', icon: <Calendar size={14} />, color: '#10b981', count: counts.leave },
    { id: 'announcement', label: 'Notices', icon: <MessageSquare size={14} />, color: '#8b5cf6', count: counts.announcement },
    { id: 'document', label: 'Timesheets', icon: <FileText size={14} />, color: '#3b82f6', count: counts.document },
    { id: 'task', label: 'Tasks', icon: <Clock size={14} />, color: '#f59e0b', count: counts.task },
    { id: 'reminder', label: 'Reminders & Notifications', icon: <AlertCircle size={14} />, color: '#ef4444', count: counts.reminder },
  ];

  return (
    <div className="main-content nt-container-wrapper">
      <Header
        title="Notification Center"
        subtitle="Manage your activity and requests"
      />

      <div className="nt-container">
        {/* Left Panel: Navigation & Filters */}
        <div className="nt-side-panel">
          <div className="nt-card">
            <div className="nt-card-hd">Categories</div>
            <div className="nt-card-body">
              {filters.map(f => (
                <div 
                  key={f.id} 
                  className={`nt-filter ${activeFilter === f.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f.id)}
                >
                  <span className="nt-filter-ico" style={{ color: f.color }}>{f.icon}</span>
                  <span className="nt-filter-lbl">{f.label}</span>
                  {f.count > 0 && <span className="nt-filter-count">{f.count}</span>}
                </div>
              ))}
            </div>
          </div>

          <button className="nt-mark-read-btn" onClick={markAllAsRead} disabled={counts.unread === 0}>
            <CheckCircle2 size={14} /> 
            <span>Mark all read</span>
          </button>
        </div>

        {/* Middle Panel: List */}
        <div className={`nt-card nt-feed ${selectedNotification ? 'mobile-hidden' : ''}`}>
          <div className="nt-feed-hd">
            <div className="nt-feed-title">Latest Updates</div>
            <div className="nt-search-box">
              <Search size={12} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="nt-feed-list">
            {isLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="nt-item skeleton-item">
                  <div className="nt-item-ico nt-skeleton" />
                  <div className="nt-item-body">
                    <div className="nt-item-top">
                      <div className="nt-skeleton" style={{ width: '60%', height: '12px' }} />
                      <div className="nt-skeleton" style={{ width: '20%', height: '8px' }} />
                    </div>
                    <div className="nt-skeleton" style={{ width: '90%', height: '10px', marginTop: '6px' }} />
                    <div className="nt-skeleton" style={{ width: '40%', height: '8px', marginTop: '4px' }} />
                  </div>
                </div>
              ))
            ) : filteredNotifications.length === 0 ? (
              <div className="nt-empty-state">
                <Bell size={32} />
                <p>No notifications found</p>
              </div>
            ) : (
              Object.entries(groupedNotifications).map(([groupName, items]) => (
                items.length > 0 && (
                  <div key={groupName} className="nt-group">
                    <div className="nt-group-hd">{groupName}</div>
                    {items.map((n) => {
                      const type = moduleToType(n);
                      const Icon = iconMap[type] || Bell;
                      const isSelected = selectedNotification?.id === n.id;
                      const iconClass = type === 'reminder' ? (String(n.title || "").toLowerCase().includes("reminder") ? 'reminder' : 'notification') : type;
                      return (
                        <div
                          key={n.id}
                          className={`nt-item ${isSelected ? 'active' : ''} ${!n.read ? 'unread' : ''}`}
                          onClick={() => {
                            setSelectedNotification(n);
                            setActionComment("");
                            setActionStatus(null);
                            if (!n.read) markAsRead(n.id);
                          }}
                        >
                          <div className={`nt-item-ico ${iconClass}`}>
                            <Icon size={14} />
                          </div>
                          <div className="nt-item-body">
                            <div className="nt-item-top">
                              <span className="nt-item-title">{n.title}</span>
                              <span className="nt-item-time">{toRelativeTime(n.createdAt)}</span>
                            </div>
                            <p className="nt-item-msg">{n.message}</p>
                             <div className="nt-item-meta">
                               <span className={`nt-type-tag ${type === 'reminder' ? (String(n.title || "").toLowerCase().includes("reminder") ? 'reminder' : 'notification') : type}`}>
                                 {type === 'reminder' ? (String(n.title || "").toLowerCase().includes("reminder") ? 'reminder' : 'notification') : (type === 'document' ? 'timesheet' : type)}
                               </span>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Detail View */}
        <div className={`nt-detail ${selectedNotification || isLoadingDetails ? 'mobile-visible' : ''}`}>
          {isLoadingDetails ? (
            <div className="nt-detail-skeleton-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="nt-detail-hd">
                <div className="nt-detail-header-top">
                  <div className="nt-detail-ico nt-skeleton" />
                  <div className="nt-detail-title">
                    <div className="nt-skeleton" style={{ width: '180px', height: '16px' }} />
                    <div className="nt-skeleton" style={{ width: '100px', height: '10px', marginTop: '6px' }} />
                  </div>
                </div>
              </div>
              <div className="nt-detail-body">
                <div className="nt-skeleton" style={{ width: '100%', height: '60px', borderRadius: '8px' }} />
                <div className="nt-detail-info" style={{ marginTop: '12px' }}>
                  <div className="nt-skeleton" style={{ width: '60px', height: '10px', marginBottom: '8px' }} />
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="nt-info-row">
                      <div className="nt-skeleton" style={{ width: '80px', height: '10px' }} />
                      <div className="nt-skeleton" style={{ width: '120px', height: '10px' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="nt-action-card">
                <div className="nt-skeleton" style={{ width: '100px', height: '12px', marginBottom: '10px' }} />
                <div className="nt-skeleton" style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
              </div>
            </div>
          ) : selectedNotification ? (
            <>
              <div className="nt-detail-hd">
                <div className="nt-detail-header-top">
                  <button className="nt-back-btn" onClick={() => setSelectedNotification(null)}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <div className="nt-detail-ico">
                    {React.createElement(iconMap[moduleToType(selectedNotification)] || Bell, { size: 20 })}
                  </div>
                  <div className="nt-detail-title">
                    <h2>{selectedNotification.title}</h2>
                    <div className="nt-detail-timestamp">
                      <Clock size={11} /> {new Date(selectedNotification.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="nt-detail-body">
                <div className="nt-detail-content-card">
                  {getEnhancedMessage(selectedNotification, requestDetails)}
                </div>

                {liveRequestStatus === 'ARCHIVED' && (
                  <div style={{ padding: '12px 16px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', color: '#b45309', margin: '12px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>The referenced request or record has been archived or removed from the system.</span>
                  </div>
                )}

                {/* Structured Details Section */}
                {!isReminderOrAlert && (requestDetails || selectedNotification.module) && (
                  <div className="nt-detail-info">
                    <h4 className="nt-section-label">DETAILS</h4>
                    
                    <div className="nt-info-row">
                      <span className="nt-info-label">From</span>
                      <span className="nt-info-value">
                        {requestDetails?.employeeName || 
                         requestDetails?.raisedByName ||
                         (["TASK", "NOTICE", "ASSETS"].includes(String(selectedNotification.module).toUpperCase()) ? (selectedNotification.senderKey || "System") : 
                          (selectedNotification.message.split(' ')[0] + ' ' + selectedNotification.message.split(' ')[1]))}
                      </span>
                    </div>

                    <div className="nt-info-row">
                      <span className="nt-info-label">Employee</span>
                      <span className="nt-info-value">{requestDetails?.employeeIdString || requestDetails?.employeeId || requestDetails?.raisedByUsername || selectedNotification.senderKey || "N/A"}</span>
                    </div>

                    {/* Module specific rows */}
                    {(moduleToType(selectedNotification) === 'assets') && (() => {
                      const assetMatch = selectedNotification.message.match(/assigned asset:\s*([^(]+)\s*\(([^)]+)\)/i) || 
                                         selectedNotification.message.match(/asset:\s*([^(]+)\s*\(([^)]+)\)/i) || 
                                         selectedNotification.message.match(/^([^(]+)\s*\(([^)]+)\)/i);
                      const fallbackAssetName = assetMatch ? assetMatch[1]?.trim() : "N/A";
                      const fallbackAssetCode = assetMatch ? assetMatch[2]?.trim() : "N/A";
                      return (
                        <>
                          <div className="nt-info-row">
                            <span className="nt-info-label">Asset Name</span>
                            <span className="nt-info-value">{requestDetails?.assetName || fallbackAssetName}</span>
                          </div>
                          <div className="nt-info-row">
                            <span className="nt-info-label">Asset Code</span>
                            <span className="nt-info-value">{requestDetails?.assetCode || fallbackAssetCode}</span>
                          </div>
                          {requestDetails?.ticketType && (
                            <div className="nt-info-row">
                              <span className="nt-info-label">Ticket Type</span>
                              <span className="nt-info-value" style={{ textTransform: 'capitalize' }}>
                                {String(requestDetails.ticketType).toLowerCase()}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {moduleToType(selectedNotification) === 'leave' && (
                      <>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Type</span>
                          <span className="nt-info-value">{requestDetails?.leaveType || "Leave"}</span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Duration</span>
                          <span className="nt-info-value">
                            {requestDetails?.duration || 
                             (requestDetails?.startDate && requestDetails?.endDate ? 
                              `${Math.ceil(Math.abs(new Date(requestDetails.endDate) - new Date(requestDetails.startDate)) / (1000 * 60 * 60 * 24)) + 1} day(s)` : 
                              "N/A")}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Dates</span>
                          <span className="nt-info-value">{requestDetails?.startDate && requestDetails?.endDate ? `${new Date(requestDetails.startDate).toLocaleDateString()} - ${new Date(requestDetails.endDate).toLocaleDateString()}` : "N/A"}</span>
                        </div>
                      </>
                    )}

                    {moduleToType(selectedNotification) === 'wfh' && (
                      <>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Duration</span>
                          <span className="nt-info-value">
                            {requestDetails?.duration || 
                             (requestDetails?.startDate && requestDetails?.endDate ? 
                              `${Math.ceil(Math.abs(new Date(requestDetails.endDate) - new Date(requestDetails.startDate)) / (1000 * 60 * 60 * 24)) + 1} day(s)` : 
                              "N/A")}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Dates</span>
                          <span className="nt-info-value">{requestDetails?.startDate && requestDetails?.endDate ? `${new Date(requestDetails.startDate).toLocaleDateString()} - ${new Date(requestDetails.endDate).toLocaleDateString()}` : "N/A"}</span>
                        </div>
                      </>
                    )}

                    {(moduleToType(selectedNotification) === 'document' || moduleToType(selectedNotification) === 'timesheet') && (
                      <>
                        {(selectedNotification.message.includes("Week:") || requestDetails?.weekStartDate) && (
                          <div className="nt-info-row">
                            <span className="nt-info-label">Week</span>
                            <span className="nt-info-value">
                              {selectedNotification.message.match(/Week:\s*([^.]+)/i)?.[1]?.trim() || 
                               formatWeekRange(requestDetails?.weekStartDate, requestDetails?.weekEndDate)}
                            </span>
                          </div>
                        )}
                        {(selectedNotification.message.toLowerCase().includes("hours logged:") || requestDetails?.totalHours) && (
                          <div className="nt-info-row">
                            <span className="nt-info-label">Hours</span>
                            <span className="nt-info-value">
                              {selectedNotification.message.match(/hours logged:\s*([\d.]+h?)/i)?.[1]?.trim() || 
                               (requestDetails?.totalHours ? `${requestDetails.totalHours}h` : "N/A")}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {moduleToType(selectedNotification) === 'expense' && (
                      <>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Amount</span>
                          <span className="nt-info-value">
                            {requestDetails ? 
                              `₹${Number(requestDetails.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 
                             (selectedNotification.message.match(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/)?.[0] || 
                              (selectedNotification.message.match(/of\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/)?.[1] ? `₹${selectedNotification.message.match(/of\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/)?.[1]}` : "N/A"))}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Category</span>
                          <span className="nt-info-value">
                            {requestDetails?.items?.[0]?.category || requestDetails?.category || "Expense Claim"}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Date</span>
                          <span className="nt-info-value">
                            {requestDetails?.submittedAt ? new Date(requestDetails.submittedAt).toLocaleDateString() : 
                             requestDetails?.createdAt ? new Date(requestDetails.createdAt).toLocaleDateString() :
                             new Date(selectedNotification.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}

                    {moduleToType(selectedNotification) === 'task' && (
                      <>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Task</span>
                          <span className="nt-info-value">{requestDetails?.taskName || "N/A"}</span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Project</span>
                          <span className="nt-info-value">{requestDetails?.projectName || "N/A"}</span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Assignee</span>
                          <span className="nt-info-value">
                            {requestDetails?.employeeName
                              ? `${requestDetails.employeeName}${requestDetails.employeeCode ? ` (${requestDetails.employeeCode})` : ""}`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Dates</span>
                          <span className="nt-info-value">
                            {requestDetails?.startDate && requestDetails?.endDate
                              ? `${new Date(requestDetails.startDate).toLocaleDateString()} - ${new Date(requestDetails.endDate).toLocaleDateString()}`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Billable</span>
                          <span className="nt-info-value">{requestDetails?.isBillable ? "Yes" : "No"}</span>
                        </div>
                      </>
                    )}

                    {moduleToType(selectedNotification) === 'announcement' && (
                      <>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Posted By</span>
                          <span className="nt-info-value">{requestDetails?.createdBy || "HR Admin"}</span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Date</span>
                          <span className="nt-info-value">{requestDetails?.createdAt ? new Date(requestDetails.createdAt).toLocaleDateString() : new Date(selectedNotification.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="nt-info-row">
                          <span className="nt-info-label">Affects</span>
                          <span className="nt-info-value">{requestDetails?.category === 'GENERAL' ? "All employees" : (requestDetails?.category || "All employees")}</span>
                        </div>
                      </>
                    )}

                    <div className="nt-info-row">
                      <span className="nt-info-label">Status</span>
                      <span className="nt-info-value" style={{ 
                        color: (liveRequestStatus === 'PENDING' || liveRequestStatus === 'SUBMITTED' || selectedNotification.title.includes('Submitted') || selectedNotification.title.includes('Assigned') || selectedNotification.title.includes('Request')) ? '#f59e0b' : (liveRequestStatus === 'APPROVED' || liveRequestStatus === 'ACTIVE' || selectedNotification.title.includes('Approved') || selectedNotification.title.includes('Announcement') || selectedNotification.title.includes('Notice') || selectedNotification.title.includes('Logged') || selectedNotification.title.includes('Maintenance')) ? '#10b981' : (liveRequestStatus === 'REJECTED' || liveRequestStatus === 'INACTIVE' || selectedNotification.title.includes('Rejected')) ? '#ef4444' : 'inherit'
                      }}>
                        {liveRequestStatus || 
                         (selectedNotification.title.includes('Submitted') ? 'Submitted' : 
                          selectedNotification.title.includes('Approved') ? 'Approved' : 
                          selectedNotification.title.includes('Rejected') ? 'Rejected' : 
                          selectedNotification.title.includes('Assigned') ? 'Assigned' : 
                          (selectedNotification.title.includes('Announcement') || selectedNotification.title.includes('Notice')) ? 'Active' : 
                          (selectedNotification.title.includes('Logged') || selectedNotification.title.includes('Maintenance')) ? 'Logged' :
                          selectedNotification.title.includes('Request') ? 'Pending' : "N/A")}
                      </span>
                    </div>

                    {(requestDetails?.reason || requestDetails?.description || selectedNotification.message.includes("Reason:")) && (
                      <div className="nt-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', borderBottom: 'none' }}>
                        <span className="nt-info-label">Reason</span>
                        <div className="nt-info-reason-box">
                          {requestDetails?.reason || requestDetails?.description || selectedNotification.message.match(/Reason: ([^.]+)/)?.[1] || "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="nt-action-card">
                <h3><MousePointer2 size={12} /> QUICK ACTIONS</h3>
                
                {actionStatus && (
                  <div className={`nt-status-msg ${actionStatus.type}`}>
                    {actionStatus.message}
                  </div>
                )}

                {/* Quick Action UI for Leave/WFH */}
                {(["LEAVE", "WFH", "WFH_REQUEST", "LEAVE_REQUEST", "TIMESHEET"].includes(String(selectedNotification.module).toUpperCase()) && 
                  !isReminderOrAlert &&
                  selectedNotification.referenceId &&
                  !selectedNotification.processed &&
                  (liveRequestStatus === "PENDING" || liveRequestStatus === "SUBMITTED" || (!liveRequestStatus && !["LEAVE_REQUEST_APPROVED", "LEAVE_REQUEST_REJECTED", "WFH_REQUEST_APPROVED", "WFH_REQUEST_REJECTED"].includes(selectedNotification.eventType)))) && (
                  <div className="nt-quick-action-ui">
                    <textarea
                      className="nt-response-area"
                      placeholder="Write your response here..."
                      value={actionComment}
                      onChange={(e) => setActionComment(e.target.value)}
                      disabled={isApproving || isRejecting}
                    />
                    <div className="nt-action-btns">
                      <button 
                        className="nt-btn nt-btn-approve" 
                        onClick={() => handleQuickAction("APPROVE")}
                        disabled={isApproving || isRejecting || !actionComment.trim()}
                      >
                        {isApproving ? <Loader2 className="nt-spin-ico" size={16} /> : <Check size={16} />}
                        <span>{isApproving ? "Approving..." : "Approve"}</span>
                      </button>
                      <button 
                        className="nt-btn nt-btn-reject" 
                        onClick={() => handleQuickAction("REJECT")}
                        disabled={isApproving || isRejecting || !actionComment.trim()}
                      >
                        {isRejecting ? <Loader2 className="nt-spin-ico" size={16} /> : <X size={16} />}
                        <span>{isRejecting ? "Rejecting..." : "Reject"}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="nt-secondary-actions" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!isReminderOrAlert && (
                    <button
                      className="nt-btn nt-btn-view"
                      style={{ background: '#2563eb', color: '#fff', border: 'none', width: '100%' }}
                      onClick={() => {
                        const link = getNotificationLink(selectedNotification, sessionType, userRole);
                        if (link) {
                          setIsLoadingDetails(false);
                          setSelectedNotification(null);
                          setRequestDetails(null);
                          setLiveRequestStatus(null);
                          setActionStatus(null);
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          navigate(link);
                        }
                      }}
                    >
                      <ExternalLink size={14} />{" "}
                      {moduleToType(selectedNotification) === "task"
                        ? "Go to Planner"
                        : moduleToType(selectedNotification) === "timesheet"
                        ? "View in Timesheet Module"
                        : `View in ${selectedNotification.module} Module`}
                    </button>
                  )}
                  
                  <button
                    className="nt-btn nt-btn-dismiss"
                    style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', width: '100%' }}
                    onClick={() => {
                      if (!selectedNotification.read) markAsRead(selectedNotification.id);
                      setSelectedNotification(null);
                    }}
                  >
                    <Trash2 size={14} /> Dismiss
                  </button>
                </div>

                {(selectedNotification.processed || 
                  ["APPROVED", "REJECTED", "CANCELLED"].includes(liveRequestStatus) || 
                  ["LEAVE_REQUEST_APPROVED", "LEAVE_REQUEST_REJECTED", "WFH_REQUEST_APPROVED", "WFH_REQUEST_REJECTED", "LEAVE_REQUEST_CANCELLED", "WFH_REQUEST_CANCELLED"].includes(selectedNotification.eventType)) && (
                  <div className="nt-processed-badge" style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}>
                    <CheckCircle2 size={12} /> {
                      (liveRequestStatus === "APPROVED" || ["LEAVE_REQUEST_APPROVED", "WFH_REQUEST_APPROVED"].includes(selectedNotification.eventType)) ? "Request Approved" : 
                      (liveRequestStatus === "REJECTED" || ["LEAVE_REQUEST_REJECTED", "WFH_REQUEST_REJECTED"].includes(selectedNotification.eventType)) ? "Request Rejected" : 
                      (liveRequestStatus === "CANCELLED" || ["LEAVE_REQUEST_CANCELLED", "WFH_REQUEST_CANCELLED"].includes(selectedNotification.eventType)) ? "Request Cancelled" : "Request Processed"
                    }
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="nt-empty">
              <LayoutGrid size={40} opacity={0.2} />
              <h3>Select a notification</h3>
              <p>Choose an item to view details and take actions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
