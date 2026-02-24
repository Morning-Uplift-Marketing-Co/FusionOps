# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.2] - 2026-02-23
### Added
- **Template System**: Implemented a safe "Delete Template" feature utilizing soft-deletes and architecture dependency checks. 
- **Wizard QA**: Documented comprehensive QA testing matrix for Template generation.

### Fixed
- **Theme**: Fixed hydration mismatch (FOUC) and scoped UI conflicts causing components to incorrectly persist dark mode while the System was in light mode.
- **Neon Configuration**: Corrected issues with database persistence strings overriding active DB context.

## [2.1.1] - 2026-02-23
### Fixed
- **Voluum Settings**: Fixed variable naming typos preventing correctly established API keys from evaluating to active in the System Top Bar.
- **Settings Layout**: Refactored dashboard grid system for multi-column configuration blocks to reduce scrolling.
