#!/usr/bin/env node

import { Command } from 'commander';
import * as initModule from './commands/init';
import * as uninstallModule from './commands/uninstall';
import { coreCommand } from './commands/core';
import { resCommand } from './commands/resource';
import { agentCommand } from './commands/agent';
import { moveCommand, backupCommand, revertCommand } from './commands/setup-utils';
import { loadRepositoryConfig } from '../utils/repository-config';

// Load repository configuration
const repoConfig = loadRepositoryConfig();

const program = new Command();

program
  .name('lcagents')
  .alias('lcagent')
  .description('LendingClub Internal Agent System - Distributed BMAD-Core Agents')
  .version('1.0.0-alpha.1');

// Register commands
program.addCommand(resCommand);
program.addCommand(agentCommand);
// Expose common setup commands at top-level for convenience and for integration tests
program.addCommand(initModule.initCommand);
program.addCommand(uninstallModule.uninstallCommand);
program.addCommand(coreCommand);
// REMOVED: commandCommand - Functionality available via 'lcagents agent command'

// Create setup command group
const setupCommand = new Command('setup')
  .description('LCAgents framework setup and configuration utilities');

// Add subcommands to setup group
setupCommand.addCommand(initModule.initCommand);
setupCommand.addCommand(uninstallModule.uninstallCommand);
setupCommand.addCommand(coreCommand);

// Add globalized utility commands to setup group
setupCommand.addCommand(moveCommand);
setupCommand.addCommand(backupCommand);
setupCommand.addCommand(revertCommand);

// Add about subcommand to setup group
setupCommand
  .command('about')
  .description('Show LendingClub internal installation information')
  .action(async () => {
    console.log('🏢 LendingClub Internal Agent System');
    console.log('📦 Package: @lendingclub/lcagents v1.0.0-alpha.1');
    console.log(`📍 Repository: ${repoConfig.repository.url.replace('.git', '')}`);
    console.log('📚 Documentation: https://confluence.lendingclub.com/lcagents');
    console.log('🎫 Support: #engineering-tools Slack channel');
    console.log(`🔧 Team: ${repoConfig.organization} Engineering Tools & Automation`);
    console.log(`👤 Author: ${repoConfig.author.name}`);
  });

// Register the setup command group
program.addCommand(setupCommand);

// Add additional commands for development
// DEACTIVATED: validate command (hidden from CLI menu but functionality preserved for GitHub workflows)
/*
program
  .command('validate')
  .description('Validate agent definitions and configuration')
  .action(async () => {
    console.log('🔍 Validating agent definitions...');
    // TODO: Implement validation logic
    console.log('✅ Validation completed');
  });
*/

// DEACTIVATED: docs command (hidden from CLI menu but functionality preserved for GitHub workflows)
/*
program
  .command('docs')
  .description('Generate agent documentation')
  .option('--output <path>', 'Output path for documentation', 'docs/agents.md')
  .option('--comprehensive', 'Generate comprehensive documentation')
  .action(async (options) => {
    console.log(`📚 Generating documentation to ${options.output}...`);
    // TODO: Implement documentation generation
    console.log('✅ Documentation generated');
  });
*/

// DEACTIVATED: analyze command (hidden from CLI menu but functionality preserved for GitHub workflows)
/*
program
  .command('analyze')
  .description('Analyze agent system and generate reports')
  .option('--report <path>', 'Output path for analysis report', 'analysis.md')
  .action(async (options) => {
    console.log(`📊 Generating analysis report to ${options.report}...`);
    // TODO: Implement analysis logic
    console.log('✅ Analysis completed');
  });
*/

// Parse command line arguments
program.parse();
