# Gestion Commerciale Desktop

App desktop (Electron + React + GraphQL) de gestion commerciale complète — Windows / macOS / Ubuntu —
connectée à `sos-cloud-server` → agent PC → MariaDB. Portage moderne du desktop Delphi
« SOS et POS SYSTEM 2.37 - Multilot » (variante Gestion Commerciale).

## État : Phase 0 — validation de la charte graphique et des maquettes

## Documents
1. [docs/01-CHARTE-GRAPHIQUE.md](docs/01-CHARTE-GRAPHIQUE.md) — palette, typo, composants, interactions
2. [docs/02-ARCHITECTURE-ET-NAVIGATION.md](docs/02-ARCHITECTURE-ET-NAVIGATION.md) — stack, flux session, mapping menus Delphi → sidebar, patterns d'écran
3. [docs/03-API-GRAPHQL-ET-MANQUES-SERVEURS.md](docs/03-API-GRAPHQL-ET-MANQUES-SERVEURS.md) — inventaire API existante + manques P1/P2/P3
4. [docs/04-TODO.md](docs/04-TODO.md) — plan de travail par phases

## Design
- [design/tokens.css](design/tokens.css) — design tokens (variables CSS, clair/sombre)
- [design/maquettes.html](design/maquettes.html) — maquettes des écrans clés (aussi publiées en artifact)

## Sources analysées
- Delphi : `/Volumes/SOS et POS SYSTEM 2.37 - Multilot` (Main.pas/main.dfm, DataModule.pas — pas de Unit2 : le datamodule s'appelle `DataModule.pas`)
- Serveurs : `/Volumes/Dev/SOFTLY/sos-cloud-server`, `/Volumes/Dev/SOFTLY/sos-agent`
- SQL de référence métier : `sos-agent/docs/SQL-GESTION-COMMERCIALE.md`
