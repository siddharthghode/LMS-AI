import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  Award,
  ChevronLeft,
  Sparkles,
  Send
} from 'lucide-react';

export const AssignmentView: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<any>(null);
  const [textSubmission, setTextSubmission] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (assignmentId) {
      api.get(`/assignments/${assignmentId}`)
        .then(res => setAssignment(res.data))
        .catch(() => {
          api.get(`/assignments/assignments/${assignmentId}`).then(res => setAssignment(res.data));
        });

      // Check existing submission
      api.get('/submissions/me')
        .then(res => {
          const found = (res.data || []).find((s: any) => s.assignment_id === assignmentId);
          if (found) setExistingSubmission(found);
        })
        .catch(() => {
          api.get('/assignments/submissions/me').then(res => {
            const found = (res.data || []).find((s: any) => s.assignment_id === assignmentId);
            if (found) setExistingSubmission(found);
          });
        });
    }
  }, [assignmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textSubmission.trim() && !fileUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/assignments/${assignmentId}/submit`, {
        text_submission: textSubmission,
        file_url: fileUrl || null,
      });
      setExistingSubmission(res.data);
      setMessage('Assignment submitted successfully! Dr. Priya Sharma will review and grade your work.');
    } catch (err: any) {
      console.error('Submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assignment) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Loading assignment details...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Assignment Card */}
      <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
            Course Assignment
          </div>
          <h1 className="text-2xl font-black text-white">{assignment.title}</h1>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          {assignment.instructions}
        </div>

        {/* Rubric Breakdown */}
        {assignment.rubric && (
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Grading Rubric:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(assignment.rubric).map(([crit, weight]) => (
                <div key={crit} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="text-slate-400 capitalize">{crit.replace(/_/g, ' ')}</div>
                  <div className="text-emerald-400 font-bold">{String(weight)}% Weight</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing Submission or Feedback */}
      {existingSubmission && (
        <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle className="w-5 h-5" /> Submission Received
            </div>
            <span className="text-xs text-slate-400">
              {new Date(existingSubmission.submitted_at).toLocaleDateString()}
            </span>
          </div>

          <div className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            {existingSubmission.text_submission || 'File attachment submitted.'}
          </div>

          {existingSubmission.grade != null ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white">Grade Received:</span>
                <span className="text-base font-black text-emerald-400">{existingSubmission.grade}%</span>
              </div>
              <p className="text-xs text-slate-300 italic">
                Feedback: "{existingSubmission.feedback || 'Great work on this implementation!'}"
              </p>
            </div>
          ) : (
            <div className="text-xs text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Awaiting instructor evaluation
            </div>
          )}
        </div>
      )}

      {/* Submission Form */}
      {!existingSubmission && (
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Your Submission</h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Code or Written Implementation:
            </label>
            <textarea
              rows={8}
              value={textSubmission}
              onChange={(e) => setTextSubmission(e.target.value)}
              placeholder="Paste your implementation script, architecture explanation, or response here..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              External Link or File URL (Optional):
            </label>
            <input
              type="text"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://github.com/username/rag-pipeline"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {message && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              {message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || (!textSubmission.trim() && !fileUrl.trim())}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
