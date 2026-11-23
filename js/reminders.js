/*
  Ripeline expiry reminder emails (optional, off until someone turns them on)
  ---------------------------------------------------------------------------
  Profile → Notifications lets people turn on "Expiry reminder emails" and pick
  when to be reminded (on the day, or 1–7 days before food expires).

  HOW IT WORKS
  Food normally lives only on the device. A phone can't send emails while the
  app is closed, so when reminders are ON this file keeps a small copy of just
  the FOOD NAMES and EXPIRATION DATES in the Supabase database (table
  "expiry_reminders"). Once a day, Supabase checks that table and sends one
  email (through Brevo) listing food that's about to expire. Each food is
  mentioned only once.

  Turning reminders OFF deletes that copy. Deleting the account deletes it too.
  The server-side part (table, daily timer, email) is set up once in the
  Supabase dashboard — see "Expiry reminder emails" in the README.
*/

const REMINDER_TABLE = "expiry_reminders";
const REMINDER_DEFAULTS = { enabled: false, daysBefore: 2 };
let reminderSyncTimer = null;

function reminderSettings() {
  const saved = prefs.reminders && typeof prefs.reminders === "object" ? prefs.reminders : {};
  const days = Number(saved.daysBefore);
  return {
    enabled: saved.enabled === true,
    daysBefore: Number.isInteger(days) && days >= 0 && days <= 14 ? days : REMINDER_DEFAULTS.daysBefore,
  };
}

function saveReminderSettings(settings) {
  prefs.reminders = settings;
  savePrefs();
}

function reminderStatus(text, kind) {
  const box = document.getElementById("reminders-status");
  box.textContent = text || "";
  box.className = "account-message" + (kind ? " account-message--" + kind : "");
  box.hidden = !text;
}

/* Is the problem "the table hasn't been set up in Supabase yet"? */
function remindersNotSetUp(error) {
  return error && (error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message || ""));
}

/* The copy that goes to Supabase: only food names and expiration dates */
function reminderItems() {
  return items
    .filter((item) => item.expires)
    .map((item) => ({ name: item.name, expires: item.expires }));
}

/* Send this device's food names + dates (or remove them when reminders are off) */
async function syncReminders() {
  clearTimeout(reminderSyncTimer);
  if (!authClient || !currentUser) return { ok: false };
  const settings = reminderSettings();
  try {
    if (settings.enabled) {
      const { error } = await authClient.from(REMINDER_TABLE).upsert({
        user_id: currentUser.id,
        name: profile.name || "",
        enabled: true,
        days_before: settings.daysBefore,
        items: reminderItems(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    } else {
      const { error } = await authClient.from(REMINDER_TABLE).delete().eq("user_id", currentUser.id);
      if (error && !remindersNotSetUp(error)) throw error;
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/* Called after food changes: wait a moment so several quick changes send only once */
function scheduleReminderSync() {
  if (!reminderSettings().enabled || !currentUser) return;
  clearTimeout(reminderSyncTimer);
  reminderSyncTimer = setTimeout(syncReminders, 1500);
}

/* Used by "Delete my data from this device": stop reminders and remove the copy */
async function stopReminders() {
  if (!reminderSettings().enabled) return;
  saveReminderSettings({ ...reminderSettings(), enabled: false });
  await syncReminders();
}

/* ---------- The Notifications card on the Profile screen ---------- */
function renderReminders() {
  const settings = reminderSettings();
  document.getElementById("reminders-enabled").checked = settings.enabled;
  document.getElementById("reminders-days").value = String(settings.daysBefore);
  document.getElementById("reminders-options").hidden = !settings.enabled;
  const email = currentUser ? currentUser.email : "your account email";
  document.getElementById("reminders-note").textContent = settings.enabled
    ? `Reminders go to ${email}, at most once a day, and mention each food only once. While reminders are on, Ripeline keeps a copy of your food names and expiration dates with Supabase so it can email you. Turning reminders off deletes that copy.`
    : "Get an email when food in your fridge is about to expire. Only food with an expiration date is included.";
}

async function applyReminderChange(settings, successText) {
  const previous = reminderSettings();
  saveReminderSettings(settings);
  renderReminders();
  reminderStatus("Saving…");
  const result = await syncReminders();
  if (result.ok) {
    reminderStatus(successText, "success");
    setTimeout(() => reminderStatus(""), 4000);
    return;
  }
  // Didn't work: put the switch back the way it was and explain
  saveReminderSettings(previous);
  renderReminders();
  if (remindersNotSetUp(result.error)) {
    reminderStatus("Email reminders aren't available yet. Please try again later.", "error");
  } else if (result.error && !result.error.code && /fetch|network/i.test(String(result.error.message || ""))) {
    reminderStatus("Couldn't reach Ripeline's server. Check your internet connection and try again.", "error");
  } else {
    reminderStatus("Sorry, your reminder settings couldn't be saved. Please try again.", "error");
  }
}

document.getElementById("reminders-enabled").addEventListener("change", (event) => {
  const on = event.target.checked;
  applyReminderChange({ ...reminderSettings(), enabled: on },
    on ? "Reminders are on. We'll email you before your food expires." : "Reminders are off, and your food list was removed from our server.");
});

document.getElementById("reminders-days").addEventListener("change", (event) => {
  applyReminderChange({ ...reminderSettings(), daysBefore: Number(event.target.value) }, "Saved.");
});

/* After logging in: show the settings stored for this account and refresh the server copy */
async function loadRemindersForAccount() {
  if (!authClient || !currentUser) return;
  const { data, error } = await authClient.from(REMINDER_TABLE).select("enabled, days_before").eq("user_id", currentUser.id).maybeSingle();
  if (!error && data) {
    saveReminderSettings({ enabled: data.enabled === true, daysBefore: Number(data.days_before) });
  }
  if (document.getElementById("profile").classList.contains("is-active")) renderReminders();
  if (reminderSettings().enabled) syncReminders();
}
