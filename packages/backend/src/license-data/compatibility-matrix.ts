export const ALL_OUTBOUND_LICENSES: string[] = [
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Apache-2.0',
  'LGPL-2.1-only',
  'LGPL-3.0-only',
  'MPL-2.0',
  'GPL-2.0-only',
  'GPL-3.0-only',
  'AGPL-3.0-only',
];

const ALL_COMMON = [...ALL_OUTBOUND_LICENSES];

export const OUTBOUND_ALLOWED_BY: Record<string, string[]> = {
  // Fully permissive — allow any outbound
  'MIT': ALL_COMMON,
  'BSD-2-Clause': ALL_COMMON,
  'BSD-3-Clause': ALL_COMMON,
  'ISC': ALL_COMMON,
  'Unlicense': ALL_COMMON,
  'CC0-1.0': ALL_COMMON,
  'WTFPL': ALL_COMMON,
  '0BSD': ALL_COMMON,
  'Zlib': ALL_COMMON,
  'Artistic-2.0': ALL_COMMON,
  'Python-2.0': ALL_COMMON,
  'BlueOak-1.0.0': ALL_COMMON,
  'CC-BY-3.0': ALL_COMMON,
  'CC-BY-4.0': ALL_COMMON,
  'BSL-1.0': ALL_COMMON,

  // Copyleft
  'Apache-2.0': ['Apache-2.0', 'LGPL-3.0-only', 'MPL-2.0', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'LGPL-2.1-only': ['LGPL-2.1-only', 'LGPL-3.0-only', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'LGPL-3.0-only': ['LGPL-3.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'MPL-2.0': ['MPL-2.0', 'LGPL-2.1-only', 'LGPL-3.0-only', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'GPL-2.0-only': ['GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'GPL-3.0-only': ['GPL-3.0-only', 'AGPL-3.0-only'],
  'AGPL-3.0-only': ['AGPL-3.0-only'],

  // "or later" variants — treat like their base + later versions
  'GPL-2.0-or-later': ['GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'GPL-3.0-or-later': ['GPL-3.0-only', 'AGPL-3.0-only'],
  'LGPL-2.1-or-later': ['LGPL-2.1-only', 'LGPL-3.0-only', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'LGPL-3.0-or-later': ['LGPL-3.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'],
  'AGPL-3.0-or-later': ['AGPL-3.0-only'],
};

const PERMISSIVE = new Set([
  'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Apache-2.0',
  'Unlicense', 'CC0-1.0', 'WTFPL', '0BSD', 'Zlib', 'Artistic-2.0',
  'Python-2.0', 'BlueOak-1.0.0', 'CC-BY-3.0', 'CC-BY-4.0', 'BSL-1.0',
]);

const WEAK_COPYLEFT = new Set([
  'LGPL-2.1-only', 'LGPL-3.0-only', 'MPL-2.0',
  'LGPL-2.1-or-later', 'LGPL-3.0-or-later',
]);

const STRONG_COPYLEFT = new Set([
  'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only',
  'GPL-2.0-or-later', 'GPL-3.0-or-later', 'AGPL-3.0-or-later',
]);

export function getLicenseCategory(
  spdx: string
): 'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'unknown' {
  // Handle SPDX expressions
  if (isExpression(spdx)) {
    const resolved = resolveExpression(spdx);
    if (resolved.length === 0) return 'unknown';
    // For display, use the "best" category
    const categories = resolved.map((l) => getSingleCategory(l));
    if (categories.includes('strong-copyleft')) return 'strong-copyleft';
    if (categories.includes('weak-copyleft')) return 'weak-copyleft';
    if (categories.every((c) => c === 'permissive')) return 'permissive';
    return 'unknown';
  }

  return getSingleCategory(spdx);
}

function getSingleCategory(
  spdx: string
): 'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'unknown' {
  if (PERMISSIVE.has(spdx)) return 'permissive';
  if (WEAK_COPYLEFT.has(spdx)) return 'weak-copyleft';
  if (STRONG_COPYLEFT.has(spdx)) return 'strong-copyleft';
  return 'unknown';
}

// --- SPDX expression handling ---

function isExpression(license: string): boolean {
  return /\b(AND|OR)\b/.test(license) || license.includes('(');
}

function isUnresolvable(license: string): boolean {
  const lower = license.toLowerCase();
  return (
    lower.startsWith('see license') ||
    lower.startsWith('custom') ||
    lower === 'unknown' ||
    lower === 'noassertion' ||
    lower.startsWith('license')
  );
}

/**
 * Tokenize and parse a simple SPDX expression.
 * Supports: AND, OR, parentheses, and license identifiers.
 * For "OR" we pick the most permissive choice (widest outbound set).
 * For "AND" we intersect the outbound sets.
 * Returns the list of atomic license IDs that should be treated as
 * simultaneous inbound constraints.
 */
function resolveExpression(expr: string): string[] {
  const cleaned = expr.replace(/^\(+|\)+$/g, '').trim();

  // Simple case: single OR — pick the most permissive
  if (/\bOR\b/i.test(cleaned) && !/\bAND\b/i.test(cleaned)) {
    const parts = cleaned.split(/\s+OR\s+/i).map((s) => s.replace(/[()]/g, '').trim());
    return [pickMostPermissive(parts)];
  }

  // Simple case: single AND — all apply
  if (/\bAND\b/i.test(cleaned) && !/\bOR\b/i.test(cleaned)) {
    const parts = cleaned.split(/\s+AND\s+/i).map((s) => s.replace(/[()]/g, '').trim());
    return parts.filter((p) => !isUnresolvable(p));
  }

  // Mixed: try to handle nested expressions
  // e.g., "(MIT OR Apache-2.0) AND BSD-3-Clause"
  // Split by AND at the top level, then resolve each part
  const topLevelParts = splitTopLevel(cleaned, 'AND');
  if (topLevelParts.length > 1) {
    const resolved: string[] = [];
    for (const part of topLevelParts) {
      const trimmedPart = part.replace(/^\(+|\)+$/g, '').trim();
      if (/\bOR\b/i.test(trimmedPart)) {
        const orParts = trimmedPart.split(/\s+OR\s+/i).map((s) => s.replace(/[()]/g, '').trim());
        resolved.push(pickMostPermissive(orParts));
      } else {
        if (!isUnresolvable(trimmedPart)) {
          resolved.push(trimmedPart);
        }
      }
    }
    return resolved;
  }

  // Try splitting by OR at top level
  const orParts = splitTopLevel(cleaned, 'OR');
  if (orParts.length > 1) {
    const candidates = orParts.map((part) => {
      const trimmedPart = part.replace(/^\(+|\)+$/g, '').trim();
      if (/\bAND\b/i.test(trimmedPart)) {
        return trimmedPart.split(/\s+AND\s+/i).map((s) => s.replace(/[()]/g, '').trim());
      }
      return [trimmedPart];
    });
    // Pick the candidate group that's most permissive
    let best = candidates[0];
    let bestScore = permissivityScore(best);
    for (let i = 1; i < candidates.length; i++) {
      const score = permissivityScore(candidates[i]);
      if (score > bestScore) {
        best = candidates[i];
        bestScore = score;
      }
    }
    return best.filter((p) => !isUnresolvable(p));
  }

  // Fallback: treat as single license
  if (!isUnresolvable(cleaned)) {
    return [cleaned];
  }
  return [];
}

function splitTopLevel(expr: string, operator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  const re = new RegExp(`\\s+${operator}\\s+`, 'gi');
  const tokens = expr.split(re);

  // Simple approach: re-split respecting parens
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    current += ch;
  }

  // If no nesting, just split directly
  if (depth === 0) {
    return tokens;
  }

  // Otherwise return as-is
  return [expr];
}

function permissivityScore(licenses: string[]): number {
  let score = 0;
  for (const l of licenses) {
    if (PERMISSIVE.has(l)) score += 3;
    else if (WEAK_COPYLEFT.has(l)) score += 2;
    else if (STRONG_COPYLEFT.has(l)) score += 1;
    else if (l in OUTBOUND_ALLOWED_BY) score += 1;
    // unknown licenses get 0
  }
  return score;
}

function pickMostPermissive(licenses: string[]): string {
  let best = licenses[0];
  let bestScore = singlePermissivityScore(best);
  for (let i = 1; i < licenses.length; i++) {
    const score = singlePermissivityScore(licenses[i]);
    if (score > bestScore) {
      best = licenses[i];
      bestScore = score;
    }
  }
  return best;
}

function singlePermissivityScore(license: string): number {
  if (PERMISSIVE.has(license)) return 3;
  if (WEAK_COPYLEFT.has(license)) return 2;
  if (STRONG_COPYLEFT.has(license)) return 1;
  if (license in OUTBOUND_ALLOWED_BY) return 1;
  return 0;
}

// --- Allowed outbound for an expression ---

/**
 * Get the allowed outbound licenses for a (possibly compound) inbound license.
 * Returns null if the license is truly unknown and can't be resolved.
 */
export function getAllowedOutbound(inbound: string): string[] | null {
  // Direct lookup
  if (inbound in OUTBOUND_ALLOWED_BY) {
    return OUTBOUND_ALLOWED_BY[inbound];
  }

  // Skip unresolvable
  if (isUnresolvable(inbound)) {
    return null;
  }

  // Try expression parsing
  if (isExpression(inbound)) {
    const resolved = resolveExpression(inbound);
    if (resolved.length === 0) return null;

    // All resolved licenses must be known
    const allKnown = resolved.every((l) => l in OUTBOUND_ALLOWED_BY);
    if (!allKnown) {
      // Some parts are unknown — check if we can still resolve
      const unknownParts = resolved.filter((l) => !(l in OUTBOUND_ALLOWED_BY));
      if (unknownParts.every((l) => isUnresolvable(l))) {
        // Filter out unresolvable, work with what we have
        const knownParts = resolved.filter((l) => l in OUTBOUND_ALLOWED_BY);
        if (knownParts.length === 0) return null;
        return intersectAllowed(knownParts);
      }
      return null;
    }

    return intersectAllowed(resolved);
  }

  return null;
}

function intersectAllowed(licenses: string[]): string[] {
  let result = new Set(OUTBOUND_ALLOWED_BY[licenses[0]]);
  for (let i = 1; i < licenses.length; i++) {
    const allowed = new Set(OUTBOUND_ALLOWED_BY[licenses[i]]);
    result = new Set([...result].filter((l: string) => allowed.has(l)));
  }
  return [...result];
}

// --- Main compatibility function ---

export function computeCompatibleLicenses(
  inboundLicenses: string[]
): { license: string; isCompatible: boolean; reason: string }[] {
  const uniqueInbound = [...new Set(inboundLicenses)];

  if (uniqueInbound.length === 0) {
    return ALL_OUTBOUND_LICENSES.map((license) => ({
      license,
      isCompatible: true,
      reason: 'No inbound dependency licenses to restrict compatibility.',
    }));
  }

  // Resolve each inbound license (including expressions)
  const resolved: { original: string; allowed: string[] | null }[] = [];
  for (const inbound of uniqueInbound) {
    const allowed = getAllowedOutbound(inbound);
    resolved.push({ original: inbound, allowed });
  }

  const knownResolved = resolved.filter((r) => r.allowed !== null);
  const unknownResolved = resolved.filter((r) => r.allowed === null);

  // Intersect all known allowed sets
  let allowedSets: Set<string> | null = null;
  for (const r of knownResolved) {
    const allowed = new Set(r.allowed!);
    if (allowedSets === null) {
      allowedSets = allowed;
    } else {
      allowedSets = new Set([...allowedSets].filter((l: string) => allowed.has(l)));
    }
  }

  if (allowedSets === null) {
    allowedSets = new Set(ALL_OUTBOUND_LICENSES);
  }

  const finalAllowed = allowedSets;
  const knownNames = knownResolved.map((r) => r.original);
  const unknownNames = unknownResolved.map((r) => r.original);

  return ALL_OUTBOUND_LICENSES.map((outbound) => {
    const isCompatible = finalAllowed.has(outbound) && unknownNames.length === 0;

    let reason: string;

    if (unknownNames.length > 0 && !finalAllowed.has(outbound)) {
      const blockers = knownResolved
        .filter((r) => !r.allowed!.includes(outbound))
        .map((r) => r.original);
      reason = blockers.length > 0
        ? `Incompatible: blocked by ${blockers.join(', ')}. Also, unrecognized licenses (${unknownNames.join(', ')}) could not be evaluated.`
        : `Cannot confirm: unrecognized licenses (${unknownNames.join(', ')}) could not be evaluated against "${outbound}".`;
    } else if (unknownNames.length > 0) {
      reason = `Cannot confirm: unrecognized licenses (${unknownNames.join(', ')}) could not be evaluated against "${outbound}".`;
    } else if (!finalAllowed.has(outbound)) {
      const blockers = knownResolved
        .filter((r) => !r.allowed!.includes(outbound))
        .map((r) => r.original);
      reason = `Incompatible: ${blockers.join(', ')} do not allow outbound "${outbound}".`;
    } else {
      reason = `Compatible: all inbound licenses allow outbound "${outbound}".`;
    }

    return { license: outbound, isCompatible, reason };
  });
}
