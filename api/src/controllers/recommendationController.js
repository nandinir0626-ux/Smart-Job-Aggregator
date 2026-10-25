const Resume = require('../models/Resume');
const Job = require('../models/Job');
const User = require('../models/User');

/**
 * Computes cosine similarity between two normalized vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0.0;
  }
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0.0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates hybrid score according to specification:
 * 0.50 * semantic cosine + 0.30 * skill overlap + 0.10 * location/remote + 0.10 * recency decay (14-day half-life)
 */
function calculateHybridScore(resume, job, userPreferences) {
  const userSkillsSet = new Set((resume.normalizedSkills || []).map((s) => s.toLowerCase()));
  const jobSkills = job.skills || [];
  
  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of jobSkills) {
    if (userSkillsSet.has(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // 1. Skill overlap score
  let skillScore = 0.0;
  if (jobSkills.length > 0) {
    skillScore = matchedSkills.length / jobSkills.length;
  } else {
    // Jaccard similarity fallback if job has no explicit skills
    const totalUnique = new Set([...userSkillsSet, ...jobSkills.map((s) => s.toLowerCase())]).size;
    skillScore = totalUnique > 0 ? matchedSkills.length / totalUnique : 0.2;
  }

  // 2. Semantic cosine score
  let cosine = 0.0;
  if (resume.embedding && job.embedding && resume.embedding.length > 0 && job.embedding.length > 0) {
    cosine = Math.max(0, cosineSimilarity(resume.embedding, job.embedding));
  } else {
    // If embeddings are not yet generated, fallback to skill score
    cosine = skillScore;
  }

  // 3. Location / Remote score
  let locScore = 0.0;
  const userRemote = userPreferences?.remote ?? true;
  const userLocations = (userPreferences?.locations || []).map((l) => l.toLowerCase());

  if (job.remote && userRemote) {
    locScore = 1.0;
  } else if (userLocations.some((loc) => job.location.toLowerCase().includes(loc))) {
    locScore = 1.0;
  } else if (!userLocations.length && userRemote) {
    locScore = 0.5;
  } else {
    locScore = 0.2;
  }

  // 4. Recency decay (half-life = 14 days)
  const jobPostedDate = job.postedAt ? new Date(job.postedAt) : new Date(job.createdAt);
  const now = new Date();
  const diffDays = Math.max(0, (now - jobPostedDate) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.exp((-Math.LN2 * diffDays) / 14);

  // Hybrid weights
  const finalScore = (
    0.50 * cosine +
    0.30 * skillScore +
    0.10 * locScore +
    0.10 * recencyScore
  );

  // Template-based explanation
  let explanation = '';
  if (matchedSkills.length > 0 && missingSkills.length > 0) {
    explanation = `Matched ${matchedSkills.length} of your key skills (${matchedSkills.slice(0, 3).join(', ')}). Consider learning ${missingSkills.slice(0, 2).join(', ')}.`;
  } else if (matchedSkills.length > 0) {
    explanation = `Outstanding skill alignment! Matched all ${matchedSkills.length} key skills (${matchedSkills.join(', ')}).`;
  } else {
    explanation = `Relevant role based on your experience profile in ${job.location || 'remote'}.`;
  }

  return {
    score: Math.min(1.0, Math.max(0.0, parseFloat(finalScore.toFixed(3)))),
    cosine: parseFloat(cosine.toFixed(3)),
    skillScore: parseFloat(skillScore.toFixed(3)),
    matchedSkills,
    missingSkills,
    explanation,
  };
}

const cacheService = require('../services/cacheService');

// Invalidate recommendation cache for a user or globally
async function clearRecommendationCache(userId) {
  if (userId) {
    await cacheService.invalidatePrefix(`recs:${userId}`);
  } else {
    await cacheService.invalidatePrefix('recs:');
  }
}

const getRecommendations = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const userId = req.user._id.toString();
    const cacheKey = `recs:${userId}:${limit}`;

    // 1. Check Redis cache first (15-min TTL)
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        _cached: true,
      });
    }

    const user = await User.findById(req.user._id);
    const resume = await Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 });

    if (!resume) {
      return res.status(200).json({
        success: true,
        message: 'No resume found. Upload a resume to receive personalized job recommendations.',
        recommendations: [],
        skillGaps: [],
      });
    }

    // Retrieve candidate jobs (e.g. up to 250 recent jobs)
    const jobs = await Job.find({}, {
      _id: 1,
      title: 1,
      company: 1,
      location: 1,
      remote: 1,
      skills: 1,
      salaryMin: 1,
      salaryMax: 1,
      url: 1,
      postedAt: 1,
      createdAt: 1,
      source: 1,
      embedding: 1,
      description: 1
    }).sort({ postedAt: -1 }).limit(250).lean();

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({
        success: true,
        recommendations: [],
        skillGaps: [],
      });
    }

    // Score jobs
    const scoredJobs = jobs.map((job) => {
      const scoring = calculateHybridScore(resume, job, user.preferences);
      return {
        job: {
          id: job._id,
          _id: job._id,
          title: job.title,
          company: job.company,
          location: job.location,
          remote: job.remote,
          description: job.description,
          skills: job.skills,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          url: job.url,
          postedAt: job.postedAt,
          source: job.source,
        },
        score: scoring.score,
        matchPercentage: Math.round(scoring.score * 100),
        matchedSkills: scoring.matchedSkills,
        missingSkills: scoring.missingSkills,
        explanation: scoring.explanation,
      };
    });

    // Sort descending by hybrid score
    scoredJobs.sort((a, b) => b.score - a.score);

    const topRecommendations = scoredJobs.slice(0, limit);

    // Compute Skill Gap analysis across top 20 recommendations
    const missingSkillCounts = {};
    const top20 = scoredJobs.slice(0, 20);
    for (const rec of top20) {
      for (const skill of rec.missingSkills) {
        missingSkillCounts[skill] = (missingSkillCounts[skill] || 0) + 1;
      }
    }

    const skillGaps = Object.entries(missingSkillCounts)
      .map(([skill, count]) => ({
        skill,
        count,
        percentage: Math.round((count / top20.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const responsePayload = {
      success: true,
      recommendations: topRecommendations,
      skillGaps,
      userThreshold: user.preferences?.minMatchScore ?? 0.60,
    };

    // Cache personalized recommendations for 15 minutes (900 seconds) in Redis
    await cacheService.set(cacheKey, responsePayload, 900);

    return res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRecommendations,
  calculateHybridScore,
  clearRecommendationCache,
};
