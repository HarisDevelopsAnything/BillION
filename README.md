# Trip Billing (React + Vite + Supabase)

Billing app for a travels business: pick the client and vehicle, enter the trip, get the bill as Excel or a printable PDF.
Login, clients, past bills, vehicle types and rates are stored in Supabase. The site itself is static, so it can be hosted free on Render.

## 1. Set up Supabase (about 10 minutes)

1. Create a free project at supabase.com.
2. Open **SQL Editor -> New query**, paste the whole of `supabase/schema.sql`, click **Run**.
   This creates the tables and locks each one to the logged-in user (Row Level Security).
3. Open **Authentication -> Users -> Add user**, enter an email and password, and tick the option to auto-confirm the user.
   This is the login for the business owner.
4. In the Authentication settings, switch **off** "Allow new users to sign up", so nobody else can create an account.
5. Open **Project Settings -> API** and copy the **Project URL** and the **anon / publishable key**.

## 2. Try it on your computer

```
cp .env.example .env        # then paste the two values from step 5
npm install
npm run dev                 # opens http://localhost:5173
npm test                    # checks the billing maths against the sample invoice (Rs. 4,368)
```

The first login creates the starter vehicle list and settings automatically.

## 3. Put it on Render (free static site)

1. Push this folder to a GitHub repository (the `.env` file is git-ignored, so your keys stay private).
2. On render.com: **New -> Static Site**, pick the repository, then set:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env`)
3. Click **Create Static Site**. When the build finishes, the app is live at the `onrender.com` address.

(`render.yaml` describes the same setup if you prefer a Blueprint.)
The two variables are baked in when the site is built, so if you change them, redeploy.

## Good to know

- **Is the public key safe in the website?** Yes. It only works together with a login, and the database rules (Row Level Security) let a logged-in user see only their own rows.
- **Supabase free projects pause after a week of low activity.** Using the app a few times a week is enough to avoid it. If it ever pauses, press "Resume project" in the Supabase dashboard; your data is kept.
- **Forgot password:** reset it from Supabase -> Authentication -> Users.
- **Rates are copied into each trip when it is added**, so changing a vehicle's price never alters a saved bill.
- Settings -> "Download a copy of all data" saves everything as a file, as an extra safety copy.

## Where things are

- `supabase/schema.sql` : database tables and access rules
- `src/lib/billing.js` : all the billing rules (packages, extra hours/km, outstation, hills, amount in words)
- `src/lib/invoice.js`, `src/lib/xlsx.js` : the printed bill and the Excel file
- `src/lib/db.js` : every database call
- `src/components/` : the screens
