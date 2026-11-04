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

// DOM Elements
const loadingView = document.getElementById('loadingView') as HTMLElement;
const dashboardView = document.getElementById('dashboardView') as HTMLElement;
const pageBadge = document.getElementById('pageBadge') as HTMLElement;

const statNew = document.getElementById('statNew') as HTMLElement;
const statModified = document.getElementById('statModified') as HTMLElement;
const statUpToDate = document.getElementById('statUpToDate') as HTMLElement;
const statDeprecated = document.getElementById('statDeprecated') as HTMLElement;

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

// Error report elements
const errorReportBox = document.getElementById('errorReportBox') as HTMLElement;
const errorReportCount = document.getElementById('errorReportCount') as HTMLElement;
const errorReportList = document.getElementById('errorReportList') as HTMLElement;
const btnCloseErrorReport = document.getElementById('btnCloseErrorReport') as HTMLButtonElement;
const btnRetryErrors = document.getElementById('btnRetryErrors') as HTMLButtonElement;
const btnRetryText = document.getElementById('btnRetryText') as HTMLElement;
const btnCopyErrors = document.getElementById('btnCopyErrors') as HTMLButtonElement;

export interface FailedIconItem {
  name: string;
  category: string;
  remoteVersion: number;
  reason: string;
}

let failedIcons: FailedIconItem[] = [];

const categorySearch = document.getElementById('categorySearch') as HTMLInputElement;
const categoryList = document.getElementById('categoryList') as HTMLElement;
const btnSelectAllCats = document.getElementById('btnSelectAllCats') as HTMLButtonElement;
const btnDeselectAllCats = document.getElementById('btnDeselectAllCats') as HTMLButtonElement;

const progressBox = document.getElementById('progressBox') as HTMLElement;
const progressStatusText = document.getElementById('progressStatusText') as HTMLElement;
const progressPercent = document.getElementById('progressPercent') as HTMLElement;
const progressBarFill = document.getElementById('progressBarFill') as HTMLElement;
const currentIconName = document.getElementById('currentIconName') as HTMLElement;
const btnCancelSync = document.getElementById('btnCancelSync') as HTMLButtonElement;

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
      const { current, total, iconName } = msg.payload;
      const pct = Math.round((current / total) * 100);
      progressPercent.textContent = `${pct}% (${current}/${total})`;
      progressBarFill.style.width = `${pct}%`;
      currentIconName.textContent = `Écriture dans Figma : ${iconName}`;
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
      // Re-scan page to update diff state
      sendToFigma({ type: 'SCAN_PAGE' });
      break;
    }

    case 'SYNC_ERROR': {
      if (currentBatchResolver) {
        currentBatchResolver();
        currentBatchResolver = null;
      }
      alert(`Erreur de synchronisation : ${msg.payload.message}`);
      finishSync();
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

  renderCategoryCheckboxes();
  updateSyncButton();

  loadingView.style.display = 'none';
  dashboardView.style.display = 'flex';
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

  // Filter items matching selected categories and scope
  const targetItems = diffSummary.items.filter((item) => {
    if (!selectedCats.has(item.category)) return false;
    if (scope === 'updates_only') {
      return item.status === 'new' || item.status === 'modified';
    }
    return true; // all selected
  });

  btnSync.disabled = targetItems.length === 0;
  if (targetItems.length === 0) {
    btnSyncText.textContent = 'Tout est déjà à jour !';
  } else {
    btnSyncText.textContent = `Synchroniser (${targetItems.length} icônes)`;
  }
}

// Start synchronization
async function startSync(retryList?: FailedIconItem[]) {
  if (isSyncing) return;

  const styles = getSelectedStyles();
  const includeFill = checkFill.checked;
  const selectedCats = new Set(getSelectedCategories());
  const scopeRadio = document.querySelector<HTMLInputElement>('input[name="syncScope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : 'updates_only';

  interface SyncTarget {
    name: string;
    category: string;
    remoteVersion: number;
  }

  let targetDiffItems: SyncTarget[] = [];

  if (retryList && retryList.length > 0) {
    targetDiffItems = retryList.map((r) => ({
      name: r.name,
      category: r.category,
      remoteVersion: r.remoteVersion,
    }));
    errorReportBox.style.display = 'none';
  } else {
    if (!diffSummary) return;
    targetDiffItems = diffSummary.items
      .filter((item) => {
        if (!selectedCats.has(item.category)) return false;
        if (scope === 'updates_only') {
          return item.status === 'new' || item.status === 'modified';
        }
        return true;
      })
      .map((item) => ({
        name: item.name,
        category: item.category,
        remoteVersion: item.remoteVersion,
      }));
    failedIcons = [];
    errorReportBox.style.display = 'none';
  }

  if (targetDiffItems.length === 0) return;

  isSyncing = true;
  shouldCancel = false;

  btnSync.disabled = true;
  btnRefresh.disabled = true;
  btnSyncSpinner.style.display = 'inline-block';
  btnSyncText.textContent = 'Synchronisation en cours...';

  progressBox.style.display = 'flex';
  progressBarFill.style.width = '0%';
  progressPercent.textContent = `0% (0/${targetDiffItems.length})`;
  progressStatusText.textContent = 'Téléchargement des fichiers vectoriels...';

  const BATCH_SIZE = 15;
  const total = targetDiffItems.length;

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (shouldCancel) {
        sendToFigma({ type: 'CANCEL_SYNC' });
        break;
      }

      const chunk = targetDiffItems.slice(i, i + BATCH_SIZE);
      progressStatusText.textContent = `Téléchargement du lot ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(total / BATCH_SIZE)}...`;

      // Fetch SVGs for all variants in parallel for this batch, collecting errors individually
      const batchItems: IconBatchItem[] = [];

      await Promise.all(
        chunk.map(async (item) => {
          try {
            currentIconName.textContent = `Téléchargement : ${item.name}...`;
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
            // Record failure without stopping the rest of the sync!
            failedIcons.push({
              name: item.name,
              category: item.category,
              remoteVersion: item.remoteVersion,
              reason,
            });
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

        // Send batch to Figma and wait until it is fully written into the page
        sendToFigma({
          type: 'START_SYNC_BATCH',
          payload: {
            items: batchItems,
            config,
            isFirst,
            isLast,
            batchIndex: Math.floor(i / BATCH_SIZE),
            totalBatches: Math.ceil(total / BATCH_SIZE),
            overallTotal: total,
          },
        });

        await batchPromise;
      } else if (i + BATCH_SIZE >= total) {
        // Last batch had no items to write (all failed to download)
        finishSync();
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Batch sync loop error:', errorMsg);
    finishSync();
  }
}

function finishSync() {
  isSyncing = false;
  shouldCancel = false;
  btnSyncSpinner.style.display = 'none';
  btnRefresh.disabled = false;
  progressBox.style.display = 'none';
  updateSyncButton();
  renderErrorReport();
}

function renderErrorReport() {
  if (failedIcons.length === 0) {
    errorReportBox.style.display = 'none';
    return;
  }

  errorReportCount.textContent = `${failedIcons.length} icône(s) non chargée(s)`;
  errorReportList.innerHTML = '';

  for (const item of failedIcons) {
    const row = document.createElement('div');
    row.className = 'error-item';
    row.innerHTML = `
      <span class="error-item-name">${item.name}</span>
      <span class="error-item-category">${item.category}</span>
    `;
    errorReportList.appendChild(row);
  }

  errorReportBox.style.display = 'flex';
  btnRetryText.textContent = `Réessayer (${failedIcons.length})`;
}

// Event Listeners
btnSync.addEventListener('click', () => startSync());

btnCloseErrorReport.addEventListener('click', () => {
  errorReportBox.style.display = 'none';
});

btnRetryErrors.addEventListener('click', () => {
  if (failedIcons.length === 0) return;
  const toRetry = [...failedIcons];
  failedIcons = [];
  startSync(toRetry);
});

btnCopyErrors.addEventListener('click', async () => {
  const text = failedIcons.map((i) => i.name).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    btnCopyErrors.textContent = 'Copié !';
    setTimeout(() => {
      btnCopyErrors.textContent = 'Copier la liste';
    }, 2000);
  } catch {
    alert(text);
  }
});

btnCancelSync.addEventListener('click', () => {
  shouldCancel = true;
  progressStatusText.textContent = 'Annulation demandée...';
  sendToFigma({ type: 'CANCEL_SYNC' });
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
