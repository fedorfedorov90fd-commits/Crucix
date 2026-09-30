# Crucix Documentation System

Document: docs/en/help/README.md
Purpose: describe principles, structure, and rules of documentation in Crucix.
Status: active standard.

Why this document

Documentation in Crucix is not a set of separate files, but a knowledge system of the project. Any issue is found via INDEX.md in no more than three steps. If not found — documentation is incomplete and must be rewritten.

Five principles

1. Diataxis: four types — four purposes. Each document belongs to exactly one of four types by the Diataxis methodology (diataxis.fr), used by Django, Python, JetBrains, Hugging Face, Cloudflare: Tutorial (learning scenario from scratch) in docs/en/help/tutorials/, How-to (how to solve a task) in docs/en/help/how-to/, Reference (precise description of a module) in docs/en/help/reference/, Explanation (why the architecture is this way) in docs/en/help/explanation/. Mixing is forbidden.

2. Docs-as-Code. All documentation is Markdown in docs/en/help/. Versioned via Git.

3. ADR: journal of architectural decisions. Each decision is recorded in docs/en/help/explanation/decisions/ in ADR format (Microsoft Azure Well-Architected). Accepted records are not edited. If a decision changes — a new record with status superseded by NNN.

4. INDEX: entry point in three steps. docs/en/help/INDEX.md — central navigator.

5. Synchronization ru/en. Each document exists in two versions: docs/help/ru/ and docs/help/en/. One filename. Updated simultaneously.

Directory structure

docs/en/help/ contains: README.md (manifest), INDEX.md (navigator), CONTRIBUTING.md (rules), _templates/ (reference, how-to, adr templates), reference/ (collectors, apis, analyzers, contract), how-to/, explanation/decisions/ (ADR), tutorials/, ru/ (legacy, under migration).

Rule: documentation before code

When creating a module: (1) first the document in docs/en/help/reference/type/id.md, (2) then module code, (3) then update INDEX.md, (4) in parallel ru-version. Corresponds to project rule 29 and reinforced by Diataxis requirement.

Related documents

INDEX.md — central navigator.
CONTRIBUTING.md — rules for creating documentation.
explanation/decisions/001-two-pipelines.md — ADR-001.
