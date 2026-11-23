/*
  Ripeline storage
  ----------------
  This file is the ONLY place that saves and loads your data.

  WHERE YOUR DATA LIVES
  Everything is kept in this browser's "localStorage": a small private storage
  area that belongs to this website, in this browser, on this device.
    - Each browser and device has its own separate Ripeline data.
    - Nothing is sent to a server, and nobody else can see it.
    - It stays after refreshing or closing the browser, until you delete it
      (Profile → Privacy Settings → Delete all my data, or by clearing site data).

  EACH ACCOUNT HAS ITS OWN DATA
  You need an account to use Ripeline. The account's data lives in Supabase and
  is synced to every device (js/sync.js). This file keeps the device's copy, so
  the app works offline. Each account's copy is saved separately on the device
  (the key name ends with the account's id), so two people who share a laptop
  never see each other's fridge. The very first account to log in on a device
  takes over any data saved there before accounts existed.

  WHAT IS SAVED (each under its own name, called a "key")
    fridgeiq.items.v1     your food: names, categories, storage, quantities, expiration dates
    fridgeiq.shopping.v1  your shopping list
    fridgeiq.profile.v1   your name, email and colour theme
    fridgeiq.prefs.v1     small preferences (sort order, filters)

  SAFETY RULES
    - Saved data that can't be read is never thrown away: a backup copy is kept
      under the same name plus ".backup" before anything new is written.
    - If saving fails (storage blocked or full), the app keeps working, shows a
      message, and your previously saved data is left untouched.
*/

/* Note: these names still start with "fridgeiq." (the app's original name). They are never
   shown to anyone, and renaming them would make everyone's saved data disappear, so they stay. */
const STORAGE_KEYS = {
  items:    "fridgeiq.items.v1",
  shopping: "fridgeiq.shopping.v1",
  profile:  "fridgeiq.profile.v1",
  prefs:    "fridgeiq.prefs.v1",
};

/* Device-wide settings that are needed before anyone logs in (last account email, colour theme) */
const DEVICE_KEY = "fridgeiq.device.v1";

/* Data left behind by older versions of Ripeline (AI recipes and an API key) */
const RETIRED_KEYS = ["fridgeiq.claudeKey.v1", "fridgeiq.recipes.v1", "fridgeiq.steps.v1"];

const FridgeStorage = (() => {
  let available = false;
  let accountId = "";            // whose data we're reading/writing ("" = nobody logged in)
  let saveProblem = null;        // null, "blocked" or "full"
  const readProblems = [];       // names of data that couldn't be read and were backed up
  const statusListeners = [];

  // Can this browser save at all? (Private browsing or blocked site data can stop it.)
  try {
    const test = "fridgeiq.storage-test";
    window.localStorage.setItem(test, "1");
    window.localStorage.removeItem(test);
    available = true;
    RETIRED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    available = false;
    saveProblem = "blocked";
  }

  function notify() {
    statusListeners.forEach((listener) => listener(status()));
  }

  function status() {
    return { available, saveProblem, readProblems: readProblems.slice() };
  }

  /* Keeps a copy of data we couldn't read, so it is never silently lost */
  function backUp(key, raw) {   // key is already the account's own key here
    try {
      window.localStorage.setItem(key + ".backup", raw);
    } catch (error) {
      /* storage is full: leave the original untouched instead */
    }
  }

  /*
    Loads one piece of data.
      key       – which data (one of STORAGE_KEYS)
      label     – a friendly name for messages, e.g. "food list"
      clean     – a function that checks the data and returns { value, dropped }
      fallback  – what to use when nothing has been saved yet
  */
  /* The real storage name for this account, e.g. "fridgeiq.items.v1.<account id>" */
  function scoped(key) {
    return accountId ? `${key}.${accountId}` : null;
  }

  /* Switch to an account's data. The first account on a device inherits data saved before accounts. */
  function useAccount(id) {
    accountId = String(id || "").replace(/[^a-zA-Z0-9-]/g, "");
    readProblems.length = 0;
    if (!available || !accountId) return;
    try {
      const claimed = window.localStorage.getItem("fridgeiq.legacy-owner.v1");
      if (!claimed) {
        Object.values(STORAGE_KEYS).forEach((key) => {
          const old = window.localStorage.getItem(key);
          if (old !== null && window.localStorage.getItem(`${key}.${accountId}`) === null) {
            window.localStorage.setItem(`${key}.${accountId}`, old);
          }
          if (old !== null) window.localStorage.removeItem(key);
        });
        window.localStorage.setItem("fridgeiq.legacy-owner.v1", accountId);
      }
    } catch (error) {
      /* storage full or blocked: the account simply starts with what it has */
    }
  }

  function stopUsingAccount() {
    accountId = "";
  }

  function load(key, label, clean, fallback) {
    const realKey = scoped(key);
    if (!available || !realKey) return fallback;
    key = realKey;
    let raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch (error) {
      return fallback;
    }
    if (raw === null) return fallback;          // first visit: nothing saved yet

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      backUp(key, raw);                          // damaged: keep a copy, start fresh
      readProblems.push(label);
      return fallback;
    }

    const result = clean(parsed);
    if (result === null) {                       // wrong shape: keep a copy, start fresh
      backUp(key, raw);
      readProblems.push(label);
      return fallback;
    }
    if (result.dropped > 0) {                    // some entries were unusable: keep a copy
      backUp(key, raw);
      readProblems.push(label);
    }
    return result.value;
  }

  /* Saves one piece of data. Returns true if it worked. */
  function save(key, value) {
    if (!scoped(key)) return false;           // nobody logged in: nothing to save
    key = scoped(key);
    if (!available) {
      saveProblem = "blocked";
      notify();
      return false;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      if (saveProblem) { saveProblem = null; notify(); }
      return true;
    } catch (error) {
      saveProblem = "full";                      // almost always "storage is full"
      notify();
      return false;
    }
  }

  /* Removes the logged-in account's data (food, shopping list, profile, preferences, backups)
     from this device. Other accounts' data on the same device is left alone. */
  function deleteAccountData() {
    if (!accountId) return true;
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("fridgeiq.") && (key.endsWith(`.${accountId}`) || key.endsWith(`.${accountId}.backup`)))
        .forEach((key) => window.localStorage.removeItem(key));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* Small device-wide settings (not tied to an account) */
  function loadDevice() {
    try { return JSON.parse(window.localStorage.getItem(DEVICE_KEY)) || {}; } catch (error) { return {}; }
  }
  function saveDevice(value) {
    try { window.localStorage.setItem(DEVICE_KEY, JSON.stringify(value)); } catch (error) { /* not important */ }
  }

  function dismissReadProblems() {
    readProblems.length = 0;
    notify();
  }

  /* Runs `callback` when Ripeline data is changed in ANOTHER tab of this same browser */
  function onOtherTabChange(callback) {
    window.addEventListener("storage", (event) => {
      if (event.key === null || String(event.key).startsWith("fridgeiq.")) callback(event.key);
    });
  }

  return {
    load, save, deleteAccountData, status, dismissReadProblems, onOtherTabChange,
    useAccount, stopUsingAccount, loadDevice, saveDevice,
    currentAccount: () => accountId,
    onStatusChange: (listener) => statusListeners.push(listener),
  };
})();

/* =========================================================
   CHECKING SAVED DATA
   These make sure each saved entry has everything the app needs.
   Small problems are fixed; entries with no name are left out (and backed up).
   ========================================================= */
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function cleanList(parsed, cleanEntry) {
  if (!Array.isArray(parsed)) return null;
  const value = parsed.map(cleanEntry).filter(Boolean);
  return { value, dropped: parsed.length - value.length };
}

function cleanFoodItem(entry, index) {
  if (!entry || typeof entry !== "object") return null;
  const name = cleanText(entry.name, 60);
  if (!name) return null;
  const quantity = Number(entry.quantity);
  return {
    id: cleanText(entry.id, 80) || `item-restored-${index}-${Date.now().toString(36)}`,
    name,
    category: cleanText(entry.category, 40) || "Other",
    storage: cleanText(entry.storage, 20) || "Fridge",
    quantity: entry.quantity !== null && entry.quantity !== "" && quantity > 0 ? quantity : null,
    unit: cleanText(entry.unit, 20),
    expires: cleanDate(entry.expires),
    added: Number.isFinite(entry.added) ? entry.added : Date.now(),
  };
}

function cleanShoppingEntry(entry, index) {
  if (!entry || typeof entry !== "object") return null;
  const name = cleanText(entry.name, 60);
  if (!name) return null;
  return {
    id: cleanText(entry.id, 80) || `shop-restored-${index}-${Date.now().toString(36)}`,
    name,
    amount: cleanText(entry.amount, 60),
    recipe: cleanText(entry.recipe, 100),
  };
}

function cleanObject(parsed) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { value: parsed, dropped: 0 } : null;
}
