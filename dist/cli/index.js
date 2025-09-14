#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const initModule = __importStar(require("./commands/init"));
const uninstallModule = __importStar(require("./commands/uninstall"));
const core_1 = require("./commands/core");
const resource_1 = require("./commands/resource");
const agent_1 = require("./commands/agent");
const setup_utils_1 = require("./commands/setup-utils");
const repository_config_1 = require("../utils/repository-config");
// Load repository configuration
const repoConfig = (0, repository_config_1.loadRepositoryConfig)();
const program = new commander_1.Command();
program
    .name('lcagents')
    .alias('lcagent')
    .description('LendingClub Internal Agent System - Distributed BMAD-Core Agents')
    .version('1.0.0-alpha.1');
// Register commands
program.addCommand(resource_1.resCommand);
program.addCommand(agent_1.agentCommand);
// Expose common setup commands at top-level for convenience and for integration tests
program.addCommand(initModule.initCommand);
program.addCommand(uninstallModule.uninstallCommand);
program.addCommand(core_1.coreCommand);
// REMOVED: commandCommand - Functionality available via 'lcagents agent command'
// Create setup command group
const setupCommand = new commander_1.Command('setup')
    .description('LCAgents framework setup and configuration utilities');
// Add subcommands to setup group
setupCommand.addCommand(initModule.initCommand);
setupCommand.addCommand(uninstallModule.uninstallCommand);
setupCommand.addCommand(core_1.coreCommand);
// Add globalized utility commands to setup group
setupCommand.addCommand(setup_utils_1.moveCommand);
setupCommand.addCommand(setup_utils_1.backupCommand);
setupCommand.addCommand(setup_utils_1.revertCommand);
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
//# sourceMappingURL=index.js.map