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
  Sparkles,
  Star,
  X,
  RotateCcw
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  price: string | number;
  pricing_tier?: string;
  rating?: number;
  ratings_count?: number;
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
  const [selectedRating, setSelectedRating] = useState('All');
  const [categories, setCategories] = useState<string[]>([
    'All',
    'Artificial Intelligence',
    'DevOps & Cloud',
    'Web Development',
    'Data Science',
    'Cybersecurity',
    'General',
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const difficulties = ['All', 'beginner', 'intermediate', 'advanced'];

  const ratingOptions = [
    { label: 'All Ratings', value: 'All' },
    { label: '★ 4.5 & up', value: '4.5' },
    { label: '★ 4.0 & up', value: '4.0' },
    { label: '★ 3.5 & up', value: '3.5' },
    { label: '★ 3.0 & up', value: '3.0' },
  ];

  // Fetch unique categories dynamically from API
  useEffect(() => {
    api.get('/courses/categories')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const unique = Array.from(new Set(['All', ...res.data]));
          setCategories(unique);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch user enrolled course IDs
  useEffect(() => {
    if (user) {
      api.get('/enrollments/me')
        .then(res => {
          const ids = new Set<string>(res.data.map((e: any) => e.course_id));
          setEnrolledCourseIds(ids);
        })
        .catch(() => {});
    }
  }, [user]);

  // Fetch courses with debounce
  const fetchCourses = () => {
    setIsLoading(true);
    const params: any = { status: 'approved' };
    if (selectedCategory !== 'All') params.category = selectedCategory;
    if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
    if (selectedRating !== 'All') params.rating = selectedRating;
    if (searchQuery.trim()) params.q = searchQuery.trim();

    api.get('/courses', { params })
      .then(res => setCourses(res.data.data || []))
      .catch(err => console.error('Failed to load courses:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCourses();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedRating]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses();
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedDifficulty !== 'All' ||
    selectedRating !== 'All' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedDifficulty('All');
    setSelectedRating('All');
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Interactive Course Catalog
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Explore Courses</h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Discover industry-ready courses equipped with embedded RAG AI Tutors, interactive coding assessments, and verified credentials.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-medium self-start md:self-end bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-700/60">
          Showing <span className="text-white font-bold">{courses.length}</span> {courses.length === 1 ? 'course' : 'courses'}
        </div>
      </div>

      {/* Filter and Search Bar Controls */}
      <div className="space-y-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800 shadow-xl">
        {/* Search row and Dropdown Filters */}
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses by title, keywords, topics, or instructor..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Difficulty Filter Dropdown */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full lg:w-44 appearance-none bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer pr-8"
              >
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>
                    {diff === 'All' ? 'All Difficulties' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Rating Filter Dropdown */}
            <div className="relative flex-1 lg:flex-none">
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="w-full lg:w-40 appearance-none bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer pr-8"
              >
                {ratingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="pt-2 border-t border-slate-700/40 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Category:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse overflow-hidden">
              <div className="h-48 bg-slate-700/60" />
              <div className="p-5 space-y-3">
                <div className="w-20 h-3 bg-slate-700 rounded" />
                <div className="w-3/4 h-5 bg-slate-700 rounded" />
                <div className="w-full h-12 bg-slate-800 rounded" />
                <div className="w-full h-8 bg-slate-700/50 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800 space-y-4">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No courses match your criteria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query, difficulty level, rating threshold, or category filter to discover more courses.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const courseRating = Number(course.rating || 4.8);
            const ratingsCount = course.ratings_count || 48;

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
                    {/* Difficulty Badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-[11px] font-semibold text-indigo-400 capitalize border border-slate-700/40">
                      {course.difficulty}
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-900/85 backdrop-blur-md text-[11px] font-bold text-amber-300 flex items-center gap-1.5 shadow-md border border-amber-500/30">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{courseRating.toFixed(1)}</span>
                      <span className="text-slate-400 text-[10px] font-normal">({ratingsCount})</span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider truncate">
                        {course.category}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          AI Tutor
                        </span>
                        <span className="text-[10px] font-bold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                          {Number(course.price) > 0 ? `$${Number(course.price).toFixed(2)}` : 'Free'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                      {course.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-400 py-3 border-t border-slate-800 mb-4">
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
                          <span>Enroll Now — {Number(course.price) > 0 ? `$${Number(course.price).toFixed(2)}` : 'Free'}</span>
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
