# Changelog

All notable changes to this template are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-18
First public version of the template.

### Added
- **Claude Code wizard** (`CLAUDE.md`, `.claude/`): bilingual (English / Indonesian) slash commands
  from `/new-house` to `/deploy`, skills for reading floor plans, styling from inspiration photos,
  interior layout, exterior and site, lighting bake, regional cost and visual QA, and conservative
  permission settings (deploying always asks first).
- **3D house engine** (`engine/`): data-driven three.js walk-through built from `zoning.js`,
  `interior.js` and `project.json`: walk, dollhouse, 2D plan, minimap with teleport, sun by time and
  month, doors, sitting, home lift, drivable cars, optional shared walk-through with voice, optional
  baked lighting.
- **Studio pages** (`studio/`): printable 2D plan and a regional construction cost estimate.
- **Node tooling** (`scripts/`): `validate`, walkability `check`, `check-interior`, tests,
  screenshots, texture conversion, bake, project switching and Vercel deploy; works the same on
  Windows, macOS and Linux.
- **Sample house** and a blank project template (`projects/`).
- Docs: README (EN/ID), wizard guide, schema, engine notes, Windows notes; CI on Windows, macOS and
  Linux; issue and pull request templates; security policy.

[Unreleased]: https://github.com/OWNER/house-3d-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/house-3d-studio/releases/tag/v0.1.0
