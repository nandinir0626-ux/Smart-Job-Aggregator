const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  tailorResume,
  getInterviewPrep,
  generateCoverLetter,
  getSkillRoadmap,
} = require('../controllers/careerIntelligenceController');

const router = express.Router();

router.post('/jobs/:id/tailor-resume', authenticate, tailorResume);
router.get('/jobs/:id/interview-prep', authenticate, getInterviewPrep);
router.post('/jobs/:id/cover-letter', authenticate, generateCoverLetter);
router.get('/skills/:skillName/roadmap', authenticate, getSkillRoadmap);

module.exports = router;
