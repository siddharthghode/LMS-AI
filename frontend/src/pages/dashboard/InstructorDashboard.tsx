import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  BookOpen,
  PlusCircle,
  Users,
  Layers,
  FileCheck,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Edit3,
  BarChart2,
  TrendingUp,
  X,
  FilePlus,
  Calendar,
  Percent,
  Trash2,
  Plus
} from 'lucide-react';

interface RubricItem {
  criterion: string;
  weight: number;
}

export const InstructorDashboard: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics Modal State (FR-I5)
  const [analyticsCourse, setAnalyticsCourse] = useState<any | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Assignment Creator Modal State (FR-I3)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState('');
  const [rubricItems, setRubricItems] = useState<RubricItem[]>([
    { criterion: 'Code Quality & Structure', weight: 40 },
    { criterion: 'Algorithm Correctness & Testing', weight: 35 },
    { criterion: 'Documentation & Architecture', weight: 25 },
  ]);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [assignmentSuccessMsg, setAssignmentSuccessMsg] = useState('');
  const [assignmentErrorMsg, setAssignmentErrorMsg] = useState('');

  const fetchCourses = () => {
    setIsLoading(true);
    setError(null);
    api.get('/courses', { params: { limit: 50 } })
      .then(res => {
        const catalog = res.data.data || [];
        setCourses(catalog);
        if (catalog.length > 0 && !selectedCourseId) {
          setSelectedCourseId(catalog[0].id);
        }
      })
      .catch(err => {
        console.error('Failed to load instructor courses:', err);
        setError('Failed to fetch course catalog. Please check your network or try again.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const totalLectures = courses.reduce((acc, c) => acc + (Number(c.lectures_count) || 0), 0);
  const totalStudents = courses.reduce((acc, c) => acc + (Number(c.students_enrolled) || 0), 0);

  // Handle open analytics (FR-I5)
  const handleOpenAnalytics = async (course: any) => {
    setAnalyticsCourse(course);
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const res = await api.get(`/courses/${course.id}/analytics`);
      setAnalyticsData(res.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setAnalyticsError(err.response?.data?.error?.message || 'Failed to load course analytics.');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Rubric management
  const handleAddRubricItem = () => {
    setRubricItems(prev => [...prev, { criterion: '', weight: 10 }]);
  };

  const handleUpdateRubricItem = (index: number, field: 'criterion' | 'weight', value: any) => {
    setRubricItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: field === 'weight' ? Number(value) || 0 : value };
      return copy;
    });
  };

  const handleRemoveRubricItem = (index: number) => {
    setRubricItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const totalRubricWeight = rubricItems.reduce((acc, item) => acc + item.weight, 0);

  // Handle create assignment (FR-I3)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setAssignmentErrorMsg('Please select a course');
      return;
    }
    if (!assignmentTitle.trim()) {
      setAssignmentErrorMsg('Assignment title is required');
      return;
    }
    if (!assignmentInstructions.trim()) {
      setAssignmentErrorMsg('Instructions are required');
      return;
    }
    if (totalRubricWeight !== 100) {
      setAssignmentErrorMsg(`Rubric weights must sum to exactly 100% (currently ${totalRubricWeight}%)`);
      return;
    }

    setIsCreatingAssignment(true);
    setAssignmentErrorMsg('');
    setAssignmentSuccessMsg('');

    // Format rubric object: { [criterion]: weight }
    const rubricObj: Record<string, number> = {};
    rubricItems.forEach(item => {
      const key = item.criterion.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'criteria';
      rubricObj[key] = item.weight;
    });

    try {
      await api.post('/assignments', {
        course_id: selectedCourseId,
        title: assignmentTitle.trim(),
        instructions: assignmentInstructions.trim(),
        due_date: assignmentDueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        rubric: rubricObj,
      });

      setAssignmentSuccessMsg('Assignment created and published successfully!');
      setTimeout(() => {
        setShowAssignmentModal(false);
        setAssignmentTitle('');
        setAssignmentInstructions('');
        setAssignmentSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create assignment:', err);
      setAssignmentErrorMsg(err.response?.data?.error?.message || 'Failed to create assignment.');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Instructor Studio & Curriculum Management
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">Instructor Studio</h1>
          <p className="text-slate-400 text-sm">
            Create and manage courses, curriculum, AI-assisted assessments, and student grading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAssignmentModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 transition-all hover:border-indigo-500/40"
          >
            <FilePlus className="w-4 h-4 text-indigo-400" />
            Create Assignment
          </button>
          <Link
            to="/instructor/grading"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
          >
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Grading Queue
          </Link>
          <Link
            to="/instructor/courses/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <PlusCircle className="w-4 h-4" />
            Create New Course
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCourses}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-white font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {isLoading ? <div className="w-8 h-7 bg-slate-700 rounded animate-pulse" /> : courses.length}
            </div>
            <div className="text-xs text-slate-400">Total Courses Managed</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {isLoading ? <div className="w-8 h-7 bg-slate-700 rounded animate-pulse" /> : totalStudents}
            </div>
            <div className="text-xs text-slate-400">Total Enrolled Learners</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Layers className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {isLoading ? <div className="w-8 h-7 bg-slate-700 rounded animate-pulse" /> : totalLectures}
            </div>
            <div className="text-xs text-slate-400">Published Lectures</div>
          </div>
        </div>
      </div>

      {/* Managed Courses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Courses</h2>
          <span className="text-xs text-slate-400 font-medium">
            {courses.length} Course{courses.length === 1 ? '' : 's'} in Portfolio
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-xl bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-20 h-4 bg-slate-700 rounded" />
                    <div className="w-3/4 h-5 bg-slate-700 rounded" />
                    <div className="w-full h-8 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="h-6 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-white">No courses created yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Publish your first AI-assisted curriculum with video lectures, transcripts, and auto-generated quizzes.
              </p>
            </div>
            <Link
              to="/instructor/courses/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Create Your First Course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map(course => (
              <div
                key={course.id}
                className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-24 h-24 rounded-xl object-cover shrink-0 border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        course.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : course.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-red-500/15 text-red-400 border border-red-500/20'
                      }`}>
                        {course.status}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">{course.difficulty}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[11px] font-semibold text-indigo-400">
                        {Number(course.price) > 0 ? `$${Number(course.price).toFixed(2)}` : 'Free'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white truncate mb-1">{course.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{course.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>{course.lectures_count || 0} Lectures</span>
                    <span>•</span>
                    <span>{course.students_enrolled || 0} Students</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAnalytics(course)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/20 transition-colors"
                      title="View Drop-off & Time Analytics"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-indigo-400" /> Analytics
                    </button>
                    <Link
                      to="/instructor/courses/new"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-medium px-2 py-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Authoring
                    </Link>
                    <Link
                      to={`/courses/${course.id}/player`}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1"
                    >
                      Preview <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Course Analytics Modal (FR-I5) */}
      {analyticsCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Course Learning Funnel & Analytics (FR-I5)
                </div>
                <h2 className="text-xl font-black text-white">{analyticsCourse.title}</h2>
              </div>
              <button
                onClick={() => {
                  setAnalyticsCourse(null);
                  setAnalyticsData(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingAnalytics ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Sparkles className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs">Computing student drop-off funnel and time-on-task metrics...</p>
              </div>
            ) : analyticsError ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {analyticsError}
              </div>
            ) : analyticsData ? (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Total Enrolled</div>
                    <div className="text-xl font-black text-white mt-0.5">
                      {analyticsData.metrics?.total_enrolled ?? 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Completion Rate</div>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {analyticsData.metrics?.completion_rate ?? 0}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Avg Quiz Score</div>
                    <div className="text-xl font-black text-indigo-400 mt-0.5">
                      {analyticsData.metrics?.quiz_performance?.avg_score ?? 0}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Total Time-on-Task</div>
                    <div className="text-xl font-black text-purple-400 mt-0.5">
                      {analyticsData.metrics?.time_on_task?.total_hours ?? 0} hrs
                    </div>
                    <div className="text-[10px] text-slate-500">
                      (~{analyticsData.metrics?.time_on_task?.avg_minutes_per_student ?? 0}m / student)
                    </div>
                  </div>
                </div>

                {/* Per-Lecture Retention Funnel */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-400" />
                      Per-Lecture Drop-Off Retention Funnel
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Ordered progression from Lecture 1 to end
                    </span>
                  </div>

                  {analyticsData.lecture_drop_off?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-800/20 border border-slate-800">
                      No lecture drop-off data available for this course yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analyticsData.lecture_drop_off?.map((lec: any, idx: number) => (
                        <div
                          key={lec.lecture_id}
                          className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[11px] text-slate-300">
                                {idx + 1}
                              </span>
                              <span>{lec.lecture_title}</span>
                              <span className="text-slate-500 font-normal">({lec.module_title})</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-slate-400">
                                {lec.students_completed} completed ({lec.students_watched} watched)
                              </span>
                              <span className="font-bold text-emerald-400">
                                {lec.retention_rate}% Retention
                              </span>
                              {lec.drop_off_rate > 0 && (
                                <span className="text-red-400 text-[11px]">
                                  (-{lec.drop_off_rate}% drop-off)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Retention Bar */}
                          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, Math.min(100, lec.retention_rate))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Assignment Creator Modal (FR-I3) */}
      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">
                  <FilePlus className="w-4 h-4" />
                  Course Assessment Authoring (FR-I3)
                </div>
                <h2 className="text-xl font-black text-white">Create New Assignment</h2>
              </div>
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignmentSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{assignmentSuccessMsg}</span>
              </div>
            )}

            {assignmentErrorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{assignmentErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              {/* Target Course */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Course
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assignment Title
                </label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="e.g. Fine-Tuning LLaMA-3 with LoRA Capstone"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Instructions & Requirements
                </label>
                <textarea
                  rows={4}
                  value={assignmentInstructions}
                  onChange={(e) => setAssignmentInstructions(e.target.value)}
                  placeholder="Describe task scope, input requirements, expected output format, and code submission deliverables..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Deadline Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Submission Deadline
                </label>
                <input
                  type="datetime-local"
                  value={assignmentDueDate}
                  onChange={(e) => setAssignmentDueDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Rubric Criteria Builder (FR-I3) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-400" />
                    Grading Rubric Criteria
                  </label>
                  <span className={`text-[11px] font-bold ${
                    totalRubricWeight === 100 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    Total Weight: {totalRubricWeight}% {totalRubricWeight !== 100 && '(must equal 100%)'}
                  </span>
                </div>

                <div className="space-y-2 bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                  {rubricItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.criterion}
                        onChange={(e) => handleUpdateRubricItem(idx, 'criterion', e.target.value)}
                        placeholder="Criterion name (e.g. Code Quality)"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          value={item.weight}
                          min={1}
                          max={100}
                          onChange={(e) => handleUpdateRubricItem(idx, 'weight', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-400 font-semibold">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRubricItem(idx)}
                        disabled={rubricItems.length <= 1}
                        className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddRubricItem}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Criterion
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAssignment || totalRubricWeight !== 100}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
                >
                  <FilePlus className="w-4 h-4" />
                  {isCreatingAssignment ? 'Publishing...' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};