/** Resolve the deployment client at runtime so one build can move to QAS. */
export function getRuntimeSapClient(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const candidates = [
    new URLSearchParams(window.location.search).get('sap-client'),
    (window as Window & { SAP_CURRENT_CLIENT?: string }).SAP_CURRENT_CLIENT,
  ];
  return candidates.find(value => typeof value === 'string' && /^\d{3}$/.test(value)) ?? undefined;
}

export function getDefaultSapClient(): string {
  // Empty means SAP chooses the client using its session / service logon configuration.
  // Never bake a development client into the transportable application.
  return getRuntimeSapClient() || '';
}
