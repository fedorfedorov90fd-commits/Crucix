# 04. Source Factory

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/index.mjs

## Purpose

Entry point for obtaining a SmartScroll source.
Returns external adapter, local engine, or auto-switch depending on configuration mode.

## Function

createSmartScrollSource() - returns source instance:
- mode external - SmartScrollAdapter
- mode local - SmartScrollLocalEngine
- mode auto - AutoSwitchSource

## Class AutoSwitchSource

Wrapper over two sources with automatic switching.

- Cooldown after external source failure: 60 seconds
- On external failure switches to local
- healthCheck() returns state of both sources

## Relations

- Imports: 03-external-adapter.md, 05-local-engine.md
- Reads config: 01-config.md
- Used by: 16-event-ingestion.md
