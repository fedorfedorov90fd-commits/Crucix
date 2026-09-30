# 12. Summarizer

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/summarizer.mjs

## Purpose

Extractive summarization of stories based on TF-IDF and MMR.

## Class

Summarizer

## Method

summarize(events) - builds summary from titles and bodies of events.

## Algorithm

1. Split texts into sentences
2. Compute TF-IDF for informativeness
3. Select N sentences via MMR (Maximal Marginal Relevance) with relevance-novelty balance
4. Return in original order

## Parameters

- numSentences - number of sentences (default 3)

## Relations

- Used by: 05-local-engine.md
