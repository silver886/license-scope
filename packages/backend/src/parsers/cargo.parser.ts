import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { DependencyParser, ParsedDependency } from './parser.interface.js';

export class CargoParser implements DependencyParser {
  ecosystem = 'cargo';

  async detect(repoPath: string): Promise<boolean> {
    try {
      await access(path.join(repoPath, 'Cargo.lock'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(repoPath: string): Promise<ParsedDependency[]> {
    const { parse: parseToml } = await import('toml');

    const lockPath = path.join(repoPath, 'Cargo.lock');
    const lockContent = await readFile(lockPath, 'utf-8');
    const lockParsed = parseToml(lockContent);

    if (!lockParsed.package || !Array.isArray(lockParsed.package)) return [];

    // Try to read Cargo.toml to determine direct dependencies
    let directDeps = new Set<string>();
    try {
      const tomlPath = path.join(repoPath, 'Cargo.toml');
      const tomlContent = await readFile(tomlPath, 'utf-8');
      const tomlParsed = parseToml(tomlContent);

      if (tomlParsed.dependencies) {
        for (const name of Object.keys(tomlParsed.dependencies)) {
          directDeps.add(name);
        }
      }
      if (tomlParsed['dev-dependencies']) {
        for (const name of Object.keys(tomlParsed['dev-dependencies'])) {
          directDeps.add(name);
        }
      }
      if (tomlParsed['build-dependencies']) {
        for (const name of Object.keys(tomlParsed['build-dependencies'])) {
          directDeps.add(name);
        }
      }
    } catch {
      // No Cargo.toml, treat all as direct
      directDeps = new Set(
        lockParsed.package.map((p: { name: string }) => p.name)
      );
    }

    const deps: ParsedDependency[] = [];

    for (const pkg of lockParsed.package) {
      if (!pkg.name || !pkg.version) continue;

      // Skip the root package (typically the first one with source undefined)
      // Root package has no source field in Cargo.lock
      if (!pkg.source && deps.length === 0) continue;

      deps.push({
        name: pkg.name,
        version: pkg.version,
        isDirect: directDeps.has(pkg.name),
      });
    }

    return deps;
  }
}
