# 002. Migration strategy for existing documentation

Date: 2026-09-26
Status: accepted
Confidence level: high

Context

In docs/help/ru/ there are 690 documentation files, in docs/help/en/ — 697. The structure is accumulative: files with suffixes _0, _1, _2, equals signs in names, duplicate names. The reference/collectors/ directory contains 1 file instead of 118 (matching the number of collectors). The reference/apis/ directory is empty. The reference/analyzers/ directory is empty.

Simultaneously, a new documentation foundation was created per Diataxis standard: docs/help/README.md, INDEX.md, CONTRIBUTING.md, _templates/, reference/{collectors,apis,analyzers,contract}/, how-to/, explanation/decisions/, tutorials/.

A strategy is required for migrating 690+697 files from the old structure to the new one without data loss and without breaking the working system.

Considered options

Option A. Full one-time audit and migration. Pros: single structure immediately. Cons: huge amount of work, high risk of errors, days/weeks of downtime in documentation work.

Option B. Keep old structure, new documentation only in the new one. Pros: no risk. Cons: two parallel structures forever, confusion about where to search.

Option C. Strangler Fig pattern. Pros: old structure works, new grows in parallel, migration on file touch, no downtime, controlled progress. Cons: temporary coexistence of two structures.

Decision

Option C chosen — Strangler Fig pattern (Martin Fowler, martinfowler.com/bliki/StranglerFigApplication.html).

Principle: old system continues to work, new grows around it. Gradually the new structure covers more, the old shrinks. When migration is complete — the old is archived (not deleted, rule 1070).

Application in Crucix:

1. Old structure docs/help/ru/ and docs/help/en/ works as is. Nothing is deleted, no mass move.

2. New structure docs/help/reference/, how-to/, explanation/, tutorials/ develops with each new document or on touching an existing one.

3. Touch rule: if a file from the old structure needs changes — it is rewritten in the new structure per Diataxis standard. The old file remains until an explicit archival decision.

4. INDEX.md of the new structure is filled with links as migration progresses.

5. When old-structure files become few — they are moved to archive-docs/ (single archive, not deleted).

Naming rules during migration:

- Suffixes _0, _1, _2, equals sign — eliminated. File reduced to clean name.
- Duplicate names — synthesis into one file (rule 1070). Not choice, not archival, only synthesis.
- Each file receives a type per Diataxis (Reference, How-to, Explanation, Tutorial) and place in the corresponding directory.

Consequences

What it gives:

- Working old structure does not break.
- New structure grows in parallel, no downtime.
- Controlled progress: migration on file touch.
- Rule 1070 respected: old files are not deleted, duplicates synthesized.

What it limits:

- Two structures coexist temporarily.
- Discipline required: on touching any file — migrate to new structure.

Trade-offs:

We consciously accept temporary coexistence of two structures for the sake of no risk and no downtime.

Links

docs/help/README.md — documentation system manifest.
docs/help/CONTRIBUTING.md — rules for creating documentation.
docs/help/explanation/decisions/001-two-pipelines.md — ADR-001.
Martin Fowler, Strangler Fig Application — original pattern description.
