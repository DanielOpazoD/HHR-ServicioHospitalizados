/**
 * NLP Preprocessor for Diagnosis Search (v2 — Optimized for 8,000+ entries)
 *
 * High-performance text normalization, synonym expansion, and scoring
 * designed for instant results over large CIE-10 datasets.
 */

import { expandSynonyms } from './diagnosisSynonyms';

/**
 * Normalize text for comparison
 * - Lowercase
 * - Remove accents
 * - Trim whitespace
 * - Collapse multiple spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Tokenize text into words (min 2 chars, skip stop words)
 */
const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'en',
  'los',
  'las',
  'un',
  'una',
  'y',
  'o',
  'con',
  'sin',
  'por',
  'para',
  'como',
  'que',
  'no',
  'al',
  'se',
  'su',
  'otro',
  'otra',
  'otros',
  'otras',
  'parte',
  'tipo',
  'debido',
  'debida',
  'debidas',
  'debidos',
  'especificada',
  'especificado',
  'especificadas',
]);

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(token => token.length >= 2 && !STOP_WORDS.has(token));
}

/**
 * Lightweight similarity: check if query starts with target or vice versa
 * Much faster than Levenshtein for large datasets
 */
export function prefixMatch(query: string, target: string): boolean {
  if (query.length < 2) return false;
  return target.startsWith(query) || query.startsWith(target);
}

/**
 * Calculate Levenshtein distance between two strings
 * Only used as last resort for very short queries
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
export function similarityScore(a: string, b: string): number {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Check if query fuzzy-matches target (used only as fallback)
 */
export function fuzzyMatch(query: string, target: string, threshold = 0.7): boolean {
  const normalizedQuery = normalizeText(query);
  const normalizedTarget = normalizeText(target);

  // Fast: exact substring
  if (normalizedTarget.includes(normalizedQuery)) return true;

  // Fast: prefix match on tokens
  const queryTokens = tokenize(query);
  const targetTokens = tokenize(target);

  for (const qToken of queryTokens) {
    for (const tToken of targetTokens) {
      if (tToken.startsWith(qToken) || qToken.startsWith(tToken)) {
        return true;
      }
    }
  }

  // Slow fallback: Levenshtein only for short single-word queries
  if (queryTokens.length === 1 && queryTokens[0].length <= 6) {
    for (const tToken of targetTokens) {
      if (similarityScore(queryTokens[0], tToken) >= threshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Preprocess a search query
 */
export interface PreprocessedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  expansions: string[];
  hasSynonyms: boolean;
}

export function preprocessQuery(query: string): PreprocessedQuery {
  const normalized = normalizeText(query);
  const tokens = tokenize(query);
  const expansions = expandSynonyms(query);

  return {
    original: query,
    normalized,
    tokens,
    expansions,
    hasSynonyms: expansions.length > 0,
  };
}

/**
 * Score a CIE-10 entry against a preprocessed query (v2)
 * Uses multi-signal scoring with fast paths
 * Higher score = better match
 */
export function scoreMatch(description: string, code: string, query: PreprocessedQuery): number {
  const normalizedDesc = normalizeText(description);
  const normalizedCode = normalizeText(code);
  const queryNorm = query.normalized;
  let score = 0;

  // ─── SIGNAL 1: Code matching (highest priority) ───
  if (normalizedCode === queryNorm) {
    // Perfect code match: "I10" → "I10"
    score += 200;
  } else if (normalizedCode.startsWith(queryNorm) && queryNorm.length >= 2) {
    // Code prefix: "I1" → "I10", "I11.9", etc.
    score += 150;
  } else if (
    queryNorm.length >= 3 &&
    normalizedCode.replace('.', '').startsWith(queryNorm.replace('.', ''))
  ) {
    // Code match without dots: "i109" → "I10.9"
    score += 140;
  }

  // ─── SIGNAL 2: Full query substring match on description ───
  if (normalizedDesc.includes(queryNorm) && queryNorm.length >= 3) {
    score += 80;
    // Bonus: match at the very start of description
    if (normalizedDesc.startsWith(queryNorm)) {
      score += 30;
    }
    // Bonus: match is a substantial portion of the description (relevance)
    const coverage = queryNorm.length / normalizedDesc.length;
    score += Math.round(coverage * 40);
  }

  // ─── SIGNAL 3: Token-level matching (multi-word queries) ───
  if (query.tokens.length > 0) {
    let matchedTokens = 0;
    let prefixTokenMatches = 0;

    for (const qToken of query.tokens) {
      // Fast: check if query token is a substring of description
      if (normalizedDesc.includes(qToken)) {
        matchedTokens++;
        // Extra bonus for prefix matches on individual words of description
        const descTokens = normalizedDesc.split(' ');
        for (const dToken of descTokens) {
          if (dToken.startsWith(qToken) && qToken.length >= 3) {
            prefixTokenMatches++;
            break;
          }
        }
      }
    }

    if (matchedTokens > 0) {
      // Ratio of matched tokens (all tokens matched = higher score)
      const tokenRatio = matchedTokens / query.tokens.length;
      score += Math.round(tokenRatio * 50);

      // Full match bonus: ALL query tokens found in description
      if (matchedTokens === query.tokens.length) {
        score += 25;
      }

      // Prefix precision bonus
      score += prefixTokenMatches * 8;
    }
  }

  // ─── SIGNAL 4: Synonym expansion matches ───
  if (query.hasSynonyms) {
    for (const expansion of query.expansions) {
      const normalizedExpansion = normalizeText(expansion);
      if (normalizedDesc.includes(normalizedExpansion)) {
        score += 70; // High value — synonym match is clinically accurate
        break; // One synonym match is enough
      }
      // Also check token-level synonym matching
      const expTokens = normalizedExpansion.split(' ').filter(t => t.length >= 3);
      let expMatched = 0;
      for (const et of expTokens) {
        if (normalizedDesc.includes(et)) expMatched++;
      }
      if (expTokens.length > 0 && expMatched === expTokens.length) {
        score += 55;
        break;
      }
    }
  }

  // ─── SIGNAL 5: Prefix matching on description words (fast fuzzy) ───
  // Only if we haven't scored anything yet — last chance
  if (score === 0 && query.tokens.length > 0) {
    const descWords = normalizedDesc.split(' ');
    for (const qToken of query.tokens) {
      if (qToken.length < 3) continue;
      for (const dWord of descWords) {
        if (dWord.startsWith(qToken)) {
          score += 15;
          break;
        }
      }
    }
  }

  return score;
}
