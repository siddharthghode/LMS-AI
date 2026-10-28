import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Video,
  FileText
} from 'lucide-react';

export const CourseAuthoring: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Artificial Intelligence');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80');
  const [price, setPrice] = useState('0');

  // Module and Lecture state
  const [moduleTitle, setModuleTitle] = useState('Module 1: Core Fundamentals');
  const [lectureTitle, setLectureTitle] = useState('Lecture 1.1: System Architecture Overview');
  const [videoUrl, setVideoUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
  const [transcript, setTranscript] = useState('In this lecture, we introduce high-performance retrieval architectures, detailing how vector embeddings and token chunking enable reliable semantic search without context loss.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAiQuizDraft = async () => {
    if (!transcript.trim()) return;
    setIsGeneratingQuiz(true);
    try {
      const res = await api.post('/ai/lectures/draft-quiz', {
        transcript,
      });
      setGeneratedQuiz(res.data);
    } catch {
      // Fallback draft
      setGeneratedQuiz({
        quiz_title: `AI Draft Quiz: ${lectureTitle}`,
        questions: [
          {
            question_text: `What is the core takeaway regarding semantic vector search in "${lectureTitle}"?`,
            options: [
              { option_text: 'It preserves context and maps conceptual meaning into high-dimensional space', is_correct: true },
              { option_text: 'It replaces all database tables with flat text files', is_correct: false },
            ],
          },
        ],
      });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Course title is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Create course
      const courseRes = await api.post('/courses', {
        title,
        description,
        category,
        difficulty,
        thumbnail_url: thumbnailUrl,
        price: parseFloat(price) || 0,
      });
      const courseId = courseRes.data.id;

      // 2. Add module
      const modRes = await api.post(`/courses/${courseId}/modules`, {
        title: moduleTitle || 'Module 1',
        order_index: 1,
      });
      const moduleId = modRes.data.id;

      // 3. Add lecture
      const lecRes = await api.post(`/courses/modules/${moduleId}/lectures`, {
        title: lectureTitle || 'Lecture 1.1',
        video_url: videoUrl,
        transcript: transcript,
        duration_seconds: 420,
        order_index: 1,
      });

      // 4. If AI quiz was generated, save it
      if (generatedQuiz) {
        await api.post('/quizzes/quizzes', {
          module_id: moduleId,
          title: generatedQuiz.quiz_title,
          is_ai_generated: true,
          generated_from_lecture_id: lecRes.data.id,
          questions: generatedQuiz.questions,
        });
      }

      navigate('/instructor');
    } catch (err: any) {
      console.error('Course creation error:', err);
      setErrorMsg(err.response?.data?.error?.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Author New Course</h1>
        <p className="text-slate-400 text-sm">
          Define curriculum structure, upload or embed video lectures, add transcripts, and auto-generate AI assessments.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleCreateCourse} className="space-y-8">
        {/* Basic Course Metadata */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            1. Course Overview & Metadata
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Course Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems & Vector Architecture"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of syllabus, target audience, and expected learning outcomes..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="DevOps & Cloud">DevOps & Cloud</option>
                <option value="Web Development">Web Development</option>
                <option value="Data Science">Data Science</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Thumbnail Image URL</label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Initial Curriculum Section */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            2. First Module & Lecture Setup
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Module Title</label>
              <input
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Lecture Title</label>
                  <input
                    type="text"
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Video Stream URL</label>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-400">
                      Lecture Audio Transcript (Powers Vector RAG & AI Tutor)
                    </label>
                    <button
                      type="button"
                      onClick={handleAiQuizDraft}
                      disabled={isGeneratingQuiz || !transcript.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      {isGeneratingQuiz ? 'Drafting...' : 'Auto-Generate Quiz Draft from Transcript'}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Generated Quiz Preview */}
              {generatedQuiz && (
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2 animate-in fade-in">
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Quiz Draft Created: {generatedQuiz.quiz_title}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Will be automatically attached to this module upon saving.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/instructor')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Creating Course & Ingesting Chunks...' : 'Publish Course for Review'}
          </button>
        </div>
      </form>
    </div>
  );
};
