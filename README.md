# Weather Explorer

A Fastify + TypeScript weather app that lets you look up forecast data by **full address**, **city/state**, **ZIP code**, or **latitude/longitude**.

It provides:
- a **single-day detailed view** with hourly breakdowns
- a **date-range explorer** with one row per day
- a **plain-text weather endpoint**
- lazy-loaded **15-minute detail data** for selected hours

---

## Features

- 🌤️ Address lookup and reverse geocoding
- 📍 Coordinate input such as `40.7128, -74.0060`
- 📅 Single-day and multi-day weather views
- ⏱️ Lazy 15-minute detail loading for better performance
- 🧭 English/metric unit options
- 🛡️ Security middleware via Helmet and rate limiting
- 🧪 TypeScript, Jest, and ESLint setup

---

## Inputs

The main user input is the `address` field.

Supported formats:
- `08873`
- `Seattle, WA`
- `24 Ave, Somerset, NJ 08873`
- `40.7128, -74.0060`

Additional inputs:
- `date` — single-day weather page
- `startDate` and `endDate` — range page
- `temperatureUnit` — `fahrenheit` or `celsius`
- `unitSystem` — `english` or `metric`

---

## Outputs

### HTML pages
- `/` → default landing page for the range explorer
- `/weather/day` → detailed day view with hourly rows
- `/weather/range` → multi-day range view with expandable daily details

### API-style responses
- `/weather/text` → plain-text weather summary
- `/weather/minutely` → JSON for lazy 15-minute weather details
- `/health` → health-check endpoint

### Example requests
```txt
/weather/day?address=Seattle,%20WA&date=2026-04-07
/weather/range?address=40.7128,%20-74.0060&startDate=2026-04-07&endDate=2026-04-10
/weather/text?address=08873
```

---

## Project structure

```txt
src/
  app.ts                 Fastify app setup, middleware, static files, views
  index.ts               Server startup entry point
  config.ts              App configuration
  utils/
    index.ts             Shared helpers, validation, formatting, icon mapping
  models/
    weather.ts           Shared weather and geocode types
  plugins/
    cors.ts              CORS plugin registration
  routes/
    health.ts            Health-check route
    weather.ts           Main weather page/API routes
  services/
    weatherService.ts    Geocoding and Open-Meteo integration

public/
  weather-icons/         Local weather SVG assets
  landing.js             Client-side form validation
  weather-day.js         Lazy minutely fetch for day view
  weather-range.js       Expand/collapse behavior for range view

views/
  landing.hbs            Single-day landing page
  weather-day.hbs        Single-day results page
  weather-range-landing.hbs  Range landing page
  weather-range.hbs      Range results page

tests/
  *.tests.ts             Jest tests
```

---

## Major npm packages used

| Package | Purpose |
|---|---|
| `fastify` | Main web server framework |
| `@fastify/view` | Server-side template rendering |
| `handlebars` | HTML templating engine |
| `@fastify/static` | Serves JS, icons, and other static assets |
| `openmeteo` | Weather forecast API client |
| `node-geocoder` | Forward and reverse geocoding |
| `geo-tz` | Timezone lookup from coordinates |
| `@fastify/cors` | CORS support |
| `@fastify/helmet` | Secure HTTP headers |
| `@fastify/rate-limit` | Request throttling |
| `short-uuid` | Request ID generation |
| `typescript` | Type-safe development |
| `tsx` | Runs TypeScript directly in development |
| `jest` + `ts-jest` | Test runner for TypeScript |
| `eslint` | Linting and code quality checks |

---

## Running the app

### Install dependencies
```bash
npm install
```

### Start in development mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Start the built app
```bash
npm start
```

### Test
```bash
npm test
```

### Lint
```bash
npm run lint
```

By default, the app starts on:
```txt
http://localhost:3000/
```

---

## How it works

1. The user enters an address, ZIP, city/state, or coordinates.
2. `WeatherService` geocodes or reverse-geocodes the input.
3. The app requests forecast data from Open-Meteo.
4. Fastify routes shape the data for HTML, text, or JSON responses.
5. Handlebars templates render the weather UI.
6. Client-side JS loads extra 15-minute detail rows only when needed.

---

## Notes

- Forecast dates are limited by Open-Meteo availability (about 15 days ahead).
- Using non-commercial, free access to Open-Meteo, API call volumes are limited.
- Coordinate input is preserved for weather lookup while a readable address is shown when reverse geocoding succeeds.
