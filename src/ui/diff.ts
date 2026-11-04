import { IconMetadataItem, ExistingIconRecord, IconDiffItem } from '../types';

export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 heures

export interface DiffSummary {
  items: IconDiffItem[];
  newCount: number;
  modifiedCount: number;
  upToDateCount: number;
  deprecatedCount: number;
  freshCount: number;
  categories: string[];
}

export function computeDiff(
  remoteIcons: IconMetadataItem[],
  existingIcons: ExistingIconRecord[]
): DiffSummary {
  const localMap = new Map<string, ExistingIconRecord>();
  for (const item of existingIcons) {
    localMap.set(item.name.toLowerCase(), item);
  }

  const remoteMap = new Map<string, IconMetadataItem>();
  const diffItems: IconDiffItem[] = [];
  const categoriesSet = new Set<string>();

  let newCount = 0;
  let modifiedCount = 0;
  let upToDateCount = 0;
  let deprecatedCount = 0;
  let freshCount = 0;

  const now = Date.now();

  for (const remote of remoteIcons) {
    const key = remote.name.toLowerCase();
    remoteMap.set(key, remote);
    categoriesSet.add(remote.category);

    const local = localMap.get(key);

    if (!local) {
      newCount++;
      diffItems.push({
        name: remote.name,
        category: remote.category,
        status: 'new',
        remoteVersion: remote.version,
        isFresh: false,
        tags: remote.tags,
      });
    } else if (local.isDeprecated) {
      deprecatedCount++;
      diffItems.push({
        name: remote.name,
        category: remote.category,
        status: 'deprecated',
        remoteVersion: remote.version,
        localVersion: local.version,
        importedAt: local.importedAt,
        isFresh: false,
        tags: remote.tags,
      });
    } else {
      const isFresh = Boolean(
        local.importedAt &&
        !isNaN(local.importedAt) &&
        now - local.importedAt < FRESHNESS_WINDOW_MS
      );

      if (isFresh) {
        // Icône importée il y a moins de 24h : considérée fraîche et à jour (aucun retéléchargement)
        upToDateCount++;
        freshCount++;
        diffItems.push({
          name: remote.name,
          category: remote.category,
          status: 'up_to_date',
          remoteVersion: remote.version,
          localVersion: local.version,
          importedAt: local.importedAt,
          isFresh: true,
          tags: remote.tags,
        });
      } else if (remote.version > (local.version || 0)) {
        modifiedCount++;
        diffItems.push({
          name: remote.name,
          category: remote.category,
          status: 'modified',
          remoteVersion: remote.version,
          localVersion: local.version,
          importedAt: local.importedAt,
          isFresh: false,
          tags: remote.tags,
        });
      } else {
        upToDateCount++;
        diffItems.push({
          name: remote.name,
          category: remote.category,
          status: 'up_to_date',
          remoteVersion: remote.version,
          localVersion: local.version,
          importedAt: local.importedAt,
          isFresh: false,
          tags: remote.tags,
        });
      }
    }
  }

  // Check if there are local icons that do not exist in remote at all
  for (const [name, local] of localMap.entries()) {
    if (!remoteMap.has(name)) {
      deprecatedCount++;
      diffItems.push({
        name: local.name,
        category: local.category || 'General',
        status: 'deprecated',
        remoteVersion: 0,
        localVersion: local.version,
        importedAt: local.importedAt,
        isFresh: false,
        tags: [],
      });
    }
  }

  return {
    items: diffItems,
    newCount,
    modifiedCount,
    upToDateCount,
    deprecatedCount,
    freshCount,
    categories: Array.from(categoriesSet).sort(),
  };
}
