/*
  Ripeline behaviour
  ------------------
  This file controls what happens when you TAP things, and builds the parts
  of each screen that change (lists, counts, tags).

  Everything runs inside the browser, with no paid APIs. You need a free account
  to use Ripeline (sign up, log in and the welcome email are in js/account.js).
  Each account's food, shopping list and preferences are saved in the account
  (js/sync.js), so they're the same on every device, with a copy on this device
  so the app also works offline.

  It is split into numbered parts:
    1. Saving & loading
    2. Date helpers ("Expires in 2 days")
    3. Small helpers (pictures, pop-up messages)
    4. Recipe matching (which recipes fit the food you have)
    5. Screen switching + the profile button on every screen
    6. Profile screen
    7. Home screen
    8. My Fridge screen
    9. Add / Edit Food screen
   10. Recipe Finder
   11. Recipe Details
   12. Shopping List
*/

/* =========================================================
   1. SAVING & LOADING
   All saving goes through js/storage.js. Your data stays in this browser only.
   ========================================================= */
const DEFAULT_PROFILE = { name: "", email: "", theme: "green" };
const DEFAULT_PREFS = { fridgeSort: "expiration", fridgeCategory: "All", recipeFilter: "all", browseCategory: "Popular" };

let items, shoppingList, profile, prefs;

/* Ripeline stays locked (only the Sign Up / Log In screen) until someone logs in. js/account.js unlocks it. */
let appUnlocked = false;

/* Reads the logged-in account's data from this browser's storage
   (after logging in, and when another tab changes it). Nobody logged in = empty. */
function loadAllData() {
  items = FridgeStorage.load(STORAGE_KEYS.items, "food list", (d) => cleanList(d, cleanFoodItem), []);
  shoppingList = FridgeStorage.load(STORAGE_KEYS.shopping, "shopping list", (d) => cleanList(d, cleanShoppingEntry), []);
  profile = { ...DEFAULT_PROFILE, ...FridgeStorage.load(STORAGE_KEYS.profile, "profile", cleanObject, {}) };
  prefs = { ...DEFAULT_PREFS, ...FridgeStorage.load(STORAGE_KEYS.prefs, "preferences", cleanObject, {}) };
  profile.name = cleanText(profile.name, 40);
  profile.email = cleanText(profile.email, 80);
}
loadAllData();

/* Every save goes to this device first (works offline), then to the account (js/sync.js) */
function syncSoon() {
  if (typeof markChanged === "function") markChanged();
}
const saveItems = () => {
  const ok = FridgeStorage.save(STORAGE_KEYS.items, items);
  syncSoon();
  if (typeof scheduleReminderSync === "function") scheduleReminderSync();   // keep reminder settings fresh
  return ok;
};
const saveProfile = () => { const ok = FridgeStorage.save(STORAGE_KEYS.profile, profile); syncSoon(); return ok; };
const savePrefs = () => { const ok = FridgeStorage.save(STORAGE_KEYS.prefs, prefs); syncSoon(); return ok; };
const saveShopping = () => { const ok = FridgeStorage.save(STORAGE_KEYS.shopping, shoppingList); updateShoppingBadge(); syncSoon(); return ok; };

/* The yellow banner at the top explains any saving problem until it's fixed */
function showStorageStatus(status) {
  const banner = document.getElementById("storage-warning");
  const messages = [];
  if (status.saveProblem === "blocked") {
    messages.push("This browser is blocking storage (for example, private browsing), so Ripeline can't save. Your changes will be lost when you close it.");
  } else if (status.saveProblem === "full") {
    messages.push("Your last change couldn't be saved because this browser's storage is full. Everything saved before is still safe. Try removing some items, or free up space in your browser settings.");
  }
  if (status.readProblems.length) {
    messages.push(`Some saved data (${listNames(status.readProblems)}) couldn't be fully read. Anything readable was kept, and a backup copy of the original was saved on this device.`);
  }
  banner.hidden = messages.length === 0;
  banner.innerHTML = messages.map((m) => `<span>${esc(m)}</span>`).join("") +
    (status.readProblems.length && !status.saveProblem ? ` <button class="storage-warning__close" type="button" id="storage-dismiss">OK</button>` : "");
}

FridgeStorage.onStatusChange(showStorageStatus);

/* If Ripeline is open in another tab and you change something there, update this tab too
   (so the two tabs never overwrite each other's changes). */
FridgeStorage.onOtherTabChange(() => {
  if (!appUnlocked) return;
  loadAllData();
  applyTheme();
  updateShoppingBadge();
  refreshCurrentScreen();
});

function newId(prefix) {
  return (prefix || "item") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/* =========================================================
   2. DATE HELPERS
   ========================================================= */
function toDateText(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateText(date);
}

/* How many days until a date: 0 = today, 1 = tomorrow, -1 = yesterday, null = no date */
function daysUntil(dateText) {
  if (!dateText) return null;
  const [y, m, d] = String(dateText).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/* Food that expires within this many days "needs your attention" */
const SOON_DAYS = 3;

function needsAttention(item) {
  const days = daysUntil(item.expires);
  return days !== null && days <= SOON_DAYS;
}

/* Expiring soon but still OK to eat (used to prioritise recipes) */
function expiringSoon(item) {
  const days = daysUntil(item.expires);
  return days !== null && days >= 0 && days <= SOON_DAYS;
}

function expiryText(item) {
  const days = daysUntil(item.expires);
  if (days === null) return "No expiration date";
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function statusTag(item) {
  const days = daysUntil(item.expires);
  if (days === null) return { text: "No date", style: "tag--none" };
  if (days < 0) return { text: "Expired", style: "tag--expired" };
  if (days === 0) return { text: "Today", style: "tag--soon" };
  if (days <= SOON_DAYS) return { text: days === 1 ? "1 day left" : `${days} days left`, style: "tag--soon" };
  return { text: "Fresh", style: "tag--fresh" };
}

/* =========================================================
   3. SMALL HELPERS
   ========================================================= */

/* Makes text safe to put inside the page (so a food called "<b>" can't break it) */
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function findCatalogFood(name) {
  const wanted = String(name).trim().toLowerCase();
  return FOOD_CATALOG.find((food) => food.name.toLowerCase() === wanted);
}

const CATEGORY_EMOJI = {
  "Meats": "🥩", "Seafood": "🐟", "Dairy": "🧀", "Fruits": "🍎", "Vegetables": "🥦",
  "Grains & Bread": "🍞", "Drinks": "🧃", "Sauces & Condiments": "🫙", "Leftovers": "🍱", "Other": "🛒",
};

function foodPicture(item, extraClass) {
  const food = findCatalogFood(item.name);
  if (food && food.photo) {
    return `<div class="photo ${extraClass}"><img src="${food.photo}" alt="${esc(item.name)}"></div>`;
  }
  const emoji = (food && food.emoji) || CATEGORY_EMOJI[item.category] || "🛒";
  return `<div class="photo photo--emoji ${extraClass}" role="img" aria-label="${esc(item.name)}">${emoji}</div>`;
}

/* A recipe's picture: its main emoji on a soft glow in the recipe's colour,
   with a few of its ingredients scattered around it */
function recipePicture(recipe, className) {
  const image = recipe.image || {};
  const main = image.emoji || "🍽️";
  const color = /^#[0-9a-f]{6}$/i.test(image.color || "") ? image.color : "#ffe9c7";
  const extras = [];
  recipe.ingredients.forEach((ingredient) => {
    const food = findCatalogFood(ingredient.name);
    if (food && food.emoji !== main && !extras.includes(food.emoji) && extras.length < 3) extras.push(food.emoji);
  });
  const sides = extras.map((emoji, i) => `<span class="recipe-art__side recipe-art__side--${i + 1}" aria-hidden="true">${emoji}</span>`).join("");
  return `<div class="${className} recipe-art" style="--art-color:${color}" role="img" aria-label="${esc(recipe.name)}">
    ${sides}<span class="recipe-art__main" aria-hidden="true">${main}</span>
  </div>`;
}

function totalMinutes(recipe) {
  return (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
}

function listNames(names) {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/* Pop-up message at the bottom. Optionally with a button (e.g. "Undo"). */
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastAction = document.getElementById("toast-action");
let toastTimer;
let toastCallback = null;

function showToast(message, action, actionLabel) {
  toastText.textContent = message;
  toastCallback = action || null;
  toastAction.hidden = !action;
  toastAction.textContent = actionLabel || "Undo";
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), action ? 5000 : 2600);
}

toastAction.addEventListener("click", () => {
  if (toastCallback) toastCallback();
  toastCallback = null;
  toast.classList.remove("is-visible");
});

document.getElementById("storage-warning").addEventListener("click", (event) => {
  if (event.target.id === "storage-dismiss") FridgeStorage.dismissReadProblems();
});

/* =========================================================
   4. RECIPE MATCHING
   Compares each recipe's ingredients with the food in My Fridge.
   ========================================================= */

/* "Tomatoes" -> "tomato", "Eggs" -> "egg", so singular and plural match */
function simplify(name) {
  return String(name).toLowerCase().trim().replace(/\s+/g, " ").replace(/(es|s)$/, "");
}

// Build a quick lookup of which names count as the same ingredient
const ALIAS_LOOKUP = {};
Object.entries(INGREDIENT_ALIASES).forEach(([name, others]) => {
  ALIAS_LOOKUP[simplify(name)] = new Set([simplify(name), ...others.map(simplify)]);
});

function ingredientMatchesFood(ingredientName, foodName) {
  const wanted = simplify(ingredientName);
  const have = simplify(foodName);
  if (!wanted || !have) return false;
  if (wanted === have) return true;
  const aliases = ALIAS_LOOKUP[wanted];
  return Boolean(aliases && aliases.has(have));
}

/* Finds a food in the fridge for this ingredient. Prefers food that isn't expired. */
function findInFridge(ingredientName) {
  const matches = items.filter((item) => ingredientMatchesFood(ingredientName, item.name));
  if (matches.length === 0) return undefined;
  return matches.find((item) => { const d = daysUntil(item.expires); return d === null || d >= 0; }) || matches[0];
}

/*
  Works out how well a recipe fits your fridge:
    have / missing     – required ingredients you have / don't have
    usesExpiring       – your foods it uses that expire within 3 days
    score              – used to sort recipes (higher = better fit)
    reason             – a short sentence explaining the recommendation
*/
function matchRecipe(recipe) {
  const required = recipe.ingredients.filter((i) => !i.optional);
  const have = [];
  const missing = [];
  const usesExpiring = [];

  required.forEach((ingredient) => {
    const food = findInFridge(ingredient.name);
    if (food) {
      have.push(ingredient);
      if (expiringSoon(food) && !usesExpiring.includes(food.name)) usesExpiring.push(food.name);
    } else {
      missing.push(ingredient);
    }
  });

  // Optional extras still count towards "use it before you lose it"
  recipe.ingredients.filter((i) => i.optional).forEach((ingredient) => {
    const food = findInFridge(ingredient.name);
    if (food && expiringSoon(food) && !usesExpiring.includes(food.name)) usesExpiring.push(food.name);
  });

  const total = required.length || 1;
  const score = (have.length / total) * 100
    + usesExpiring.length * 30
    + (missing.length === 0 ? 25 : 0)
    - missing.length * 4;

  let reason;
  const missingNames = missing.map((i) => i.name);
  if (usesExpiring.length) {
    reason = `Uses your ${listNames(usesExpiring)} before ${usesExpiring.length === 1 ? "it expires" : "they expire"}`;
    if (missing.length === 0) reason += ", and you have everything";
    else if (missing.length <= 2) reason += `. Just get ${listNames(missingNames)}`;
  } else if (missing.length === 0) {
    reason = "You have everything you need to make this";
  } else if (have.length === 0) {
    reason = "You'd need to shop for this one";
  } else if (missing.length <= 2) {
    reason = `Almost there: you only need ${listNames(missingNames)}`;
  } else {
    reason = `You have ${have.length} of ${required.length} ingredients`;
  }

  return { recipe, have, missing, usesExpiring, score, reason, total: required.length };
}

/* All recipes, best match first */
function rankedRecipes() {
  return RECIPE_DATABASE.map(matchRecipe).sort((a, b) =>
    b.score - a.score || totalMinutes(a.recipe) - totalMinutes(b.recipe) || a.recipe.name.localeCompare(b.recipe.name));
}

function matchSummary(match) {
  return match.missing.length === 0
    ? `✓ All ${match.total} ingredients`
    : `✓ ${match.have.length} have · ${match.missing.length} missing`;
}

/* =========================================================
   5. SCREEN SWITCHING
   The web address decides the screen:
     #profile              Profile (the start screen)
     #home                 Home
     #fridge/ITEM-ID       My Fridge, with one food highlighted
     #add-food             Add Food
     #edit-food/ITEM-ID    Edit a food you already added
     #recipes/broccoli     Recipe Finder, searching for broccoli
     #recipe/RECIPE-ID     Recipe Details
     #shopping             Shopping List
   ========================================================= */
const START_SCREEN = "profile";
const SCREEN_ALIASES = { "edit-food": "add-food" };

// Put the profile button in the top-right corner of every screen
const PROFILE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>`;
document.querySelectorAll(".screen").forEach((screen) => {
  screen.insertAdjacentHTML("afterbegin",
    `<a class="profile-button" href="#profile" aria-label="My Profile">${PROFILE_ICON}</a>`);
});

function readAddress() {
  const [name, ...rest] = location.hash.replace("#", "").split("/");
  return { name: name || START_SCREEN, detail: decodeURIComponent(rest.join("/")) };
}

function showScreen() {
  let { name, detail } = readAddress();
  // Locked: only the account screen (sign up / log in) can be shown.
  // (The address isn't changed here: a link from a welcome email carries a code in it
  //  that the account service still needs to read.)
  if (!appUnlocked && name !== "account") {
    name = "account"; detail = "";
  }
  const screen = document.getElementById(SCREEN_ALIASES[name] || name) || document.getElementById(START_SCREEN);

  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s === screen));

  const tab = screen.dataset.tab;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle("is-active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  document.querySelectorAll(".profile-button").forEach((b) => b.classList.toggle("is-active", screen.id === "profile"));

  // Start each screen at the top. (Browsers also try to jump to the element named in the
  // address, e.g. #fridge, which would hide the top of the page; this undoes that.)
  pendingScrollTarget = null;
  scrollToTarget();
  requestAnimationFrame(scrollToTarget);

  if (screen.id === "profile") renderProfile();
  if (screen.id === "home") renderHome();
  if (screen.id === "fridge") renderFridge(detail);
  if (screen.id === "add-food") prepareFoodForm(name === "edit-food" ? detail : null);
  if (screen.id === "recipes") openRecipeFinder(detail);
  if (screen.id === "recipe") renderRecipe(detail);
  if (screen.id === "shopping") renderShopping();
  if (screen.id === "account" && typeof renderAccountScreen === "function") renderAccountScreen(detail);
}

let pendingScrollTarget = null;   // an element to scroll to instead of the top (e.g. a new food)
function scrollToTarget() {
  if (pendingScrollTarget && document.body.contains(pendingScrollTarget)) pendingScrollTarget.scrollIntoView({ block: "center" });
  else window.scrollTo(0, 0);
}

/* Rebuilds whatever screen is showing, keeping your place on the page */
function refreshCurrentScreen() {
  const { name, detail } = readAddress();
  const id = SCREEN_ALIASES[name] || name;
  if (id === "profile") renderProfile();
  if (id === "home") renderHome();
  if (id === "fridge") renderFridge();
  if (id === "recipes") renderRecipes();
  if (id === "recipe" && RECIPE_DATABASE.some((r) => r.id === detail)) renderRecipe(detail);
  if (id === "shopping") renderShopping();
  if (id === "add-food" && name === "edit-food" && !items.some((i) => i.id === detail)) {
    showToast("This food was deleted in another tab");
    location.replace("#fridge");
  }
}

window.addEventListener("hashchange", showScreen);
window.addEventListener("load", scrollToTarget);

/* =========================================================
   6. PROFILE SCREEN
   ========================================================= */
const THEME_COLORS = { green: "#c1fbb0", peach: "#ffe4d2", lavender: "#ebe3ff", ocean: "#d6ecff" };

function applyTheme() {
  // Before logging in, use the colour scheme last used on this device
  const chosen = appUnlocked ? profile.theme : (FridgeStorage.loadDevice().theme || profile.theme);
  const theme = THEME_COLORS[chosen] ? chosen : "green";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", THEME_COLORS[theme]);
}

function firstName() {
  return String(profile.name || "").trim().split(/\s+/)[0] || "";
}

function renderProfile() {
  const name = String(profile.name || "").trim();
  document.getElementById("profile-name").textContent = name || "Your Name";
  document.getElementById("profile-email").textContent = String(profile.email || "").trim() || "Tap Edit Profile to add your details";
  document.getElementById("profile-avatar").textContent =
    name ? name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() : "?";

  if (typeof renderAccountRow === "function") renderAccountRow();
  if (typeof renderReminders === "function") renderReminders();

  document.querySelectorAll("[data-theme-choice]").forEach((tile) => {
    const selected = tile.dataset.themeChoice === profile.theme;
    tile.classList.toggle("is-selected", selected);
    tile.setAttribute("aria-pressed", selected);
  });
}

const profileForm = document.getElementById("profile-form");
document.getElementById("profile-edit").addEventListener("click", () => {
  document.getElementById("profile-name-input").value = profile.name;
  document.getElementById("profile-email-input").value = profile.email;
  profileForm.hidden = !profileForm.hidden;
  if (!profileForm.hidden) document.getElementById("profile-name-input").focus();
});
document.getElementById("profile-cancel").addEventListener("click", () => { profileForm.hidden = true; });
profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailInput = document.getElementById("profile-email-input");
  if (emailInput.value && !emailInput.checkValidity()) {
    showToast("That email address doesn't look right");
    emailInput.focus();
    return;
  }
  profile.name = document.getElementById("profile-name-input").value.trim();
  // With an account, the email comes from the account; the name is saved to the account too
  if (typeof currentUser !== "undefined" && currentUser) {
    authClient.auth.updateUser({ data: { name: profile.name } }).catch(() => {});
  } else {
    profile.email = emailInput.value.trim();
  }
  saveProfile();
  profileForm.hidden = true;
  renderProfile();
  showToast(profile.name ? `Hi ${firstName()}! Profile saved` : "Profile saved");
});

document.getElementById("theme-grid").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-theme-choice]");
  if (!tile) return;
  profile.theme = tile.dataset.themeChoice;
  saveProfile();
  FridgeStorage.saveDevice({ ...FridgeStorage.loadDevice(), theme: profile.theme });
  applyTheme();
  renderProfile();
});

document.getElementById("privacy-toggle").addEventListener("click", (event) => {
  const panel = document.getElementById("privacy-panel");
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  event.currentTarget.classList.toggle("is-open", !panel.hidden);
});
document.getElementById("delete-data").addEventListener("click", async () => {
  if (!confirm("Delete all your Ripeline data? This removes your food, shopping list, profile and preferences from your account (on every device) and from this device, and logs you out. It can't be undone. (Your account itself stays; delete it from the account screen.)")) return;
  if (typeof stopReminders === "function") await stopReminders();   // also turns off reminder emails
  if (typeof deleteAccountCloudData === "function" && !(await deleteAccountCloudData())) {
    showToast("Couldn't delete your data from your account. Check your internet connection and try again.");
    return;
  }
  if (!FridgeStorage.deleteAccountData()) {
    showToast("Couldn't delete the data. Try clearing this site's data in your browser settings.");
    return;
  }
  if (typeof signOutOfAccount === "function") await signOutOfAccount();
  showToast("Your data was deleted");
});

/* Re-apply saved preferences to the screens (after a different account's data is loaded) */
function applyPrefsToViews() {
  fridgeView.category = prefs.fridgeCategory;
  fridgeView.sort = prefs.fridgeSort;
  fridgeView.search = "";
  recipeView.filter = prefs.recipeFilter;
  recipeView.showing = RECIPES_PER_PAGE;
  browseCategory = prefs.browseCategory;
}

/* Log out of your account. Your name, email, food and shopping list stay on this device,
   so logging back in is quick. (To erase everything, use Privacy Settings → Delete all my data.) */
document.getElementById("log-out").addEventListener("click", async () => {
  if (typeof signOutOfAccount === "function") await signOutOfAccount();
  saveProfile();
  profileForm.hidden = true;
  renderProfile();
  showToast("You're logged out");
});

/* =========================================================
   7. HOME SCREEN
   ========================================================= */
function renderHome() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  document.getElementById("greeting").textContent = `Good ${timeOfDay}${firstName() ? " " + firstName() : ""}!`;

  const attention = items.filter(needsAttention);
  document.getElementById("home-count").textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  document.getElementById("home-attention").textContent =
    items.length === 0 ? "Tap here to add your first food"
    : attention.length === 0 ? "Everything looks fresh"
    : `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} your attention`;

  const list = document.getElementById("expiring-list");
  const soonest = attention.sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires));

  if (soonest.length === 0) {
    list.innerHTML = `<div class="empty-card">${items.length ? `Nothing is expiring in the next ${SOON_DAYS} days 🎉` : "Add food to see what's expiring soon."}</div>`;
  } else {
    const shown = soonest.slice(0, 3);
    list.innerHTML = shown.map((item) => {
      const expired = daysUntil(item.expires) < 0;
      return `
        <div class="expiring-card">
          <a href="#fridge/${encodeURIComponent(item.id)}" class="expiring-card__photo-link" aria-label="See ${esc(item.name)} in My Fridge">
            ${foodPicture(item, "expiring-card__photo")}
          </a>
          <div class="expiring-card__text">
            <a class="expiring-card__name" href="#fridge/${encodeURIComponent(item.id)}">${esc(item.name)}</a>
            <p class="expiring-card__when ${expired ? "is-expired" : ""}">${expiryText(item)}</p>
            <a class="expiring-card__link" href="#recipes/${encodeURIComponent(item.name)}">
              Add to a recipe <img src="images/arrow-right.svg" alt="" class="arrow">
            </a>
            <button class="expiring-card__used" type="button" data-used="${esc(item.id)}">✓ Used it</button>
          </div>
        </div>`;
    }).join("");
    if (soonest.length > shown.length) {
      list.insertAdjacentHTML("beforeend",
        `<a class="more-link" href="#fridge">+ ${soonest.length - shown.length} more in My Fridge</a>`);
    }
  }

  // Best recipe for you right now
  const best = rankedRecipes()[0];
  const top = document.getElementById("home-top-recipe");
  if (!best || best.have.length === 0) {
    top.innerHTML = `<a class="empty-card empty-card--link" href="#recipes">Add some food to get recipe ideas. <strong>Browse recipes →</strong></a>`;
  } else {
    top.innerHTML = `
      <a class="pick-card" href="#recipe/${encodeURIComponent(best.recipe.id)}">
        ${recipePicture(best.recipe, "pick-card__picture")}
        <span class="pick-card__text">
          <span class="pick-card__name">${esc(best.recipe.name)}</span>
          <span class="pick-card__reason">${esc(best.reason)}</span>
          <span class="pick-card__meta">${matchSummary(best)} · ${totalMinutes(best.recipe)} min</span>
        </span>
      </a>`;
  }

  const count = shoppingList.length;
  document.getElementById("home-shopping-link").innerHTML = count
    ? `🛒 <strong>${count} ${count === 1 ? "item" : "items"}</strong> on your shopping list <span aria-hidden="true">→</span>`
    : `🛒 Your shopping list is empty <span aria-hidden="true">→</span>`;
}

document.getElementById("expiring-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-used]");
  if (button) removeItem(button.dataset.used, renderHome);
});

function removeItem(id, refresh) {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [removed] = items.splice(index, 1);
  saveItems();
  refresh();
  showToast(`Removed ${removed.name}`, () => {
    items.splice(Math.min(index, items.length), 0, removed);
    saveItems();
    refresh();
  });
}

/* Adds a food to the fridge using the catalog's usual category, storage and shelf life */
function addFoodByName(name) {
  const food = findCatalogFood(name);
  const item = {
    id: newId(),
    name: food ? food.name : name,
    category: food ? food.category : "Other",
    storage: food ? food.storage : "Fridge",
    quantity: null,
    unit: "",
    expires: food ? dateFromToday(food.days) : null,
    added: Date.now(),
  };
  items.push(item);
  saveItems();
  return item;
}

/* =========================================================
   8. MY FRIDGE SCREEN
   ========================================================= */
const fridgeView = { category: prefs.fridgeCategory, search: "", sort: prefs.fridgeSort };
const SORTS = [
  { key: "expiration", label: "Expiration" },
  { key: "name",       label: "Name" },
  { key: "added",      label: "Newest" },
];

function renderFridge(highlightId) {
  renderFridgeChips();
  renderFridgeList(highlightId);
}

function renderFridgeChips() {
  const used = CATEGORIES.filter((c) => items.some((item) => item.category === c));
  if (fridgeView.category !== "All" && !used.includes(fridgeView.category)) fridgeView.category = "All";
  if (!SORTS.some((s) => s.key === fridgeView.sort)) fridgeView.sort = "expiration";
  document.getElementById("fridge-chips").innerHTML = ["All", ...used].map((c) =>
    `<button class="chip ${c === fridgeView.category ? "is-selected" : ""}" type="button" data-category="${esc(c)}">${esc(c)}</button>`
  ).join("");
}

function renderFridgeList(highlightId) {
  const search = fridgeView.search.trim().toLowerCase();
  const shown = items.filter((item) =>
    (fridgeView.category === "All" || item.category === fridgeView.category) &&
    (!search || item.name.toLowerCase().includes(search))
  );

  if (fridgeView.sort === "expiration") {
    const order = (item) => { const d = daysUntil(item.expires); return d === null ? Infinity : d; };
    shown.sort((a, b) => order(a) - order(b));
  } else if (fridgeView.sort === "name") {
    shown.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    shown.sort((a, b) => (b.added || 0) - (a.added || 0));
  }

  document.getElementById("fridge-count").textContent = `Your Items (${items.length})`;
  document.getElementById("fridge-sort-label").textContent = SORTS.find((s) => s.key === fridgeView.sort).label;

  const list = document.getElementById("fridge-list");
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-text">Your fridge is empty.<br>Tap “+ Add Food” below to add your first item.</p>`;
    return;
  }
  if (shown.length === 0) {
    list.innerHTML = `<p class="empty-text">No food matches “${esc(fridgeView.search.trim()) || fridgeView.category}”.</p>`;
    return;
  }

  list.innerHTML = shown.map((item) => {
    const tag = statusTag(item);
    const amount = item.quantity ? `${item.quantity} ${item.unit || ""}`.trim() : "";
    const details = [item.storage, amount].filter(Boolean).join(" · ");
    const editLink = `#edit-food/${encodeURIComponent(item.id)}`;
    return `
      <div class="item ${item.id === highlightId ? "is-highlighted" : ""}" id="item-${esc(item.id)}">
        <a href="${editLink}" class="item__photo-link" aria-label="Edit ${esc(item.name)}">${foodPicture(item, "item__photo")}</a>
        <div class="item__info">
          <a class="item__name" href="${editLink}">${esc(item.name)}</a>
          <p class="item__details">${esc(details)}</p>
          <span class="tag ${tag.style}">${tag.text}</span>
          <a class="item__edit" href="${editLink}">Edit</a>
          <a class="item__recipes" href="#recipes/${encodeURIComponent(item.name)}">Recipes →</a>
        </div>
        <button class="item__remove" type="button" data-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">✓<span>Used</span></button>
      </div>`;
  }).join("");

  if (highlightId) {
    pendingScrollTarget = document.getElementById("item-" + highlightId);
    scrollToTarget();
  }
}

document.getElementById("fridge-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-category]");
  if (!chip) return;
  fridgeView.category = chip.dataset.category;
  prefs.fridgeCategory = fridgeView.category;
  savePrefs();
  renderFridge();
});

document.getElementById("fridge-search").addEventListener("input", (event) => {
  fridgeView.search = event.target.value;
  renderFridgeList();
});

document.getElementById("fridge-sort").addEventListener("click", () => {
  const next = (SORTS.findIndex((s) => s.key === fridgeView.sort) + 1) % SORTS.length;
  fridgeView.sort = SORTS[next].key;
  prefs.fridgeSort = fridgeView.sort;
  savePrefs();
  renderFridgeList();
});

document.getElementById("fridge-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) removeItem(button.dataset.remove, () => renderFridge());
});

/* =========================================================
   9. ADD / EDIT FOOD SCREEN
   The same form is used to add new food and to edit food you already have.
   ========================================================= */
const form = document.getElementById("add-food-form");
const nameInput = document.getElementById("food-name");
const categorySelect = document.getElementById("food-category");
const storageSelect = document.getElementById("food-storage");
const quantityInput = document.getElementById("food-quantity");
const unitSelect = document.getElementById("food-unit");
const expiresInput = document.getElementById("food-expires");
const expiryHint = document.getElementById("expiry-hint");
const suggestions = document.getElementById("food-suggestions");
let browseCategory = prefs.browseCategory;
let editingId = null;   // the food being edited, or null when adding

categorySelect.insertAdjacentHTML("beforeend", CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join(""));
storageSelect.insertAdjacentHTML("beforeend", STORAGE_PLACES.map((s) => `<option>${esc(s)}</option>`).join(""));
unitSelect.innerHTML = UNITS.map((u) => `<option>${esc(u)}</option>`).join("");

function prepareFoodForm(editId) {
  hideSuggestions();
  form.querySelectorAll(".has-error").forEach(clearError);
  const editing = editId ? items.find((item) => item.id === editId) : null;

  if (editId && !editing) {
    showToast("That food isn't in your fridge anymore");
    location.replace("#fridge");
    return;
  }

  // Switching between adding and editing starts with a clean form
  if ((editing ? editing.id : null) !== editingId || editing) resetFoodForm();
  editingId = editing ? editing.id : null;

  document.getElementById("food-form-title").textContent = editing ? "Edit Food" : "Add Food";
  document.getElementById("food-form-subtitle").textContent = editing ? "Update the details below" : "Keep your fridge organized";
  document.getElementById("food-submit").textContent = editing ? "Save Changes" : "+ Add to My Fridge";
  document.getElementById("food-delete").hidden = !editing;
  document.getElementById("browse-card").hidden = Boolean(editing);

  if (editing) {
    nameInput.value = editing.name;
    categorySelect.value = CATEGORIES.includes(editing.category) ? editing.category : "Other";
    storageSelect.value = STORAGE_PLACES.includes(editing.storage) ? editing.storage : "Fridge";
    quantityInput.value = editing.quantity ?? "";
    unitSelect.value = UNITS.includes(editing.unit) ? editing.unit : UNITS[0];
    expiresInput.value = editing.expires || "";
  } else {
    renderBrowse();
  }
}

function resetFoodForm() {
  form.reset();
  categorySelect.value = "";
  storageSelect.value = "";
  expiryHint.textContent = "";
}

const POPULAR = ["Milk", "Eggs", "Chicken breast", "Bread", "Cheese", "Yogurt", "Apples", "Bananas",
                 "Broccoli", "Carrots", "Spinach", "Ground beef", "Rice", "Pasta", "Tomatoes", "Tortillas"];

function renderBrowse() {
  document.getElementById("browse-chips").innerHTML = ["Popular", ...CATEGORIES].map((c) =>
    `<button class="chip ${c === browseCategory ? "is-selected" : ""}" type="button" data-browse="${esc(c)}">${esc(c)}</button>`
  ).join("");

  if (browseCategory !== "Popular" && !CATEGORIES.includes(browseCategory)) browseCategory = "Popular";
  const foods = browseCategory === "Popular"
    ? POPULAR.map(findCatalogFood).filter(Boolean)
    : FOOD_CATALOG.filter((food) => food.category === browseCategory);

  document.getElementById("browse-grid").innerHTML = foods.map((food) =>
    `<button class="food-tile" type="button" data-food="${esc(food.name)}">
       <span class="food-tile__emoji">${food.emoji}</span>
       <span class="food-tile__name">${esc(food.name)}</span>
     </button>`
  ).join("");
}

document.getElementById("browse-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-browse]");
  if (!chip) return;
  browseCategory = chip.dataset.browse;
  prefs.browseCategory = browseCategory;
  savePrefs();
  renderBrowse();
});

document.getElementById("browse-grid").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-food]");
  if (!tile) return;
  chooseFood(findCatalogFood(tile.dataset.food));
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

function chooseFood(food) {
  if (!food) return;
  nameInput.value = food.name;
  categorySelect.value = food.category;
  storageSelect.value = food.storage;
  expiresInput.value = dateFromToday(food.days);
  updateExpiryHint();
  hideSuggestions();
  [nameInput, categorySelect, storageSelect, expiresInput].forEach(clearError);
}

function updateExpiryHint() {
  const food = findCatalogFood(nameInput.value);
  if (!editingId && food && storageSelect.value === food.storage) {
    expiryHint.textContent = `Suggested: usually good for about ${readableDays(food.days)} in the ${food.storage.toLowerCase()}. Change it if your package says otherwise.`;
  } else {
    expiryHint.textContent = "";
  }
}

function readableDays(days) {
  if (days >= 365) return `${Math.round(days / 365)} year${days >= 730 ? "s" : ""}`;
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return days === 1 ? "1 day" : `${days} days`;
}

function showSuggestions() {
  const typed = nameInput.value.trim().toLowerCase();
  if (!typed) { hideSuggestions(); return; }

  const matches = FOOD_CATALOG
    .filter((food) => food.name.toLowerCase().includes(typed))
    .sort((a, b) => a.name.toLowerCase().indexOf(typed) - b.name.toLowerCase().indexOf(typed))
    .slice(0, 6);

  if (matches.length === 0 || (matches.length === 1 && matches[0].name.toLowerCase() === typed)) {
    hideSuggestions();
    return;
  }
  suggestions.innerHTML = matches.map((food) =>
    `<li><button type="button" data-food="${esc(food.name)}"><span>${food.emoji}</span>${esc(food.name)}<small>${esc(food.category)}</small></button></li>`
  ).join("");
  suggestions.hidden = false;
}

function hideSuggestions() {
  suggestions.hidden = true;
}

nameInput.addEventListener("input", () => {
  clearError(nameInput);
  showSuggestions();
  const exact = findCatalogFood(nameInput.value);
  if (exact && !editingId) {
    if (!categorySelect.value) categorySelect.value = exact.category;
    if (!storageSelect.value) storageSelect.value = exact.storage;
    if (!expiresInput.value) expiresInput.value = dateFromToday(exact.days);
  }
  updateExpiryHint();
});
nameInput.addEventListener("focus", showSuggestions);
nameInput.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

suggestions.addEventListener("mousedown", (event) => {
  const option = event.target.closest("[data-food]");
  if (!option) return;
  event.preventDefault();
  chooseFood(findCatalogFood(option.dataset.food));
});

storageSelect.addEventListener("change", () => {
  const food = findCatalogFood(nameInput.value);
  if (food && !editingId) {
    let days = food.days;
    if (storageSelect.value !== food.storage) {
      if (storageSelect.value === "Freezer") days = Math.max(food.days, 90);
      else if (storageSelect.value === "Counter") days = Math.max(1, Math.round(food.days / 2));
    }
    expiresInput.value = dateFromToday(days);
  }
  updateExpiryHint();
});

function showError(input, message) {
  clearError(input);
  input.classList.add("has-error");
  input.closest(".field").insertAdjacentHTML("beforeend", `<p class="field__error">${esc(message)}</p>`);
}

function clearError(input) {
  input.classList.remove("has-error");
  const field = input.closest(".field");
  const old = field && field.querySelector(".field__error");
  if (old) old.remove();
}

[categorySelect, storageSelect, expiresInput, quantityInput].forEach((input) => input.addEventListener("change", () => clearError(input)));

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const quantity = quantityInput.value === "" ? null : Number(quantityInput.value);
  const expiresDays = daysUntil(expiresInput.value);
  let ok = true;
  if (!name) { showError(nameInput, "Please enter a food name"); ok = false; }
  if (!categorySelect.value) { showError(categorySelect, "Please choose a category"); ok = false; }
  if (!storageSelect.value) { showError(storageSelect, "Please choose where it's stored"); ok = false; }
  if (quantityInput.value !== "" && !(quantity > 0)) { showError(quantityInput, "Quantity must be more than 0"); ok = false; }
  if (expiresInput.value && expiresDays === null) { showError(expiresInput, "Please enter a valid date"); ok = false; }
  if (!ok) {
    form.querySelector(".has-error").focus();
    return;
  }

  const known = findCatalogFood(name);
  const details = {
    name: known ? known.name : name.charAt(0).toUpperCase() + name.slice(1),
    category: categorySelect.value,
    storage: storageSelect.value,
    quantity,
    unit: quantity ? unitSelect.value : "",
    expires: expiresInput.value || null,
  };

  let item;
  if (editingId) {
    item = items.find((i) => i.id === editingId);
    if (!item) { showToast("That food isn't in your fridge anymore"); location.hash = "#fridge"; return; }
    Object.assign(item, details);
  } else {
    item = { id: newId(), ...details, added: Date.now() };
    items.push(item);
    // If it was on the shopping list, you've bought it: take it off
    shoppingList = shoppingList.filter((e) => !ingredientMatchesFood(e.name, item.name) && simplify(e.name) !== simplify(item.name));
    saveShopping();
  }
  if (saveItems()) showToast(editingId ? `Saved changes to ${item.name}` : `Added ${item.name} to your fridge`);
  else showToast(`${item.name} is in your list for now, but couldn't be saved. See the message at the top.`);

  resetFoodForm();
  editingId = null;
  location.hash = "#fridge/" + encodeURIComponent(item.id);
});

document.getElementById("food-delete").addEventListener("click", () => {
  const item = items.find((i) => i.id === editingId);
  if (!item) return;
  if (!confirm(`Delete ${item.name} from your fridge?`)) return;
  editingId = null;
  resetFoodForm();
  location.hash = "#fridge";
  removeItem(item.id, () => renderFridge());
});

/* =========================================================
   10. RECIPE FINDER
   ========================================================= */
const recipeView = { filter: prefs.recipeFilter, showing: 20 };
const RECIPES_PER_PAGE = 20;
const recipeSearch = document.getElementById("recipe-search");
const FILTER_LABELS = { "all": "All recipes", "can-make": "Can make now", "use-soon": "Use before lose" };

function recipeMatchesSearch(recipe, search) {
  if (!search) return true;
  const wanted = simplify(search);
  if (recipe.name.toLowerCase().includes(search)) return true;
  return recipe.ingredients.some((i) =>
    i.name.toLowerCase().includes(search) || ingredientMatchesFood(i.name, search) || simplify(i.name) === wanted);
}

function passesFilter(match) {
  const filter = recipeView.filter;
  if (filter === "all") return true;
  if (filter === "can-make") return match.missing.length === 0;
  if (filter === "use-soon") return match.usesExpiring.length > 0;
  return match.recipe.categories.includes(filter);
}

function openRecipeFinder(ingredient) {
  if (ingredient) recipeSearch.value = ingredient;
  recipeView.showing = RECIPES_PER_PAGE;
  renderRecipes();
}

function renderRecipes() {
  // Use the saved filter, or "All" if that filter no longer exists
  if (!document.querySelector(`#recipe-chips [data-filter="${CSS.escape(recipeView.filter)}"]`)) recipeView.filter = "all";
  document.querySelectorAll("#recipe-chips .chip").forEach((c) => c.classList.toggle("is-selected", c.dataset.filter === recipeView.filter));
  const searchText = recipeSearch.value.trim();
  const search = searchText.toLowerCase();
  const shown = rankedRecipes().filter((match) => passesFilter(match) && recipeMatchesSearch(match.recipe, search));

  const status = document.getElementById("recipes-status");
  const filterName = FILTER_LABELS[recipeView.filter] || recipeView.filter;
  status.innerHTML = searchText
    ? `${shown.length} ${shown.length === 1 ? "recipe" : "recipes"} with “${esc(searchText)}” <button class="text-button text-button--inline" type="button" data-clear-search>Clear</button>`
    : `${shown.length} ${shown.length === 1 ? "recipe" : "recipes"} · ${esc(filterName)} · best matches for your fridge first`;

  const list = document.getElementById("recipe-list");
  if (shown.length === 0) {
    let message = "No recipes match this filter yet.";
    if (recipeView.filter === "can-make") message = "You can't make any recipe with only what you have yet. Try “All” to see what's close.";
    if (recipeView.filter === "use-soon") message = "None of your food is expiring in the next 3 days, so nothing needs using up. 🎉";
    if (searchText) message = `No recipes use “${esc(searchText)}”. Try another ingredient.`;
    list.innerHTML = `<div class="empty-card">${message}</div>`;
    return;
  }

  const visible = shown.slice(0, recipeView.showing);
  list.innerHTML = visible.map((match) => {
    const recipe = match.recipe;
    const tags = recipe.categories.slice(0, 3).map((t) => `<span class="mini-tag">${esc(t)}</span>`).join("");
    const link = `#recipe/${encodeURIComponent(recipe.id)}`;
    return `
      <a class="recipe-card" href="${link}" aria-label="${esc(recipe.name)}">
        ${recipePicture(recipe, "recipe-card__photo")}
        <span class="recipe-card__footer">
          <span class="recipe-card__name">${esc(recipe.name)}</span>
          <span class="recipe-card__reason ${match.usesExpiring.length ? "is-urgent" : ""}">${esc(match.reason)}</span>
          <span class="recipe-card__have">${matchSummary(match)} · ${totalMinutes(recipe)} min · ${esc(recipe.difficulty)}</span>
          <span class="recipe-card__tags">${tags}</span>
          <span class="recipe-card__button">View Recipe <img src="images/arrow-right.svg" alt="" class="arrow"></span>
        </span>
      </a>`;
  }).join("");

  // Only the best matches are shown at first; "Show more" adds the next batch
  if (shown.length > visible.length) {
    const next = Math.min(RECIPES_PER_PAGE, shown.length - visible.length);
    list.insertAdjacentHTML("beforeend",
      `<button class="green-button show-more" type="button" data-show-more>Show ${next} more recipes (${shown.length - visible.length} left)</button>`);
  }
}

document.getElementById("recipe-list").addEventListener("click", (event) => {
  if (!event.target.closest("[data-show-more]")) return;
  recipeView.showing += RECIPES_PER_PAGE;
  renderRecipes();
});

recipeSearch.addEventListener("input", () => { recipeView.showing = RECIPES_PER_PAGE; renderRecipes(); });

document.getElementById("recipes-status").addEventListener("click", (event) => {
  if (event.target.closest("[data-clear-search]")) {
    recipeSearch.value = "";
    if (location.hash !== "#recipes") history.replaceState(null, "", "#recipes");
    renderRecipes();
  }
});

document.getElementById("recipe-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (!chip) return;
  recipeView.filter = chip.dataset.filter;
  recipeView.showing = RECIPES_PER_PAGE;
  prefs.recipeFilter = recipeView.filter;
  savePrefs();
  renderRecipes();
});

/* =========================================================
   11. RECIPE DETAILS
   ========================================================= */
let currentRecipeId = null;

function renderRecipe(recipeId) {
  const recipe = RECIPE_DATABASE.find((r) => r.id === recipeId);
  if (!recipe) {
    showToast("That recipe couldn't be found");
    location.replace("#recipes");
    return;
  }
  currentRecipeId = recipe.id;
  const match = matchRecipe(recipe);

  document.getElementById("recipe-hero-wrap").innerHTML = recipePicture(recipe, "recipe-hero");
  document.getElementById("recipe-name").textContent = recipe.name;
  const reason = document.getElementById("recipe-reason");
  reason.textContent = match.reason;
  reason.classList.toggle("is-urgent", match.usesExpiring.length > 0);
  document.getElementById("recipe-categories").innerHTML =
    recipe.categories.map((c) => `<span class="mini-tag">${esc(c)}</span>`).join("");

  document.getElementById("recipe-time").textContent = `${totalMinutes(recipe)} min`;
  document.getElementById("recipe-servings").textContent = recipe.servings;
  document.getElementById("recipe-difficulty").textContent = recipe.difficulty;
  document.getElementById("recipe-have-count").textContent = `(${match.have.length} of ${match.total} in your fridge)`;

  document.getElementById("recipe-ingredients").innerHTML = recipe.ingredients.map((ingredient) => {
    const food = findInFridge(ingredient.name);
    let tag = food ? `<span class="tag tag--yes">Have</span>` : `<span class="tag tag--no">Missing</span>`;
    if (!food && ingredient.optional) tag = `<span class="tag tag--none">Optional</span>`;
    if (food && expiringSoon(food)) tag = `<span class="tag tag--soon">Use soon</span>`;
    return `
      <li>
        <span>${esc(ingredient.name)}${ingredient.optional ? " <small>(optional)</small>" : ""}<br>${esc(ingredient.amount)}</span>
        ${tag}
      </li>`;
  }).join("");

  const missing = match.missing.length;
  document.getElementById("add-missing").textContent = missing
    ? `+ Add ${missing} Missing Item${missing === 1 ? "" : "s"} to Shopping List`
    : "✓ You have everything for this recipe";

  document.getElementById("recipe-time-detail").textContent =
    `Prep ${recipe.prepMinutes} min · Cook ${recipe.cookMinutes} min · Serves ${recipe.servings}`;
  document.getElementById("recipe-steps").innerHTML = recipe.steps.map((step) => `<li>${esc(step)}</li>`).join("");
}

document.getElementById("show-steps").addEventListener("click", () => {
  document.getElementById("steps-card").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("add-missing").addEventListener("click", () => {
  const recipe = RECIPE_DATABASE.find((r) => r.id === currentRecipeId);
  if (!recipe) return;
  const missing = matchRecipe(recipe).missing;
  if (missing.length === 0) {
    showToast("You already have everything. Time to cook! 🍳");
    return;
  }
  const added = missing.filter((i) => !shoppingList.some((e) => simplify(e.name) === simplify(i.name)));
  added.forEach((i) => shoppingList.push({ id: newId("shop"), name: i.name, amount: i.amount, recipe: recipe.name }));
  saveShopping();
  showToast(
    added.length ? `Added ${listNames(added.map((i) => i.name))} to your shopping list` : "Those are already on your shopping list",
    () => { location.hash = "#shopping"; },
    "View list"
  );
});

/* =========================================================
   12. SHOPPING LIST
   ========================================================= */
const shoppingInput = document.getElementById("shopping-add-input");
const shoppingError = document.getElementById("shopping-add-error");

document.getElementById("shopping-suggestions").innerHTML =
  FOOD_CATALOG.map((food) => `<option value="${esc(food.name)}"></option>`).join("");

function updateShoppingBadge() {
  const badge = document.getElementById("shopping-badge");
  badge.textContent = shoppingList.length > 9 ? "9+" : shoppingList.length;
  badge.hidden = shoppingList.length === 0;
}

function renderShopping() {
  document.getElementById("shopping-count").textContent = `To Buy (${shoppingList.length})`;
  document.getElementById("shopping-clear").hidden = shoppingList.length === 0;
  const box = document.getElementById("shopping-list");
  if (shoppingList.length === 0) {
    box.innerHTML = `<p class="empty-text">Your shopping list is empty.<br>Add items above, or tap “Add Missing Items” on any recipe.</p>`;
    return;
  }
  box.innerHTML = `<ul class="shopping">${shoppingList.map((entry) => `
    <li>
      <span class="shopping__name">${esc(entry.name)}${entry.amount ? ` <em>${esc(entry.amount)}</em>` : ""}${entry.recipe ? `<small>for ${esc(entry.recipe)}</small>` : ""}</span>
      <button class="shopping__got" type="button" data-bought="${esc(entry.id)}" aria-label="Bought ${esc(entry.name)}">✓</button>
      <button class="shopping__remove" type="button" data-unlist="${esc(entry.id)}" aria-label="Remove ${esc(entry.name)} from list">×</button>
    </li>`).join("")}</ul>`;
}

document.getElementById("shopping-add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const typed = shoppingInput.value.trim();
  shoppingError.hidden = true;
  if (!typed) {
    shoppingError.textContent = "Type the name of something to buy";
    shoppingError.hidden = false;
    shoppingInput.focus();
    return;
  }
  const known = findCatalogFood(typed);
  const name = known ? known.name : typed.charAt(0).toUpperCase() + typed.slice(1);
  if (shoppingList.some((e) => simplify(e.name) === simplify(name))) {
    shoppingError.textContent = `${name} is already on your list`;
    shoppingError.hidden = false;
    return;
  }
  shoppingList.push({ id: newId("shop"), name });
  saveShopping();
  shoppingInput.value = "";
  renderShopping();
});

shoppingInput.addEventListener("input", () => { shoppingError.hidden = true; });

document.getElementById("shopping-list").addEventListener("click", (event) => {
  const bought = event.target.closest("[data-bought]");
  const unlist = event.target.closest("[data-unlist]");
  if (!bought && !unlist) return;
  const id = bought ? bought.dataset.bought : unlist.dataset.unlist;
  const index = shoppingList.findIndex((e) => e.id === id);
  if (index === -1) return;
  const [entry] = shoppingList.splice(index, 1);
  saveShopping();

  if (bought) {
    const item = addFoodByName(entry.name);
    renderShopping();
    showToast(`${item.name} moved to My Fridge`, () => { location.hash = "#edit-food/" + encodeURIComponent(item.id); }, "Edit");
  } else {
    renderShopping();
    showToast(`Removed ${entry.name}`, () => {
      shoppingList.splice(Math.min(index, shoppingList.length), 0, entry);
      saveShopping();
      renderShopping();
    });
  }
});

document.getElementById("shopping-clear").addEventListener("click", () => {
  if (!confirm("Remove everything from your shopping list?")) return;
  const old = shoppingList;
  shoppingList = [];
  saveShopping();
  renderShopping();
  showToast("Shopping list cleared", () => { shoppingList = old; saveShopping(); renderShopping(); });
});

/* Start the app */
showStorageStatus(FridgeStorage.status());
applyTheme();
updateShoppingBadge();
showScreen();
