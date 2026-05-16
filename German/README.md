# Deutsch Lernen — Application d'apprentissage de l'allemand

Application web statique pour apprendre l'allemand. Cliquez sur les mots pour afficher leur traduction, leur déclinaison et leur conjugaison.

## Structure

```
German/
├── index.html          — Application principale (SPA)
├── netlify.toml        — Configuration Netlify
└── data/
    ├── vocabulary.json — 742 mots (A1/A2/B1/B2/C1) avec déclinaisons et conjugaisons
    └── texts.json      — 60 textes annotés ≥100 mots (Actualités / Histoires / Dialogues)
```

## Fonctionnalités

- 60 textes en allemand par catégorie et niveau (A1 → C1), ≥ 100 mots chacun
- Distribution : Actualités×20, Histoires×20, Dialogues×20 ; A1×6, A2×12, B1×24, B2×15, C1×3
- Sélection par grille de cartes (filtres catégorie + niveau)
- **Texte du jour** : texte différent chaque jour, identique pour tous les utilisateurs
- Clic sur un mot → traduction japonaise + française
- Tableaux de conjugaison pour les verbes (Präsens / Präteritum / Partizip II)
- Tableaux de déclinaison pour les noms et adjectifs (stark / schwach / gemischt)
- 742 mots de vocabulaire annotés (A1–C1)
- Interface en français
