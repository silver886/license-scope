import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export type AnalysisStatus =
  | 'queued'
  | 'cloning'
  | 'parsing'
  | 'resolving_licenses'
  | 'complete'
  | 'failed';

export type LicenseCategory =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'unknown';

export interface AnalysisResult {
  id: string;
  repoUrl: string;
  commitSha: string | null;
  status: AnalysisStatus;
  progress: number;
  ecosystems: string[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  dependencies: Dependency[];
  compatibleLicenses: CompatibleLicense[];
}

export interface Dependency {
  id: string;
  name: string;
  version: string;
  ecosystem: string;
  licenseSpdx: string | null;
  licenseRaw: string | null;
  licenseCategory: LicenseCategory;
  isDirect: boolean;
  parentDepId: string | null;
  registryUrl: string | null;
}

export interface CompatibleLicense {
  id: string;
  licenseSpdx: string;
  isCompatible: boolean;
  reason: string;
}

export interface DependencyDetail extends Dependency {
  transitiveDeps: Dependency[];
}

export async function submitAnalysis(
  repoUrl: string,
  ref?: string,
): Promise<{ analysisId: string; status: string }> {
  const { data } = await api.post('/analyze', { repoUrl, ref });
  return data;
}

export async function getAnalysis(id: string): Promise<AnalysisResult> {
  const { data } = await api.get(`/analysis/${id}`);
  return data;
}

export async function getDependencyDetail(
  analysisId: string,
  depId: string,
): Promise<DependencyDetail> {
  const { data } = await api.get(
    `/analysis/${analysisId}/dependency/${depId}`,
  );
  return data;
}
