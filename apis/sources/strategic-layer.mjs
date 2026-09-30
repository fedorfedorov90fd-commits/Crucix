#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №53: РАСШИРЕННЫЙ СТРАТЕГИЧЕСКИЙ СЛОЙ (RSSL)
// ============================================================
// Военные базы, ядерные объекты, подводные кабели
// Стратегический анализ и ситуационное осознание
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'strategic');
const CACHE_FILE = join(DATA_DIR, 'cache.json');

// ============================================================
// 1. ДАННЫЕ — ВОЕННЫЕ БАЗЫ (220+)
// ============================================================

const MILITARY_BASES = {
  usa: [
    { id: 'us-norfolk', name: 'Norfolk Naval Base', country: 'USA', lat: 36.946, lon: -76.325, type: 'navy', personnel: 65000, radius: 200, status: 'active' },
    { id: 'us-ramstein', name: 'Ramstein Air Base', country: 'Germany', lat: 49.437, lon: 7.600, type: 'air_force', personnel: 35000, radius: 200, status: 'active' },
    { id: 'us-gitmo', name: 'Guantanamo Bay', country: 'Cuba', lat: 19.899, lon: -75.155, type: 'navy', personnel: 6000, radius: 100, status: 'active' },
    { id: 'us-diego-garcia', name: 'Diego Garcia', country: 'UK', lat: -7.313, lon: 72.411, type: 'joint', personnel: 3000, radius: 150, status: 'active' },
    { id: 'us-pentagon', name: 'The Pentagon', country: 'USA', lat: 38.871, lon: -77.056, type: 'command', personnel: 23000, radius: 50, status: 'active' },
    { id: 'us-wright-patterson', name: 'Wright-Patterson AFB', country: 'USA', lat: 39.826, lon: -84.048, type: 'air_force', personnel: 27000, radius: 150, status: 'active' },
    { id: 'us-whiteman', name: 'Whiteman AFB (B-2)', country: 'USA', lat: 38.730, lon: -93.548, type: 'air_force', personnel: 5000, radius: 200, status: 'active' },
    { id: 'us-fort-bragg', name: 'Fort Bragg', country: 'USA', lat: 35.139, lon: -79.006, type: 'army', personnel: 50000, radius: 150, status: 'active' },
    { id: 'us-joint-base-mdl', name: 'Joint Base MDL', country: 'USA', lat: 40.050, lon: -74.550, type: 'joint', personnel: 10000, radius: 150, status: 'active' },
    { id: 'us-hickam', name: 'Hickam AFB', country: 'USA', lat: 21.317, lon: -157.917, type: 'air_force', personnel: 12000, radius: 150, status: 'active' },
    { id: 'us-andersen', name: 'Andersen AFB', country: 'Guam', lat: 13.579, lon: 144.922, type: 'air_force', personnel: 5000, radius: 200, status: 'active' },
    { id: 'us-osan', name: 'Osan AB', country: 'South Korea', lat: 37.090, lon: 127.030, type: 'air_force', personnel: 8000, radius: 150, status: 'active' },
    { id: 'us-kunsan', name: 'Kunsan AB', country: 'South Korea', lat: 35.903, lon: 126.616, type: 'air_force', personnel: 5000, radius: 150, status: 'active' },
    { id: 'us-aviano', name: 'Aviano AB', country: 'Italy', lat: 46.033, lon: 12.583, type: 'air_force', personnel: 6000, radius: 150, status: 'active' },
    { id: 'us-incirlik', name: 'Incirlik AB', country: 'Turkey', lat: 37.002, lon: 35.417, type: 'air_force', personnel: 5000, radius: 150, status: 'active' },
    { id: 'us-al-udeid', name: 'Al Udeid AB', country: 'Qatar', lat: 25.117, lon: 51.317, type: 'air_force', personnel: 10000, radius: 150, status: 'active' },
    { id: 'us-al-dhafra', name: 'Al Dhafra AB', country: 'UAE', lat: 24.250, lon: 54.550, type: 'air_force', personnel: 5000, radius: 150, status: 'active' },
    { id: 'us-bagram', name: 'Bagram AFB', country: 'Afghanistan', lat: 34.934, lon: 69.182, type: 'air_force', personnel: 0, radius: 100, status: 'reserve' },
    { id: 'us-al-jaber', name: 'Al Jaber AB', country: 'Kuwait', lat: 29.033, lon: 48.000, type: 'air_force', personnel: 5000, radius: 150, status: 'active' },
    { id: 'us-camp-lejeune', name: 'Camp Lejeune', country: 'USA', lat: 34.667, lon: -77.333, type: 'marine', personnel: 45000, radius: 100, status: 'active' },
    { id: 'us-camp-pendleton', name: 'Camp Pendleton', country: 'USA', lat: 33.333, lon: -117.500, type: 'marine', personnel: 38000, radius: 100, status: 'active' },
    { id: 'us-fort-campbell', name: 'Fort Campbell', country: 'USA', lat: 36.650, lon: -87.467, type: 'army', personnel: 25000, radius: 100, status: 'active' },
    { id: 'us-fort-hood', name: 'Fort Hood', country: 'USA', lat: 31.117, lon: -97.683, type: 'army', personnel: 40000, radius: 100, status: 'active' },
    { id: 'us-yokota', name: 'Yokota AB', country: 'Japan', lat: 35.748, lon: 139.348, type: 'air_force', personnel: 10000, radius: 150, status: 'active' },
    { id: 'us-kadena', name: 'Kadena AB', country: 'Japan', lat: 26.355, lon: 127.767, type: 'air_force', personnel: 20000, radius: 150, status: 'active' },
    { id: 'us-camp-humphreys', name: 'Camp Humphreys', country: 'South Korea', lat: 36.966, lon: 127.017, type: 'army', personnel: 20000, radius: 100, status: 'active' },
    { id: 'us-sigonella', name: 'Sigonella NAS', country: 'Italy', lat: 37.400, lon: 14.917, type: 'navy', personnel: 4000, radius: 100, status: 'active' },
    { id: 'us-rotas', name: 'Naval Station Rota', country: 'Spain', lat: 36.617, lon: -6.350, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'us-naples', name: 'Naval Support Naples', country: 'Italy', lat: 40.833, lon: 14.250, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'us-bahrain', name: 'NSA Bahrain', country: 'Bahrain', lat: 26.217, lon: 50.583, type: 'navy', personnel: 7000, radius: 100, status: 'active' }
  ],
  russia: [
    { id: 'ru-kaliningrad', name: 'Baltic Fleet HQ', country: 'Russia', lat: 54.733, lon: 20.500, type: 'navy', personnel: 15000, radius: 150, status: 'active' },
    { id: 'ru-sevastopol', name: 'Black Sea Fleet HQ', country: 'Russia', lat: 44.617, lon: 33.517, type: 'navy', personnel: 25000, radius: 150, status: 'active' },
    { id: 'ru-murmansk', name: 'Northern Fleet HQ', country: 'Russia', lat: 68.967, lon: 33.050, type: 'navy', personnel: 30000, radius: 200, status: 'active' },
    { id: 'ru-vladivostok', name: 'Pacific Fleet HQ', country: 'Russia', lat: 43.117, lon: 131.883, type: 'navy', personnel: 20000, radius: 150, status: 'active' },
    { id: 'ru-khmeimim', name: 'Khmeimim Air Base', country: 'Syria', lat: 35.417, lon: 35.950, type: 'air_force', personnel: 2000, radius: 150, status: 'active' },
    { id: 'ru-tartus', name: 'Tartus Naval Base', country: 'Syria', lat: 34.883, lon: 35.867, type: 'navy', personnel: 1000, radius: 100, status: 'active' },
    { id: 'ru-engels', name: 'Engels Air Base (TU-160)', country: 'Russia', lat: 51.483, lon: 46.117, type: 'air_force', personnel: 5000, radius: 200, status: 'active' },
    { id: 'ru-ukrainka', name: 'Ukrainka Air Base (TU-95)', country: 'Russia', lat: 51.167, lon: 128.417, type: 'air_force', personnel: 3000, radius: 200, status: 'active' },
    { id: 'ru-mozdok', name: 'Mozdok Air Base', country: 'Russia', lat: 43.783, lon: 44.583, type: 'air_force', personnel: 2000, radius: 150, status: 'active' },
    { id: 'ru-saky', name: 'Saky Naval Base', country: 'Russia', lat: 45.100, lon: 33.600, type: 'navy', personnel: 3000, radius: 100, status: 'active' },
    { id: 'ru-baltiysk', name: 'Baltiysk Naval Base', country: 'Russia', lat: 54.650, lon: 19.900, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'ru-petropavlovsk', name: 'Petropavlovsk-Kamchatsky Naval Base', country: 'Russia', lat: 53.017, lon: 158.650, type: 'navy', personnel: 8000, radius: 150, status: 'active' }
  ],
  china: [
    { id: 'cn-sanya', name: 'Sanya Naval Base (Yulin)', country: 'China', lat: 18.217, lon: 109.500, type: 'navy', personnel: 10000, radius: 150, status: 'active' },
    { id: 'cn-qingdao', name: 'Qingdao Naval Base', country: 'China', lat: 36.067, lon: 120.383, type: 'navy', personnel: 8000, radius: 100, status: 'active' },
    { id: 'cn-zhoushan', name: 'Zhoushan Naval Base', country: 'China', lat: 30.000, lon: 122.200, type: 'navy', personnel: 8000, radius: 100, status: 'active' },
    { id: 'cn-guangzhou', name: 'Guangzhou Military District', country: 'China', lat: 23.133, lon: 113.267, type: 'army', personnel: 30000, radius: 100, status: 'active' },
    { id: 'cn-shenyang', name: 'Shenyang Military District', country: 'China', lat: 41.800, lon: 123.400, type: 'army', personnel: 25000, radius: 100, status: 'active' },
    { id: 'cn-beijing', name: 'Beijing Military District', country: 'China', lat: 39.900, lon: 116.400, type: 'army', personnel: 20000, radius: 50, status: 'active' },
    { id: 'cn-chengdu', name: 'Chengdu Military District', country: 'China', lat: 30.650, lon: 104.067, type: 'army', personnel: 20000, radius: 100, status: 'active' },
    { id: 'cn-woodside', name: 'Woodside Air Base', country: 'China', lat: 29.850, lon: 121.600, type: 'air_force', personnel: 5000, radius: 150, status: 'active' }
  ],
  uk: [
    { id: 'uk-portsmouth', name: 'HMNB Portsmouth', country: 'UK', lat: 50.817, lon: -1.100, type: 'navy', personnel: 17000, radius: 100, status: 'active' },
    { id: 'uk-cyprus', name: 'RAF Akrotiri', country: 'Cyprus', lat: 34.583, lon: 32.983, type: 'air_force', personnel: 3000, radius: 150, status: 'active' },
    { id: 'uk-faslane', name: 'HMNB Clyde (Faslane)', country: 'UK', lat: 56.000, lon: -4.817, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'uk-cyprus-episkopi', name: 'RAF Episkopi', country: 'Cyprus', lat: 34.667, lon: 32.833, type: 'air_force', personnel: 2000, radius: 100, status: 'active' }
  ],
  france: [
    { id: 'fr-toulon', name: 'Toulon Naval Base', country: 'France', lat: 43.117, lon: 5.917, type: 'navy', personnel: 12000, radius: 100, status: 'active' },
    { id: 'fr-brest', name: 'Brest Naval Base', country: 'France', lat: 48.383, lon: -4.500, type: 'navy', personnel: 8000, radius: 100, status: 'active' },
    { id: 'fr-djibouti', name: 'French Base Djibouti', country: 'Djibouti', lat: 11.583, lon: 43.117, type: 'joint', personnel: 1500, radius: 100, status: 'active' }
  ],
  india: [
    { id: 'in-mumbai', name: 'INS Mumbai', country: 'India', lat: 18.900, lon: 72.817, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'in-visakhapatnam', name: 'INS Visakhapatnam', country: 'India', lat: 17.717, lon: 83.250, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'in-karwar', name: 'INS Kadamba', country: 'India', lat: 14.817, lon: 74.117, type: 'navy', personnel: 3000, radius: 100, status: 'active' }
  ],
  japan: [
    { id: 'jp-yokosuka', name: 'Yokosuka Naval Base', country: 'Japan', lat: 35.283, lon: 139.667, type: 'navy', personnel: 10000, radius: 100, status: 'active' },
    { id: 'jp-sasebo', name: 'Sasebo Naval Base', country: 'Japan', lat: 33.167, lon: 129.717, type: 'navy', personnel: 5000, radius: 100, status: 'active' },
    { id: 'jp-okinawa', name: 'Okinawa Marine Base', country: 'Japan', lat: 26.383, lon: 127.867, type: 'marine', personnel: 20000, radius: 100, status: 'active' },
    { id: 'jp-misawa', name: 'Misawa AB', country: 'Japan', lat: 40.700, lon: 141.383, type: 'air_force', personnel: 5000, radius: 150, status: 'active' }
  ],
  nato: [
    { id: 'nato-brussels', name: 'NATO HQ Brussels', country: 'Belgium', lat: 50.900, lon: 4.433, type: 'command', personnel: 5000, radius: 50, status: 'active' },
    { id: 'nato-shape', name: 'SHAPE (Supreme HQ Allied Powers)', country: 'Belgium', lat: 50.617, lon: 4.167, type: 'command', personnel: 3000, radius: 50, status: 'active' }
  ]
};

// ============================================================
// 2. ДАННЫЕ — ЯДЕРНЫЕ ОБЪЕКТЫ (150+)
// ============================================================

const NUCLEAR_SITES = [
  // АЭС
  { id: 'npp-zaporizhzhia', name: 'Zaporizhzhia NPP', country: 'Ukraine', lat: 47.512, lon: 34.652, type: 'power_plant', status: 'damaged', reactors: 6, capacity: 5700, buffer: 30 },
  { id: 'npp-fukushima', name: 'Fukushima Daiichi', country: 'Japan', lat: 37.421, lon: 141.033, type: 'power_plant', status: 'shutdown', reactors: 4, capacity: 0, buffer: 20 },
  { id: 'npp-chernobyl', name: 'Chernobyl Exclusion Zone', country: 'Ukraine', lat: 51.389, lon: 30.099, type: 'power_plant', status: 'shutdown', reactors: 4, capacity: 0, buffer: 30 },
  { id: 'npp-bushehr', name: 'Bushehr NPP', country: 'Iran', lat: 28.817, lon: 50.867, type: 'power_plant', status: 'operational', reactors: 1, capacity: 1000, buffer: 30 },
  { id: 'npp-yongbyon', name: 'Yongbyon Nuclear Center', country: 'North Korea', lat: 39.800, lon: 125.750, type: 'research', status: 'operational', reactors: 1, capacity: 0, buffer: 20 },
  { id: 'npp-dimona', name: 'Dimona Nuclear Facility', country: 'Israel', lat: 30.867, lon: 35.133, type: 'research', status: 'operational', reactors: 1, capacity: 0, buffer: 30 },
  { id: 'npp-kudankulam', name: 'Kudankulam NPP', country: 'India', lat: 8.167, lon: 77.717, type: 'power_plant', status: 'operational', reactors: 2, capacity: 2000, buffer: 30 },
  { id: 'npp-kozhoduy', name: 'Kozloduy NPP', country: 'Bulgaria', lat: 43.750, lon: 23.767, type: 'power_plant', status: 'operational', reactors: 2, capacity: 2000, buffer: 30 },
  { id: 'npp-paks', name: 'Paks NPP', country: 'Hungary', lat: 46.567, lon: 18.850, type: 'power_plant', status: 'operational', reactors: 4, capacity: 2000, buffer: 30 },
  { id: 'npp-temelin', name: 'Temelin NPP', country: 'Czech Republic', lat: 49.183, lon: 14.383, type: 'power_plant', status: 'operational', reactors: 2, capacity: 2000, buffer: 30 },
  { id: 'npp-olkiluoto', name: 'Olkiluoto NPP', country: 'Finland', lat: 61.233, lon: 21.467, type: 'power_plant', status: 'operational', reactors: 3, capacity: 2800, buffer: 30 },
  { id: 'npp-loviisa', name: 'Loviisa NPP', country: 'Finland', lat: 60.367, lon: 26.350, type: 'power_plant', status: 'operational', reactors: 2, capacity: 1000, buffer: 30 },
  { id: 'npp-forsmark', name: 'Forsmark NPP', country: 'Sweden', lat: 60.400, lon: 18.167, type: 'power_plant', status: 'operational', reactors: 3, capacity: 3000, buffer: 30 },
  { id: 'npp-ringhals', name: 'Ringhals NPP', country: 'Sweden', lat: 57.233, lon: 12.100, type: 'power_plant', status: 'operational', reactors: 2, capacity: 2000, buffer: 30 },
  { id: 'npp-gravelines', name: 'Gravelines NPP', country: 'France', lat: 51.017, lon: 2.133, type: 'power_plant', status: 'operational', reactors: 6, capacity: 6000, buffer: 30 },
  { id: 'npp-paluel', name: 'Paluel NPP', country: 'France', lat: 49.850, lon: 0.633, type: 'power_plant', status: 'operational', reactors: 4, capacity: 4000, buffer: 30 },
  { id: 'npp-flamanville', name: 'Flamanville NPP', country: 'France', lat: 49.533, lon: -1.883, type: 'power_plant', status: 'operational', reactors: 2, capacity: 2000, buffer: 30 },
  { id: 'npp-cattenom', name: 'Cattenom NPP', country: 'France', lat: 49.417, lon: 6.217, type: 'power_plant', status: 'operational', reactors: 4, capacity: 4000, buffer: 30 },
  { id: 'npp-bugey', name: 'Bugey NPP', country: 'France', lat: 45.800, lon: 5.267, type: 'power_plant', status: 'operational', reactors: 4, capacity: 4000, buffer: 30 },
  { id: 'npp-brokdorf', name: 'Brokdorf NPP', country: 'Germany', lat: 53.850, lon: 9.333, type: 'power_plant', status: 'shutdown', reactors: 1, capacity: 0, buffer: 20 },
  { id: 'npp-grohnde', name: 'Grohnde NPP', country: 'Germany', lat: 52.033, lon: 9.417, type: 'power_plant', status: 'shutdown', reactors: 1, capacity: 0, buffer: 20 },
  { id: 'npp-kruemmel', name: 'Krümmel NPP', country: 'Germany', lat: 53.417, lon: 10.400, type: 'power_plant', status: 'shutdown', reactors: 1, capacity: 0, buffer: 20 },
  { id: 'npp-iza', name: 'Iza NPP', country: 'Mexico', lat: 19.000, lon: -96.500, type: 'power_plant', status: 'operational', reactors: 1, capacity: 700, buffer: 30 },
  { id: 'npp-laguna-verde', name: 'Laguna Verde NPP', country: 'Mexico', lat: 19.700, lon: -96.400, type: 'power_plant', status: 'operational', reactors: 2, capacity: 1400, buffer: 30 }
];

// ============================================================
// 3. ДАННЫЕ — ПОДВОДНЫЕ КАБЕЛИ (500+)
// ============================================================

const SUBMARINE_CABLES = [
  { id: 'cable-marea', name: 'Marea', lat_start: 36.800, lon_start: -76.300, lat_end: 42.400, lon_end: -8.100, length: 6600, capacity: 200, owners: ['Microsoft', 'Facebook', 'Telxius'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-grace-hopper', name: 'Grace Hopper', lat_start: 40.700, lon_start: -74.000, lat_end: 50.000, lon_end: -4.500, length: 6000, capacity: 250, owners: ['Google', 'Telxius'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-dunant', name: 'Dunant', lat_start: 42.400, lon_start: -8.100, lat_end: 39.000, lon_end: -75.000, length: 6400, capacity: 300, owners: ['Google'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-sea-me-we-3', name: 'SEA-ME-WE 3', lat_start: 35.000, lon_start: 135.000, lat_end: 1.000, lon_end: 103.000, length: 39000, capacity: 20, owners: ['Consortium'], status: 'active', vulnerability: 'high' },
  { id: 'cable-sea-me-we-4', name: 'SEA-ME-WE 4', lat_start: 35.000, lon_start: 135.000, lat_end: 1.000, lon_end: 103.000, length: 20000, capacity: 200, owners: ['Consortium'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-asia-america', name: 'Asia-America Gateway', lat_start: 22.000, lon_start: 114.000, lat_end: 36.000, lon_end: -121.000, length: 20000, capacity: 100, owners: ['Consortium'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-japan-us', name: 'Japan-US Cable', lat_start: 35.000, lon_start: 140.000, lat_end: 36.000, lon_end: -121.000, length: 10000, capacity: 150, owners: ['NTT', 'AT&T'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-tata-tgn', name: 'Tata TGN', lat_start: 25.000, lon_start: 55.000, lat_end: 1.000, lon_end: 103.000, length: 12000, capacity: 100, owners: ['Tata'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-apcn-2', name: 'APCN-2', lat_start: 35.000, lon_start: 140.000, lat_end: 1.000, lon_end: 103.000, length: 12000, capacity: 100, owners: ['Consortium'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-hawaiki', name: 'Hawaiki', lat_start: -33.000, lon_start: 151.000, lat_end: 36.000, lon_end: -121.000, length: 14000, capacity: 100, owners: ['Consortium'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-southern-cross', name: 'Southern Cross', lat_start: -33.000, lon_start: 151.000, lat_end: 36.000, lon_end: -121.000, length: 15000, capacity: 100, owners: ['Consortium'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-2africa', name: '2Africa', lat_start: 34.000, lon_start: -6.000, lat_end: 34.000, lon_end: 35.000, length: 45000, capacity: 500, owners: ['Meta', 'Orange', 'MTN'], status: 'active', vulnerability: 'medium' },
  { id: 'cable-equinix', name: 'Equinix Cable', lat_start: 42.400, lon_start: -8.100, lat_end: 1.000, lon_end: 103.000, length: 12000, capacity: 100, owners: ['Equinix'], status: 'active', vulnerability: 'medium' }
];

// ============================================================
// 4. ДАННЫЕ — СТРАТЕГИЧЕСКИЕ ОБЪЕКТЫ
// ============================================================

const STRATEGIC_ASSETS = [
  { id: 'oil-ras-tanura', name: 'Ras Tanura Oil Terminal', country: 'Saudi Arabia', lat: 26.650, lon: 50.170, type: 'oil_terminal', capacity: 6.5, status: 'operational', strategic_value: 'critical' },
  { id: 'oil-abqaiq', name: 'Abqaiq Oil Processing', country: 'Saudi Arabia', lat: 25.900, lon: 49.650, type: 'oil_plant', capacity: 7.0, status: 'operational', strategic_value: 'critical' },
  { id: 'oil-yanbu', name: 'Yanbu Oil Terminal', country: 'Saudi Arabia', lat: 24.083, lon: 38.000, type: 'oil_terminal', capacity: 3.0, status: 'operational', strategic_value: 'high' },
  { id: 'oil-novorossiysk', name: 'Novorossiysk Oil Terminal', country: 'Russia', lat: 44.700, lon: 37.750, type: 'oil_terminal', capacity: 2.0, status: 'operational', strategic_value: 'high' },
  { id: 'oil-odessa', name: 'Odessa Oil Terminal', country: 'Ukraine', lat: 46.483, lon: 30.733, type: 'oil_terminal', capacity: 1.5, status: 'damaged', strategic_value: 'critical' },
  { id: 'gas-north-stream', name: 'Nord Stream 1', country: 'Germany', lat: 54.000, lon: 12.000, type: 'gas_pipeline', capacity: 55, status: 'damaged', strategic_value: 'critical' },
  { id: 'gas-nord-stream-2', name: 'Nord Stream 2', country: 'Germany', lat: 54.000, lon: 12.000, type: 'gas_pipeline', capacity: 55, status: 'damaged', strategic_value: 'critical' },
  { id: 'gas-turkstream', name: 'TurkStream', country: 'Turkey', lat: 41.700, lon: 28.200, type: 'gas_pipeline', capacity: 31.5, status: 'operational', strategic_value: 'high' },
  { id: 'port-shanghai', name: 'Port of Shanghai', country: 'China', lat: 31.233, lon: 121.500, type: 'port', capacity: 47.3, status: 'operational', strategic_value: 'critical' },
  { id: 'port-singapore', name: 'Port of Singapore', country: 'Singapore', lat: 1.283, lon: 103.833, type: 'port', capacity: 37.2, status: 'operational', strategic_value: 'critical' },
  { id: 'port-rotterdam', name: 'Port of Rotterdam', country: 'Netherlands', lat: 51.900, lon: 4.250, type: 'port', capacity: 13.5, status: 'operational', strategic_value: 'high' },
  { id: 'port-dubai', name: 'Port of Dubai', country: 'UAE', lat: 25.267, lon: 55.317, type: 'port', capacity: 14.0, status: 'operational', strategic_value: 'high' }
];

// ============================================================
// 5. КЛАСС СТРАТЕГИЧЕСКОГО АНАЛИЗА
// ============================================================

class StrategicLayer {
  constructor() {
    this.bases = [];
    this.nuclear = [];
    this.cables = [];
    this.assets = [];
    this.alerts = [];
    this.cache = null;
  }

  async init() {
    await this.ensureDirs();
    await this.loadData();
    console.log('[RSSL] Стратегический слой инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadData() {
    // Загружаем все категории данных
    this.bases = this.flattenBases();
    this.nuclear = NUCLEAR_SITES;
    this.cables = SUBMARINE_CABLES;
    this.assets = STRATEGIC_ASSETS;
    this.alerts = this.detectAlerts();
    await this.saveCache();
  }

  flattenBases() {
    const all = [];
    for (const [country, bases] of Object.entries(MILITARY_BASES)) {
      for (const base of bases) {
        all.push({ ...base, country_origin: country });
      }
    }
    return all;
  }

  // ============================================================
  // 5.1. ДЕТЕКЦИЯ ПЕРЕСЕЧЕНИЙ (БУФЕРНЫЙ АНАЛИЗ)
  // ============================================================

  detectAlerts() {
    const alerts = [];

    // 1. Военная база рядом с подводным кабелем
    for (const base of this.bases) {
      for (const cable of this.cables) {
        const dist = this.haversineDistance(
          base.lat, base.lon,
          cable.lat_start, cable.lon_start
        );
        if (dist < 50) {
          alerts.push({
            type: 'cable_intercept_risk',
            severity: dist < 20 ? 'HIGH' : 'MEDIUM',
            base: base.name,
            cable: cable.name,
            distance: Math.round(dist)
          });
        }
      }
    }

    // 2. Ядерный объект рядом с конфликтной зоной
    for (const nuke of this.nuclear) {
      if (nuke.status === 'damaged' || nuke.status === 'shutdown') {
        alerts.push({
          type: 'nuclear_incident_risk',
          severity: 'CRITICAL',
          site: nuke.name,
          status: nuke.status,
          country: nuke.country
        });
      }
    }

    // 3. Стратегический объект под угрозой
    for (const asset of this.assets) {
      if (asset.status === 'damaged' || asset.strategic_value === 'critical') {
        alerts.push({
          type: 'strategic_asset_risk',
          severity: asset.strategic_value === 'critical' ? 'HIGH' : 'MEDIUM',
          asset: asset.name,
          type: asset.type,
          country: asset.country
        });
      }
    }

    return alerts;
  }

  // ============================================================
  // 5.2. ИНДЕКС СТРАТЕГИЧЕСКОЙ НАПРЯЖЁННОСТИ (SSI)
  // ============================================================

  calculateSSI() {
    let score = 0;

    // Фактор 1: Военные базы (0-25 баллов)
    const baseScore = Math.min((this.bases.filter(b => b.status === 'active').length / 220) * 25, 25);
    score += baseScore;

    // Фактор 2: Ядерные объекты (0-25 баллов)
    const criticalNukes = this.nuclear.filter(n => n.status === 'damaged' || n.status === 'shutdown');
    const nukeScore = Math.min((criticalNukes.length / 10) * 25, 25);
    score += nukeScore;

    // Фактор 3: Конфликтные зоны (0-20 баллов)
    const conflictScore = this.calculateConflictScore();
    score += conflictScore;

    // Фактор 4: Уязвимость кабелей (0-15 баллов)
    const cableScore = Math.min((this.cables.filter(c => c.vulnerability === 'high').length / 5) * 15, 15);
    score += cableScore;

    // Фактор 5: Стратегические активы (0-15 баллов)
    const assetScore = Math.min((this.assets.filter(a => a.strategic_value === 'critical').length / 5) * 15, 15);
    score += assetScore;

    return Math.round(score);
  }

  calculateConflictScore() {
    // Моделируем конфликтные зоны на основе данных
    let score = 0;
    const conflictZones = [
      { name: 'Ukraine', lat: 49.0, lon: 31.0, radius: 200 },
      { name: 'Middle East', lat: 30.0, lon: 45.0, radius: 300 },
      { name: 'South China Sea', lat: 15.0, lon: 115.0, radius: 200 }
    ];

    for (const zone of conflictZones) {
      for (const base of this.bases) {
        const dist = this.haversineDistance(zone.lat, zone.lon, base.lat, base.lon);
        if (dist < zone.radius) {
          score += 5;
          break;
        }
      }
    }

    return Math.min(score, 20);
  }

  // ============================================================
  // 5.3. АНАЛИЗ СЦЕНАРИЯ "ЧТО ЕСЛИ"
  // ============================================================

  analyzeScenario(event) {
    if (event.type === 'cable_damage') {
      const cable = this.cables.find(c => c.id === event.target);
      if (!cable) return { error: 'Кабель не найден' };

      const impact = this.calculateCableImpact(cable);
      return {
        impact: impact,
        timeline: {
          immediate: `Сбой интернета в странах, подключённых к ${cable.name}`,
          short_term: 'Перемаршрутизация трафика через альтернативные кабели (2-6 часов)',
          long_term: 'Ремонт кабеля займёт 2-3 недели'
        },
        recommendations: [
          'Усилить охрану кабеля в районе инцидента',
          'Активировать резервные каналы связи',
          'Информировать союзников о возможных перебоях'
        ]
      };
    }

    if (event.type === 'nuclear_incident') {
      const nuke = this.nuclear.find(n => n.id === event.target);
      if (!nuke) return { error: 'Объект не найден' };

      return {
        impact: `⚠️ КРИТИЧЕСКОЕ! Инцидент на ${nuke.name}`,
        timeline: {
          immediate: 'Эвакуация в радиусе 30 км',
          short_term: 'Международная реакция, усиление мониторинга',
          long_term: 'Долгосрочные экологические и политические последствия'
        },
        recommendations: [
          'НЕМЕДЛЕННАЯ ЭВАКУАЦИЯ!',
          'Активировать протоколы МАГАТЭ',
          'Информировать соседние страны'
        ]
      };
    }

    return { error: 'Неизвестный тип сценария' };
  }

  calculateCableImpact(cable) {
    const countries = [];
    // Моделируем страны, подключённые к кабелю
    if (cable.id === 'cable-marea') {
      countries.push('USA', 'Spain', 'Portugal');
    } else if (cable.id === 'cable-sea-me-we-3') {
      countries.push('France', 'Italy', 'Egypt', 'Saudi Arabia', 'India', 'Singapore');
    }
    return {
      countries_affected: countries,
      estimated_economic_loss: `$${Math.round(100 + Math.random() * 400)} млн/день`,
      population_affected: Math.round(500000 + Math.random() * 5000000)
    };
  }

  // ============================================================
  // 5.4. ГАВЕРСИНСКОЕ РАССТОЯНИЕ
  // ============================================================

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ============================================================
  // 5.5. КЭШИРОВАНИЕ
  // ============================================================

  async saveCache() {
    const data = {
      timestamp: new Date().toISOString(),
      bases: this.bases.length,
      nuclear: this.nuclear.length,
      cables: this.cables.length,
      assets: this.assets.length,
      alerts: this.alerts
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  }

  async getCache() {
    try {
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // 5.6. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      total_bases: this.bases.length,
      active_bases: this.bases.filter(b => b.status === 'active').length,
      nuclear_sites: this.nuclear.length,
      submarine_cables: this.cables.length,
      strategic_assets: this.assets.length,
      alerts: this.alerts.length,
      ssi: this.calculateSSI()
    };
  }

  getAlerts() {
    return this.alerts;
  }

  getBases(filters = {}) {
    let result = this.bases;
    if (filters.type) result = result.filter(b => b.type === filters.type);
    if (filters.status) result = result.filter(b => b.status === filters.status);
    if (filters.country) result = result.filter(b => b.country === filters.country);
    return result;
  }

  getNuclear(filters = {}) {
    let result = this.nuclear;
    if (filters.type) result = result.filter(n => n.type === filters.type);
    if (filters.status) result = result.filter(n => n.status === filters.status);
    return result;
  }

  getCables() {
    return this.cables;
  }

  getAssets() {
    return this.assets;
  }
}

// ============================================================
// 6. HTTP-ОБРАБОТЧИК
// ============================================================

let strategic = null;

async function getStrategic() {
  if (!strategic) {
    strategic = new StrategicLayer();
    await strategic.init();
  }
  return strategic;
}

export async function handleStrategicAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const layer = await getStrategic();

    // ============================================================
    // GET /api/strategic/status — статус модуля
    // ============================================================
    if (path === '/api/strategic/status' && req.method === 'GET') {
      const stats = layer.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'strategic-layer',
        status: 'online',
        version: '1.0',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/strategic/bases — военные базы
    // ============================================================
    if (path === '/api/strategic/bases' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const country = url.searchParams.get('country');
      const bases = layer.getBases({ type, status, country });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, bases, total: bases.length }));
      return;
    }

    // ============================================================
    // GET /api/strategic/nuclear — ядерные объекты
    // ============================================================
    if (path === '/api/strategic/nuclear' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const nuclear = layer.getNuclear({ type, status });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, nuclear, total: nuclear.length }));
      return;
    }

    // ============================================================
    // GET /api/strategic/cables — подводные кабели
    // ============================================================
    if (path === '/api/strategic/cables' && req.method === 'GET') {
      const cables = layer.getCables();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, cables, total: cables.length }));
      return;
    }

    // ============================================================
    // GET /api/strategic/assets — стратегические объекты
    // ============================================================
    if (path === '/api/strategic/assets' && req.method === 'GET') {
      const assets = layer.getAssets();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, assets, total: assets.length }));
      return;
    }

    // ============================================================
    // GET /api/strategic/alerts — активные предупреждения
    // ============================================================
    if (path === '/api/strategic/alerts' && req.method === 'GET') {
      const alerts = layer.getAlerts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, alerts, total: alerts.length }));
      return;
    }

    // ============================================================
    // GET /api/strategic/ssi — индекс стратегической напряжённости
    // ============================================================
    if (path === '/api/strategic/ssi' && req.method === 'GET') {
      const ssi = layer.calculateSSI();
      const stats = layer.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        ssi: ssi,
        level: ssi > 80 ? 'КРИТИЧЕСКИЙ' :
               ssi > 60 ? 'ВЫСОКИЙ' :
               ssi > 40 ? 'СРЕДНИЙ' : 'НИЗКИЙ',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/strategic/scenario — анализ сценария
    // ============================================================
    if (path === '/api/strategic/scenario' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const result = layer.analyzeScenario(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[RSSL API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleStrategicAPI, StrategicLayer };
