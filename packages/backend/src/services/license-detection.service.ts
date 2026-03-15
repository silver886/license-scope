import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../db/schema.js';
import { normalizeLicense } from '../license-data/license-aliases.js';

interface LicenseResult {
  spdx: string;
  raw: string;
  registryUrl: string;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}

export class LicenseDetectionService {
  private db: Kysely<DatabaseSchema>;
  private semaphore: Semaphore;

  constructor(db: Kysely<DatabaseSchema>) {
    this.db = db;
    this.semaphore = new Semaphore(10);
  }

  async detectLicense(
    ecosystem: string,
    name: string,
    version: string
  ): Promise<LicenseResult> {
    // Check cache first
    const cached = await this.db
      .selectFrom('license_cache')
      .selectAll()
      .where('ecosystem', '=', ecosystem)
      .where('name', '=', name)
      .where('version', '=', version)
      .executeTakeFirst();

    if (cached && cached.license_spdx !== 'Unknown') {
      return {
        spdx: cached.license_spdx,
        raw: cached.license_spdx,
        registryUrl: this.getRegistryUrl(ecosystem, name, version),
      };
    }

    // Fetch from registry with concurrency limiting
    await this.semaphore.acquire();
    try {
      const result = await this.fetchFromRegistry(ecosystem, name, version);
      const spdx = normalizeLicense(result.raw);

      // Cache the result
      try {
        await this.db
          .insertInto('license_cache')
          .values({
            ecosystem,
            name,
            version,
            license_spdx: spdx,
          })
          .onConflict((oc) =>
            oc
              .columns(['ecosystem', 'name', 'version'])
              .doUpdateSet({ license_spdx: spdx })
          )
          .execute();
      } catch {
        // Ignore cache insertion errors (race conditions, etc.)
      }

      return {
        spdx,
        raw: result.raw,
        registryUrl: result.registryUrl,
      };
    } finally {
      this.semaphore.release();
    }
  }

  private async fetchFromRegistry(
    ecosystem: string,
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    let result: { raw: string; registryUrl: string };
    switch (ecosystem) {
      case 'npm':
        result = await this.fetchNpmLicense(name, version);
        break;
      case 'pip':
        result = await this.fetchPipLicense(name, version);
        break;
      case 'cargo':
        result = await this.fetchCargoLicense(name, version);
        break;
      case 'go':
        result = await this.fetchGoLicense(name, version);
        break;
      case 'maven':
        result = await this.fetchMavenLicense(name, version);
        break;
      default:
        return { raw: 'Unknown', registryUrl: '' };
    }

    // Universal fallback: deps.dev API (Go and Maven already use this internally)
    if (result.raw === 'Unknown' && ecosystem !== 'go' && ecosystem !== 'maven') {
      const depsDevSystem = ecosystem === 'pip' ? 'pypi' : ecosystem;
      const license = await this.fetchDepsDevLicense(depsDevSystem, name, version);
      if (license) {
        return { raw: license, registryUrl: result.registryUrl };
      }
    }

    return result;
  }

  private async fetchDepsDevLicense(
    system: string,
    name: string,
    version: string
  ): Promise<string | null> {
    const encoded = encodeURIComponent(name);
    const headers = { 'User-Agent': 'LicenseScope/1.0' };
    for (const url of [
      `https://api.deps.dev/v3alpha/systems/${system}/packages/${encoded}/versions/${encodeURIComponent(version)}`,
      `https://api.deps.dev/v3alpha/systems/${system}/packages/${encoded}`,
    ]) {
      try {
        const response = await fetch(url, { headers });
        if (response.ok) {
          const data = (await response.json()) as {
            licenses?: string[];
            versions?: Array<{ versionKey?: { version?: string }; licenses?: string[] }>;
          };
          const licenses = data.licenses ??
            data.versions?.find((v) => v.versionKey?.version === version)?.licenses ??
            data.versions?.[0]?.licenses;
          if (licenses && licenses.length > 0) {
            return licenses.join(' AND ');
          }
        }
      } catch {
        // try next
      }
    }
    return null;
  }

  private extractRepoUrl(data: Record<string, unknown>): string | undefined {
    if (typeof data.repository === 'string') return data.repository;
    if (data.repository && typeof data.repository === 'object') {
      const repo = data.repository as { url?: string };
      if (typeof repo.url === 'string') return repo.url;
    }
    return undefined;
  }

  private extractNpmLicense(data: Record<string, unknown>): string {
    if (typeof data.license === 'string') {
      return data.license;
    }
    if (
      data.license &&
      typeof data.license === 'object' &&
      'type' in data.license &&
      typeof (data.license as { type: unknown }).type === 'string'
    ) {
      return (data.license as { type: string }).type;
    }
    return 'Unknown';
  }

  private async fetchNpmLicense(
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    const encoded = encodeURIComponent(name);
    const versionedUrl = `https://registry.npmjs.org/${encoded}/${version}`;
    let repoUrl: string | undefined;
    try {
      const response = await fetch(versionedUrl);
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const license = this.extractNpmLicense(data);
        if (license !== 'Unknown') {
          return { raw: license, registryUrl: versionedUrl };
        }
        repoUrl = this.extractRepoUrl(data);
      }

      // Fallback: fetch general package info
      const fallbackUrl = `https://registry.npmjs.org/${encoded}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const pkg = (await fallbackRes.json()) as Record<string, unknown>;
        // Try version-specific data within the full package document
        const versions = pkg.versions as Record<string, Record<string, unknown>> | undefined;
        if (versions && versions[version]) {
          const license = this.extractNpmLicense(versions[version]);
          if (license !== 'Unknown') {
            return { raw: license, registryUrl: fallbackUrl };
          }
          if (!repoUrl) repoUrl = this.extractRepoUrl(versions[version]);
        }
        // Fall back to top-level license
        const license = this.extractNpmLicense(pkg);
        if (license !== 'Unknown') {
          return { raw: license, registryUrl: fallbackUrl };
        }
        if (!repoUrl) repoUrl = this.extractRepoUrl(pkg);
      }

      // Final fallback: check GitHub repo license
      if (repoUrl) {
        const ghMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        if (ghMatch) {
          const result = await this.fetchGitHubLicense(ghMatch[1], ghMatch[2]);
          if (result) return { raw: result, registryUrl: versionedUrl };
        }
      }

      return { raw: 'Unknown', registryUrl: versionedUrl };
    } catch {
      return { raw: 'Unknown', registryUrl: versionedUrl };
    }
  }

  private async fetchPipLicense(
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    const encoded = encodeURIComponent(name);
    const versionedUrl = `https://pypi.org/pypi/${encoded}/${version}/json`;
    let projectUrl: string | undefined;
    try {
      const response = await fetch(versionedUrl);
      if (response.ok) {
        const data = (await response.json()) as {
          info?: { license?: string; project_urls?: Record<string, string>; home_page?: string };
        };
        const license = data.info?.license;
        if (license && license !== 'Unknown') {
          return { raw: license, registryUrl: versionedUrl };
        }
        projectUrl = data.info?.project_urls?.['Source'] || data.info?.project_urls?.['Homepage'] || data.info?.home_page;
      }

      // Fallback: fetch general package info (latest version)
      const fallbackUrl = `https://pypi.org/pypi/${encoded}/json`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const data = (await fallbackRes.json()) as {
          info?: { license?: string; project_urls?: Record<string, string>; home_page?: string };
        };
        const license = data.info?.license;
        if (license && license !== 'Unknown') {
          return { raw: license, registryUrl: fallbackUrl };
        }
        if (!projectUrl) {
          projectUrl = data.info?.project_urls?.['Source'] || data.info?.project_urls?.['Homepage'] || data.info?.home_page;
        }
      }

      // Final fallback: check GitHub repo license
      if (projectUrl) {
        const ghMatch = projectUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        if (ghMatch) {
          const result = await this.fetchGitHubLicense(ghMatch[1], ghMatch[2]);
          if (result) return { raw: result, registryUrl: versionedUrl };
        }
      }

      return { raw: 'Unknown', registryUrl: versionedUrl };
    } catch {
      return { raw: 'Unknown', registryUrl: versionedUrl };
    }
  }

  private async fetchCargoLicense(
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    const encoded = encodeURIComponent(name);
    const headers = { 'User-Agent': 'LicenseScope/1.0' };
    const versionedUrl = `https://crates.io/api/v1/crates/${encoded}/${version}`;
    let repoUrl: string | undefined;
    try {
      const response = await fetch(versionedUrl, { headers });
      if (response.ok) {
        const data = (await response.json()) as {
          version?: { license?: string };
        };
        const license = data.version?.license;
        if (license && license !== 'Unknown') {
          return { raw: license, registryUrl: versionedUrl };
        }
      }

      // Fallback: fetch general crate info
      const fallbackUrl = `https://crates.io/api/v1/crates/${encoded}`;
      const fallbackRes = await fetch(fallbackUrl, { headers });
      if (fallbackRes.ok) {
        const data = (await fallbackRes.json()) as {
          crate?: { license?: string; repository?: string };
          versions?: Array<{ license?: string }>;
        };
        const license = data.crate?.license || data.versions?.[0]?.license;
        if (license && license !== 'Unknown') {
          return { raw: license, registryUrl: fallbackUrl };
        }
        repoUrl = data.crate?.repository;
      }

      // Final fallback: check GitHub repo license
      if (repoUrl) {
        const ghMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        if (ghMatch) {
          const result = await this.fetchGitHubLicense(ghMatch[1], ghMatch[2]);
          if (result) return { raw: result, registryUrl: versionedUrl };
        }
      }

      return { raw: 'Unknown', registryUrl: versionedUrl };
    } catch {
      return { raw: 'Unknown', registryUrl: versionedUrl };
    }
  }

  private async fetchGoLicense(
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    const registryUrl = `https://pkg.go.dev/${name}@${version}`;

    // Strategy 1: deps.dev API — works for all Go modules
    const encoded = encodeURIComponent(name);
    const headers = { 'User-Agent': 'LicenseScope/1.0' };
    // Try versioned first, then fall back to unversioned
    for (const url of [
      `https://api.deps.dev/v3alpha/systems/go/packages/${encoded}/versions/${encodeURIComponent(version)}`,
      `https://api.deps.dev/v3alpha/systems/go/packages/${encoded}`,
    ]) {
      try {
        const response = await fetch(url, { headers });
        if (response.ok) {
          const data = (await response.json()) as {
            licenses?: string[];
            versions?: Array<{ versionKey?: { version?: string }; licenses?: string[] }>;
          };
          const licenses = data.licenses ??
            data.versions?.find((v) => v.versionKey?.version === version)?.licenses ??
            data.versions?.[0]?.licenses;
          if (licenses && licenses.length > 0) {
            const license = licenses.join(' AND ');
            return { raw: license, registryUrl };
          }
        }
      } catch {
        // try next strategy
      }
    }

    // Strategy 2: For github.com modules, use the GitHub license API
    const ghMatch = name.match(/^github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) {
      const result = await this.fetchGitHubLicense(ghMatch[1], ghMatch[2]);
      if (result) return { raw: result, registryUrl };
    }

    // Strategy 3: golang.org/x/* → github.com/golang/*
    const golangMatch = name.match(/^golang\.org\/x\/([^/]+)/);
    if (golangMatch) {
      const result = await this.fetchGitHubLicense('golang', golangMatch[1]);
      if (result) return { raw: result, registryUrl };
    }

    return { raw: 'Unknown', registryUrl };
  }

  private async fetchGitHubLicense(
    owner: string,
    repo: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/license`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'LicenseScope/1.0',
          },
        }
      );
      if (response.ok) {
        const data = (await response.json()) as {
          license?: { spdx_id?: string; name?: string };
          content?: string;
          encoding?: string;
        };
        const spdxId = data.license?.spdx_id;
        if (spdxId && spdxId !== 'NOASSERTION') return spdxId;

        // If GitHub couldn't identify the license, try to detect from content
        if (data.content && data.encoding === 'base64') {
          const text = Buffer.from(data.content, 'base64').toString('utf-8');
          const detected = this.detectLicenseFromText(text);
          if (detected) return detected;
        }

        const name = data.license?.name;
        if (name && name !== 'Other') return name;
      }
    } catch {
      // GitHub API failed
    }
    return null;
  }

  private detectLicenseFromText(text: string): string | null {
    const lower = text.toLowerCase();

    // Check for explicit license name mentions
    if (/\bmit license\b/.test(lower) || /\bpermission is hereby granted, free of charge\b/.test(lower)) {
      return 'MIT';
    }
    if (/\bapache license,?\s*version\s*2/i.test(text)) {
      return 'Apache-2.0';
    }
    if (/\bthe 3-clause bsd license\b/.test(lower) || /\bredistribution and use in source and binary forms\b/.test(lower) && /\bneither the name\b/.test(lower)) {
      return 'BSD-3-Clause';
    }
    if (/\bredistribution and use in source and binary forms\b/.test(lower) && !/\bneither the name\b/.test(lower)) {
      return 'BSD-2-Clause';
    }
    if (/\bisc license\b/.test(lower) || /\bpermission to use, copy, modify, and\/or distribute\b/.test(lower)) {
      return 'ISC';
    }
    if (/\bgnu general public license\b/.test(lower)) {
      if (/\bversion 3\b/.test(lower)) return 'GPL-3.0-only';
      if (/\bversion 2\b/.test(lower)) return 'GPL-2.0-only';
    }
    if (/\bgnu lesser general public license\b/.test(lower)) {
      if (/\bversion 3\b/.test(lower)) return 'LGPL-3.0-only';
      if (/\bversion 2\.1\b/.test(lower)) return 'LGPL-2.1-only';
    }
    if (/\bgnu affero general public license\b/.test(lower)) {
      return 'AGPL-3.0-only';
    }
    if (/\bmozilla public license\s*(,?\s*v\.?\s*2|version\s*2)/i.test(text)) {
      return 'MPL-2.0';
    }
    if (/\bunlicense\b/.test(lower) || /\bthis is free and unencumbered software\b/.test(lower)) {
      return 'Unlicense';
    }
    if (/\bcc0\b/.test(lower) || /\bcreative commons.{0,20}cc0\b/i.test(text)) {
      return 'CC0-1.0';
    }
    if (/\bdo what the fuck you want to\b/.test(lower)) {
      return 'WTFPL';
    }
    if (/\bboost software license/i.test(text)) {
      return 'BSL-1.0';
    }
    if (/\bzlib license\b/i.test(text)) {
      return 'Zlib';
    }

    return null;
  }

  private async fetchMavenLicense(
    name: string,
    version: string
  ): Promise<{ raw: string; registryUrl: string }> {
    const registryUrl = `https://search.maven.org/artifact/${name.replace(':', '/')}/${version}`;

    const [groupId, artifactId] = name.includes(':')
      ? name.split(':')
      : [name, ''];

    // Strategy 1: deps.dev API (versioned, then unversioned fallback)
    if (groupId && artifactId) {
      const encoded = encodeURIComponent(`${groupId}:${artifactId}`);
      const headers = { 'User-Agent': 'LicenseScope/1.0' };
      for (const url of [
        `https://api.deps.dev/v3alpha/systems/maven/packages/${encoded}/versions/${encodeURIComponent(version)}`,
        `https://api.deps.dev/v3alpha/systems/maven/packages/${encoded}`,
      ]) {
        try {
          const response = await fetch(url, { headers });
          if (response.ok) {
            const data = (await response.json()) as {
              licenses?: string[];
              versions?: Array<{ versionKey?: { version?: string }; licenses?: string[] }>;
            };
            const licenses = data.licenses ??
              data.versions?.find((v) => v.versionKey?.version === version)?.licenses ??
              data.versions?.[0]?.licenses;
            if (licenses && licenses.length > 0) {
              return { raw: licenses.join(' AND '), registryUrl };
            }
          }
        } catch {
          // try next strategy
        }
      }
    }

    // Strategy 2: Parse POM XML from Maven Central
    if (groupId && artifactId) {
      try {
        const groupPath = groupId.replace(/\./g, '/');
        const pomUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
        const response = await fetch(pomUrl, {
          headers: { 'User-Agent': 'LicenseScope/1.0' },
        });
        if (response.ok) {
          const pom = await response.text();
          const licenseMatch = pom.match(
            /<licenses>\s*<license>\s*<name>\s*([^<]+?)\s*<\/name>/s
          );
          if (licenseMatch) {
            return { raw: licenseMatch[1], registryUrl };
          }
        }
      } catch {
        // POM fetch failed
      }
    }

    return { raw: 'Unknown', registryUrl };
  }

  private getRegistryUrl(
    ecosystem: string,
    name: string,
    version: string
  ): string {
    switch (ecosystem) {
      case 'npm':
        return `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
      case 'pip':
        return `https://pypi.org/pypi/${encodeURIComponent(name)}/${version}/json`;
      case 'cargo':
        return `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${version}`;
      case 'go':
        return `https://pkg.go.dev/${name}@${version}`;
      case 'maven':
        return `https://search.maven.org/artifact/${name.replace(':', '/')}/${version}`;
      default:
        return '';
    }
  }
}
