import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitAnalysis } from '../api/client';

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function RepoInput() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState('');
  const [ref, setRef] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl) {
      setError('Please enter a repository URL.');
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL (e.g., https://github.com/user/repo).');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitAnalysis(trimmedUrl, ref.trim() || undefined);
      navigate(`/analysis/${result.analysisId}`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(
          axiosErr.response?.data?.error || 'Failed to start analysis. Please try again.',
        );
      } else {
        setError('Failed to start analysis. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="repoUrl"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Repository URL
          </label>
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 placeholder-slate-400"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
          >
            <span
              className={`inline-block transform transition-transform ${
                showAdvanced ? 'rotate-90' : ''
              }`}
            >
              &#9654;
            </span>
            <span>Advanced</span>
          </button>

          {showAdvanced && (
            <div className="mt-2">
              <label
                htmlFor="ref"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Branch / Tag / Commit (optional)
              </label>
              <input
                id="ref"
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 placeholder-slate-400"
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-6 text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center space-x-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Analyzing...</span>
            </span>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
    </form>
  );
}
