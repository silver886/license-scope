import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { DependencyParser, ParsedDependency } from './parser.interface.js';

export class GoParser implements DependencyParser {
  ecosystem = 'go';

  async detect(repoPath: string): Promise<boolean> {
    try {
      await access(path.join(repoPath, 'go.mod'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(repoPath: string): Promise<ParsedDependency[]> {
    const modPath = path.join(repoPath, 'go.mod');
    const content = await readFile(modPath, 'utf-8');
    const deps: ParsedDependency[] = [];

    const lines = content.split('\n');
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Single-line require: require module/path v1.2.3
      if (trimmed.startsWith('require ') && !trimmed.includes('(')) {
        const match = trimmed.match(
          /^require\s+(\S+)\s+(v\S+)/
        );
        if (match) {
          const isIndirect = trimmed.includes('// indirect');
          deps.push({
            name: match[1],
            version: match[2],
            isDirect: !isIndirect,
          });
        }
        continue;
      }

      // Multi-line require block
      if (trimmed === 'require (') {
        inRequireBlock = true;
        continue;
      }

      if (trimmed === ')') {
        inRequireBlock = false;
        continue;
      }

      if (inRequireBlock) {
        const match = trimmed.match(/^(\S+)\s+(v\S+)/);
        if (match) {
          const isIndirect = trimmed.includes('// indirect');
          deps.push({
            name: match[1],
            version: match[2],
            isDirect: !isIndirect,
          });
        }
      }
    }

    return deps;
  }
}
