# Règles pour les Agents IA (AGENTS.md)

Ce fichier définit les directives opérationnelles que l'agent IA doit impérativement respecter sur ce projet.

## 1. Respect des Directives Git & Versionnement
Consulter et appliquer scrupuleusement les règles définies dans [GIT_GUIDELINES.md](file:///c:/Users/vincent.pperrery/Documents/_dev/Google-symbols-to-Figma/GIT_GUIDELINES.md) :

- **Branche principale `main` protégée** :
  - Ne jamais commiter directement sur `main`.
  - Toujours créer ou utiliser une branche de travail préfixée (`feat/`, `fix/`, `chore/`, `refactor/`, `perf/`, `hotfix/`).
- **Conventional Commits stricts** :
  - Tout commit doit respecter la nomenclature `<type>(<scope optionnel>): <description>`.
  - Exemples : `feat: add icon filter`, `fix(ui): correct progress bar alignment`, `chore: update dependencies`.
- **Commits fréquents et granulaires** :
  - Commiter par petits lots logiques et cohérents.
- **Gestion des versions** :
  - Ne jamais modifier manuellement les numéros de version dans `package.json` ou autres fichiers de version (gestion déléguée à Semantic-Release).
- **Exécution des tests et validation** :
  - Exécuter `npm run build` ou les tests uniquement aux moments clés (avant git push, fin d'une feature, ou demande explicite de l'utilisateur).
