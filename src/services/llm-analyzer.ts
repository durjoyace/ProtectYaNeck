import { RiskItem, RiskCategory, RiskSeverity } from '../shared/types';
import { RISK_CATEGORIES } from '../shared/constants';

/**
 * LLM-powered risk analysis service
 * Uses OpenAI API for more sophisticated agreement analysis
 */

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface LLMConfig {
  apiKey: string;
  model?: string;
}

interface AnalysisResult {
  risks: RiskItem[];
  summary: string;
  overallSeverity: RiskSeverity;
}

/**
 * Analyzes agreement text using LLM
 */
export async function analyzeWithLLM(
  text: string,
  config: LLMConfig
): Promise<AnalysisResult> {
  const { apiKey, model = 'gpt-4o-mini' } = config;

  const prompt = buildAnalysisPrompt(text);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response content');
    }

    return parseAnalysisResponse(content);

  } catch (error) {
    console.error('[ProtectYaNeck] LLM analysis failed:', error);
    throw error;
  }
}

/**
 * Gets the system prompt for the LLM
 */
function getSystemPrompt(): string {
  return `You are a legal document analyst specializing in consumer protection. Your task is to analyze Terms of Service, Privacy Policies, and other user agreements to identify potential risks for consumers.

You must respond with a JSON object in this exact format:
{
  "risks": [
    {
      "category": "data_sharing|auto_renewal|third_party_access|liability_waiver|arbitration|data_retention|account_termination|jurisdiction",
      "severity": "low|medium|high|critical",
      "title": "Brief title",
      "summary": "Plain-language explanation of the risk in 1-2 sentences",
      "originalText": "The exact text from the agreement that contains this risk"
    }
  ],
  "summary": "A brief overall summary of the agreement's key concerns in 2-3 sentences",
  "overallSeverity": "low|medium|high|critical"
}

Risk categories and their typical severity:
- data_sharing: Sharing data with third parties (high)
- auto_renewal: Automatic subscription renewal (medium)
- third_party_access: External parties accessing user data (high)
- liability_waiver: Limiting company's liability (high)
- arbitration: Mandatory arbitration, class action waivers (critical)
- data_retention: Long-term data storage policies (medium)
- account_termination: Account suspension without notice (medium)
- jurisdiction: Legal jurisdiction clauses (low)

Guidelines:
- Focus on clauses that could negatively affect the average consumer
- Use plain, non-legal language in summaries
- Be specific about what each risk means for the user
- Prioritize actionable information
- If a clause is standard and reasonable, don't flag it as high risk
- Arbitration clauses and class action waivers should always be flagged as critical`;
}

/**
 * Builds the analysis prompt
 */
function buildAnalysisPrompt(text: string): string {
  // Truncate text if too long (keeping first and last parts)
  const maxLength = 12000;
  let truncatedText = text;

  if (text.length > maxLength) {
    const halfLength = Math.floor(maxLength / 2);
    truncatedText = text.substring(0, halfLength) +
      '\n\n[... middle section truncated ...]\n\n' +
      text.substring(text.length - halfLength);
  }

  return `Analyze the following legal agreement and identify potential risks for consumers:

---
${truncatedText}
---

Identify all significant risks and provide your analysis in the required JSON format.`;
}

/**
 * Parses the LLM response into our format
 */
function parseAnalysisResponse(content: string): AnalysisResult {
  try {
    const parsed = JSON.parse(content);

    // Validate and transform risks
    const risks: RiskItem[] = (parsed.risks || []).map((risk: any, index: number) => {
      const category = validateCategory(risk.category);
      return {
        id: `llm-risk-${Date.now()}-${index}`,
        category,
        severity: validateSeverity(risk.severity),
        title: risk.title || RISK_CATEGORIES[category].label,
        summary: risk.summary || RISK_CATEGORIES[category].description,
        originalText: risk.originalText || '',
      };
    });

    return {
      risks,
      summary: parsed.summary || generateDefaultSummary(risks),
      overallSeverity: validateSeverity(parsed.overallSeverity),
    };

  } catch (error) {
    console.error('[ProtectYaNeck] Failed to parse LLM response:', error);
    return {
      risks: [],
      summary: 'Unable to analyze this agreement.',
      overallSeverity: 'medium',
    };
  }
}

/**
 * Validates risk category
 */
function validateCategory(category: string): RiskCategory {
  const validCategories: RiskCategory[] = [
    'data_sharing',
    'auto_renewal',
    'third_party_access',
    'liability_waiver',
    'arbitration',
    'data_retention',
    'account_termination',
    'jurisdiction',
  ];

  return validCategories.includes(category as RiskCategory)
    ? (category as RiskCategory)
    : 'liability_waiver';
}

/**
 * Validates severity level
 */
function validateSeverity(severity: string): RiskSeverity {
  const validSeverities: RiskSeverity[] = ['low', 'medium', 'high', 'critical'];
  return validSeverities.includes(severity as RiskSeverity)
    ? (severity as RiskSeverity)
    : 'medium';
}

/**
 * Generates a default summary when LLM fails
 */
function generateDefaultSummary(risks: RiskItem[]): string {
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
 * Checks if LLM analysis is available (API key configured)
 */
export async function isLLMAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get('pyn_openai_key', (result) => {
      resolve(!!result.pyn_openai_key);
    });
  });
}

/**
 * Gets the stored API key
 */
export async function getAPIKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('pyn_openai_key', (result) => {
      resolve(result.pyn_openai_key || null);
    });
  });
}

/**
 * Saves the API key
 */
export async function setAPIKey(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pyn_openai_key: apiKey }, resolve);
  });
}
