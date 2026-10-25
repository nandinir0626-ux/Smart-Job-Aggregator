import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import JobCard from '../components/JobCard';
import {
  Search,
  Filter,
  MapPin,
  Globe,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Layers,
  ListFilter,
  ArrowUp,
  Sparkles,
} from 'lucide-react';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState('infinite'); // 'infinite' | 'paged'
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Filter States
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState('');
  const [source, setSource] = useState('');
  const [skills, setSkills] = useState('');
  const [postedWithin, setPostedWithin] = useState('');
  const [sort, setSort] = useState('recency');
  const [page, setPage] = useState(1);

  const observerTarget = useRef(null);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchJobs = async (targetPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = {
        page: targetPage,
        limit: 12,
        sort,
      };
      if (query.trim()) params.q = query.trim();
      if (location.trim()) params.location = location.trim();
      if (remote !== '') params.remote = remote;
      if (source) params.source = source;
      if (skills.trim()) params.skills = skills.trim();
      if (postedWithin) params.postedWithin = postedWithin;

      const res = await api.get('/jobs', { params });
      const newJobs = res.data.jobs || [];
      const newPagination = res.data.pagination || { total: 0, page: targetPage, limit: 12, totalPages: 1 };

      if (append) {
        setJobs((prev) => {
          const existingIds = new Set(prev.map((j) => j._id));
          const filtered = newJobs.filter((j) => !existingIds.has(j._id));
          return [...prev, ...filtered];
        });
      } else {
        setJobs(newJobs);
      }
      setPagination(newPagination);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load or sort change
  useEffect(() => {
    setPage(1);
    fetchJobs(1, false);
  }, [sort]);

  // Handle page change in 'paged' mode
  useEffect(() => {
    if (viewMode === 'paged') {
      fetchJobs(page, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, viewMode]);

  // Infinite scroll intersection observer
  const handleObserver = useCallback(
    (entries) => {
      const [target] = entries;
      if (
        target.isIntersecting &&
        viewMode === 'infinite' &&
        !loading &&
        !loadingMore &&
        page < pagination.totalPages
      ) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchJobs(nextPage, true);
      }
    },
    [viewMode, loading, loadingMore, page, pagination.totalPages]
  );

  useEffect(() => {
    const el = observerTarget.current;
    if (!el || viewMode !== 'infinite') return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0.1,
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver, viewMode]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchJobs(1, false);
  };

  const handleClearFilters = () => {
    setQuery('');
    setLocation('');
    setRemote('');
    setSource('');
    setSkills('');
    setPostedWithin('');
    setSort('recency');
    setPage(1);
    setTimeout(() => {
      fetchJobs(1, false);
    }, 0);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Explore Open Roles</h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated, deduplicated, and cached in real-time with sub-millisecond query delivery.
          </p>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setViewMode('infinite');
              setPage(1);
              fetchJobs(1, false);
            }}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 ${
              viewMode === 'infinite'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Infinite Stream</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('paged');
              setPage(1);
              fetchJobs(1, false);
            }}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 ${
              viewMode === 'paged'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Paged View</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Job title, keywords, or company..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div className="relative w-full md:w-64">
            <MapPin className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State, or Country"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition shrink-0"
          >
            Search
          </button>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Remote Dropdown */}
          <select
            value={remote}
            onChange={(e) => {
              setRemote(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Work Types</option>
            <option value="true">Remote Only</option>
            <option value="false">On-Site Only</option>
          </select>

          {/* Source Dropdown */}
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Sources</option>
            <option value="remotive">Remotive API</option>
            <option value="arbeitnow">Arbeitnow API</option>
          </select>

          {/* Posted Within */}
          <select
            value={postedWithin}
            onChange={(e) => {
              setPostedWithin(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Anytime</option>
            <option value="7">Past 7 days</option>
            <option value="14">Past 14 days</option>
            <option value="30">Past 30 days</option>
          </select>

          {/* Skills Filter input */}
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Skill (e.g. React, Python)"
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500 w-44"
          />

          {/* Sort By */}
          <div className="ml-auto flex items-center space-x-2">
            <span className="text-slate-400">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none"
            >
              <option value="recency">Most Recent</option>
              <option value="relevance">Keyword Relevance</option>
            </select>
          </div>

          {(query || location || remote || source || skills || postedWithin) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center space-x-1 text-slate-500 hover:text-rose-600 transition ml-2 font-medium"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </form>

      {/* Results Count & Status */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{jobs.length}</strong> of{' '}
          <strong className="text-slate-800">{pagination.total}</strong> positions found
          {viewMode === 'infinite' && ' • Smooth continuous stream enabled'}
        </span>
        {viewMode === 'infinite' && pagination.totalPages > 1 && (
          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium px-2 py-0.5 rounded-md">
            Batch {page} of {pagination.totalPages} loaded
          </span>
        )}
      </div>

      {/* Initial Loading Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl border border-slate-200 p-6 animate-pulse space-y-4 shadow-sm"
            >
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
              <div className="h-16 bg-slate-50 rounded-xl" />
              <div className="flex space-x-2 pt-2">
                <div className="h-6 w-16 bg-slate-100 rounded-md" />
                <div className="h-6 w-20 bg-slate-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
          <SlidersHorizontal className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-800">No matching jobs found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        /* Jobs Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel & Loading More Skeletons */}
      {viewMode === 'infinite' && (
        <div ref={observerTarget} className="py-6">
          {loadingMore && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-700 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Streaming next batch of jobs...</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl border border-slate-200 p-6 animate-pulse space-y-4 shadow-sm"
                  >
                    <div className="h-4 bg-slate-200 rounded-md w-2/3" />
                    <div className="h-3 bg-slate-100 rounded-md w-1/3" />
                    <div className="h-12 bg-slate-50 rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !loadingMore && page >= pagination.totalPages && jobs.length > 0 && (
            <div className="text-center py-8 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-center space-x-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>You've viewed all {pagination.total} opportunities currently available.</span>
            </div>
          )}
        </div>
      )}

      {/* Classic Paged Pagination Controls */}
      {viewMode === 'paged' && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-semibold text-slate-700 px-4">
            Page {page} of {pagination.totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Floating Scroll to Top Pill */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 z-40"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
