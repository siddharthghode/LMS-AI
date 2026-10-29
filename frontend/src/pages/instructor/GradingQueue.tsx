import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  FileCheck,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Filter,
  Layers,
  BookOpen
} from 'lucide-react';

export const GradingQueue: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded'>('all');
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [grade, setGrade] = useState('95');
  const [feedback, setFeedback] = useState('Excellent implementation of recursive chunking and metadata preservation!');
  const [isGrading, setIsGrading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubmissions = () => {
    setIsLoading(true);
    api.get('/assignments/queue')
      .then(res => {
        setSubmissions(res.data || []);
      })
      .catch(() => {
        // Fallback to course-by-course search
        return api.get('/courses')
          .then(res => {
            if (res.data.data?.length > 0) {
              const courseId = res.data.data[0].id;
              return api.get(`/assignments/courses/${courseId}/assignments`);
            }
            return null;
          })
          .then(res => {
            if (res && res.data?.length > 0) {
              const asgnId = res.data[0].id;
              return api.get(`/assignments/${asgnId}/submissions`);
            }
            return null;
          })
          .then(res => {
            if (res && res.data) {
              setSubmissions(res.data);
            }
          });
      })
      .catch(err => console.error('Failed to load submissions:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setIsGrading(true);
    try {
      const res = await api.put(`/submissions/${selectedSub.id}/grade`, {
        grade: parseFloat(grade),
        feedback,
      }).catch(() => api.put(`/assignments/submissions/${selectedSub.id}/grade`, {
        grade: parseFloat(grade),
        feedback,
      }));

      setSubmissions(prev =>
        prev.map(s => (s.id === selectedSub.id ? { ...s, grade: res.data.grade, feedback: res.data.feedback } : s))
      );
      setSelectedSub(null);
    } catch (err) {
      console.error('Grading error:', err);
    } finally {
      setIsGrading(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'pending') return sub.grade == null;
    if (filter === 'graded') return sub.grade != null;
    return true;
  });

  const pendingCount = submissions.filter(s => s.grade == null).length;
  const gradedCount = submissions.filter(s => s.grade != null).length;

  return (
    <div className="space-y-6 py-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <FileCheck className="w-3.5 h-3.5" />
            Instructor Assessment Suite
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Assignment Grading Queue</h1>
          <p className="text-slate-400 text-xs mt-1">
            Review student code, architecture diagrams, and assign rubric scores with personalized feedback.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({submissions.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('graded')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'graded' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Graded ({gradedCount})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700" />
                <div className="space-y-2">
                  <div className="w-40 h-4 bg-slate-700 rounded" />
                  <div className="w-60 h-3 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="w-28 h-8 bg-slate-700 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
          <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Queue is clear</h3>
          <p className="text-xs text-slate-400">
            {filter === 'pending'
              ? 'All student submissions have been graded and evaluated!'
              : 'No student submissions found matching this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map(sub => (
            <div
              key={sub.id}
              className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                <img
                  src={sub.student_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                  alt={sub.student_name}
                  className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{sub.student_name}</span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="text-xs font-semibold text-indigo-400">{sub.assignment_title || 'Course Assignment'}</span>
                    {sub.grade != null ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Score: {sub.grade}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Needs Grading
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                    {sub.course_title && (
                      <>
                        <span className="text-slate-300 font-medium">{sub.course_title}</span>
                        <span className="text-slate-600">•</span>
                      </>
                    )}
                    <span>Submitted: {new Date(sub.submitted_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {sub.file_url && (
                  <a
                    href={sub.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    Code Link
                  </a>
                )}
                <button
                  onClick={() => {
                    setSelectedSub(sub);
                    setGrade(sub.grade != null ? String(sub.grade) : '95');
                    setFeedback(sub.feedback || 'Excellent execution on chunk boundaries and context retrieval.');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  {sub.grade != null ? 'Edit Grade' : 'Grade Submission'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grading Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Grade Submission: {selectedSub.student_name}
                </h3>
                <p className="text-xs text-slate-400">{selectedSub.assignment_title}</p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Submission Preview */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Student Written Submission:
              </label>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                {selectedSub.text_submission || 'File submission attached.'}
              </div>
            </div>

            {selectedSub.file_url && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-indigo-300">
                <ExternalLink className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">Attached URL: {selectedSub.file_url}</span>
                <a
                  href={selectedSub.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto underline text-white font-semibold shrink-0"
                >
                  Open ↗
                </a>
              </div>
            )}

            <form onSubmit={handleGradeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Grade (0 - 100%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Instructor Feedback</label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGrading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  {isGrading ? 'Saving Grade...' : 'Save & Notify Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};