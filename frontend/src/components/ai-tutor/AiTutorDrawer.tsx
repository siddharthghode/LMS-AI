import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import {
  Sparkles,
  X,
  Send,
  BookOpen,
  Clock,
  Layers,
  ArrowRight,
  Bot,
  User,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface Source {
  lecture_id: string;
  lecture_title: string;
  timestamp_seconds: number;
  excerpt: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  sources?: Source[];
  created_at?: string;
}

interface AiTutorDrawerProps {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onSeekLecture?: (lectureId: string, timestampSeconds: number) => void;
}

export const AiTutorDrawer: React.FC<AiTutorDrawerProps> = ({
  courseId,
  isOpen,
  onClose,
  onSeekLecture,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or fetch active session
  useEffect(() => {
    if (isOpen && courseId) {
      api.post('/ai/chat/sessions', { course_id: courseId, mode })
        .then(res => {
          const s = res.data;
          setSessionId(s.id);
          setMode(s.mode || 'intermediate');
          return api.get(`/ai/chat/sessions/${s.id}/messages`);
        })
        .then(msgRes => {
          if (msgRes.data && msgRes.data.length > 0) {
            setMessages(msgRes.data);
          } else {
            // Welcome message
            setMessages([
              {
                id: 'welcome',
                sender: 'ai',
                content: "Hello! I am your AI Course Tutor. Ask me any question about the lectures, concepts, code examples, or quizzes in this course. Every answer is grounded directly in your course material with exact lecture citations.",
              },
            ]);
          }
        })
        .catch(err => console.error('Failed to init AI chat session:', err));
    }
  }, [isOpen, courseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleModeChange = async (newMode: 'beginner' | 'intermediate' | 'advanced') => {
    setMode(newMode);
    if (sessionId) {
      try {
        await api.put(`/ai/chat/sessions/${sessionId}/mode`, { mode: newMode });
      } catch (err) {
        console.error('Mode change error:', err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || !sessionId || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const res = await api.post(`/ai/chat/sessions/${sessionId}/messages`, { message: text });
      const aiReply: Message = {
        id: res.data.message?.id || Date.now().toString(),
        sender: 'ai',
        content: res.data.reply,
        sources: res.data.sources || [],
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiReply]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'ai',
          content: 'I apologize, but I could not retrieve an answer right now. Please check your query or verify server connectivity.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 p-0.5">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Course AI Tutor
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                RAG Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Context grounded in course lectures</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Explanation Mode Switcher */}
      <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-800/60 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          Explanation Mode:
        </span>
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
          {(['beginner', 'intermediate', 'advanced'] as const).map(m => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${
                mode === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
              {msg.sender === 'ai' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-300">AI Tutor</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-300">You</span>
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                </>
              )}
            </div>

            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-md'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Source Citations */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-400" />
                    Verified Citations:
                  </div>
                  {msg.sources.map((src, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSeekLecture?.(src.lecture_id, src.timestamp_seconds)}
                      className="group cursor-pointer p-2 rounded-lg bg-slate-900/80 border border-slate-700 hover:border-emerald-500/50 transition-all text-[11px]"
                    >
                      <div className="flex items-center justify-between text-emerald-400 font-semibold mb-1">
                        <span className="truncate">{src.lecture_title}</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-emerald-300">
                          <Clock className="w-2.5 h-2.5" />
                          {Math.floor(src.timestamp_seconds / 60)}:{(src.timestamp_seconds % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-slate-400 italic line-clamp-2">"{src.excerpt}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-400 animate-pulse">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            Searching course vector embeddings & generating grounded response...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
        <button
          onClick={() => handleSendMessage('Why is cosine distance preferred over Euclidean distance?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 transition-colors"
        >
          💡 Cosine vs Euclidean
        </button>
        <button
          onClick={() => handleSendMessage('Explain sliding window chunking and overlap')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 transition-colors"
        >
          🧩 Chunking & Overlap
        </button>
        <button
          onClick={() => handleSendMessage('How does a ReAct agent reason with tool calling?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 transition-colors"
        >
          🤖 ReAct Loop
        </button>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask a question in ${mode} mode...`}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/30 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
