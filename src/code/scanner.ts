import { ExistingIconRecord, ColorVariableItem } from '../types';

export async function fetchColorVariables(): Promise<ColorVariableItem[]> {
  const results: ColorVariableItem[] = [];

  // 1. Récupération des variables locales Figma
  try {
    if ('variables' in figma && figma.variables.getLocalVariablesAsync) {
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
          collectionName: `Variables locales • ${collectionMap.get(v.variableCollectionId) || 'Variables'}`,
          type: 'variable',
        });
      }
      console.log(`[Figma Sync] Variables locales trouvées : ${colorVars.length}`);
    }
  } catch (err) {
    console.warn('[Figma Sync] Erreur lors de la récupération des variables locales :', err);
  }

  // 2. Récupération des variables provenant de bibliothèques d'équipe activées / liées au document
  try {
    if ('teamLibrary' in figma && figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
      const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      console.log(`[Figma Sync] Collections de bibliothèque liées trouvées : ${libraryCollections.length}`);

      const collectionPromises = libraryCollections.map(async (libCol) => {
        try {
          const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCol.key);
          return libVars
            .filter((v) => v.resolvedType === 'COLOR')
            .map((v) => ({
              id: v.key,
              name: v.name,
              collectionName: `${libCol.libraryName} • ${libCol.name}`,
              type: 'variable' as const,
            }));
        } catch (colErr) {
          console.warn(`[Figma Sync] Erreur de lecture de la collection "${libCol.name}" :`, colErr);
          return [];
        }
      });

      const libResults = await Promise.all(collectionPromises);
      for (const items of libResults) {
        results.push(...items);
      }
    } else {
      console.log('[Figma Sync] figma.teamLibrary non disponible.');
    }
  } catch (libErr) {
    console.warn('[Figma Sync] Erreur lors de l\'accès à figma.teamLibrary :', libErr);
  }

  // 3. Récupération des styles de couleur locaux (Figma PaintStyles)
  try {
    if ('getLocalPaintStyles' in figma) {
      const paintStyles = figma.getLocalPaintStyles();
      for (const style of paintStyles) {
        results.push({
          id: `style:${style.id}`,
          name: style.name,
          collectionName: 'Styles de couleur (Paint Styles)',
          type: 'style',
        });
      }
      console.log(`[Figma Sync] Styles de couleur locaux trouvés : ${paintStyles.length}`);
    }
  } catch (styleErr) {
    console.warn('[Figma Sync] Erreur lors de la récupération des styles de couleur :', styleErr);
  }

  console.log(`[Figma Sync] Total tokens de couleur détectés : ${results.length}`);
  return results;
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
