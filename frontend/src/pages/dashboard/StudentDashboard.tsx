import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { api } from '../../services/api';
import {
  BookOpen,
  Flame,
  Award,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  TrendingUp,
  BrainCircuit
} from 'lucide-react';

interface Enrollment {
  enrollment_id: string;
  course_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  instructor_name: string;
  progress_percent: number;
  total_lectures: number;
  completed_lectures: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  score: number;
  reason: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active_date?: string;
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      api.get('/enrollments/me'),
      api.get('/recommendations/me'),
      api.get('/users/me/streak').catch(() => ({ data: null })),
    ])
      .then(([enrollRes, recRes, streakRes]) => {
        setEnrollments(enrollRes.data || []);
        setRecommendations(recRes.data || []);
        if (streakRes?.data) {
          setStreak(streakRes.data);
        }
      })
      .catch(err => {
        console.error('Dashboard load error:', err);
        setError('Failed to load dashboard data. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const currentStreak = streak?.current_streak ?? user?.streak?.current ?? 0;
  const longestStreak = streak?.longest_streak ?? user?.streak?.longest ?? 0;

  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((acc, curr) => acc + Number(curr.progress_percent), 0) / enrollments.length)
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 p-8 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            AI-Augmented Learning Environment
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome back, {user?.full_name}! 👋
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            You're currently enrolled in {enrollments.length} active course{enrollments.length === 1 ? '' : 's'}. Your embedded AI tutor is standing by in each course to help clarify concepts and verify understanding.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
            >
              <Compass className="w-4 h-4" />
              Browse More Courses
            </Link>
            <Link
              to="/study-plan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
            >
              <BrainCircuit className="w-4 h-4 text-emerald-400" />
              View AI Study Plan
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{enrollments.length}</div>
            <div className="text-xs text-slate-400 font-medium">Enrolled Courses</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{avgProgress}%</div>
            <div className="text-xs text-slate-400 font-medium">Average Progress</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4 hover:border-amber-500/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-amber-400 fill-amber-400/20" />
          </div>
          <div>
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>{currentStreak} Days</span>
              {currentStreak > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="text-xs text-slate-400 font-medium">Daily Streak Counter</div>
            <div className="text-[10px] text-amber-400/80 font-semibold mt-0.5">
              Personal Best: {longestStreak} days
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{user?.badges?.length || 2}</div>
            <div className="text-xs text-slate-400 font-medium">Badges Earned</div>
          </div>
        </div>
      </div>

      {/* Daily Streak Highlight Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Flame className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Daily Learning Streak: {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {currentStreak >= 7 ? 'Legendary 🔥' : currentStreak >= 3 ? 'On Fire ⚡' : 'Active 🚀'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {currentStreak > 0
                ? `You're actively on a ${currentStreak}-day learning streak! Learn daily to keep your momentum going.`
                : 'Start your learning streak today by watching a lecture or completing a quiz!'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Personal Best</div>
            <div className="text-xs font-bold text-amber-300">{longestStreak} Days Record</div>
          </div>
          <Link
            to="/achievements"
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors"
          >
            View Badges
          </Link>
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Continue Learning</h2>
          <Link to="/catalog" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Explore All Courses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchDashboardData}
              className="px-3 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-white font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse overflow-hidden">
                <div className="h-44 bg-slate-700" />
                <div className="p-5 space-y-3">
                  <div className="w-16 h-3 bg-slate-700 rounded" />
                  <div className="w-3/4 h-5 bg-slate-700 rounded" />
                  <div className="w-full h-8 bg-slate-800 rounded" />
                  <div className="h-2 bg-slate-700 rounded-full" />
                  <div className="h-10 bg-slate-700 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">No enrolled courses yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Explore our catalog of AI and software engineering courses to begin your learning journey.
            </p>
            <Link
              to="/catalog"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((item) => (
              <div
                key={item.enrollment_id}
                className="group rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 overflow-hidden shadow-lg transition-all flex flex-col"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-[11px] font-semibold text-indigo-400 capitalize">
                    {item.difficulty}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                      {item.category}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                        <span className="text-slate-400">Course Progress</span>
                        <span className="text-emerald-400 font-bold">{Math.round(Number(item.progress_percent))}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700/80 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, Number(item.progress_percent)))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                        <span>
                          {item.completed_lectures || 0} of {item.total_lectures || 0} lectures completed
                        </span>
                        {Number(item.progress_percent) >= 100 && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      to={`/courses/${item.course_id}/player`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors"
                    >
                      Continue Lecture
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">AI Recommended For You</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.map(rec => (
              <div
                key={rec.id}
                className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-indigo-400 font-semibold">{rec.category}</span>
                    <span className="text-emerald-400 font-bold">{rec.score}% Match</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-2 line-clamp-1">{rec.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{rec.reason}</p>
                </div>
                <Link
                  to={`/catalog`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  View Details
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
