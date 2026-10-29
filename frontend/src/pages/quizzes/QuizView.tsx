import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  FileQuestion,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  CheckSquare,
  Square,
  CircleDot,
  Circle,
  PenTool
} from 'lucide-react';

interface Option {
  id: string;
  option_text: string;
  is_correct?: boolean;
}

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'multi_select' | 'short_answer' | string;
  order_index: number;
  options: Option[];
}

interface Quiz {
  id: string;
  title: string;
  is_ai_generated: boolean;
  questions: Question[];
}

interface ReviewItem {
  question_id: string;
  question_type: string;
  selected_option_ids?: string[];
  correct_option_ids?: string[];
  is_correct: boolean;
}

export const QuizView: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    correct_count: number;
    review: ReviewItem[];
  } | null>(null);

  useEffect(() => {
    if (quizId) {
      api.get(`/quizzes/${quizId}`).then(res => {
        setQuiz(res.data);
      }).catch(() => {
        // Fallback in case of router prefix alias
        api.get(`/quizzes/quizzes/${quizId}`).then(res => setQuiz(res.data));
      });

      // Start attempt
      api.post(`/quizzes/${quizId}/attempt`).then(res => {
        setAttemptId(res.data.id);
      }).catch(() => {
        api.post(`/quizzes/quizzes/${quizId}/attempt`).then(res => setAttemptId(res.data.id));
      });
    }
  }, [quizId]);

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    if (result) return; // Prevent editing once submitted
    setSelectedOptions(prev => {
      const current = prev[questionId] || [];
      if (isMulti) {
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter(id => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        return { ...prev, [questionId]: [optionId] };
      }
    });
  };

  const handleTextAnswerChange = (questionId: string, val: string) => {
    if (result) return;
    setTextAnswers(prev => ({
      ...prev,
      [questionId]: val,
    }));
  };

  const handleSubmit = async () => {
    if (!attemptId || !quiz) return;
    setIsSubmitting(true);

    const payloadAnswers = quiz.questions.map(q => {
      const qType = q.question_type || 'mcq';
      if (qType === 'short_answer') {
        return {
          question_id: q.id,
          text_answer: textAnswers[q.id] || '',
        };
      }
      const opts = selectedOptions[q.id] || [];
      return {
        question_id: q.id,
        selected_option_ids: opts,
        selected_option_id: opts[0] || null,
      };
    });

    try {
      const res = await api.post(`/attempts/${attemptId}/submit`, {
        answers: payloadAnswers,
      });
      setResult(res.data);
    } catch (err) {
      console.error('Quiz submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setSelectedOptions({});
    setTextAnswers({});
    if (quizId) {
      api.post(`/quizzes/${quizId}/attempt`).then(res => {
        setAttemptId(res.data.id);
      }).catch(() => {
        api.post(`/quizzes/quizzes/${quizId}/attempt`).then(res => setAttemptId(res.data.id));
      });
    }
  };

  if (!quiz) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Loading quiz questions...
      </div>
    );
  }

  const reviewMap = new Map<string, ReviewItem>();
  if (result?.review) {
    result.review.forEach(r => reviewMap.set(r.question_id, r));
  }

  const hasAnswers =
    Object.values(selectedOptions).some(opts => opts.length > 0) ||
    Object.values(textAnswers).some(t => t.trim().length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
      {/* Quiz Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            {quiz.title}
            {quiz.is_ai_generated && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                AI Generated
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Answer the following questions to verify your mastery of the material.
          </p>
        </div>
      </div>

      {/* Result Celebration Banner */}
      {result && (
        <div className={`p-6 rounded-2xl border ${
          result.score >= 80
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
        } animate-in zoom-in-95`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <Award className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Score: {result.score}%</h3>
                <p className="text-xs opacity-80">
                  {result.correct_count} of {result.total_questions} questions correct
                  {result.score === 100 && ' — 🏆 Quiz Master badge awarded!'}
                </p>
              </div>
            </div>

            <button
              onClick={handleRetake}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {quiz.questions.map((q, qIdx) => {
          const rev = reviewMap.get(q.id);
          const isMulti = q.question_type === 'multi_select';
          const isShort = q.question_type === 'short_answer';
          const chosenOpts = selectedOptions[q.id] || [];

          return (
            <div
              key={q.id}
              className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {qIdx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-relaxed">
                      {q.question_text}
                    </h3>
                  </div>
                </div>

                <div className="shrink-0">
                  {isMulti && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Multi-Select
                    </span>
                  )}
                  {isShort && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                      <PenTool className="w-2.5 h-2.5" /> Short Answer
                    </span>
                  )}
                </div>
              </div>

              {/* Short Answer Input Field */}
              {isShort ? (
                <div className="pl-10 space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      disabled={!!result}
                      placeholder="Type your answer here..."
                      value={textAnswers[q.id] || ''}
                      onChange={e => handleTextAnswerChange(q.id, e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-xs text-white focus:outline-none transition-colors ${
                        result
                          ? rev?.is_correct
                            ? 'border-emerald-500 bg-emerald-950/20 text-emerald-200'
                            : 'border-red-500 bg-red-950/20 text-red-200'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {result && (
                      <div className="absolute right-3 top-3">
                        {rev?.is_correct ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {result && !rev?.is_correct && q.options?.length > 0 && (
                    <p className="text-[11px] text-amber-300">
                      Expected: <span className="font-semibold">{q.options[0]?.option_text}</span>
                    </p>
                  )}
                </div>
              ) : (
                /* Options List for MCQ & Multi-Select */
                <div className="space-y-2 pl-10">
                  {isMulti && !result && (
                    <p className="text-[11px] text-slate-400 mb-1">
                      Select all correct options that apply:
                    </p>
                  )}
                  {q.options.map(opt => {
                    const isSelected = chosenOpts.includes(opt.id);
                    let optStyle = 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600';

                    if (result) {
                      const isOptionCorrect = (rev?.correct_option_ids || []).includes(opt.id);
                      if (isOptionCorrect) {
                        optStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-200 font-semibold';
                      } else if (isSelected && !isOptionCorrect) {
                        optStyle = 'border-red-500 bg-red-500/10 text-red-200';
                      } else {
                        optStyle = 'border-slate-800 bg-slate-900/30 text-slate-500';
                      }
                    } else if (isSelected) {
                      optStyle = 'border-indigo-500 bg-indigo-600/15 text-white font-semibold ring-1 ring-indigo-500';
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(q.id, opt.id, isMulti)}
                        className={`cursor-pointer p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${optStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isMulti ? (
                            isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 shrink-0" />
                            )
                          ) : (
                            isSelected ? (
                              <CircleDot className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                            )
                          )}
                          <span>{opt.option_text}</span>
                        </div>

                        {result && (rev?.correct_option_ids || []).includes(opt.id) && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                        )}
                        {result && isSelected && !(rev?.correct_option_ids || []).includes(opt.id) && (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submission CTA */}
      {!result && (
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasAnswers}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
          >
            {isSubmitting ? 'Evaluating Answers...' : 'Submit Assessment'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
