/**
 * Laptop Knowledge Base
 * Accurate processor specs + model→CPU mapping for smart autocomplete
 * Intel data sourced from ark.intel.com; AMD from amd.com
 */

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSOR DATABASE
// Keys are canonical CPU codes. Covers Intel 6-12th gen + AMD Ryzen 4k/5k/6k.
// ─────────────────────────────────────────────────────────────────────────────
export const PROCESSOR_DB = {
  // ── Intel 6th Gen Skylake (14nm) ──────────────────────────────────────────
  'i3-6100U':  { gen:6, arch:'Skylake',          cores:2, threads:4,  baseGHz:2.3, boostGHz:null, cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 520',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i5-6200U':  { gen:6, arch:'Skylake',          cores:2, threads:4,  baseGHz:2.3, boostGHz:2.8,  cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 520',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i5-6300U':  { gen:6, arch:'Skylake',          cores:2, threads:4,  baseGHz:2.4, boostGHz:3.0,  cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 520',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i7-6500U':  { gen:6, arch:'Skylake',          cores:2, threads:4,  baseGHz:2.5, boostGHz:3.1,  cacheMB:4,  tdpW:15, gpu:'Intel HD Graphics 520',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i7-6600U':  { gen:6, arch:'Skylake',          cores:2, threads:4,  baseGHz:2.6, boostGHz:3.4,  cacheMB:4,  tdpW:15, gpu:'Intel HD Graphics 520',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i7-6820HQ': { gen:6, arch:'Skylake',          cores:4, threads:8,  baseGHz:2.7, boostGHz:3.6,  cacheMB:8,  tdpW:45, gpu:'Intel HD Graphics 530',      ramTypes:['DDR4-2133'] },

  // ── Intel 7th Gen Kaby Lake (14nm+) ───────────────────────────────────────
  'i3-7100U':  { gen:7, arch:'Kaby Lake',        cores:2, threads:4,  baseGHz:2.4, boostGHz:null, cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 620',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i5-7200U':  { gen:7, arch:'Kaby Lake',        cores:2, threads:4,  baseGHz:2.5, boostGHz:3.1,  cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 620',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i5-7300U':  { gen:7, arch:'Kaby Lake',        cores:2, threads:4,  baseGHz:2.6, boostGHz:3.5,  cacheMB:3,  tdpW:15, gpu:'Intel HD Graphics 620',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i7-7500U':  { gen:7, arch:'Kaby Lake',        cores:2, threads:4,  baseGHz:2.7, boostGHz:3.5,  cacheMB:4,  tdpW:15, gpu:'Intel HD Graphics 620',      ramTypes:['DDR4-2133','LPDDR3-1866'] },
  'i7-7600U':  { gen:7, arch:'Kaby Lake',        cores:2, threads:4,  baseGHz:2.8, boostGHz:3.9,  cacheMB:4,  tdpW:15, gpu:'Intel HD Graphics 620',      ramTypes:['DDR4-2133','LPDDR3-1866'] },

  // ── Intel 8th Gen Kaby Lake Refresh (14nm++) ──────────────────────────────
  'i5-8250U':  { gen:8, arch:'Kaby Lake Refresh', cores:4, threads:8, baseGHz:1.6, boostGHz:3.4,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i5-8350U':  { gen:8, arch:'Kaby Lake Refresh', cores:4, threads:8, baseGHz:1.7, boostGHz:3.6,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i7-8550U':  { gen:8, arch:'Kaby Lake Refresh', cores:4, threads:8, baseGHz:1.8, boostGHz:4.0,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i7-8650U':  { gen:8, arch:'Kaby Lake Refresh', cores:4, threads:8, baseGHz:1.9, boostGHz:4.2,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },

  // ── Intel 8th Gen Whiskey Lake (14nm+++) ──────────────────────────────────
  'i3-8145U':  { gen:8, arch:'Whiskey Lake',     cores:2, threads:4,  baseGHz:2.1, boostGHz:3.9,  cacheMB:4,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i5-8265U':  { gen:8, arch:'Whiskey Lake',     cores:4, threads:8,  baseGHz:1.6, boostGHz:3.9,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i5-8365U':  { gen:8, arch:'Whiskey Lake',     cores:4, threads:8,  baseGHz:1.6, boostGHz:4.1,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] }, // vPro
  'i7-8565U':  { gen:8, arch:'Whiskey Lake',     cores:4, threads:8,  baseGHz:1.8, boostGHz:4.6,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] },
  'i7-8665U':  { gen:8, arch:'Whiskey Lake',     cores:4, threads:8,  baseGHz:1.9, boostGHz:4.8,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics 620',     ramTypes:['DDR4-2400','LPDDR3-2133'] }, // vPro

  // ── Intel 10th Gen Comet Lake-U (14nm) ────────────────────────────────────
  'i5-10210U': { gen:10, arch:'Comet Lake',      cores:4, threads:8,  baseGHz:1.6, boostGHz:4.2,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] },
  'i5-10310U': { gen:10, arch:'Comet Lake',      cores:4, threads:8,  baseGHz:1.7, boostGHz:4.4,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] }, // vPro
  'i7-10510U': { gen:10, arch:'Comet Lake',      cores:4, threads:8,  baseGHz:1.8, boostGHz:4.9,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] },
  'i7-10610U': { gen:10, arch:'Comet Lake',      cores:4, threads:8,  baseGHz:1.8, boostGHz:4.9,  cacheMB:8,  tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] }, // vPro
  'i7-10710U': { gen:10, arch:'Comet Lake',      cores:6, threads:12, baseGHz:1.1, boostGHz:4.7,  cacheMB:12, tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] },
  'i7-10810U': { gen:10, arch:'Comet Lake',      cores:6, threads:12, baseGHz:1.1, boostGHz:4.9,  cacheMB:12, tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['DDR4-2666','LPDDR3-2133'] }, // vPro

  // ── Intel 10th Gen Ice Lake-U (10nm) ──────────────────────────────────────
  'i5-1035G1': { gen:10, arch:'Ice Lake',        cores:4, threads:8,  baseGHz:1.0, boostGHz:3.6,  cacheMB:6,  tdpW:15, gpu:'Intel UHD Graphics',         ramTypes:['LPDDR4x-3733'] },
  'i5-1035G4': { gen:10, arch:'Ice Lake',        cores:4, threads:8,  baseGHz:1.1, boostGHz:3.7,  cacheMB:6,  tdpW:15, gpu:'Intel Iris Plus Graphics',   ramTypes:['LPDDR4x-3733'] },
  'i5-1035G7': { gen:10, arch:'Ice Lake',        cores:4, threads:8,  baseGHz:1.2, boostGHz:3.7,  cacheMB:6,  tdpW:15, gpu:'Intel Iris Plus Graphics',   ramTypes:['LPDDR4x-3733'] },
  'i7-1065G7': { gen:10, arch:'Ice Lake',        cores:4, threads:8,  baseGHz:1.3, boostGHz:3.9,  cacheMB:8,  tdpW:15, gpu:'Intel Iris Plus Graphics',   ramTypes:['LPDDR4x-3733'] },

  // ── Intel 11th Gen Tiger Lake-U (10nm SuperFin) ───────────────────────────
  'i5-1135G7': { gen:11, arch:'Tiger Lake',      cores:4, threads:8,  baseGHz:2.4, boostGHz:4.2,  cacheMB:8,  tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','LPDDR4x-4267'] },
  'i5-1145G7': { gen:11, arch:'Tiger Lake',      cores:4, threads:8,  baseGHz:2.6, boostGHz:4.4,  cacheMB:8,  tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','LPDDR4x-4267'] }, // vPro
  'i7-1165G7': { gen:11, arch:'Tiger Lake',      cores:4, threads:8,  baseGHz:2.8, boostGHz:4.7,  cacheMB:12, tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','LPDDR4x-4267'] },
  'i7-1185G7': { gen:11, arch:'Tiger Lake',      cores:4, threads:8,  baseGHz:3.0, boostGHz:4.8,  cacheMB:12, tdpW:28, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','LPDDR4x-4267'] }, // vPro, 28W

  // ── Intel 12th Gen Alder Lake-U 2+8 (Intel 7) ────────────────────────────
  'i5-1235U':  { gen:12, arch:'Alder Lake',      cores:10, threads:12, baseGHz:1.3, boostGHz:4.4, cacheMB:12, tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] },
  'i5-1245U':  { gen:12, arch:'Alder Lake',      cores:10, threads:12, baseGHz:1.6, boostGHz:4.4, cacheMB:12, tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] }, // vPro
  'i7-1255U':  { gen:12, arch:'Alder Lake',      cores:10, threads:12, baseGHz:1.7, boostGHz:4.7, cacheMB:12, tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] },
  'i7-1265U':  { gen:12, arch:'Alder Lake',      cores:10, threads:12, baseGHz:1.8, boostGHz:4.8, cacheMB:12, tdpW:15, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] }, // vPro

  // ── Intel 12th Gen Alder Lake-P 4+8 (Intel 7) ────────────────────────────
  'i5-1240P':  { gen:12, arch:'Alder Lake',      cores:12, threads:16, baseGHz:1.7, boostGHz:4.4, cacheMB:12, tdpW:28, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] },
  'i7-1260P':  { gen:12, arch:'Alder Lake',      cores:12, threads:16, baseGHz:2.1, boostGHz:4.7, cacheMB:18, tdpW:28, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] },
  'i7-1270P':  { gen:12, arch:'Alder Lake',      cores:12, threads:16, baseGHz:2.2, boostGHz:4.8, cacheMB:18, tdpW:28, gpu:'Intel Iris Xe Graphics',     ramTypes:['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'] },

  // ── AMD Ryzen 4000 Renoir (Zen 2, 7nm) ───────────────────────────────────
  'Ryzen 5 4500U': { gen:'4000', arch:'Zen 2 (Renoir)',  cores:6,  threads:6,  baseGHz:2.375, boostGHz:4.0, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 6)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },
  'Ryzen 5 4600U': { gen:'4000', arch:'Zen 2 (Renoir)',  cores:6,  threads:12, baseGHz:2.1,   boostGHz:4.0, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 6)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },
  'Ryzen 7 4700U': { gen:'4000', arch:'Zen 2 (Renoir)',  cores:8,  threads:8,  baseGHz:2.0,   boostGHz:4.1, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 7)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },
  'Ryzen 7 4800U': { gen:'4000', arch:'Zen 2 (Renoir)',  cores:8,  threads:16, baseGHz:1.8,   boostGHz:4.2, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 8)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },

  // ── AMD Ryzen 5000 Lucienne (Zen 2 die – not Zen 3!) ─────────────────────
  'Ryzen 5 5500U': { gen:'5000', arch:'Zen 2 (Lucienne)',cores:6,  threads:12, baseGHz:2.1,   boostGHz:4.0, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 7)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },
  'Ryzen 7 5700U': { gen:'5000', arch:'Zen 2 (Lucienne)',cores:8,  threads:16, baseGHz:1.8,   boostGHz:4.3, cacheMB:8,  tdpW:15, gpu:'AMD Radeon Graphics (Vega 8)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },

  // ── AMD Ryzen 5000 Cezanne (Zen 3, 7nm) ───────────────────────────────────
  'Ryzen 5 5600U': { gen:'5000', arch:'Zen 3 (Cezanne)', cores:6,  threads:12, baseGHz:2.3,   boostGHz:4.2, cacheMB:16, tdpW:15, gpu:'AMD Radeon Graphics (Vega 7)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },
  'Ryzen 7 5800U': { gen:'5000', arch:'Zen 3 (Cezanne)', cores:8,  threads:16, baseGHz:1.9,   boostGHz:4.4, cacheMB:16, tdpW:15, gpu:'AMD Radeon Graphics (Vega 8)',  ramTypes:['DDR4-3200','LPDDR4x-4266'] },

  // ── AMD Ryzen 6000 Rembrandt (Zen 3+, RDNA 2, 6nm) ───────────────────────
  'Ryzen 5 6600U': { gen:'6000', arch:'Zen 3+ (Rembrandt)',cores:6, threads:12, baseGHz:2.9,  boostGHz:4.5, cacheMB:16, tdpW:15, gpu:'AMD Radeon 660M',               ramTypes:['DDR5-4800','LPDDR5-6400'] },
  'Ryzen 7 6800U': { gen:'6000', arch:'Zen 3+ (Rembrandt)',cores:8, threads:16, baseGHz:2.7,  boostGHz:4.7, cacheMB:16, tdpW:15, gpu:'AMD Radeon 680M',               ramTypes:['DDR5-4800','LPDDR5-6400'] },
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL → CPU MAPPING
// Maps: company → { modelName → { cpus: string[], year: number } }
// ─────────────────────────────────────────────────────────────────────────────
export const MODEL_CPU_MAP = {
  Dell: {
    // Latitude 5xxx series
    'Latitude 5280':   { year:2017, cpus:['i5-7200U','i7-7600U'] },
    'Latitude 5290':   { year:2018, cpus:['i5-8250U','i5-8350U','i7-8650U'] },
    'Latitude 5300':   { year:2019, cpus:['i5-8265U','i5-8365U','i7-8665U'] },
    'Latitude 5310':   { year:2020, cpus:['i5-10210U','i5-10310U','i7-10610U'] },
    'Latitude 5320':   { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'Latitude 5330':   { year:2022, cpus:['i5-1235U','i5-1245U','i7-1255U','i7-1265U'] },
    'Latitude 5400':   { year:2019, cpus:['i5-8265U','i5-8365U','i7-8665U'] },
    'Latitude 5410':   { year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10610U'] },
    'Latitude 5420':   { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'Latitude 5430':   { year:2022, cpus:['i5-1235U','i5-1245U','i7-1255U','i7-1265U'] },
    'Latitude 5490':   { year:2018, cpus:['i5-8250U','i5-8350U','i7-8650U'] },
    'Latitude 5520':   { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'Latitude 5530':   { year:2022, cpus:['i5-1235U','i5-1245U','i7-1255U','i7-1265U'] },
    'Latitude 5570':   { year:2016, cpus:['i5-6200U','i5-6300U','i7-6600U','i7-6820HQ'] },
    // Latitude 7xxx series
    'Latitude 7280':   { year:2017, cpus:['i5-7200U','i5-7300U','i7-7600U'] },
    'Latitude 7290':   { year:2018, cpus:['i5-8250U','i5-8350U','i7-8650U'] },
    'Latitude 7300':   { year:2019, cpus:['i5-8265U','i5-8365U','i7-8665U'] },
    'Latitude 7310':   { year:2020, cpus:['i5-10310U','i7-10610U'] },
    'Latitude 7320':   { year:2021, cpus:['i5-1145G7','i7-1165G7','i7-1185G7'] },
    'Latitude 7330':   { year:2022, cpus:['i5-1245U','i7-1265U'] },
    'Latitude 7380':   { year:2017, cpus:['i5-7200U','i5-7300U','i7-7600U'] },
    'Latitude 7390':   { year:2018, cpus:['i5-8250U','i5-8350U','i7-8650U'] },
    'Latitude 7390 2-in-1': { year:2018, cpus:['i5-8250U','i5-8350U','i7-8650U'] },
    'Latitude 7400':   { year:2019, cpus:['i5-8365U','i7-8665U'] },
    'Latitude 7400 2-in-1': { year:2019, cpus:['i5-8365U','i7-8665U'] },
    'Latitude 7410':   { year:2020, cpus:['i5-10310U','i7-10610U'] },
    'Latitude 7420':   { year:2021, cpus:['i5-1145G7','i7-1165G7','i7-1185G7'] },
    'Latitude 7430':   { year:2022, cpus:['i5-1245U','i7-1265U'] },
    'Latitude 7440':   { year:2023, cpus:['i5-1345U','i7-1365U'] },
    // Inspiron
    'Inspiron 14 5402': { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Inspiron 14 5410': { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Inspiron 15 5502': { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Inspiron 15 5510': { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Inspiron 7506 2-in-1': { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
  },

  HP: {
    // EliteBook 800 series
    'EliteBook 840 G4':  { year:2017, cpus:['i5-7200U','i5-7300U','i7-7500U','i7-7600U'] },
    'EliteBook 840 G5':  { year:2018, cpus:['i5-8250U','i5-8350U','i7-8550U','i7-8650U'] },
    'EliteBook 840 G6':  { year:2019, cpus:['i5-8265U','i5-8365U','i7-8565U','i7-8665U'] },
    'EliteBook 840 G7':  { year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10610U'] },
    'EliteBook 840 G8':  { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'EliteBook 840 G9':  { year:2022, cpus:['i5-1235U','i5-1245U','i7-1255U','i7-1265U'] },
    'EliteBook 845 G7':  { year:2020, cpus:['Ryzen 5 4500U','Ryzen 5 4600U','Ryzen 7 4700U','Ryzen 7 4800U'] },
    'EliteBook 845 G8':  { year:2021, cpus:['Ryzen 5 5600U','Ryzen 7 5800U'] },
    'EliteBook 850 G5':  { year:2018, cpus:['i5-8250U','i5-8350U','i7-8550U','i7-8650U'] },
    'EliteBook 850 G6':  { year:2019, cpus:['i5-8265U','i5-8365U','i7-8565U','i7-8665U'] },
    'EliteBook 850 G7':  { year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10610U','i7-10710U'] },
    'EliteBook 850 G8':  { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'EliteBook 1030 G3': { year:2017, cpus:['i5-7200U','i7-7500U'] },
    'EliteBook 1030 G4': { year:2018, cpus:['i5-8265U','i7-8565U'] },
    'EliteBook 1030 G4 x360': { year:2018, cpus:['i5-8265U','i7-8565U'] },
    'EliteBook 1040 G4': { year:2018, cpus:['i5-8250U','i7-8550U','i7-8650U'] },
    'EliteBook 1040 G6': { year:2019, cpus:['i5-8265U','i5-8365U','i7-8565U','i7-8665U'] },
    'EliteBook 1040 G7': { year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10610U'] },
    'EliteBook 1040 G8': { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    // ProBook 400 series
    'ProBook 440 G6':    { year:2019, cpus:['i3-8145U','i5-8265U','i7-8565U'] },
    'ProBook 440 G7':    { year:2020, cpus:['i5-10210U','i7-10510U'] },
    'ProBook 440 G8':    { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'ProBook 440 G9':    { year:2022, cpus:['i5-1235U','i7-1255U'] },
    'ProBook 445 G7':    { year:2020, cpus:['Ryzen 5 4500U','Ryzen 5 4600U','Ryzen 7 4700U'] },
    'ProBook 445 G8':    { year:2021, cpus:['Ryzen 5 5600U','Ryzen 7 5800U'] },
    'ProBook 450 G6':    { year:2019, cpus:['i3-8145U','i5-8265U','i7-8565U'] },
    'ProBook 450 G7':    { year:2020, cpus:['i5-10210U','i7-10510U'] },
    'ProBook 450 G8':    { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'ProBook 450 G9':    { year:2022, cpus:['i5-1235U','i7-1255U'] },
    // Spectre / Envy
    'Spectre x360 13':   { year:2021, cpus:['i5-1135G7','i7-1165G7','i7-1195G7'] },
    'Spectre x360 14':   { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'HP 250 G7':         { year:2019, cpus:['i5-1035G1','i5-8265U'] },
    'HP 250 G8':         { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
  },

  Lenovo: {
    // ThinkPad X1 Carbon
    'ThinkPad X1 Carbon Gen 5':  { year:2017, cpus:['i5-7200U','i5-7300U','i7-7500U','i7-7600U'] },
    'ThinkPad X1 Carbon Gen 6':  { year:2018, cpus:['i5-8250U','i5-8350U','i7-8550U','i7-8650U'] },
    'ThinkPad X1 Carbon Gen 7':  { year:2019, cpus:['i5-8265U','i5-8365U','i7-8565U','i7-8665U'] },
    'ThinkPad X1 Carbon Gen 8':  { year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10710U'] },
    'ThinkPad X1 Carbon Gen 9':  { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7'] },
    'ThinkPad X1 Carbon Gen 10': { year:2022, cpus:['i5-1235U','i5-1245U','i7-1255U','i7-1265U'] },
    // ThinkPad T series
    'ThinkPad T470':     { year:2017, cpus:['i5-7200U','i5-7300U','i7-7500U','i7-7600U'] },
    'ThinkPad T480':     { year:2018, cpus:['i5-8250U','i5-8350U','i7-8550U','i7-8650U'] },
    'ThinkPad T490':     { year:2019, cpus:['i5-8265U','i5-8365U','i7-8565U','i7-8665U'] },
    'ThinkPad T14 Gen 1':{ year:2020, cpus:['i5-10210U','i5-10310U','i7-10510U','i7-10610U','Ryzen 5 4500U','Ryzen 5 4600U','Ryzen 7 4700U'] },
    'ThinkPad T14 Gen 2':{ year:2021, cpus:['i5-1135G7','i7-1165G7','Ryzen 5 5600U','Ryzen 7 5800U'] },
    'ThinkPad T14 Gen 3':{ year:2022, cpus:['i5-1235U','i7-1255U','Ryzen 5 6600U','Ryzen 7 6800U'] },
    // ThinkPad L series
    'ThinkPad L13 Gen 1':       { year:2020, cpus:['i5-10210U','i7-10510U'] },
    'ThinkPad L13 Gen 2':       { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'ThinkPad L13 Yoga Gen 1':  { year:2020, cpus:['i5-10210U','i5-1035G7','i7-10510U'] },
    'ThinkPad L13 Yoga Gen 2':  { year:2021, cpus:['i5-1135G7','i5-1145G7','i7-1165G7'] },
    // IdeaPad
    'IdeaPad 5 14':      { year:2021, cpus:['i5-1135G7','i7-1165G7','Ryzen 5 5500U','Ryzen 5 5600U'] },
    'IdeaPad 5 15':      { year:2021, cpus:['i5-1135G7','i7-1165G7','Ryzen 5 5500U','Ryzen 5 5600U'] },
    'IdeaPad V14':       { year:2021, cpus:['i5-1035G1','i5-1035G7','i7-1065G7'] },
    'IdeaPad V15':       { year:2021, cpus:['i5-1035G1','i5-1135G7'] },
    'ThinkPad E14 Gen 3 AMD': { year:2021, cpus:['Ryzen 5 5500U','Ryzen 5 5600U','Ryzen 7 5700U','Ryzen 7 5800U'] },
    'ThinkPad E14 Gen 4 AMD': { year:2022, cpus:['Ryzen 5 6600U','Ryzen 7 6800U'] },
  },

  Apple: {
    'MacBook Air 2018':          { year:2018, cpus:['i5-8210Y','i7-8500Y'] },
    'MacBook Air 2019':          { year:2019, cpus:['i5-8210Y','i7-8500Y'] },
    'MacBook Air 2020 (Intel)':  { year:2020, cpus:['i3-1000G4','i5-1030G7','i7-1060G7'] },
    'MacBook Pro 13 2019':       { year:2019, cpus:['i5-8257U','i5-8279U','i7-8557U','i7-8569U'] },
    'MacBook Pro 13 2020 (Intel)':{ year:2020, cpus:['i5-1038NG7','i7-1068NG7'] },
    'MacBook Pro 15 2019':       { year:2019, cpus:['i7-9750H','i9-9880H'] },
    'MacBook Air M1 2020':       { year:2020, cpus:['Apple M1'] },
    'MacBook Pro 13 M1 2020':    { year:2020, cpus:['Apple M1'] },
    'MacBook Pro 14 M1 Pro 2021':{ year:2021, cpus:['Apple M1 Pro'] },
    'MacBook Pro 16 M1 Pro 2021':{ year:2021, cpus:['Apple M1 Pro','Apple M1 Max'] },
    'MacBook Air M2 2022':       { year:2022, cpus:['Apple M2'] },
    'MacBook Pro 13 M2 2022':    { year:2022, cpus:['Apple M2'] },
  },

  Asus: {
    'VivoBook 14 X412':   { year:2019, cpus:['i5-8265U','i7-8565U'] },
    'VivoBook 14 X413':   { year:2020, cpus:['i5-1035G1','i5-1135G7','Ryzen 5 5500U'] },
    'VivoBook 15 X512':   { year:2019, cpus:['i5-8265U','i7-8565U'] },
    'VivoBook 15 X513':   { year:2020, cpus:['i5-1035G1','i5-1135G7'] },
    'ZenBook 14 UM425':   { year:2021, cpus:['Ryzen 5 5500U','Ryzen 7 5700U'] },
    'ZenBook 14 UX425':   { year:2020, cpus:['i5-1135G7','i7-1165G7'] },
    'ExpertBook B1400':   { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'ExpertBook B9450':   { year:2020, cpus:['i5-10210U','i7-10510U'] },
    'ProArt StudioBook':  { year:2022, cpus:['i7-1260P','i9-12900H'] },
    'TUF Gaming A15':     { year:2021, cpus:['Ryzen 5 5600H','Ryzen 7 5800H'] },
    'ROG Zephyrus G14':   { year:2021, cpus:['Ryzen 7 5800HS','Ryzen 9 5900HS'] },
  },

  Toshiba: {
    'Portege X20W':  { year:2018, cpus:['i5-7200U','i7-7500U','i5-8250U','i7-8550U','i7-8650U'] },
    'Portege X30':   { year:2018, cpus:['i5-8250U','i7-8550U','i7-8650U'] },
    'Tecra X40':     { year:2018, cpus:['i5-8250U','i7-8550U','i7-8650U'] },
  },

  Acer: {
    'Swift 3 SF314':  { year:2021, cpus:['i5-1135G7','i7-1165G7','Ryzen 5 5500U'] },
    'Swift 5 SF514':  { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Aspire 5 A515':  { year:2021, cpus:['i5-1135G7','Ryzen 5 5500U'] },
    'TravelMate P4':  { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'TravelMate B':   { year:2020, cpus:['Pentium Silver N5030','Celeron N4120'] },
  },

  MSI: {
    'Modern 14':        { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Prestige 14':      { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Summit E14':       { year:2021, cpus:['i5-1135G7','i7-1165G7'] },
    'Creator 15':       { year:2021, cpus:['i7-10750H','i9-10980HK'] },
    'GS66 Stealth':     { year:2021, cpus:['i7-10750H','i9-10980HK'] },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get filtered model names for a company based on typed text.
 * Returns up to 12 results for the dropdown.
 */
export function getModelSuggestions(company, text) {
  const models = MODEL_CPU_MAP[company]
  if (!models) return []
  const names = Object.keys(models)
  if (!text || text.trim() === '') return names.slice(0, 12)
  const q = text.toLowerCase()
  return names.filter(n => n.toLowerCase().includes(q)).slice(0, 12)
}

/**
 * Get list of processor codes for a specific model.
 * Falls back to a partial match if exact model not found.
 */
export function getProcessorSuggestions(company, model) {
  const models = MODEL_CPU_MAP[company]
  if (!models) return []
  // Exact match first
  if (models[model]) return models[model].cpus
  // Partial match (model name contains the input)
  const q = model.toLowerCase()
  const match = Object.keys(models).find(n => n.toLowerCase().includes(q))
  return match ? models[match].cpus : []
}

/**
 * Return full specs for a processor code.
 * Keys stored in PROCESSOR_DB are in canonical form (e.g., "i7-1185G7").
 */
export function getProcessorSpecs(cpuKey) {
  return PROCESSOR_DB[cpuKey] || null
}

/**
 * Attempt to extract a canonical CPU key from user-typed text.
 * Handles: "i7-1185G7 @3.00GHz", "i5-8265u", "AMD Ryzen 5 5600U", etc.
 */
export function extractCPUKey(text) {
  if (!text) return null
  const raw = text.trim()

  // Try direct lookup (case-insensitive)
  const directKey = Object.keys(PROCESSOR_DB).find(
    k => k.toLowerCase() === raw.toLowerCase()
  )
  if (directKey) return directKey

  // Strip speed suffix like "@1.80GHz", "@3.00ghz"
  const stripped = raw.replace(/@[\d.]+\s*[Gg][Hh][Zz].*/i, '').trim()

  // Try again after stripping
  const strippedKey = Object.keys(PROCESSOR_DB).find(
    k => k.toLowerCase() === stripped.toLowerCase()
  )
  if (strippedKey) return strippedKey

  // Partial match: find any DB key contained in the stripped text
  const partialKey = Object.keys(PROCESSOR_DB).find(
    k => stripped.toLowerCase().includes(k.toLowerCase())
  )
  return partialKey || null
}

/**
 * Return the integrated GPU name for a processor text (used for auto-fill).
 */
export function getGPUForProcessor(processorText) {
  const key = extractCPUKey(processorText)
  if (!key) return null
  return PROCESSOR_DB[key]?.gpu || null
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT-AWARE FUNCTIONS (use Supabase data from AppContext)
// These take `laptopModels` and `processors` arrays fetched from Supabase
// and prefer DB data over the static maps above.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get model name suggestions for a company from the Supabase laptop_models table.
 * Falls back to static MODEL_CPU_MAP if no DB data is available.
 */
export function getModelSuggestionsFromDB(company, query, laptopModels) {
  if (laptopModels && laptopModels.length > 0) {
    const names = laptopModels
      .filter(lm => lm.company && lm.company.toLowerCase() === (company || '').toLowerCase())
      .map(lm => lm.model_name)
    if (names.length > 0) {
      if (!query || query.trim() === '') return names.slice(0, 12)
      const q = query.toLowerCase()
      return names.filter(n => n.toLowerCase().includes(q)).slice(0, 12)
    }
  }
  // Fallback to static map
  return getModelSuggestions(company, query)
}

/**
 * Get processor suggestions for a model from the Supabase laptop_models.cpus column.
 * Falls back to static MODEL_CPU_MAP if no DB data / cpus column is empty.
 */
export function getProcessorSuggestionsFromDB(company, modelName, laptopModels) {
  if (laptopModels && laptopModels.length > 0) {
    const lm = laptopModels.find(m =>
      m.company && m.company.toLowerCase() === (company || '').toLowerCase() &&
      m.model_name && m.model_name.toLowerCase() === (modelName || '').toLowerCase()
    )
    if (lm && Array.isArray(lm.cpus) && lm.cpus.length > 0) return lm.cpus
  }
  // Fallback to static map
  return getProcessorSuggestions(company, modelName)
}

/**
 * Return full specs for a processor code using the Supabase processors table.
 * Falls back to static PROCESSOR_DB if not found in DB data.
 */
export function getProcessorSpecsFromDB(cpuKey, processors) {
  if (processors && processors.length > 0) {
    const proc = processors.find(p => p.model && p.model.toLowerCase() === (cpuKey || '').toLowerCase())
    if (proc) {
      return {
        gen:      proc.generation,
        arch:     proc.architecture,
        cores:    proc.cores,
        threads:  proc.threads,
        baseGHz:  proc.base_clock_ghz ? Number(proc.base_clock_ghz) : null,
        boostGHz: proc.boost_clock_ghz ? Number(proc.boost_clock_ghz) : null,
        cacheMB:  proc.cache_mb,
        tdpW:     proc.tdp_w,
        gpu:      proc.integrated_gpu,
        ramTypes: proc.ram_types || [],
      }
    }
  }
  // Fallback to static DB
  return getProcessorSpecs(cpuKey)
}
