import { UIMessage, PluginMessage } from '../types';
import { scanExistingIcons, fetchColorVariables } from './scanner';
import { LibraryBuilder } from './builder';

figma.showUI(__html__, {
  width: 440,
  height: 620,
  themeColors: true,
  title: 'Material Symbols Sync',
});

let isCancelled = false;
let activeBuilder: LibraryBuilder | null = null;
let sessionStats = { added: 0, updated: 0, totalProcessed: 0 };

function postMessage(msg: PluginMessage) {
  figma.ui.postMessage(msg);
}

async function handleScan() {
  const existing = scanExistingIcons();
  const colorVariables = await fetchColorVariables();
  postMessage({
    type: 'INIT_STATE',
    payload: {
      existingIcons: existing,
      pageName: figma.currentPage.name,
      colorVariables,
    },
  });
}

// Initial scan upon plugin launch
handleScan();

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'SCAN_PAGE': {
      await handleScan();
      break;
    }

    case 'CANCEL_SYNC': {
      isCancelled = true;
      break;
    }

    case 'RESIZE_WINDOW': {
      figma.ui.resize(msg.width, msg.height);
      break;
    }

    case 'START_SYNC_BATCH': {
      isCancelled = false;
      const { items, config, isFirst, isLast, batchIndex, overallTotal } = msg.payload;

      if (isFirst || !activeBuilder) {
        let targetColorVar: Variable | null = null;
        const varId = config?.colorVariableId;
        if (varId && 'variables' in figma) {
          try {
            if (figma.variables.getVariableByIdAsync) {
              targetColorVar = await figma.variables.getVariableByIdAsync(varId);
            }
          } catch {
            // Fallback if ID didn't match directly
          }

          if (!targetColorVar && figma.variables.importVariableByKeyAsync) {
            try {
              targetColorVar = await figma.variables.importVariableByKeyAsync(varId);
            } catch {
              console.warn('Could not import color variable by key:', varId);
            }
          }
        }
        activeBuilder = new LibraryBuilder(targetColorVar);
        sessionStats = { added: 0, updated: 0, totalProcessed: 0 };
      }

      let batchAdded = 0;
      let batchUpdated = 0;

      try {
        for (let i = 0; i < items.length; i++) {
          if (isCancelled) {
            figma.notify('Synchronisation interrompue par l\'utilisateur.');
            break;
          }

          const item = items[i];
          sessionStats.totalProcessed++;

          // Post live progress to UI with overall total
          postMessage({
            type: 'SYNC_PROGRESS',
            payload: {
              current: sessionStats.totalProcessed,
              total: overallTotal,
              iconName: item.name,
            },
          });

          const result = activeBuilder.upsertIcon(item);
          if (result.status === 'created') {
            sessionStats.added++;
            batchAdded++;
          } else if (result.status === 'updated') {
            sessionStats.updated++;
            batchUpdated++;
          }

          // Yield to UI thread every 4 items to keep Figma responsive
          if (i % 4 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 8));
          }
        }

        if (isLast || isCancelled) {
          // Final batch completed: all icons are now written onto the page!
          const { added, updated } = sessionStats;
          postMessage({
            type: 'SYNC_COMPLETE',
            payload: { added, updated, deprecated: 0 },
          });

          if (!isCancelled) {
            figma.notify(`Synchronisation terminée : +${added} créés, ${updated} mis à jour.`);
          }
          activeBuilder = null;
        } else {
          // Intermediate batch finished: signal UI that it's safe to send next batch
          postMessage({
            type: 'BATCH_COMPLETE',
            payload: {
              batchIndex,
              added: batchAdded,
              updated: batchUpdated,
            },
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        postMessage({
          type: 'SYNC_ERROR',
          payload: { message: errorMsg },
        });
        figma.notify(`Erreur pendant la synchronisation : ${errorMsg}`, { error: true });
        activeBuilder = null;
      }
      break;
    }
  }
};
