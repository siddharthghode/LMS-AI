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
  Sparkles
} from 'lucide-react';

export const InstructorDashboard: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch courses authored or manage catalog
    api.get('/courses', { params: { limit: 50 } })
      .then(res => setCourses(res.data.data || []))
      .catch(err => console.error('Failed to load instructor courses:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const totalLectures = courses.reduce((acc, c) => acc + (Number(c.lectures_count) || 0), 0);
  const totalStudents = courses.reduce((acc, c) => acc + (Number(c.students_enrolled) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">Instructor Studio</h1>
          <p className="text-slate-400 text-sm">
            Create and manage courses, curriculum, AI-assisted assessments, and student grading.
          </p>
        </div>

        <Link
          to="/instructor/courses/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Course
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{courses.length}</div>
            <div className="text-xs text-slate-400">Total Courses Managed</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{totalStudents}</div>
            <div className="text-xs text-slate-400">Total Enrolled Learners</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Layers className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{totalLectures}</div>
            <div className="text-xs text-slate-400">Published Lectures</div>
          </div>
        </div>
      </div>

      {/* Managed Courses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Courses</h2>
          <Link to="/instructor/grading" className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1">
            <FileCheck className="w-4 h-4" /> Open Grading Queue
          </Link>
        </div>

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

                <Link
                  to={`/courses/${course.id}/player`}
                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Preview Course <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
