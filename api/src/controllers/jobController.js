const Job = require('../models/Job');
const cacheService = require('../services/cacheService');

const getJobs = async (req, res, next) => {
  try {
    const {
      q,
      location,
      remote,
      source,
      skills,
      postedWithin,
      page = 1,
      limit = 20,
      sort = 'recency',
    } = req.query;

    // Check Redis cache first (sub-millisecond return)
    const cacheKey = `jobs:${JSON.stringify({ q, location, remote, source, skills, postedWithin, page, limit, sort })}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        _cached: true,
      });
    }

    const query = {};

    // Text search or regex match
    if (q && q.trim()) {
      const term = q.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { company: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    // Location filter
    if (location && location.trim()) {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    // Remote filter
    if (remote !== undefined && remote !== '') {
      query.remote = remote === 'true' || remote === true;
    }

    // Source filter
    if (source && source.trim()) {
      query.source = source.trim();
    }

    // Skills filter (comma-separated: e.g. "React,Python")
    if (skills && skills.trim()) {
      const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillList.length > 0) {
        query.skills = { $in: skillList };
      }
    }

    // postedWithin filter (in days)
    if (postedWithin && !isNaN(postedWithin)) {
      const days = parseInt(postedWithin, 10);
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      query.postedAt = { $gte: sinceDate };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortOptions = { postedAt: -1 };
    if (sort === 'relevance' && q) {
      sortOptions = { score: { $meta: 'textScore' }, postedAt: -1 };
    }

    const totalPromise = Object.keys(query).length === 0
      ? Job.estimatedDocumentCount()
      : Job.countDocuments(query);

    const [total, jobs] = await Promise.all([
      totalPromise,
      Job.find(query, { embedding: 0 })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const result = {
      success: true,
      jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };

    // Cache query results for 5 minutes (300 seconds)
    await cacheService.set(cacheKey, result, 300);

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const cacheKey = `job:${req.params.id}`;
    const cachedJob = await cacheService.get(cacheKey);
    if (cachedJob) {
      return res.status(200).json({ success: true, job: cachedJob, _cached: true });
    }

    const job = await Job.findById(req.params.id, { embedding: 0 }).lean();
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Cache job details for 10 minutes (600 seconds)
    await cacheService.set(cacheKey, job, 600);

    return res.status(200).json({ success: true, job });
  } catch (err) {
    next(err);
  }
};

module.exports = { getJobs, getJobById };
