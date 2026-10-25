import React from 'react';
import { Target, TrendingUp, BookOpen } from 'lucide-react';

export default function SkillGapCard({ skillGaps = [] }) {
  if (!skillGaps || skillGaps.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
      <div className="flex items-center space-x-2.5 mb-3">
        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Market Skill Gap Analysis</h3>
          <p className="text-xs text-slate-500">Most requested skills missing from your profile</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 mb-4 leading-relaxed">
        Adding these in-demand competencies to your resume will significantly expand your qualified job matches.
      </p>

      <div className="space-y-3">
        {skillGaps.map((item) => (
          <div key={item.skill} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-800 flex items-center space-x-1.5">
                <span>{item.skill}</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                Missing in {item.count} jobs ({item.percentage}%)
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, item.percentage))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
