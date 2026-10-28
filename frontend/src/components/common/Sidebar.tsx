import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import {
  LayoutDashboard,
  Compass,
  GraduationCap,
  Sparkles,
  Award,
  Layers,
  FileCheck,
  PlusCircle,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const studentLinks = [
    { to: '/dashboard', label: 'My Learning', icon: LayoutDashboard },
    { to: '/catalog', label: 'Course Catalog', icon: Compass },
    { to: '/flashcards', label: 'Flashcards', icon: Layers },
    { to: '/study-plan', label: 'AI Study Plan', icon: Sparkles },
    { to: '/achievements', label: 'Badges & Streaks', icon: Award },
  ];

  const instructorLinks = [
    { to: '/instructor', label: 'Instructor Hub', icon: LayoutDashboard },
    { to: '/instructor/courses/new', label: 'Author New Course', icon: PlusCircle },
    { to: '/instructor/grading', label: 'Grading Queue', icon: FileCheck },
    { to: '/catalog', label: 'Browse Catalog', icon: Compass },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Admin Overview', icon: ShieldCheck },
    { to: '/admin/approvals', label: 'Course Approvals', icon: ClipboardList },
    { to: '/admin/users', label: 'User Directory', icon: GraduationCap },
    { to: '/catalog', label: 'Course Catalog', icon: Compass },
  ];

  const links = role === 'admin' ? adminLinks : role === 'instructor' ? instructorLinks : studentLinks;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md hidden md:flex flex-col justify-between py-6 px-4 shrink-0">
      <div className="space-y-6">
        <div>
          <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {role === 'admin' ? 'Administration' : role === 'instructor' ? 'Course Management' : 'Learning Workspace'}
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/dashboard' || link.to === '/instructor' || link.to === '/admin'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Embedded AI Tutor Quick Helper Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/20 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xs font-bold text-white">AI Tutor Ready</div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
          Ask questions anytime inside course lectures for grounded answers and citations.
        </p>
        <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          RAG Vector Retrieval Active
        </div>
      </div>
    </aside>
  );
};
