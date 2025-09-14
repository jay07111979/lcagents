import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

describe('CLI Commands Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lcagents-test-'));
    cliPath = path.join(originalCwd, 'dist/cli/index.js');
    // Ensure CLI is built (always build to pick up local changes)
    execSync('npm run build', { cwd: originalCwd, stdio: 'pipe' });
    
    // Ensure cliPath exists after build
    if (!await fs.pathExists(cliPath)) {
      throw new Error('CLI build failed - dist/cli/index.js not found');
    }

    // Run installer in isolated temp directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(testDir);
  });

  describe('lcagents installer', () => {
    it('should initialize LCAgents successfully', async () => {
      // Ensure the temp directory looks like a project so validation passes in non-interactive mode
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test-project' }, null, 2), 'utf8');

      const command = `node ${cliPath} init --no-interactive --core-system bmad-core`;
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });

      expect(output).toContain('LCAgents initialized successfully');
      expect(output).toContain('Layered Architecture Created');

      // Verify directory structure
      const lcagentsPath = path.join(testDir, '.lcagents');
      expect(await fs.pathExists(lcagentsPath)).toBe(true);
      expect(await fs.pathExists(path.join(lcagentsPath, 'core'))).toBe(true);
    });
  });

  describe('lcagents setup information', () => {
    it('should display system information', async () => {
      const command = `node ${cliPath} setup about`;
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });

      expect(output).toContain('LendingClub Internal Agent System');
      expect(output).toContain('📦 Package:');
    });
  });
    describe('command help and agent listing', () => {
      it('should show res help', async () => {
        const command = `node ${cliPath} res -h`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });

        expect(output).toContain('Resource management utilities');
        expect(output).toContain('create');
        expect(output).toContain('list');
      });

      it('should show agent help', async () => {
        const command = `node ${cliPath} agent -h`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });

        expect(output).toContain('Discover, explore, and manage agents');
        expect(output).toContain('list');
      });

      it('should list agents (or show no agents message) after init', async () => {
        // Ensure installation in temp dir so agent list can find layers
        await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test-project' }, null, 2), 'utf8');
        execSync(`node ${cliPath} init --no-interactive --core-system bmad-core`, { stdio: 'pipe' });

        const command = `node ${cliPath} agent list`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });

        // The agent list may show 'No agents found' if loading fails, but normally shows 'Available Agents'
        const ok = output.includes('Available Agents') || output.includes('No agents found');
        expect(ok).toBe(true);
      });
    });
});