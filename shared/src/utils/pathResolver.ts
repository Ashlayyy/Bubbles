import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createConsoleLogger } from './logger.js';

const logger = createConsoleLogger('PathResolver');

/**
 * Centralized path resolution utility for consistent path handling across the codebase
 * Eliminates issues with relative paths, working directory dependencies, and ES module __dirname
 */
export class PathResolver {
	/**
	 * Get the directory name from import.meta.url (ES module equivalent of __dirname)
	 * Use this instead of manually calculating __dirname
	 */
	static getDirname(importMetaUrl: string): string {
		return dirname(fileURLToPath(importMetaUrl));
	}

	/**
	 * Get the filename from import.meta.url (ES module equivalent of __filename)
	 */
	static getFilename(importMetaUrl: string): string {
		return fileURLToPath(importMetaUrl);
	}

	/**
	 * Resolve a path relative to a module's directory
	 * @param importMetaUrl - import.meta.url from the calling module
	 * @param relativePath - path relative to the calling module
	 */
	static resolveFromModule(
		importMetaUrl: string,
		relativePath: string
	): string {
		const moduleDir = this.getDirname(importMetaUrl);
		return resolve(moduleDir, relativePath);
	}

	/**
	 * Find the project root directory by looking for package.json
	 * Starts from the given directory and walks up the tree
	 */
	static findProjectRoot(startDir?: string): string {
		let currentDir = startDir || process.cwd();
		logger.debug(
			`🔍 PathResolver: Searching for project root starting from: ${currentDir}`
		);

		while (currentDir !== dirname(currentDir)) {
			logger.debug(`🔍 PathResolver: Checking directory: ${currentDir}`);

			if (existsSync(join(currentDir, 'package.json'))) {
				logger.debug(`📦 PathResolver: Found package.json in: ${currentDir}`);

				// Check if this is the monorepo root (has multiple package.json files in subdirs)
				const hasMultipleProjects = ['bot', 'api', 'frontend', 'shared'].some(
					(subdir) => {
						const hasSubProject = existsSync(
							join(currentDir, subdir, 'package.json')
						);
						if (hasSubProject) {
							logger.debug(`📦 PathResolver: Found sub-project: ${subdir}`);
						}
						return hasSubProject;
					}
				);

				if (hasMultipleProjects) {
					logger.debug(`✅ PathResolver: Found monorepo root: ${currentDir}`);
					return currentDir;
				} else {
					logger.debug(
						`⚠️ PathResolver: Not a monorepo root (no sub-projects found)`
					);
				}
			}
			currentDir = dirname(currentDir);
		}

		logger.error(
			`❌ PathResolver: Could not find project root starting from: ${
				startDir || process.cwd()
			}`
		);
		throw new Error(
			'Could not find project root - no package.json found in directory tree'
		);
	}

	/**
	 * Get the project root relative to a module
	 */
	static getProjectRootFromModule(importMetaUrl: string): string {
		const moduleDir = this.getDirname(importMetaUrl);
		return this.findProjectRoot(moduleDir);
	}

	/**
	 * Resolve paths for different environments (dev vs prod)
	 * Eliminates hardcoded environment-specific path logic
	 */
	static resolveForEnvironment(options: {
		devPath: string;
		prodPath: string;
		isDevMode: boolean;
		baseDir: string;
	}): string {
		const targetPath = options.isDevMode ? options.devPath : options.prodPath;
		const resolvedPath = resolve(options.baseDir, targetPath);

		logger.debug(`🎯 PathResolver: Environment resolution:`, {
			isDevMode: options.isDevMode,
			baseDir: options.baseDir,
			devPath: options.devPath,
			prodPath: options.prodPath,
			selectedPath: targetPath,
			resolvedPath,
		});

		return resolvedPath;
	}

	/**
	 * Get paths to common directories in the monorepo
	 */
	static getCommonPaths(importMetaUrl: string) {
		logger.debug(
			`🗺️ PathResolver: Getting common paths for module: ${importMetaUrl}`
		);
		const projectRoot = this.getProjectRootFromModule(importMetaUrl);

		const paths = {
			projectRoot,
			botRoot: join(projectRoot, 'bot'),
			apiRoot: join(projectRoot, 'api'),
			frontendRoot: join(projectRoot, 'frontend'),
			sharedRoot: join(projectRoot, 'shared'),
			botSrc: join(projectRoot, 'bot', 'src'),
			botBuild: join(projectRoot, 'bot', 'build'),
			envFile: join(projectRoot, '.env'),
			docsRoot: join(projectRoot, 'documentation'),
		};

		logger.debug(`🗺️ PathResolver: Resolved common paths:`, {
			projectRoot: paths.projectRoot,
			botRoot: paths.botRoot,
			botSrc: paths.botSrc,
			botBuild: paths.botBuild,
		});

		return paths;
	}

	/**
	 * Normalize path separators for cross-platform compatibility
	 * Converts backslashes to forward slashes for ES module imports
	 */
	static normalizeForImport(path: string): string {
		return path.replace(/\\/g, '/');
	}

	/**
	 * Check if a path exists and is accessible
	 */
	static pathExists(path: string): boolean {
		return existsSync(path);
	}

	/**
	 * Validate that required paths exist, throw helpful error if not
	 */
	static validateRequiredPaths(paths: Record<string, string>): void {
		const missing: string[] = [];

		for (const [name, path] of Object.entries(paths)) {
			if (!this.pathExists(path)) {
				missing.push(`${name}: ${path}`);
			}
		}

		if (missing.length > 0) {
			throw new Error(`Required paths do not exist:\n${missing.join('\n')}`);
		}
	}
}

/**
 * Convenience function to get __dirname equivalent in ES modules
 * Usage: const __dirname = getESMDirname(import.meta.url);
 */
export function getESMDirname(importMetaUrl: string): string {
	return PathResolver.getDirname(importMetaUrl);
}

/**
 * Convenience function to get __filename equivalent in ES modules
 * Usage: const __filename = getESMFilename(import.meta.url);
 */
export function getESMFilename(importMetaUrl: string): string {
	return PathResolver.getFilename(importMetaUrl);
}
