import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDependencyDetail } from '../api/client';
import LicenseBadge from '../components/LicenseBadge';
import DependencyTree from '../components/DependencyTree';

export default function DependencyDetailPage() {
  const { id: analysisId, depId } = useParams<{
    id: string;
    depId: string;
  }>();
  const navigate = useNavigate();

  const { data: dep, error, isLoading } = useQuery({
    queryKey: ['dependency', analysisId, depId],
    queryFn: () => getDependencyDetail(analysisId!, depId!),
    enabled: !!analysisId && !!depId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !dep) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-red-700 mb-2">
          Dependency Not Found
        </h2>
        <p className="text-slate-600 mb-6">
          Could not load the dependency details.
        </p>
        <button
          onClick={() => navigate(`/analysis/${analysisId}`)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          Back to Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => navigate(`/analysis/${analysisId}`)}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 font-medium"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Analysis
      </button>

      {/* Dependency Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              {dep.name}
            </h1>
            <span className="text-sm font-mono text-slate-500">
              v{dep.version}
            </span>
          </div>
          <LicenseBadge
            category={dep.licenseCategory}
            licenseSpdx={dep.licenseSpdx}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Ecosystem
            </span>
            <span className="text-sm text-slate-800 capitalize">
              {dep.ecosystem}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              License (SPDX)
            </span>
            <span className="text-sm font-mono text-slate-800">
              {dep.licenseSpdx || 'N/A'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              License (Raw)
            </span>
            <span className="text-sm text-slate-800">
              {dep.licenseRaw || 'N/A'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Type
            </span>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                dep.isDirect
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {dep.isDirect ? 'Direct' : 'Transitive'}
            </span>
          </div>
        </div>

        {dep.registryUrl && (
          <div className="mt-4">
            <a
              href={dep.registryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
            >
              View on Registry
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Dependency Tree */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Transitive Dependencies ({dep.transitiveDeps.length})
        </h2>
        <DependencyTree root={dep} allDeps={dep.transitiveDeps} />
      </div>
    </div>
  );
}
