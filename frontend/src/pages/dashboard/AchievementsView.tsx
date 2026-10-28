import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Award, Flame, Trophy, Download, CheckCircle2 } from 'lucide-react';

export const AchievementsView: React.FC = () => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<any>({ earned: [], all: [] });
  const [streak, setStreak] = useState<any>({ current_streak: 1, longest_streak: 1 });
  const [certificates, setCertificates] = useState<any[]>([]);

  useEffect(() => {
    api.get('/gamification/users/me/badges').then(res => setBadges(res.data)).catch(() => {});
    api.get('/gamification/users/me/streak').then(res => setStreak(res.data)).catch(() => {});
    api.get('/gamification/certificates/me').then(res => setCertificates(res.data)).catch(() => {});
  }, []);

  const earnedBadgeIds = new Set(badges.earned.map((b: any) => b.id));

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Badges & Streaks</h1>
        <p className="text-slate-400 text-sm">
          Track your learning momentum, earned certificates, and milestone achievements.
        </p>
      </div>

      {/* Streak Showcase Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-orange-950/40 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Flame className="w-9 h-9 fill-amber-400 text-amber-500 animate-pulse" />
          </div>
          <div>
            <div className="text-3xl font-black text-white">{streak.current_streak} Days Active</div>
            <p className="text-xs text-amber-300/80">
              Longest streak recorded: <strong className="text-white">{streak.longest_streak} days</strong>
            </p>
          </div>
        </div>

        <div className="text-center sm:text-right text-xs text-slate-400">
          <div className="font-semibold text-white">Daily Streak Multiplier Active</div>
          <div className="text-[11px] text-amber-400">+25% AI Tutor session boost</div>
        </div>
      </div>

      {/* Badges Matrix */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-400" />
          Achievement Badges
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(badges.all || []).map((b: any) => {
            const isEarned = earnedBadgeIds.has(b.id);
            return (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col items-center text-center justify-between space-y-3 ${
                  isEarned
                    ? 'bg-slate-800/80 border-indigo-500/30 shadow-lg'
                    : 'bg-slate-900/40 border-slate-800 opacity-50 grayscale'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shadow-inner">
                  {b.icon_url || '🏆'}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{b.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{b.description}</p>
                </div>

                <div>
                  {isEarned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Earned
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certificates Section */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          Course Certificates
        </h2>

        {certificates.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-800/20 border border-slate-800 text-xs text-slate-400">
            Complete 100% of any course to earn an accredited verified certificate of completion.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {certificates.map(c => (
              <div
                key={c.id}
                className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Verified Certificate
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{c.course_title}</h3>
                  <p className="text-[11px] text-slate-400">
                    Issued: {new Date(c.issued_at).toLocaleDateString()}
                  </p>
                </div>

                <a
                  href={c.certificate_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  title="Download Certificate"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
