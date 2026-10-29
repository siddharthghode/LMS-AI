import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { AiTutorDrawer } from '../../components/ai-tutor/AiTutorDrawer';
import {
  Play,
  CheckCircle,
  Circle,
  FileText,
  Bookmark,
  Sparkles,
  HelpCircle,
  Layers,
  ChevronRight,
  Download,
  Award,
  BookOpen,
  MessageSquare,
  MessagesSquare,
  Megaphone,
  Flag,
  Send,
  ChevronLeft,
  Plus,
  Clock,
  Trash2,
  FileQuestion,
  Trophy
} from 'lucide-react';

interface Lecture {
  id: string;
  module_id: string;
  title: string;
  video_url: string;
  transcript: string;
  duration_seconds: number;
  order_index: number;
  resource_urls?: string[];
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lectures: Lecture[];
}

interface Note {
  id: string;
  timestamp_seconds: number;
  content: string;
  created_at: string;
}

interface BookmarkItem {
  id: string;
  timestamp_seconds: number;
  created_at: string;
}

interface DiscussionThread {
  id: string;
  course_id: string;
  created_by: string;
  title: string;
  author_name: string;
  author_avatar?: string;
  post_count: string | number;
  last_activity?: string;
  created_at: string;
}

interface DiscussionPost {
  id: string;
  thread_id: string;
  user_id: string;
  content: string;
  is_flagged: boolean;
  author_name: string;
  author_avatar?: string;
  author_role?: string;
  created_at: string;
}

interface Announcement {
  id: string;
  course_id: string;
  posted_by: string;
  content: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
}

export const CoursePlayer: React.FC = () => {
  const { user } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(null);
  const [completedLectureIds, setCompletedLectureIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript' | 'notes' | 'bookmarks' | 'summary' | 'discussions' | 'announcements' | 'quizzes' | 'assignments' | 'leaderboard'>('overview');
  
  // Notes & Bookmarks
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  // Discussions & Announcements
  const [discussionThreads, setDiscussionThreads] = useState<DiscussionThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<DiscussionThread | null>(null);
  const [threadPosts, setThreadPosts] = useState<DiscussionPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newReplyContent, setNewReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  
  // AI Summary
  const [aiSummary, setAiSummary] = useState<{ summary: string; key_takeaways: string[] } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Quizzes & Assignments for course
  const [courseQuizzes, setCourseQuizzes] = useState<any[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // AI Tutor Drawer
  const [isAiTutorOpen, setIsAiTutorOpen] = useState(false);

  // Video Ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Load course details
  useEffect(() => {
    if (courseId) {
      api.get(`/courses/${courseId}`).then(res => {
        setCourse(res.data);
        setModules(res.data.modules || []);
        if (res.data.modules?.length > 0 && res.data.modules[0].lectures?.length > 0) {
          setCurrentLecture(res.data.modules[0].lectures[0]);
        }
      });

      api.get(`/courses/${courseId}/enrollment-status`).then(res => {
        if (res.data.is_enrolled && res.data.enrollment?.lecture_progress) {
          const completed = new Set<string>(
            res.data.enrollment.lecture_progress
              .filter((lp: any) => lp.completed)
              .map((lp: any) => lp.lecture_id)
          );
          setCompletedLectureIds(completed);
        }
      });

      // Load quizzes, assignments, leaderboard, discussions, announcements
      api.get(`/quizzes/courses/${courseId}/quizzes`).then(res => setCourseQuizzes(res.data)).catch(() => {});
      api.get(`/assignments/courses/${courseId}/assignments`).then(res => setCourseAssignments(res.data)).catch(() => {});
      api.get(`/leaderboard/${courseId}`).then(res => setLeaderboard(res.data)).catch(() => {});
      api.get(`/courses/${courseId}/discussions`).then(res => setDiscussionThreads(res.data)).catch(() => {});
      api.get(`/courses/${courseId}/announcements`).then(res => setAnnouncements(res.data)).catch(() => {});
    }
  }, [courseId]);

  // Load notes and bookmarks when current lecture changes
  useEffect(() => {
    if (currentLecture) {
      api.get(`/lectures/${currentLecture.id}/notes`).then(res => setNotes(res.data)).catch(() => {});
      api.get(`/lectures/${currentLecture.id}/bookmarks`).then(res => setBookmarks(res.data)).catch(() => {});
      setAiSummary(null);
    }
  }, [currentLecture]);

  // Video time tracking
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(Math.floor(videoRef.current.currentTime));
    }
  };

  // Mark lecture as completed
  const handleMarkCompleted = async (lectureId: string) => {
    try {
      await api.post(`/lectures/${lectureId}/progress`, {
        watched_seconds: currentLecture?.duration_seconds || 300,
        completed: true,
      });
      setCompletedLectureIds(prev => new Set([...prev, lectureId]));
    } catch (err) {
      console.error('Failed to update lecture progress:', err);
    }
  };

  // Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !currentLecture) return;

    try {
      const res = await api.post(`/lectures/${currentLecture.id}/notes`, {
        content: newNoteContent,
        timestamp_seconds: currentTime,
      });
      setNotes(prev => [...prev, res.data]);
      setNewNoteContent('');
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  // Add Bookmark
  const handleAddBookmark = async () => {
    if (!currentLecture) return;
    try {
      const res = await api.post(`/lectures/${currentLecture.id}/bookmarks`, {
        timestamp_seconds: currentTime,
      });
      setBookmarks(prev => [...prev, res.data]);
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  };

  // Seek video
  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  // Trigger AI Summary
  const handleGenerateSummary = async () => {
    if (!currentLecture) return;
    setIsSummarizing(true);
    try {
      const res = await api.post(`/ai/lectures/${currentLecture.id}/summarize`);
      setAiSummary(res.data);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Discussions Handlers
  const handleOpenThread = (thread: DiscussionThread) => {
    setSelectedThread(thread);
    setIsLoadingPosts(true);
    api.get(`/discussions/${thread.id}/posts`)
      .then(res => setThreadPosts(res.data))
      .catch(err => console.error('Failed to load posts:', err))
      .finally(() => setIsLoadingPosts(false));
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;
    setIsCreatingThread(true);
    try {
      const res = await api.post(`/courses/${courseId}/discussions`, {
        title: newThreadTitle,
        content: newThreadContent,
      });
      setDiscussionThreads(prev => [res.data, ...prev]);
      setNewThreadTitle('');
      setNewThreadContent('');
      setShowNewThreadForm(false);
      handleOpenThread(res.data);
    } catch (err) {
      console.error('Failed to create thread:', err);
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !newReplyContent.trim()) return;
    setIsSubmittingReply(true);
    try {
      const res = await api.post(`/discussions/${selectedThread.id}/posts`, {
        content: newReplyContent,
      });
      setThreadPosts(prev => [
        ...prev,
        {
          ...res.data,
          author_name: user?.full_name || 'You',
          author_role: user?.role || 'student',
        },
      ]);
      setNewReplyContent('');
      setDiscussionThreads(prev =>
        prev.map(t => (t.id === selectedThread.id ? { ...t, post_count: Number(t.post_count || 0) + 1 } : t))
      );
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleFlagPost = async (postId: string) => {
    try {
      await api.put(`/posts/${postId}/flag`);
      setThreadPosts(prev => prev.map(p => (p.id === postId ? { ...p, is_flagged: true } : p)));
    } catch (err) {
      console.error('Failed to flag post:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setThreadPosts(prev => prev.filter(p => p.id !== postId));
      if (selectedThread) {
        setDiscussionThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? { ...t, post_count: Math.max(0, Number(t.post_count || 1) - 1) } : t))
        );
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Announcements Handler
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementContent.trim()) return;
    setIsPostingAnnouncement(true);
    try {
      const res = await api.post(`/courses/${courseId}/announcements`, {
        content: newAnnouncementContent,
      });
      setAnnouncements(prev => [
        {
          ...res.data,
          author_name: user?.full_name || 'Instructor',
        },
        ...prev,
      ]);
      setNewAnnouncementContent('');
      setShowAnnouncementForm(false);
    } catch (err) {
      console.error('Failed to post announcement:', err);
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  if (!course || !currentLecture) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Loading course player environment...
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition-colors">Courses</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-300 truncate max-w-xs">{course.title}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-emerald-400 font-semibold truncate max-w-xs">{currentLecture.title}</span>
        </div>

        {/* AI Tutor Button */}
        <button
          onClick={() => setIsAiTutorOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all hover:scale-105"
        >
          <Sparkles className="w-4 h-4 text-emerald-200" />
          Ask AI Tutor About This Course
        </button>
      </div>

      {/* Main Grid: Video + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video & Tabs (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <div className="relative rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl aspect-video">
            <video
              ref={videoRef}
              src={currentLecture.video_url}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Action Row Under Video */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white mb-0.5">{currentLecture.title}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatTime(currentLecture.duration_seconds || 300)}
                </span>
                <span>•</span>
                <span>Current position: {formatTime(currentTime)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddBookmark}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                title="Bookmark current timestamp"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                Bookmark @ {formatTime(currentTime)}
              </button>

              <button
                onClick={() => handleMarkCompleted(currentLecture.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  completedLectureIds.has(currentLecture.id)
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {completedLectureIds.has(currentLecture.id) ? 'Completed' : 'Mark as Complete'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'overview', label: 'Overview', icon: BookOpen },
              { id: 'transcript', label: 'Transcript', icon: FileText },
              { id: 'summary', label: 'AI Summary', icon: Sparkles },
              { id: 'notes', label: `Notes (${notes.length})`, icon: MessageSquare },
              { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})`, icon: Bookmark },
              { id: 'discussions', label: `Discussions (${discussionThreads.length})`, icon: MessagesSquare },
              { id: 'announcements', label: `Announcements (${announcements.length})`, icon: Megaphone },
              { id: 'quizzes', label: `Quizzes (${courseQuizzes.length})`, icon: FileQuestion },
              { id: 'assignments', label: `Assignments (${courseAssignments.length})`, icon: Layers },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800 min-h-[220px]">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {course.description}
                </p>
                {currentLecture.resource_urls && currentLecture.resource_urls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Lecture Resources:</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentLecture.resource_urls.map((resUrl, idx) => (
                        <a
                          key={idx}
                          href={resUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 text-xs font-medium text-slate-300 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          Resource #{idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Full Lecture Audio Transcript</span>
                  <button
                    onClick={() => setIsAiTutorOpen(true)}
                    className="text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Ask AI about this transcript
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {currentLecture.transcript || 'No transcript text available for this lecture.'}
                </div>
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="space-y-4">
                {!aiSummary && (
                  <div className="text-center py-6">
                    <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-white mb-1">Generate Instant AI Lecture Summary</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                      Extract key architectural principles, formulas, and takeaways directly from this lecture's transcript.
                    </p>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={isSummarizing}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                    >
                      {isSummarizing ? 'Analyzing lecture...' : 'Generate Summary'}
                    </button>
                  </div>
                )}

                {aiSummary && (
                  <div className="space-y-4 animate-in fade-in">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Executive Summary:</h4>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                        {aiSummary.summary}
                      </p>
                    </div>

                    {aiSummary.key_takeaways && (
                      <div>
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Key Takeaways:</h4>
                        <ul className="space-y-2">
                          {aiSummary.key_takeaways.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <form onSubmit={handleAddNote} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder={`Take a note at ${formatTime(currentTime)}...`}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    Add Note
                  </button>
                </form>

                {notes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No notes created yet for this lecture.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map(note => (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <button
                            onClick={() => seekTo(note.timestamp_seconds)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 mb-1"
                          >
                            <Clock className="w-3 h-3" />
                            {formatTime(note.timestamp_seconds)}
                          </button>
                          <p className="text-slate-300">{note.content}</p>
                        </div>
                        <button
                          onClick={async () => {
                            await api.delete(`/lectures/notes/${note.id}`);
                            setNotes(prev => prev.filter(n => n.id !== note.id));
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookmarks' && (
              <div className="space-y-3">
                {bookmarks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No bookmarks added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bookmarks.map(bm => (
                      <button
                        key={bm.id}
                        onClick={() => seekTo(bm.timestamp_seconds)}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between text-left text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-amber-400" />
                          <span className="font-semibold text-white">Jump to {formatTime(bm.timestamp_seconds)}</span>
                        </div>
                        <Play className="w-3 h-3 text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quizzes' && (
              <div className="space-y-3">
                {courseQuizzes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No quizzes available for this course yet.</p>
                ) : (
                  <div className="space-y-2">
                    {courseQuizzes.map(quiz => (
                      <div
                        key={quiz.id}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white mb-1">{quiz.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {quiz.question_count || 3} Questions • Module: {quiz.module_title}
                          </div>
                        </div>
                        <Link
                          to={`/quizzes/${quiz.id}`}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                        >
                          {quiz.best_score != null ? `Retake (Best: ${quiz.best_score}%)` : 'Take Quiz'}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assignments' && (
              <div className="space-y-3">
                {courseAssignments.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No assignments published for this course yet.</p>
                ) : (
                  <div className="space-y-2">
                    {courseAssignments.map(asgn => (
                      <div
                        key={asgn.id}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white mb-1">{asgn.title}</div>
                          <div className="text-[11px] text-slate-400">
                            Status: {asgn.submission_id ? (asgn.grade != null ? `Graded (${asgn.grade}%)` : 'Submitted') : 'Pending Submission'}
                          </div>
                        </div>
                        <Link
                          to={`/assignments/${asgn.id}`}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                        >
                          View Details
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'discussions' && (
              <div className="space-y-4">
                {selectedThread ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <button
                        onClick={() => setSelectedThread(null)}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back to All Topics
                      </button>
                      <div className="text-[11px] text-slate-500">
                        {threadPosts.length} {threadPosts.length === 1 ? 'post' : 'posts'}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <h3 className="text-sm font-bold text-white">{selectedThread.title}</h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Started by <strong className="text-slate-300">{selectedThread.author_name}</strong></span>
                        <span>•</span>
                        <span>{new Date(selectedThread.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Posts List */}
                    <div className="space-y-3">
                      {isLoadingPosts ? (
                        <div className="text-center py-6 text-xs text-slate-500">Loading discussion posts...</div>
                      ) : threadPosts.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">No posts in this thread yet.</div>
                      ) : (
                        threadPosts.map(post => (
                          <div
                            key={post.id}
                            className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                              post.is_flagged
                                ? 'bg-amber-500/5 border-amber-500/20 text-slate-300'
                                : 'bg-slate-900/80 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                  {post.author_name?.charAt(0) || 'U'}
                                </div>
                                <span className="font-semibold text-white">{post.author_name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  post.author_role === 'instructor'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : post.author_role === 'admin'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {post.author_role || 'student'}
                                </span>
                                <span className="text-[10px] text-slate-500">{new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {post.is_flagged && (
                                  <span className="text-[10px] text-amber-400 font-medium">Flagged</span>
                                )}
                                {!post.is_flagged && (
                                  <button
                                    onClick={() => handleFlagPost(post.id)}
                                    title="Report post as inappropriate"
                                    className="text-slate-500 hover:text-amber-400 transition-colors p-1"
                                  >
                                    <Flag className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(user?.id === post.user_id || ['instructor', 'admin'].includes(user?.role || '')) && (
                                  <button
                                    onClick={() => handleDeletePost(post.id)}
                                    title="Delete post"
                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="leading-relaxed whitespace-pre-wrap text-slate-200">{post.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply Input Form */}
                    <form onSubmit={handleReply} className="pt-2 space-y-2">
                      <textarea
                        value={newReplyContent}
                        onChange={e => setNewReplyContent(e.target.value)}
                        placeholder="Write a constructive reply to this topic..."
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingReply || !newReplyContent.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isSubmittingReply ? 'Posting...' : 'Reply'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Course Discussion Board</h3>
                        <p className="text-[11px] text-slate-400">Ask questions, share insights, and discuss lectures with peers and instructors.</p>
                      </div>
                      <button
                        onClick={() => setShowNewThreadForm(!showNewThreadForm)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Start Topic
                      </button>
                    </div>

                    {/* New Thread Form */}
                    {showNewThreadForm && (
                      <form onSubmit={handleCreateThread} className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3">
                        <h4 className="text-xs font-bold text-white">Start a New Discussion Topic</h4>
                        <input
                          type="text"
                          value={newThreadTitle}
                          onChange={e => setNewThreadTitle(e.target.value)}
                          placeholder="Topic Title (e.g. Question regarding cosine similarity in Lecture 1.2)"
                          className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <textarea
                          value={newThreadContent}
                          onChange={e => setNewThreadContent(e.target.value)}
                          placeholder="Elaborate on your question or discussion point..."
                          rows={3}
                          className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowNewThreadForm(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isCreatingThread || !newThreadTitle.trim() || !newThreadContent.trim()}
                            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold"
                          >
                            {isCreatingThread ? 'Posting...' : 'Create Topic'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Thread List */}
                    {discussionThreads.length === 0 ? (
                      <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-slate-800/80">
                        <MessagesSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-semibold mb-1">No discussions started yet</p>
                        <p className="text-[11px] text-slate-500">Have a question about this course? Click "Start Topic" above!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {discussionThreads.map(thread => (
                          <div
                            key={thread.id}
                            onClick={() => handleOpenThread(thread)}
                            className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all flex items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-white hover:text-indigo-400 transition-colors">{thread.title}</h4>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span>By <strong className="text-slate-400">{thread.author_name}</strong></span>
                                <span>•</span>
                                <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                              <MessagesSquare className="w-3 h-3 text-indigo-400" />
                              <span>{thread.post_count || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Instructor Announcements</h3>
                    <p className="text-[11px] text-slate-400">Important notices, schedule updates, and milestone announcements from course instructors.</p>
                  </div>
                  {['instructor', 'admin'].includes(user?.role || '') && (
                    <button
                      onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Broadcast Notice
                    </button>
                  )}
                </div>

                {/* Announcement Authoring Form */}
                {showAnnouncementForm && (
                  <form onSubmit={handlePostAnnouncement} className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3">
                    <h4 className="text-xs font-bold text-white">Broadcast an Announcement to Enrolled Learners</h4>
                    <textarea
                      value={newAnnouncementContent}
                      onChange={e => setNewAnnouncementContent(e.target.value)}
                      placeholder="Write your announcement message here..."
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAnnouncementForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPostingAnnouncement || !newAnnouncementContent.trim()}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        {isPostingAnnouncement ? 'Broadcasting...' : 'Broadcast'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Announcements List */}
                {announcements.length === 0 ? (
                  <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-slate-800/80">
                    <Megaphone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-semibold mb-1">No announcements yet</p>
                    <p className="text-[11px] text-slate-500">Any announcements published by the course instructor will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map(ann => (
                      <div
                        key={ann.id}
                        className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/20 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                              {ann.author_name?.charAt(0) || 'I'}
                            </div>
                            <span className="font-bold text-white">{ann.author_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              Instructor
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(ann.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="leading-relaxed text-slate-200 whitespace-pre-wrap pl-8">
                          {ann.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Course Leaderboard</div>
                <div className="space-y-1.5">
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-white">{entry.full_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span>Progress: <strong className="text-emerald-400">{entry.progress_percent}%</strong></span>
                        <span>Points: <strong className="text-indigo-400">{entry.total_points}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Course Curriculum Sidebar */}
        <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-4 space-y-4 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Course Curriculum</h3>
              <p className="text-[11px] text-slate-400">
                {completedLectureIds.size} of {modules.reduce((acc, m) => acc + m.lectures.length, 0)} completed
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-400">
              {Math.round((completedLectureIds.size / Math.max(1, modules.reduce((acc, m) => acc + m.lectures.length, 0))) * 100)}%
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {modules.map((mod, modIdx) => (
              <div key={mod.id} className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">
                    {modIdx + 1}
                  </span>
                  <span className="truncate">{mod.title}</span>
                </div>

                <div className="space-y-1 pl-2">
                  {mod.lectures.map((lec) => {
                    const isSelected = currentLecture.id === lec.id;
                    const isCompleted = completedLectureIds.has(lec.id);
                    return (
                      <button
                        key={lec.id}
                        onClick={() => {
                          setCurrentLecture(lec);
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.play();
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{lec.title}</span>
                        </div>
                        <span className="text-[10px] opacity-75 shrink-0 ml-2">
                          {formatTime(lec.duration_seconds || 300)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Tutor Drawer (RAG enabled) */}
      <AiTutorDrawer
        courseId={courseId!}
        isOpen={isAiTutorOpen}
        onClose={() => setIsAiTutorOpen(false)}
        onSeekLecture={(lecId, timestamp) => {
          const target = modules.flatMap(m => m.lectures).find(l => l.id === lecId);
          if (target) {
            setCurrentLecture(target);
            setTimeout(() => seekTo(timestamp), 200);
          }
        }}
      />
    </div>
  );
};
