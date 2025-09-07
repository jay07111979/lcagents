import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigManager } from '../../core/ConfigManager';
import { GitHubIntegration } from '../../core/GitHubIntegration';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export const initCommand = new Command('init')
  .description('Initialize LCAgents in the current directory')
  .option('-f, --force', 'Overwrite existing installation')
  .option('--no-github', 'Skip GitHub integration setup')
  .option('--template <name>', 'Use specific project template')
  .option('--no-interactive', 'Skip interactive prompts')
  .action(async (options) => {
    const spinner = ora('Initializing LCAgents...').start();
    
    try {
      const currentDir = process.cwd();
      const lcagentsDir = path.join(currentDir, '.lcagents');
      
      // Check if already initialized
      if (await fs.pathExists(lcagentsDir) && !options.force) {
        spinner.fail('LCAgents already initialized in this directory');
        console.log(chalk.yellow('Use --force to overwrite existing installation'));
        return;
      }
      
      spinner.text = 'Creating directory structure...';
      
      // Create .lcagents directory structure
      const directories = [
        'agents',
        'tasks', 
        'templates',
        'checklists',
        'data',
        'utils',
        'workflows',
        'agent-teams',
        'logs',
        'cache'
      ];
      
      for (const dir of directories) {
        await fs.ensureDir(path.join(lcagentsDir, dir));
      }
      
      spinner.text = 'Copying BMAD-Core resources...';
      
      // TODO: Copy BMAD-Core resources from package
      // This would copy from node_modules/@lendingclub/lcagents/resources
      const packageResourcesPath = path.join(__dirname, '../../../resources');
      if (await fs.pathExists(packageResourcesPath)) {
        await fs.copy(packageResourcesPath, lcagentsDir);
      }
      
      spinner.text = 'Setting up configuration...';
      
      // Initialize configuration
      console.log('DEBUG: Starting configuration setup...');
      const configManager = new ConfigManager(currentDir);
      console.log('DEBUG: ConfigManager created');
      
      let githubEnabled = options.github !== false;
      let repository = '';
      
      console.log('DEBUG: Interactive check - options.interactive:', options.interactive);
      console.log('DEBUG: GitHub enabled:', githubEnabled);
      console.log('DEBUG: TTY available:', process.stdin.isTTY);
      console.log('DEBUG: Environment:', process.env['npm_execpath'] ? 'NPX' : 'Local');
      
      // Force non-interactive mode in NPX environments unless explicitly requested
      const isNPXEnvironment = !!(process.env['npm_execpath'] || process.env['npm_command']);
      const shouldRunInteractive = options.interactive === true || (!isNPXEnvironment && options.interactive !== false && process.stdin.isTTY);
      
      console.log('DEBUG: Is NPX environment:', isNPXEnvironment);
      console.log('DEBUG: Should run interactive:', shouldRunInteractive);
      
      if (shouldRunInteractive) {
        console.log('DEBUG: Running interactive prompts...');
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enableGithub',
            message: 'Enable GitHub integration?',
            default: githubEnabled
          },
          {
            type: 'input',
            name: 'repository',
            message: 'GitHub repository (org/repo):',
            when: (answers) => answers.enableGithub,
            validate: (input) => {
              if (!input) return 'Repository is required for GitHub integration';
              if (!input.includes('/')) return 'Repository must be in format org/repo';
              return true;
            }
          }
        ]);
        
        githubEnabled = answers.enableGithub;
        repository = answers.repository || '';
        console.log('DEBUG: Interactive setup completed');
      } else {
        console.log('DEBUG: Skipping interactive prompts (non-interactive mode or no TTY)');
      }
      
      console.log('DEBUG: About to initialize config with:', { enableGithub: githubEnabled, repository });
      
      await configManager.initializeConfig({
        enableGithub: githubEnabled,
        enableCopilot: githubEnabled,
        repository
      });
      
      console.log('DEBUG: Config initialization completed');
      
      if (githubEnabled) {
        spinner.text = 'Setting up GitHub integration...';
        const config = configManager.getConfig();
        const githubIntegration = new GitHubIntegration(currentDir, config);
        await githubIntegration.initialize();
      }
      
      spinner.succeed('LCAgents initialized successfully!');
      
      console.log();
      console.log(chalk.green('🎉 Setup Complete!'));
      console.log();
      console.log('Next steps:');
      console.log(chalk.cyan('  1. Explore available agents:'), 'ls .lcagents/agents/');
      console.log(chalk.cyan('  2. Validate installation:'), 'npx lcagents validate');
      console.log(chalk.cyan('  3. Generate documentation:'), 'npx lcagents docs');
      console.log();
      console.log(chalk.dim('For help: npx lcagents --help'));
      
    } catch (error) {
      spinner.fail('Failed to initialize LCAgents');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });
