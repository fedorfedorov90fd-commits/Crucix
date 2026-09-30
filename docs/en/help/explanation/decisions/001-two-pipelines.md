# 001. Two independent pipelines for news processing

Date: 2026-09-26
Status: accepted
Confidence level: high

Context

In Crucix there are two news processing systems that developed independently. SmartScroll — transformation of a news stream into coherent stories with temporal dynamics, 4-level deduplication, clustering, summarization, and bias-aware credibility weight. Contract-v3 pipeline — a flat news stream with circuit breaker, URL classification (direct/tor/dead) and direct API. The question arose: merge or keep both.

Considered options

Option A. Keep both. Pros: separation of concerns, independent scaling, testability, replacement without rewriting. Cons: partial data duplication at the OPML-URL level.

Option B. Merge into one. Pros: single source of truth. Cons: loss of flat stream for fast API, complexity increase in SmartScroll.

Option C. Keep both, separated by layers. Pros: like A, but with explicit role separation. Cons: requires an architectural document.

Decision

Option A chosen (identical to C). Justification: layers differ, files differ, purposes differ. Data duplication is acceptable. Function duplication is forbidden. Project rule 1070 (duplicates — synthesis only) is respected.

Boundaries: SmartScroll — stories, 4-level dedup, clustering, bias_rank_weight, knowledge graph. Contract-v3 — flat stream, circuit breaker, direct/tor/dead, direct APIs.

Touch points: common OPML-URLs, common source-camps.json reference, common countries.json reference.

Forbidden: SmartScroll reads data/basket/rss.json; Contract-v3 reads smartscroll-stories.json; cross-pipeline function calls.

Consequences

What it gives: each pipeline is an expert in its task; independent scaling; ability to replace one without touching the other; conformity to separation of concerns.

What it limits: part of the data is duplicated; synchronization of source-camps.json is required.

Trade-offs: we consciously accept partial data duplication for the sake of layer independence.

Links

docs/architecture/rss-pipelines.md — full architectural description.
Project rule 1070 — duplicates only via synthesis.
