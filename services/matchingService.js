/**
 * Findora - Intelligent Item Matching Service
 * 
 * This service implements a transparent, explainable rule-based matching
 * algorithm. It compares a target item (e.g. lost item) against potential
 * counterpart items (e.g. found items) and assigns a confidence score out of 100.
 * 
 * Scoring Breakdown:
 * 1. Category Match:        30 Points (Exact category match)
 * 2. Title & Keywords:      Up to 25 Points (Tokenized word overlap & substring)
 * 3. Color Match:           15 Points (Normalized color comparison)
 * 4. Location Match:        15 Points (Normalized substring/keyword comparison)
 * 5. Date Proximity:        Up to 15 Points (Closer dates get higher points)
 * ----------------------------------------------------
 * Total Maximum Score:      100 Points
 * 
 * Match Levels:
 * - 75 - 100: "Strong Match"
 * - 50 - 74:  "Possible Match"
 * - Below 50: "Low Similarity"
 */

// Common stop words to exclude when analyzing title keywords
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 
  'of', 'my', 'is', 'it', 'was', 'lost', 'found', 'near', 'by'
]);

/**
 * Normalizes a text string: converts to lowercase, removes punctuation, trims spaces.
 * @param {string} text 
 * @returns {string}
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts meaningful keyword tokens from text, removing common stop words.
 * @param {string} text 
 * @returns {string[]}
 */
function extractTokens(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Calculates matching score between two items.
 * 
 * @param {Object} itemA - First item (e.g., lost report)
 * @param {Object} itemB - Second item (e.g., found report)
 * @returns {Object} { score, matchLevel, breakdown, explanation }
 */
function calculateItemMatch(itemA, itemB) {
  let score = 0;
  const breakdown = {
    categoryScore: 0,
    titleScore: 0,
    colorScore: 0,
    locationScore: 0,
    dateScore: 0
  };
  const matchReasons = [];

  // 1. CATEGORY COMPARISON (Max 30 Points)
  // Categories must match exactly for high confidence
  if (itemA.category && itemB.category && itemA.category === itemB.category) {
    breakdown.categoryScore = 30;
    score += 30;
    matchReasons.push(`Same category (${itemA.category})`);
  }

  // 2. TITLE & KEYWORD COMPARISON (Max 25 Points)
  // Compare title tokens and brand name
  const tokensA = extractTokens(`${itemA.title} ${itemA.brand || ''}`);
  const tokensB = extractTokens(`${itemB.title} ${itemB.brand || ''}`);

  if (tokensA.length > 0 && tokensB.length > 0) {
    let matchingTokensCount = 0;
    for (const token of tokensA) {
      if (tokensB.includes(token)) {
        matchingTokensCount++;
      }
    }

    if (matchingTokensCount > 0) {
      // Calculate Jaccard-like ratio
      const ratio = matchingTokensCount / Math.max(tokensA.length, tokensB.length);
      // Award up to 25 points proportionally, minimum 10 points for at least one solid word match
      const awarded = Math.min(25, Math.round(10 + ratio * 15));
      breakdown.titleScore = awarded;
      score += awarded;
      matchReasons.push('Matching keywords in title/brand');
    }
  }

  // 3. COLOR COMPARISON (Max 15 Points)
  // Normalize color and check for match or substring
  const colorA = normalizeText(itemA.color);
  const colorB = normalizeText(itemB.color);

  if (colorA && colorB) {
    if (colorA === colorB || colorA.includes(colorB) || colorB.includes(colorA)) {
      breakdown.colorScore = 15;
      score += 15;
      matchReasons.push(`Matching color (${itemA.color})`);
    }
  }

  // 4. LOCATION COMPARISON (Max 15 Points)
  // Compare location keywords (e.g. "Library 2nd floor" vs "Central Library")
  const locTokensA = extractTokens(itemA.location);
  const locTokensB = extractTokens(itemB.location);

  if (locTokensA.length > 0 && locTokensB.length > 0) {
    let locOverlap = 0;
    for (const token of locTokensA) {
      if (locTokensB.includes(token)) {
        locOverlap++;
      }
    }

    if (locOverlap > 0) {
      // Substantial location overlap gets full 15 points, partial gets 10
      const awarded = locOverlap >= 2 || locTokensA.join(' ') === locTokensB.join(' ') ? 15 : 10;
      breakdown.locationScore = awarded;
      score += awarded;
      matchReasons.push('Similar location reported');
    }
  }

  // 5. DATE PROXIMITY (Max 15 Points)
  // Compare the dates items were reported/lost/found
  if (itemA.reportDate && itemB.reportDate) {
    const dateA = new Date(itemA.reportDate).getTime();
    const dateB = new Date(itemB.reportDate).getTime();

    if (!isNaN(dateA) && !isNaN(dateB)) {
      const diffMs = Math.abs(dateA - dateB);
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 3) {
        breakdown.dateScore = 15;
        score += 15;
        matchReasons.push('Reported within 3 days of each other');
      } else if (diffDays <= 7) {
        breakdown.dateScore = 10;
        score += 10;
        matchReasons.push('Reported within 1 week of each other');
      } else if (diffDays <= 14) {
        breakdown.dateScore = 5;
        score += 5;
        matchReasons.push('Reported within 2 weeks of each other');
      }
    }
  }

  // Ensure score is clamped between 0 and 100
  score = Math.min(100, Math.max(0, score));

  // Determine Match Level
  let matchLevel = 'Low Similarity';
  if (score >= 75) {
    matchLevel = 'Strong Match';
  } else if (score >= 50) {
    matchLevel = 'Possible Match';
  }

  // Build readable explanation
  let explanation = '';
  if (matchReasons.length > 0) {
    explanation = `${matchLevel}: ${matchReasons.join(', ')}.`;
  } else {
    explanation = 'Low Similarity: No significant overlapping attributes detected.';
  }

  return {
    score,
    matchLevel,
    breakdown,
    explanation
  };
}

/**
 * Searches and ranks potential matches for a target item from candidate items.
 * 
 * @param {Object} targetItem - The item we want to find matches for (e.g. a lost wallet)
 * @param {Array} candidateItems - Array of candidate items (e.g. found items)
 * @param {number} minScore - Minimum score to include in results (default 30)
 * @returns {Array} Array of candidate items enriched with matchResult, sorted by score descending
 */
function findRankedMatches(targetItem, candidateItems, minScore = 30) {
  if (!targetItem || !Array.isArray(candidateItems)) {
    return [];
  }

  const results = [];

  for (const candidate of candidateItems) {
    // Cannot match an item with itself
    if (candidate._id && targetItem._id && candidate._id.toString() === targetItem._id.toString()) {
      continue;
    }

    // Must be opposite item types (lost matches with found, and vice versa)
    if (candidate.itemType === targetItem.itemType) {
      continue;
    }

    // Must not be returned or deactivated
    if (candidate.status === 'returned' || candidate.status === 'deactivated') {
      continue;
    }

    const match = calculateItemMatch(targetItem, candidate);

    if (match.score >= minScore) {
      results.push({
        item: candidate,
        matchScore: match.score,
        matchLevel: match.matchLevel,
        breakdown: match.breakdown,
        explanation: match.explanation
      });
    }
  }

  // Sort descending by match score
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}

module.exports = {
  calculateItemMatch,
  findRankedMatches,
  normalizeText,
  extractTokens
};
