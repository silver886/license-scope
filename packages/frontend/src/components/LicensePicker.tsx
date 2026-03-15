import { useState } from 'react';
import type { CompatibleLicense } from '../api/client';

interface LicensePickerProps {
  licenses: CompatibleLicense[];
}

export default function LicensePicker({ licenses }: LicensePickerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...licenses].sort((a, b) => {
    if (a.isCompatible === b.isCompatible) {
      return a.licenseSpdx.localeCompare(b.licenseSpdx);
    }
    return a.isCompatible ? -1 : 1;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        Compatible Outbound Licenses
      </h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">
          No license compatibility data available.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((license) => {
            const isExpanded = expandedId === license.id;

            return (
              <li key={license.id}>
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : license.id)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-slate-50 transition-colors"
                >
                  {license.isCompatible ? (
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-600">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                  )}

                  <span
                    className={`font-medium text-sm ${
                      license.isCompatible
                        ? 'text-slate-800'
                        : 'text-slate-500'
                    }`}
                  >
                    {license.licenseSpdx}
                  </span>

                  <span
                    className={`ml-auto text-xs transform transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    } text-slate-400`}
                  >
                    &#9660;
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-12 mt-1 mb-2 px-4 py-2 bg-slate-50 rounded-lg text-sm text-slate-600">
                    {license.reason}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
