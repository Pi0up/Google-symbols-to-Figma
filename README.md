# Google Material Symbols Sync (Plugin Figma)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Figma API](https://img.shields.io/badge/Figma_Plugin_API-1.106-F24E1E?logo=figma)](https://www.figma.com/plugin-docs/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Plugin Figma professionnel conçu pour générer, organiser et synchroniser en continu l'intégralité du catalogue officiel d'icônes **Google Material Symbols** directement au sein de votre Design System Figma.

---

## Points forts

- **Synchronisation incrémentale non-destructive** :
  - Met à jour les tracés vectoriels (`vectorNetwork`) des icônes modifiées par Google **sans jamais détruire les composants ni briser les instances existantes**.
  - Préserve vos overrides (couleurs personnalisées, structure de calques, contraintes).
  - Détecte et conserve les icônes retirées par Google en les marquant avec le libellé `[Deprecated]`.
- **Liaison automatique des Tokens & Variables de couleur** :
  - Détection automatique des variables de couleur locales du fichier.
  - Détection et support complet des **bibliothèques d'équipe liées (Team Libraries)**.
  - Saisie manuelle possible par clé ou ID de variable Figma.
  - Application automatique du token de couleur (`setBoundVariable`) sur les tracés vectoriels lors de la création et de la mise à jour.
-  **Structure de composants et variantes complète** :
  - Génère 1 `ComponentSet` par icône avec ses propriétés de variantes :
    - `Style` : `Outlined`, `Rounded`, `Sharp`
    - `Fill` : `False` (contour) et `True` (plein)
  - Cadre normalisé 24×24 px avec redimensionnement automatique et contraintes centrées.
-  **Organisation intelligente en Sections** :
  - Regroupe automatiquement les icônes dans des `Sections` Figma étiquetées selon les catégories Google (*Action*, *Communication*, *Audio & Video*, *Device*, etc.).
  - Mise en page automatique en grille propre et aérée.
-  **Tableau de bord interactif & Filtres précis** :
  - Analyse différentielle en direct entre le catalogue distant Google Fonts et la page Figma active (Nouveaux, Modifiés, À jour, Dépréciés).
  - Filtrage granulaire par styles, état Fill et catégories (recherche rapide intégrée).
  - Choix du périmètre : *Uniquement les nouveautés et modifications* (recommandé) ou *Synchronisation complète forcée*.
  - Barre de progression en temps réel avec indicateur de l'icône traitée et bouton d'annulation immédiat.
  - Rapport d'erreurs détaillé avec copie dans le presse-papier et possibilité de réessai ciblé des échecs réseau.

---

## 🏗 Structure générée dans Figma

Chaque icône est matérialisée sous forme d'un composant unifié conforme aux standards des Design Systems modernes :

```text
Section Figma (ex: "Action")
│
└── ComponentSet: "search"
    ├── Component Variant (Style=Outlined, Fill=False) [24x24]
    ├── Component Variant (Style=Outlined, Fill=True)  [24x24]
    ├── Component Variant (Style=Rounded,  Fill=False) [24x24]
    ├── Component Variant (Style=Rounded,  Fill=True)  [24x24]
    ├── Component Variant (Style=Sharp,    Fill=False) [24x24]
    └── Component Variant (Style=Sharp,    Fill=True)  [24x24]
```

Les métadonnées (nom officiel, catégorie, version distante, statut) sont stockées de façon sécurisée via `setPluginData` sur chaque composant pour garantir un différentiel rapide et fiable lors des prochaines synchronisations.

---

##  Installation dans Figma (Mode Développement)

1. **Prérequis** :
   - [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée).
   - L'application de bureau **Figma Desktop**.

2. **Cloner et compiler le projet** :
   ```bash
   git clone https://github.com/votre-nom/Google-symbols-to-Figma.git
   cd Google-symbols-to-Figma
   npm install
   npm run build
   ```

3. **Importer le plugin dans Figma** :
   - Ouvrez Figma Desktop.
   - Accédez au menu principal (icône Figma en haut à gauche) > **Plugins** > **Development** > **Import plugin from manifest...**.
   - Sélectionnez le fichier `manifest.json` situé à la racine du projet.

4. **Lancer le plugin** :
   - Ouvrez votre fichier de Design System ou créez une page dédiée (ex. `Icons`).
   - Clic droit sur le canevas > **Plugins** > **Development** > **Google Material Symbols Sync**.

---

##  Guide d'utilisation

1. **Analyse initiale** :
   - Au lancement, le plugin analyse automatiquement la page active et interroge l'API Google Fonts pour calculer le différentiel.
   - Les cartes récapitulatives affichent le nombre d'icônes *Nouvelles*, *Modifiées*, *À jour* et *Dépréciées*.

2. **Sélection des styles et variantes** :
   - Cochez les styles souhaités : `Outlined`, `Rounded`, `Sharp`.
   - Activez ou désactivez la génération des états `Fill` (`Fill=False` et `Fill=True`).

3. **Liaison d'une variable de couleur (Design Token)** :
   - Ouvrez le menu déroulant **Variable de couleur**.
   - Choisissez un token parmi vos **variables locales** ou vos **bibliothèques d'équipe liées (Team Libraries)** (ex. `color/icon/primary`, `on-surface`).
   - Si votre variable se trouve dans une bibliothèque non listée, sélectionnez l'option personnalisée et collez directement son ID ou sa Clé Figma.

4. **Filtrage des catégories** :
   - Cochez ou décochez les catégories d'icônes à importer.
   - Utilisez le champ de recherche pour isoler rapidement une catégorie (*Navigation*, *Social*, *Hardware*...).

5. **Lancement de la synchronisation** :
   - Choisissez la portée :
     - *Uniquement les nouveautés et modifications* (rapide et recommandé au quotidien).
     - *Forcer la synchronisation de toutes les icônes sélectionnées* (utile pour réappliquer un token de couleur sur l'ensemble du set).
   - Cliquez sur **Synchroniser**. Vous pouvez interrompre le processus à tout moment via le bouton **Annuler**.

---

## 🛠 Commandes de développement

| Commande | Action |
|---|---|
| `npm run build` | Compile l'ensemble du plugin (sandbox Figma + interface UI) pour la production. |
| `npm run build:code` | Compile uniquement le code sandbox Figma (`src/code/` ➔ `dist/code.js`). |
| `npm run build:ui` | Compile uniquement l'interface (`src/ui/` ➔ `dist/index.html` inline). |
| `npm run dev:code` | Surveille et recompile automatiquement les sources de la sandbox Figma à chaud. |
| `npm run dev:ui` | Surveille et recompile automatiquement l'interface utilisateur. |

---

## 📁 Architecture du projet

```text
Google-symbols-to-Figma/
├── manifest.json            # Manifeste officiel Figma (permissions réseau, métadonnées)
├── package.json             # Scripts et dépendances de développement
├── tsconfig.json            # Configuration TypeScript stricte
├── vite.config.code.ts      # Configuration Vite pour la sandbox Figma (code.js)
├── vite.config.ui.ts        # Configuration Vite pour l'iframe UI (index.html inline)
├── dist/                    # Fichiers compilés prêts à être exécutés par Figma
│   ├── code.js              # Bundle sandbox Figma
│   └── index.html           # Interface utilisateur autonome (HTML + CSS + JS inlinés)
├── src/
│   ├── types.ts             # Typages TypeScript partagés (UI <-> Sandbox)
│   ├── code/                # Figma Sandbox (accès au DOM Figma)
│   │   ├── main.ts          # Point d'entrée sandbox, routeur de messages, batching
│   │   ├── scanner.ts       # Détection des PluginData et scan des variables (locales & team)
│   │   └── builder.ts       # Création des ComponentSets, Sections, application des tokens et vectorNetwork
│   └── ui/                  # Interface utilisateur (Iframe Figma)
│       ├── index.html       # Gabarit HTML de l'interface
│       ├── styles.css       # Thème Figma (light / dark mode natif)
│       ├── api.ts           # Client API Google Fonts et CDN de téléchargement SVG
│       ├── diff.ts          # Moteur de calcul du différentiel distant vs local
│       └── main.ts          # Contrôleur UI, gestion du state, pagination des téléchargements
└── LICENSE                  # Licence GNU General Public License v3.0
```

---

##  Directives Git et Contribution

Le projet applique une politique stricte de versionnement et de qualité logicielle (voir [AGENTS.md](AGENTS.md) et [GIT_GUIDELINES.md](GIT_GUIDELINES.md)) :

- **Branche principale `main` protégée** : aucun commit direct sur `main`. Toute évolution passe par une branche dédiée (`feat/`, `fix/`, `chore/`, etc.) et une Pull Request.
- **Conventional Commits** obligatoires :
  - `feat(...)` : Nouvelle fonctionnalité (incrément SemVer Mineur).
  - `fix(...)` : Correction de bogue (incrément SemVer Patch).
  - `docs(...)` : Mise à jour de la documentation.
  - `chore(...)` : Tâches d'infrastructure ou dépendances.
- **Gestion autonome du versionnement** : le numéro de version ne doit **jamais** être modifié manuellement dans `package.json` (délégué à Semantic-Release).

---

##  Licence

Ce projet est distribué sous licence **GPL-3.0**. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
