import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  FileCheck,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  MessageSquare,
  Sparkles
} from 'lucide-react';

export const GradingQueue: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [grade, setGrade] = useState('95');
  const [feedback, setFeedback] = useState('Excellent implementation of recursive chunking and metadata preservation!');
  const [isGrading, setIsGrading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch courses and their assignment submissions
    api.get('/courses')
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
          return api.get(`/assignments/assignments/${asgnId}/submissions`);
        }
        return null;
      })
      .then(res => {
        if (res && res.data) {
          setSubmissions(res.data);
        }
      })
      .catch(err => console.error('Failed to load submissions:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setIsGrading(true);
    try {
      const res = await api.put(`/submissions/submissions/${selectedSub.id}/grade`, {
        grade: parseFloat(grade),
        feedback,
      });

      setSubmissions(prev => prev.map(s => (s.id === selectedSub.id ? { ...s, grade: res.data.grade, feedback: res.data.feedback } : s)));
      setSelectedSub(null);
    } catch (err) {
      console.error('Grading error:', err);
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6 py-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Assignment Grading Queue</h1>
        <p className="text-slate-400 text-sm">
          Review student code, architecture diagrams, and assign rubric scores with personalized feedback.
        </p>
      </div>

      {submissions.length === 0 && !isLoading ? (
        <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
          <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Queue is clear</h3>
          <p className="text-xs text-slate-400">No pending student submissions to grade at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <div
              key={sub.id}
              className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={sub.student_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                  alt={sub.student_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {sub.student_name}
                    {sub.grade != null ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Graded ({sub.grade}%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        Needs Grading
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Submitted: {new Date(sub.submitted_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  onClick={() => {
                    setSelectedSub(sub);
                    setGrade(sub.grade ? String(sub.grade) : '95');
                    setFeedback(sub.feedback || 'Excellent execution on chunk boundaries and context retrieval.');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  {sub.grade != null ? 'Edit Grade & Feedback' : 'Grade Submission'}
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
              <h3 className="text-base font-bold text-white">
                Grade Submission: {selectedSub.student_name}
              </h3>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Submission Preview */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
              {selectedSub.text_submission || 'File submission attached.'}
            </div>

            <form onSubmit={handleGradeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Grade (0 - 100%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20"
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
