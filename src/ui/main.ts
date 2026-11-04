import {
  PluginMessage,
  UIMessage,
  IconMetadataItem,
  ExistingIconRecord,
  IconDiffItem,
  StyleKey,
  IconBatchItem,
  SyncConfig,
  ColorVariableItem,
} from '../types';
import { fetchGoogleMetadata, fetchIconAllVariants } from './api';
import { computeDiff, DiffSummary } from './diff';

// Global state
let remoteIcons: IconMetadataItem[] = [];
let existingIcons: ExistingIconRecord[] = [];
let diffSummary: DiffSummary | null = null;
let isSyncing = false;
let shouldCancel = false;
let currentBatchResolver: (() => void) | null = null;

export interface FailedIconItem {
  name: string;
  category: string;
  remoteVersion: number;
  reason: string;
}

let failedIcons: FailedIconItem[] = [];
let liveStats = {
  added: 0,
  updated: 0,
  fresh: 0,
  errors: 0,
};

// DOM Elements - Navigation & Views
const loadingView = document.getElementById('loadingView') as HTMLElement;
const dashboardView = document.getElementById('dashboardView') as HTMLElement;
const syncView = document.getElementById('syncView') as HTMLElement;
const pageBadge = document.getElementById('pageBadge') as HTMLElement;
const footerElement = document.querySelector('.footer') as HTMLElement;

// Freshness Banner
const freshnessNotice = document.getElementById('freshnessNotice') as HTMLElement;
const freshnessText = document.getElementById('freshnessText') as HTMLElement;

// Dashboard Stat Counters
const statNew = document.getElementById('statNew') as HTMLElement;
const statModified = document.getElementById('statModified') as HTMLElement;
const statUpToDate = document.getElementById('statUpToDate') as HTMLElement;
const statDeprecated = document.getElementById('statDeprecated') as HTMLElement;

// Dashboard Options
const checkOutlined = document.getElementById('checkOutlined') as HTMLInputElement;
const checkRounded = document.getElementById('checkRounded') as HTMLInputElement;
const checkSharp = document.getElementById('checkSharp') as HTMLInputElement;
const checkFill = document.getElementById('checkFill') as HTMLInputElement;

const customVariableInput = document.getElementById('customVariableInput') as HTMLInputElement;
const tokenPicker = document.getElementById('tokenPicker') as HTMLElement;
const tokenPickerTrigger = document.getElementById('tokenPickerTrigger') as HTMLElement;
const tokenPickerSelectedLabel = document.getElementById('tokenPickerSelectedLabel') as HTMLElement;
const btnTokenClear = document.getElementById('btnTokenClear') as HTMLButtonElement;
const tokenPickerDropdown = document.getElementById('tokenPickerDropdown') as HTMLElement;
const tokenSearchInput = document.getElementById('tokenSearchInput') as HTMLInputElement;
const tokenPickerList = document.getElementById('tokenPickerList') as HTMLElement;

const categorySearch = document.getElementById('categorySearch') as HTMLInputElement;
const categoryList = document.getElementById('categoryList') as HTMLElement;
const btnSelectAllCats = document.getElementById('btnSelectAllCats') as HTMLButtonElement;
const btnDeselectAllCats = document.getElementById('btnDeselectAllCats') as HTMLButtonElement;

// Sync View Elements
const syncStatusIndicator = document.getElementById('syncStatusIndicator') as HTMLElement;
const syncTitle = document.getElementById('syncTitle') as HTMLElement;
const syncSubtitle = document.getElementById('syncSubtitle') as HTMLElement;
const syncPhaseBadge = document.getElementById('syncPhaseBadge') as HTMLElement;
const syncProgressCount = document.getElementById('syncProgressCount') as HTMLElement;
const syncProgressPercent = document.getElementById('syncProgressPercent') as HTMLElement;
const syncProgressBarFill = document.getElementById('syncProgressBarFill') as HTMLElement;
const syncBatchStatus = document.getElementById('syncBatchStatus') as HTMLElement;
const syncCountNew = document.getElementById('syncCountNew') as HTMLElement;
const syncCountUpdated = document.getElementById('syncCountUpdated') as HTMLElement;
const syncCountFresh = document.getElementById('syncCountFresh') as HTMLElement;
const syncCountErrors = document.getElementById('syncCountErrors') as HTMLElement;
const syncCurrentAction = document.getElementById('syncCurrentAction') as HTMLElement;
const syncCurrentIconName = document.getElementById('syncCurrentIconName') as HTMLElement;
const syncCurrentCategory = document.getElementById('syncCurrentCategory') as HTMLElement;
const syncLogList = document.getElementById('syncLogList') as HTMLElement;

// Sync Error Report & Controls
const syncErrorReportBox = document.getElementById('syncErrorReportBox') as HTMLElement;
const syncErrorReportCount = document.getElementById('syncErrorReportCount') as HTMLElement;
const syncErrorReportList = document.getElementById('syncErrorReportList') as HTMLElement;
const btnSyncRetryErrors = document.getElementById('btnSyncRetryErrors') as HTMLButtonElement;
const btnSyncCopyErrors = document.getElementById('btnSyncCopyErrors') as HTMLButtonElement;
const btnSyncCancel = document.getElementById('btnSyncCancel') as HTMLButtonElement;
const btnSyncDone = document.getElementById('btnSyncDone') as HTMLButtonElement;

// Main Dashboard Buttons
const btnSync = document.getElementById('btnSync') as HTMLButtonElement;
const btnSyncSpinner = document.getElementById('btnSyncSpinner') as HTMLElement;
const btnSyncText = document.getElementById('btnSyncText') as HTMLElement;
const btnRefresh = document.getElementById('btnRefresh') as HTMLButtonElement;

// Post message to Figma sandbox
function sendToFigma(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Initialize and fetch data
async function init() {
  try {
    loadingView.style.display = 'flex';
    dashboardView.style.display = 'none';

    // Fetch Google metadata
    if (remoteIcons.length === 0) {
      remoteIcons = await fetchGoogleMetadata();
    }

    // Request Figma file scan
    sendToFigma({ type: 'SCAN_PAGE' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    loadingView.innerHTML = `
      <div style="color: var(--danger); text-align: center; padding: 20px;">
        <strong>Erreur de chargement</strong><br/>
        <p style="font-size: 11px; margin-top: 6px;">${errorMsg}</p>
        <button id="btnRetryInit" class="btn btn-secondary" style="margin-top: 12px;">Réessayer</button>
      </div>
    `;
    document.getElementById('btnRetryInit')?.addEventListener('click', init);
  }
}

function appendSyncLog(
  iconName: string,
  category: string,
  type: 'created' | 'updated' | 'error',
  detail?: string
) {
  const row = document.createElement('div');
  row.className = 'sync-log-item';

  const left = document.createElement('div');
  left.className = 'sync-log-left';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'sync-log-icon-name';
  nameSpan.textContent = iconName;

  const catSpan = document.createElement('span');
  catSpan.style.color = 'var(--text-secondary)';
  catSpan.textContent = `(${category})`;

  left.appendChild(nameSpan);
  left.appendChild(catSpan);

  const badge = document.createElement('span');
  badge.className = `sync-log-badge ${type}`;
  if (type === 'created') {
    badge.textContent = '+ Créé';
  } else if (type === 'updated') {
    badge.textContent = '↻ Mis à jour';
  } else {
    badge.textContent = '✕ Échec';
    if (detail) badge.title = detail;
  }

  row.appendChild(left);
  row.appendChild(badge);
  syncLogList.prepend(row);
}

// Handle messages from Figma sandbox
window.onmessage = (event) => {
  const msg: PluginMessage = event.data.pluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case 'INIT_STATE': {
      existingIcons = msg.payload.existingIcons;
      pageBadge.textContent = `Page : ${msg.payload.pageName}`;
      if (msg.payload.colorVariables) {
        populateColorVariables(msg.payload.colorVariables);
      }
      renderDashboard();
      break;
    }

    case 'VARIABLES_LOADED': {
      if (msg.payload.colorVariables) {
        populateColorVariables(msg.payload.colorVariables);
      }
      break;
    }

    case 'SYNC_PROGRESS': {
      const { current, total, iconName, category, action } = msg.payload;
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      syncProgressPercent.textContent = `${pct}%`;
      syncProgressBarFill.style.width = `${pct}%`;
      syncProgressCount.textContent = `${current} / ${total}`;
      syncCurrentAction.textContent = 'Écriture dans Figma :';
      syncCurrentIconName.textContent = iconName;
      syncCurrentCategory.textContent = category || 'General';

      if (action === 'created') {
        liveStats.added++;
        syncCountNew.textContent = `+${liveStats.added}`;
        appendSyncLog(iconName, category || 'General', 'created');
      } else if (action === 'updated') {
        liveStats.updated++;
        syncCountUpdated.textContent = String(liveStats.updated);
        appendSyncLog(iconName, category || 'General', 'updated');
      }
      break;
    }

    case 'BATCH_COMPLETE': {
      if (currentBatchResolver) {
        currentBatchResolver();
        currentBatchResolver = null;
      }
      break;
    }

    case 'SYNC_COMPLETE': {
      if (currentBatchResolver) {
        currentBatchResolver();
        currentBatchResolver = null;
      }
      finishSync();
      break;
    }

    case 'SYNC_ERROR': {
      if (currentBatchResolver) {
        currentBatchResolver();
        currentBatchResolver = null;
      }
      finishSync(msg.payload.message);
      break;
    }
  }
};

function renderDashboard() {
  diffSummary = computeDiff(remoteIcons, existingIcons);

  statNew.textContent = String(diffSummary.newCount);
  statModified.textContent = String(diffSummary.modifiedCount);
  statUpToDate.textContent = String(diffSummary.upToDateCount);
  statDeprecated.textContent = String(diffSummary.deprecatedCount);

  if (diffSummary.freshCount > 0) {
    freshnessNotice.style.display = 'flex';
    freshnessText.textContent = `${diffSummary.freshCount} icône(s) importée(s) il y a moins de 24h (fraîcheur garantie, non retéléchargées).`;
  } else {
    freshnessNotice.style.display = 'none';
  }

  renderCategoryCheckboxes();
  updateSyncButton();

  loadingView.style.display = 'none';
  syncView.style.display = 'none';
  dashboardView.style.display = 'flex';
  footerElement.style.display = 'flex';
}

function getSelectedStyles(): StyleKey[] {
  const styles: StyleKey[] = [];
  if (checkOutlined.checked) styles.push('outlined');
  if (checkRounded.checked) styles.push('rounded');
  if (checkSharp.checked) styles.push('sharp');
  return styles;
}

function getSelectedCategories(): string[] {
  const checkboxes = categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map((cb) => cb.value);
}

function renderCategoryCheckboxes() {
  if (!diffSummary) return;

  // Count items per category
  const countMap = new Map<string, number>();
  for (const item of diffSummary.items) {
    countMap.set(item.category, (countMap.get(item.category) || 0) + 1);
  }

  const query = categorySearch.value.toLowerCase().trim();
  categoryList.innerHTML = '';

  for (const cat of diffSummary.categories) {
    if (query && !cat.toLowerCase().includes(query)) continue;

    const count = countMap.get(cat) || 0;
    const label = document.createElement('label');
    label.className = 'category-item custom-checkbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = cat;
    checkbox.checked = true; // default checked
    checkbox.addEventListener('change', updateSyncButton);

    const spanText = document.createElement('span');
    spanText.textContent = cat;

    const spanCount = document.createElement('span');
    spanCount.className = 'category-count';
    spanCount.textContent = `(${count})`;

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '6px';
    left.appendChild(checkbox);
    left.appendChild(spanText);

    label.appendChild(left);
    label.appendChild(spanCount);
    categoryList.appendChild(label);
  }
}

function updateSyncButton() {
  if (!diffSummary) return;

  const styles = getSelectedStyles();
  const selectedCats = new Set(getSelectedCategories());
  const scopeRadio = document.querySelector<HTMLInputElement>('input[name="syncScope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : 'updates_only';

  if (styles.length === 0 || selectedCats.size === 0) {
    btnSync.disabled = true;
    btnSyncText.textContent = 'Sélectionnez au moins 1 style et 1 catégorie';
    return;
  }

  // Filter items matching selected categories and scope, en EXCLUANT strictement les icônes fraîches (< 24h)
  const targetItems = diffSummary.items.filter((item) => {
    if (!selectedCats.has(item.category)) return false;
    if (item.isFresh) return false; // Ne jamais retélécharger une icône de moins de 24h !
    if (scope === 'updates_only') {
      return item.status === 'new' || item.status === 'modified';
    }
    return true; // all selected non-fresh
  });

  btnSync.disabled = targetItems.length === 0;
  if (targetItems.length === 0) {
    if (diffSummary.freshCount > 0) {
      btnSyncText.textContent = 'Tout est déjà à jour (< 24h) !';
    } else {
      btnSyncText.textContent = 'Tout est déjà à jour !';
    }
  } else {
    const newCount = targetItems.filter((i) => i.status === 'new').length;
    const updateCount = targetItems.filter((i) => i.status !== 'new').length;

    if (newCount > 0 && updateCount > 0) {
      btnSyncText.textContent = `Synchroniser (${newCount} manquantes prioritaires + ${updateCount} màj)`;
    } else if (newCount > 0) {
      btnSyncText.textContent = `Synchroniser (${newCount} icônes manquantes)`;
    } else {
      btnSyncText.textContent = `Synchroniser (${updateCount} icônes à mettre à jour)`;
    }
  }
}

interface SyncTarget {
  name: string;
  category: string;
  status: 'new' | 'modified' | 'up_to_date' | 'deprecated';
  remoteVersion: number;
}

// Start synchronization with dedicated Sync View & Missing-First Priority
async function startSync(retryList?: FailedIconItem[]) {
  if (isSyncing) return;

  const styles = getSelectedStyles();
  const includeFill = checkFill.checked;
  const selectedCats = new Set(getSelectedCategories());
  const scopeRadio = document.querySelector<HTMLInputElement>('input[name="syncScope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : 'updates_only';

  let targetDiffItems: SyncTarget[] = [];

  if (retryList && retryList.length > 0) {
    targetDiffItems = retryList.map((r) => ({
      name: r.name,
      category: r.category,
      status: 'new',
      remoteVersion: r.remoteVersion,
    }));
    failedIcons = [];
  } else {
    if (!diffSummary) return;

    // 1. Filtrer les icônes éligibles (excluant strictement les fraîches < 24h)
    targetDiffItems = diffSummary.items
      .filter((item) => {
        if (!selectedCats.has(item.category)) return false;
        if (item.isFresh) return false; // Règle 24h : aucun retéléchargement d'icône récente
        if (scope === 'updates_only') {
          return item.status === 'new' || item.status === 'modified';
        }
        return true;
      })
      .map((item) => ({
        name: item.name,
        category: item.category,
        status: item.status,
        remoteVersion: item.remoteVersion,
      }));

    // 2. Règle de priorité : les icônes absentes du doc ('new') sont chargées et injectées EN PREMIER !
    targetDiffItems.sort((a, b) => {
      const aNew = a.status === 'new' ? 0 : 1;
      const bNew = b.status === 'new' ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew; // 'new' en tête
      const catComp = a.category.localeCompare(b.category);
      if (catComp !== 0) return catComp;
      return a.name.localeCompare(b.name);
    });

    failedIcons = [];
  }

  if (targetDiffItems.length === 0) return;

  isSyncing = true;
  shouldCancel = false;

  const total = targetDiffItems.length;
  const missingCount = targetDiffItems.filter((i) => i.status === 'new').length;
  const updateCount = total - missingCount;

  // Réinitialiser les compteurs de session
  liveStats = {
    added: 0,
    updated: 0,
    fresh: diffSummary?.freshCount || 0,
    errors: 0,
  };

  // Basculer vers la vue spécifique de synchronisation
  dashboardView.style.display = 'none';
  footerElement.style.display = 'none';
  syncView.style.display = 'flex';

  syncStatusIndicator.className = 'sync-pulsing-dot';
  syncTitle.textContent = 'Synchronisation en cours';
  syncSubtitle.textContent = missingCount > 0
    ? `Priorité aux ${missingCount} icône(s) manquante(s) dans le document.`
    : `Mise à jour de ${updateCount} icône(s) existante(s).`;

  syncPhaseBadge.textContent = missingCount > 0 ? 'Priorité : Icônes manquantes' : 'Mise à jour des icônes';
  syncPhaseBadge.className = `sync-phase-badge ${missingCount > 0 ? '' : 'phase-updates'}`;

  syncProgressCount.textContent = `0 / ${total}`;
  syncProgressPercent.textContent = '0%';
  syncProgressBarFill.style.width = '0%';
  syncBatchStatus.textContent = `Préparation des lots (${Math.ceil(total / 15)} lots de 15)...`;

  syncCountNew.textContent = '+0';
  syncCountUpdated.textContent = '0';
  syncCountFresh.textContent = String(liveStats.fresh);
  syncCountErrors.textContent = '0';

  syncCurrentAction.textContent = 'Initialisation :';
  syncCurrentIconName.textContent = targetDiffItems[0].name;
  syncCurrentCategory.textContent = targetDiffItems[0].category;

  syncLogList.innerHTML = '';
  syncErrorReportBox.style.display = 'none';
  btnSyncCancel.style.display = 'flex';
  btnSyncDone.style.display = 'none';

  const BATCH_SIZE = 15;

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (shouldCancel) {
        sendToFigma({ type: 'CANCEL_SYNC' });
        break;
      }

      const chunk = targetDiffItems.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      syncBatchStatus.textContent = `Traitement du lot ${batchNum} / ${totalBatches}...`;

      // Actualisation dynamique de la phase courante
      const hasNewInChunk = chunk.some((c) => c.status === 'new');
      if (hasNewInChunk) {
        syncPhaseBadge.textContent = 'Priorité : Icônes manquantes';
        syncPhaseBadge.className = 'sync-phase-badge';
      } else {
        syncPhaseBadge.textContent = 'Mise à jour des icônes';
        syncPhaseBadge.className = 'sync-phase-badge phase-updates';
      }

      // Télécharger en parallèle les SVGs pour ce lot
      const batchItems: IconBatchItem[] = [];

      await Promise.all(
        chunk.map(async (item) => {
          try {
            syncCurrentAction.textContent = 'Téléchargement SVG :';
            syncCurrentIconName.textContent = item.name;
            syncCurrentCategory.textContent = item.category;

            const variants = await fetchIconAllVariants(item.name, styles, includeFill);
            batchItems.push({
              name: item.name,
              category: item.category,
              version: item.remoteVersion,
              variants,
            });
          } catch (err: unknown) {
            const reason = err instanceof Error ? err.message : String(err);
            console.warn(`[Sync] Failed to fetch icon "${item.name}":`, reason);
            failedIcons.push({
              name: item.name,
              category: item.category,
              remoteVersion: item.remoteVersion,
              reason,
            });
            liveStats.errors++;
            syncCountErrors.textContent = String(liveStats.errors);
            appendSyncLog(item.name, item.category, 'error', reason);
          }
        })
      );

      if (shouldCancel) break;

      if (batchItems.length > 0) {
        const config: SyncConfig = {
          selectedStyles: styles,
          includeFill,
          selectedCategories: Array.from(selectedCats),
          colorVariableId: getSelectedColorVariableId(),
        };

        const isFirst = i === 0;
        const isLast = i + BATCH_SIZE >= total;

        const batchPromise = new Promise<void>((resolve) => {
          currentBatchResolver = resolve;
        });

        sendToFigma({
          type: 'START_SYNC_BATCH',
          payload: {
            items: batchItems,
            config,
            isFirst,
            isLast,
            batchIndex: Math.floor(i / BATCH_SIZE),
            totalBatches,
            overallTotal: total,
          },
        });

        await batchPromise;
      } else if (i + BATCH_SIZE >= total) {
        finishSync();
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Batch sync loop error:', errorMsg);
    finishSync(errorMsg);
  }
}

function finishSync(errorMsg?: string) {
  isSyncing = false;
  currentBatchResolver = null;

  if (shouldCancel) {
    syncStatusIndicator.className = 'sync-pulsing-dot stopped';
    syncTitle.textContent = 'Synchronisation interrompue';
    syncSubtitle.textContent = 'L\'opération a été arrêtée. Les éléments déjà injectés ont été conservés.';
    syncPhaseBadge.textContent = 'Interrompu';
    syncPhaseBadge.className = 'sync-phase-badge phase-updates';
  } else if (errorMsg) {
    syncStatusIndicator.className = 'sync-pulsing-dot stopped';
    syncTitle.textContent = 'Erreur de synchronisation';
    syncSubtitle.textContent = errorMsg;
    syncPhaseBadge.textContent = 'Erreur';
    syncPhaseBadge.className = 'sync-phase-badge';
  } else {
    syncStatusIndicator.className = 'sync-pulsing-dot success';
    syncTitle.textContent = 'Synchronisation terminée !';
    syncSubtitle.textContent = `Opération complétée : +${liveStats.added} nouvelle(s), ${liveStats.updated} mise(s) à jour, ${liveStats.fresh} ignorée(s) car importée(s) il y a moins de 24h.`;
    syncPhaseBadge.textContent = 'Succès';
    syncPhaseBadge.className = 'sync-phase-badge phase-done';
    syncProgressPercent.textContent = '100%';
    syncProgressBarFill.style.width = '100%';
  }

  syncCurrentAction.textContent = 'Terminé';
  syncCurrentIconName.textContent = shouldCancel ? 'Arrêté' : 'Prêt';
  syncCurrentCategory.textContent = 'Figma';

  btnSyncCancel.style.display = 'none';
  btnSyncDone.style.display = 'flex';

  renderSyncErrorReport();
}

function renderSyncErrorReport() {
  if (failedIcons.length === 0) {
    syncErrorReportBox.style.display = 'none';
    return;
  }

  syncErrorReportCount.textContent = `${failedIcons.length} icône(s) non chargée(s)`;
  syncErrorReportList.innerHTML = '';

  for (const item of failedIcons) {
    const row = document.createElement('div');
    row.className = 'error-item';
    row.innerHTML = `
      <span class="error-item-name">${item.name}</span>
      <span class="error-item-category">${item.category}</span>
    `;
    syncErrorReportList.appendChild(row);
  }

  syncErrorReportBox.style.display = 'flex';
  btnSyncRetryErrors.textContent = `Réessayer (${failedIcons.length})`;
}

// Event Listeners
btnSync.addEventListener('click', () => startSync());

btnSyncDone.addEventListener('click', () => {
  syncView.style.display = 'none';
  loadingView.style.display = 'flex';
  sendToFigma({ type: 'SCAN_PAGE' });
});

btnSyncCancel.addEventListener('click', () => {
  shouldCancel = true;
  syncSubtitle.textContent = 'Annulation en cours...';
  syncStatusIndicator.className = 'sync-pulsing-dot stopped';
  sendToFigma({ type: 'CANCEL_SYNC' });
});

btnSyncRetryErrors.addEventListener('click', () => {
  if (failedIcons.length === 0) return;
  const toRetry = [...failedIcons];
  failedIcons = [];
  startSync(toRetry);
});

btnSyncCopyErrors.addEventListener('click', async () => {
  const text = failedIcons.map((i) => i.name).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    btnSyncCopyErrors.textContent = 'Copié !';
    setTimeout(() => {
      btnSyncCopyErrors.textContent = 'Copier la liste';
    }, 2000);
  } catch {
    alert(text);
  }
});

btnRefresh.addEventListener('click', () => {
  sendToFigma({ type: 'SCAN_PAGE' });
});

categorySearch.addEventListener('input', renderCategoryCheckboxes);

btnSelectAllCats.addEventListener('click', () => {
  categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.checked = true;
  });
  updateSyncButton();
});

btnDeselectAllCats.addEventListener('click', () => {
  categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
  updateSyncButton();
});

checkOutlined.addEventListener('change', updateSyncButton);
checkRounded.addEventListener('change', updateSyncButton);
checkSharp.addEventListener('change', updateSyncButton);
checkFill.addEventListener('change', updateSyncButton);

document.querySelectorAll<HTMLInputElement>('input[name="syncScope"]').forEach((radio) => {
  radio.addEventListener('change', updateSyncButton);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let availableTokens: ColorVariableItem[] = [];
let selectedTokenId: string | undefined = undefined;
let isCustomTokenSelected = false;

function populateColorVariables(variables: ColorVariableItem[]) {
  availableTokens = variables || [];
  const hintEl = document.getElementById('variableCountHint');

  if (availableTokens.length > 0) {
    if (hintEl) {
      hintEl.innerHTML = `<span style="color: var(--success, #34c759)">✓ ${availableTokens.length} token(s) disponible(s)</span>`;
    }
  } else {
    if (hintEl) {
      hintEl.innerHTML = `<span style="color: var(--text-secondary)">ℹ️ 0 token détecté. Si vos variables sont dans un autre fichier, vérifiez que la bibliothèque est bien publiée et activée dans <strong>Assets > Libraries</strong> (icône livre 📚).</span>`;
    }
  }

  // Restore selection if previously selected token is still in list
  if (selectedTokenId && !isCustomTokenSelected) {
    const found = availableTokens.find((t) => t.id === selectedTokenId);
    if (found) {
      updateTriggerLabel(found);
    } else {
      selectNone();
    }
  }
}

function updateTriggerLabel(token: ColorVariableItem | null) {
  if (token) {
    tokenPickerSelectedLabel.innerHTML = `<strong>${escapeHtml(token.name)}</strong><span class="token-badge-collection">(${escapeHtml(token.collectionName || 'Variables')})</span>`;
    btnTokenClear.style.display = 'inline-flex';
  } else if (isCustomTokenSelected) {
    tokenPickerSelectedLabel.innerHTML = '✏️ <em>Valeur personnalisée...</em>';
    btnTokenClear.style.display = 'inline-flex';
  } else {
    tokenPickerSelectedLabel.textContent = 'Aucune variable (couleur par défaut #1C1C1E)';
    btnTokenClear.style.display = 'none';
  }
}

function selectToken(token: ColorVariableItem) {
  selectedTokenId = token.id;
  isCustomTokenSelected = false;
  updateTriggerLabel(token);
  customVariableInput.style.display = 'none';
  closeTokenDropdown();
}

function selectNone() {
  selectedTokenId = undefined;
  isCustomTokenSelected = false;
  updateTriggerLabel(null);
  customVariableInput.style.display = 'none';
  closeTokenDropdown();
}

function selectCustom() {
  selectedTokenId = undefined;
  isCustomTokenSelected = true;
  updateTriggerLabel(null);
  customVariableInput.style.display = 'block';
  customVariableInput.focus();
  closeTokenDropdown();
}

function openTokenDropdown() {
  tokenPickerTrigger.classList.add('open');
  tokenPickerDropdown.style.display = 'flex';
  tokenSearchInput.value = '';
  renderTokenPickerList('');
  setTimeout(() => tokenSearchInput.focus(), 25);
}

function closeTokenDropdown() {
  tokenPickerTrigger.classList.remove('open');
  tokenPickerDropdown.style.display = 'none';
}

function toggleTokenDropdown() {
  if (tokenPickerDropdown.style.display === 'none') {
    openTokenDropdown();
  } else {
    closeTokenDropdown();
  }
}

function renderTokenPickerList(query: string) {
  tokenPickerList.innerHTML = '';
  const cleanQ = query.trim().toLowerCase();

  // Option 1: None / Default
  const noneItem = document.createElement('div');
  noneItem.className = `token-item ${!selectedTokenId && !isCustomTokenSelected ? 'selected' : ''}`;
  noneItem.innerHTML = `<span class="token-item-name">Aucune variable (couleur par défaut #1C1C1E)</span>`;
  noneItem.addEventListener('click', () => selectNone());
  tokenPickerList.appendChild(noneItem);

  // Filter tokens by name or collection
  const filtered = cleanQ
    ? availableTokens.filter(
        (t) =>
          t.name.toLowerCase().includes(cleanQ) ||
          (t.collectionName && t.collectionName.toLowerCase().includes(cleanQ))
      )
    : availableTokens;

  if (filtered.length > 0) {
    const byCollection = new Map<string, ColorVariableItem[]>();
    for (const t of filtered) {
      const coll = t.collectionName || 'Variables';
      if (!byCollection.has(coll)) byCollection.set(coll, []);
      byCollection.get(coll)!.push(t);
    }

    for (const [collName, tokens] of byCollection.entries()) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'token-group-title';
      groupHeader.textContent = `${collName} (${tokens.length})`;
      tokenPickerList.appendChild(groupHeader);

      for (const token of tokens) {
        const itemEl = document.createElement('div');
        const isSelected = selectedTokenId === token.id;
        itemEl.className = `token-item ${isSelected ? 'selected' : ''}`;
        itemEl.innerHTML = `
          <span class="token-item-name" title="${escapeHtml(token.name)}">${escapeHtml(token.name)}</span>
          <span class="token-item-tag">${token.type === 'style' ? 'Style' : 'Var'}</span>
        `;
        itemEl.addEventListener('click', () => selectToken(token));
        tokenPickerList.appendChild(itemEl);
      }
    }
  } else if (cleanQ) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'token-empty-message';
    emptyEl.textContent = `Aucun token ne correspond à "${query}"`;
    tokenPickerList.appendChild(emptyEl);
  }

  // Option 2: Custom ID / key
  const customItem = document.createElement('div');
  customItem.className = `token-item token-item-special ${isCustomTokenSelected ? 'selected' : ''}`;
  customItem.innerHTML = `<span class="token-item-name">✏️ Saisir un ID ou une clé personnalisée...</span>`;
  customItem.addEventListener('click', () => selectCustom());
  tokenPickerList.appendChild(customItem);
}

function getSelectedColorVariableId(): string | undefined {
  if (isCustomTokenSelected) {
    const val = customVariableInput.value.trim();
    return val || undefined;
  }
  return selectedTokenId;
}

// Token picker listeners
tokenPickerTrigger.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#btnTokenClear')) {
    return;
  }
  toggleTokenDropdown();
});

tokenPickerTrigger.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
    e.preventDefault();
    openTokenDropdown();
  }
});

btnTokenClear.addEventListener('click', (e) => {
  e.stopPropagation();
  selectNone();
});

tokenSearchInput.addEventListener('input', () => {
  renderTokenPickerList(tokenSearchInput.value);
});

tokenSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTokenDropdown();
    tokenPickerTrigger.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!tokenPicker.contains(e.target as Node)) {
    closeTokenDropdown();
  }
});

const btnRefreshVariables = document.getElementById('btnRefreshVariables');
if (btnRefreshVariables) {
  btnRefreshVariables.addEventListener('click', () => {
    const hintEl = document.getElementById('variableCountHint');
    if (hintEl) {
      hintEl.innerHTML = '<span style="color: var(--text-secondary)">Scan des tokens en cours...</span>';
    }
    sendToFigma({ type: 'REFRESH_VARIABLES' });
  });
}

// Kick off
init();
