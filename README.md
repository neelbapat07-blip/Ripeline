# Ripeline

A phone-friendly website that helps you keep track of the food in your fridge
and find recipes that use it before it goes bad.

Ripeline runs in the browser, with no paid services. You need a free account to use it.
Your food, shopping list and preferences are saved in the browser on your device (see below).

## Where your data is saved

Everything is saved in the browser's **localStorage**, which belongs to this website,
in that one browser, on that one device:

- **Each browser and device has its own separate data.** Your phone, your laptop, and a
  friend's phone each have their own fridge. Nothing is shared or synced.
- **Your food data stays on the device.** Supabase stores your name and email for your account, and, only
  if you turn on expiry reminder emails, your food names and expiration dates.
- **It saves automatically** every time you add, edit or delete food, change the shopping
  list, or change your profile, theme, sort order or recipe filter.
- **It loads automatically** when you open the app, and survives refreshing and closing the browser.
- **New users start with an empty fridge.** The food list in `js/data.js` only provides
  choices for the Add Food screen.
- **Open in two tabs?** They stay in sync and never overwrite each other.

| Saved under | What |
|---|---|
| `fridgeiq.items.v1` | Food: names, categories, storage, quantities, units, expiration dates |
| `fridgeiq.shopping.v1` | Shopping list |
| `fridgeiq.profile.v1` | Name, email, colour theme |
| `fridgeiq.prefs.v1` | Sort order and filters |

**If something goes wrong**, a yellow message appears at the top:
- *Saving is blocked* (e.g. private browsing): the app works but can't keep changes.
- *Storage is full*: the latest change wasn't saved, and everything saved before is untouched.
- *Saved data couldn't be read*: readable entries are kept and the original is copied to a
  `.backup` entry, so nothing is silently erased.

To remove your data: **Profile → Privacy Settings → Delete my data from this device**. This only affects the
current browser. Data stored by a different website address (for example the GitHub Pages link
vs. the Vercel link) is separate, even on the same phone.

## How to open it

Download the project, **extract the ZIP** (right-click → Extract All), then double-click
`index.html`. To see it at phone size on a computer, make the browser window narrow.

## The screens

| Screen | How to get there |
|---|---|
| My Profile | The app opens here. The person icon at the top right of every screen brings you back |
| Home | "Home" in the bottom bar |
| My Fridge | "My Fridge" in the bottom bar |
| Add / Edit Food | "+ Add Food" on My Fridge, or tap any food to edit it |
| Recipe Finder | "Recipes" in the bottom bar |
| Recipe Details | Tap any recipe card |
| Shopping List | "Shopping" in the bottom bar |

## What works

- **My Fridge:** add, edit and delete food; search, category filters, sorting
  (Expiration / Name / Newest). Tags show Fresh, days left, or Expired.
- **Add Food:** pick from about 130 foods (Quick pick grid or type-ahead suggestions),
  which fills in the category, storage and a suggested expiration date. Any other food can be typed in.
- **Home:** item count, food that needs attention, **Expiring Soon**, today's best
  **Recipe Pick for You**, and a link to the shopping list.
- **Recipes:** 100 built-in recipes (breakfast, lunch, dinner and snacks), ranked by how well
  they fit your fridge (see below). The best 20 show first; "Show more" loads the rest.
  Filters: All, Use Before Lose, Can Make Now, Quick. Search by recipe name or ingredient.
- **Recipe Details:** every ingredient marked Have / Missing / Use soon, full cooking
  instructions, and **Add Missing Items to Shopping List**.
- **Shopping:** add items yourself or from recipes. Tap ✓ when you buy something and it
  moves into My Fridge with a suggested expiration date.
- **Profile:** your name (used in the greeting), 4 colour schemes, privacy settings
  (Delete my data from this device) and Log Out.

## Accounts and the welcome email

You need a free account to use Ripeline. Until someone logs in with a **confirmed email**,
the app only shows the **Sign Up / Log In** screen. Accounts are run by **Supabase** (free plan):

- **Sign up** stores the person's name and email with Supabase and sends a **welcome email**
  with a "Confirm my email" button. The email's wording is set in the Supabase dashboard
  (Authentication → Emails → Templates → *Confirm signup*), and it's sent through the Gmail
  account set up under Authentication → Emails → SMTP Settings.
- **Log in, log out, forgot password** and **delete my account** are on the account screen.
- **Logging out keeps your name and email on the device**, and the Log In form comes back
  already filled in with your email. The app never stores passwords; your phone's password
  manager can save it. To erase your data from a device, use Privacy Settings → Delete my data from this device.
- **Only name and email** go to Supabase. Food, shopping list and preferences stay in the
  browser on each device, **separately for each account**, so people sharing a device never see
  each other's fridge. The first account to log in on a device takes over any food saved there before.

The public Supabase address and *publishable* key are in `js/config.js`. They are meant
to be public. **Never** put the secret/service_role key or any password in the app.

### One-time setup for "Delete my account"
Supabase doesn't let apps delete accounts until you allow it. In the Supabase dashboard,
open **SQL Editor → New query**, paste this, and click **Run**:

```sql
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
```

It only lets a logged-in person delete **their own** account.

## Expiry reminder emails

On **Profile → Notifications**, people can turn on **Expiry reminder emails** and choose when to be
reminded (on the day, or 1, 2, 3, 5 or 7 days before). It's **off** until they turn it on.

While it's on, the app keeps a copy of **only their food names and expiration dates** in Supabase
(table `expiry_reminders`, which only they can read). Once a day (13:00 UTC = 8 AM US Eastern),
Supabase emails them, through Brevo, about food that's about to expire. Each food is mentioned only
once. Turning reminders off, "Delete my data from this device", or deleting the account removes the copy.

### One-time setup (in the Supabase and Brevo dashboards)
1. **Brevo API key:** Brevo → **SMTP & API** → **API Keys** tab → **Generate a new API key**
   (name it `Supabase reminders`) and copy it. It starts with `xkeysib-`. This is different from the SMTP key.
2. **Store it safely in Supabase:** Supabase → **SQL Editor → New query**, paste the line below with
   your key in place of the placeholder, and click **Run** (only once):
   ```sql
   select vault.create_secret('PASTE-YOUR-BREVO-API-KEY-HERE', 'brevo_api_key');
   ```
3. **Create the reminder system:** open [`supabase/expiry-reminders.sql`](supabase/expiry-reminders.sql),
   copy all of it, paste it into a new SQL Editor query, and click **Run**. It's safe to run again.
   - The "from" address is set to `neelbapat07@gmail.com` near the top of the function. It must be a
     **verified sender in Brevo**; change it there if you use a different one.
   - If it complains about `pg_net` or `pg_cron`, turn them on under **Database → Extensions**
     (or **Integrations → Cron**), then run it again.
4. **Test it now (optional):** in the SQL Editor run `select public.send_expiry_reminders();`.
   It returns how many reminder emails it just sent.

## How recipe matching works

For each recipe, Ripeline checks every required ingredient against My Fridge
(optional extras such as garnishes don't count against you). Similar foods count as a
match, for example any cheese works for "Cheese" and Greek yogurt works for "Yogurt".
These are listed in `INGREDIENT_ALIASES` in `js/recipes.js`.

Recipes are then sorted by:
1. how many of the ingredients you already have,
2. a big boost for each of your foods expiring in the next 3 days,
3. a bonus when you have everything.

Each card says why it's recommended, for example "Uses your Milk and Broccoli before
they expire. Just get Garlic". Everything updates as soon as your food changes.

Salt, pepper, cooking oil and water are assumed to be in every kitchen.

## What each file does

| File | What it's for |
|---|---|
| `index.html` | The **content**: all the screens, their text, pictures and buttons |
| `css/styles.css` | The **looks**: colours, sizes, spacing. The colours at the top come from Figma |
| `js/reminders.js` | **Expiry reminder emails** setting (Profile → Notifications) |
| `supabase/expiry-reminders.sql` | One-time Supabase setup for reminder emails (table, daily check, timer) |
| `js/account.js` | **Optional accounts**: sign up, log in, password reset, delete account |
| `js/config.js` | The public Supabase address and publishable key |
| `js/vendor/supabase.js` | Supabase's official library (v2.118.0), packed into one file |
| `js/storage.js` | **Saving and loading**: the only file that touches the browser's storage, with safety checks |
| `js/data.js` | The **food choices** for Add Food (not anyone's actual food) |
| `js/recipes.js` | The **recipe database** (first 29 recipes + ingredient matching rules). Copy one recipe block to add a new recipe |
| `js/recipes-more.js` | The **rest of the recipes** (71 more) |
| `js/app.js` | The **behaviour**: saving, recipe matching, and what every button does |
| `images/` | The two arrow icons from the Figma design |

## Notes

- **Pictures:** every recipe and food uses an emoji on a coloured tile, so there are no
  photo licenses to worry about. To change a recipe's picture, edit its `image` emoji or colour.
