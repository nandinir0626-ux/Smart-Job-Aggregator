import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  MapPin,
  Globe,
  DollarSign,
  Calendar,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Layers,
  Sparkles,
  HelpCircle,
  FileText,
  BookOpen,
  Copy,
  Check,
  AlertTriangle,
  X,
  Target
} from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  // AI Modal States
  const [activeModal, setActiveModal] = useState(null); // 'tailor' | 'interview' | 'coverletter' | 'roadmap'
  const [modalLoading, setModalLoading] = useState(false);
  const [tailorData, setTailorData] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [coverLetterData, setCoverLetterData] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/jobs/${id}`);
        setJob(res.data.job);

        // Check if saved
        const savedRes = await api.get('/saved');
        const isSaved = (savedRes.data.savedJobs || []).some(
          (s) => s.jobId?._id === id || s.jobId === id
        );
        setSaved(isSaved);
      } catch (err) {
        console.error('Error fetching job detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  const handleSaveToggle = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (saved) {
        await api.post('/saved', { jobId: id, status: 'saved' });
        setSaved(false);
        setStatusNote('Removed from saved list');
      } else {
        await api.post('/saved', { jobId: id, status: 'saved' });
        setSaved(true);
        setStatusNote('Added to saved applications tracker!');
      }
      setTimeout(() => setStatusNote(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // AI Handlers
  const handleOpenTailor = async () => {
    setActiveModal('tailor');
    if (!tailorData) {
      setModalLoading(true);
      try {
        const res = await api.post(`/career/jobs/${id}/tailor-resume`);
        setTailorData(res.data);
      } catch (err) {
        console.error('Tailor error:', err);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleOpenInterview = async () => {
    setActiveModal('interview');
    if (!interviewData) {
      setModalLoading(true);
      try {
        const res = await api.get(`/career/jobs/${id}/interview-prep`);
        setInterviewData(res.data);
      } catch (err) {
        console.error('Interview error:', err);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleOpenCoverLetter = async () => {
    setActiveModal('coverletter');
    if (!coverLetterData) {
      setModalLoading(true);
      try {
        const res = await api.post(`/career/jobs/${id}/cover-letter`);
        setCoverLetterData(res.data.coverLetter);
      } catch (err) {
        console.error('Cover letter error:', err);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleOpenRoadmap = async (skillName) => {
    setActiveModal('roadmap');
    setModalLoading(true);
    try {
      const res = await api.get(`/career/skills/${encodeURIComponent(skillName)}/roadmap`);
      setRoadmapData(res.data.roadmap);
    } catch (err) {
      console.error('Roadmap error:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-base font-bold text-slate-800">Job Posting Not Found</p>
        <Link to="/jobs" className="mt-4 inline-block text-emerald-600 text-xs font-semibold">
          ← Back to all jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <Link
        to="/jobs"
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to search</span>
      </Link>

      {/* Main Job Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
              {job.isStale && (
                <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  <span>Stale Posting (&gt;60d)</span>
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-emerald-600 mt-1">{job.company}</p>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
              <span className="inline-flex items-center space-x-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{job.location}</span>
              </span>

              {job.remote && (
                <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-medium">
                  <Globe className="h-3 w-3" />
                  <span>Remote</span>
                </span>
              )}

              {job.salaryNormalized?.display && (
                <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md font-bold">
                  <DollarSign className="h-3 w-3 text-emerald-600" />
                  <span>{job.salaryNormalized.display}</span>
                </span>
              )}

              <span className="inline-flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Posted {new Date(job.postedAt).toLocaleDateString()}</span>
              </span>

              <span className="text-[11px] text-slate-400 capitalize">• Source: {job.source}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleSaveToggle}
              disabled={saving}
              className={`px-4 py-2.5 rounded-xl border font-semibold text-xs transition flex items-center space-x-2 ${
                saved
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {saved ? (
                <>
                  <BookmarkCheck className="h-4 w-4 text-emerald-600" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4 text-slate-400" />
                  <span>Save Job</span>
                </>
              )}
            </button>

            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1.5"
              >
                <span>Apply on Portal</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* AI Career Copilot Action Bar */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 mb-3">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>AI Career Copilot Tools</span>
            <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Instant
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleOpenTailor}
              className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-3 rounded-xl text-left transition flex items-start space-x-2.5 shadow-xs"
            >
              <Target className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">1-Click Resume Tailor</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Adapt bullet points to match role keywords</p>
              </div>
            </button>

            <button
              onClick={handleOpenInterview}
              className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-3 rounded-xl text-left transition flex items-start space-x-2.5 shadow-xs"
            >
              <HelpCircle className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Interview Question Prep</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Predict 5 technical & behavioral questions</p>
              </div>
            </button>

            <button
              onClick={handleOpenCoverLetter}
              className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-3 rounded-xl text-left transition flex items-start space-x-2.5 shadow-xs"
            >
              <FileText className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Generate Cover Letter</p>
                <p className="text-[11px] text-slate-500 mt-0.5">High-converting 3-paragraph letter</p>
              </div>
            </button>
          </div>
        </div>

        {statusNote && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{statusNote}</span>
          </div>
        )}

        {/* Deduplication Also On Sources */}
        {job.alsoOn && job.alsoOn.length > 0 && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 mb-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <span>Deduplication Intelligence</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Our worker identified near-duplicate postings for this position across multiple sources:
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-medium">
                Primary: {job.source}
              </span>
              {job.alsoOn.map((other, idx) => (
                <a
                  key={idx}
                  href={other.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-white border border-slate-200 hover:border-emerald-400 px-2.5 py-1 rounded-lg text-slate-700 font-medium inline-flex items-center space-x-1 transition"
                >
                  <span>Also on {other.source}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Skills Required with Interactive Learning Roadmap */}
        {job.skills && job.skills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-slate-900">Key Technical Competencies</h3>
              <span className="text-[11px] text-slate-400">Click "Learn" for instant 3-step study roadmaps</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <div
                  key={skill}
                  className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-medium px-3 py-1 rounded-lg flex items-center space-x-1.5"
                >
                  <span>{skill}</span>
                  <button
                    onClick={() => handleOpenRoadmap(skill)}
                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded transition"
                    title={`View learning roadmap for ${skill}`}
                  >
                    Learn
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Job Description */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2.5">Role Description</h3>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            {job.description}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: AI Resume Tailor */}
      {/* ============================================================== */}
      {activeModal === 'tailor' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Tailored Resume Experience</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
                <p className="text-xs font-medium text-slate-600">Analyzing job keywords & tailoring bullets...</p>
              </div>
            ) : tailorData ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                  <p className="font-bold text-emerald-900 mb-1">Tailored Executive Summary:</p>
                  <p className="text-slate-700 leading-relaxed">{tailorData.tailoredSummary}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-800">Target Keywords Injected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailorData.targetedKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-md font-semibold">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-slate-800">Experience Bullets Comparison:</p>
                  {tailorData.tailoredExperience.map((exp, eIdx) => (
                    <div key={eIdx} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <p className="text-xs font-bold text-slate-900">{exp.role} • {exp.company}</p>
                      {exp.tailoredBullets.map((b, bIdx) => (
                        <div key={bIdx} className="text-xs space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                          <p className="text-slate-400 line-through text-[11px]">{b.original}</p>
                          <p className="text-slate-800 font-medium">✨ {b.tailored}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: AI Interview Question Prep */}
      {/* ============================================================== */}
      {activeModal === 'interview' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <HelpCircle className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">AI Predicted Interview Questions</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-teal-600 mb-2" />
                <p className="text-xs font-medium text-slate-600">Generating interview questions & answer hints...</p>
              </div>
            ) : interviewData ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Targeted questions based on your resume's skill overlap with <strong>{interviewData.jobTitle}</strong> at <strong>{interviewData.company}</strong>:
                </p>
                {interviewData.questions.map((q) => (
                  <div key={q.id} className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                        {q.type} • {q.topic}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{q.id}. {q.question}</p>
                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed">
                      💡 <strong>Key strategy:</strong> {q.hint}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: AI Cover Letter */}
      {/* ============================================================== */}
      {activeModal === 'coverletter' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Tailored Cover Letter</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-sky-600 mb-2" />
                <p className="text-xs font-medium text-slate-600">Drafting tailored cover letter...</p>
              </div>
            ) : coverLetterData ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCopy(coverLetterData)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                  {coverLetterData}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: Skill Gap Learning Roadmap */}
      {/* ============================================================== */}
      {activeModal === 'roadmap' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  3-Step Learning Roadmap: {roadmapData?.skill}
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
                <p className="text-xs font-medium text-slate-600">Retrieving study roadmap & docs...</p>
              </div>
            ) : roadmapData ? (
              <div className="space-y-4">
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 text-xs font-medium text-emerald-800">
                  Category: <strong>{roadmapData.category}</strong>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-900">Step-by-Step Curriculum:</p>
                  {roadmapData.steps.map((st, i) => (
                    <div key={i} className="flex items-start space-x-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                        {i + 1}
                      </span>
                      <p>{st}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-100/70 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-slate-800">Recommended Starter Project:</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{roadmapData.starterProject}</p>
                </div>

                <a
                  href={roadmapData.officialDocs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <span>Open Official Documentation</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
