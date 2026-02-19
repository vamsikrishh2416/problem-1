const natural = require('natural');
const TfIdf = natural.TfIdf;
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Calculate plagiarism risk using TF-IDF and cosine similarity
 * @param {string} content - The submission content to check
 * @param {Array<string>} existingSubmissions - Array of existing submission contents
 * @returns {number} - Plagiarism risk percentage (0-100)
 */
function calculatePlagiarismRisk(content, existingSubmissions) {
  if (!existingSubmissions || existingSubmissions.length === 0) {
    return 0;
  }

  const tfidf = new TfIdf();
  
  // Add the new submission
  tfidf.addDocument(content.toLowerCase());
  
  // Add all existing submissions
  existingSubmissions.forEach(submission => {
    tfidf.addDocument(submission.toLowerCase());
  });

  let maxSimilarity = 0;

  // Calculate cosine similarity between new submission and each existing one
  for (let i = 1; i < existingSubmissions.length + 1; i++) {
    const similarity = cosineSimilarity(tfidf, 0, i);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }

  // Convert to percentage
  return Math.round(maxSimilarity * 100);
}

/**
 * Calculate cosine similarity between two documents
 */
function cosineSimilarity(tfidf, doc1Index, doc2Index) {
  const terms1 = {};
  const terms2 = {};

  tfidf.listTerms(doc1Index).forEach(item => {
    terms1[item.term] = item.tfidf;
  });

  tfidf.listTerms(doc2Index).forEach(item => {
    terms2[item.term] = item.tfidf;
  });

  const allTerms = new Set([...Object.keys(terms1), ...Object.keys(terms2)]);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  allTerms.forEach(term => {
    const val1 = terms1[term] || 0;
    const val2 = terms2[term] || 0;
    
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  });

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

// Common English stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they',
  'their', 'he', 'she', 'his', 'her', 'what', 'which', 'who', 'how',
  'when', 'where', 'why', 'all', 'each', 'any', 'both', 'not', 'no'
]);

/**
 * Extract meaningful keywords from a text string
 * @param {string} text
 * @returns {string[]} array of lowercase keywords
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOP_WORDS.has(word));
}

/**
 * Generate AI feedback using Google Gemini
 * @param {string} content - The submission content
 * @param {string} assignmentDescription - The assignment description
 * @returns {Promise<Object>} - { feedback_summary: string, score: number }
 */
async function generateFeedback(content, assignmentDescription) {
  try {
    const prompt = `You are an academic evaluator. Evaluate the following student submission against the assignment description.

Assignment Description:
${assignmentDescription}

Student Submission:
${content}

Provide your evaluation in the following JSON format (no markdown, just raw JSON):
{
  "feedback_summary": "A detailed 2-4 sentence feedback covering relevance, quality, and areas for improvement.",
  "score": <integer from 0 to 100>
}`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    const parsed = JSON.parse(jsonText);
    return {
      feedback_summary: parsed.feedback_summary || 'Evaluation complete.',
      score: Math.min(100, Math.max(0, parseInt(parsed.score, 10) || 50))
    };
  } catch (error) {
    console.error('Gemini feedback generation failed, falling back to rule-based:', error.message);
    return generateFeedbackFallback(content, assignmentDescription);
  }
}

/**
 * Rule-based fallback feedback generator
 */
function generateFeedbackFallback(content, assignmentDescription) {
  const words = content.trim().split(/\s+/);
  const wordCount = words.length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;

  let score = 0;
  const feedback = [];

  if (wordCount < 50) {
    feedback.push('Submission is too short. Please provide more detailed content.');
    score += 10;
  } else if (wordCount < 150) {
    feedback.push('Submission length is adequate but could be more comprehensive.');
    score += 20;
  } else if (wordCount < 300) {
    feedback.push('Good submission length with adequate detail.');
    score += 25;
  } else {
    feedback.push('Excellent submission length with comprehensive coverage.');
    score += 30;
  }

  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  if (avgWordsPerSentence < 5) {
    feedback.push('Sentences are too short. Try to elaborate more.');
    score += 5;
  } else if (avgWordsPerSentence < 15) {
    feedback.push('Good sentence structure and clarity.');
    score += 15;
  } else if (avgWordsPerSentence < 25) {
    feedback.push('Well-structured sentences with good detail.');
    score += 20;
  } else {
    feedback.push('Sentences are quite long. Consider breaking them down for clarity.');
    score += 10;
  }

  const assignmentKeywords = extractKeywords(assignmentDescription || '');
  if (assignmentKeywords.length > 0) {
    const contentLower = content.toLowerCase();
    const matchedKeywords = assignmentKeywords.filter(kw => contentLower.includes(kw));
    const keywordCoverage = matchedKeywords.length / assignmentKeywords.length;

    if (keywordCoverage >= 0.7) {
      feedback.push(`Strong relevance to the assignment — covers ${matchedKeywords.length} of ${assignmentKeywords.length} key topic(s).`);
      score += 30;
    } else if (keywordCoverage >= 0.4) {
      feedback.push(`Moderate relevance — covers ${matchedKeywords.length} of ${assignmentKeywords.length} key topic(s).`);
      score += 18;
    } else {
      feedback.push(`Low relevance — only ${matchedKeywords.length} of ${assignmentKeywords.length} key topic(s) addressed.`);
      score += 6;
    }
  }

  const hasUpperCase = /[A-Z]/.test(content);
  const hasPunctuation = /[.,!?;:]/.test(content);
  if (hasUpperCase && hasPunctuation) {
    feedback.push('Proper formatting and punctuation observed.');
    score += 20;
  } else if (hasUpperCase || hasPunctuation) {
    feedback.push('Basic formatting present but could be improved.');
    score += 12;
  } else {
    feedback.push('Please pay attention to proper capitalization and punctuation.');
    score += 5;
  }

  return {
    feedback_summary: feedback.join(' '),
    score: Math.min(100, Math.max(0, score))
  };
}

module.exports = {
  calculatePlagiarismRisk,
  generateFeedback
};
