import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { GitHubCopilotManager } from '../../core/GitHubCopilotManager';

    /**
     * Remove shell alias for lcagent command (cross-platform)
     */
    async function removeShellAlias(): Promise<{ success: boolean; message: string; instructions?: string }> {
      try {
        const homeDir = os.homedir();

        // Candidate profile files to check
        const candidates: string[] = [];
        candidates.push(path.join(homeDir, '.bash_profile'));
        candidates.push(path.join(homeDir, '.bashrc'));
        candidates.push(path.join(homeDir, '.zshrc'));
        candidates.push(path.join(homeDir, '.profile'));
        candidates.push(path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'));
        candidates.push(path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'));

        const aliasPatterns = [
          'alias lcagent=',
          'alias lcagents=',
          '# LCAgents alias',
          'Set-Alias lcagent',
          'Set-Alias lcagents',
          'function lcagent',
          'function lcagents'
        ];

        let found = false;
        let modifiedFile = '';

        for (const configFile of candidates) {
          try {
            if (!await fs.pathExists(configFile)) continue;
            const content = await fs.readFile(configFile, 'utf-8');
            if (!aliasPatterns.some(p => content.includes(p))) continue;

            const lines = content.split('\n');
            const filteredLines = lines.filter(line => !aliasPatterns.some(p => line.includes(p)));
            await fs.writeFile(configFile, filteredLines.join('\n'));
            found = true;
            modifiedFile = configFile;
            break;
          } catch (e) {
            // ignore and continue
          }
        }

        if (!found) {
          return { success: true, message: 'No lcagent/lcagents aliases found in common shell/profile files' };
        }

        const isWin = process.platform === 'win32';
        const instructions = isWin
          ? 'Run "Remove-Item Alias:lcagent -ErrorAction SilentlyContinue; Remove-Item Alias:lcagents -ErrorAction SilentlyContinue" in PowerShell or restart your terminal'
          : 'Run "unalias lcagent lcagents" or restart terminal to remove from current session';

        return { success: true, message: `Aliases removed from ${modifiedFile}`, instructions };
      } catch (error) {
        return { success: false, message: 'Failed to remove shell aliases - manually remove lcagent and lcagents aliases' };
      }
    }

    export const uninstallCommand = new Command('uninstall')
      .description('Remove LCAgents from the current directory')
      .option('-f, --force', 'Force removal without confirmation')
      .option('--keep-config', 'Keep configuration files')
      .addHelpText('after', () => {
        try {
          const repoCfg = require('../../../config/repository.json');
          const rawBase = process.env['REPOSITORY_RAWBASE'] || `https://raw.githubusercontent.com/${repoCfg.repository.owner}/${repoCfg.repository.name}`;
          const defaultBranch = repoCfg.repository.defaultBranch || 'main';
          const uninstallRaw = `${rawBase}/${defaultBranch}/uninstall.js`;
          return `\nNote: To avoid npx install prompts, use the standalone uninstaller:\ncurl -fsSL ${uninstallRaw} | node -- --force\n  `;
        } catch (err) {
          return `\nNote: To avoid npx install prompts, use the standalone uninstaller:\ncurl -fsSL https://raw.githubusercontent.com/jmaniLC/lcagents/main/uninstall.js | node -- --force\n  `;
        }
      })
      .action(async (options) => {
        const currentDir = process.cwd();
        const lcagentsDir = path.join(currentDir, '.lcagents');

        // Check if LCAgents is installed
        if (!await fs.pathExists(lcagentsDir)) {
          console.log(chalk.yellow('LCAgents is not installed in this directory'));
          return;
        }

        let confirmed = options.force;

        if (!confirmed) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to remove LCAgents from this directory?',
              default: false
            }
          ]);
          confirmed = answer.confirm;
        }

        if (!confirmed) {
          console.log(chalk.gray('Uninstall cancelled'));
          return;
        }

        const spinner = ora('Removing LCAgents...').start();

        try {
          if (options.keepConfig) {
            spinner.text = 'Removing LCAgents (keeping config)...';

            // Remove everything except config files
            const items = await fs.readdir(lcagentsDir);
            for (const item of items) {
              if (item !== 'config.yaml' && item !== 'user-settings.yaml') {
                await fs.remove(path.join(lcagentsDir, item));
              }
            }
          } else {
            spinner.text = 'Removing LCAgents completely...';
            await fs.remove(lcagentsDir);
          }

          // Also remove GitHub workflow files if they exist
          const githubWorkflowsDir = path.join(currentDir, '.github', 'workflows');
          if (await fs.pathExists(githubWorkflowsDir)) {
            const lcagentsWorkflows = [
              'lcagents-validation.yml',
              'lcagents-docs.yml'
            ];

            for (const workflow of lcagentsWorkflows) {
              const workflowPath = path.join(githubWorkflowsDir, workflow);
              if (await fs.pathExists(workflowPath)) {
                await fs.remove(workflowPath);
              }
            }
          }

          // Remove GitHub templates created by LCAgents
          const githubTemplatesDir = path.join(currentDir, '.github', 'ISSUE_TEMPLATE');
          if (await fs.pathExists(githubTemplatesDir)) {
            const lcagentsTemplates = [
              'agent-request.md',
              'bug-report.md'
            ];

            for (const template of lcagentsTemplates) {
              const templatePath = path.join(githubTemplatesDir, template);
              if (await fs.pathExists(templatePath)) {
                await fs.remove(templatePath);
              }
            }
          }

          // Remove GitHub Copilot instructions created by LCAgents
          const copilotManager = new GitHubCopilotManager(currentDir);
          await copilotManager.removeCopilotInstructions();

          // Remove shell alias
          const aliasResult = await removeShellAlias();

          spinner.succeed('LCAgents removed successfully!');

          console.log();
          if (options.keepConfig) {
            console.log(chalk.green('✅ LCAgents removed (configuration preserved)'));
            console.log(chalk.dim('Configuration files kept in .lcagents/'));
          } else {
            console.log(chalk.green('✅ LCAgents completely removed'));
          }

          // Show alias removal result
          console.log(chalk.cyan('🔧 Shell Alias Cleanup:'));
          if (aliasResult.success) {
            console.log(chalk.white(`   ✅ ${aliasResult.message}`));
            if (aliasResult.instructions) {
              console.log(chalk.dim(`   💡 ${aliasResult.instructions}`));
            }
          } else {
            console.log(chalk.yellow(`   ⚠️  ${aliasResult.message}`));
          }

          console.log();
          try {
            const repoCfg = require('../../../config/repository.json');
            const gitNpx = process.env['REPOSITORY_GITNPX'] || `git+${repoCfg.repository.url}`;
            console.log(chalk.dim(`To reinstall: npx ${gitNpx} init`));
          } catch (err) {
            console.log(chalk.dim('To reinstall: npx git+https://github.com/jmaniLC/lcagents.git init'));
          }

          // Always provide manual unalias instructions
          if (aliasResult.success) {
            console.log();
            console.log(chalk.yellow('🔧 Manual Alias Removal:'));
            console.log(chalk.white('   To remove aliases from your current session, run:'));
            console.log(chalk.cyan('   unalias lcagent lcagents'));
            console.log(chalk.dim('   (or restart your terminal)'));
          }

        } catch (error) {
          spinner.fail('Failed to remove LCAgents');
          console.error(chalk.red('Error:'), error);
          process.exit(1);
        }
      });
