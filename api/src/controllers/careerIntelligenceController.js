const Job = require('../models/Job');
const Resume = require('../models/Resume');

/**
 * 1. AI Resume Tailor: Generates tailored bullet points matching the target job description.
 */
const tailorResume = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const resume = await Resume.findOne({ userId: req.user._id, status: 'done' }).sort({ createdAt: -1 });
    if (!resume || !resume.parsed) {
      return res.status(400).json({ success: false, error: 'Please upload a resume first to tailor it.' });
    }

    const jobSkills = job.skills || [];
    const userSkills = resume.normalizedSkills || [];
    const userExp = resume.parsed.experience || [];

    // Find matched & target missing skills
    const matched = userSkills.filter((s) => jobSkills.includes(s));
    const targetKeywords = jobSkills.slice(0, 5);

    // Generate tailored bullet points
    const tailoredExperience = userExp.map((exp, idx) => {
      const bullets = exp.bullets && exp.bullets.length > 0 ? exp.bullets : ['Led development and maintenance of core technical deliverables.'];
      const tailoredBullets = bullets.map((originalBullet, bIdx) => {
        const keywordToInject = targetKeywords[bIdx % targetKeywords.length] || 'scalable microservices';
        return {
          original: originalBullet,
          tailored: `${originalBullet.replace(/\.$/, '')}, strategically leveraging ${keywordToInject} and modern development best practices to maximize system throughput and meet ${job.title} expectations.`,
          highlightedSkill: keywordToInject,
        };
      });

      return {
        role: exp.role || 'Software Engineer',
        company: exp.company || 'Tech Company',
        duration: exp.duration || '2022 - Present',
        tailoredBullets,
      };
    });

    const summaryTailored = `Results-driven ${job.title} specialist with proven experience in ${matched.slice(0, 3).join(', ') || 'modern software engineering'}. Demonstrated track record of optimizing backend services and building resilient architectures aligned with ${job.company}'s engineering objectives.`;

    return res.status(200).json({
      success: true,
      jobTitle: job.title,
      company: job.company,
      tailoredSummary: summaryTailored,
      tailoredExperience,
      targetedKeywords: targetKeywords,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. AI Interview Question Predictor: Generates 5 tailored technical & behavioral questions with hints.
 */
const getInterviewPrep = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const resume = await Resume.findOne({ userId: req.user._id, status: 'done' }).sort({ createdAt: -1 });
    const userSkills = resume ? resume.normalizedSkills || [] : [];
    const jobSkills = job.skills || [];

    const missingSkills = jobSkills.filter((s) => !userSkills.includes(s));
    const primarySkill = missingSkills[0] || jobSkills[0] || 'System Architecture';
    const secondarySkill = missingSkills[1] || jobSkills[1] || 'RESTful APIs';

    const questions = [
      {
        id: 1,
        type: 'Technical / Architecture',
        topic: primarySkill,
        question: `How would you design a high-throughput, fault-tolerant service using ${primarySkill} in ${job.company}'s production environment?`,
        hint: `Discuss horizontal scalability, caching strategies (Redis/CDN), connection pooling, and how you handle failure gracefully.`,
      },
      {
        id: 2,
        type: 'Hands-on Coding & Patterns',
        topic: secondarySkill,
        question: `What are common anti-patterns and performance bottlenecks when implementing ${secondarySkill}, and how do you mitigate them?`,
        hint: `Mention profiling memory leaks, optimizing database queries/indexes, and asynchronous non-blocking patterns.`,
      },
      {
        id: 3,
        type: 'System Design & Trade-offs',
        topic: 'Distributed Systems',
        question: `In a ${job.title} role, how do you handle data consistency vs availability (CAP theorem) when scaling out services?`,
        hint: `Explain eventual consistency, idempotent message queues (like RabbitMQ/Kafka), and database transactions.`,
      },
      {
        id: 4,
        type: 'Behavioral & Impact',
        topic: 'Engineering Leadership',
        question: `Describe a time when you had to balance shipping a critical feature under a tight deadline against accumulating technical debt.`,
        hint: `Use the STAR method (Situation, Task, Action, Result). Focus on risk mitigation, stakeholder communication, and post-launch refactoring.`,
      },
      {
        id: 5,
        type: 'Culture & Collaboration',
        topic: 'Cross-functional Alignment',
        question: `How do you approach disagreements during technical code reviews or architectural decisions with other senior engineers?`,
        hint: `Highlight empathy, benchmarking with empirical metrics, prioritizing maintainability, and consensus building.`,
      },
    ];

    return res.status(200).json({
      success: true,
      jobTitle: job.title,
      company: job.company,
      questions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. AI Cover Letter Generator: Generates high-converting personalized cover letter in markdown.
 */
const generateCoverLetter = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const resume = await Resume.findOne({ userId: req.user._id, status: 'done' }).sort({ createdAt: -1 });
    const candidateName = req.user.name || (resume?.parsed?.name) || 'Applicant';
    const userSkills = resume?.normalizedSkills || [];
    const topSkills = userSkills.slice(0, 4).join(', ') || 'modern software development';

    const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the **${job.title}** position. With a strong engineering background in ${topSkills}, I am confident in my ability to make an immediate, positive impact on your product and engineering initiatives.

Throughout my experience, I have focused on designing scalable architectures, writing clean and maintainable code, and collaborating with cross-functional teams to deliver reliable user experiences. What excites me most about ${job.company} is your commitment to technical innovation and high-standard execution. I am particularly eager to apply my expertise to solve complex challenges in your stack.

Given ${job.company}'s mission and the requirements of the ${job.title} role, my hands-on problem-solving approach and continuous learning mindset align closely with your expectations. I would welcome the opportunity to discuss how my skill set and background can support ${job.company}'s continued growth.

Thank you for your time and consideration.

Warm regards,  
**${candidateName}**  
${req.user.email}
`;

    return res.status(200).json({
      success: true,
      jobTitle: job.title,
      company: job.company,
      coverLetter,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Interactive Skill Gap Learning Roadmap
 */
const getSkillRoadmap = async (req, res, next) => {
  try {
    const skillName = req.params.skillName || 'Docker';

    const roadmaps = {
      docker: {
        skill: 'Docker',
        category: 'DevOps & Containers',
        officialDocs: 'https://docs.docker.com/get-started/',
        steps: [
          'Master Dockerfiles & Multi-stage builds: Learn how to package Node.js and Python apps with minimal image sizes.',
          'Docker Compose Orchestration: Configure local multi-container services with databases, brokers, and networks.',
          'Container Security & Volume Mounts: Implement non-root user permissions, persistent volumes, and healthchecks.',
        ],
        starterProject: 'Containerize a full-stack Node.js + MongoDB + Redis web application with auto-restart policies.',
      },
      kubernetes: {
        skill: 'Kubernetes',
        category: 'Cloud Orchestration',
        officialDocs: 'https://kubernetes.io/docs/tutorials/',
        steps: [
          'Core Primitives: Master Pods, Deployments, ReplicaSets, and Services (ClusterIP vs NodePort).',
          'Config & Ingress: Manage Secrets, ConfigMaps, and Ingress controllers for routing live web traffic.',
          'Horizontal Pod Autoscaling (HPA): Configure CPU/Memory thresholds and Rolling Update strategies.',
        ],
        starterProject: 'Deploy a resilient microservice on a local Minikube or Kind cluster with rolling updates and secret injection.',
      },
      graphql: {
        skill: 'GraphQL',
        category: 'API Design',
        officialDocs: 'https://graphql.org/learn/',
        steps: [
          'Schema & Types: Understand Queries, Mutations, and Input Types with strong typing.',
          'Resolvers & DataLoaders: Solve the N+1 database query problem using DataLoader batching.',
          'Subscriptions & WebSockets: Implement live real-time event feeds using GraphQL subscriptions.',
        ],
        starterProject: 'Build a GraphQL gateway that aggregates user profiles and job feeds with DataLoader batching.',
      },
      redis: {
        skill: 'Redis',
        category: 'Caching & In-Memory Storage',
        officialDocs: 'https://redis.io/docs/',
        steps: [
          'Data Structures: Master Strings, Hashes, Lists, Sets, and Sorted Sets (ZSETs).',
          'Caching Strategies: Implement Cache-Aside, Write-Through, and TTL expiration policies.',
          'Pub/Sub & Streams: Build asynchronous event queues and distributed locks with Redlock.',
        ],
        starterProject: 'Implement a distributed API rate limiter and session store for an Express server using Redis.',
      },
      default: {
        skill: skillName,
        category: 'Modern Engineering Skill',
        officialDocs: `https://devdocs.io/#q=${encodeURIComponent(skillName)}`,
        steps: [
          `Fundamental Syntax & Concepts: Review official documentation and core architecture for ${skillName}.`,
          `Practical Integration: Build a working proof-of-concept module integrating ${skillName} with a REST or GraphQL backend.`,
          `Production Best Practices: Study performance profiling, automated unit testing, and deployment packaging.`,
        ],
        starterProject: `Create an open-source GitHub starter repository demonstrating hands-on best practices in ${skillName}.`,
      },
    };

    const key = skillName.toLowerCase().replace(/[^a-z]/g, '');
    const roadmap = roadmaps[key] || roadmaps.default;

    return res.status(200).json({
      success: true,
      roadmap,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  tailorResume,
  getInterviewPrep,
  generateCoverLetter,
  getSkillRoadmap,
};
