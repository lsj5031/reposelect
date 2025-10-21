import { BaseAgent, AgentResult } from './base-agent';

export class FactoryAgent extends BaseAgent {
  async selectFiles(): Promise<AgentResult> {
    this.log('Using Factory Droid for intelligent file selection');

    // Check if Factory CLI is available
    const checkResult = this.safeExec('droid --version');
    if (checkResult.status !== 0) {
      throw new Error('Factory CLI not found. Install with: curl -fsSL https://app.factory.ai/cli | sh');
    }

    // Check for API key
    if (!process.env.FACTORY_API_KEY) {
      throw new Error('FACTORY_API_KEY environment variable not set');
    }

    const prompt = this.buildPrompt();
    this.log(`Sending prompt to Factory: ${prompt.substring(0, 100)}...`);

    // Execute Factory Droid in read-only mode with JSON output
    const cmd = `droid exec --output-format json "${prompt.replace(/"/g, '\\"')}"`;
    const result = this.safeExec(cmd);

    if (result.status !== 0) {
      throw new Error(`Factory Droid failed: ${result.stderr}`);
    }

    try {
      const response = JSON.parse(result.stdout);
      return this.parseResponse(response);
    } catch (error) {
      throw new Error(`Failed to parse Factory response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildPrompt(): string {
    return `Analyze this repository and identify the most relevant files for answering this question: "${this.config.question}"

Requirements:
1. Return a JSON object with "files" array containing file paths relative to repo root
2. Include "reasoning" explaining your selection
3. Include "confidence" score (0-1)
4. Consider files that:
   - Directly implement the functionality in question
   - Contain related configuration or setup
   - Define interfaces/types used by the core functionality
   - Provide documentation about the feature
5. Stay within approximately ${this.config.tokenBudget} tokens total
6. Prioritize recently modified and actively used files
7. Always include essential files like README, package.json, and main config files

Response format:
{
  "files": ["src/auth.js", "README.md", "package.json"],
  "reasoning": "Selected files contain the core authentication logic and project setup",
  "confidence": 0.9
}`;
  }

  private parseResponse(response: any): AgentResult {
    // Handle different response formats from Factory
    let content = '';
    
    if (response.type === 'result' && response.result) {
      content = response.result;
    } else if (response.result) {
      content = response.result;
    } else if (typeof response === 'string') {
      content = response;
    }

    // Try to extract JSON from the content
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Factory response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed.files)) {
        throw new Error('Invalid response: files array missing');
      }

      return {
        files: parsed.files,
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON from response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}