# Gym Kori

A mobile-first gym tracker in English and Bangla. See `docs/v1-build-plan.md` for the plan.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173.

To try it on your phone, connect the phone to the same Wi-Fi, run `npm run phone`, and open the "Network" address it prints.

## Check it

```
npx playwright install chromium
npm run check
```

This runs the type check, lint, unit tests and browser tests.
