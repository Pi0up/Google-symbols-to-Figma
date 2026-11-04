import { ExistingIconRecord, ColorVariableItem } from '../types';

export async function fetchColorVariables(): Promise<ColorVariableItem[]> {
  try {
    if (!('variables' in figma) || !figma.variables.getLocalVariablesAsync) {
      return [];
    }

    const [colorVars, collections] = await Promise.all([
      figma.variables.getLocalVariablesAsync('COLOR'),
      figma.variables.getLocalVariableCollectionsAsync(),
    ]);

    const collectionMap = new Map<string, string>();
    for (const c of collections) {
      collectionMap.set(c.id, c.name);
    }

    return colorVars.map((v) => ({
      id: v.id,
      name: v.name,
      collectionName: collectionMap.get(v.variableCollectionId) || 'Variables',
    }));
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
