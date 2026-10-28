import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Layers,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface Flashcard {
  id: string;
  module_id: string;
  question: string;
  answer: string;
}

export const FlashcardsView: React.FC = () => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch flashcards for module or course
    api.get('/courses')
      .then(res => {
        if (res.data.data?.length > 0) {
          const courseId = res.data.data[0].id;
          return api.get(`/courses/${courseId}`);
        }
        return null;
      })
      .then(res => {
        if (res && res.data?.modules?.length > 0) {
          const modId = res.data.modules[0].id;
          return api.post(`/ai/modules/${modId}/flashcards`);
        }
        return null;
      })
      .then(res => {
        if (res && res.data) {
          setFlashcards(res.data);
        }
      })
      .catch(err => console.error('Flashcards load failed:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + 1) % flashcards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
  };

  if (isLoading || flashcards.length === 0) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Generating interactive flashcards...
      </div>
    );
  }

  const current = flashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
          <Layers className="w-3.5 h-3.5" />
          Active Recall Study Mode
        </div>
        <h1 className="text-2xl font-black text-white">AI Course Flashcards</h1>
        <p className="text-xs text-slate-400">
          Click the card or the flip button to reveal the answer and test your knowledge.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>Card {currentIndex + 1} of {flashcards.length}</span>
        <span className="text-emerald-400 font-semibold">{Math.round(((currentIndex + 1) / flashcards.length) * 100)}% Complete</span>
      </div>

      {/* 3D Flip Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="cursor-pointer min-h-[300px] rounded-3xl p-8 border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-indigo-500/10"
      >
        <div className="flex items-center justify-between text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider text-[10px] ${
            isFlipped ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'
          }`}>
            {isFlipped ? 'Answer' : 'Question'}
          </span>
          <span className="text-slate-500 text-[11px] flex items-center gap-1">
            <RotateCw className="w-3 h-3" /> Click to flip
          </span>
        </div>

        <div className="py-8 text-center">
          <p className="text-lg font-bold text-white leading-relaxed">
            {isFlipped ? current.answer : current.question}
          </p>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          Tap card to reveal {isFlipped ? 'question' : 'answer'}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={handlePrev}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
          title="Previous Card"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
        >
          <RotateCw className="w-4 h-4" /> Flip Card
        </button>

        <button
          onClick={handleNext}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
          title="Next Card"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
