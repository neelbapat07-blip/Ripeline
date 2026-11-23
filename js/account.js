/*
  Ripeline accounts
  -----------------
  Everyone needs a free account to use Ripeline. Until someone logs in (with a
  confirmed email), only the Sign Up / Log In screen is shown.
  Creating an account:
    - stores their name and email with Supabase (the account service),
    - sends them a welcome email with a "confirm my email" button
      (the email itself is set up in the Supabase dashboard, not in this file),
    - lets them log in again later.

  Each account's food, shopping list and preferences are stored in the account
  and synced to every device it logs in on (see js/sync.js).

  Screens: the "Your Account" screen (#account) handles sign up, log in,
  forgotten passwords and deleting the account.
*/

const ACCOUNT_MIN_PASSWORD = 8;

/* Set up the connection to Supabase. If the library didn't load (e.g. offline), accounts are just unavailable. */
const authClient = (() => {
  try {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  } catch (error) {
    return null;
  }
})();

let currentUser = null;          // the signed-in account, or null
// Which form the account screen shows: signup, login, reset, newPassword.
// If someone has used an account on this device before, start on Log In.
let accountMode = FridgeStorage.loadDevice().lastAccountEmail ? "login" : "signup";

/* A link from one of our emails (confirm, reset password) comes back with details after the "#".
   Remember it now, before Supabase reads it and tidies the address. */
const returnedFromEmail = (() => {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (params.get("error_code") || params.get("error")) {
    return { error: params.get("error_code") || params.get("error"), description: params.get("error_description") || "" };
  }
  if (params.get("access_token")) return { type: params.get("type") || "signup" };
  return null;
})();

/* ---------- Turning Supabase's error messages into plain English ---------- */
function friendlyAuthError(error) {
  const code = (error && (error.code || error.name)) || "";
  const message = String((error && error.message) || "");
  if (code === "AuthRetryableFetchError" || /fetch|network/i.test(message)) {
    // Status 0 = no connection at all. 500+ = the account service answered but had a problem.
    if (!error.status) return "Couldn't reach the account service. Check your internet connection and try again.";
    if (/email|sending|smtp/i.test(message)) return "Your account couldn't be created because the welcome email couldn't be sent. Please try again later. (Ripeline's email settings may need fixing.)";
    return `The account service had a problem (error ${error.status}). Please try again in a few minutes.`;
  }
  if (code === "invalid_credentials") return "That email and password don't match. Check them and try again.";
  if (code === "email_not_confirmed") return "Please confirm your email first. Check your inbox for the welcome email (and your spam folder).";
  if (code === "user_already_exists" || code === "email_exists") return "An account has already been created with this email. Please log in instead (or use “Forgot your password?”).";
  if (code === "weak_password") return `Please choose a stronger password (at least ${ACCOUNT_MIN_PASSWORD} characters, not easy to guess).`;
  if (code === "email_address_invalid") return "That email address doesn't look right.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /rate limit/i.test(message)) return "Too many attempts right now. Please wait a few minutes and try again.";
  if (code === "same_password") return "Your new password must be different from the old one.";
  if (code === "signup_disabled") return "New sign-ups are turned off right now.";
  return "Something went wrong. Please try again in a moment.";
}

/* ---------- Showing messages on the account screen ---------- */
function accountMessage(text, kind) {
  const box = document.getElementById("account-message");
  box.textContent = text || "";
  box.className = "account-message" + (kind ? " account-message--" + kind : "");
  box.hidden = !text;
}

function setAccountBusy(busy, label) {
  const button = document.getElementById("account-submit");
  button.disabled = busy;
  if (label) button.textContent = label;
}

/* ---------- Remembering the account email on this device ---------- */
function rememberAccountEmail(email) {
  const device = FridgeStorage.loadDevice();
  if (!email || device.lastAccountEmail === email) return;
  FridgeStorage.saveDevice({ ...device, lastAccountEmail: email });
}

/* Fill the email box with the remembered email (if it's empty), so logging back in is quick */
function prefillAccountEmail() {
  const input = document.getElementById("account-email-input");
  if (!input.value && (accountMode === "login" || accountMode === "reset")) {
    input.value = FridgeStorage.loadDevice().lastAccountEmail || "";
  }
}

/* Ask the browser's password manager to offer saving the login (Chrome/Android support this;
   iPhone and other browsers offer it on their own). The app itself never stores passwords. */
function offerToSavePassword(email, password) {
  try {
    if (window.PasswordCredential && navigator.credentials) {
      navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: profile.name || email })).catch(() => {});
    }
  } catch (error) { /* not supported: the browser handles it itself */ }
}

/* ---------- Keeping the local profile in step with the account ---------- */
function applyAccountToProfile(user) {
  if (!user) return;
  rememberAccountEmail(user.email);
  const accountName = cleanText(user.user_metadata && user.user_metadata.name, 40);
  profile.email = user.email || profile.email;
  if (accountName) profile.name = accountName;
  saveProfile();
}

/* ---------- The "Your Account" screen ---------- */
const ACCOUNT_MODES = {
  signup:      { title: "Create Account", subtitle: "Create a free account to start using Ripeline", button: "Create Account" },
  login:       { title: "Log In", subtitle: "Welcome back!", button: "Log In" },
  reset:       { title: "Reset Password", subtitle: "We'll email you a link to choose a new one", button: "Send Reset Link" },
  newPassword: { title: "New Password", subtitle: "Choose a new password for your account", button: "Save New Password" },
};

function renderAccountScreen(mode) {
  if (mode && ACCOUNT_MODES[mode]) accountMode = mode;
  const signedIn = Boolean(currentUser);
  const showForm = !signedIn || accountMode === "newPassword";

  document.getElementById("account-signed-in").hidden = showForm;
  document.getElementById("account-form-area").hidden = !showForm;
  document.getElementById("account-unavailable").hidden = Boolean(authClient);

  if (!showForm) {
    document.getElementById("account-title").textContent = "Your Account";
    document.getElementById("account-subtitle").textContent = "You're logged in";
    document.getElementById("account-email").textContent = currentUser.email;
    const confirmed = Boolean(currentUser.email_confirmed_at || currentUser.confirmed_at);
    document.getElementById("account-status").textContent = confirmed ? "Email confirmed ✓" : "Email not confirmed yet";
    return;
  }

  const m = ACCOUNT_MODES[accountMode];
  document.getElementById("account-title").textContent = m.title;
  document.getElementById("account-subtitle").textContent = m.subtitle;
  document.getElementById("account-submit").textContent = m.button;
  document.getElementById("account-submit").disabled = !authClient;
  document.getElementById("account-tabs").hidden = accountMode === "reset" || accountMode === "newPassword";
  document.querySelectorAll("#account-tabs .chip").forEach((chip) => chip.classList.toggle("is-selected", chip.dataset.mode === accountMode));
  document.getElementById("account-name-field").hidden = accountMode !== "signup";
  document.getElementById("account-email-field").hidden = accountMode === "newPassword";
  document.getElementById("account-password-field").hidden = accountMode === "reset";
  document.getElementById("account-password").autocomplete = accountMode === "login" ? "current-password" : "new-password";
  document.getElementById("account-password-hint").hidden = accountMode === "login";
  document.getElementById("account-forgot").hidden = accountMode !== "login";
  document.getElementById("account-back-to-login").hidden = accountMode !== "reset";
  prefillAccountEmail();
}

/* Small "Account" row on the Profile screen */
function renderAccountRow() {
  const row = document.getElementById("account-row-text");
  if (!row) return;
  row.textContent = currentUser ? `Account: ${currentUser.email}` : "Create Account / Log In";
  const emailInput = document.getElementById("profile-email-input");
  emailInput.readOnly = Boolean(currentUser);
  document.getElementById("profile-email-note").hidden = !currentUser;
  document.getElementById("log-out").hidden = !currentUser;   // nothing to log out of without an account
}

document.getElementById("account-tabs").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-mode]");
  if (!chip) return;
  accountMessage("");
  renderAccountScreen(chip.dataset.mode);
});
document.getElementById("account-forgot").addEventListener("click", () => { accountMessage(""); renderAccountScreen("reset"); });
document.getElementById("account-back-to-login").addEventListener("click", () => { accountMessage(""); renderAccountScreen("login"); });

document.getElementById("account-show-password").addEventListener("change", (event) => {
  document.getElementById("account-password").type = event.target.checked ? "text" : "password";
});

/* Where the links in our emails should send people back to (this same page) */
function returnAddress() {
  return location.origin + location.pathname;
}

document.getElementById("account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authClient) return;
  const name = document.getElementById("account-name").value.trim();
  const emailInput = document.getElementById("account-email-input");
  const email = emailInput.value.trim().toLowerCase();
  const password = document.getElementById("account-password").value;

  // Check the form before contacting Supabase
  if (accountMode !== "newPassword" && (!email || !emailInput.checkValidity())) {
    accountMessage("Please enter a valid email address.", "error"); emailInput.focus(); return;
  }
  if ((accountMode === "signup" || accountMode === "newPassword") && password.length < ACCOUNT_MIN_PASSWORD) {
    accountMessage(`Please use a password with at least ${ACCOUNT_MIN_PASSWORD} characters.`, "error"); return;
  }
  if (accountMode === "login" && !password) {
    accountMessage("Please enter your password.", "error"); return;
  }

  const normalLabel = ACCOUNT_MODES[accountMode].button;
  setAccountBusy(true, "Please wait…");
  accountMessage("");
  try {
    if (accountMode === "signup") {
      const { data, error } = await authClient.auth.signUp({
        email, password, options: { data: { name }, emailRedirectTo: returnAddress() },
      });
      if (error) throw error;
      // Supabase doesn't report "email already used" as an error (for privacy). Instead it returns
      // an account with no sign-in methods attached, which means the email is already taken.
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw { code: "user_already_exists" };
      }
      if (name) { profile.name = name; saveProfile(); }
      rememberAccountEmail(email);
      offerToSavePassword(email, password);
      document.getElementById("account-form").reset();
      accountMessage(`Almost done! We sent a welcome email to ${email}. Tap “Confirm my email” in it to finish creating your account. (Check your spam folder if you don't see it.)`, "success");
    } else if (accountMode === "login") {
      const { error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      rememberAccountEmail(email);
      offerToSavePassword(email, password);
      document.getElementById("account-password").value = "";
      showToast("You're logged in");
      location.hash = "#home";
    } else if (accountMode === "reset") {
      const { error } = await authClient.auth.resetPasswordForEmail(email, { redirectTo: returnAddress() });
      if (error) throw error;
      accountMessage(`If there's an account for ${email}, we've sent it a link to reset the password. If you don't see the email, check your spam folder and mark it as not spam.`, "success");
    } else if (accountMode === "newPassword") {
      const { error } = await authClient.auth.updateUser({ password });
      if (error) throw error;
      if (currentUser) offerToSavePassword(currentUser.email, password);
      document.getElementById("account-form").reset();
      accountMode = "login";
      showToast("Your password has been changed");
      location.hash = "#home";
    }
  } catch (error) {
    accountMessage(friendlyAuthError(error), "error");
    if (error && error.code === "email_not_confirmed") {
      document.getElementById("account-resend").hidden = false;
    }
  } finally {
    setAccountBusy(false, normalLabel);
  }
});

/* "Send the welcome email again" (shown when someone tries to log in before confirming) */
document.getElementById("account-resend").addEventListener("click", async () => {
  const email = document.getElementById("account-email-input").value.trim().toLowerCase();
  if (!authClient || !email) return;
  const { error } = await authClient.auth.resend({ type: "signup", email, options: { emailRedirectTo: returnAddress() } });
  document.getElementById("account-resend").hidden = true;
  accountMessage(error ? friendlyAuthError(error) : `We sent the welcome email to ${email} again.`, error ? "error" : "success");
});

/* Log out (from the account screen or the Profile screen's Log Out row) */
/* Waits for a task, but never longer than `ms` (a slow phone connection must not stop logging out) */
function withTimeLimit(task, ms) {
  return Promise.race([Promise.resolve(task).catch(() => {}), new Promise((done) => setTimeout(done, ms))]);
}
async function signOutOfAccount() {
  // send any last changes first (at most 3 seconds)
  if (typeof stopAccountSync === "function") await withTimeLimit(stopAccountSync(), 3000);
  // "local" logs out on this device straight away, without needing the internet,
  // so the phone can't stay logged in because the server couldn't be reached
  if (authClient) await withTimeLimit(authClient.auth.signOut({ scope: "local" }), 3000);
  try {   // make sure no saved login is left behind on this device
    Object.keys(window.localStorage).filter((key) => /^sb-.*-auth-token/.test(key))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch (error) { /* storage blocked: nothing saved anyway */ }
  accountMode = "login";            // next time, show Log In with the email already filled in
  lockApp();
}
document.getElementById("account-log-out").addEventListener("click", async () => {
  await signOutOfAccount();
  showToast("You're logged out");
});

/* Delete account: needs the small "delete_user" setup in Supabase (see README) */
document.getElementById("account-delete").addEventListener("click", async () => {
  if (!authClient || !currentUser) return;
  if (!confirm("Delete your Ripeline account? Your name, email, food, shopping list and settings will be erased from your account and from this device. This can't be undone.")) return;
  if (typeof cancelAccountSync === "function") cancelAccountSync();   // stop syncing before deleting
  const { error } = await authClient.rpc("delete_user");
  if (error) {
    if (typeof startAccountSync === "function") startAccountSync();     // nothing was deleted: carry on syncing
    accountMessage("Sorry, your account couldn't be deleted right now. Please try again later.", "error");
    return;
  }
  FridgeStorage.deleteAccountData();
  const device = FridgeStorage.loadDevice();
  delete device.lastAccountEmail;     // the account is gone, so don't suggest its email any more
  FridgeStorage.saveDevice(device);
  await authClient.auth.signOut({ scope: "local" }).catch(() => {});
  accountMode = "signup";
  lockApp();
  showToast("Your account has been deleted");
});

/* ---------- Locking and unlocking Ripeline ---------- */
let welcomeShown = false;
let linkErrorShown = false;

/* Someone is logged in: load THEIR data and open the app */
function unlockApp(user) {
  const sameAccount = appUnlocked && FridgeStorage.currentAccount() === String(user.id).replace(/[^a-zA-Z0-9-]/g, "");
  currentUser = user;
  if (!sameAccount) {
    FridgeStorage.useAccount(user.id);
    loadAllData();
    applyPrefsToViews();
    appUnlocked = true;
    applyAccountToProfile(user);
    document.body.classList.remove("is-locked", "is-checking");
    applyTheme();
    updateShoppingBadge();
    showStorageStatus(FridgeStorage.status());
    // Go to Home, unless the address already names a real screen (e.g. a bookmarked #recipes)
    // Load this account's latest data (from every device), then its reminder settings
    const afterSync = () => { if (typeof loadRemindersForAccount === "function") loadRemindersForAccount(); };
    if (typeof startAccountSync === "function") startAccountSync().then(afterSync, afterSync);
    else afterSync();
    const { name } = readAddress();
    const isScreen = name && document.getElementById(SCREEN_ALIASES[name] || name) && document.getElementById(SCREEN_ALIASES[name] || name).classList.contains("screen");
    const emptyAddress = !location.hash.replace("#", "");
    if (emptyAddress || !isScreen || name === "account") history.replaceState(null, "", "#home");
    showScreen();
  } else {
    applyAccountToProfile(user);
  }
  renderAccountRow();
}

/* Nobody is logged in: hide everything except Sign Up / Log In */
function lockApp() {
  if (typeof stopListening === "function") stopListening();
  if (typeof syncStarted !== "undefined") syncStarted = false;
  currentUser = null;
  appUnlocked = false;
  FridgeStorage.stopUsingAccount();
  loadAllData();                      // nobody logged in = empty, so no one's food is on screen
  document.body.classList.add("is-locked");
  document.body.classList.remove("is-checking");
  applyTheme();
  updateShoppingBadge();
  showStorageStatus(FridgeStorage.status());
  if (returnedFromEmail && returnedFromEmail.error && !linkErrorShown) {
    linkErrorShown = true;
    accountMode = "login";
    history.replaceState(null, "", "#account");
    showScreen();
    accountMessage(returnedFromEmail.error === "otp_expired"
      ? "That email link has expired or was already used. Log in, or create your account again to get a new email."
      : "That email link didn't work. Please try again.", "error");
    return;
  }
  history.replaceState(null, "", "#account");
  showScreen();
  renderAccountRow();
}

/* ---------- Reacting to logins, logouts and email links ---------- */
if (authClient) {
  authClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      unlockApp(session.user);
      accountMode = "newPassword";
      history.replaceState(null, "", "#account");
      showScreen();
      return;
    }
    if (session) {
      unlockApp(session.user);
      // Just came back from the confirm button in the welcome email?
      if (returnedFromEmail && returnedFromEmail.type === "signup" && !welcomeShown) {
        welcomeShown = true;
        showToast("Your email is confirmed. Welcome to Ripeline! 🎉");
      }
    } else {
      lockApp();
    }
    if (document.getElementById("profile").classList.contains("is-active")) renderProfile();
    if (document.getElementById("account").classList.contains("is-active")) renderAccountScreen();
  });
} else {
  // The account library couldn't load (e.g. offline on the very first visit)
  lockApp();
}

renderAccountRow();
