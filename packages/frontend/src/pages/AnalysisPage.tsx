import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAnalysis } from '../api/client';
import AnalysisProgress from '../components/AnalysisProgress';
import DependencyTable from '../components/DependencyTable';
import LicensePicker from '../components/LicensePicker';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: analysis, error } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysis(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') return false;
      return 2000;
    },
  });

  if (error) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-red-700 mb-2">
          Error Loading Analysis
        </h2>
        <p className="text-slate-600 mb-6">
          Could not load the analysis. It may not exist or the server is unavailable.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isInProgress =
    analysis.status !== 'complete' && analysis.status !== 'failed';

  if (isInProgress) {
    return (
      <div className="py-16">
        <AnalysisProgress
          status={analysis.status}
          progress={analysis.progress}
          error={analysis.error}
        />
      </div>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <div className="py-16">
        <AnalysisProgress
          status={analysis.status}
          progress={analysis.progress}
          error={analysis.error}
        />
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Complete
  const analysisTime =
    analysis.completedAt && analysis.createdAt
      ? Math.round(
          (new Date(analysis.completedAt).getTime() -
            new Date(analysis.createdAt).getTime()) /
            1000,
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Summary Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Analysis Results
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Repository
            </span>
            <a
              href={analysis.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all"
            >
              {analysis.repoUrl}
            </a>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Commit SHA
            </span>
            <span className="text-sm font-mono text-slate-700">
              {analysis.commitSha
                ? analysis.commitSha.substring(0, 12)
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Ecosystems
            </span>
            <div className="flex flex-wrap gap-1">
              {analysis.ecosystems.map((eco) => (
                <span
                  key={eco}
                  className="inline-flex px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700 capitalize"
                >
                  {eco}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Dependencies
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {analysis.dependencies.length}
              </span>
            </div>
            {analysisTime !== null && (
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Duration
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {analysisTime}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* License Compatibility */}
      {analysis.compatibleLicenses.length > 0 && (
        <LicensePicker licenses={analysis.compatibleLicenses} />
      )}

      {/* Dependency Table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Dependencies
        </h2>
        <DependencyTable
          dependencies={analysis.dependencies}
          analysisId={analysis.id}
        />
      </div>
    </div>
  );
}
