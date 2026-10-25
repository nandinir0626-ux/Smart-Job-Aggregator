const app = require('./src/app');
const { connectDB, mongoose } = require('./src/config/db');
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');
const config = require('./src/config');
const request = require('supertest');

async function testPhase4() {
  console.log('--- TESTING PHASE 4: RECOMMENDATIONS & HYBRID RANKING ---');
  await connectDB();

  const user = await User.findOne({ email: 'resume.test@example.com' });
  if (!user) throw new Error('Test user not found');

  const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: '1h' });

  const res = await request(app)
    .get('/api/recommendations?limit=10')
    .set('Authorization', `Bearer ${token}`);

  console.log('Recommendations status:', res.status);
  if (res.status !== 200) {
    throw new Error(`Recommendations request failed: ${JSON.stringify(res.body)}`);
  }

  const { recommendations, skillGaps, userThreshold } = res.body;
  console.log(`Received ${recommendations.length} recommendations. User threshold: ${userThreshold}`);
  console.log(`Skill gaps detected: ${skillGaps.length}`);

  if (recommendations.length === 0) {
    throw new Error('Expected at least 1 recommendation for candidate with 44 skills');
  }

  console.log('\nTop 3 Recommended Roles for Alex Morgan:');
  for (let i = 0; i < Math.min(3, recommendations.length); i++) {
    const rec = recommendations[i];
    console.log(`[#${i + 1}] ${rec.job.title} at ${rec.job.company} (${rec.matchPercentage}% match)`);
    console.log(`     Location: ${rec.job.location} | Remote: ${rec.job.remote}`);
    console.log(`     Matched Skills (${rec.matchedSkills.length}): ${rec.matchedSkills.join(', ')}`);
    console.log(`     Missing Skills: ${rec.missingSkills.join(', ') || 'None'}`);
    console.log(`     Explanation: ${rec.explanation}`);
  }

  console.log('\nTop 5 Missing Skills Across Market (Skill Gap Analysis):');
  for (const gap of skillGaps.slice(0, 5)) {
    console.log(` - ${gap.skill}: missing in ${gap.count} jobs (${gap.percentage}%)`);
  }

  // Assertions
  const top1 = recommendations[0];
  if (top1.score < 0.60) {
    throw new Error(`Top recommendation score unexpectedly low: ${top1.score}`);
  }
  if (!top1.matchedSkills || top1.matchedSkills.length === 0) {
    throw new Error('Top job should have matched skills for Alex Morgan');
  }

  console.log('\n>>> ALL PHASE 4 ACCEPTANCE CHECKS PASSED SUCCESSFULLY! <<<');
  await mongoose.disconnect();
  process.exit(0);
}

testPhase4().catch((err) => {
  console.error('Phase 4 test error:', err);
  process.exit(1);
});
