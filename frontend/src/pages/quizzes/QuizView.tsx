import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  FileQuestion,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronLeft
} from 'lucide-react';

interface Option {
  id: string;
  option_text: string;
  is_correct?: boolean;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  options: Option[];
}

interface Quiz {
  id: string;
  title: string;
  is_ai_generated: boolean;
  questions: Question[];
}

export const QuizView: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    correct_count: number;
    review: Array<{
      question_id: string;
      selected_option_id: string;
      correct_option_id: string;
      is_correct: boolean;
    }>;
  } | null>(null);

  useEffect(() => {
    if (quizId) {
      api.get(`/quizzes/quizzes/${quizId}`).then(res => {
        setQuiz(res.data);
      });

      // Start attempt
      api.post(`/quizzes/quizzes/${quizId}/attempt`).then(res => {
        setAttemptId(res.data.id);
      });
    }
  }, [quizId]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (result) return; // Prevent changing after submission
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async () => {
    if (!attemptId || !quiz) return;
    setIsSubmitting(true);

    const payloadAnswers = Object.entries(selectedAnswers).map(([question_id, selected_option_id]) => ({
      question_id,
      selected_option_id,
    }));

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
    setSelectedAnswers({});
    if (quizId) {
      api.post(`/quizzes/quizzes/${quizId}/attempt`).then(res => {
        setAttemptId(res.data.id);
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

  const reviewMap = new Map();
  if (result?.review) {
    result.review.forEach(r => reviewMap.set(r.question_id, r));
  }

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
          return (
            <div
              key={q.id}
              className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {qIdx + 1}
                </span>
                <h3 className="text-sm font-bold text-white leading-relaxed">
                  {q.question_text}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2 pl-10">
                {q.options.map(opt => {
                  const isSelected = selectedAnswers[q.id] === opt.id;
                  let optStyle = 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600';

                  if (result) {
                    if (opt.id === rev?.correct_option_id) {
                      optStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-200 font-semibold';
                    } else if (isSelected && !rev?.is_correct) {
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
                      onClick={() => handleSelectOption(q.id, opt.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${optStyle}`}
                    >
                      <span>{opt.option_text}</span>
                      {result && opt.id === rev?.correct_option_id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                      {result && isSelected && !rev?.is_correct && (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission CTA */}
      {!result && (
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(selectedAnswers).length === 0}
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
