# How to write documentation in Crucix

Document: docs/en/help/CONTRIBUTING.md
Purpose: rules for creating documentation.
Mandatory: read before creating any document.

Step 1. Determine type (Diataxis)

Question 1: action or cognition? Action — Tutorial or How-to. Cognition — Reference or Explanation.
Question 2: acquires or applies? Acquires — Tutorial or Explanation. Applies — How-to or Reference.

Matrix: Action+acquires = Tutorial. Action+applies = How-to. Cognition+acquires = Explanation. Cognition+applies = Reference.
Mixing is forbidden.

Step 2. Determine location

Tutorial — docs/en/help/tutorials/slug.md
How-to — docs/en/help/how-to/slug.md
Reference — docs/en/help/reference/category/id.md
Explanation — docs/en/help/explanation/slug.md
ADR — docs/en/help/explanation/decisions/NNN-slug.md

Reference categories: collectors, apis, analyzers, contract.

Step 3. Name the file

Latin only, lowercase. Multi-word via hyphen. Forbidden: brackets, equals sign, suffixes _0, _1, _2. One name for ru and en.
ADR: NNN-short-name.md.

Step 4. Use a template

Templates in docs/en/help/_templates/. Creating documentation without a template is forbidden.

Step 5. Link with others

Mandatory links: back to INDEX.md, links to related documents, links to code. Rule of 3 steps.

Step 6. Synchronize ru/en

Each document in two versions. One name. Updated simultaneously.

Step 7. Update INDEX

After creating documentation add link to INDEX.md.

What NOT to do

Forbidden: mixing types; creating without template; suffixes _0/_1/_2; brackets; equals sign; ru without en; duplicate names; words Changes/Changelog/History in Reference; mentioning module versions in text.

Allowed: extending existing documentation; creating new types with justification in ADR.

Rule when creating a module

Documentation is written BEFORE code. Order: (1) Reference document ru, (2) Reference document en, (3) update INDEX, (4) module code, (5) tests, (6) update ADR.

Related documents

README.md — manifest.
INDEX.md — central navigator.
Diataxis Framework (diataxis.fr) — original standard.
