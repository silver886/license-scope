import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { DependencyParser, ParsedDependency } from './parser.interface.js';

export class MavenParser implements DependencyParser {
  ecosystem = 'maven';

  async detect(repoPath: string): Promise<boolean> {
    try {
      await access(path.join(repoPath, 'pom.xml'));
      return true;
    } catch {
      // check for build.gradle
    }
    try {
      await access(path.join(repoPath, 'build.gradle'));
      return true;
    } catch {
      return false;
    }
  }

  async parse(repoPath: string): Promise<ParsedDependency[]> {
    // Try pom.xml first
    try {
      const pomPath = path.join(repoPath, 'pom.xml');
      await access(pomPath);
      return await this.parsePomXml(pomPath);
    } catch {
      // not available
    }

    // Try build.gradle
    try {
      const gradlePath = path.join(repoPath, 'build.gradle');
      await access(gradlePath);
      return await this.parseBuildGradle(gradlePath);
    } catch {
      // not available
    }

    return [];
  }

  private async parsePomXml(pomPath: string): Promise<ParsedDependency[]> {
    const { XMLParser } = await import('fast-xml-parser');
    const content = await readFile(pomPath, 'utf-8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (name: string) => name === 'dependency',
    });
    const parsed = parser.parse(content);
    const deps: ParsedDependency[] = [];

    const project = parsed.project;
    if (!project) return deps;

    // Extract properties for variable resolution
    const properties: Record<string, string> = {};
    if (project.properties) {
      for (const [key, value] of Object.entries(project.properties)) {
        if (typeof value === 'string') {
          properties[key] = value;
        }
      }
    }

    const resolveProperty = (value: string | undefined): string => {
      if (!value) return 'unknown';
      const match = value.match(/^\$\{(.+)\}$/);
      if (match && properties[match[1]]) {
        return properties[match[1]];
      }
      return value;
    };

    // Parse dependencies section
    const depSection = project.dependencies;
    if (depSection && depSection.dependency) {
      const depList = Array.isArray(depSection.dependency)
        ? depSection.dependency
        : [depSection.dependency];

      for (const dep of depList) {
        if (dep.groupId && dep.artifactId) {
          const name = `${dep.groupId}:${dep.artifactId}`;
          const version = resolveProperty(dep.version) || 'unknown';
          const scope = dep.scope || 'compile';

          deps.push({
            name,
            version,
            isDirect: true,
            parentName:
              scope === 'test' || scope === 'provided' ? undefined : undefined,
          });
        }
      }
    }

    // Parse dependencyManagement section
    const depMgmt = project.dependencyManagement;
    if (depMgmt && depMgmt.dependencies && depMgmt.dependencies.dependency) {
      const depList = Array.isArray(depMgmt.dependencies.dependency)
        ? depMgmt.dependencies.dependency
        : [depMgmt.dependencies.dependency];

      for (const dep of depList) {
        if (dep.groupId && dep.artifactId) {
          const name = `${dep.groupId}:${dep.artifactId}`;
          const version = resolveProperty(dep.version) || 'unknown';

          // Only add if not already present from dependencies section
          if (!deps.some((d) => d.name === name)) {
            deps.push({
              name,
              version,
              isDirect: false,
            });
          }
        }
      }
    }

    return deps;
  }

  private async parseBuildGradle(
    gradlePath: string
  ): Promise<ParsedDependency[]> {
    const content = await readFile(gradlePath, 'utf-8');
    const deps: ParsedDependency[] = [];
    const seen = new Set<string>();

    // Match patterns like:
    // implementation 'group:artifact:version'
    // compile "group:artifact:version"
    // api 'group:artifact:version'
    // testImplementation 'group:artifact:version'
    // runtimeOnly "group:artifact:version"
    const depRegex =
      /(?:implementation|compile|api|testImplementation|testCompile|runtimeOnly|compileOnly|annotationProcessor)\s+['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;

    while ((match = depRegex.exec(content)) !== null) {
      const parts = match[1].split(':');
      if (parts.length >= 2) {
        const name =
          parts.length >= 3
            ? `${parts[0]}:${parts[1]}`
            : parts[0];
        const version = parts.length >= 3 ? parts[2] : 'unknown';

        if (!seen.has(name)) {
          seen.add(name);
          deps.push({
            name,
            version,
            isDirect: true,
          });
        }
      }
    }

    // Match Kotlin DSL: implementation("group:artifact:version")
    const kotlinRegex =
      /(?:implementation|compile|api|testImplementation|testCompile|runtimeOnly|compileOnly|annotationProcessor)\s*\(\s*["']([^"']+)["']\s*\)/g;

    while ((match = kotlinRegex.exec(content)) !== null) {
      const parts = match[1].split(':');
      if (parts.length >= 2) {
        const name =
          parts.length >= 3
            ? `${parts[0]}:${parts[1]}`
            : parts[0];
        const version = parts.length >= 3 ? parts[2] : 'unknown';

        if (!seen.has(name)) {
          seen.add(name);
          deps.push({
            name,
            version,
            isDirect: true,
          });
        }
      }
    }

    return deps;
  }
}
