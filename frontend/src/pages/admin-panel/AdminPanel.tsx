import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
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
  Check
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const location = useLocation();
  const initialTab = location.pathname.includes('/admin/moderation')
    ? 'moderation'
    : location.pathname.includes('/admin/approvals')
    ? 'approvals'
    : location.pathname.includes('/admin/users')
    ? 'users'
    : 'overview';

  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'users' | 'moderation' | 'audit'>(initialTab);
  const [metrics, setMetrics] = useState<any>(null);
  const [pendingCourses, setPendingCourses] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal for approval feedback
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('Meets platform pedagogical standards and high technical quality.');

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      api.get('/admin/analytics/overview'),
      api.get('/admin/courses/pending'),
      api.get('/admin/users'),
      api.get('/admin/audit-logs'),
      api.get('/admin/moderation/flagged-posts'),
    ])
      .then(([overviewRes, pendingRes, usersRes, auditRes, flaggedRes]) => {
        setMetrics(overviewRes.data);
        setPendingCourses(pendingRes.data);
        setUsersList(usersRes.data);
        setAuditLogs(auditRes.data);
        setFlaggedPosts(flaggedRes.data);
      })
      .catch(err => console.error('Admin panel load failed:', err))
      .finally(() => setIsLoading(false));
  };

  const handleDismissFlag = async (postId: string) => {
    try {
      await api.put(`/admin/moderation/posts/${postId}/dismiss`);
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to dismiss flag:', err);
    }
  };

  const handleDeleteFlaggedPost = async (postId: string) => {
    if (!confirm('Are you sure you want to permanently delete this reported post?')) return;
    try {
      await api.delete(`/admin/moderation/posts/${postId}`);
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete flagged post:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCourseDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      await api.post(`/courses/${selectedCourse.id}/approve`, {
        decision,
        comment,
      });
      setSelectedCourse(null);
      loadData();
    } catch (err) {
      console.error('Decision error:', err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsersList(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      console.error('Role update error:', err);
    }
  };

  const handleSuspendToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/suspend`, { is_active: !currentStatus });
      setUsersList(prev => prev.map(u => (u.id === userId ? { ...u, is_active: !currentStatus } : u)));
    } catch (err) {
      console.error('Suspend toggle error:', err);
    }
  };

  return (
    <div className="space-y-6 py-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Platform Governance Console
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin & Operations</h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Platform Stats' },
            { id: 'approvals', label: `Pending Approvals (${pendingCourses.length})` },
            { id: 'users', label: 'User Directory' },
            { id: 'moderation', label: `Moderation (${flaggedPosts.length})` },
            { id: 'audit', label: 'Audit Trail' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Total Users</div>
              <div className="text-2xl font-black text-white">{metrics.metrics.total_users}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Courses</div>
              <div className="text-2xl font-black text-white">{metrics.metrics.total_courses}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Enrollments</div>
              <div className="text-2xl font-black text-emerald-400">{metrics.metrics.total_enrollments}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Completions</div>
              <div className="text-2xl font-black text-purple-400">{metrics.metrics.completed_enrollments}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">AI Interactions</div>
              <div className="text-2xl font-black text-indigo-400">{metrics.metrics.total_ai_interactions}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Quizzes Taken</div>
              <div className="text-2xl font-black text-amber-400">{metrics.metrics.total_quizzes_taken}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Course Distribution by Category</h3>
              <div className="space-y-2">
                {metrics.categories.map((c: any) => (
                  <div key={c.category} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900">
                    <span className="text-slate-300">{c.category}</span>
                    <span className="font-bold text-emerald-400">{c.count} courses</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Recent System Activities</h3>
              <div className="space-y-2">
                {metrics.recent_activity.slice(0, 5).map((act: any) => (
                  <div key={act.id} className="text-xs p-2.5 rounded-lg bg-slate-900 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{act.actor_name || 'System'}</span>
                      <span className="text-slate-400"> performed </span>
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

      {/* Course Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {pendingCourses.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">Approval queue empty</h3>
              <p className="text-xs text-slate-400">All submitted courses have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCourses.map(c => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="w-20 h-20 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          Pending Review
                        </span>
                        <span className="text-xs text-slate-400">{c.category} • {c.difficulty}</span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{c.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-1">Instructor: {c.instructor_name} ({c.instructor_email})</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setDecision('approved');
                        setComment('Content validated. High quality technical curriculum and verified transcripts.');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setDecision('rejected');
                        setComment('Requires additional lecture transcripts for vector search grounding.');
                      }}
                      className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Directory Tab */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-slate-800/40 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Enrolled Courses</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                          alt={u.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-white">{u.full_name}</div>
                          <div className="text-slate-400 text-[11px]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white capitalize focus:outline-none focus:border-indigo-500"
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      {u.enrolled_courses_count || 0}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleSuspendToggle(u.id, u.is_active)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${
                          u.is_active
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl bg-slate-800/40 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
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
                  <tr key={log.id} className="hover:bg-slate-800/50">
                    <td className="p-4 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-4 font-semibold text-white">{log.actor_name || 'System'}</td>
                    <td className="p-4 font-mono text-indigo-400">{log.action}</td>
                    <td className="p-4 text-slate-300 capitalize">{log.entity}</td>
                    <td className="p-4 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-400" />
                Community Content Moderation Queue
              </h2>
              <p className="text-xs text-slate-400">
                Review flagged discussion posts reported by learners or instructors. Dismiss false flags or purge violating content.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {flaggedPosts.length} Pending {flaggedPosts.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </div>

          {flaggedPosts.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">Queue is clear</h3>
              <p className="text-xs text-slate-400">There are no flagged comments or reported discussions requiring moderation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedPosts.map(post => (
                <div
                  key={post.id}
                  className="p-5 rounded-2xl bg-slate-800/40 border border-amber-500/20 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Reported Content
                        </span>
                        <span className="text-xs font-bold text-white">Course: {post.course_title || 'Enrolled Course'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">Topic: <strong>{post.thread_title}</strong></span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Author: <strong className="text-slate-300">{post.author_name}</strong> ({post.author_email})</span>
                        <span>•</span>
                        <span>Reported at {new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDismissFlag(post.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Dismiss Flag
                      </button>
                      <button
                        onClick={() => handleDeleteFlaggedPost(post.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold border border-red-500/30 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Post
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono">
                    "{post.content}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Course Approval Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white capitalize">
              {decision} Course: {selectedCourse.title}
            </h3>

            <form onSubmit={handleCourseDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Review Feedback to Instructor</label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md ${
                    decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  Confirm {decision}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
