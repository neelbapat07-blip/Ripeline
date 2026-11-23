/*
  Ripeline account sync
  ---------------------
  Each account's food, shopping list, profile and preferences are stored in
  Supabase (table "user_data", one row per account that only its owner can
  read or change), so the same account shows the same fridge on every device.

  HOW IT WORKS
    - Every change is saved on the device straight away (so the app works
      offline) and sent to Supabase a moment later.
    - When the app opens, or you come back to it, it loads the account's
      latest data. Devices that are open at the same time update live.
    - The first time a device links up, any food already saved on it is
      COMBINED with what the account already has, so nothing is lost.
    - If you're offline, changes wait on the device and are sent when you're
      back online. If two devices change things at the same moment, the most
      recent save wins.

  The table is created once in the Supabase dashboard — see README ("Account sync").
*/

const SYNC_TABLE = "user_data";
const SYNC_STATE_KEY = "fridgeiq.sync.v1";      // per account, on this device: { lastSynced, linked, fingerprint }
let syncTimer = null;
let syncChannel = null;
let syncBusy = false;
let applyingRemote = false;
let syncStarted = false;   // false until the account's latest data has been loaded after logging in
let syncCancelled = false; // true while data is being deleted: late background syncs must not write anything

/* A random id for this browser, so a device can ignore the "something changed" news about its own saves */
const DEVICE_ID = (() => {
  const device = FridgeStorage.loadDevice();
  if (device.deviceId) return device.deviceId;
  const id = "dev-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  FridgeStorage.saveDevice({ ...device, deviceId: id });
  return id;
})();

function syncState() {
  return { dirty: false, lastSynced: null, linked: false, ...FridgeStorage.load(SYNC_STATE_KEY, "sync status", cleanObject, {}) };
}
function setSyncState(changes) {
  if (syncCancelled || !currentUser) return;
  FridgeStorage.save(SYNC_STATE_KEY, { ...syncState(), ...changes });
}

/* Small status line on the Profile screen */
function showSyncStatus(text, kind) {
  const line = document.getElementById("sync-status");
  if (!line) return;
  line.textContent = text;
  line.className = "sync-status" + (kind ? " sync-status--" + kind : "");
}

function syncNotSetUp(error) {
  return error && (error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message || ""));
}

/* What gets stored for the account */
function accountSnapshot() {
  return {
    items,
    shopping: shoppingList,
    profile: { name: profile.name, theme: profile.theme },
    prefs,
  };
}

/* A short "fingerprint" of the data. If this device's data has the same fingerprint as the
   last time it synced, it has no unsent changes (even if a save happened in between). */
function fingerprint() {
  // Tidy everything the same way first (and sort the details), so the same data always
  // gives the same fingerprint, however it was saved
  const snap = accountSnapshot();
  const tidy = {
    items: snap.items.map((item, i) => cleanFoodItem(item, i)),
    shopping: snap.shopping.map((entry, i) => cleanShoppingEntry(entry, i)),
    profile: snap.profile,
    prefs: snap.prefs,
  };
  const text = JSON.stringify(tidy, (key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).sort().reduce((sorted, k) => { sorted[k] = value[k]; return sorted; }, {})
      : value);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36) + "-" + text.length;
}

/* Does this device have changes the account doesn't have yet? */
function hasUnsentChanges() {
  const state = syncState();
  return state.fingerprint ? state.fingerprint !== fingerprint() : Boolean(state.dirty);
}

/* Put data from the account (Supabase) into the app, after checking it */
function applySnapshot(row) {
  if (syncCancelled) return;
  applyingRemote = true;
  try {
    const cleanItems = cleanList(Array.isArray(row.items) ? row.items : [], cleanFoodItem);
    const cleanShopping = cleanList(Array.isArray(row.shopping) ? row.shopping : [], cleanShoppingEntry);
    items = cleanItems ? cleanItems.value : [];
    shoppingList = cleanShopping ? cleanShopping.value : [];
    const remoteProfile = row.profile && typeof row.profile === "object" ? row.profile : {};
    profile = { ...profile, name: cleanText(remoteProfile.name, 40) || profile.name, theme: remoteProfile.theme || profile.theme };
    prefs = { ...DEFAULT_PREFS, ...(row.prefs && typeof row.prefs === "object" ? row.prefs : {}) };
    // keep a copy on this device (for offline use)
    FridgeStorage.save(STORAGE_KEYS.items, items);
    FridgeStorage.save(STORAGE_KEYS.shopping, shoppingList);
    FridgeStorage.save(STORAGE_KEYS.profile, profile);
    FridgeStorage.save(STORAGE_KEYS.prefs, prefs);
    applyPrefsToViews();
    applyTheme();
    updateShoppingBadge();
    refreshCurrentScreen();
    setSyncState({ fingerprint: fingerprint() });
  } finally {
    applyingRemote = false;
  }
}

/* First link of a device: combine its food with the account's (nothing gets lost) */
function combine(localList, remoteList, sameThing) {
  const result = [...remoteList];
  localList.forEach((entry) => { if (!result.some((other) => sameThing(entry, other))) result.push(entry); });
  return result;
}

/* Send this device's data to the account */
async function uploadToAccount() {
  if (!authClient || !currentUser) return false;
  const { data, error } = await authClient.from(SYNC_TABLE).upsert({
    user_id: currentUser.id,
    ...accountSnapshot(),
    device_id: DEVICE_ID,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("updated_at").single();
  if (error) throw error;
  setSyncState({ dirty: false, lastSynced: data.updated_at, linked: true, fingerprint: fingerprint() });
  return true;
}

/* Called whenever something is saved: remember there's a change, send it shortly */
function markChanged() {
  // Ignore saves made while logging in (e.g. filling in the name): until the account's latest
  // data has loaded, this device's copy may be out of date and must not be sent.
  if (applyingRemote || !appUnlocked || !currentUser || !syncStarted) return;
  setSyncState({ dirty: true });
  showSyncStatus("Saving…");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChanges, 800);
}

async function pushChanges() {
  clearTimeout(syncTimer);
  if (!currentUser || syncBusy) { if (currentUser) syncTimer = setTimeout(pushChanges, 800); return; }
  syncBusy = true;
  try {
    await uploadToAccount();
    showSyncStatus("All changes saved to your account ✓", "ok");
  } catch (error) {
    reportSyncProblem(error);
  } finally {
    syncBusy = false;
  }
}

function reportSyncProblem(error) {
  if (syncNotSetUp(error)) {
    showSyncStatus("Syncing between devices isn't switched on yet. Your changes are saved on this device.", "warn");
  } else if (!navigator.onLine || (error && !error.code && /fetch|network/i.test(String(error.message || "")))) {
    showSyncStatus("You're offline. Changes are saved on this device and will sync when you're back online.", "warn");
  } else {
    showSyncStatus("Couldn't sync just now. Your changes are saved on this device and will sync later.", "warn");
  }
}

/* Load the account's latest data (on login, when coming back to the app, after going online) */
async function pullFromAccount() {
  if (!authClient || !currentUser || syncBusy) return;
  syncBusy = true;
  try {
    const { data: row, error } = await authClient.from(SYNC_TABLE)
      .select("items, shopping, profile, prefs, updated_at, device_id").eq("user_id", currentUser.id).maybeSingle();
    if (error) throw error;
    const state = syncState();

    if (!row) {
      // The account has nothing yet: this device's data becomes the account's data
      await uploadToAccount();
    } else if (!state.linked) {
      // First time this device links up: combine, so food from every device is kept
      const remoteItems = (cleanList(Array.isArray(row.items) ? row.items : [], cleanFoodItem) || { value: [] }).value;
      const remoteShopping = (cleanList(Array.isArray(row.shopping) ? row.shopping : [], cleanShoppingEntry) || { value: [] }).value;
      const merged = {
        ...row,
        items: combine(items, remoteItems, (a, b) => a.id === b.id),
        shopping: combine(shoppingList, remoteShopping, (a, b) => simplify(a.name) === simplify(b.name)),
      };
      applySnapshot(merged);
      await uploadToAccount();
    } else if (hasUnsentChanges()) {
      // This device has changes that weren't sent yet (e.g. made offline): send them
      await uploadToAccount();
    } else if (row.updated_at !== state.lastSynced) {
      // Another device changed something: show it here
      applySnapshot(row);
      setSyncState({ lastSynced: row.updated_at });
    }
    showSyncStatus("All changes saved to your account ✓", "ok");
  } catch (error) {
    reportSyncProblem(error);
  } finally {
    syncBusy = false;
  }
}

/* Live updates: hear about changes made on other devices while this one is open */
function listenForChanges() {
  stopListening();
  if (!authClient || !currentUser) return;
  syncChannel = authClient.channel("ripeline-sync-" + currentUser.id)
    .on("postgres_changes", { event: "*", schema: "public", table: SYNC_TABLE, filter: `user_id=eq.${currentUser.id}` }, (change) => {
      const row = change.new;
      if (!row || row.device_id === DEVICE_ID || hasUnsentChanges()) return;   // our own save, or we have newer local changes
      if (row.updated_at === syncState().lastSynced) return;
      applySnapshot(row);
      setSyncState({ lastSynced: row.updated_at });
      showSyncStatus("Updated from your other device ✓", "ok");
    })
    .subscribe();
}

function stopListening() {
  if (syncChannel && authClient) authClient.removeChannel(syncChannel);
  syncChannel = null;
}

/* Called by js/account.js after logging in, and before logging out */
async function startAccountSync() {
  syncCancelled = false;
  syncStarted = false;
  showSyncStatus("Syncing…");
  try {
    await pullFromAccount();
  } finally {
    syncStarted = true;
  }
  listenForChanges();
}

async function stopAccountSync() {
  clearTimeout(syncTimer);
  syncStarted = false;
  if (currentUser && hasUnsentChanges()) {
    try { await uploadToAccount(); } catch (error) { /* stays marked as unsent on this device */ }
  }
  stopListening();
}

/* Before deleting data: stop all syncing, and make any sync still finishing do nothing */
function cancelAccountSync() {
  syncCancelled = true;
  syncStarted = false;
  clearTimeout(syncTimer);
  stopListening();
}

/* Used by "Delete all my data": remove the account's stored data too */
async function deleteAccountCloudData() {
  cancelAccountSync();
  if (!authClient || !currentUser) return true;
  const { error } = await authClient.from(SYNC_TABLE).delete().eq("user_id", currentUser.id);
  return !error || syncNotSetUp(error);
}

/* Coming back to the app or getting back online: catch up */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && appUnlocked) pullFromAccount();
});
window.addEventListener("online", () => { if (appUnlocked) pullFromAccount(); });
