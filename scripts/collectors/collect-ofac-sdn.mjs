#!/usr/bin/env node
/**
 * Crucix Collector: OFAC SDN (санкции США).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: скачивает XML с treasury.gov, парсит в массив entries,
 * сдаёт через saveRaw. Сборщик НЕ пишет в basket напрямую.
 *
 * Формат результата: {lastUpdated, source, entries: [{id, name, type, programs, addresses, aliases, imo}]}.
 * Тип — hierarchical (объект с массивом entries внутри).
 * Координат у записей нет, точек не будет — только regions (по странам адресов).
 *
 * XML: https://www.treasury.gov/ofac/downloads/sdn.xml
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const SDN_XML_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml';

function demoData() {
  return {
    lastUpdated: new Date().toISOString(),
    source: 'demo-fallback',
    entries: [
      { id: 'OFAC-DEMO-1', name: 'Demo Sanctioned Entity', type: 'organization', programs: ['SDGT'], addresses: [{ country: 'IR', address: 'Tehran' }], aliases: [], cryptoAddresses: [] },
      { id: 'OFAC-DEMO-2', name: 'Demo Vessel', type: 'vessel', programs: ['IRAN'], imo: 1234567, mmsi: 636012345, addresses: [], aliases: [] }
    ]
  };
}

function getText(block, tag) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([^<]+)<\\/' + tag + '>'));
  return m ? m[1].trim() : null;
}

function getAllText(block, tag) {
  const out = [];
  const re = new RegExp('<' + tag + '[^>]*>([^<]+)<\\/' + tag + '>', 'g');
  let m;
  while ((m = re.exec(block)) !== null) out.push(m[1].trim());
  return out;
}

function parseSdnEntry(block) {
  const entry = {
    id: null,
    name: null,
    type: 'entity',
    firstName: null,
    lastName: null,
    programs: [],
    aliases: [],
    addresses: [],
    ids: [],
    nationalities: [],
    citizenships: [],
    cryptoAddresses: [],
    vesselInfo: null,
    aircraftInfo: null
  };

  const uid = getText(block, 'uid');
  entry.id = uid ? 'OFAC-' + uid : null;
  entry.firstName = getText(block, 'firstName');
  entry.lastName = getText(block, 'lastName');
  const sdnType = getText(block, 'sdnType');
  if (sdnType) entry.type = sdnType.toLowerCase();
  entry.name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null;

  const title = getText(block, 'title');
  if (title) entry.title = title;

  const remarks = getText(block, 'remarks');
  if (remarks) entry.remarks = remarks;

  for (const p of getAllText(block, 'program')) entry.programs.push(p);

  const addrListMatch = block.match(/<addressList>([\s\S]*?)<\/addressList>/);
  if (addrListMatch) {
    for (const am of addrListMatch[1].matchAll(/<address>([\s\S]*?)<\/address>/g)) {
      const ax = am[1];
      entry.addresses.push({
        address: getText(ax, 'address1') || getText(ax, 'address2') || null,
        city: getText(ax, 'city') || null,
        state: getText(ax, 'stateOrProvince') || null,
        postal: getText(ax, 'postalCode') || null,
        country: getText(ax, 'country') || null
      });
    }
  }

  const akaListMatch = block.match(/<akaList>([\s\S]*?)<\/akaList>/);
  if (akaListMatch) {
    for (const am of akaListMatch[1].matchAll(/<aka>([\s\S]*?)<\/aka>/g)) {
      const ax = am[1];
      const fn = getText(ax, 'firstName');
      const ln = getText(ax, 'lastName');
      const full = [fn, ln].filter(Boolean).join(' ');
      if (full) entry.aliases.push(full);
    }
  }

  const idListMatch = block.match(/<idList>([\s\S]*?)<\/idList>/);
  if (idListMatch) {
    for (const im of idListMatch[1].matchAll(/<id>([\s\S]*?)<\/id>/g)) {
      const ix = im[1];
      entry.ids.push({
        type: getText(ix, 'idType') || null,
        number: getText(ix, 'idNumber') || null,
        country: getText(ix, 'idCountry') || null
      });
    }
  }

  const natListMatch = block.match(/<nationalityList>([\s\S]*?)<\/nationalityList>/);
  if (natListMatch) {
    for (const m of natListMatch[1].matchAll(/<nationality[^>]*>([\s\S]*?)<\/nationality>/g)) {
      const c = m[1].match(/<country>([^<]+)<\/country>/);
      if (c) entry.nationalities.push(c[1].trim());
    }
  }

  const citListMatch = block.match(/<citizenshipList>([\s\S]*?)<\/citizenshipList>/);
  if (citListMatch) {
    for (const m of citListMatch[1].matchAll(/<citizenship[^>]*>([\s\S]*?)<\/citizenship>/g)) {
      const c = m[1].match(/<country>([^<]+)<\/country>/);
      if (c) entry.citizenships.push(c[1].trim());
    }
  }

  const cryptoListMatch = block.match(/<cryptoAddressList>([\s\S]*?)<\/cryptoAddressList>/);
  if (cryptoListMatch) {
    for (const m of cryptoListMatch[1].matchAll(/<cryptoAddress>([\s\S]*?)<\/cryptoAddress>/g)) {
      const ax = m[1];
      entry.cryptoAddresses.push({
        address: getText(ax, 'address') || null,
        currency: getText(ax, 'digitalCurrency') || null
      });
    }
  }

  const vesselMatch = block.match(/<vesselInfo>([\s\S]*?)<\/vesselInfo>/);
  if (vesselMatch) {
    const vx = vesselMatch[1];
    entry.vesselInfo = {
      imo: getText(vx, 'imoNumber') || null,
      flag: getText(vx, 'vesselFlag') || null,
      type: getText(vx, 'vesselType') || null,
      owner: getText(vx, 'vesselOwner') || null,
      tonnage: getText(vx, 'tonnage') || null
    };
  }

  const aircraftMatch = block.match(/<aircraftInfo>([\s\S]*?)<\/aircraftInfo>/);
  if (aircraftMatch) {
    const ax = aircraftMatch[1];
    entry.aircraftInfo = {
      tailNumber: getText(ax, 'tailNumber') || null,
      type: getText(ax, 'aircraftType') || null,
      owner: getText(ax, 'aircraftOperator') || null
    };
  }

  return entry;
}

function parseSDN(xml) {
  const entries = [];

  // Актуальный формат Treasury: <sdnEntry> в namespace
  const sdnParts = xml.split(/<sdnEntry>/i).slice(1);
  if (sdnParts.length > 0) {
    for (const part of sdnParts) {
      // Ограничить блок до закрывающего </sdnEntry>, если он есть
      const endIdx = part.indexOf('</sdnEntry>');
      const block = endIdx > 0 ? part.slice(0, endIdx) : part;
      const entry = parseSdnEntry(block);
      if (entry.name || entry.id) entries.push(entry);
    }
    if (entries.length > 0) return entries;
  }

  // Резерв: старый формат <Entity>
  const entityParts = xml.split(/<Entity>/i).slice(1);
  for (const e of entityParts) {
    const entry = { id: null, name: null, type: 'entity', programs: [], addresses: [], aliases: [], ids: [], nationalities: [], citizenships: [], cryptoAddresses: [], vesselInfo: null, aircraftInfo: null };
    const idM = e.match(/<ID[^>]*>([^<]+)<\/ID>/);
    if (idM) entry.id = 'OFAC-' + idM[1];
    const n = e.match(/<Name[^>]*>([^<]+)<\/Name>/);
    if (n) entry.name = n[1];
    if (e.includes('<Individual>')) entry.type = 'individual';
    else if (/VesselType/i.test(e)) entry.type = 'vessel';
    else if (/AircraftType/i.test(e)) entry.type = 'aircraft';
    for (const m of e.matchAll(/<Program[^>]*>([^<]+)<\/Program>/g)) entry.programs.push(m[1].trim());
    if (entry.name) entries.push(entry);
  }
  return entries;
}

export async function collectOFAC() {
  let data, source = 'treasury.gov';
  try {
    const r = await fetch(SDN_XML_URL, { signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'Crucix/1.0 OSINT' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const entries = parseSDN(xml);
    data = { lastUpdated: new Date().toISOString(), source, entries };
  } catch (e) {
    console.warn(`[OFAC] Ошибка: ${e.message}. Демо-данные.`);
    data = demoData();
    source = 'demo-fallback';
  }

  const result = await saveRaw('ofac-sdn', data, {
    collector: 'collect-ofac-sdn.mjs',
    source: 'US Treasury OFAC SDN',
    source_url: SDN_XML_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_unit: 'count',
    granularity: 'snapshot',
    record_count: data.entries.length,
    notes: `${data.entries.length} записей, source=${source}`,
    backwardCompat: true
  });

  const byType = {};
  for (const e of data.entries) byType[e.type] = (byType[e.type] || 0) + 1;
  console.log(`[OFAC] OK ${data.entries.length} записей (${JSON.stringify(byType)}) → ${result.raw_file}`);
  console.log(`[OFAC] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOFAC().catch((e) => { console.error('[OFAC] FATAL:', e.message); process.exit(1); });
}
