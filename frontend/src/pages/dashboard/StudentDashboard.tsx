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

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/enrollments/me'),
      api.get('/recommendations/me'),
    ])
      .then(([enrollRes, recRes]) => {
        setEnrollments(enrollRes.data);
        setRecommendations(recRes.data);
      })
      .catch(err => console.error('Dashboard load error:', err))
      .finally(() => setIsLoading(false));
  }, []);

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

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{user?.streak?.current || 1} Days</div>
            <div className="text-xs text-slate-400 font-medium">Daily Streak</div>
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

      {/* Enrolled Courses Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Continue Learning</h2>
          <Link to="/catalog" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Explore All Courses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {enrollments.length === 0 && !isLoading ? (
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
                        <span className="text-slate-400">Progress</span>
                        <span className="text-emerald-400 font-bold">{item.progress_percent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${item.progress_percent}%` }}
                        />
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
