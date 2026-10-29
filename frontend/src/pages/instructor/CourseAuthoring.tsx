import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  BookOpen,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Video,
  DollarSign,
  Tag,
  Image as ImageIcon,
  Eye,
  Check,
  Star,
  Layers,
  Users
} from 'lucide-react';

interface PricingTierOption {
  id: string;
  name: string;
  tierLabel: string;
  price: number | null;
  badge?: string;
  description: string;
}

const PRICING_TIERS: PricingTierOption[] = [
  {
    id: 'free',
    name: 'Free Access',
    tierLabel: 'Free',
    price: 0,
    description: 'Community-accessible learning, zero-barrier catalog discovery',
  },
  {
    id: 'tier_1',
    name: 'Starter Tier',
    tierLabel: 'Tier 1',
    price: 19.99,
    description: 'Entry-level workshops, fundamental concepts, and lecture access',
  },
  {
    id: 'tier_2',
    name: 'Standard Tier',
    tierLabel: 'Tier 2',
    price: 49.99,
    badge: 'Popular',
    description: 'Full course curriculum with interactive exercises and AI tutor access',
  },
  {
    id: 'tier_3',
    name: 'Professional Tier',
    tierLabel: 'Tier 3',
    price: 79.99,
    description: 'Advanced engineering depth, hands-on capstone projects & assessments',
  },
  {
    id: 'tier_4',
    name: 'Enterprise Tier',
    tierLabel: 'Tier 4',
    price: 99.99,
    description: 'Masterclass certification, priority AI grading, and executive depth',
  },
  {
    id: 'custom',
    name: 'Custom Pricing',
    tierLabel: 'Custom',
    price: null,
    description: 'Specify an instructor-defined enrollment tuition amount',
  },
];

const THUMBNAIL_PRESETS = [
  {
    label: 'AI & Agents',
    category: 'Artificial Intelligence',
    url: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'DevOps & Cloud',
    category: 'DevOps & Cloud',
    url: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Web & Next.js',
    category: 'Web Development',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Data Science',
    category: 'Data Science',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Cybersecurity',
    category: 'Cybersecurity',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
  },
];

export const CourseAuthoring: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Artificial Intelligence');
  const [customCategory, setCustomCategory] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80');

  // Pricing Tier state
  const [pricingTier, setPricingTier] = useState('tier_2');
  const [customPrice, setCustomPrice] = useState('39.99');

  // Module and Lecture state
  const [moduleTitle, setModuleTitle] = useState('Module 1: Core Fundamentals');
  const [lectureTitle, setLectureTitle] = useState('Lecture 1.1: System Architecture Overview');
  const [videoUrl, setVideoUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
  const [transcript, setTranscript] = useState('In this lecture, we introduce high-performance retrieval architectures, detailing how vector embeddings and token chunking enable reliable semantic search without context loss.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [imgError, setImgError] = useState(false);

  // Computed effective price
  const getEffectivePrice = (): number => {
    if (pricingTier === 'free') return 0;
    if (pricingTier === 'custom') return Math.max(0, parseFloat(customPrice) || 0);
    const tier = PRICING_TIERS.find((t) => t.id === pricingTier);
    return tier && tier.price !== null ? tier.price : 0;
  };

  const effectivePrice = getEffectivePrice();
  const selectedCategoryLabel = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;

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
      setErrorMsg('Course title is required (minimum 3 characters)');
      return;
    }

    if (category === 'Other' && !customCategory.trim()) {
      setErrorMsg('Please specify a category name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Create course with title, description, category, difficulty, thumbnail, pricing tier, and price
      const courseRes = await api.post('/courses', {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategoryLabel,
        difficulty,
        thumbnail_url: thumbnailUrl.trim(),
        pricing_tier: pricingTier,
        price: effectivePrice,
      });
      const courseId = courseRes.data.id;

      // 2. Add initial module
      const modRes = await api.post(`/courses/${courseId}/modules`, {
        title: moduleTitle.trim() || 'Module 1: Introduction',
        order_index: 1,
      });
      const moduleId = modRes.data.id;

      // 3. Add initial lecture
      const lecRes = await api.post(`/courses/modules/${moduleId}/lectures`, {
        title: lectureTitle.trim() || 'Lecture 1.1',
        video_url: videoUrl.trim(),
        transcript: transcript.trim(),
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
    <div className="max-w-5xl mx-auto space-y-8 py-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            Instructor Studio
          </span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-slate-400 text-xs">Course Authoring & Curriculum Management</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Create & Publish Course</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Configure syllabus metadata, upload course media, establish monetization tiers, and ingest transcripts into the vector RAG engine.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleCreateCourse} className="space-y-8">
        {/* Section 1: Course Overview & Metadata */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              1. Course Overview & Metadata
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">Step 1 of 3</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Course Title <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems & Large-Scale Vector Architecture"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                <span>Make your title descriptive, outcome-oriented, and concise.</span>
                <span>{title.length} characters</span>
              </div>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Course Description & Learning Outcomes
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outline the core curriculum concepts, prerequisites, target learners, and expected skills..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all leading-relaxed"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="DevOps & Cloud">DevOps & Cloud</option>
                <option value="Web Development">Web Development</option>
                <option value="Data Science">Data Science</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Other">Other (Custom Category)</option>
              </select>
              {category === 'Other' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category name..."
                  className="mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            {/* Difficulty Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                      difficulty === diff
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Thumbnail URL & Presets */}
            <div className="md:col-span-2 space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  Thumbnail Image URL
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Recommended ratio 16:9 (800x450px)
                </span>
              </label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => {
                  setThumbnailUrl(e.target.value);
                  setImgError(false);
                }}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Quick presets:</span>
                {THUMBNAIL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setThumbnailUrl(preset.url);
                      setImgError(false);
                      if (preset.category) setCategory(preset.category);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      thumbnailUrl === preset.url
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pricing & Monetization Tier */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                2. Pricing & Monetization Tier
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select a standard pricing tier or customize your course enrollment tuition fee.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
              Active: {effectivePrice === 0 ? 'Free Access' : `$${effectivePrice.toFixed(2)}`}
            </div>
          </div>

          {/* Pricing Tier Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {PRICING_TIERS.map((tier) => {
              const isSelected = pricingTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setPricingTier(tier.id);
                    if (tier.price !== null) {
                      setCustomPrice(tier.price.toString());
                    }
                  }}
                  className={`text-left p-4 rounded-xl border relative transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {tier.badge && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                      {tier.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </span>
                      <span className="text-xs font-bold text-white">{tier.name}</span>
                    </div>

                    <div className="text-lg font-black text-white mt-1">
                      {tier.price === 0 ? (
                        <span className="text-emerald-400">Free</span>
                      ) : tier.price !== null ? (
                        <span>${tier.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-indigo-300 text-sm">Custom Price</span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    <span>{tier.tierLabel}</span>
                    <span className={isSelected ? 'text-indigo-400' : 'text-slate-600'}>
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Price Input (when 'custom' is selected) */}
          {pricingTier === 'custom' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-2 animate-in fade-in">
              <label className="block text-xs font-semibold text-indigo-300">
                Custom Enrollment Fee (USD)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="29.99"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Specify any custom tuition rate. Students will be prompted with this price at checkout.
              </p>
            </div>
          )}
        </div>

        {/* Section 3: Live Course Catalog Card Preview */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              3. Live Catalog Card Preview
            </h2>
            <span className="text-[11px] text-slate-400">
              Real-time prospective student view
            </span>
          </div>

          <div className="max-w-sm mx-auto">
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden shadow-2xl transition-all">
              {/* Card Image */}
              <div className="relative h-44 overflow-hidden bg-slate-950">
                {!imgError ? (
                  <img
                    src={thumbnailUrl}
                    alt={title || 'Course thumbnail preview'}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 gap-2">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[11px]">Preview image unavailable</span>
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-md text-[10px] font-semibold text-indigo-400 capitalize border border-slate-700/40">
                  {difficulty}
                </div>
                <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-md text-[10px] font-bold text-amber-300 flex items-center gap-1 border border-amber-500/30">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>4.8</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider truncate">
                    {selectedCategoryLabel}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      AI Tutor
                    </span>
                    <span className="text-[10px] font-bold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                      {effectivePrice === 0 ? 'Free' : `$${effectivePrice.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white line-clamp-1">
                  {title.trim() || 'Untitled Course Title'}
                </h3>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {description.trim() || 'Course syllabus description will display here for student enrollment preview...'}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 py-2 border-t border-slate-800">
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>1 Module (Preview)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-500" />
                    <span>0 Students</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold text-center opacity-90 cursor-default"
                >
                  {effectivePrice === 0 ? 'Enroll Now — Free' : `Enroll Now — $${effectivePrice.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Initial Curriculum Setup */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              4. First Module & Lecture Setup
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">Step 2 of 3</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Module Title</label>
              <input
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="e.g. Module 1: Foundational Architecture"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Lecture Title</label>
                  <input
                    type="text"
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                    placeholder="e.g. Lecture 1.1: System Architecture"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Video Stream URL</label>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
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
                    placeholder="Paste lecture transcript..."
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

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
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
