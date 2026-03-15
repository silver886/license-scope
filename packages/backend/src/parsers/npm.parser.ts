import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { DependencyParser, ParsedDependency } from './parser.interface.js';

export class NpmParser implements DependencyParser {
  ecosystem = 'npm';

  async detect(repoPath: string): Promise<boolean> {
    const files = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
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
    // Try package-lock.json first
    try {
      const lockPath = path.join(repoPath, 'package-lock.json');
      await access(lockPath);
      return await this.parsePackageLock(repoPath, lockPath);
    } catch {
      // not available
    }

    // Try yarn.lock
    try {
      const yarnPath = path.join(repoPath, 'yarn.lock');
      await access(yarnPath);
      return await this.parseYarnLock(yarnPath);
    } catch {
      // not available
    }

    // Try pnpm-lock.yaml
    try {
      const pnpmPath = path.join(repoPath, 'pnpm-lock.yaml');
      await access(pnpmPath);
      return await this.parsePnpmLock(pnpmPath);
    } catch {
      // not available
    }

    return [];
  }

  private async parsePackageLock(
    repoPath: string,
    lockPath: string
  ): Promise<ParsedDependency[]> {
    const lockContent = JSON.parse(await readFile(lockPath, 'utf-8'));
    const deps: ParsedDependency[] = [];

    // Read root package.json for direct dependency detection
    let directDeps = new Set<string>();
    try {
      const pkgPath = path.join(repoPath, 'package.json');
      const pkgContent = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDirect = {
        ...pkgContent.dependencies,
        ...pkgContent.devDependencies,
      };
      directDeps = new Set(Object.keys(allDirect));
    } catch {
      // no package.json, treat all as direct
    }

    // lockfileVersion 2/3 uses "packages" field
    if (lockContent.packages) {
      for (const [pkgPath, pkgInfo] of Object.entries(
        lockContent.packages as Record<string, { version?: string; dev?: boolean }>
      )) {
        // Skip root package (empty string key)
        if (pkgPath === '') continue;

        // Extract package name from the path
        // node_modules/package-name or node_modules/@scope/package-name
        const parts = pkgPath.split('node_modules/');
        const name = parts[parts.length - 1];

        if (!name || !pkgInfo.version) continue;

        deps.push({
          name,
          version: pkgInfo.version,
          isDirect: directDeps.has(name),
        });
      }
    } else if (lockContent.dependencies) {
      // lockfileVersion 1 uses "dependencies" field
      this.parseLockV1Dependencies(
        lockContent.dependencies,
        directDeps,
        deps
      );
    }

    return deps;
  }

  private parseLockV1Dependencies(
    dependencies: Record<string, { version: string; dependencies?: Record<string, unknown> }>,
    directDeps: Set<string>,
    result: ParsedDependency[]
  ): void {
    for (const [name, info] of Object.entries(dependencies)) {
      result.push({
        name,
        version: info.version,
        isDirect: directDeps.has(name),
      });

      if (info.dependencies) {
        this.parseLockV1Dependencies(
          info.dependencies as Record<string, { version: string; dependencies?: Record<string, unknown> }>,
          directDeps,
          result
        );
      }
    }
  }

  private async parseYarnLock(lockPath: string): Promise<ParsedDependency[]> {
    const content = await readFile(lockPath, 'utf-8');
    const deps: ParsedDependency[] = [];

    // Simple regex parsing of yarn.lock v1 format
    // Pattern: "name@version" or name@version:
    const blockRegex = /^["']?(.+?)@[^"'\n:]+["']?:\s*\n\s+version\s+"([^"]+)"/gm;
    let match: RegExpExecArray | null;

    const seen = new Set<string>();

    while ((match = blockRegex.exec(content)) !== null) {
      const name = match[1];
      const version = match[2];
      const key = `${name}@${version}`;

      if (!seen.has(key)) {
        seen.add(key);
        deps.push({
          name,
          version,
          isDirect: true, // Without package.json cross-ref, treat all as direct
        });
      }
    }

    return deps;
  }

  private async parsePnpmLock(lockPath: string): Promise<ParsedDependency[]> {
    const { parse: parseYaml } = await import('yaml');
    const content = await readFile(lockPath, 'utf-8');
    const parsed = parseYaml(content);
    const deps: ParsedDependency[] = [];

    if (!parsed || !parsed.packages) return deps;

    for (const [pkgPath] of Object.entries(
      parsed.packages as Record<string, Record<string, unknown>>
    )) {
      // pnpm lock format: /package-name@version or /@scope/package-name@version
      const match = pkgPath.match(/^\/?(.+)@(\d[^@]*)$/);
      if (match) {
        const name = match[1].startsWith('/') ? match[1].slice(1) : match[1];
        const version = match[2];

        deps.push({
          name,
          version,
          isDirect: true, // Simplified: treat all as direct
        });
      }
    }

    return deps;
  }
}
