/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Dashboard from './components/Dashboard.js';
import CompanyExplorer from './components/CompanyExplorer.js';
import { LayoutDashboard, Building2 } from 'lucide-react';
import { cn } from './lib/utils.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer'>('dashboard');

  return (
    <div className="min-h-screen bg-[#F1F3F4] text-[#202124] font-sans flex flex-col">
      <nav className="h-12 bg-[#1A73E8] text-white flex items-center px-4 justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#E8F0FE]/20 p-1.5 rounded text-white hidden sm:block">
            <LayoutDashboard size={18} />
          </div>
          <h1 className="text-sm font-bold tracking-tight uppercase">CSE Analyst v1.0</h1>
        </div>
        <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded transition-colors",
              activeTab === 'dashboard' ? "bg-white text-[#1A73E8] shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <LayoutDashboard size={14} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded transition-colors",
              activeTab === 'explorer' ? "bg-white text-[#1A73E8] shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <Building2 size={14} />
            Explorer
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'dashboard' && <Dashboard onExplore={() => setActiveTab('explorer')} />}
        {activeTab === 'explorer' && <CompanyExplorer />}
      </main>

      <footer className="h-8 bg-white border-t border-gray-200 flex items-center px-4 justify-between text-[10px] text-gray-400 mt-auto shrink-0">
        <span>CSE Unofficial API Analysis</span>
        <span className="italic">Data for personal research. Not financial advice.</span>
      </footer>
    </div>
  );
}

