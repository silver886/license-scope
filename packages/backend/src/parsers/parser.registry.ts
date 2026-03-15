import { DependencyParser } from './parser.interface.js';
import { NpmParser } from './npm.parser.js';
import { PipParser } from './pip.parser.js';
import { CargoParser } from './cargo.parser.js';
import { GoParser } from './go.parser.js';
import { MavenParser } from './maven.parser.js';

const ALL_PARSERS: DependencyParser[] = [
  new NpmParser(),
  new PipParser(),
  new CargoParser(),
  new GoParser(),
  new MavenParser(),
];

export async function detectEcosystems(repoPath: string): Promise<DependencyParser[]> {
  const results = await Promise.all(
    ALL_PARSERS.map(async (p) => ({ parser: p, detected: await p.detect(repoPath) }))
  );
  return results.filter(r => r.detected).map(r => r.parser);
}
