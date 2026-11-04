import { createSerialQueue, onStorageChanged, storageGet, storageSet } from "../utils/storage";

/**
 * What a web origin may do with Sorbet. Granted by the user in the approval window,
 * revoked in Settings. Device-local (storage.local), never synced.
 */
export interface SitePermission {
  /** CIP-30 access: enable() and wallet data (address, balance, UTxOs, logs). */
  connect: boolean;
  /** Page Hooks API without asking each time: setAddress / addToAddressBook. */
  hooks: boolean;
}
export type SitePermissionKind = keyof SitePermission;
export type SitePermissions = Record<string, SitePermission>;

const SITE_PERMISSIONS_KEY = "sitePermissions";
const NO_PERMISSION: SitePermission = { connect: false, hooks: false };

/** Canonical origin of an http(s) URL or origin; null for anything else (file:, data:, opaque). */
export function siteOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function parseSitePermissions(raw: unknown): SitePermissions {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const permissions: SitePermissions = {};
  for (const [origin, value] of Object.entries(raw)) {
    if (siteOrigin(origin) !== origin || typeof value !== "object" || value === null) continue;
    const connect = "connect" in value && value.connect === true;
    const hooks = "hooks" in value && value.hooks === true;
    if (connect || hooks) permissions[origin] = { connect, hooks };
  }
  return permissions;
}

export async function loadSitePermissions(): Promise<SitePermissions> {
  const stored = await storageGet("local", [SITE_PERMISSIONS_KEY]);
  return parseSitePermissions(stored[SITE_PERMISSIONS_KEY]);
}

export async function getSitePermission(origin: string): Promise<SitePermission> {
  return (await loadSitePermissions())[origin] ?? NO_PERMISSION;
}

const enqueue = createSerialQueue();

/** Serialized read-modify-write of the stored permissions. */
const updateSitePermissions = (update: (all: SitePermissions) => SitePermissions): Promise<SitePermissions> =>
  enqueue(async () => {
    const next = update(await loadSitePermissions());
    await storageSet("local", { [SITE_PERMISSIONS_KEY]: next });
    return next;
  });

/** Grant `kind` to an http(s) origin. Rejects for anything that is not a canonical site origin. */
export function grantSitePermission(origin: string, kind: SitePermissionKind): Promise<SitePermissions> {
  if (siteOrigin(origin) !== origin) {
    return Promise.reject(new Error(`Not a site origin: ${origin}`));
  }
  return updateSitePermissions((all) => ({
    ...all,
    [origin]: { ...(all[origin] ?? NO_PERMISSION), [kind]: true },
  }));
}

/** Forget every permission of `origin`. */
export function revokeSite(origin: string): Promise<SitePermissions> {
  return updateSitePermissions((all) => {
    const rest = { ...all };
    delete rest[origin];
    return rest;
  });
}

/** Subscribe to permission changes (any context). Returns the unsubscribe function. */
export function onSitePermissionsChanged(listener: (all: SitePermissions) => void): () => void {
  return onStorageChanged("local", [SITE_PERMISSIONS_KEY], (changes) =>
    listener(parseSitePermissions(changes[SITE_PERMISSIONS_KEY]?.newValue))
  );
}
