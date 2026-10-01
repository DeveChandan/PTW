/**
 * SAP Permit To Work (PTW) - Checklist & Compliance Questionnaire Types
 * Service EntitySet: Checklist
 * Service Root: /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/Checklist
 */

export type ChecklistAnswerType = 'YES' | 'NO' | 'NA' | '';

export interface SapChecklistItem {
  QuestionaireId: string;
  PermitType: string;
  Type: string;
  Sequence: string;
  Category: string;
  Question: string;
}

export interface SapChecklistResponse {
  '@odata.context'?: string;
  '@odata.metadataEtag'?: string;
  value: SapChecklistItem[];
}

export interface ChecklistAnswer {
  questionaireId: string;
  permitType: string;
  category: string;
  question: string;
  sequence?: string;
  response: ChecklistAnswerType;
  remarks: string;
}
