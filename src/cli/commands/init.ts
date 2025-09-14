import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { CoreSystemManager } from '../../core/CoreSystemManager';
import { LayerManager } from '../../core/LayerManager';
import { RuntimeConfigManager } from '../../core/RuntimeConfigManager';
import { GitHubCopilotManager } from '../../core/GitHubCopilotManager';
import { MetadataGenerator } from '../../core/MetadataGenerator';
import { InstallationOptions, InstallationResult } from '../../types/CoreSystem';
import { analyzeTechStack, generateTechStackReport, TechStackData, selectPod } from '../../utils/techStacker';

// Local subset of pod configuration shape used when running non-interactive pod selection
interface PodConfig {
  name: string;
  id: string;
  owner: string;
}

interface PodsConfiguration {
  pods: PodConfig[];
  allowCustomPods: boolean;
  customPodOption: { name: string; description: string };
}

/**
 * Ask user for installation directory
 */
export async function selectInstallationDirectory(interactive: boolean = true): Promise<string> {
  // When non-interactive, default to current working directory
  if (!interactive) {
    const defaultPath = process.cwd();
    console.log(chalk.gray(`Non-interactive mode: using current directory as install path: ${defaultPath}`));
    return defaultPath;
  }

  console.log(chalk.blue('\n🎯 LCAgents Installation Setup'));
  console.log(chalk.gray('First, let\'s determine where to install LCAgents.\n'));

  const { installChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'installChoice',
      message: 'Where would you like to install LCAgents?',
      choices: [
        { name: '📁 Current directory', value: 'current' },
        { name: '📂 Select a different directory', value: 'custom' },
        { name: '🏠 Home directory', value: 'home' }
      ]
    }
  ]);

  let installPath: string;

  switch (installChoice) {
    case 'current':
      installPath = process.cwd();
      break;
    case 'home':
      installPath = os.homedir();
      break;
    case 'custom':
      const { customPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customPath',
          message: 'Enter the full path to the directory:',
          validate: (input: string) => {
            if (!input.trim()) return 'Path cannot be empty';
            return true;
          }
        }
      ]);
      installPath = path.resolve(customPath.trim());
      break;
    default:
      installPath = process.cwd();
  }

  console.log(chalk.gray(`\n📍 Selected installation path: ${installPath}`));
  return installPath;
}
/**
 * Validate directory for LCAgents installation
 */
export async function validateInstallationDirectory(installPath: string): Promise<void> {
  const spinner = ora('🔍 Validating directory structure...').start();
  
  try {
    // Check if directory exists
    if (!await fs.pathExists(installPath)) {
      spinner.fail(chalk.red('Directory does not exist'));
      console.log(chalk.red(`❌ The specified directory does not exist: ${installPath}`));
      process.exit(1);
    }

    // Check if directory is readable
    try {
      await fs.access(installPath, fs.constants.R_OK);
    } catch (error) {
      spinner.fail(chalk.red('Directory is not readable'));
      console.log(chalk.red(`❌ Cannot read directory: ${installPath}`));
      process.exit(1);
    }

    // Check if directory has any files (empty directory check)
    const files = await fs.readdir(installPath);
    if (files.length === 0) {
      spinner.fail(chalk.red('Directory is empty'));
      console.log(chalk.yellow(`\n⚠️  The selected directory is empty.`));
      console.log(chalk.gray('Please select a directory with source code files to proceed with installation.\n'));
      process.exit(1);
    }

    // Check for basic project indicators (at least some code files should exist)
    const codeFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php', '.cs', '.cpp', '.c', '.json', '.yaml', '.yml', '.md'].includes(ext);
    });

    if (codeFiles.length === 0) {
      spinner.fail(chalk.red('No source files detected'));
      console.log(chalk.yellow(`\n⚠️  No recognizable source code files found in directory.`));
      console.log(chalk.gray('Please select a directory that contains a software project.\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Directory validation completed'));
    console.log(chalk.green(`✅ Directory is suitable for LCAgents installation`));
    console.log(chalk.gray(`   Found ${files.length} files including ${codeFiles.length} source files\n`));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to validate directory'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Get pod information from user
 */
export async function getPodInformation(interactive: boolean = true): Promise<{ name: string; id: string; owner: string }> {
  // When non-interactive, pick the first configured pod or a sensible default
  if (!interactive) {
    try {
      const podCfgPath = path.join(__dirname, '../../config/pods.json');
      if (await fs.pathExists(podCfgPath)) {
        const raw = await fs.readFile(podCfgPath, 'utf-8');
        const parsed = JSON.parse(raw) as PodsConfiguration;
        if (parsed.pods && parsed.pods.length > 0) {
          const p = parsed.pods[0];
          if (p) {
            console.log(chalk.gray(`Non-interactive mode: assigning to pod ${p.name}`));
            return { name: p.name, id: p.id, owner: p.owner };
          }
        }
      }
    } catch (err) {
      // ignore and fall back
    }

    // Fallback default
    const cwdName = path.basename(process.cwd());
    return { name: cwdName, id: cwdName.toLowerCase().replace(/[^a-z0-9]/g, '-'), owner: 'team' };
  }

  console.log(chalk.blue('🏢 Pod Assignment'));
  console.log(chalk.gray('Assign this repository to an organizational pod for better management.\n'));
  
  return await selectPod();
}

/**
 * Analyze tech stack and get repository information
 */
export async function analyzeTechStackWithContext(
  installPath: string,
  podInfo: { name: string; id: string; owner: string },
  interactive: boolean = true
): Promise<TechStackData> {
  const spinner = ora('🔍 Analyzing project technology stack...').start();
  
  try {
    // Set pod context before analysis
    const techStackData = await analyzeTechStack(installPath, podInfo);
    
    if (techStackData.noTechStack) {
      spinner.warn(chalk.yellow('Limited technology stack detected'));
      console.log(chalk.yellow(`\n⚠️  ${techStackData.message}`));

      if (interactive) {
        const { proceedAnyway } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceedAnyway',
            message: 'Do you want to proceed with LCAgents installation anyway?',
            default: false
          }
        ]);

        if (!proceedAnyway) {
          console.log(chalk.gray('\n👋 Installation cancelled. Please ensure your project has recognizable tech stack files.\n'));
          process.exit(0);
        }
      } else {
        // Non-interactive: default to proceed to allow automated installs in CI/test environments
        console.log(chalk.gray('Non-interactive: proceeding despite limited tech stack'));
      }
    } else {
      spinner.succeed(chalk.green('Tech stack analysis completed'));
      
      console.log(chalk.blue('\n📊 Detected Technology Stack:'));
      console.log(chalk.white(`   Primary: ${techStackData.primaryStack || techStackData.stack}`));
      
      if (techStackData.allStacks && techStackData.allStacks.length > 1) {
        console.log(chalk.cyan(`   Additional: ${techStackData.allStacks.filter(s => s !== (techStackData.primaryStack || techStackData.stack)).join(', ')}`));
      }

      if (techStackData.frameworks.length > 0) {
        console.log(chalk.magenta(`   Frameworks: ${techStackData.frameworks.join(', ')}`));
      }

      if (techStackData.buildTools.length > 0) {
        console.log(chalk.yellow(`   Build Tools: ${techStackData.buildTools.join(', ')}`));
      }

      console.log(chalk.green('\n✅ Technology stack analysis completed!'));
    }

  return techStackData;

  } catch (error) {
    spinner.fail(chalk.red('Failed to analyze tech stack'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Update GitHub Copilot instructions with LCAgents information
 */
export async function updateGitHubCopilotInstructions(
  installPath: string, 
  podInfo: { name: string; id: string; owner: string }, 
  techStackData: TechStackData
): Promise<void> {
  const spinner = ora('📝 Updating GitHub Copilot instructions...').start();
  
  try {
    const copilotManager = new GitHubCopilotManager(installPath);
    
    await copilotManager.updateCopilotInstructions({
      projectPath: installPath,
      podInfo,
      techStack: techStackData.allStacks || [techStackData.stack].filter(Boolean)
    });
    
    spinner.succeed(chalk.green('GitHub Copilot instructions updated'));
    console.log(chalk.blue('\n📋 GitHub Copilot Integration:'));
    console.log(chalk.white('   ✅ LCAgents information added to .github/copilot-instructions.md'));
    console.log(chalk.cyan('   🤖 GitHub Copilot now has context about available agents'));
    console.log(chalk.dim('   💡 Use @lcagents activate <agent> to start working with specialized agents'));
    console.log();
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to update GitHub Copilot instructions'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    // Don't exit - this is not critical for installation
    console.log(chalk.yellow('⚠️  Installation will continue without GitHub Copilot integration'));
    console.log();
  }
}

/**
 * Setup shell alias for lcagent command
 */
async function setupShellAlias(): Promise<{ success: boolean; message: string; instructions?: string }> {
  try {
    const homeDir = os.homedir();
    const shell = process.env['SHELL'] || '';
    
    // Determine which shell config file to use
    let configFile = '';
    let shellName = '';
    
    const isWin = process.platform === 'win32';

    if (isWin) {
      // On Windows, we'll target PowerShell profile locations
      // Prefer modern PowerShell profile location under Documents\PowerShell, fallback to WindowsPowerShell
      const p1 = path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      const p2 = path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
      configFile = (await fs.pathExists(p1)) ? p1 : p2;
      shellName = 'powershell';
    } else if (shell.includes('zsh')) {
      configFile = path.join(homeDir, '.zshrc');
      shellName = 'zsh';
    } else if (shell.includes('bash')) {
      // Check for .bash_profile first, then .bashrc
      const bashProfile = path.join(homeDir, '.bash_profile');
      const bashrc = path.join(homeDir, '.bashrc');
      
      if (await fs.pathExists(bashProfile)) {
        configFile = bashProfile;
      } else {
        configFile = bashrc;
      }
      shellName = 'bash';
    } else {
      // Unknown shell - fall back to POSIX-style rc file in home
      configFile = path.join(homeDir, '.profile');
      shellName = 'sh';
    }

    let aliasCommand1 = 'alias lcagent="npx git+https://github.com/jmaniLC/lcagents.git"';
    let aliasCommand2 = 'alias lcagents="npx git+https://github.com/jmaniLC/lcagents.git"';
    try {
      const repoCfg = require('../../../config/repository.json');
  const gitNpx = process.env['REPOSITORY_GITNPX'] || `git+${repoCfg.repository.url}`;
      aliasCommand1 = `alias lcagent=\"npx ${gitNpx}\"`;
      aliasCommand2 = `alias lcagents=\"npx ${gitNpx}\"`;
    } catch (err) {
      // keep defaults
    }
    // Safely derive git target argument for npx commands
    let gitTarget: string | undefined;
    try {
      const repoCfg2 = require('../../../config/repository.json');
      gitTarget = process.env['REPOSITORY_GITNPX'] || `git+${repoCfg2.repository.url}`;
    } catch (err) {
      gitTarget = process.env['REPOSITORY_GITNPX'];
    }
    if (!gitTarget) gitTarget = 'git+https://github.com/jmaniLC/lcagents.git';
    const aliasComment = '# LCAgents aliases for easy access';
    
    // Check if alias already exists
    if (await fs.pathExists(configFile)) {
      const content = await fs.readFile(configFile, 'utf-8');
      if (content.includes('alias lcagent=') && content.includes('alias lcagents=')) {
        return {
          success: true,
          message: 'Aliases already exist in shell configuration'
        };
      }
    }
    
    // Add aliases to shell config (different per-shell)
    if (isWin) {
      // For PowerShell, create functions instead of POSIX alias
      const psFunc1 = `function lcagent { param([Parameter(ValueFromRemainingArguments=$true)]$args) npx ${gitTarget} $args }`;
      const psFunc2 = `function lcagents { param([Parameter(ValueFromRemainingArguments=$true)]$args) npx ${gitTarget} $args }`;
      const entry = `# LCAgents aliases\n${psFunc1}\n${psFunc2}\n`;
      await fs.ensureFile(configFile);
      await fs.appendFile(configFile, entry, 'utf-8');

      // For PowerShell provide an activation instruction (do not create temp files)
      console.log(chalk.green('✅ LCAgents aliases configured in PowerShell profile!'));
      console.log(chalk.dim('   (restart your PowerShell session to load the new functions)'));
      console.log();

      return {
        success: true,
        message: `Aliases added to ${shellName} configuration`,
        instructions: `Run in current PowerShell session: . '${configFile}'`
      };
    } else {
      const aliasEntry = `\n${aliasComment}\n${aliasCommand1}\n${aliasCommand2}\n`;
      await fs.ensureFile(configFile);
      await fs.appendFile(configFile, aliasEntry);

      // For POSIX shells return a direct source command (no temp script)
      console.log(chalk.green('✅ LCAgents aliases configured in shell!'));
      console.log(chalk.dim('   (restart your terminal to load the new aliases)'));
      console.log();

      return {
        success: true,
        message: `Aliases added to ${shellName} configuration`,
        instructions: `Run in current shell: source ${configFile}`
      };
    }
    
  } catch (error) {
    return {
      success: false,
      message: 'Failed to setup shell alias',
      instructions: 'Manually add: alias lcagent="npx git+https://github.com/jmaniLC/lcagents.git"'
    };
  }
}

/**
 * Create a per-user shim that invokes the project's local CLI.
 * Returns an activation instruction string the user can run to make the shim available in the current session.
 */
export async function createUserShim(installPath: string): Promise<{ success: boolean; message: string; instructions?: string }> {
  try {
    const isWin = process.platform === 'win32';
    const home = os.homedir();

    // Create a project-local runtime launcher under .lcagents/runtime/bin
    const runtimeBin = path.join(installPath, '.lcagents', 'runtime', 'bin');
    await fs.ensureDir(runtimeBin);

    // The runtime launcher will require the built CLI entry if present, otherwise it will emit a helpful message.
    const projectCli = path.join(installPath, 'dist', 'cli', 'index.js');
    const runtimeLauncher = path.join(runtimeBin, 'lcagent.js');
    const launcherContent = `#!/usr/bin/env node\n\n// Runtime launcher for LCAgents local CLI\nconst path = require('path');\nconst fs = require('fs');\nconst target = ${JSON.stringify(projectCli)};\nif (fs.existsSync(target)) {\n  try { require(target); } catch (e) {\n    console.error('Failed to run local LCAgents CLI at', target);\n    console.error(e && e.stack ? e.stack : e);\n    process.exit(1);\n  }\n} else {\n  console.error('LCAgents runtime not found at', target);\n  console.error('Please build the project (npm run build) or ensure the runtime exists at the above path.');\n  process.exit(1);\n}\n`;
    await fs.writeFile(runtimeLauncher, launcherContent, { mode: 0o755 });

    if (isWin) {
      const userBin = path.join(process.env['USERPROFILE'] || home, 'bin');
      await fs.ensureDir(userBin);
      const shimPath = path.join(userBin, 'lcagent.ps1');
      // PowerShell wrapper to invoke the project-local launcher
      const body = `param([Parameter(ValueFromRemainingArguments=$true)] $args)\nnode '${runtimeLauncher}' $args\n`;
      await fs.writeFile(shimPath, body, 'utf8');

      return {
        success: true,
        message: `User shim created at ${shimPath}`,
        instructions: `Add ${userBin} to your PATH or run: $env:PATH += ';${userBin}'; . ${shimPath}`
      };
    } else {
      const userBin = path.join(home, '.local', 'bin');
      await fs.ensureDir(userBin);
      const shimPath = path.join(userBin, 'lcagent');
      const shim = `#!/usr/bin/env bash\nnode "${runtimeLauncher}" "$@"\n`;
      await fs.writeFile(shimPath, shim, { mode: 0o755 });

      return {
        success: true,
        message: `User shim created at ${shimPath}`,
        instructions: `Ensure ${userBin} is on your PATH (e.g. export PATH=\"${userBin}:$PATH\") or run: source ~/.profile`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to create user shim',
      instructions: 'You can add an alias pointing to dist/cli/index.js or use npm link'
    };
  }
}

export const initCommand = new Command('init')
  .description('Initialize LCAgents in the current directory')
  .option('-f, --force', 'Overwrite existing installation')
  .option('--no-github', 'Skip GitHub integration setup')
  .option('--template <name>', 'Use specific project template')
  .option('--no-interactive', 'Skip interactive prompts')
  .option('--core-system <name>', 'Specify core system to install (default: bmad-core)')
  .action(async (options) => {
    // Show version info during install
    const packageJson = require('../../../package.json');
    console.log(chalk.cyan('🔧 LCAgents Installer'));
    console.log(chalk.gray(`github:jmaniLC/lcagents ver${packageJson.version}`));
    console.log();
    
    const spinner = ora('Initializing LCAgents...').start();
    
    try {
  // Step 1: Get directory
  spinner.stop();
  // Determine interactive mode: CLI option wins, otherwise fall back to TTY check
  const interactiveMode = (typeof options.interactive === 'boolean') ? options.interactive : !!process.stdin.isTTY;

  const installPath = await selectInstallationDirectory(interactiveMode);
      
      // Step 2: Validate directory source (if error, fail the installer)
      await validateInstallationDirectory(installPath);
      
  // Step 3: Get the pod name  
  const podInfo = await getPodInformation(interactiveMode);
      
      // Step 4: Analyze tech stack
  const techStackData = await analyzeTechStackWithContext(installPath, podInfo, interactiveMode);
      
      const lcagentsDir = path.join(installPath, '.lcagents');
      
      // Check if already initialized
      if (await fs.pathExists(lcagentsDir) && !options.force) {
        console.log(chalk.red('❌ LCAgents already initialized in this directory'));
        console.log(chalk.yellow('Use --force to overwrite existing installation'));
        return;
      }

      spinner.start('Setting up LCAgents...');

      // Initialize managers
      const coreSystemManager = new CoreSystemManager(installPath);
      const layerManager = new LayerManager(installPath);
      const runtimeConfigManager = new RuntimeConfigManager(installPath);

      let selectedCoreSystem = options.coreSystem;

      // Interactive core system selection if not specified
      if (!selectedCoreSystem && options.interactive !== false) {
        const availableSystems = await coreSystemManager.getAvailableCoreSystems();
        
        if (availableSystems.length === 0) {
          console.log(chalk.red('No core systems available in registry'));
          process.exit(1);
        }

        console.log();
        console.log(chalk.cyan('🔧 Core Agent System Selection'));
        console.log(chalk.dim('Choose the core agent system that best fits your team and project needs:'));
        console.log();

        // Display available systems
        availableSystems.forEach((system, index) => {
          console.log(chalk.white(`${index + 1}. ${chalk.bold(system.name)} (v${system.version})`));
          console.log(chalk.dim(`   ${system.description}`));
          console.log(chalk.dim(`   ${system.agentCount} agents | ${system.installation.estimatedTime} | ${system.installation.diskSpace}`));
          if (system.isDefault) {
            console.log(chalk.green('   ✅ Recommended for most teams'));
          }
          // Add development warnings for non-ready systems
          if (system.name === 'enterprise-core' || system.name === 'minimal-core') {
            console.log(chalk.red('   ⚠️  [DEV MODE] - Not ready for production use'));
          }
          console.log();
        });

        const { coreSystemChoice } = await inquirer.prompt([
          {
            type: 'list',
            name: 'coreSystemChoice',
            message: 'Select a core agent system:',
            choices: availableSystems.map((system) => {
              let warningText = '';
              if (system.name === 'enterprise-core') {
                warningText = chalk.red(' [NOT READY]');
              } else if (system.name === 'minimal-core') {
                warningText = chalk.red(' [DEV MODE]');
              }
              
              return {
                name: `${system.name} - ${system.description}${system.isDefault ? ' (Recommended)' : ''}${warningText}`,
                value: system.name,
                short: system.name
              };
            }),
            default: availableSystems.find(s => s.isDefault)?.name || availableSystems[0]?.name
          }
        ]);

        selectedCoreSystem = coreSystemChoice;

        // Show selected system details
        const selectedSystemInfo = availableSystems.find(s => s.name === selectedCoreSystem);
        if (selectedSystemInfo) {
          console.log();
          console.log(chalk.green(`✅ Selected: ${chalk.bold(selectedSystemInfo.name)}`));
          console.log(chalk.dim(`Description: ${selectedSystemInfo.description}`));
          console.log(chalk.dim(`Features: ${selectedSystemInfo.features.join(', ')}`));
          console.log();
        }
      }

      // Use default if still not selected
      if (!selectedCoreSystem) {
        selectedCoreSystem = await coreSystemManager.getDefaultCoreSystem();
      }

      const installationOptions: InstallationOptions = {
        force: options.force,
        coreSystem: selectedCoreSystem,
        interactive: options.interactive,
        skipGithub: !options.github,
        template: options.template
      };

      // Stop the setup spinner before starting installation
      spinner.stop();

      const result = await performLayeredInstallation(
        installPath,
        installationOptions,
        coreSystemManager,
        layerManager,
        runtimeConfigManager
      );

      if (!result.success) {
        console.log(chalk.red('❌ Installation failed:'), result.error);
        process.exit(1);
      }

      // Update runtime config with tech stack information
      if (techStackData && !techStackData.isEmpty && !techStackData.noTechStack) {
        await runtimeConfigManager.updateRuntimeConfig({
          techStack: {
            primary: techStackData.primaryStack,
            all: techStackData.allStacks,
            frameworks: techStackData.frameworks,
            buildTools: techStackData.buildTools,
            packageManagers: techStackData.packageManagers,
            databases: techStackData.databases,
            deployment: techStackData.deployment,
            analyzedAt: new Date().toISOString(),
            pod: techStackData.pod,
            repository: techStackData.repository
          }
        });

        // Generate and save tech stack report
        const techReport = generateTechStackReport(techStackData);
        if (techReport) {
          const techPreferencesPath = path.join(installPath, '.lcagents', 'core', '.bmad-core', 'data', 'technical-preferences.md');
          await fs.ensureDir(path.dirname(techPreferencesPath));
          await fs.writeFile(techPreferencesPath, techReport, 'utf-8');
        }
      }

      // Step 7: Update GitHub Copilot instructions
      await updateGitHubCopilotInstructions(installPath, podInfo, techStackData);

      console.log(chalk.green('🎉 LCAgents initialized successfully!'));
      console.log();
      
      // Display tech stack information
      if (techStackData && !techStackData.isEmpty && !techStackData.noTechStack) {
        console.log(chalk.blue('📊 Technology Stack Information:'));
        console.log(chalk.white(`   Primary Stack: ${techStackData.primaryStack}`));
        if (techStackData.frameworks.length > 0) {
          console.log(chalk.cyan(`   Frameworks: ${techStackData.frameworks.join(', ')}`));
        }
        console.log(chalk.blue('🏢 Pod Information:'));
        console.log(chalk.white(`   Pod: ${techStackData.pod.name} (${techStackData.pod.id})`));
        console.log(chalk.white(`   Owner: ${techStackData.pod.owner}`));
        console.log(chalk.white(`   Repository: ${techStackData.repository.name} (${techStackData.repository.isMainRepo ? 'Main' : 'Secondary'})`));
        console.log(chalk.green('   ✅ Tech stack preferences saved to technical-preferences.md'));
        console.log();
      }
      
      // Setup shell alias
      const aliasResult = await setupShellAlias();
      // Try to create a local user shim that points to the installed CLI for better local UX
      let shimResult: { success: boolean; message: string; instructions?: string } | null = null;
      try {
        shimResult = await createUserShim(installPath);
      } catch (err) {
        shimResult = null;
      }
      if (aliasResult.success) {
        console.log(chalk.green('🔧 Shell Alias Setup:'));
        console.log(chalk.white(`   ✅ ${aliasResult.message}`));
  if (aliasResult.instructions) {
          // Show platform-specific activation instruction clearly
          if (process.platform === 'win32') {
            console.log(chalk.yellow('   🚀 To activate aliases in the current PowerShell session:'));
            console.log(chalk.cyan(`   ${aliasResult.instructions}`));
            console.log(chalk.dim('   (or restart PowerShell to load the new profile automatically)'));
          } else {
            console.log(chalk.yellow('   🚀 To activate aliases in the current shell:'));
            console.log(chalk.cyan(`   ${aliasResult.instructions}`));
            console.log(chalk.dim('   (or restart your terminal to load the updated shell configuration)'));
          }
          // Provide a quick verification command the user can run now
          console.log(chalk.yellow('   🔎 Verify the commands are available now:'));
          console.log(chalk.cyan(`   ${process.platform === 'win32' ? 'lcagent -h' : 'lcagent -h'}`));
          console.log(chalk.dim('   If the command is not found, run the activation command above or restart your terminal/PowerShell.'));
        }
        // If shim was created, show its instructions as the preferred way to run the local CLI
        if (shimResult && shimResult.success) {
          console.log(chalk.yellow('   📦 Local shim installed:'));
          console.log(chalk.cyan(`   ${shimResult.instructions}`));
          console.log(chalk.dim('   After adding the user bin to PATH you can run: lcagent -h'));
        } else if (shimResult && !shimResult.success) {
          console.log(chalk.dim(`   (shim creation skipped: ${shimResult.message})`));
        }
        console.log(chalk.white('   Available commands:'), chalk.cyan('lcagent <command>'), chalk.dim('or'), chalk.cyan('lcagents <command>'));
        console.log();
      } else {
        console.log(chalk.yellow('⚠️  Shell Alias Setup:'));
        console.log(chalk.white(`   ⚠️  ${aliasResult.message}`));
        if (aliasResult.instructions) {
          console.log(chalk.dim(`   💡 ${aliasResult.instructions}`));
        }
        console.log();
      }
      
      console.log(chalk.cyan('📁 Layered Architecture Created:'));
      console.log(chalk.white(`  Core System: ${result.coreSystem} at ${path.relative(installPath, result.installedPath)}`));
      result.layersCreated.forEach(layer => {
        console.log(chalk.dim(`  ${layer} layer ready for customization`));
      });
      console.log();
      console.log(chalk.cyan('🔧 Next Steps:'));
      console.log(chalk.white('  1. Explore available agents:'), chalk.dim('ls .lcagents/agents/'));
      console.log(chalk.white('  2. View core system resources:'), chalk.dim(`ls .lcagents/core/${result.coreSystem}/`));
      console.log(chalk.white('  3. Customize agents:'), chalk.dim('edit .lcagents/custom/agents/overrides/'));
      console.log(chalk.white('  4. Configure your pod:'), chalk.dim('edit .lcagents/custom/config/pod-config.yaml'));
      console.log();
      if (result.warnings && result.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
        console.log();
      }
      console.log(chalk.dim('For help: lcagents --help or lcagent --help'));
      
    } catch (error) {
      // Make sure any running spinner is stopped
      if (spinner) {
        spinner.stop();
      }
      console.log(chalk.red('❌ Failed to initialize LCAgents'));
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Perform layered installation with the new architecture
 */
async function performLayeredInstallation(
  basePath: string,
  options: InstallationOptions,
  coreSystemManager: CoreSystemManager,
  layerManager: LayerManager,
  runtimeConfigManager: RuntimeConfigManager
): Promise<InstallationResult> {
  const spinner = ora('Installing core agent system...').start();
  
  try {
    const lcagentsDir = path.join(basePath, '.lcagents');
    const coreSystemName = options.coreSystem || 'bmad-core';

    // Step 1: Clean existing installation if force
    if (options.force && await fs.pathExists(lcagentsDir)) {
      spinner.text = 'Cleaning existing installation...';
      await fs.remove(lcagentsDir);
    }

    // Step 2: Check for existing flat installation and migrate
    const hasExistingFlat = await checkForFlatInstallation(lcagentsDir);
    if (hasExistingFlat) {
      spinner.text = 'Migrating from flat structure to layered architecture...';
      await layerManager.migrateFromFlatStructure(coreSystemName);
    } else {
      // Step 3: Install selected core system
      spinner.text = `Installing ${coreSystemName} core system...`;
      const installResult = await coreSystemManager.installCoreSystem(coreSystemName, options.force);
      
      if (!installResult.success) {
        throw new Error(installResult.error);
      }

      // Step 4: Create layered directory structure
      spinner.text = 'Creating layered architecture...';
      await layerManager.createLayeredStructure();

      // Step 5: Set active core system (before virtual resolution setup)
      spinner.text = 'Configuring core system...';
      await coreSystemManager.switchCoreSystem(coreSystemName, 'Initial installation');

      // Step 6: Create backward compatibility resolution (after active core is set)
      spinner.text = 'Setting up backward compatibility...';
      await layerManager.createVirtualResolutionSystem(coreSystemName);
    }

    // Step 7: Initialize configuration
    spinner.text = 'Initializing configuration...';
    // Initialize runtime configuration with GitHub settings
    await runtimeConfigManager.updateRuntimeConfig({
      github: {
        integration: !options.skipGithub,
        copilotFeatures: !options.skipGithub,
        repository: "",
        branch: 'main'
      },
      coreSystem: {
        active: coreSystemName,
        fallback: coreSystemName
      }
    });

    // Step 8: Generate resource metadata
    spinner.text = 'Generating resource metadata...';
    try {
      await MetadataGenerator.generateForInstallation(basePath);
      console.log(chalk.gray('\n✓ Resource metadata generated for creation wizards and validation'));
    } catch (metadataError) {
      console.log(chalk.yellow('\n⚠️  Metadata generation failed (non-critical):'), 
                  metadataError instanceof Error ? metadataError.message : String(metadataError));
    }

    spinner.succeed('Installation completed successfully!');

    return {
      success: true,
      coreSystem: coreSystemName,
      installedPath: path.join(lcagentsDir, 'core', `.${coreSystemName}`),
      layersCreated: ['Core', 'Organization', 'Pod Custom', 'Runtime'],
      configurationPath: path.join(lcagentsDir, 'runtime', 'config.yaml'),
      warnings: []
    };

  } catch (error) {
    spinner.fail('Installation failed');
    return {
      success: false,
      coreSystem: options.coreSystem || 'bmad-core',
      installedPath: '',
      layersCreated: [],
      configurationPath: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if there's an existing flat installation
 */
async function checkForFlatInstallation(lcagentsDir: string): Promise<boolean> {
  if (!await fs.pathExists(lcagentsDir)) {
    return false;
  }

  // Check if it's already layered (has core directory)
  const coreDir = path.join(lcagentsDir, 'core');
  if (await fs.pathExists(coreDir)) {
    return false; // Already layered
  }

  // Check if it has flat structure (agents directory directly in .lcagents)
  const agentsDir = path.join(lcagentsDir, 'agents');
  return await fs.pathExists(agentsDir);
}
