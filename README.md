# Google Material Symbols Sync (Plugin Figma)

Plugin Figma permettant de générer et de maintenir à jour une bibliothèque d'icônes **Google Material Symbols** directement dans votre fichier Figma.

## ✨ Fonctionnalités

- **Synchronisation incrémentale non-destructive** :
  - Détecte automatiquement les nouvelles icônes ajoutées par Google.
  - Met à jour les tracés vectoriels des icônes modifiées par Google **sans briser les instances ni perdre vos overrides** (couleurs, calques, contraintes).
  - Conserve les icônes obsolètes marquées avec le tag `[Deprecated]`.
- **Organisation intelligente** :
  - Génère 1 `ComponentSet` par icône avec ses propriétés de variantes :
    - `Style` : `Outlined`, `Rounded`, `Sharp`
    - `Fill` : `False` (outline) et `True` (filled)
  - Regroupe les icônes dans des `Sections` Figma classées par catégories Google (*Action*, *Communication*, *Audio & Video*, *Device*, etc.) disposées en grille aérée.
- **Tableau de bord interactif** :
  - Visualisation en direct du différentiel : Nouveaux, Modifiés, À jour, Dépréciés.
  - Sélection précise des styles souhaités et filtres par catégories.
  - Choix de la portée : Uniquement les nouveautés/modifications (recommandé) ou Forcer la synchro complète.
  - Barre de progression avec nom de l'icône en cours et bouton d'annulation immédiat.

---

## 🚀 Installation dans Figma

1. Ouvrez l'application **Figma Desktop**.
2. Allez dans le menu principal (icône Figma en haut à gauche) > **Plugins** > **Development** > **Import plugin from manifest...**.
3. Sélectionnez le fichier `manifest.json` situé à la racine de ce dossier :
   ```
   c:\Users\vincent.pperrery\Documents\_dev\google icons to figma\manifest.json
   ```
4. Ouvrez un fichier Figma (ex: votre fichier Design System ou une page dédiée "Icons").
5. Faites un clic droit sur le canvas > **Plugins** > **Development** > **Google Material Symbols Sync**.

---

## 🛠 Commandes de développement

- **Compiler le plugin (production)** :
  ```bash
  npm run build
  ```
- **Mode surveillance continue (développement)** :
  ```bash
  npm run dev:code   # dans un terminal (surveille la sandbox Figma)
  npm run dev:ui     # dans un second terminal (surveille l'interface)
  ```

---

## 📁 Architecture du projet

```text
├── manifest.json            # Manifeste officiel Figma (permissions réseau, UI)
├── dist/                    # Fichiers compilés prêts pour Figma
│   ├── code.js              # Sandbox Figma (DOM, composants, variantes)
│   └── index.html           # Interface utilisateur autonome (HTML + CSS + JS inlinés)
├── src/
│   ├── types.ts             # Modèles de données partagés
│   ├── code/                # Figma Sandbox
│   │   ├── main.ts          # Écouteurs de messages, boucle asynchrone non bloquante
│   │   ├── scanner.ts       # Détection et lecture des PluginData existants
│   │   └── builder.ts       # Création des ComponentSets, Sections, mise à jour vectorielle
│   └── ui/                  # Interface Iframe
│       ├── index.html       # Structure HTML
│       ├── styles.css       # Thème Figma (light / dark)
│       ├── api.ts           # Requêtes API Google Fonts & CDN jsDelivr
│       ├── diff.ts          # Algorithme de comparaison distant vs local
│       └── main.ts          # Contrôleur UI, pagination des téléchargements
└── vite.config.*            # Configurations de compilation Vite
```
