import { RiskItem, RiskCategory, RiskSeverity } from '../shared/types';
import { RISK_KEYWORDS, RISK_CATEGORIES } from '../shared/constants';
import { analyzeWithLLM, getAPIKey } from '../services/llm-analyzer';

// Dangerous clause combinations that increase severity
const DANGEROUS_COMBINATIONS: Array<{
  categories: RiskCategory[];
  severityBoost: number;
  warning: string;
}> = [
  {
    categories: ['arbitration', 'liability_waiver'],
    severityBoost: 1,
    warning: 'Combined arbitration and liability waiver severely limits your legal options',
  },
  {
    categories: ['data_sharing', 'third_party_access', 'data_retention'],
    severityBoost: 1,
    warning: 'Your data can be shared widely and kept indefinitely',
  },
  {
    categories: ['auto_renewal', 'account_termination'],
    severityBoost: 1,
    warning: 'They can charge you automatically but terminate you at will',
  },
];

// Red flag phrases that always indicate critical severity
const RED_FLAGS = [
  /waive\s+(your\s+)?right\s+to\s+(a\s+)?jury/i,
  /class\s+action\s+waiver/i,
  /binding\s+arbitration/i,
  /sell\s+(your\s+)?(personal\s+)?(data|information)/i,
  /perpetual\s+(and\s+)?irrevocable\s+license/i,
  /without\s+(prior\s+)?notice/i,
  /sole\s+(and\s+absolute\s+)?discretion/i,
  /indemnify\s+(and\s+)?hold\s+harmless/i,
  /waive\s+any\s+claims/i,
  /no\s+refunds?\s+(under\s+any\s+circumstances)?/i,
];

// Average risk scores for comparison (would be populated from real data)
const INDUSTRY_AVERAGES: Record<string, number> = {
  'social_media': 72,
  'ecommerce': 58,
  'saas': 54,
  'finance': 68,
  'healthcare': 62,
  'default': 55,
};

/**
 * Analyzes text for legal risks
 * Uses LLM when available, falls back to keyword matching
 */
export async function analyzeRisksWithLLM(text: string): Promise<RiskItem[]> {
  try {
    const apiKey = await getAPIKey();
    if (apiKey) {
      const result = await analyzeWithLLM(text, { apiKey });
      return result.risks;
    }
  } catch (error) {
    console.warn('[ProtectYaNeck] LLM analysis failed, using keyword matching:', error);
  }

  // Fallback to keyword-based analysis
  return analyzeRisks(text);
}

/**
 * Analyzes text for legal risks using keyword matching
 * This is a basic implementation used as fallback when LLM is not available
 */
export function analyzeRisks(text: string): RiskItem[] {
  const risks: RiskItem[] = [];
  const textLower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(RISK_KEYWORDS)) {
    const riskCategory = category as RiskCategory;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = textLower.indexOf(keywordLower);

      if (index !== -1) {
        // Extract surrounding context (100 chars before and after)
        const start = Math.max(0, index - 100);
        const end = Math.min(text.length, index + keyword.length + 100);
        const context = text.substring(start, end);

        // Check if we already have a risk for this category
        const existingRisk = risks.find(r => r.category === riskCategory);

        if (!existingRisk) {
          const categoryMeta = RISK_CATEGORIES[riskCategory];

          risks.push({
            id: `risk-${category}-${Date.now()}`,
            category: riskCategory,
            severity: determineSeverity(riskCategory, context),
            title: categoryMeta.label,
            summary: generateSummary(riskCategory, context),
            originalText: context.trim(),
            location: {
              startIndex: index,
              endIndex: index + keyword.length,
            },
          });
        }

        break; // Only need one match per category
      }
    }
  }

  return risks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/**
 * Determines risk severity based on category and context
 */
function determineSeverity(category: RiskCategory, context: string): RiskSeverity {
  const contextLower = context.toLowerCase();

  // Critical indicators
  if (/waive|forfeit|surrender|binding|mandatory|required/i.test(contextLower)) {
    if (category === 'arbitration' || category === 'liability_waiver') {
      return 'critical';
    }
  }

  // High severity indicators
  if (/sell|monetize|indefinitely|without notice|any reason/i.test(contextLower)) {
    return 'high';
  }

  // Default to category's default severity
  return RISK_CATEGORIES[category].defaultSeverity;
}

/**
 * Generates a plain-language summary for a risk
 */
function generateSummary(category: RiskCategory, context: string): string {
  const summaries: Record<RiskCategory, string> = {
    data_sharing: 'This service may share your personal information with third parties, partners, or advertisers.',
    auto_renewal: 'Your subscription will automatically renew and you will be charged unless you cancel before the renewal date.',
    third_party_access: 'External companies and service providers may have access to your data and account information.',
    liability_waiver: 'The company limits their responsibility if something goes wrong. You may have limited options for recourse.',
    arbitration: 'You may be giving up your right to sue in court or join a class action lawsuit. Disputes would be handled through private arbitration.',
    data_retention: 'Your data may be kept for an extended period, even after you close your account.',
    account_termination: 'The company can suspend or terminate your account at their discretion, potentially without warning.',
    jurisdiction: 'Legal matters will be handled according to specific laws and courts, which may not be in your location.',
  };

  return summaries[category];
}

/**
 * Converts severity to numeric rank for sorting
 */
function severityRank(severity: RiskSeverity): number {
  const ranks: Record<RiskSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return ranks[severity];
}

/**
 * Calculates overall severity from a list of risks
 */
export function calculateOverallSeverity(risks: RiskItem[]): RiskSeverity {
  if (risks.length === 0) return 'low';

  const maxRank = Math.max(...risks.map(r => severityRank(r.severity)));

  if (maxRank >= 4) return 'critical';
  if (maxRank >= 3) return 'high';
  if (maxRank >= 2) return 'medium';
  return 'low';
}

/**
 * Generates an overall summary of all risks
 */
export function generateOverallSummary(risks: RiskItem[]): string {
  if (risks.length === 0) {
    return 'No significant risks detected in this agreement.';
  }

  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;

  let summary = `Found ${risks.length} potential risk${risks.length === 1 ? '' : 's'}. `;

  if (criticalCount > 0) {
    summary += `${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} require${criticalCount === 1 ? 's' : ''} attention. `;
  }

  if (highCount > 0) {
    summary += `${highCount} high-priority concern${highCount === 1 ? '' : 's'}. `;
  }

  return summary.trim();
}

/**
 * Calculates a risk score (0-100) for comparison purposes
 */
export function calculateRiskScore(risks: RiskItem[]): number {
  if (risks.length === 0) return 0;

  let score = 0;

  // Base score from individual risks
  for (const risk of risks) {
    score += severityRank(risk.severity) * 8;
  }

  // Check for dangerous combinations
  const categories = risks.map(r => r.category);
  for (const combo of DANGEROUS_COMBINATIONS) {
    const hasAllCategories = combo.categories.every(c => categories.includes(c));
    if (hasAllCategories) {
      score += combo.severityBoost * 15;
    }
  }

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Compares risk score to industry average
 */
export function compareToAverage(score: number, industry: string = 'default'): {
  comparison: 'better' | 'average' | 'worse';
  percentile: number;
  message: string;
} {
  const average = INDUSTRY_AVERAGES[industry] || INDUSTRY_AVERAGES.default;
  const difference = score - average;

  if (difference < -15) {
    return {
      comparison: 'better',
      percentile: Math.max(5, 50 - Math.abs(difference)),
      message: `This agreement is better than ${100 - Math.max(5, 50 - Math.abs(difference))}% of similar services`,
    };
  } else if (difference > 15) {
    return {
      comparison: 'worse',
      percentile: Math.min(95, 50 + difference),
      message: `This agreement is riskier than ${Math.min(95, 50 + difference)}% of similar services`,
    };
  } else {
    return {
      comparison: 'average',
      percentile: 50,
      message: 'This agreement has typical risk levels for this type of service',
    };
  }
}

/**
 * Detects dangerous clause combinations
 */
export function detectDangerousCombinations(risks: RiskItem[]): string[] {
  const warnings: string[] = [];
  const categories = risks.map(r => r.category);

  for (const combo of DANGEROUS_COMBINATIONS) {
    const hasAllCategories = combo.categories.every(c => categories.includes(c));
    if (hasAllCategories) {
      warnings.push(combo.warning);
    }
  }

  return warnings;
}

/**
 * Checks for red flag phrases that indicate serious issues
 */
export function detectRedFlags(text: string): string[] {
  const flags: string[] = [];

  for (const pattern of RED_FLAGS) {
    const match = text.match(pattern);
    if (match) {
      flags.push(match[0]);
    }
  }

  return flags;
}

/**
 * Enhanced analysis that includes scoring and comparisons
 */
export function analyzeRisksEnhanced(text: string): {
  risks: RiskItem[];
  score: number;
  comparison: ReturnType<typeof compareToAverage>;
  redFlags: string[];
  combinationWarnings: string[];
  overallSeverity: RiskSeverity;
  summary: string;
} {
  const risks = analyzeRisks(text);
  const score = calculateRiskScore(risks);
  const comparison = compareToAverage(score);
  const redFlags = detectRedFlags(text);
  const combinationWarnings = detectDangerousCombinations(risks);
  const overallSeverity = calculateOverallSeverity(risks);
  const summary = generateOverallSummary(risks);

  // Boost severity if red flags found
  let finalSeverity = overallSeverity;
  if (redFlags.length >= 3 && finalSeverity !== 'critical') {
    finalSeverity = 'critical';
  } else if (redFlags.length >= 2 && severityRank(finalSeverity) < 3) {
    finalSeverity = 'high';
  }

  return {
    risks,
    score,
    comparison,
    redFlags,
    combinationWarnings,
    overallSeverity: finalSeverity,
    summary,
  };
}
