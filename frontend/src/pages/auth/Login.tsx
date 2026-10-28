import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { Sparkles, ArrowRight, Lock, Mail, GraduationCap, BookOpen, Shield } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string, role: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(presetEmail, 'Password123!');
      if (role === 'admin') navigate('/admin');
      else if (role === 'instructor') navigate('/instructor');
      else navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-400 p-0.5 shadow-xl shadow-indigo-600/20 mb-3">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Sign in to LMS-AI</h2>
          <p className="text-xs text-slate-400 mt-1">
            Access your course workspace and interactive AI tutor
          </p>
        </div>

        {/* Demo Fast Login Personas */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
            ⚡ Quick-Launch Demo Accounts
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickLogin('student@lms.local', 'student')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] mb-0.5">
                <GraduationCap className="w-3.5 h-3.5" />
                Student
              </div>
              <div className="text-[10px] text-slate-400 truncate">Alex Johnson</div>
            </button>

            <button
              onClick={() => handleQuickLogin('instructor@lms.local', 'instructor')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px] mb-0.5">
                <BookOpen className="w-3.5 h-3.5" />
                Instructor
              </div>
              <div className="text-[10px] text-slate-400 truncate">Dr. Priya</div>
            </button>

            <button
              onClick={() => handleQuickLogin('admin@lms.local', 'admin')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] mb-0.5">
                <Shield className="w-3.5 h-3.5" />
                Admin
              </div>
              <div className="text-[10px] text-slate-400 truncate">Supervisor</div>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-4 shadow-xl">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
