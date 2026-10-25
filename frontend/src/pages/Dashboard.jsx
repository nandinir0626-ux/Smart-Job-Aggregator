import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import JobCard from '../components/JobCard';
import SkillGapCard from '../components/SkillGapCard';
import {
  Sparkles,
  UploadCloud,
  Loader2,
  RefreshCw,
  AlertCircle,
  Briefcase,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [skillGaps, setSkillGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasResume, setHasResume] = useState(true);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/recommendations?limit=25');
      setRecommendations(res.data.recommendations || []);
      setSkillGaps(res.data.skillGaps || []);
      if (!res.data.recommendations || res.data.recommendations.length === 0) {
        // Check if user has uploaded resume
        const resumeRes = await api.get('/resumes/latest');
        if (!resumeRes.data.resume) {
          setHasResume(false);
        }
      } else {
        setHasResume(true);
      }
    } catch (err) {
      setError('Failed to load personalized recommendations.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Hybrid Matching Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Engineer'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Real-time job opportunities curated specifically for your skill profile and target preferences.
            New jobs are continually crawled, deduplicated, and scored.
          </p>
        </div>
      </div>

      {/* No Resume CTA */}
      {!loading && !hasResume && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload your resume to activate AI recommendations</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Our PyMuPDF + LLM extraction pipeline automatically normalizes your skills and computes hybrid match scores.
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 shadow-sm transition flex items-center space-x-1.5"
          >
            <span>Upload Resume</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchRecommendations}
            className="font-semibold underline hover:text-rose-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm font-medium text-slate-600">Calculating semantic and skill alignment...</p>
        </div>
      )}

      {/* Main Content Grid: Recommendations + Skill Gap Sidebar */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recommendations List (2 columns on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recommended For You</h2>
                <p className="text-xs text-slate-500">
                  Ranked by hybrid score (Cosine similarity + skill overlap + preferences)
                </p>
              </div>
              <button
                onClick={fetchRecommendations}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Refresh recommendations"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {recommendations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <Briefcase className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-800">No matching jobs found yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try lowering your minimum match threshold in profile preferences or upload an updated resume.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec) => (
                  <JobCard
                    key={rec.job._id || rec.job.id}
                    job={rec.job}
                    matchData={{
                      score: rec.score,
                      matchPercentage: rec.matchPercentage,
                      matchedSkills: rec.matchedSkills,
                      missingSkills: rec.missingSkills,
                      explanation: rec.explanation,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Skill Gap Card */}
          <div className="space-y-6">
            <SkillGapCard skillGaps={skillGaps} />

            {/* Quick Profile Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm text-xs text-slate-600 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Your Preference Profile</h3>
              <div className="space-y-1.5">
                <p>
                  <span className="font-semibold text-slate-700">Remote Preference:</span>{' '}
                  {user?.preferences?.remote ? 'Open to Remote' : 'On-Site Only'}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Min Match Score:</span>{' '}
                  {Math.round((user?.preferences?.minMatchScore ?? 0.6) * 100)}%
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Target Roles:</span>{' '}
                  {user?.preferences?.roles?.join(', ') || 'Any Software Role'}
                </p>
              </div>
              <Link
                to="/profile"
                className="text-emerald-600 font-semibold block pt-2 hover:underline"
              >
                Edit Preferences & Resume →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
