export const LICENSE_ALIASES: Record<string, string> = {
  'MIT License': 'MIT',
  'The MIT License': 'MIT',
  'The MIT License (MIT)': 'MIT',
  'MIT/X11': 'MIT',
  'Expat': 'MIT',
  'BSD': 'BSD-2-Clause',
  'BSD License': 'BSD-2-Clause',
  'BSD 2-Clause': 'BSD-2-Clause',
  'BSD-2-Clause License': 'BSD-2-Clause',
  'Simplified BSD': 'BSD-2-Clause',
  'FreeBSD': 'BSD-2-Clause',
  'BSD 3-Clause': 'BSD-3-Clause',
  'BSD-3-Clause License': 'BSD-3-Clause',
  'New BSD': 'BSD-3-Clause',
  'Modified BSD': 'BSD-3-Clause',
  'Apache 2': 'Apache-2.0',
  'Apache 2.0': 'Apache-2.0',
  'Apache License 2.0': 'Apache-2.0',
  'Apache License, Version 2.0': 'Apache-2.0',
  'The Apache License, Version 2.0': 'Apache-2.0',
  'Apache Software License': 'Apache-2.0',
  'ASL 2.0': 'Apache-2.0',
  'GPLv2': 'GPL-2.0-only',
  'GPL-2.0': 'GPL-2.0-only',
  'GNU General Public License v2': 'GPL-2.0-only',
  'GPL 2': 'GPL-2.0-only',
  'GPL2': 'GPL-2.0-only',
  'GPLv3': 'GPL-3.0-only',
  'GPL-3.0': 'GPL-3.0-only',
  'GNU General Public License v3': 'GPL-3.0-only',
  'GPL 3': 'GPL-3.0-only',
  'GPL3': 'GPL-3.0-only',
  'GNU GPL v3': 'GPL-3.0-only',
  'LGPLv2.1': 'LGPL-2.1-only',
  'LGPL-2.1': 'LGPL-2.1-only',
  'GNU Lesser General Public License v2.1': 'LGPL-2.1-only',
  'LGPLv3': 'LGPL-3.0-only',
  'LGPL-3.0': 'LGPL-3.0-only',
  'GNU Lesser General Public License v3': 'LGPL-3.0-only',
  'AGPLv3': 'AGPL-3.0-only',
  'AGPL-3.0': 'AGPL-3.0-only',
  'GNU Affero General Public License v3': 'AGPL-3.0-only',
  'ISC License': 'ISC',
  'ISC license': 'ISC',
  'The ISC License': 'ISC',
  'Public Domain': 'Unlicense',
  'public domain': 'Unlicense',
  'WTFPL': 'WTFPL',
  'Do What The F*ck You Want To Public License': 'WTFPL',
  'CC0': 'CC0-1.0',
  'CC0 1.0': 'CC0-1.0',
  'CC0-1.0 Universal': 'CC0-1.0',
  'Creative Commons Zero v1.0 Universal': 'CC0-1.0',
  'Artistic-2': 'Artistic-2.0',
  'Artistic License 2.0': 'Artistic-2.0',
  'The Artistic License 2.0': 'Artistic-2.0',
  'MPL 2.0': 'MPL-2.0',
  'Mozilla Public License 2.0': 'MPL-2.0',
  'MPL-2': 'MPL-2.0',
  'MPLv2': 'MPL-2.0',
  'Mozilla Public License, Version 2.0': 'MPL-2.0',
  'Zlib': 'Zlib',
  'zlib License': 'Zlib',
  '0BSD': '0BSD',
  'Zero-Clause BSD': '0BSD',
  'BSD Zero Clause License': '0BSD',
  'Unlicense': 'Unlicense',
  'The Unlicense': 'Unlicense',
};

const aliasLookupLower: Record<string, string> = {};
for (const [key, value] of Object.entries(LICENSE_ALIASES)) {
  aliasLookupLower[key.toLowerCase()] = value;
}

export function normalizeLicense(raw: string): string {
  if (!raw || raw.trim() === '') {
    return 'Unknown';
  }

  const trimmed = raw.trim();

  // Direct alias lookup
  if (LICENSE_ALIASES[trimmed]) {
    return LICENSE_ALIASES[trimmed];
  }

  // Case-insensitive alias lookup
  const lower = trimmed.toLowerCase();
  if (aliasLookupLower[lower]) {
    return aliasLookupLower[lower];
  }

  // Check if it's already a known SPDX identifier (case-insensitive)
  const knownSpdx = new Set(Object.values(LICENSE_ALIASES));
  for (const spdx of knownSpdx) {
    if (spdx.toLowerCase() === lower) {
      return spdx;
    }
  }

  return trimmed;
}
