import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import {
  Sparkles,
  Flame,
  Bell,
  LogOut,
  User as UserIcon,
  Shield,
  GraduationCap,
  BookOpen,
  ChevronDown,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { api } from '../../services/api';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export const Navbar: React.FC = () => {
  const { user, logout, quickSwitch } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Theme Toggle State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  // Language state scaffold
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('lang') || 'en';
  });

  useEffect(() => {
    if (user) {
      api.get('/notifications/me')
        .then(res => setUnreadCount(res.data.unread_count || 0))
        .catch(() => {});
    }
  }, [user]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleSelectLanguage = (langCode: string) => {
    setLanguage(langCode);
    localStorage.setItem('lang', langCode);
    setShowLangMenu(false);
  };

  const handleRoleSwitch = async (role: 'student' | 'instructor' | 'admin') => {
    setShowRoleMenu(false);
    await quickSwitch(role);
    if (role === 'admin') navigate('/admin');
    else if (role === 'instructor') navigate('/instructor');
    else navigate('/dashboard');
  };

  const currentLangObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                LMS<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">-AI</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Vertexon Education</span>
            </div>
          </Link>

          {/* Catalog Link */}
          <Link
            to="/catalog"
            className="ml-6 hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-slate-400" />
            Explore Courses
          </Link>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Daily Streak Indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Flame className="w-4 h-4 fill-amber-400" />
                <span>{user.streak?.current ?? 0}d Streak</span>
              </div>

              {/* Persona Quick Switcher */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 transition-all"
                  title="Switch Persona Demo View"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="capitalize">{user.role} View</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Demo Personas
                    </div>
                    <button
                      onClick={() => handleRoleSwitch('student')}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-left transition-colors ${
                        user.role === 'student' ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div>Alex (Student)</div>
                        <div className="text-[10px] text-slate-400">Learner & AI Tutor view</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('instructor')}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-left transition-colors ${
                        user.role === 'instructor' ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div>Dr. Priya (Instructor)</div>
                        <div className="text-[10px] text-slate-400">Course & Quiz authoring</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('admin')}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-left transition-colors ${
                        user.role === 'admin' ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-amber-400" />
                      <div>
                        <div>Admin Supervisor</div>
                        <div className="text-[10px] text-slate-400">Approvals & user roles</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <Link
                to="/notifications"
                className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
                )}
              </Link>

              {/* Language Selector Scaffold */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
                  title="Switch Language"
                >
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline text-[11px] font-semibold">{currentLangObj.flag}</span>
                </button>

                {showLangMenu && (
                  <div className="absolute right-0 mt-2 w-36 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors ${
                          language === lang.code ? 'bg-indigo-600/20 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dark / Light Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
              </button>

              {/* Profile Avatar / Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-slate-700 transition-all"
                >
                  <img
                    src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                    alt={user.full_name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50">
                    <div className="px-3 py-2 border-b border-slate-700 mb-1">
                      <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
                      <div className="text-xs text-slate-400 truncate">{user.email}</div>
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60 rounded-lg transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      My Learning Hub
                    </Link>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
