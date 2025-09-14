import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

// Mock ora to prevent spinner output during tests
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    text: ''
  }));
});

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock the techStacker module
jest.mock('../../utils/techStacker', () => ({
  selectPod: jest.fn().mockResolvedValue({
    name: 'Test Pod',
    id: 'test-pod',
    owner: 'team-test'
  }),
  analyzeTechStack: jest.fn().mockResolvedValue({
    stack: 'JavaScript',
    primaryStack: 'JavaScript',
    allStacks: ['JavaScript'],
    frameworks: ['React'],
    buildTools: ['npm'],
    packageManagers: ['npm'],
    databases: [],
    deployment: [],
    workspacePath: '/test/path',
    isEmpty: false,
    noTechStack: false,
    pod: {
      id: 'test-pod',
      name: 'Test Pod',
      description: 'Test description',
      owner: 'team-test',
      createdAt: new Date().toISOString(),
      repositoryCount: 1
    },
    repository: {
      name: 'test-repo',
      path: '/test/path',
      url: 'https://github.com/test/repo',
      branch: 'main',
      lastAnalyzed: new Date().toISOString(),
      isMainRepo: true
    }
  }),
  generateTechStackReport: jest.fn()
}));

import * as inquirer from 'inquirer';
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Installation Flow', () => {
  let testDir: string;
  let originalCwd: string;

  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lcagents-flow-test-'));
    process.chdir(testDir);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(testDir);
  });

  describe('Flow Structure Validation', () => {
    it('should export all required functions for the 8-step flow', async () => {
      const initModule = await import('../../cli/commands/init');
      
      // Step 1: Directory selection
      expect(typeof initModule.selectInstallationDirectory).toBe('function');
      
      // Step 2: Directory validation  
      expect(typeof initModule.validateInstallationDirectory).toBe('function');
      
      // Step 3: Pod selection
      expect(typeof initModule.getPodInformation).toBe('function');
      
      // Step 4: Tech stack analysis
      expect(typeof initModule.analyzeTechStackWithContext).toBe('function');
      
      // Step 5: GitHub Copilot instructions update
      expect(typeof initModule.updateGitHubCopilotInstructions).toBe('function');
      
      // Steps 6-8 are handled by existing functions (install, update files, exit)
    });
  });

  describe('Step 1: Directory Selection', () => {
    it('should return current directory when current is selected', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({ installChoice: 'current' });
      
      const { selectInstallationDirectory } = await import('../../cli/commands/init');
      
      const result = await selectInstallationDirectory();
      expect(result).toBe(process.cwd());
    });

    it('should return home directory when home is selected', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({ installChoice: 'home' });
      
      const { selectInstallationDirectory } = await import('../../cli/commands/init');
      
      const result = await selectInstallationDirectory();
      expect(result).toBe(os.homedir());
    });

    it('should handle custom path selection', async () => {
      const customPath = '/custom/test/path';
      mockInquirer.prompt
        .mockResolvedValueOnce({ installChoice: 'custom' })
        .mockResolvedValueOnce({ customPath });
      
      const { selectInstallationDirectory } = await import('../../cli/commands/init');
      
      const result = await selectInstallationDirectory();
      expect(result).toBe(path.resolve(customPath));
    });
  });

  describe('Step 2: Directory Validation', () => {
    it('should pass validation for directory with source files', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');
      await fs.writeFile(path.join(testDir, 'index.js'), 'console.log("test");');
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project');
      
      const { validateInstallationDirectory } = await import('../../cli/commands/init');
      
      // Should not throw
      await expect(validateInstallationDirectory(testDir)).resolves.toBeUndefined();
    });

    it('should detect validation requirements', async () => {
      const { validateInstallationDirectory } = await import('../../cli/commands/init');
      
      // The function should exist and be callable
      expect(typeof validateInstallationDirectory).toBe('function');
      
      // Test with empty directory (should fail)
      const emptyDir = path.join(testDir, 'empty');
      await fs.ensureDir(emptyDir);
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('Process exit called');
      }) as never);
      
      try {
        await expect(validateInstallationDirectory(emptyDir)).rejects.toThrow('Process exit called');
      } finally {
        mockExit.mockRestore();
      }
    });
  });

  describe('Step 3: Pod Selection', () => {
    it('should call selectPod and return pod information', async () => {
      const { getPodInformation } = await import('../../cli/commands/init');
      
      const result = await getPodInformation();
      
      expect(result).toEqual({
        name: 'Test Pod',
        id: 'test-pod',
        owner: 'team-test'
      });
    });
  });

  describe('Step 4: Tech Stack Analysis', () => {
    it('should analyze tech stack with pod context', async () => {
      // Create test project files
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: { 'react': '^18.0.0' }
      }));
      
      const mockPodInfo = {
        name: 'Platform - Test',
        id: 'platform-test',
        owner: 'team-platform'
      };
      
      const { analyzeTechStackWithContext } = await import('../../cli/commands/init');
      
      const result = await analyzeTechStackWithContext(testDir, mockPodInfo);
      
      expect(result).toMatchObject({
        stack: 'JavaScript',
        isEmpty: false,
        noTechStack: false,
        pod: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          owner: expect.any(String)
        }),
        repository: expect.objectContaining({
          name: expect.any(String),
          path: expect.any(String)
        })
      });
    });
  });

  describe('Step 5: GitHub Copilot Instructions Update', () => {
    it('should update GitHub Copilot instructions with project info', async () => {
      const mockPodInfo = {
        name: 'GitHub Test Pod',
        id: 'github-test',
        owner: 'team-github'
      };
      
      const mockTechStackData = {
        stack: 'TypeScript',
        primaryStack: 'TypeScript',
        allStacks: ['TypeScript', 'React'],
        frameworks: ['React'],
        buildTools: ['Vite'],
        packageManagers: ['npm'],
        databases: [],
        deployment: [],
        workspacePath: testDir,
        isEmpty: false,
        noTechStack: false,
        pod: {
          id: 'github-test',
          name: 'GitHub Test Pod',
          description: 'Test pod for GitHub integration',
          owner: 'team-github',
          createdAt: new Date().toISOString(),
          repositoryCount: 1
        },
        repository: {
          name: 'github-test-repo',
          path: testDir,
          url: 'https://github.com/test/github-repo',
          branch: 'main',
          lastAnalyzed: new Date().toISOString(),
          isMainRepo: true
        }
      };
      
      const { updateGitHubCopilotInstructions } = await import('../../cli/commands/init');
      
      // Should complete without error
      await expect(updateGitHubCopilotInstructions(testDir, mockPodInfo, mockTechStackData)).resolves.toBeUndefined();
      
      // Should create .github/copilot-instructions.md file
      const instructionsFile = path.join(testDir, '.github', 'copilot-instructions.md');
      expect(await fs.pathExists(instructionsFile)).toBe(true);
      
      // Should contain LCAgents information
      const content = await fs.readFile(instructionsFile, 'utf-8');
      expect(content).toContain('LCAgents Integration');
      expect(content).toContain('GitHub Test Pod');
      expect(content).toContain('TypeScript, React');
      expect(content).toContain('@lcagents activate');
    });
  });

  describe('Shim Creation', () => {
    it('should create a user shim when invoked and return instructions', async () => {
      // Ensure test directory has a dist cli to point at
      const distCli = path.join(testDir, 'dist', 'cli');
      await fs.ensureDir(distCli);
      await fs.writeFile(path.join(distCli, 'index.js'), 'console.log("cli");');

      // Mock home directory to our testDir to avoid touching real user files
      const originalHome = process.env['HOME'] || process.env['USERPROFILE'];
      try {
        if (process.platform === 'win32') {
          process.env['USERPROFILE'] = testDir;
        } else {
          process.env['HOME'] = testDir;
        }

        const { createUserShim } = await import('../../cli/commands/init');
        const result = await createUserShim(testDir);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.message).toMatch(/User shim created/);
        expect(result.instructions).toBeTruthy();

        // Verify shim file exists on disk
        if (process.platform === 'win32') {
          const shimPath = path.join(process.env['USERPROFILE'] || testDir, 'bin', 'lcagent.ps1');
          expect(await fs.pathExists(shimPath)).toBe(true);
        } else {
          const shimPath = path.join(process.env['HOME'] || testDir, '.local', 'bin', 'lcagent');
          expect(await fs.pathExists(shimPath)).toBe(true);
        }
      } finally {
        // restore home env
        if (process.platform === 'win32') {
          process.env['USERPROFILE'] = originalHome;
        } else {
          process.env['HOME'] = originalHome;
        }
      }
    });
  });

  describe('Integration: Complete Flow Validation', () => {
    it('should validate the new 8-step installation flow order', () => {
      // This test validates that we have restructured the flow correctly
      const expectedFlow = [
        'selectInstallationDirectory',     // Step 1: Get directory
        'validateInstallationDirectory',   // Step 2: Validate directory source  
        'getPodInformation',              // Step 3: Get pod name
        'analyzeTechStackWithContext',    // Step 4: Analyze tech stack
        'updateGitHubCopilotInstructions', // Step 5: Update GitHub Copilot instructions
        // Step 6: Install LCAgents (existing in performLayeredInstallation)
        // Step 7: Update files (existing in runtime config updates)
        // Step 8: Exit installation (existing in success message)
      ];
      
      expectedFlow.forEach(functionName => {
        expect(typeof require('../../cli/commands/init')[functionName]).toBe('function');
      });
    });

    it('should maintain separation of concerns', async () => {
      // Each step should be independently testable
      const { 
        selectInstallationDirectory, 
        validateInstallationDirectory, 
        getPodInformation, 
        analyzeTechStackWithContext 
      } = await import('../../cli/commands/init');
      
      // Step 1: Directory selection should not analyze tech stack
      mockInquirer.prompt.mockResolvedValueOnce({ installChoice: 'current' });
      const installPath = await selectInstallationDirectory();
      expect(typeof installPath).toBe('string');
      
      // Step 2: Validation should not select pods
      await fs.writeFile(path.join(testDir, 'test.js'), 'console.log("test");');
      await expect(validateInstallationDirectory(testDir)).resolves.toBeUndefined();
      
      // Step 3: Pod selection should not analyze tech stack
      const podInfo = await getPodInformation();
      expect(podInfo).toHaveProperty('name');
      expect(podInfo).toHaveProperty('id');
      expect(podInfo).toHaveProperty('owner');
      
      // Step 4: Tech stack analysis should receive pod context
      const techStackData = await analyzeTechStackWithContext(installPath, podInfo);
      expect(techStackData).toHaveProperty('pod');
      expect(techStackData).toHaveProperty('repository');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle filesystem errors during validation', async () => {
      const nonExistentPath = '/path/that/does/not/exist';
      const { validateInstallationDirectory } = await import('../../cli/commands/init');
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('Process exit called');
      }) as never);
      
      await expect(validateInstallationDirectory(nonExistentPath))
        .rejects.toThrow('Process exit called');
      
      mockExit.mockRestore();
    });

    it('should provide meaningful function signatures', async () => {
      const module = await import('../../cli/commands/init');
      
      // Validate that functions have expected signatures based on their purposes
      expect(module.selectInstallationDirectory.length).toBe(0); // No parameters
      expect(module.validateInstallationDirectory.length).toBe(1); // Takes installPath
      expect(module.getPodInformation.length).toBe(0); // No parameters  
      expect(module.analyzeTechStackWithContext.length).toBe(2); // Takes installPath and podInfo
    });
  });
});
