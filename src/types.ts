export type StyleKey = 'outlined' | 'rounded' | 'sharp';

export interface StyleOption {
  key: StyleKey;
  label: string;
  folder: string;
}

export const STYLES: StyleOption[] = [
  { key: 'outlined', label: 'Outlined', folder: 'materialsymbolsoutlined' },
  { key: 'rounded', label: 'Rounded', folder: 'materialsymbolsrounded' },
  { key: 'sharp', label: 'Sharp', folder: 'materialsymbolssharp' },
];

export interface GoogleIconsResponse {
  host: string;
  asset_url_pattern: string;
  families: string[];
  icons: Array<{
    name: string;
    version: number;
    popularity: number;
    codepoint: number;
    categories: string[];
    tags: string[];
    unsupported_families?: string[];
  }>;
}

export interface IconMetadataItem {
  name: string;
  version: number;
  category: string;
  tags: string[];
  unsupported_families?: string[];
}

export interface ExistingIconRecord {
  id: string; // Figma node id of the component set
  name: string;
  category: string;
  version: number;
  isDeprecated?: boolean;
  importedAt?: number;
}

export type IconDiffStatus = 'new' | 'modified' | 'up_to_date' | 'deprecated';

export interface IconDiffItem {
  name: string;
  category: string;
  status: IconDiffStatus;
  remoteVersion: number;
  localVersion?: number;
  importedAt?: number;
  isFresh?: boolean;
  tags: string[];
}

export interface ColorVariableItem {
  id: string;
  name: string;
  collectionName?: string;
  type?: 'variable' | 'style';
}

export interface SyncConfig {
  selectedStyles: StyleKey[];
  includeFill: boolean;
  selectedCategories: string[]; // empty array = all
  colorVariableId?: string; // optional Figma variable ID or key to bind
}

export interface SvgVariantData {
  style: StyleKey;
  fill: boolean; // false = 0, true = 1
  svgText: string;
}

export interface IconBatchItem {
  name: string;
  category: string;
  version: number;
  variants: SvgVariantData[];
}

// Communication messages UI <-> Code
export type UIMessage =
  | { type: 'SCAN_PAGE' }
  | { type: 'REFRESH_VARIABLES' }
  | {
      type: 'START_SYNC_BATCH';
      payload: {
        items: IconBatchItem[];
        config: SyncConfig;
        isFirst: boolean;
        isLast: boolean;
        batchIndex: number;
        totalBatches: number;
        overallTotal: number;
      };
    }
  | { type: 'CANCEL_SYNC' }
  | { type: 'RESIZE_WINDOW'; width: number; height: number };

export type PluginMessage =
  | {
      type: 'INIT_STATE';
      payload: {
        existingIcons: ExistingIconRecord[];
        pageName: string;
        colorVariables?: ColorVariableItem[];
      };
    }
  | { type: 'VARIABLES_LOADED'; payload: { colorVariables: ColorVariableItem[] } }
  | {
      type: 'SYNC_PROGRESS';
      payload: {
        current: number;
        total: number;
        iconName: string;
        category?: string;
        action?: 'created' | 'updated';
      };
    }
  | { type: 'BATCH_COMPLETE'; payload: { batchIndex: number; added: number; updated: number } }
  | { type: 'SYNC_COMPLETE'; payload: { added: number; updated: number; deprecated: number } }
  | { type: 'SYNC_ERROR'; payload: { message: string } };
