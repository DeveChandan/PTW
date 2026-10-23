import { ActivePermitPin } from './types';

export const INITIAL_ACTIVE_PERMITS: ActivePermitPin[] = [
  {
    ptwNo: 'PTW-2025-8104',
    type: 'Hot Work',
    targetId: 'SD-04',
    targetName: 'SD-04: TFE 1, R-125 Plant & Storage',
    owner: 'T.K. Das',
    contractor: 'Thermax Engineering',
    desc: 'TIG welding on R-125 condenser overhead structure',
    x: 685,
    y: 425
  },
  {
    ptwNo: 'PTW-2025-8119',
    type: 'Confined Space',
    targetId: 'SD-05',
    targetName: 'SD-05: CMS, Methanol Storage',
    owner: 'Jagdishbhai Vadodariya',
    contractor: 'GFL Mechanical Team',
    desc: 'Internal vessel inspection in CMS Storage Tank T-204',
    x: 910,
    y: 285
  },
  {
    ptwNo: 'PTW-2025-8142',
    type: 'Height / Crane',
    targetId: 'SD-10',
    targetName: 'SD-10: Power Plant, PNG Shed, DM Plant',
    owner: 'Devendra Bute',
    contractor: 'Sanghvi Movers 150T Crane',
    desc: 'Boiler feed pump motor lifting at Power Plant bay',
    x: 945,
    y: 640
  },
  {
    ptwNo: 'PTW-2025-8160',
    type: 'Excavation / Road',
    targetId: 'AV-07',
    targetName: 'Avenue 7 (Central Plant Spine N–S Avenue)',
    owner: 'Civil & Fire Safety HOD',
    contractor: 'Patel Civil Infra',
    desc: 'Fire hydrant header trenching across Avenue 7 near Street 16',
    x: 775,
    y: 530
  },
  {
    ptwNo: 'PTW-2025-8175',
    type: 'Cold Work',
    targetId: 'SD-22',
    targetName: 'SD-22: PTFE, Fine Powder PTFE',
    owner: 'Sanjay Saxena',
    contractor: 'Flowserve Valve Services',
    desc: 'PRV calibration & gasket replacement on PTFE line',
    x: 440,
    y: 690
  },
  {
    ptwNo: 'PTW-2025-8188',
    type: 'Hot Work',
    targetId: 'ST-15',
    targetName: 'Street 15 (Lagoon–CaCl2 E–W Trunk Street)',
    owner: 'D.K. Singh / Pipe Rack Team',
    contractor: 'L&T Hydrocarbon',
    desc: 'Overhead pipe-rack structural bracing along Street 15',
    x: 1520,
    y: 490
  }
];

// Backwards compatibility alias
export const SIMULATED_ACTIVE_PERMITS = INITIAL_ACTIVE_PERMITS;
