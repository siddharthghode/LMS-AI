import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import {
  Search,
  BookOpen,
  Users,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  price: string | number;
  instructor_name: string;
  instructor_avatar?: string;
  modules_count: number;
  lectures_count: number;
  students_enrolled: number;
}

export const CourseCatalog: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const categories = ['All', 'Artificial Intelligence', 'DevOps & Cloud', 'General'];
  const difficulties = ['All', 'beginner', 'intermediate', 'advanced'];

  useEffect(() => {
    fetchCourses();
    if (user) {
      api.get('/enrollments/me')
        .then(res => {
          const ids = new Set<string>(res.data.map((e: any) => e.course_id));
          setEnrolledCourseIds(ids);
        })
        .catch(() => {});
    }
  }, [user, selectedCategory, selectedDifficulty]);

  const fetchCourses = () => {
    setIsLoading(true);
    const params: any = { status: 'approved' };
    if (selectedCategory !== 'All') params.category = selectedCategory;
    if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
    if (searchQuery.trim()) params.q = searchQuery;

    api.get('/courses', { params })
      .then(res => setCourses(res.data.data || []))
      .catch(err => console.error('Failed to load courses:', err))
      .finally(() => setIsLoading(false));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses();
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setEnrollingId(courseId);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      setEnrolledCourseIds(prev => new Set([...prev, courseId]));
      navigate(`/courses/${courseId}/player`);
    } catch (err: any) {
      console.error('Enrollment failed:', err);
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Course Catalog</h1>
        <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
          Explore production-grade courses curated with embedded RAG AI Tutors, code exercises, and automated feedback.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses by title, keywords, or topics..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Difficulty Select */}
        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          {difficulties.map(diff => (
            <option key={diff} value={diff}>
              {diff === 'All' ? 'All Difficulties' : diff.charAt(0).toUpperCase() + diff.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Course Grid */}
      {courses.length === 0 && !isLoading ? (
        <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No courses found</h3>
          <p className="text-xs text-slate-400">Try adjusting your search criteria or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            return (
              <div
                key={course.id}
                className="group rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 overflow-hidden shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-[11px] font-semibold text-indigo-400 capitalize">
                      {course.difficulty}
                    </div>
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md text-[11px] font-bold text-emerald-300">
                      AI Tutor Ready
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                      {course.category}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                      {course.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 py-3 border-t border-slate-800 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>{course.lectures_count} Lectures</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{course.students_enrolled} Students</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  {isEnrolled ? (
                    <Link
                      to={`/courses/${course.id}/player`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Enrolled — Go to Course
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrollingId === course.id}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                    >
                      {enrollingId === course.id ? (
                        <span>Enrolling...</span>
                      ) : (
                        <>
                          <span>Enroll Now — Free</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
