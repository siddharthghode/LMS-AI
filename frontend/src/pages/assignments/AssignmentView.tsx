import React, { useState, useEffect, useRef } from 'react';
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
  Send,
  FileArchive,
  FileCode,
  X,
  ExternalLink,
  Download,
  AlertCircle
} from 'lucide-react';

interface UploadedFileMeta {
  original_name: string;
  size: number;
  url: string;
}

export const AssignmentView: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assignment, setAssignment] = useState<any>(null);
  const [textSubmission, setTextSubmission] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [message, setMessage] = useState('');

  // File upload state (FR-S6)
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileMeta | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploaded: UploadedFileMeta = {
        original_name: res.data.original_name || file.name,
        size: res.data.size || file.size,
        url: res.data.url,
      };

      setUploadedFile(uploaded);
      setFileUrl(uploaded.url);
    } catch (err: any) {
      console.error('File upload failed:', err);
      setUploadError(err.response?.data?.error?.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
        <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle className="w-5 h-5" /> Submission Received
            </div>
            <span className="text-xs text-slate-400">
              {new Date(existingSubmission.submitted_at).toLocaleDateString()}
            </span>
          </div>

          {existingSubmission.text_submission && (
            <div className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 font-mono whitespace-pre-wrap">
              {existingSubmission.text_submission}
            </div>
          )}

          {existingSubmission.file_url && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-200 truncate">
                <FileArchive className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">Attached File Submission</span>
              </div>
              <a
                href={existingSubmission.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> View / Download
              </a>
            </div>
          )}

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
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-5">
          <h3 className="text-sm font-bold text-white">Your Submission</h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Code or Written Implementation:
            </label>
            <textarea
              rows={6}
              value={textSubmission}
              onChange={(e) => setTextSubmission(e.target.value)}
              placeholder="Paste your implementation script, architecture explanation, or response here..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* File Upload Dropzone (FR-S6) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Assignment File Upload (.pdf, .zip, .py, .ts, .js, .docx):
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.zip,.tar.gz,.py,.ts,.js,.tsx,.jsx,.txt,.docx,.md"
              className="hidden"
            />

            {!uploadedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400 mb-3">
                  <Upload className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
                </div>
                <div className="text-xs font-semibold text-white mb-1">
                  {isUploading ? 'Uploading file to server...' : 'Click or drag & drop files here'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Supports PDF reports, project ZIP archives, or source code files (up to 50MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{uploadedFile.original_name}</div>
                    <div className="text-[11px] text-slate-400">{formatFileSize(uploadedFile.size)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={uploadedFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Preview uploaded file"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Or External Repository / Artifact URL (Optional):
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
              disabled={isSubmitting || isUploading || (!textSubmission.trim() && !fileUrl.trim())}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
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
