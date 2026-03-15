import type { AnalysisStatus } from '../api/client';

interface AnalysisProgressProps {
  status: AnalysisStatus;
  progress: number;
  error: string | null;
}

const statusLabels: Record<AnalysisStatus, string> = {
  queued: 'Queued...',
  cloning: 'Cloning repository...',
  parsing: 'Parsing dependencies...',
  resolving_licenses: 'Resolving licenses...',
  complete: 'Complete!',
  failed: 'Failed',
};

function getBarColor(status: AnalysisStatus): string {
  if (status === 'complete') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-indigo-500';
}

function getTextColor(status: AnalysisStatus): string {
  if (status === 'complete') return 'text-green-700';
  if (status === 'failed') return 'text-red-700';
  return 'text-indigo-700';
}

export default function AnalysisProgress({
  status,
  progress,
  error,
}: AnalysisProgressProps) {
  const isInProgress = status !== 'complete' && status !== 'failed';

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className={`font-semibold text-lg ${getTextColor(status)}`}>
              {statusLabels[status]}
            </span>
            <span className="text-sm text-slate-500 font-medium">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor(status)} ${
                isInProgress ? 'animate-pulse-glow' : ''
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {isInProgress && (
          <p className="text-sm text-slate-500 text-center">
            This may take a moment depending on the size of the repository.
          </p>
        )}

        {status === 'complete' && (
          <p className="text-sm text-green-600 text-center font-medium">
            Analysis finished successfully.
          </p>
        )}

        {status === 'failed' && error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
