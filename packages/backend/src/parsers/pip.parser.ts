import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { DependencyParser, ParsedDependency } from './parser.interface.js';

export class PipParser implements DependencyParser {
  ecosystem = 'pip';

  async detect(repoPath: string): Promise<boolean> {
    const files = ['poetry.lock', 'Pipfile.lock', 'requirements.txt'];
    for (const file of files) {
      try {
        await access(path.join(repoPath, file));
        return true;
      } catch {
        // file not found, continue
      }
    }
    return false;
  }

  async parse(repoPath: string): Promise<ParsedDependency[]> {
    // Try poetry.lock first
    try {
      const poetryPath = path.join(repoPath, 'poetry.lock');
      await access(poetryPath);
      return await this.parsePoetryLock(poetryPath);
    } catch {
      // not available
    }

    // Try Pipfile.lock
    try {
      const pipfilePath = path.join(repoPath, 'Pipfile.lock');
      await access(pipfilePath);
      return await this.parsePipfileLock(pipfilePath);
    } catch {
      // not available
    }

    // Try requirements.txt
    try {
      const reqPath = path.join(repoPath, 'requirements.txt');
      await access(reqPath);
      return await this.parseRequirementsTxt(reqPath);
    } catch {
      // not available
    }

    return [];
  }

  private async parsePoetryLock(lockPath: string): Promise<ParsedDependency[]> {
    const { parse: parseToml } = await import('toml');
    const content = await readFile(lockPath, 'utf-8');
    const parsed = parseToml(content);
    const deps: ParsedDependency[] = [];

    if (!parsed.package || !Array.isArray(parsed.package)) return deps;

    for (const pkg of parsed.package) {
      if (pkg.name && pkg.version) {
        deps.push({
          name: pkg.name,
          version: pkg.version,
          isDirect: pkg.category === 'main' || pkg.category === undefined,
        });
      }
    }

    return deps;
  }

  private async parsePipfileLock(lockPath: string): Promise<ParsedDependency[]> {
    const content = JSON.parse(await readFile(lockPath, 'utf-8'));
    const deps: ParsedDependency[] = [];

    const sections: Array<{ key: string; isDirect: boolean }> = [
      { key: 'default', isDirect: true },
      { key: 'develop', isDirect: false },
    ];

    for (const section of sections) {
      const packages = content[section.key];
      if (!packages) continue;

      for (const [name, info] of Object.entries(
        packages as Record<string, { version?: string }>
      )) {
        const version = info.version
          ? info.version.replace(/^==/, '')
          : 'unknown';

        deps.push({
          name,
          version,
          isDirect: section.isDirect,
        });
      }
    }

    return deps;
  }

  private async parseRequirementsTxt(
    reqPath: string
  ): Promise<ParsedDependency[]> {
    const content = await readFile(reqPath, 'utf-8');
    const deps: ParsedDependency[] = [];

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, comments, and options
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        continue;
      }

      // Match package==version pattern
      const exactMatch = trimmed.match(
        /^([a-zA-Z0-9_.-]+)\s*==\s*([a-zA-Z0-9_.*+-]+)/
      );
      if (exactMatch) {
        deps.push({
          name: exactMatch[1],
          version: exactMatch[2],
          isDirect: true,
        });
        continue;
      }

      // Match package>=version pattern (take the minimum version)
      const minMatch = trimmed.match(
        /^([a-zA-Z0-9_.-]+)\s*>=\s*([a-zA-Z0-9_.*+-]+)/
      );
      if (minMatch) {
        deps.push({
          name: minMatch[1],
          version: minMatch[2],
          isDirect: true,
        });
        continue;
      }

      // Match bare package name (no version specified)
      const bareMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*$/);
      if (bareMatch) {
        deps.push({
          name: bareMatch[1],
          version: 'latest',
          isDirect: true,
        });
      }
    }

    return deps;
  }
}
