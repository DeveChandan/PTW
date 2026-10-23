/**
 * Standard Job Hazard Analysis (JHA / JSA) Templates
 * Corporate Health & Safety Standard: GFL/COR/EHSS 2004.00 Rev 01
 * Format No: HSE/SAF/F/05
 */

export type RiskLevel = 'High' | 'Medium' | 'Low' | 'Negligible';

export interface JhaRiskRating {
  score: number;
  level: RiskLevel;
  likelihood: string;
  severity: string;
}

export interface JhaRow {
  activity: string;
  hazard: string;
  consequence: string;
  initialRisk: JhaRiskRating;
  mitigationMeasures: string[];
  residualRisk: JhaRiskRating;
}

export interface JhaTemplate {
  id: string;
  title: string;
  subtitle: string;
  categoryCode: string; // Primary matching permit code (e.g. HOT, CONF, HGHT, LINE)
  matchingCategories: string[];
  matchingNatures?: string[];
  rows: JhaRow[];
  generalGuidelines: string[];
}

export const GENERAL_SAFETY_GUIDELINES: string[] = [
  'Permit to Work (PTW) procedures must be strictly followed.',
  'Ensure sufficient number of skilled and experienced personnel are engaged for the job.',
  'All tools to be examined before use and if defective, must be replaced immediately.',
  'Job shall be closely supervised by skilled and experienced supervisor.',
  'Toolbox talk (TBT) involving all personnel must be carried out relevant to the job. Discuss the identified hazards and control measures.',
  "Toolbox talks must discuss workers' health condition and medical fitness before engaging them to the job.",
  'Appropriate access and exit route shall be available at site.',
  'Good area housekeeping to be maintained.',
  'Nearby Fire extinguisher, PA system, MCP, Safety Shower and Assembly point location should be known to all. The escape route must be clear from any obstruction and wind direction must be considered during evacuation.',
  'In case of any kind of plant emergency (siren), visible liquid flammable materials/gas leakage near the work area, immediately stop the job and evacuate to the nearest safe assembly point. Inform permit issuer to check the area.'
];

export const JHA_TEMPLATES: JhaTemplate[] = [
  // 1. Open Flame Hot Work Activity at ground level
  {
    id: 'HOT_GROUND',
    title: 'Job Hazard Analysis (JHA) for Hot Work at Ground Level',
    subtitle: 'JSA Template: Open Flame Hot Work Activity at ground level',
    categoryCode: 'HOT',
    matchingCategories: ['HOT'],
    matchingNatures: ['Welding / gas cutting', 'Grinding / drilling / cutting', 'Hot tapping'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Source of ignition',
        consequence: 'Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Gas test of the system and surrounding is required before starting work, percent LEL must be zero and to be recorded in the work permit.',
          'Flammable and combustible material is to be removed from work area before starting the hot work.',
          'Portable fire extinguisher shall be kept at the job location.',
          'Ensure hot works are carried out inside leak proof booths, prepared using fire retardant blankets.',
          'Initial line puncturing to be done in presence of Process Department representatives.',
          'Area below the hot work must be kept barricaded. Fire hose to be kept ready at worksite.',
          'Fire Watcher to be present at all times during any Hot Work and 60 minutes after the activity is completed.',
          'Ensure the equipment is positively isolated, drained, de-pressurized, thoroughly purged and made flammable materials free.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Use of Portable electrical equipment',
        consequence: 'Human injury due to electrical shock',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'All the electrical equipment shall be certified by CES electrical.',
          'Damaged electrical fittings and wirings shall not be used.',
          'Portable temporary equipment that has the potential for a static spark must be earthed.',
          'DB being used for the job shall have rated ELCB/RCCB and same shall be tested by CES Electrical.',
          'The machine needs to be disconnected when not in use.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Grinding Hazards',
        consequence: 'Major injury, Major Fire, Electrical Shock',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Suitable type of wheel to be used for grinding and cutting. Same type of wheel not to be used for both jobs.',
          'Grinding wheel must be of HPL approved quality material.',
          'Wheel guard to be present.',
          'The wheel must be fixed properly with the machine.',
          'Face shield with safety goggles and leather gloves to be always worn during the job.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Gas Cutting hazards',
        consequence: 'Major injury, Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'The Regulators, Pressure Gauges, Torch, Hose & Hose connection must be of ISI mark & damaged free.',
          'Ensure flashback arrester on Gas Torch & the Cylinders side.',
          'Wet cloth should be put on the cylinder.',
          'Cylinder must be stored in upright position and tied in chain with cylinder trolley.',
          'Before starting the gas cutting job in soapy water test/leak test to be conducted to detect any leakage.',
          'Gas cylinders shall be kept outside the work area and it is to be secured properly in upright position.',
          'Face shield with gas cutting goggles and leather gloves to be always worn during the job.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Welding hazards',
        consequence: 'Electrical Shock, Major injury, Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure trained, skilled and experienced welder is engaged for the job.',
          'Welding protection suit, welding face shield and hot work leather hand gloves must be used.',
          'Welding holder and cable connections shall be well insulated. Return path shall be given properly.',
          'Welding machine must be of VRD type and certified by CES electrical.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 2. Open Flame Hot Work Activity in Chemical lines at height
  {
    id: 'HOT_HEIGHT',
    title: 'Job Hazard Analysis (JHA) for Hot Work in Chemical Lines at Height',
    subtitle: 'JSA Template: Open Flame Hot Work Activity in Chemical lines at height',
    categoryCode: 'HOT',
    matchingCategories: ['HOT'],
    matchingNatures: ['Welding / gas cutting', 'Fragile roof'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Working at height',
        hazard: 'Working at height',
        consequence: 'Severe injury due to fall from height',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'All those involved in the working at height activity must be medically fit, trained, skilled and authorized to work at height.',
          'Scaffolding structure must be prepared as per HPL procedure. It must be certified and Safe to use GREEN tags must be placed at the scaffolding structure.',
          'Scaffolding inspection checklist copy must be attached with the work permit.',
          'Workers working at height must wear full body safety harness with double lanyard.',
          'Safety belt lanyards shall be anchored above shoulder height at appropriate rigid structures or lifeline while working at height.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Working at height',
        hazard: 'Use of ladder',
        consequence: 'Human injury due to fall from ladder',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Check that ladders are in good condition.',
          'No work to be carried out from ladder unless 3-point contact can be maintained.',
          'Do not try to overreach while using the ladders.',
          'Tools and equipment must not be carried while ascending/descending ladders. Tool-bag and rope to be used.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Working at height',
        hazard: 'Fall of material',
        consequence: 'Human injury due to fall of tools or other materials',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Tools and equipment must be secured properly.',
          'Vertically upward and downward jobs shall not be carried out at the same line simultaneously.',
          'Ensure scaffolding platforms are provided with toe guards.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Source of ignition',
        consequence: 'Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Gas test of the system and surrounding is required before starting work, percent LEL must be zero and to be recorded in the work permit.',
          'Flammable and combustible material is to be removed from work area before starting the hot work.',
          'Portable fire extinguisher shall be kept at the job location.',
          'Ensure hot works are carried out inside leak proof booths, prepared using fire retardant blankets.',
          'Initial line puncturing to be done in presence of Process Department representatives.',
          'Area below the hot work must be kept barricaded. Fire hose to be kept ready at worksite.',
          'Fire Watcher to be present at all times during any Hot Work and 60 minutes after the activity is completed.',
          'Ensure the equipment is positively isolated, drained, de-pressurized, thoroughly purged and made flammable materials free.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Use of Portable electrical equipment',
        consequence: 'Human injury due to electrical shock',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'All the electrical equipment shall be certified by CES electrical.',
          'Damaged electrical fittings and wirings shall not be used.',
          'Portable temporary equipment that has the potential for a static spark must be earthed.',
          'DB being used for the job shall have rated ELCB/RCCB and same shall be tested by CES Electrical.',
          'The machine needs to be disconnected when not in use.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Grinding Hazards',
        consequence: 'Major injury, Major Fire, Electrical Shock',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Suitable type of wheel to be used for grinding and cutting. Same type of wheel not to be used for both jobs.',
          'Grinding wheel must be of HPL approved quality material.',
          'Wheel guard to be present.',
          'The wheel must be fixed properly with the machine.',
          'Face shield with safety goggles and leather gloves to be always worn during the job.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Gas Cutting hazards',
        consequence: 'Major injury, Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'The Regulators, Pressure Gauges, Torch, Hose & Hose connection must be of ISI mark & damaged free.',
          'Ensure flashback arrester on Gas Torch & the Cylinders side.',
          'Wet cloth should be put on the cylinder.',
          'Cylinder must be stored in upright position and tied in chain with cylinder trolley.',
          'Before starting the gas cutting job in soapy water test/leak test to be conducted to detect any leakage.',
          'Gas cylinders shall be kept outside the work area and it is to be secured properly in upright position.',
          'Face shield with gas cutting goggles and leather gloves to be always worn during the job.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Open Flame Hot Work activity',
        hazard: 'Welding hazards',
        consequence: 'Electrical Shock, Major injury, Major Fire',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure trained, skilled and experienced welder is engaged for the job.',
          'Welding protection suit, welding face shield and hot work leather hand gloves must be used.',
          'Welding holder and cable connections shall be well insulated. Return path shall be given properly.',
          'Welding machine must be of VRD type and certified by CES electrical.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 3. Confined Space Entry Cold Work
  {
    id: 'CSE_COLD',
    title: 'Job Hazard Analysis (JHA) for Confined Space Entry Cold Work',
    subtitle: 'JSA Template: Confined Space Entry Cold Work',
    categoryCode: 'CONF',
    matchingCategories: ['CONF', 'CSE'],
    matchingNatures: ['Opening line / equipment', 'Civil work', 'Insulation', 'Painting'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Ensuring safe system / equipment for the man entry',
        hazard: 'Inadequate system isolation & purging',
        consequence: 'Major injury, Fatality',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure equipment steam tracing (if available) is isolated.',
          'Ensure the system is positively isolate, completely drained and de-pressurized.',
          'Ensure equipment is made free of all the hazardous flammable materials as per the standard decontamination procedure.',
          'After opening the confined space manways, ensure system is thoroughly air purged.',
          'Ensure adequate forced ventilation arrangement is made ready to keep the confined space well ventilated.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Ensuring safe system / equipment for the man entry',
        hazard: 'Worksite hazards',
        consequence: 'Major injury',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure equipment is sufficiently cooled down before handing over for maintenance work.',
          'Ensure that an appropriate entry/ exit route and working platform is available.',
          'Be aware of work being carried out by other adjacent Performing Authorities.',
          'All appropriate PPEs (Safety shoe, helmet, goggles, hand gloves, Boiler Suit, ear plug, dust mask etc.) shall be used.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Entering the confined space',
        hazard: 'Confined space hazards',
        consequence: 'Major injury, Fatality',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Catastrophic' },
        mitigationMeasures: [
          'All personnel involved in the task must be trained, skilled and authorized in confined space working.',
          'Person(s) working in a confined space shall be medically fit (to wear BA apparatus & do not suffer from claustrophobia).',
          'First man-entry shall be carried out with minimum possible manpower using airline mask.',
          'Ensure no hoses are connected with the vessel.',
          'All the nitrogen utility points nearby the equipment shall be kept blinded. Nitrogen header to be kept blinded at the B/L.',
          'Adequate continuous ventilation shall be ensured.',
          'Gas test required before work commences. Ensure the O2, LEL and toxic gas test results are within safe limits and recorded in the work permit.',
          'Third party competent person shall carry out gas testing and certify area is safe to work prior to confined space entry.',
          'Ensure emergency rescue plan is prepared and discussed with involved workers.',
          'Ensure emergency rescue team is available at site with adequate rescue arrangement as per the rescue plan.',
          'Standby BA sets/ airline mask arrangement shall be kept ready outside the confined space for emergency rescue.',
          'All the entrants shall wear full body harness and that must be connected with retractable fall arrestor or rope arrangement for emergency rescue.',
          'A trained and skilled standby person (attendant) must be nominated and remains close to the entry point(s) with no other assigned tasks. He must maintain the entry/ exit register.',
          'Attendant shall have walkie talkie set available with him for emergency communication with EMCR.',
          'Gate pass of each entrant shall be deposited to the attendant before confined space entry.',
          'Only a single manway shall be kept available for entry/ exit into the confined space, all other manways (if available) shall be kept barricaded (not closed) using red tape. During any emergency entrant can use any manway for safe exit.',
          'Flammable gas bottles are NEVER to be taken into the confined space.'
        ],
        residualRisk: { score: 5, level: 'Low', likelihood: 'Rare', severity: 'Catastrophic' }
      },
      {
        activity: 'Entering the confined space',
        hazard: 'Manual Handling',
        consequence: 'Minor injury',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Permit Holder to ensure manual handling tasks to be carried out by personnel trained in safe lifting techniques.',
          'Mechanical aids to be used.',
          'Permit Holder to identify pinch points, for trapping fingers, hands or feet and make work party aware.',
          'Adequate number of workers with appropriate PPEs must be engaged for housekeeping activity.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 4. Line Break of Chemical lines and/or associated equipment
  {
    id: 'LINE_BREAK',
    title: 'Job Hazard Analysis (JHA) for Line Break of Chemical Lines & Equipment',
    subtitle: 'JSA Template: Line Break of Chemical lines and/or associated equipment',
    categoryCode: 'LINE',
    matchingCategories: ['LINE', 'LBRK', 'COLD'],
    matchingNatures: ['Opening line / equipment', 'Mechanical lockout', 'Online sealing'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Isolation of the equipment and associated energy sources',
        hazard: 'Human Errors',
        consequence: 'Human Injury, Equipment damage',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Ensure detailed system isolation scheme is prepared.',
          'Experienced and skilled field operators are engaged for the system isolations per the isolation scheme.',
          'Appropriate locks and/ or Do Not Operate tags are fixed at the closed/ opened isolation valve wheels (as per the isolation scheme) to prevent any unauthorized operation of the valve.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Isolation of the equipment and associated energy sources',
        hazard: 'Manual Handling',
        consequence: 'Human Injury, Isolation valve damage',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Ensure adequate number of people are engaged with appropriate PPEs for operating the isolation valves as per their size.',
          'Ensure engaged operators are trained and aware about the safe operation of isolation valves to avoid any damage.',
          'Forcible tightening/ operation of the isolation valve to be avoided.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Breaking the chemical containment for blinding / De-blinding at height',
        hazard: 'Working at Height',
        consequence: 'Severe injury due to fall from height',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'All those involved in the working at height activity must be medically fit, trained, skilled and authorized to work at height.',
          'Scaffolding structure must be prepared as per HPL procedure. It must be certified and Safe to use GREEN tags must be placed at the scaffolding structure.',
          'Scaffolding inspection checklist copy must be attached with the work permit.',
          'Workers working at height must wear full body safety harness with double lanyard along with other mandatory and job specific PPEs.',
          'Safety belt lanyards shall be anchored above shoulder height at appropriate rigid structures or lifeline while working at height.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Breaking the chemical containment for blinding / De-blinding at height',
        hazard: 'Exposure to hot surface',
        consequence: 'Human injury (Skin Burn)',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Ensure the steam tracing (if available) of the equipment/ system is isolated.',
          'Ensure the equipment is sufficiently cooled down before handing over for maintenance work.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Breaking the chemical containment for blinding / De-blinding at height',
        hazard: 'Breaking Containment (Chemical)',
        consequence: 'Human injury, Fire incident',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure appropriate work permit is obtained from the concerned area owner/ permit issuing authority.',
          'Ensure equipment is properly isolated, drained and de-pressurized.',
          'All joints to be broken slowly considering the possibility of trapped material while breaking the containment.',
          'Non-sparking tools shall be used.',
          'Ensure no hot work is going on at the same or nearby area.',
          'Keep metallic tray/ pots/ drums etc. ready at site to contain any hold up material present in the pump.',
          'All appropriate PPEs (Safety shoe, helmet, goggles, hand gloves, Boiler Suit, ear plug, dust mask etc.) shall be used.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Breaking the chemical containment for blinding / De-blinding at height',
        hazard: 'Fixing / Removal of blinds / spades and box up of flanges',
        consequence: 'Equipment damage, flammable materials leakage',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Ensure that proper rated blinds/ spades are being used as per the pressure rating of the pipeline.',
          'Ensure blinds/ spades are fixed with appropriate gaskets at all the flanges as identified in the isolation scheme.',
          'Tighten the flanges properly to avoid any leakage. Box up the flange with appropriate rated gasket.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Preparation of equipment and work area',
        hazard: 'Worksite Hazards',
        consequence: 'Human Injury',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Ensure the lifting affected area is kept barricaded.',
          'Ensure appropriate access and exit routes are available.',
          'Be aware of other agencies working in that area. Ensure appropriate working platform is available.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Heat exchanger dome cover open and dropping activity',
        hazard: 'Working at Height',
        consequence: 'Severe injury due to fall from height',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'All those involved in the working at height activity must be medically fit, trained, skilled and authorized to work at height.',
          'Scaffolding structure must be prepared as per HPL procedure. It must be certified and Safe to use GREEN tags must be placed at the scaffolding structure.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Heat exchanger dome cover open and dropping activity',
        hazard: 'Breaking Containment (Chemical)',
        consequence: 'Human injury, Fire incident',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure appropriate work permit is obtained from the concerned area owner/ permit issuing authority.',
          'Ensure equipment is positively isolated, drained and de-pressurized.',
          'All joints to be broken slowly considering the possibility of trapped material while breaking the containment.',
          'Non-sparking tools shall be used.',
          'Ensure no hot work is going on at the same or nearby area.',
          'Keep metallic tray/ pots/ drums etc. ready at site to contain any hold up material present in the system.',
          'All appropriate PPEs (Safety shoe, helmet, goggles, hand gloves, Boiler Suit, ear plug, dust mask etc.) shall be used.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Heat exchanger dome cover open and dropping activity',
        hazard: 'Lifting Operations',
        consequence: 'Major injury, Property damage',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Barriers and signs are to be erected. Barriers to be removed immediately it is safe to do so.',
          'Ensure the proposed laydown area can support the load in terms of size and weight.',
          'No person shall position themselves under a suspended load.',
          'Ensure all personnel involved in the lifting operation have considered potential escape routes.',
          'Clear, concise instructions for raising, lowering, slewing and stopping the crane must be established and understood.',
          'Lifting operations to be suspended when visibility is reduced such that the load cannot be seen clearly.',
          'Certified lifting machine, tools and tackles must be used.',
          'The load shall be check for potential dropped objects before lifting.',
          'An experienced, skilled person must be present and in charge of the lifting operation.',
          'Use guide rope to control the unwanted movement of the removed dome cover while dropping to the ground or permanent platform.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 5. Work at height
  {
    id: 'WORK_HEIGHT',
    title: 'Job Hazard Analysis (JHA) for Work at Height',
    subtitle: 'JSA Template: Work at height',
    categoryCode: 'HGHT',
    matchingCategories: ['HGHT', 'W@H'],
    matchingNatures: ['Fragile roof', 'Painting', 'Insulation', 'Civil work'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Working at height',
        hazard: 'Working at height',
        consequence: 'Severe injury due to fall from height',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'All those involved in the working at height activity must be medically fit, trained, skilled and authorized to work at height.',
          'Scaffolding structure must be prepared as per HPL procedure. It must be certified and Safe to use GREEN tags must be placed at the scaffolding structure.',
          'Scaffolding inspection checklist copy must be attached with the work permit.',
          'Workers working at height must wear full body safety harness with double lanyard.',
          'Safety belt lanyards shall be anchored above shoulder height at appropriate rigid structures or lifeline while working at height.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Working at height',
        hazard: 'Use of ladder',
        consequence: 'Human injury due to fall from ladder',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Check that ladders are in good condition.',
          'No work to be carried out from ladder unless 3-point contact can be maintained.',
          'Do not try to overreach while using the ladders.',
          'Tools and equipment must not be carried while ascending/descending ladders. Tool-bag and rope to be used.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Working at height',
        hazard: 'Fall of material',
        consequence: 'Human injury due to fall of tools or other materials',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Tools and equipment must be secured properly.',
          'Vertically upward and downward jobs shall not be carried out at the same line simultaneously.',
          'Ensure scaffolding platforms are provided with toe guards.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      }
    ]
  },

  // 6. High pressure hydro-jetting job at height
  {
    id: 'HYDRO_JET',
    title: 'Job Hazard Analysis (JHA) for High Pressure Hydro-Jetting at Height',
    subtitle: 'JSA Template: High pressure hydro-jetting job at height',
    categoryCode: 'HOT',
    matchingCategories: ['HOT', 'COLD', 'HGHT', 'W@H'],
    matchingNatures: ['Hydro-jetting'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Ensuring positive isolation of the system',
        hazard: 'Gas or Liquid Under Pressure',
        consequence: 'Human injury',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Ensure pipeline/ equipment is positively isolated as per the isolation scheme, drained and completely depressurized.',
          'Isolation must be proven by the permit issuing authority.',
          'Ensure the equipment is thoroughly purged as per the standard procedure to make it free of hazardous flammable materials.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Preparation of the equipment and work area',
        hazard: 'Worksite Hazards',
        consequence: 'Human injury',
        initialRisk: { score: 6, level: 'Low', likelihood: 'Possible', severity: 'Minor' },
        mitigationMeasures: [
          'Ensure that the work area is barricaded to prevent any unauthorized entry at site.',
          'Be aware of work being carried out by other adjacent Performing Authorities.',
          'Ensure that the people working near the adjacent area are made aware about the high-pressure hydro-jetting activity.',
          'Area above and below to be assessed for impact of falling spray water.'
        ],
        residualRisk: { score: 2, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'High pressure hydro-jetting job at height',
        hazard: 'Sources of Ignition',
        consequence: 'Possible fire incident',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Flammable and combustible materials to be removed from the work site where hydro-jetting machine is placed.',
          'Gas test required before work commences, percent LEL to be checked and entered in the permit.',
          'Portable fire extinguisher shall be kept near the hydro-jetting machine.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'High pressure hydro-jetting job at height',
        hazard: 'High Pressure hydro-jetting',
        consequence: 'Human injury, Property Damage',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure valid hot work permit is taken for the hydro-jetting job.',
          'Ensure the Hydro-jetting Machine, if electrically operated, is having a valid Certificate issued by CES (Elec). If Diesel operated, Spark Arrestor is attached to the exhaust pipe at suitable position.',
          'Ensure the Pressure Gauge at the hydro-jetting Pump Discharge is in working condition.',
          'Based on the severity of any deposit or blockage, the correct hydro-jetting nozzle must be selected and used. For solid deposits or blockages, using a backflow nozzle is preferred and recommended.',
          'All personnel in the work party shall have attended required training and are skilled & experienced in hydro-jetting job.',
          'Minimum possible manpower shall be deployed for the job.',
          'High pressure protection full body hydro-jetting suit along with other mandatory PPEs such as safety helmet, safety shoe/gum boots, safety goggles, face shield etc. must be appropriately worn by the involved workers.',
          'Hydro jetting equipment to be equipped with Dead man switch.',
          'The hydro-jetting operator shall operate the foot valve or dead man switch by himself to control the water pressure.',
          'Jet not to be pointed at anyone – even if switched off, and no-one permitted to pass in front of the jet.',
          'Pre-determined hand signals to be discussed at the Pre-job briefing and it must be understood by the work party.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'High pressure hydro-jetting job at height',
        hazard: 'Pressurised Hose Failure',
        consequence: 'Severe injury, Property damage',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Ensure all hoses are of required pressure rating and have valid test reports. Check that hoses are in visually good condition.',
          'Hoses must be isolated and depressurized when not in use or left unattended.',
          'Hoses to be routed so as to prevent damage from external sources or avoid kinking and passing through door ways.',
          'Whip-checks to be fitted at each connection.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'High pressure hydro-jetting job at height',
        hazard: 'Working at Height',
        consequence: 'Human injury due to fall from height',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'All those involved in the working at height activity must be medically fit, trained, skilled and authorized to work at height.',
          'Scaffolding structure must be prepared as per HPL procedure. It must be certified and Safe to use GREEN tags must be placed at the scaffolding structure.',
          'Scaffolding inspection checklist copy must be attached with the work permit.',
          'Workers working at height must wear full body safety harness with double lanyard.',
          'Safety belt lanyards shall be anchored above shoulder height at appropriate rigid structures or lifeline while working at height.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'High pressure hydro-jetting job at height',
        hazard: 'Electrical LV hazards (If power source is electricity)',
        consequence: 'Electrical shock leading to human injury',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'All the portable electrical equipment shall be certified by CES electrical.',
          'The equipment must have proper earthing connection.',
          'Damaged electrical fittings and wirings shall not be used.',
          'DB used shall have rated ELCB/RCCB and same shall be tested by CES.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      }
    ]
  }
];

/**
 * Intelligent helper to detect the best matching JHA template for a given permit
 */
export function detectBestJhaTemplate(permit: any): JhaTemplate {
  if (!permit) return JHA_TEMPLATES[0];

  const permitType = (permit.PermitType || '').toUpperCase();
  const jobDesc = (permit.JobDesc || '').toLowerCase();

  // 1. Check for Hydro-jetting
  const hasHydro =
    jobDesc.includes('hydro') ||
    jobDesc.includes('jetting') ||
    (Array.isArray(permit._NATW) && permit._NATW.some((n: any) => (n.NatureDesc || '').toLowerCase().includes('hydro')));
  if (hasHydro) {
    const found = JHA_TEMPLATES.find(t => t.id === 'HYDRO_JET');
    if (found) return found;
  }

  // 2. Check for Confined Space Entry
  if (permitType === 'CONF' || permitType === 'CSE' || jobDesc.includes('confined') || jobDesc.includes('vessel entry')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'CSE_COLD');
    if (found) return found;
  }

  // 3. Check for Line Break / Blinding
  if (
    permitType === 'LINE' ||
    permitType === 'LBRK' ||
    jobDesc.includes('line break') ||
    jobDesc.includes('blinding') ||
    jobDesc.includes('de-blinding') ||
    jobDesc.includes('opening line')
  ) {
    const found = JHA_TEMPLATES.find(t => t.id === 'LINE_BREAK');
    if (found) return found;
  }

  // 4. Check for Hot Work at Height vs Hot Work at Ground
  if (permitType === 'HOT') {
    const isHeight =
      jobDesc.includes('height') ||
      jobDesc.includes('scaffold') ||
      jobDesc.includes('column') ||
      jobDesc.includes('structure') ||
      (Array.isArray(permit._WorkType) && permit._WorkType.some((w: any) => w.WorkType === 'HGHT' || w.WorkType === 'W@H'));
    if (isHeight) {
      const found = JHA_TEMPLATES.find(t => t.id === 'HOT_HEIGHT');
      if (found) return found;
    }
    const found = JHA_TEMPLATES.find(t => t.id === 'HOT_GROUND');
    if (found) return found;
  }

  // 5. Check for Work at Height
  if (
    permitType === 'HGHT' ||
    permitType === 'W@H' ||
    jobDesc.includes('height') ||
    jobDesc.includes('scaffolding') ||
    jobDesc.includes('ladder')
  ) {
    const found = JHA_TEMPLATES.find(t => t.id === 'WORK_HEIGHT');
    if (found) return found;
  }

  // Default fallback based on permit type or ground hot work
  return JHA_TEMPLATES.find(t => t.matchingCategories.includes(permitType)) || JHA_TEMPLATES[0];
}

export function getJhaTemplateById(id: string): JhaTemplate {
  return JHA_TEMPLATES.find(t => t.id === id) || JHA_TEMPLATES[0];
}
