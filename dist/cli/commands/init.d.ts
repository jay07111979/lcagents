import { Command } from 'commander';
import { TechStackData } from '../../utils/techStacker';
/**
 * Ask user for installation directory
 */
export declare function selectInstallationDirectory(interactive?: boolean): Promise<string>;
/**
 * Validate directory for LCAgents installation
 */
export declare function validateInstallationDirectory(installPath: string): Promise<void>;
/**
 * Get pod information from user
 */
export declare function getPodInformation(interactive?: boolean): Promise<{
    name: string;
    id: string;
    owner: string;
}>;
/**
 * Analyze tech stack and get repository information
 */
export declare function analyzeTechStackWithContext(installPath: string, podInfo: {
    name: string;
    id: string;
    owner: string;
}, interactive?: boolean): Promise<TechStackData>;
/**
 * Update GitHub Copilot instructions with LCAgents information
 */
export declare function updateGitHubCopilotInstructions(installPath: string, podInfo: {
    name: string;
    id: string;
    owner: string;
}, techStackData: TechStackData): Promise<void>;
/**
 * Create a per-user shim that invokes the project's local CLI.
 * Returns an activation instruction string the user can run to make the shim available in the current session.
 */
export declare function createUserShim(installPath: string): Promise<{
    success: boolean;
    message: string;
    instructions?: string;
}>;
export declare const initCommand: Command;
//# sourceMappingURL=init.d.ts.map