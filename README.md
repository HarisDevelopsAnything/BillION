# Trip Billing (React + Vite + Supabase)

Billing app for a travels business: pick the client and vehicle, enter the trip, get the bill as Excel or a printable PDF.
Login, clients, past bills, vehicle types and rates are stored in Supabase.

## Supabase setup

Run [supabase/schema.sql](supabase/schema.sql) once in the Supabase SQL Editor for a new database, or rerun it after updating attachment storage.
The script creates the `bill-attachments` public Storage bucket and required storage policies. If ZIP upload reports **Bucket not found**, the script has not been run on the active Supabase project.

## How to update the release changelog

The in-app changelog is the `NewRelease` dialog configured in `src/App.jsx`.
For a new release:

1. Update `version` in `package.json` and `package-lock.json`.
2. Increase the `version` prop passed to `<NewRelease>` in `src/App.jsx`.
3. Update its `title`, `summary`, and `features` array.

The dialog appears once per user when the stored `version` differs from the new `version`. To show the dialog again, change the version or clear `billion:seen-release:<user-id>` in browser local storage.
