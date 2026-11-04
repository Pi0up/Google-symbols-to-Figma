import { GoogleIconsResponse, IconMetadataItem, StyleKey, SvgVariantData, STYLES } from '../types';

const METADATA_URL = 'https://fonts.google.com/metadata/icons?incomplete=true&key=material_symbols';
const GSTATIC_RELEASE_BASE = 'https://fonts.gstatic.com/s/i/short-term/release';
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/google/material-design-icons@master/symbols/web';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web';
const LEGACY_GSTATIC_BASE = 'https://fonts.gstatic.com/s/i/materialicons';

async function fetchWithRetry(url: string, retries = 1, delayMs = 250): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return res;
    } catch (e) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  return null;
}

export async function fetchGoogleMetadata(): Promise<IconMetadataItem[]> {
  const response = await fetch(METADATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Fonts metadata: HTTP ${response.status}`);
  }

  const rawText = await response.text();
  // Google's endpoint prepends XSSI prefix )]}'
  const jsonText = rawText.replace(/^\)\]\}'/, '').trim();
  const data: GoogleIconsResponse = JSON.parse(jsonText);

  // Map to deduplicate icons by lowercase name, keeping the best Material Symbols entry
  const iconMap = new Map<string, IconMetadataItem>();

  for (const item of data.icons) {
    const key = item.name.toLowerCase().trim();
    const primaryCategory = selectBestCategory(item.categories);
    const unfam = item.unsupported_families || [];
    const isMaterialSymbolsUnsupported =
      unfam.includes('Material Symbols Outlined') &&
      unfam.includes('Material Symbols Rounded') &&
      unfam.includes('Material Symbols Sharp');

    const currentItem: IconMetadataItem = {
      name: item.name.trim(),
      version: item.version,
      category: primaryCategory,
      tags: item.tags || [],
      unsupported_families: item.unsupported_families,
    };

    if (!iconMap.has(key)) {
      iconMap.set(key, currentItem);
    } else {
      const existing = iconMap.get(key)!;
      const existingUnfam = existing.unsupported_families || [];
      const existingIsUnsupported =
        existingUnfam.includes('Material Symbols Outlined') &&
        existingUnfam.includes('Material Symbols Rounded') &&
        existingUnfam.includes('Material Symbols Sharp');

      // If existing is legacy and current supports Material Symbols, replace it
      if (existingIsUnsupported && !isMaterialSymbolsUnsupported) {
        iconMap.set(key, currentItem);
      } else if (!existingIsUnsupported && isMaterialSymbolsUnsupported) {
        // Keep existing supported icon
      } else if (item.version > existing.version) {
        // Higher version wins
        iconMap.set(key, currentItem);
      }
    }
  }

  // Return strictly unique icons sorted alphabetically
  const symbols = Array.from(iconMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return symbols;
}

function selectBestCategory(categories: string[]): string {
  if (!categories || categories.length === 0) return 'General';
  // Prefer human-readable category (longer, has uppercase or spaces)
  const sorted = [...categories].sort((a, b) => {
    const scoreA = (/[A-Z]/.test(a) ? 2 : 0) + a.length;
    const scoreB = (/[B-Z]/.test(b) ? 2 : 0) + b.length;
    return scoreB - scoreA;
  });
  return formatCategoryName(sorted[0]);
}

function formatCategoryName(cat: string): string {
  return cat
    .replace(/&/g, ' & ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchSingleSvg(
  iconName: string,
  styleFolder: string,
  fill: boolean
): Promise<string> {
  const fillState = fill ? 'fill1' : 'default';
  const fillSuffix = fill ? '_fill1' : '';
  const fileName = `${iconName}${fillSuffix}_24px.svg`;

  // Candidate URLs in priority order:
  // 1. Google Fonts CDN (Primary short-term release - fast and complete)
  // 2. jsDelivr CDN mirror for symbols/web
  // 3. GitHub raw content for symbols/web
  // 4. Legacy Material Icons gstatic CDN (for older icons like access_time)
  const candidateUrls = [
    `${GSTATIC_RELEASE_BASE}/${styleFolder}/${iconName}/${fillState}/24px.svg`,
    `${JSDELIVR_BASE}/${iconName}/${styleFolder}/${fileName}`,
    `${GITHUB_RAW_BASE}/${iconName}/${styleFolder}/${fileName}`,
    `${LEGACY_GSTATIC_BASE}/${iconName}/v12/24px.svg`,
    `${LEGACY_GSTATIC_BASE}/${iconName}/24px.svg`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetchWithRetry(url);
      if (res && res.ok) {
        const text = await res.text();
        if (text && text.includes('<svg')) {
          return text;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback: If fill was requested and failed, try non-fill
  if (fill) {
    try {
      return await fetchSingleSvg(iconName, styleFolder, false);
    } catch {
      // Continue to next fallback
    }
  }

  // Fallback: If rounded/sharp failed, try outlined
  if (styleFolder !== 'materialsymbolsoutlined') {
    try {
      return await fetchSingleSvg(iconName, 'materialsymbolsoutlined', fill);
    } catch {
      // Continue to throw error
    }
  }

  throw new Error(`SVG introuvable pour "${iconName}" (${styleFolder}, fill=${fill})`);
}

export async function fetchIconAllVariants(
  iconName: string,
  styles: StyleKey[],
  includeFill: boolean
): Promise<SvgVariantData[]> {
  const styleLookup: Record<StyleKey, string> = {
    outlined: 'materialsymbolsoutlined',
    rounded: 'materialsymbolsrounded',
    sharp: 'materialsymbolssharp',
  };

  const fillStates = includeFill ? [false, true] : [false];
  const variantPromises: Promise<SvgVariantData>[] = [];

  for (const style of styles) {
    const folder = styleLookup[style];
    for (const fill of fillStates) {
      variantPromises.push(
        fetchSingleSvg(iconName, folder, fill).then((svgText) => ({
          style,
          fill,
          svgText,
        }))
      );
    }
  }

  return await Promise.all(variantPromises);
}
