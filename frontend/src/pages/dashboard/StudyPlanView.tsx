import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  BrainCircuit,
  CheckCircle2,
  Calendar,
  Target,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const StudyPlanView: React.FC = () => {
  const [plan, setPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/courses')
      .then(res => {
        if (res.data.data?.length > 0) {
          const courseId = res.data.data[0].id;
          return api.post('/ai/study-plan', { course_id: courseId });
        }
      })
      .then(res => {
        if (res?.data) {
          setPlan(res.data.plan_json || res.data);
        }
      })
      .catch(err => console.error('Failed to load study plan:', err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Generating personalized AI study roadmap...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/60 border border-indigo-500/20 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
          <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
          Adaptive Study Architecture
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">
          {plan.title || 'Personalized AI Learning Plan'}
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Goal: {plan.goal || 'Achieve 90%+ comprehensive vector and agent architecture mastery'}
        </p>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Target Mastery: <strong className="text-white">{plan.target_mastery || '95%'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Estimated Duration: <strong className="text-white">{plan.estimated_hours || 14} Hours</strong></span>
          </div>
        </div>
      </div>

      {/* Focus & Strengths */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Identified Strengths:</h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {(plan.strengths || ['High-dimensional vector concepts', 'Prompt engineering']).map((s: string, idx: number) => (
              <li key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Areas for Reinforcement:</h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {(plan.areas_for_focus || ['Scale-invariance in cosine distance', 'JSON tool schemas']).map((s: string, idx: number) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1 mr-1" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white">Recommended Weekly Roadmap</h3>

        {(plan.schedule || plan.phases || []).map((step: any, idx: number) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-400 uppercase tracking-wider">
                Phase {step.week || step.phase || idx + 1}: {step.theme || step.focus}
              </span>
              <span className="text-slate-500 text-[11px]">Recommended</span>
            </div>

            <ul className="space-y-2">
              {(step.tasks || step.recommended_actions || []).map((task: string, tIdx: number) => (
                <li
                  key={tIdx}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between"
                >
                  <span>{task}</span>
                  <CheckCircle2 className="w-4 h-4 text-slate-600 hover:text-emerald-400 cursor-pointer transition-colors" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
