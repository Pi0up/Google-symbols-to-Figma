# Directives de Tenue de Git et de Versionnement

Ce document rassemble l'ensemble des règles et des procédures à respecter impérativement pour la gestion des branches, la rédaction des commits, l'exécution des tests et le versionnement automatisé.

---

## 1. Stratégie de Branches et Flux Git

### Règle d'or : Branche principale (`main`) protégée
- **Aucun commit direct sur `main`** n'est autorisé (sauf hotfix critique immédiat expressément validé).
- Tout ajout ou modification de code doit impérativement transiter par une **Pull Request (PR)** validée après passage des tests CI.

### Nomenclature des branches de travail
Chaque tâche démarre sur une branche dédiée, nommée en `kebab-case` et préfixée selon la nature de l'intervention :

| Préfixe | Usage | Exemple |
|---|---|---|
| `feat/` | Nouvelle fonctionnalité | `feat/export-csv-matrices` |
| `fix/` | Correction d'un bug fonctionnel ou technique | `fix/mermaid-relative-urls` |
| `hotfix/` | Correction d'urgence en production | `hotfix/broken-cli-import` |
| `perf/` | Optimisation des performances | `perf/cache-diagram-parsing` |
| `refactor/` | Restructuration du code sans altérer le comportement | `refactor/modularize-cli` |
| `chore/` | Maintenance, configuration CI/CD, dépendances | `chore/setup-semantic-release` |

---

## 2. Norme de Commits (Conventional Commits)

Chaque commit doit respecter strictement la syntaxe **Conventional Commits** afin de piloter de manière totalement déterministe le moteur de versionnement automatique :

```text
<type>(<périmètre optionnel>): <description courte à l'impératif>
```

### Impacts sur le numéro de version (SemVer)

| Type | Impact SemVer | Exemple d'incrément | Description |
|---|---|---|---|
| `feat(...)` | **MINEUR** | `1.1.0` ➔ `1.2.0` | Nouvelle fonctionnalité ou capacité métier |
| `fix(...)` | **PATCH** | `1.1.0` ➔ `1.1.1` | Correction de bug |
| `hotfix(...)` | **PATCH** | `1.1.0` ➔ `1.1.1` | Correction critique urgente |
| `perf(...)` | **PATCH** | `1.1.0` ➔ `1.1.1` | Gain de performance mesurable |
| `BREAKING CHANGE:` *(ou `feat(...!):`)* | **MAJEUR** | `1.1.0` ➔ `2.0.0` | Rupture de compatibilité ascendante |
| `docs(...)` | *Aucun* | - | Documentation uniquement |
| `chore(...)` | *Aucun* | - | Tâche technique, mise à jour de dépendances |
| `refactor(...)` | *Aucun* | - | Refonte interne sans ajout fonctionnel ni bugfix |
| `test(...)` | *Aucun* | - | Ajout ou correction de tests unitaires |
| `style(...)` | *Aucun* | - | Formatage, espaces, virgules |
| `ci(...)` / `build(...)` | *Aucun* | - | Configuration CI/CD, scripts de packaging |

### Bonnes pratiques de rédaction
- Utiliser un verbe à l'infinitif ou à l'impératif (ex. `add`, `fix`, `align`, `update`).
- Être concis, explicite et orienté sur l'effet produit par la modification.
- Si le commit induit une rupture de compatibilité, ajouter `BREAKING CHANGE: <explication>` dans le corps du message ou un point d'exclamation après le type (ex. `feat(api)!: modify endpoint parameters`).

---

## 3. Fréquence des Commits et Exécution des Tests

### Commits fréquents et granulaires
- Commiter par petits lots logiques et cohérents d'actions.
- Ne pas accumuler plusieurs jours de travail hétérogène dans un commit fourre-tout.

### Déclenchement des tests
Pour préserver la fluidité du développement, la suite de tests ne doit pas être exécutée systématiquement à chaque micro-modification. Elle est réservée aux moments clés suivants :
- À la demande explicite de l'utilisateur.
- À l'achèvement complet d'une nouvelle feature ou d'un correctif.
- Avant de pousser (`git push`) du code en ligne.

### Commandes de tests et validation locales
```bash
# Tests unitaires (si configurés)
npm test

# Build de vérification
npm run build
```

---

## 4. Automatisation du Numéro de Version (Semantic-Release)

> [!IMPORTANT]
> Le numéro de version n'est **JAMAIS** modifié manuellement dans `package.json`, `manifest.json` ou tout autre fichier de version. Il est calculé, synchronisé et publié de façon entièrement autonome.

### Déroulement du cycle CI/CD
1. **Pull Request vers `main`** : Le workflow GitHub Actions exécute automatiquement la suite de vérifications / tests. La PR ne peut être mergée que si les vérifications passent avec succès.
2. **Merge sur `main`** : L'étape `semantic-release` s'exécute automatiquement :
   - Analyse des commits depuis le dernier tag Git pour calculer le prochain numéro de version selon les règles Conventional Commits.
   - Mise à jour synchronisée des fichiers de version (`package.json`, `package-lock.json`, etc.).
   - Génération / mise à jour de `CHANGELOG.md` : Catégorisation automatique des commits (✨ Features, 🐛 Bug Fixes, 🚑 Hotfixes, ⚡ Performance Improvements).
   - Compilation et packaging des artefacts de release.
   - Commit Git & Tag automatique : Création du commit `chore(release): <version> [skip ci]` et du tag Git `v<version>`.
   - GitHub Release : Publication de la release officielle accompagnée du changelog et des archives téléchargeables.

---

## 5. Vérification Locale (Dry-Run)

Il est possible à tout moment de simuler localement le calcul de version et la génération du changelog sans publier ni altérer Git :
```bash
# Via script npm (si configuré)
npm run release:dry

# Ou directement avec npx
npx semantic-release --dry-run
```

---

## 6. Configuration Requise sur GitHub

Pour que le mécanisme automatisé fonctionne sans erreur :

1. **Workflow Permissions (Droits d'écriture GitHub Actions)** :
   - Rendez-vous sur le dépôt dans **Settings > Actions > General**.
   - Dans la section **Workflow permissions**, sélectionner **Read and write permissions**.
   - Cocher la case **Allow GitHub Actions to create and approve pull requests**.
   - Enregistrer.

2. **Protection de la branche `main`** :
   - Dans **Settings > Branches**, configurer une règle pour `main`.
   - Cocher **Require a pull request before merging**.
   - Cocher **Require status checks to pass before merging**.
   - Ne pas verrouiller les bypass stricts si vous utilisez le `GITHUB_TOKEN` par défaut, ou configurer un secret `GH_TOKEN` / GitHub App avec les permissions d'administration/bypass pour pousser les commits de release sur `main`.
