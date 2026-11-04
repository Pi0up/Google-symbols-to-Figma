import { ExistingIconRecord, ColorVariableItem } from '../types';

export async function fetchColorVariables(): Promise<ColorVariableItem[]> {
  try {
    if (!('variables' in figma) || !figma.variables.getLocalVariablesAsync) {
      return [];
    }

    const results: ColorVariableItem[] = [];

    // 1. Récupération des variables locales
    const [colorVars, collections] = await Promise.all([
      figma.variables.getLocalVariablesAsync('COLOR'),
      figma.variables.getLocalVariableCollectionsAsync(),
    ]);

    const collectionMap = new Map<string, string>();
    for (const c of collections) {
      collectionMap.set(c.id, c.name);
    }

    for (const v of colorVars) {
      results.push({
        id: v.id,
        name: v.name,
        collectionName: `Locales • ${collectionMap.get(v.variableCollectionId) || 'Variables'}`,
      });
    }

    // 2. Récupération des variables provenant de bibliothèques d'équipe activées / liées au document
    if ('teamLibrary' in figma && figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
      try {
        const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        for (const libCol of libraryCollections) {
          try {
            const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCol.key);
            for (const v of libVars) {
              if (v.resolvedType === 'COLOR') {
                results.push({
                  id: v.key, // Pour une variable de bibliothèque liée, la clé est utilisée pour l'import via importVariableByKeyAsync
                  name: v.name,
                  collectionName: `${libCol.libraryName} • ${libCol.name}`,
                });
              }
            }
          } catch (colErr) {
            console.warn(`Could not load variables for library collection "${libCol.name}":`, colErr);
          }
        }
      } catch (libErr) {
        console.warn('Could not load available library variable collections:', libErr);
      }
    }

    return results;
  } catch (err) {
    console.warn('Could not fetch local color variables:', err);
    return [];
  }
}

export function scanExistingIcons(): ExistingIconRecord[] {
  const records: ExistingIconRecord[] = [];
  const componentSets = figma.currentPage.findAll(
    (node) => node.type === 'COMPONENT_SET'
  ) as ComponentSetNode[];

  for (const set of componentSets) {
    const rawName = set.name;
    const isDeprecated =
      set.getPluginData('is_deprecated') === 'true' ||
      rawName.startsWith('[Deprecated]');

    const cleanName = rawName.replace(/^\[Deprecated\]\s*/i, '').trim();
    const storedName = set.getPluginData('icon_name') || cleanName;
    const storedCategory = set.getPluginData('icon_category') || 'General';
    const rawVersion = set.getPluginData('icon_version');
    const version = rawVersion ? parseInt(rawVersion, 10) : 0;

    records.push({
      id: set.id,
      name: storedName,
      category: storedCategory,
      version: isNaN(version) ? 0 : version,
      isDeprecated,
    });
  }

  return records;
}
