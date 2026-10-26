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
  },

  // 7. Excavation and Trenching Work
  {
    id: 'EXCAVATION',
    title: 'Job Hazard Analysis (JHA) for Excavation & Trenching Work',
    subtitle: 'JSA Template: Underground excavation, manual & mechanical trenching',
    categoryCode: 'EXCV',
    matchingCategories: ['EXCV'],
    matchingNatures: ['Excavation', 'Civil work', 'Road closure'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Pre-excavation scanning & utility clearance',
        hazard: 'Underground live power cables, gas pipes, instrument cables',
        consequence: 'Fatal electrocution, fire/explosion, plant communication disruption',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Obtain underground service clearance certificate and layout drawings from CES Electrical & Instrumentation.',
          'Cable detector and metal locator scan must be performed prior to any digging activity.',
          'Manual trial pits to a depth of 1 meter to be excavated before using mechanical excavators (JCB / Poclain).',
          'Barricade perimeter with caution tape and blinking flashers to prevent unauthorized vehicle access.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Trench excavation and soil stability',
        hazard: 'Trench wall collapse, soil sliding, cave-in',
        consequence: 'Worker burial, asphyxiation, fatal crush injury',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Excavations deeper than 1.2 meters must be provided with proper shoring, shielding, or stepped benching (slope angle ≤ 45°).',
          'Excavated earth / spoil heaps must be deposited at least 1 meter away from the edge of the excavation.',
          'Daily pre-work inspection of trench walls by designated safety supervisor, especially after rain.',
          'Heavy vehicular movement prohibited within 3 meters of trench edges.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Access, egress and personnel fall protection',
        hazard: 'Tripping, slipping, fall of personnel or tools into open pit',
        consequence: 'Severe head trauma, multiple fractures',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Rigid hard barricading (1.1m height with toe board) must be erected around the entire excavated pit.',
          'Secured access ladders must be provided every 7.5 meters along the trench, extending at least 1 meter above ground level.',
          'Adequate illumination (24V flameproof hand lamps for dark trenches) to be provided.',
          'Mandatory PPE: safety helmet with chin strap, safety shoes, high-visibility vest.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Hazardous atmosphere and water accumulation',
        hazard: 'Toxic/asphyxiant gas ingress, dewatering pump failure',
        consequence: 'Loss of consciousness, drowning',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Atmosphere testing for Oxygen, H2S, and Flammable gases required before entering trenches deeper than 1.5 meters.',
          'Submersible dewatering pump with tested ELCB must be deployed if ground water accumulates.',
          'Full body rescue harness with lifeline and retrieval tripod kept on standby.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 8. Heavy Rigging and Crane Lifting Operations
  {
    id: 'RIGGING_LIFTING',
    title: 'Job Hazard Analysis (JHA) for Heavy Rigging & Crane Lifting Operations',
    subtitle: 'JSA Template: Heavy mechanical lifting with mobile crane, winch & farana',
    categoryCode: 'RIGG',
    matchingCategories: ['RIGG', 'RIG'],
    matchingNatures: ['Material handling', 'Civil work'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Crane positioning & ground setup',
        hazard: 'Ground subsidence, soft soil, crane tilting / toppling',
        consequence: 'Catastrophic crane collapse, equipment damage, fatality',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Soil bearing capacity to be verified; ground must be compacted, level and firm.',
          'Heavy duty steel/wooden spreader mats must be placed under all outrigger floats.',
          'All outriggers must be 100% fully extended and locked before starting lift.',
          '360-degree tail swing radius of the crane counterweight must be barricaded.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Rigging gear inspection and hitching',
        hazard: 'Sling snap, shackle failure, improper load balance',
        consequence: 'Dropped load, fatal crush injury',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'All lifting tackles, web slings, D-shackles, and wire ropes must have valid Form-11 third-party test certificates and current color code.',
          'Safe Working Load (SWL) must be clearly stamped and never exceeded (lift load ≤ 75% rated capacity for critical lifts).',
          'Softeners / corner pads must be placed at sharp load edges to prevent sling cutting.',
          'Certified rigger must inspect slings before every lift; damaged slings discarded immediately.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Load lifting, maneuvering and placement',
        hazard: 'Load swing, collision with structures, personnel in drop zone',
        consequence: 'Impact injury, fatal crush, structural collapse',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Cordon off lifting zone; strictly NO personnel permitted under suspended load at any time.',
          'Use non-conductive polypropylene tag lines of adequate length to guide and control load rotation.',
          'Designated certified signalman wearing fluorescent vest must give standard hand signals to crane operator.',
          'Monitor wind speed using anemometer; stop lifting immediately if wind speed exceeds 25 km/h.',
          'Maintain safe distance of at least 5 meters from live overhead electrical power cables.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 9. Electrical Isolation and Maintenance Work
  {
    id: 'ELECTRICAL',
    title: 'Job Hazard Analysis (JHA) for Electrical Isolation & Maintenance',
    subtitle: 'JSA Template: Electrical maintenance, testing, breaker racking & LOTO',
    categoryCode: 'ELEC',
    matchingCategories: ['ELEC'],
    matchingNatures: ['Electrical systems', 'Instrumentation'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Electrical isolation and Lockout-Tagout (LOTO)',
        hazard: 'Inadvertent energization, back-feed, arc flash',
        consequence: 'Fatal electrical shock, severe arc flash thermal burns',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Positive electrical isolation at MCC / Breaker switchgear by authorized CES Electrical Officer.',
          'Padlock applied to breaker handle with individual danger tag stating permit number and officer details.',
          'Zero energy verification: Test breaker terminal using calibrated voltage tester, test tester on known source before and after.',
          'Discharge residual capacitive charge and apply portable safety grounding leads to line.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Maintenance on switchboards, transformers and motors',
        hazard: 'Electric shock, short circuit sparks, hand tool slippage',
        consequence: 'Electrical burns, tissue damage, fire',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Use only 1000V certified insulated hand tools (VDE tested).',
          'Wear Class 0 / Class 2 electrical insulating rubber gloves with leather over-gloves.',
          'Wear 40 cal/cm² Arc Flash face shield and flame retardant arc-rated clothing.',
          'Maintain clear working space around panels; insulating rubber mats placed in front of switchboards.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Moderate' }
      },
      {
        activity: 'Testing, de-isolation and re-energization',
        hazard: 'Flashover upon energization, loose terminal arcing',
        consequence: 'Arc blast explosion, fire',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Conduct Insulation Resistance (Megger) test before energizing.',
          'Ensure all tools, temporary earths, and test leads are removed from cubicles.',
          'Panel doors must be securely bolted closed before racking in breaker.',
          'Personnel to stand clear of panel arc-relief vents during initial charging.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 10. Industrial Radiography (NDT)
  {
    id: 'RADIOGRAPHY',
    title: 'Job Hazard Analysis (JHA) for Industrial Radiography (NDT)',
    subtitle: 'JSA Template: Non-destructive gamma/X-ray testing with radioactive sources',
    categoryCode: 'RAD',
    matchingCategories: ['RAD'],
    matchingNatures: ['Radiation sources', 'Opening line / equipment'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Radiation cordon setup and pre-work survey',
        hazard: 'Stray ionizing radiation, inadvertent public entry',
        consequence: 'Radiation exposure, radiation sickness, genetic damage',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'BARC-approved Radiological Safety Officer (RSO) and certified RT Level-II technician must oversee operation.',
          'Calculate safe distance (radiation dose ≤ 2 mR/hr at boundary); establish cordoned perimeter.',
          'Install yellow/red radiation warning barricade tape with Trefoil symbols and danger signboards in local languages.',
          'Audible horn / flashing beacon activated during source exposure.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Source camera transport and guide tube connection',
        hazard: 'Source detachment, camera damage, shutter jamming',
        consequence: 'Uncontrolled radiation emission, severe localized burns',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Radiation camera (Iridium-192 / Cobalt-60) must have valid AERB transport license and lead shielding container.',
          'Calibrated radiation survey meter and audible pocket dosimeters worn by all radiographers.',
          'Secure camera with mechanical clamp to structure; avoid excessive bending of drive cables.',
          'Check source pigtail lock mechanism before connecting guide tube.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      },
      {
        activity: 'Exposure execution and emergency retrieval',
        hazard: 'Source stuck in guide tube, overexposure during exposure',
        consequence: 'Severe radiation dose, medical emergency',
        initialRisk: { score: 16, level: 'High', likelihood: 'Likely', severity: 'Serious' },
        mitigationMeasures: [
          'Emergency source retrieval kit (lead pot, long tongs 1.5m, lead sheet) must be kept on site.',
          'Maximum exposure time strictly calculated and observed; source cranked back into camera immediately upon exposure completion.',
          'Physical survey of guide tube using survey meter to confirm source has safely returned to shielded position.',
          'TLD badge readings logged daily in AERB register.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  },

  // 11. General Cold Mechanical and Civil Maintenance Work
  {
    id: 'GENERAL_COLD',
    title: 'Job Hazard Analysis (JHA) for General Cold Maintenance Work',
    subtitle: 'JSA Template: Routine piping, structural, valve & civil maintenance',
    categoryCode: 'COLD',
    matchingCategories: ['COLD', 'OTHER'],
    matchingNatures: ['Civil work', 'Insulation', 'Painting', 'Opening line / equipment'],
    generalGuidelines: GENERAL_SAFETY_GUIDELINES,
    rows: [
      {
        activity: 'Area preparation, housekeeping & manual material handling',
        hazard: 'Sharp edges, heavy loads, slip / trip hazards',
        consequence: 'Musculoskeletal strain, cuts, puncture wounds',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Clear work area of debris, scrap metal, oil spills and obstructions before starting work.',
          'Keep manual lifting limited to max 20 kg per person; use team lifting or mechanical trolleys for heavier items.',
          'Mandatory PPE: safety helmet, safety shoes with steel toe, cut-resistant level-5 hand gloves.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Hand and pneumatic / hydraulic tool operation',
        hazard: 'Tool slippage, flying chips, vibration',
        consequence: 'Hand / finger crush, eye injury',
        initialRisk: { score: 9, level: 'Medium', likelihood: 'Possible', severity: 'Moderate' },
        mitigationMeasures: [
          'Inspect all hand tools for mushroom heads, cracked handles, or worn jaws; reject damaged tools.',
          'Wear impact safety goggles and face shield when chiseling, chipping, or hammering.',
          'Secure pneumatic hose connections with safety whip-checks and safety pins.'
        ],
        residualRisk: { score: 3, level: 'Negligible', likelihood: 'Rare', severity: 'Minor' }
      },
      {
        activity: 'Piping & equipment cold unbolting and valve maintenance',
        hazard: 'Residual trapped pressure or chemical droplets',
        consequence: 'Skin irritation, chemical burns, eye splash',
        initialRisk: { score: 12, level: 'Medium', likelihood: 'Possible', severity: 'Serious' },
        mitigationMeasures: [
          'Verify line isolation and depressurization before cracking any flange bolts.',
          'Always loosen bottom/far bolts first away from operator with chemical face shield and PVC apron.',
          'Place drip tray below flange to catch any residual liquid.'
        ],
        residualRisk: { score: 4, level: 'Low', likelihood: 'Rare', severity: 'Serious' }
      }
    ]
  }
];

export interface DetectedJha {
  template: JhaTemplate;
  isPrimary: boolean;
  workTypeCode: string;
  sourceLabel: string;
  categoryLabel: string;
}

/**
 * Normalizes work type codes across SAP OData and client formats
 */
export function normalizeCategoryCode(code: string): string {
  const c = (code || '').toUpperCase().trim();
  if (c === 'W@H' || c === 'HEIGHT' || c === 'HGHT') return 'HGHT';
  if (c === 'CSE' || c === 'CONF' || c === 'CONFINED') return 'CONF';
  if (c === 'LBRK' || c === 'LINE' || c === 'LINE_BREAK') return 'LINE';
  if (c === 'RIG' || c === 'RIGG' || c === 'RIGGING') return 'RIGG';
  if (c === 'HYD_PNEU' || c === 'HYPN' || c === 'HYDRO') return 'HYPN';
  if (c === 'ELEC' || c === 'ELECTRICAL') return 'ELEC';
  if (c === 'EXCV' || c === 'EXCAVATION') return 'EXCV';
  if (c === 'RAD' || c === 'RADIOGRAPHY') return 'RAD';
  if (c === 'HOT' || c === 'HOT_WORK') return 'HOT';
  if (c === 'COLD' || c === 'COLD_WORK') return 'COLD';
  if (c === 'OTHER') return 'OTHER';
  return c;
}

/**
 * Returns human-readable label for a given work category code
 */
export function getCategoryLabel(code: string): string {
  const norm = normalizeCategoryCode(code);
  switch (norm) {
    case 'HOT': return 'Hot Work';
    case 'COLD': return 'Cold Work';
    case 'CONF': return 'Confined Space Entry';
    case 'HGHT': return 'Work at Height';
    case 'LINE': return 'Line Breaking';
    case 'EXCV': return 'Excavation';
    case 'RIGG': return 'Rigging & Lifting';
    case 'RAD': return 'Radiography';
    case 'HYPN': return 'Hydraulic / Pneumatic / Hydro-Jetting';
    case 'ELEC': return 'Electrical Work';
    case 'OTHER': return 'Other Work';
    default: return code;
  }
}

/**
 * Returns template ID for a specific canonical work category code
 */
export function getTemplateIdForCode(code: string, isHeightContext = false): string {
  const norm = normalizeCategoryCode(code);
  switch (norm) {
    case 'HOT': return isHeightContext ? 'HOT_HEIGHT' : 'HOT_GROUND';
    case 'CONF': return 'CSE_COLD';
    case 'HGHT': return 'WORK_HEIGHT';
    case 'LINE': return 'LINE_BREAK';
    case 'HYPN': return 'HYDRO_JET';
    case 'EXCV': return 'EXCAVATION';
    case 'RIGG': return 'RIGGING_LIFTING';
    case 'ELEC': return 'ELECTRICAL';
    case 'RAD': return 'RADIOGRAPHY';
    case 'COLD': return 'GENERAL_COLD';
    default: return 'GENERAL_COLD';
  }
}

/**
 * Intelligent helper to detect the best matching JHA template for a given permit
 */
export function detectBestJhaTemplate(permit: any): JhaTemplate {
  if (!permit) return JHA_TEMPLATES[0];

  const permitType = normalizeCategoryCode(permit.PermitType || permit.actualType || '');
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
  if (permitType === 'CONF' || jobDesc.includes('confined') || jobDesc.includes('vessel entry')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'CSE_COLD');
    if (found) return found;
  }

  // 3. Check for Line Break / Blinding
  if (
    permitType === 'LINE' ||
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
      (Array.isArray(permit._WorkType) && permit._WorkType.some((w: any) => normalizeCategoryCode(w.WorkType || '') === 'HGHT'));
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
    jobDesc.includes('height') ||
    jobDesc.includes('scaffolding') ||
    jobDesc.includes('ladder')
  ) {
    const found = JHA_TEMPLATES.find(t => t.id === 'WORK_HEIGHT');
    if (found) return found;
  }

  // 6. Check for Excavation
  if (permitType === 'EXCV' || jobDesc.includes('excavation') || jobDesc.includes('trench')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'EXCAVATION');
    if (found) return found;
  }

  // 7. Check for Rigging / Lifting
  if (permitType === 'RIGG' || jobDesc.includes('crane') || jobDesc.includes('rigging') || jobDesc.includes('lifting')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'RIGGING_LIFTING');
    if (found) return found;
  }

  // 8. Check for Electrical
  if (permitType === 'ELEC' || jobDesc.includes('electrical') || jobDesc.includes('transformer') || jobDesc.includes('breaker')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'ELECTRICAL');
    if (found) return found;
  }

  // 9. Check for Radiography
  if (permitType === 'RAD' || jobDesc.includes('radiography') || jobDesc.includes('x-ray') || jobDesc.includes('gamma')) {
    const found = JHA_TEMPLATES.find(t => t.id === 'RADIOGRAPHY');
    if (found) return found;
  }

  // 10. Default fallback based on permit type or cold maintenance
  if (permitType === 'COLD') {
    return JHA_TEMPLATES.find(t => t.id === 'GENERAL_COLD') || JHA_TEMPLATES[0];
  }

  return JHA_TEMPLATES.find(t => t.matchingCategories.includes(permitType)) || JHA_TEMPLATES[0];
}

/**
 * Intelligent helper that detects ALL applicable JHA templates for a permit:
 * 1. Primary Permit Category JHA
 * 2. All attached Additional Work Types (SAP child table _WorkType, additionalTypes array, and _Safety TYPE items)
 * 3. Special nature / job description hazards (e.g. Hydro-jetting)
 * 
 * Returns an array of DetectedJha records with metadata distinguishing primary from additional work types.
 */
export function detectAllPermitJhaTemplates(permit: any): DetectedJha[] {
  if (!permit) {
    return [{
      template: JHA_TEMPLATES[0],
      isPrimary: true,
      workTypeCode: 'HOT',
      sourceLabel: 'Primary: Hot Work',
      categoryLabel: 'Hot Work'
    }];
  }

  const results: DetectedJha[] = [];
  const addedTemplateIds = new Set<string>();

  const addJha = (template: JhaTemplate, isPrimary: boolean, workTypeCode: string, sourceLabel: string, categoryLabel: string) => {
    if (!addedTemplateIds.has(template.id)) {
      addedTemplateIds.add(template.id);
      results.push({
        template,
        isPrimary,
        workTypeCode,
        sourceLabel,
        categoryLabel
      });
    }
  };

  const rawPrimary = permit.PermitType || permit.actualType || permit.primaryType || 'COLD';
  const normPrimary = normalizeCategoryCode(rawPrimary);
  const jobDesc = (permit.JobDesc || '').toLowerCase();

  // 1. Collect all Additional Work Types from _WorkType child table, additionalTypes array, and _Safety
  const rawAdditionalTypes: string[] = [];

  // 1a. Child table _WorkType (direct array or OData V2 results wrapper)
  if (Array.isArray(permit._WorkType)) {
    permit._WorkType.forEach((w: any) => {
      const code = typeof w === 'string' ? w : (w?.WorkType || w?.WorkTypeCode || '');
      if (code) rawAdditionalTypes.push(code);
    });
  } else if (Array.isArray(permit._WorkType?.results)) {
    permit._WorkType.results.forEach((w: any) => {
      const code = typeof w === 'string' ? w : (w?.WorkType || w?.WorkTypeCode || '');
      if (code) rawAdditionalTypes.push(code);
    });
  }

  // 1b. Permitted additionalTypes array
  if (Array.isArray(permit.additionalTypes)) {
    permit.additionalTypes.forEach((t: string) => {
      if (t) rawAdditionalTypes.push(t);
    });
  }

  // 1c. _Safety child table with ItemCode === 'TYPE'
  if (Array.isArray(permit._Safety)) {
    permit._Safety
      .filter((s: any) => s.ItemCode === 'TYPE' && s.Remarks)
      .forEach((s: any) => rawAdditionalTypes.push(s.Remarks));
  }

  const normAdditionalCodes = Array.from(
    new Set(rawAdditionalTypes.map(normalizeCategoryCode).filter(Boolean))
  );

  const hasHeight =
    normAdditionalCodes.includes('HGHT') ||
    jobDesc.includes('height') ||
    jobDesc.includes('scaffold') ||
    jobDesc.includes('column');

  // 2. Add Primary JHA Template
  let primaryTplId: string;
  if (normPrimary === 'HOT') {
    // If permit is Hot Work and has height, use HOT_HEIGHT if not adding WORK_HEIGHT separately
    primaryTplId = hasHeight && !normAdditionalCodes.includes('HGHT') ? 'HOT_HEIGHT' : 'HOT_GROUND';
  } else {
    primaryTplId = getTemplateIdForCode(normPrimary, hasHeight);
  }

  const primaryTemplate = getJhaTemplateById(primaryTplId) || detectBestJhaTemplate(permit);
  addJha(
    primaryTemplate,
    true,
    normPrimary,
    `Primary: ${getCategoryLabel(normPrimary)}`,
    getCategoryLabel(normPrimary)
  );

  // 3. Add JHA Templates for each Additional Work Type (_WorkType)
  normAdditionalCodes.forEach((addCode) => {
    if (addCode && addCode !== normPrimary) {
      const tplId = getTemplateIdForCode(addCode, false);
      const template = getJhaTemplateById(tplId);
      if (template) {
        addJha(
          template,
          false,
          addCode,
          `Additional WorkType (${addCode}): ${getCategoryLabel(addCode)}`,
          getCategoryLabel(addCode)
        );
      }
    }
  });

  // 4. Check for Special Hazards in Nature of Work / Job Description
  const hasHydro =
    jobDesc.includes('hydro') ||
    jobDesc.includes('jetting') ||
    (Array.isArray(permit._NATW) && permit._NATW.some((n: any) => (n.NatureDesc || '').toLowerCase().includes('hydro')));
  if (hasHydro && !addedTemplateIds.has('HYDRO_JET')) {
    const hydroTpl = getJhaTemplateById('HYDRO_JET');
    if (hydroTpl) {
      addJha(
        hydroTpl,
        false,
        'HYPN',
        'Special Nature: High-Pressure Hydro-Jetting',
        'Hydro-Jetting'
      );
    }
  }

  return results;
}

/**
 * Returns an array of all applicable JhaTemplate instances for a permit
 */
export function getAllApplicableJhaTemplates(permit: any): JhaTemplate[] {
  return detectAllPermitJhaTemplates(permit).map(d => d.template);
}

export function getJhaTemplateById(id: string): JhaTemplate {
  return JHA_TEMPLATES.find(t => t.id === id) || JHA_TEMPLATES[0];
}

