import { RiskItem, RiskCategory, RiskSeverity } from '../shared/types';
import { RISK_KEYWORDS, RISK_CATEGORIES } from '../shared/constants';
import { analyzeWithLLM, getAPIKey } from '../services/llm-analyzer';

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
