# Ibanez Decoder Handoff (Server-Side Migration + Latest Rules)

## Current State
- **Decode logic has been moved server-side** and is now centralized in:
  - `src/serial-decode-service.ts`
  - `src/decoders/ibanez.ts`
- Frontend now calls backend decode endpoint (single trip) and backend logs decode events.
- Frontend still owns user-facing explanatory text (Ibanez modal), and that text has been updated alongside decoder rule changes.

## Architecture Notes
- Worker endpoint flow in use:
  1. Client submits `brand + serial`.
  2. Backend decodes and performs retry/normalization logic.
  3. Backend logs decode event.
  4. Backend returns decode result (and corrected serial when applicable).
- Key decode entrypoint:
  - `decodeSerialForBackend(brandInput, serialInput)` in `src/serial-decode-service.ts`

## Ibanez Retry/Normalization Behavior (Important)
- Generic retries include:
  - uppercase
  - remove spaces/hyphens
  - alphanumeric cleanup
- Ibanez-specific retries include:
  - `O <-> 0` normalization attempts
  - `1... -> I...` first-character correction
  - **Known explicit variant only:** `HU` + 9 digits retries as `U` + 9 digits
    - This is intentionally narrow (not broad “drop first letter”).
- When a retry succeeds, decoded result includes corrected serial and UI input is updated.

## Recent Ibanez Cases Added
- `HU081100181` -> known retry to `U081100181`
- `Ao3oooo9` -> corrected to `A0300009` via O/0 retries; compact month-letter format
- `402989` -> supports pre-letter 6-digit `YMMNNN` interpretation
  - primary 1974-02, alternate note 1984-02
- `I1161207864` -> Indonesia extended `I + 10 digits` format (`YY + line + MM + sequence`)
- `GZ150102324` -> China `GZ + 9 digits` GIO-style format
- `GRG170DX` -> treated as model code fallback (not serial)
- `4H2300501778` -> China `4H + 10 digits` extended format (`YY + batch/line + MM + sequence`)

## Key Files Updated Recently
- Decoder core:
  - `src/decoders/ibanez.ts`
  - `src/serial-decode-service.ts`
- Regression coverage:
  - `scripts/test-regressions.mjs`
  - `TEST-SERIAL-NUMBERS.md`
- Frontend Ibanez help/modal text:
  - `decoders/ibanez-guitar-serial-number-decoder.html`

## Regression / Validation
- Run:
  - `npm run test:regressions`
- Current status:
  - Passing after each recent Ibanez addition.

## Deployment Guidance
- **Decoder logic changes:** deploy Worker
  - `npx wrangler deploy` (from `workers/listing-evaluator/`)
- **Ibanez modal/help text changes:** deploy frontend/static build as well
  - `npm run build` (repo root) and publish static output per your normal flow

## What To Tell The Next Chat
- Decoder is backend-owned now; frontend should not reintroduce decode logic.
- Preserve explicit/narrow typo rules (like `HU...`) unless new evidence supports broader behavior.
- Any new Ibanez serial addition must include:
  1. decoder rule update
  2. regression test
  3. `TEST-SERIAL-NUMBERS.md` row
  4. Ibanez modal text update if it introduces a new format class

