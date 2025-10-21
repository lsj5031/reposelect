import { BaseAgent, AgentResult } from './base-agent';

export class OpenCodeAgent extends BaseAgent {
  async selectFiles(): Promise<AgentResult> {
    this.log('Using OpenCode for intelligent file selection');

    // Check if OpenCode CLI is available
    const checkResult = this.safeExec('opencode --version');
    if (checkResult.status !== 0) {
      throw new Error('OpenCode CLI not found. Install from: https://opencode.ai');
    }

    const prompt = this.buildPrompt();
    this.log(`Sending prompt to OpenCode: ${prompt.substring(0, 100)}...`);

    // Execute OpenCode with specialized prompt
    const cmd = `opencode run "${prompt.replace(/"/g, '\\"')}"`;
    const result = this.safeExec(cmd);

    if (result.status !== 0) {
      throw new Error(`OpenCode failed: ${result.stderr}`);
    }

    return this.parseResponse(result.stdout);
  }

  private buildPrompt(): string {
    return `Analyze this repository and identify the most relevant files for answering this question: "${this.config.question}"

Please provide your response as a JSON object with the following structure:
{
  "files": ["relative/path/to/file1.js", "relative/path/to/file2.md"],
  "reasoning": "Explanation of why these files were selected",
  "confidence": 0.85
}

Requirements:
- Consider files that directly implement the functionality in question
- Include related configuration, setup, and documentation files  
- Prioritize recently modified and actively used files
- Stay within approximately ${this.config.tokenBudget} tokens total
- Always include essential files like README, package.json, and main config files
- Return only the JSON object, no additional text`;
  }

  private parseResponse(output: string): AgentResult {
    // Extract JSON from the output
    let jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in OpenCode response');
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