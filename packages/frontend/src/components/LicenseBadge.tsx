import type { LicenseCategory } from '../api/client';

interface LicenseBadgeProps {
  category: LicenseCategory;
  licenseSpdx?: string | null;
}

const categoryStyles: Record<LicenseCategory, { bg: string; text: string; label: string }> = {
  permissive: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Permissive',
  },
  'weak-copyleft': {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Weak Copyleft',
  },
  'strong-copyleft': {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    label: 'Strong Copyleft',
  },
  unknown: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Unknown',
  },
};

export default function LicenseBadge({ category, licenseSpdx }: LicenseBadgeProps) {
  const style = categoryStyles[category] || categoryStyles.unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
      {licenseSpdx && (
        <span className="opacity-75">({licenseSpdx})</span>
      )}
    </span>
  );
}
