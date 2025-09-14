import * as fs from 'fs-extra';
import * as path from 'path';
// import { LayerManager } from './LayerManager';

export interface CopilotInstructionsConfig {
  projectPath: string;
  podInfo?: {
    name: string;
    id: string;
    owner: string;
  };
  techStack?: string[];
}

export class GitHubCopilotManager {
  private readonly projectPath: string;
//   private readonly layerManager: LayerManager;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    // this.layerManager = new LayerManager(projectPath);
  }

  /**
   * Update or create .github/copilot-instructions.md with LCAgents information
   */
  async updateCopilotInstructions(config: CopilotInstructionsConfig): Promise<void> {
    const githubDir = path.join(this.projectPath, '.github');
    const instructionsFile = path.join(githubDir, 'copilot-instructions.md');
    
    // Ensure .github directory exists
    await fs.ensureDir(githubDir);

    // Generate LCAgents section content
    const lcagentsSection = await this.generateLCAgentsSection(config);

    let existingContent = '';
    
    // Read existing file if it exists
    if (await fs.pathExists(instructionsFile)) {
      existingContent = await fs.readFile(instructionsFile, 'utf-8');
      
      // Remove any existing LCAgents section
      existingContent = this.removeLCAgentsSection(existingContent);
    }

    // Create new content with LCAgents section at the top
    const newContent = this.combineSections(lcagentsSection, existingContent);
    
    // Write the updated file
    await fs.writeFile(instructionsFile, newContent, 'utf-8');
  }

  /**
   * Remove LCAgents section from .github/copilot-instructions.md during uninstall
   */
  async removeCopilotInstructions(): Promise<void> {
    const instructionsFile = path.join(this.projectPath, '.github', 'copilot-instructions.md');
    
    if (!await fs.pathExists(instructionsFile)) {
      return; // File doesn't exist, nothing to do
    }

    const content = await fs.readFile(instructionsFile, 'utf-8');
    const updatedContent = this.removeLCAgentsSection(content);
    
    // If the file is now empty or only has whitespace, remove it
    if (updatedContent.trim().length === 0) {
      await fs.remove(instructionsFile);
      
      // Also remove .github directory if it's empty
      const githubDir = path.join(this.projectPath, '.github');
      const githubContents = await fs.readdir(githubDir);
      if (githubContents.length === 0) {
        await fs.remove(githubDir);
      }
    } else {
      // Write back the content without LCAgents section
      await fs.writeFile(instructionsFile, updatedContent, 'utf-8');
    }
  }

  /**
   * Generate the LCAgents section for copilot instructions
   */
  private async generateLCAgentsSection(config: CopilotInstructionsConfig): Promise<string> {
    const section = [
      '# GitHub Copilot Instructions',
      '',
      '## LCAgents Integration',
      '',
      'This project uses **LCAgents** (LendingClub Agents) for enhanced development workflows and specialized AI assistance.',
      '',
      '### Available LCAgents',
      '',
      'Agents are discovered dynamically from the layered architecture. Check the following directories in precedence order:',
      '',
      '**Agent Discovery (Layered Precedence Order):**',
      '1. `.lcagents/custom/agents/` - Pod-specific custom agents (highest priority)',
      '2. `.lcagents/custom/agents/overrides/` - Pod-specific agent overrides', 
      '3. `.lcagents/org/agents/` - Organization-wide custom agents',
      '4. `.lcagents/org/agents/overrides/` - Organization-wide agent overrides',
      '5. `.lcagents/core/{active-core}/agents/` - Core system agents (baseline)',
      '',
      'Use the layered precedence when resolving agent configurations - custom overrides org overrides core.',
      '',
      '**Active Core System:** Check `.lcagents/core/active-core.json` to determine the current active core system.',
      '',
      '**Quick Commands:**',
      '```',
      '*agent         # Show list of all agents',
      '*help          # Show agent-specific commands',
      '*status        # Show current context and progress',
      '*context       # Display project context',
      '*exit          # Return to system mode',
  '```',
  '',
  '**Copilot Activation Example:**',
  '',
  '`@lcagents activate dev`  # Activate the Developer agent (Copilot prefix)',
  '',
  '### Project Context',
      '',
      ...(config.podInfo ? [
        `**Pod Assignment:** ${config.podInfo.name} (${config.podInfo.id})`,
        `**Pod Owner:** ${config.podInfo.owner}`,
        ''
      ] : []),
      ...(config.techStack && config.techStack.length > 0 ? [
        `**Technology Stack:** ${config.techStack.join(', ')}`,
        ''
      ] : []),
      '',
      '---',
      ''
    ];

    return section.join('\n');
  }


  /**
   * Remove existing LCAgents section from content
   */
  private removeLCAgentsSection(content: string): string {
    // Look for the GitHub Copilot Instructions header and everything after it if it's only LCAgents content
    // First, check if this is a file that only contains LCAgents content
    if (content.includes('# GitHub Copilot Instructions') && content.includes('## LCAgents Integration')) {
      // Check if there are any other sections after the LCAgents section
      const lcagentsStart = content.indexOf('## LCAgents Integration');
      if (lcagentsStart !== -1) {
        const afterLCAgents = content.substring(lcagentsStart);
        // Look for any other major sections (## headings that aren't part of LCAgents)
        const otherSectionMatch = afterLCAgents.match(/\n## (?!LCAgents)[^\n]+/);
        
        if (!otherSectionMatch) {
          // No other sections found, this is only LCAgents content
          return '';
        } else {
          // There are other sections, just remove the LCAgents part
          const endIndex = lcagentsStart + otherSectionMatch.index!;
          content = content.substring(0, lcagentsStart) + content.substring(endIndex);
        }
      }
    } else {
      // Look for LCAgents section markers in mixed content
      const startMarkers = [
        '## LCAgents Integration',
        '# LCAgents Integration', 
        '### LCAgents Integration'
      ];
      
      for (const marker of startMarkers) {
        const startIndex = content.indexOf(marker);
        if (startIndex !== -1) {
          // Find the end of the section (next ## heading or end of file)
          const afterMarker = content.substring(startIndex);
          const nextSectionMatch = afterMarker.match(/\n(?:#{1,3}\s+(?!LCAgents)[^\n]+|---)/);
          
          if (nextSectionMatch) {
            const endIndex = startIndex + nextSectionMatch.index!;
            content = content.substring(0, startIndex) + content.substring(endIndex);
          } else {
            // Remove from marker to end of file
            content = content.substring(0, startIndex);
          }
          break;
        }
      }
    }
    
    // Clean up extra whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    
    return content;
  }

  /**
   * Combine LCAgents section with existing content
   */
  private combineSections(lcagentsSection: string, existingContent: string): string {
    if (existingContent.trim().length === 0) {
      return lcagentsSection;
    }
    
    // If existing content doesn't start with a heading, add one
    const trimmedExisting = existingContent.trim();
    if (!trimmedExisting.startsWith('#')) {
      return lcagentsSection + '\n## Additional Instructions\n\n' + trimmedExisting + '\n';
    }
    
    return lcagentsSection + '\n' + trimmedExisting + '\n';
  }
}
