/**
 * GFL Dahej Complex - Safety Districts & Roads Master Data
 * Reference Drawing: GFL-PP-DWG-SD-04-15-D0127 Rev. 03 (Date: 02.08.2024)
 * Gujarat Fluorochemicals Limited, Dahej Complex, Bharuch
 */

export interface DistrictCenter {
  x: number;
  y: number;
}

export interface SafetyDistrict {
  id: string; // 'SD-01' to 'SD-26'
  code: string; // '01' to '26'
  name: string;
  shortLabel: string;
  owner: string;
  streets: number[];
  avenues: number[];
  hatch: string;
  stroke: string;
  points: string;
  center: DistrictCenter;
  category?: 'FLUOROPOLYMERS' | 'CHLOR_ALKALI' | 'CHEMICALS' | 'POWER_UTILITIES' | 'LOGISTICS_WAREHOUSE' | 'ADMIN_SERVICES' | 'ENVIRONMENT';
  riskProfile?: 'HIGH' | 'MEDIUM' | 'LOW';
  nearestGate?: string;
  description?: string;
}

export const SAFETY_DISTRICTS: SafetyDistrict[] = [
  {
    id: 'SD-01', code: '01',
    name: 'DPTFE, APTFE, MPTFE Warehouse, BR1, BR2 Area',
    shortLabel: 'DPTFE / APTFE / BR1-2',
    owner: 'Sandeep Tarafdar',
    streets: [1, 2, 9, 11, 12, 22],
    avenues: [3, 5, 6, 7],
    hatch: 'url(#hatch-diag-red)',
    stroke: '#dc2626',
    points: '345,100 605,112 605,345 345,345',
    center: { x: 475, y: 225 },
    category: 'FLUOROPOLYMERS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Fluoropolymer finishing, reactor trains, sintering ovens, and dedicated warehouse facilities.'
  },
  {
    id: 'SD-02', code: '02',
    name: 'ML Wash Unit, SR 3&4, Polymer Godown, PFA, FEP & Micro Powder Warehouse',
    shortLabel: 'PFA / FEP / Polymer Godown',
    owner: 'Mantu Chakraborty',
    streets: [20],
    avenues: [12],
    hatch: 'url(#hatch-diag-pink)',
    stroke: '#db2777',
    points: '345,365 605,365 605,575 345,575',
    center: { x: 475, y: 470 },
    category: 'FLUOROPOLYMERS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-1 (VIP Gate)',
    description: 'Specialty fluoropolymers (PFA, FEP, Micro-Powder) processing, washing stages, and finished polymer warehousing.'
  },
  {
    id: 'SD-03', code: '03',
    name: 'FKM, SAA, ETFE Storage & Kilo Lab, Storage PVDF',
    shortLabel: 'FKM / ETFE / PVDF Storage',
    owner: 'Kamlesh Mishra',
    streets: [10, 13, 15, 16],
    avenues: [1, 3, 4],
    hatch: 'url(#hatch-lime-dots)',
    stroke: '#65a30d',
    points: '625,115 765,122 765,345 625,345',
    center: { x: 695, y: 230 },
    category: 'FLUOROPOLYMERS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Fluoroelastomers formulation, research pilot, and controlled raw polymer chemical storage.'
  },
  {
    id: 'SD-04', code: '04',
    name: 'TFE 1, R-125 Plant & Storage, R-125 Storage Tank Area',
    shortLabel: 'TFE-1 & R-125 Plant',
    owner: 'T.K. Das',
    streets: [10, 13, 15, 16],
    avenues: [7, 8, 9],
    hatch: 'url(#hatch-lime-dots)',
    stroke: '#65a30d',
    points: '625,365 765,365 765,575 625,575',
    center: { x: 695, y: 470 },
    category: 'CHEMICALS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Primary monomer generation, R-125 refrigerant gasification, and pressurized storage.'
  },
  {
    id: 'SD-05', code: '05',
    name: 'CMS, Methanol Storage, CMS Utility',
    shortLabel: 'CMS Plant & Methanol',
    owner: 'Jagdishbhai Vadodariya',
    streets: [3, 11, 19, 20, 21, 25],
    avenues: [6, 13, 14, 15],
    hatch: 'url(#hatch-cross-orange)',
    stroke: '#ea580c',
    points: '785,124 1075,138 1075,500 785,500',
    center: { x: 930, y: 312 },
    category: 'CHEMICALS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Chloromethane synthesis from methanol and chlorine gas, highly pressurized distillation columns.'
  },
  {
    id: 'SD-06', code: '06',
    name: 'CaCl2, Bullet Storage, Salt Saturator, Flaker, H2 Filling',
    shortLabel: 'CaCl2 / Flaker / H2 Filling',
    owner: 'D.K. Singh',
    streets: [1, 18, 21, 22, 23, 26, 27],
    avenues: [10, 12, 13, 14],
    hatch: 'url(#hatch-cyan-lines)',
    stroke: '#0891b2',
    points: '1450,500 1835,500 1835,610 1690,610 1690,715 1450,715',
    center: { x: 1610, y: 605 },
    category: 'CHLOR_ALKALI',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-6 (Salt Gate)',
    description: 'Calcium chloride recovery, caustic flaking, hydrogen compression, and salt saturation.'
  },
  {
    id: 'SD-07', code: '07',
    name: 'Tank Farm, CaCl2 & FL Utility, Limestone and Rejected Stone Area',
    shortLabel: 'Tank Farm & CaCl2 Utility',
    owner: 'R.K. Gupta',
    streets: [5, 6, 29, 30, 31],
    avenues: [4, 11, 12, 15],
    hatch: 'url(#hatch-brown-dense)',
    stroke: '#a16207',
    points: '1095,140 1835,172 1835,245 1095,245',
    center: { x: 1465, y: 198 },
    category: 'CHLOR_ALKALI',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-6 (Salt Gate)',
    description: 'Bulk acid tanks (HCl, H2SO4), caustic lye storage, limestone crushing, and chemical neutralization.'
  },
  {
    id: 'SD-08', code: '08',
    name: 'AHF Unloading Area',
    shortLabel: 'AHF Unloading Area',
    owner: 'R.K. Gupta',
    streets: [32, 33, 34, 36, 38],
    avenues: [3, 4, 5, 6, 7, 8, 10, 12, 15],
    hatch: 'url(#hatch-purple-diag)',
    stroke: '#9333ea',
    points: '1450,735 1615,735 1615,875 1450,875',
    center: { x: 1532, y: 805 },
    category: 'CHEMICALS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-6 (Salt Gate)',
    description: 'Anhydrous Hydrofluoric acid bulk tanker transfer, water mitigation deluge, and acid scrubbing.'
  },
  {
    id: 'SD-09', code: '09',
    name: 'AHF Plant',
    shortLabel: 'AHF Plant',
    owner: 'R.K. Gupta',
    streets: [27, 28, 29, 34, 35],
    avenues: [1],
    hatch: 'url(#hatch-purple-diag)',
    stroke: '#9333ea',
    points: '1625,735 1835,735 1835,875 1625,875',
    center: { x: 1730, y: 805 },
    category: 'CHEMICALS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-6 (Salt Gate)',
    description: 'High-hazard anhydrous HF processing, distillation columns, and scrubber neutralize towers.'
  },
  {
    id: 'SD-10', code: '10',
    name: 'Power Plant, PNG Shed, DM Plant, Coal Storage',
    shortLabel: 'Power Plant / Coal / DM',
    owner: 'Devendra Bute',
    streets: [9, 10, 11, 12, 13, 14, 15, 16, 22, 28, 29, 31, 32, 36, 40],
    avenues: [15],
    hatch: 'url(#hatch-cross-yellow)',
    stroke: '#ca8a04',
    points: '785,520 1075,520 1075,830 785,830',
    center: { x: 930, y: 675 },
    category: 'POWER_UTILITIES',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-4 (Coal Gate)',
    description: 'Captive power generation, high-pressure steam boilers, water treatment reservoirs, and coal bunkers.'
  },
  {
    id: 'SD-11', code: '11',
    name: 'Common Utility & Polymer Utility (TFE 1&2, VDF Reactor, N2 Plant, Fire Water Pump House 1&2)',
    shortLabel: 'Common & Polymer Utility',
    owner: 'Sanjay Chourasia',
    streets: [7, 8, 9, 12, 14],
    avenues: [5, 6, 8, 10],
    hatch: 'url(#hatch-cross-yellow)',
    stroke: '#ca8a04',
    points: '1095,520 1290,520 1290,830 1095,830',
    center: { x: 1192, y: 675 },
    category: 'POWER_UTILITIES',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Critical safety utilities: fire hydrant ring main pumps, liquid nitrogen supply, cooling towers, and industrial air.'
  },
  {
    id: 'SD-12', code: '12',
    name: 'HSEF Building & Fire Safety Station',
    shortLabel: 'HSEF Building',
    owner: 'Sanjay Chourasia',
    streets: [1, 2, 17],
    avenues: [1, 2],
    hatch: 'url(#hatch-diag-red)',
    stroke: '#dc2626',
    points: '215,92 325,98 325,215 215,215',
    center: { x: 270, y: 155 },
    category: 'ADMIN_SERVICES',
    riskProfile: 'LOW',
    nearestGate: 'Gate-1 (VIP Gate)',
    description: 'Emergency command post, frontline fire tenders, safety training hall, and medical first-aid center.'
  },
  {
    id: 'SD-13', code: '13',
    name: 'Lagoon Area (Solar Evaporation & Guard Lagoon)',
    shortLabel: 'Lagoon Area (East & West)',
    owner: 'Sanjay Chourasia',
    streets: [38, 39, 40],
    avenues: [14, 15],
    hatch: 'url(#hatch-lime-dots)',
    stroke: '#15803d',
    points: '1095,260 1835,260 1835,480 1095,480',
    center: { x: 1465, y: 370 },
    category: 'ENVIRONMENT',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-4 (Coal Gate)',
    description: 'Engineered stormwater and treated water stabilization lagoon with weir monitoring.'
  },
  {
    id: 'SD-14', code: '14',
    name: 'Switch Yard, Electrical Sub-Station & Transformer Area',
    shortLabel: 'Switch Yard & Sub-Station',
    owner: 'Girish Mehta',
    streets: [10, 16, 39, 40],
    avenues: [1, 12],
    hatch: 'url(#hatch-blue-cross)',
    stroke: '#2563eb',
    points: '220,890 420,890 420,990 250,990',
    center: { x: 325, y: 940 },
    category: 'POWER_UTILITIES',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-5 (Labour Gate)',
    description: '66kV high voltage receiving gantry, power transformers, SF6 switchgear, and MCC rooms.'
  },
  {
    id: 'SD-15', code: '15',
    name: 'Main Administration Building, Security Gates & Horticulture, New Canteen, Vastu Well',
    shortLabel: 'Admin / Security / Canteen',
    owner: 'Nilesh Doshi',
    streets: [1, 2, 3, 4, 5, 6, 7, 17, 18, 23, 24, 39, 40],
    avenues: [1, 12, 15],
    hatch: 'url(#hatch-grid-green)',
    stroke: '#16a34a',
    points: '135,380 325,380 325,585 165,585',
    center: { x: 235, y: 482 },
    category: 'ADMIN_SERVICES',
    riskProfile: 'LOW',
    nearestGate: 'Gate-1 (VIP Gate)',
    description: 'Corporate headquarters, main gate security, staff dining, ornamental gardens, and Vastu Well.'
  },
  {
    id: 'SD-16', code: '16',
    name: 'Central Workshop, CES Building',
    shortLabel: 'Central Workshop & CES',
    owner: 'Bharat Khunt',
    streets: [7, 11, 12],
    avenues: [2, 6],
    hatch: 'url(#hatch-diag-red)',
    stroke: '#dc2626',
    points: '785,850 960,850 960,975 785,975',
    center: { x: 872, y: 912 },
    category: 'LOGISTICS_WAREHOUSE',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Heavy equipment reconditioning, machine shop, valve testing, and electrical rewinding bay.'
  },
  {
    id: 'SD-17', code: '17',
    name: 'Store & Material Warehouse, R-134a / R-410A Cylinder Storage',
    shortLabel: 'Store & Material Warehouse',
    owner: 'Yatin Gami',
    streets: [7, 17, 18],
    avenues: [3],
    hatch: 'url(#hatch-orange-solid)',
    stroke: '#c2410c',
    points: '785,985 1170,985 1170,1115 785,1115',
    center: { x: 977, y: 1050 },
    category: 'LOGISTICS_WAREHOUSE',
    riskProfile: 'LOW',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Central spares storehouse, raw chemical drumming warehouse, and cylinder quarantine storage.'
  },
  {
    id: 'SD-18', code: '18',
    name: 'Central Scrap Yard, Contractor Area, Contractor Shed, Fab. Yard',
    shortLabel: 'Scrap & Contractor Yard',
    owner: 'Dr. Rawat',
    streets: [1, 17, 40],
    avenues: [15],
    hatch: 'url(#hatch-purple-diag)',
    stroke: '#7e22ce',
    points: '1185,850 1435,850 1435,1095 1185,1095',
    center: { x: 1310, y: 972 },
    category: 'LOGISTICS_WAREHOUSE',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-5 (Labour Gate)',
    description: 'Contractor tooling sheds, structural fabrication beds, and scrap grading containment area.'
  },
  {
    id: 'SD-19', code: '19',
    name: 'Weigh Bridge & Logistics Gate Complex',
    shortLabel: 'Weigh Bridge & Logistic',
    owner: 'Yatin Gami',
    streets: [1, 2, 39],
    avenues: [1, 2],
    hatch: 'url(#hatch-brown-dense)',
    stroke: '#b45309',
    points: '75,85 205,90 205,215 95,215',
    center: { x: 145, y: 150 },
    category: 'LOGISTICS_WAREHOUSE',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Electronic weighbridges, tanker inspection bays, and logistics clearance cabins.'
  },
  {
    id: 'SD-20', code: '20',
    name: 'GFRC (Gujarat Fluorochemicals Research Centre) & Admin Expansion',
    shortLabel: 'GFRC Complex',
    owner: 'Abid Husain',
    streets: [23, 28, 10, 18],
    avenues: [1, 3, 14, 15],
    hatch: 'url(#hatch-slate-dash)',
    stroke: '#475569',
    points: '1450,890 1755,890 1665,1085 1450,1085',
    center: { x: 1580, y: 985 },
    category: 'CHEMICALS',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-1 (VIP Gate)',
    description: 'Glass-fiber reinforced composite compounding plant and specialized resin blending bays.'
  },
  {
    id: 'SD-21', code: '21',
    name: 'VDF & R-225 Plant, R142B Tank Farm',
    shortLabel: 'VDF / R-225 / R142B',
    owner: 'Sagar Patil',
    streets: [14, 15, 19, 20],
    avenues: [6, 7, 8],
    hatch: 'url(#hatch-cyan-lines)',
    stroke: '#0284c7',
    points: '1305,520 1435,520 1435,830 1305,830',
    center: { x: 1370, y: 675 },
    category: 'FLUOROPOLYMERS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Vinylidene fluoride distillation, polymerization reactors, and pressurized R-142B feed tank farm.'
  },
  {
    id: 'SD-22', code: '22',
    name: 'PTFE, Fine Powder PTFE & Monomer Plant',
    shortLabel: 'PTFE & Fine Powder PTFE',
    owner: 'Sanjay Saxena',
    streets: [10, 16, 17, 19, 24],
    avenues: [1, 4, 9],
    hatch: 'url(#hatch-grid-green)',
    stroke: '#16a34a',
    points: '345,595 570,595 570,875 345,875',
    center: { x: 457, y: 735 },
    category: 'FLUOROPOLYMERS',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Polytetrafluoroethylene granular and fine paste compounding, particle washing, and micro-screening.'
  },
  {
    id: 'SD-23', code: '23',
    name: 'ETP (562 KLD, 1 MLD, Guard Pond) & STP Facility',
    shortLabel: 'ETP & STP Guard Pond',
    owner: 'Manoj Kumar',
    streets: [24, 27],
    avenues: [2, 3, 4],
    hatch: 'url(#hatch-cyan-lines)',
    stroke: '#0891b2',
    points: '98,225 325,225 325,365 125,365',
    center: { x: 215, y: 295 },
    category: 'ENVIRONMENT',
    riskProfile: 'HIGH',
    nearestGate: 'Gate-3 (New Material Gate)',
    description: 'Zero liquid discharge effluent treatment plant, multiple-effect evaporators, and Guard Pond.'
  },
  {
    id: 'SD-24', code: '24',
    name: 'Central Lab, TFE 1 Lab, DPTFE Lab, SPTFE, APTFE Lab, New Polymer Lab',
    shortLabel: 'Central & Polymer Labs',
    owner: 'Dr. P.K. Singh',
    streets: [8, 9, 11],
    avenues: [2, 3, 5],
    hatch: 'url(#hatch-brown-dense)',
    stroke: '#92400e',
    points: '585,685 765,685 765,975 585,975',
    center: { x: 675, y: 830 },
    category: 'ADMIN_SERVICES',
    riskProfile: 'LOW',
    nearestGate: 'Gate-1 (VIP Gate)',
    description: 'High-precision chromatography, QA/QC certification testing, and raw material validation suites.'
  },
  {
    id: 'SD-25', code: '25',
    name: 'Pilot Plant & Specialty Fluoropolymer R&D',
    shortLabel: 'Pilot Plant',
    owner: 'Pancharia SureshBabu',
    streets: [13],
    avenues: [4, 5],
    hatch: 'url(#hatch-lime-dots)',
    stroke: '#65a30d',
    points: '585,595 765,595 765,675 585,675',
    center: { x: 675, y: 635 },
    category: 'CHEMICALS',
    riskProfile: 'MEDIUM',
    nearestGate: 'Gate-2 (Material Gate)',
    description: 'Scale-up synthesis for new fluorochemical molecules and experimental polymer runs.'
  },
  {
    id: 'SD-26', code: '26',
    name: 'South-West / East Perimeter Utility, OHC & Future Expansion Zone',
    shortLabel: 'OHC & Perimeter Utility',
    owner: 'Project & Infrastructure Head',
    streets: [35, 37, 40],
    avenues: [11, 13, 15],
    hatch: 'url(#hatch-purple-diag)',
    stroke: '#9333ea',
    points: '345,1005 765,1005 765,1125 460,1125',
    center: { x: 565, y: 1065 },
    category: 'POWER_UTILITIES',
    riskProfile: 'LOW',
    nearestGate: 'Gate-5 (Labour Gate)',
    description: 'Occupational health center, future expansion plots, and perimeter stormwater channels.'
  }
];

export interface Avenue {
  id: string;
  num: number;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  districts: string[];
}

export const AVENUES: Avenue[] = [
  { id: 'AV-01', num: 1,  name: 'Avenue 1 (West Perimeter N–S Road)', x1: 90,  y1: 90,  x2: 245, y2: 990, districts: ['SD-19','SD-23','SD-15','SD-14'] },
  { id: 'AV-02', num: 2,  name: 'Avenue 2 (HSEF / Admin West N–S Corridor)', x1: 210, y1: 92,  x2: 210, y2: 590, districts: ['SD-19','SD-12','SD-23','SD-15'] },
  { id: 'AV-03', num: 3,  name: 'Avenue 3 (Main Gate to PTFE N–S Spine)', x1: 335, y1: 95,  x2: 335, y2: 1005, districts: ['SD-12','SD-01','SD-02','SD-15','SD-22','SD-14'] },
  { id: 'AV-04', num: 4,  name: 'Avenue 4 (Polymer Internal N–S Corridor)', x1: 475, y1: 105, x2: 475, y2: 1120, districts: ['SD-01','SD-02','SD-22','SD-26'] },
  { id: 'AV-05', num: 5,  name: 'Avenue 5 (PTFE / Pilot Plant N–S Corridor)', x1: 577, y1: 590, x2: 577, y2: 1120, districts: ['SD-22','SD-25','SD-24','SD-26'] },
  { id: 'AV-06', num: 6,  name: 'Avenue 6 (Warehouse / FKM / Lab N–S Avenue)', x1: 615, y1: 112, x2: 615, y2: 985, districts: ['SD-01','SD-02','SD-03','SD-04','SD-25','SD-24'] },
  { id: 'AV-07', num: 7,  name: 'Avenue 7 (Central Plant Spine N–S Avenue)', x1: 775, y1: 120, x2: 775, y2: 1125, districts: ['SD-03','SD-04','SD-05','SD-10','SD-24','SD-16','SD-17'] },
  { id: 'AV-08', num: 8,  name: 'Avenue 8 (CMS / Power Plant Internal N–S Road)', x1: 930, y1: 130, x2: 930, y2: 980, districts: ['SD-05','SD-10','SD-16'] },
  { id: 'AV-09', num: 9,  name: 'Avenue 9 (Power Plant / Utility N–S Boundary)', x1: 1085, y1: 138, x2: 1085, y2: 1115, districts: ['SD-05','SD-07','SD-10','SD-11','SD-17','SD-18'] },
  { id: 'AV-10', num: 10, name: 'Avenue 10 (Common Utility N–S Corridor)', x1: 1190, y1: 510, x2: 1190, y2: 1105, districts: ['SD-11','SD-18'] },
  { id: 'AV-11', num: 11, name: 'Avenue 11 (VDF / Lagoon West N–S Corridor)', x1: 1297, y1: 250, x2: 1297, y2: 845, districts: ['SD-13','SD-11','SD-21'] },
  { id: 'AV-12', num: 12, name: 'Avenue 12 (CaCl2 / Scrap Yard N–S Spine)', x1: 1442, y1: 155, x2: 1442, y2: 1095, districts: ['SD-07','SD-13','SD-21','SD-06','SD-08','SD-18','SD-20'] },
  { id: 'AV-13', num: 13, name: 'Avenue 13 (Lagoon / AHF Central N–S Road)', x1: 1620, y1: 165, x2: 1620, y2: 1085, districts: ['SD-07','SD-13','SD-06','SD-08','SD-09','SD-20'] },
  { id: 'AV-14', num: 14, name: 'Avenue 14 (CaCl2 / AHF East N–S Road)', x1: 1745, y1: 170, x2: 1745, y2: 960, districts: ['SD-07','SD-13','SD-06','SD-09'] },
  { id: 'AV-15', num: 15, name: 'Avenue 15 (East Perimeter N–S Highway)', x1: 1845, y1: 175, x2: 1845, y2: 950, districts: ['SD-07','SD-13','SD-06','SD-09','SD-20'] }
];

export interface Street {
  id: string;
  num: number;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const STREETS: Street[] = [
  { id: 'ST-01', num: 1,  name: 'Street 1 (North Perimeter Gate–DPTFE Road)', x1: 75, y1: 88, x2: 615, y2: 112 },
  { id: 'ST-02', num: 2,  name: 'Street 2 (Weighbridge–HSEF North Street)', x1: 85, y1: 155, x2: 335, y2: 155 },
  { id: 'ST-03', num: 3,  name: 'Street 3 (FKM–CMS North Boundary Street)', x1: 615, y1: 115, x2: 1085, y2: 138 },
  { id: 'ST-04', num: 4,  name: 'Street 4 (Tank Farm North Perimeter Street)', x1: 1085, y1: 140, x2: 1845, y2: 172 },
  { id: 'ST-05', num: 5,  name: 'Street 5 (HSEF–ETP Divider Street)', x1: 95, y1: 220, x2: 335, y2: 220 },
  { id: 'ST-06', num: 6,  name: 'Street 6 (FKM Sub-block E–W Street)', x1: 615, y1: 210, x2: 775, y2: 210 },
  { id: 'ST-07', num: 7,  name: 'Street 7 (CMS North–South Internal Street)', x1: 775, y1: 220, x2: 1085, y2: 220 },
  { id: 'ST-08', num: 8,  name: 'Street 8 (Tank Farm–Lagoon E–W Corridor)', x1: 1085, y1: 252, x2: 1845, y2: 252 },
  { id: 'ST-09', num: 9,  name: 'Street 9 (ETP Mid E–W Access Street)', x1: 110, y1: 295, x2: 335, y2: 295 },
  { id: 'ST-10', num: 10, name: 'Street 10 (DPTFE–FKM Central E–W Corridor)', x1: 335, y1: 355, x2: 775, y2: 355 },
  { id: 'ST-11', num: 11, name: 'Street 11 (ETP–Admin E–W Street)', x1: 125, y1: 372, x2: 335, y2: 372 },
  { id: 'ST-12', num: 12, name: 'Street 12 (CMS Mid Process E–W Street)', x1: 775, y1: 410, x2: 1085, y2: 410 },
  { id: 'ST-13', num: 13, name: 'Street 13 (TFE-1 / R-125 Internal E–W Street)', x1: 615, y1: 455, x2: 775, y2: 455 },
  { id: 'ST-14', num: 14, name: 'Street 14 (Admin–Canteen Internal Street)', x1: 145, y1: 475, x2: 335, y2: 475 },
  { id: 'ST-15', num: 15, name: 'Street 15 (Lagoon–CaCl2 E–W Trunk Street)', x1: 1085, y1: 490, x2: 1845, y2: 490 },
  { id: 'ST-16', num: 16, name: 'Street 16 (CMS–Power Plant E–W Trunk Road)', x1: 775, y1: 510, x2: 1442, y2: 510 },
  { id: 'ST-17', num: 17, name: 'Street 17 (Main Central E–W Plant Artery)', x1: 165, y1: 585, x2: 775, y2: 585 },
  { id: 'ST-18', num: 18, name: 'Street 18 (VDF–CaCl2 Mid E–W Street)', x1: 1300, y1: 615, x2: 1845, y2: 615 },
  { id: 'ST-19', num: 19, name: 'Street 19 (Pilot Plant–Central Lab E–W Street)', x1: 577, y1: 680, x2: 775, y2: 680 },
  { id: 'ST-20', num: 20, name: 'Street 20 (PTFE North–South Divider Street)', x1: 335, y1: 720, x2: 577, y2: 720 },
  { id: 'ST-21', num: 21, name: 'Street 21 (CaCl2–AHF E–W Trunk Corridor)', x1: 1442, y1: 725, x2: 1845, y2: 725 },
  { id: 'ST-22', num: 22, name: 'Street 22 (Common Utility Mid E–W Street)', x1: 1085, y1: 735, x2: 1442, y2: 735 },
  { id: 'ST-23', num: 23, name: 'Street 23 (West Angled Utility E–W Access)', x1: 190, y1: 720, x2: 335, y2: 720 },
  { id: 'ST-24', num: 24, name: 'Street 24 (PTFE South–Switchyard E–W Road)', x1: 215, y1: 882, x2: 577, y2: 882 },
  { id: 'ST-25', num: 25, name: 'Street 25 (Power Plant–Workshop E–W Trunk)', x1: 775, y1: 840, x2: 1442, y2: 840 },
  { id: 'ST-26', num: 26, name: 'Street 26 (AHF–GFRC E–W Corridor)', x1: 1442, y1: 882, x2: 1835, y2: 882 },
  { id: 'ST-27', num: 27, name: 'Street 27 (Central Lab Mid E–W Street)', x1: 577, y1: 840, x2: 775, y2: 840 },
  { id: 'ST-28', num: 28, name: 'Street 28 (Workshop–Store Warehouse E–W Road)', x1: 775, y1: 980, x2: 1185, y2: 980 },
  { id: 'ST-29', num: 29, name: 'Street 29 (Switchyard–Central Lab South Road)', x1: 250, y1: 995, x2: 775, y2: 995 },
  { id: 'ST-30', num: 30, name: 'Street 30 (Scrap Yard Internal E–W Street)', x1: 1185, y1: 965, x2: 1442, y2: 965 },
  { id: 'ST-31', num: 31, name: 'Street 31 (GFRC Internal E–W Road)', x1: 1442, y1: 985, x2: 1730, y2: 985 },
  { id: 'ST-32', num: 32, name: 'Street 32 (DPTFE Sub-Unit North E–W Alley)', x1: 335, y1: 230, x2: 615, y2: 230 },
  { id: 'ST-33', num: 33, name: 'Street 33 (PFA/FEP Warehouse Mid E–W Alley)', x1: 335, y1: 470, x2: 615, y2: 470 },
  { id: 'ST-34', num: 34, name: 'Street 34 (Power Plant Turbine E–W Bay Road)', x1: 775, y1: 675, x2: 1085, y2: 675 },
  { id: 'ST-35', num: 35, name: 'Street 35 (Lagoon West–East Dike Road)', x1: 1085, y1: 370, x2: 1845, y2: 370 },
  { id: 'ST-36', num: 36, name: 'Street 36 (AHF Unloading E–W Bay Street)', x1: 1442, y1: 805, x2: 1845, y2: 805 },
  { id: 'ST-37', num: 37, name: 'Street 37 (Store & Cylinder Yard E–W Street)', x1: 775, y1: 1055, x2: 1185, y2: 1055 },
  { id: 'ST-38', num: 38, name: 'Street 38 (South Perimeter E–W Service Road)', x1: 455, y1: 1130, x2: 1185, y2: 1120 },
  { id: 'ST-39', num: 39, name: 'Street 39 (South-East GFRC Perimeter Street)', x1: 1185, y1: 1105, x2: 1680, y2: 1090 },
  { id: 'ST-40', num: 40, name: 'Street 40 (Master Southern Boundary Corridor)', x1: 345, y1: 1065, x2: 775, y2: 1065 }
];

// Backwards compatibility alias
export const GFL_SAFETY_DISTRICTS = SAFETY_DISTRICTS;
export const GFL_AVENUES = AVENUES;
export const GFL_STREETS = STREETS;
