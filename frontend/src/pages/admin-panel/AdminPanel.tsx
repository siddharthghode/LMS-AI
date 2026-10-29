import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import {
  ShieldCheck,
  Users,
  BookOpen,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp,
  Sparkles,
  Flag,
  Trash2,
  Check,
  Server,
  Activity,
  Cpu,
  RefreshCw,
  DollarSign,
  Search,
  Filter,
  UserX,
  UserCheck,
  Eye,
  MessageSquare,
  Award
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const location = useLocation();
  const { user: currentUser } = useAuth();

  const initialTab = location.pathname.includes('/admin/jobs')
    ? 'jobs'
    : location.pathname.includes('/admin/moderation')
    ? 'moderation'
    : location.pathname.includes('/admin/approvals')
    ? 'approvals'
    : location.pathname.includes('/admin/users')
    ? 'users'
    : 'overview';

  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'users' | 'moderation' | 'audit' | 'jobs'>(initialTab);
  const [metrics, setMetrics] = useState<any>(null);
  const [pendingCourses, setPendingCourses] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [isDispatchingStreak, setIsDispatchingStreak] = useState(false);
  const [jobMessage, setJobMessage] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // User filter states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // Modal for approval feedback
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('Meets platform pedagogical standards and high technical quality.');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      api.get('/admin/analytics/overview'),
      api.get('/admin/courses/pending'),
      api.get('/admin/users'),
      api.get('/admin/audit-logs'),
      api.get('/admin/moderation/flagged-posts'),
      api.get('/admin/jobs/status').catch(() => ({ data: { queues: null } })),
    ])
      .then(([overviewRes, pendingRes, usersRes, auditRes, flaggedRes, jobsRes]) => {
        setMetrics(overviewRes.data);
        setPendingCourses(pendingRes.data);
        setUsersList(usersRes.data);
        setAuditLogs(auditRes.data);
        setFlaggedPosts(flaggedRes.data);
        if (jobsRes?.data?.queues) {
          setQueueStats(jobsRes.data.queues);
        }
      })
      .catch(err => console.error('Admin panel load failed:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunStreakNow = async () => {
    setIsDispatchingStreak(true);
    setJobMessage('');
    try {
      const res = await api.post('/admin/jobs/streaks/run');
      setJobMessage(`Success: ${res.data.message || 'Streak evaluation job dispatched'} (Job ID: ${res.data.job_id})`);
      const statsRes = await api.get('/admin/jobs/status');
      setQueueStats(statsRes.data?.queues);
    } catch (err: any) {
      setJobMessage(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsDispatchingStreak(false);
    }
  };

  // Moderate reported forum post: Dismiss Flag (approve)
  const handleDismissFlag = async (postId: string) => {
    try {
      await api.put(`/admin/moderation/posts/${postId}/dismiss`);
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      showToast('Flag dismissed successfully. Post approved.');
    } catch (err) {
      console.error('Failed to dismiss flag:', err);
    }
  };

  // Moderate reported forum post: Delete post
  const handleDeleteFlaggedPost = async (postId: string) => {
    if (!confirm('Are you sure you want to permanently delete this reported comment/post?')) return;
    try {
      await api.delete(`/admin/moderation/posts/${postId}`);
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      showToast('Offending comment/post permanently removed.');
    } catch (err) {
      console.error('Failed to delete flagged post:', err);
    }
  };

  // Approve or Reject Course
  const handleCourseDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      await api.post(`/admin/courses/${selectedCourse.id}/approve`, {
        decision,
        comment,
      });
      const courseTitle = selectedCourse.title;
      setSelectedCourse(null);
      setPendingCourses(prev => prev.filter(c => c.id !== selectedCourse.id));
      showToast(`Course "${courseTitle}" marked as ${decision.toUpperCase()}.`);
      loadData();
    } catch (err: any) {
      console.error('Decision error:', err);
      alert(err.response?.data?.error?.message || 'Failed to submit course review decision');
    }
  };

  // Assign or Revoke User Role
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser?.id && newRole !== 'admin') {
      alert('You cannot revoke your own admin role.');
      return;
    }
    try {
      const res = await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsersList(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      showToast(`User role updated to ${newRole}`);
    } catch (err: any) {
      console.error('Role update error:', err);
      alert(err.response?.data?.error?.message || 'Failed to update user role');
    }
  };

  // Suspend or Activate User Account
  const handleSuspendToggle = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.id && currentStatus === true) {
      alert('You cannot suspend your own admin account.');
      return;
    }
    try {
      await api.put(`/admin/users/${userId}/suspend`, { is_active: !currentStatus });
      setUsersList(prev => prev.map(u => (u.id === userId ? { ...u, is_active: !currentStatus } : u)));
      showToast(`User account ${!currentStatus ? 'activated' : 'suspended'}`);
    } catch (err: any) {
      console.error('Suspend toggle error:', err);
      alert(err.response?.data?.error?.message || 'Failed to update suspension status');
    }
  };

  // Delete User Account
  const handleDeleteUser = async (user: any) => {
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own admin account.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete user "${user.full_name}" (${user.email})? This action will cascade and remove their enrollment records.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsersList(prev => prev.filter(u => u.id !== user.id));
      showToast(`User "${user.full_name}" was permanently deleted.`);
    } catch (err: any) {
      console.error('Delete user error:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  // Filtered users list
  const filteredUsers = usersList.filter(u => {
    const matchesSearch = !userSearch || (
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || (
      userStatusFilter === 'active' ? u.is_active : !u.is_active
    );
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 py-6 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-indigo-950 border border-indigo-500/40 text-indigo-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Title & Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Platform Governance Console
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin & Operations</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage course approval lifecycle, directory governance, community moderation, and platform metrics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold flex-wrap">
          {[
            { id: 'overview', label: 'Platform Metrics' },
            { id: 'approvals', label: `Course Approvals (${pendingCourses.length})` },
            { id: 'users', label: `User Directory (${usersList.length})` },
            { id: 'moderation', label: `Moderation (${flaggedPosts.length})` },
            { id: 'audit', label: 'Audit Trail' },
            { id: 'jobs', label: 'Background Jobs' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Platform-wide Metrics (FR-AD3: DAU, enrollments, completion rate, revenue) */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Primary 4 Core Platform Metrics specified by PRD */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Core Platform Vital Metrics
              </h2>
              <span className="text-[11px] text-slate-500">Updated in real-time</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: DAU (Daily Active Users) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 shadow-xl space-y-2 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Daily Active Users (DAU)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {metrics.metrics.dau ?? metrics.metrics.total_users}
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active learners and educators in last 24h
                </p>
              </div>

              {/* Metric 2: Total Enrollments */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 shadow-xl space-y-2 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Enrollments
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {metrics.metrics.enrollments ?? metrics.metrics.total_enrollments}
                </div>
                <p className="text-[11px] text-slate-400">
                  Total student enrollments across all approved courses
                </p>
              </div>

              {/* Metric 3: Completion Rate */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 shadow-xl space-y-2 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Completion Rate
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {metrics.metrics.completion_rate ?? 0}%
                </div>
                <p className="text-[11px] text-slate-400">
                  {metrics.metrics.completed_enrollments ?? 0} enrollments at 100% progress
                </p>
              </div>

              {/* Metric 4: Platform Revenue */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 shadow-xl space-y-2 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Gross Revenue
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-400 tracking-tight">
                  ${Number(metrics.metrics.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">
                  Cumulative course sales & tuition collections
                </p>
              </div>
            </div>
          </div>

          {/* Secondary Stats Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-medium">Registered Accounts</div>
              <div className="text-xl font-bold text-white mt-1">{metrics.metrics.total_users}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-medium">Published Courses</div>
              <div className="text-xl font-bold text-white mt-1">{metrics.metrics.total_courses}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-medium">AI Tutor Messages</div>
              <div className="text-xl font-bold text-indigo-400 mt-1">{metrics.metrics.total_ai_interactions}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-medium">Quizzes Evaluated</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{metrics.metrics.total_quizzes_taken}</div>
            </div>
          </div>

          {/* Category Distribution & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Course Catalog Distribution by Category
              </h3>
              <div className="space-y-2">
                {metrics.categories.map((c: any) => (
                  <div key={c.category} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-300 font-medium">{c.category}</span>
                    <span className="font-bold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/10">
                      {c.count} {c.count === 1 ? 'course' : 'courses'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Recent System Operations & Audit Events
              </h3>
              <div className="space-y-2">
                {metrics.recent_activity.slice(0, 5).map((act: any) => (
                  <div key={act.id} className="text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{act.actor_name || 'System Operator'}</span>
                      <span className="text-slate-400"> dispatched </span>
                      <span className="font-mono text-indigo-400">{act.action}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(act.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Course Approvals (FR-AD1: Admin can approve/reject newly submitted course) */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Curriculum Review & Approval Queue
              </h2>
              <p className="text-xs text-slate-400">
                Newly submitted courses remain in pending review status until approved by an administrator before appearing in the public catalog.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendingCourses.length} Pending Approval{pendingCourses.length === 1 ? '' : 's'}
            </span>
          </div>

          {pendingCourses.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800 space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-white">Course approval queue is clear</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All instructor submitted courses have been thoroughly reviewed, approved, or rejected.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCourses.map(c => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={c.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe'}
                      alt={c.title}
                      className="w-24 h-24 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          Pending Approval
                        </span>
                        <span className="text-xs font-semibold text-indigo-400">{c.category}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400 capitalize">{c.difficulty}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs font-bold text-emerald-400">
                          {Number(c.price) > 0 ? `$${Number(c.price).toFixed(2)} (${c.pricing_tier || 'tier'})` : 'Free Tier'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{c.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{c.description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span>Instructor: <strong className="text-slate-300">{c.instructor_name}</strong> ({c.instructor_email})</span>
                        <span>•</span>
                        <span>{c.modules_count || 0} Modules</span>
                        <span>•</span>
                        <span>{c.lectures_count || 0} Lectures</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setDecision('approved');
                        setComment('Approved: Course content and syllabus meet platform instructional standards.');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Course
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setDecision('rejected');
                        setComment('Rejected: Requires additional video lectures and detailed transcript grounding.');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: User Directory (FR-AD2: view/suspend/delete user accounts; FR-AD4: assign/revoke roles) */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                User Account Directory & Role Governance
              </h2>
              <p className="text-xs text-slate-400">
                Inspect registered users, manage active/suspended account statuses, assign/revoke roles (student, instructor, admin), and delete user records.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {filteredUsers.length} of {usersList.length} Accounts
            </span>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="relative">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="instructor">Instructors</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div className="relative">
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Role Assignment</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Enrollments</th>
                    <th className="p-4">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No user accounts match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                                alt={u.full_name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{u.full_name}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold border border-indigo-500/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Assignment (FR-AD4: student/instructor/admin) */}
                          <td className="p-4">
                            <select
                              value={u.role}
                              disabled={isSelf}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className={`bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white capitalize focus:outline-none focus:border-indigo-500 cursor-pointer ${
                                isSelf ? 'opacity-60 cursor-not-allowed' : ''
                              }`}
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Administrator</option>
                            </select>
                          </td>

                          {/* Account Status (FR-AD2: suspend/active) */}
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                              u.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              {u.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>

                          <td className="p-4 text-slate-300 font-semibold">
                            {u.enrolled_courses_count || 0}
                          </td>

                          {/* Governance Actions (FR-AD2: Suspend, Delete) */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {/* Suspend / Activate Button */}
                              <button
                                onClick={() => handleSuspendToggle(u.id, u.is_active)}
                                disabled={isSelf}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors inline-flex items-center gap-1 ${
                                  isSelf
                                    ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                                    : u.is_active
                                    ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                    : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={isSelf ? 'Cannot suspend own account' : u.is_active ? 'Suspend account' : 'Activate account'}
                              >
                                {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                <span>{u.is_active ? 'Suspend' : 'Activate'}</span>
                              </button>

                              {/* Delete User Button (FR-AD2: delete) */}
                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isSelf}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors inline-flex items-center gap-1 ${
                                  isSelf
                                    ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                                    : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                }`}
                                title={isSelf ? 'Cannot delete own account' : 'Permanently delete user'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Community Content Moderation (FR-AD5: moderate reported forum posts/comments) */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-400" />
                Community Content Moderation Queue
              </h2>
              <p className="text-xs text-slate-400">
                Review flagged discussion posts and forum comments reported by learners or instructors. Dismiss unwarranted reports or purge violating content.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {flaggedPosts.length} Pending {flaggedPosts.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </div>

          {flaggedPosts.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800 space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-white">Moderation queue is clear</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                There are no flagged comments or reported discussions requiring administrative moderation.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {flaggedPosts.map(post => (
                <div
                  key={post.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          Reported Content
                        </span>
                        <span className="text-xs font-bold text-white">Course: {post.course_title || 'Enrolled Course'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">Discussion Thread: <strong>{post.thread_title}</strong></span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Author: <strong className="text-slate-200">{post.author_name}</strong> ({post.author_email})</span>
                        <span>•</span>
                        <span>Flagged at {new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDismissFlag(post.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Dismiss Report
                      </button>
                      <button
                        onClick={() => handleDeleteFlaggedPost(post.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold border border-red-500/30 transition-all shadow-md shadow-red-600/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Purge Offending Post
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono">
                    "{post.content}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                Immutable System Audit Logs
              </h2>
              <p className="text-xs text-slate-400">
                Tamper-resistant audit record capturing all operational decisions, approvals, role mutations, and deletions.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {auditLogs.length} Recent Logs
            </span>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Entity</th>
                    <th className="p-4">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-4 font-semibold text-white whitespace-nowrap">{log.actor_name || 'System Operator'}</td>
                      <td className="p-4 font-mono text-indigo-400 whitespace-nowrap">{log.action}</td>
                      <td className="p-4 text-slate-300 capitalize">{log.entity}</td>
                      <td className="p-4 text-slate-400 font-mono text-[11px] truncate max-w-sm">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Background Jobs */}
      {activeTab === 'jobs' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                Asynchronous Job Queues (BullMQ & Redis)
              </h2>
              <p className="text-xs text-slate-400">
                Inspect background workers, pending/completed tasks, and trigger scheduled maintenance crons manually.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  api.get('/admin/jobs/status')
                    .then(res => setQueueStats(res.data?.queues))
                    .catch(err => console.error('Failed to refresh queue stats:', err));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={handleRunStreakNow}
                disabled={isDispatchingStreak}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all"
              >
                <Activity className="w-3.5 h-3.5" />
                {isDispatchingStreak ? 'Dispatched...' : 'Trigger Daily Streak Evaluation'}
              </button>
            </div>
          </div>

          {jobMessage && (
            <div className={`p-4 rounded-2xl text-xs font-medium border ${
              jobMessage.startsWith('Success')
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              {jobMessage}
            </div>
          )}

          {/* Queue Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Daily Streak Queue</h3>
                    <div className="text-[11px] text-slate-400">Cron: Midnight UTC</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Waiting</div>
                  <div className="text-base font-bold text-white">{queueStats?.streak?.waiting ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Completed</div>
                  <div className="text-base font-bold text-emerald-400">{queueStats?.streak?.completed ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Failed</div>
                  <div className="text-base font-bold text-red-400">{queueStats?.streak?.failed ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Lecture Ingestion Queue</h3>
                    <div className="text-[11px] text-slate-400">pgvector Chunking</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Waiting</div>
                  <div className="text-base font-bold text-white">{queueStats?.ingestion?.waiting ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Completed</div>
                  <div className="text-base font-bold text-emerald-400">{queueStats?.ingestion?.completed ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Failed</div>
                  <div className="text-base font-bold text-red-400">{queueStats?.ingestion?.failed ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Server className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Notification Queue</h3>
                    <div className="text-[11px] text-slate-400">Learner Broadcasts</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Waiting</div>
                  <div className="text-base font-bold text-white">{queueStats?.notification?.waiting ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Completed</div>
                  <div className="text-base font-bold text-emerald-400">{queueStats?.notification?.completed ?? 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Failed</div>
                  <div className="text-base font-bold text-red-400">{queueStats?.notification?.failed ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Approval Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${decision === 'approved' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <h3 className="text-base font-bold text-white capitalize">
                {decision} Course: {selectedCourse.title}
              </h3>
            </div>

            <form onSubmit={handleCourseDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Review Feedback to Instructor (sent via Notification)
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                    decision === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                  }`}
                >
                  Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
