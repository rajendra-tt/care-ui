# CARE 2.0 UI ⇄ cRIO-9056 interface contract

The UI is a static web app. It talks to the cRIO over plain HTTP + JSON, which a
**LabVIEW Web Service** (running in the RT application on the cRIO) implements.
Nothing else is needed on the target: no Node.js, no database server.

Base URL = `CARE_CONFIG.apiBase + CARE_CONFIG.apiPrefix` (default `/care/api` on the
same host that served the page). Set these in `config.js` on the target.

All responses are JSON. Include `"ok": false, "error": "message"` (or a non-2xx HTTP
status) for failures; the UI shows `error` to the therapist.

## Real-time control

### `GET /status`  (polled every `statusPollMs`, default 250 ms)

```json
{
  "ok": true,
  "state": "idle | running | break | estop",
  "mode": "balance | squat | walk | null",
  "speed": "slow | medium | fast",
  "offloading": 20,
  "offloadUnit": "percent | kg",
  "liftPosition": 50,
  "battery": 86,
  "durationSec": 612,
  "steps": 0,
  "squats": 0,
  "fallArrests": 0,
  "breaks": 1,
  "distanceM": 0.0,
  "speedMps": 0.0
}
```

`state` is the source of truth for which screen variant the UI shows
(select-mode / ongoing / break / E-stop pop-up). If the hardware E-stop is pressed,
report `"state": "estop"` and the UI will show the E-stop pop-up by itself.
After 3 failed polls the header Wi-Fi icon changes to "disconnected".

### `POST /command`

| Body | Meaning |
|---|---|
| `{"cmd":"lift","dir":"up"\|"down"}` | Jog patient lift. **Re-sent every `jogRepeatMs` (150 ms) while the button is held.** |
| `{"cmd":"lift","dir":"stop"}` | Button released. |
| `{"cmd":"move","dir":"front"\|"back"\|"left"\|"right"}` | Jog device movement, same hold/re-send rule. |
| `{"cmd":"move","dir":"stop"}` | Button released. |
| `{"cmd":"offload","value":25,"unit":"percent"\|"kg","kg":18,"bodyWeightKg":72}` | Set the offloading set-point. `value` is in `unit`; `kg` is the resulting offloaded weight and `bodyWeightKg` the weight from Patient vitals (both `null` if the weight is unknown). |
| `{"cmd":"mode","mode":"walk","speed":"slow"}` | Select exercise mode / walk speed. |
| `{"cmd":"session","action":"start"\|"break"\|"resume"\|"stop"}` | Session state machine. `start` resets counters. |
| `{"cmd":"estop","action":"engage"}` | Software E-stop. Sent on **press-in** of the UI button. |
| `{"cmd":"estop","action":"release"}` | Release. Must return to `break` if a session was active (never straight back to `running`), else `idle`. |

**Required RT-side safety behaviour**

1. *Jog watchdog*: stop lift/move motion if no jog command arrives for ~3× `jogRepeatMs`
   (≈450 ms). A dropped Wi-Fi link or a closed browser tab must never leave a motor running.
2. *Session watchdog*: if `/status` has not been polled for ~2 s during `running`, go to `break`
   (or a safe hold), since the therapist can no longer see or reach the on-screen E-stop.
3. Reject `lift`, `move`, `session start/resume` while in `estop` (`"ok": false`).
4. The on-screen E-stop is a convenience, **not** the safety function: a hard-wired
   E-stop circuit must exist independently of this UI and the network.
5. *Offloading cap*: never unload more than **60 kg**. Reject (`"ok": false`) any `offload` whose `kg`
   (or `value` when `unit` is `kg`) exceeds 60, and independently limit the actuator to 60 kg. The UI
   limits the percentage to `60 / bodyWeightKg x 100` (72 kg -> 83.33 %), but the RT side must not rely
   on the UI for this.

## Data

| Method & path | Request | Response |
|---|---|---|
| `POST /login` | `{"username","password"}` | `{"ok":true,"user":{"id","name","role":"therapist"\|"admin","username"}}` |
| `GET /patients?therapistId=t-1` | – (omit query = all patients) | `{"patients":[Patient]}` |
| `POST /patients` | Patient without `id` | `{"patient":Patient}` (with generated `id`) |
| `GET /patients/{id}/sessions` | – | `{"sessions":[Session]}` |
| `GET /therapists` | – | `{"therapists":[{"id","name","username"}]}` |
| `POST /therapists/{id}/patients` | `{"patientId"}` | `{"ok":true}` |
| `POST /sessions` | Session without `id` | `{"session":Session}` |

**Patient** – `id, fullName, age, gender, height, weight, occupation, address, hospitalNo,
diagnosis, medicalHistory, surgeryHistory, therapistId` plus the optional fields from the
Medical / Cardiopulmonary / Orthopedic / Neurological tabs (see `src/screens/AddPatient.jsx`).

**Session** – `id, patientId, therapistId, date (YYYY-MM-DD), startedAt, endedAt, mode, speed,
offloading, offloadUnit, offloadKg, bodyWeightKg, durationSec, breaks, steps, squats, distanceM, fallArrests,
vitalsBefore {weight,bp,spo2,hr,notes}, vitalsAfter {bp,spo2,hr}, comments`.

Storage on the cRIO can be as simple as one JSON file per patient under `/home/lvuser/care/`.

## LabVIEW Web Service notes

* URL mappings: `/care/api/status` (GET), `/care/api/command` (POST), `/care/api/patients/:id/sessions`
  etc. Use *Read Request Body* + *Unflatten From JSON* for POST bodies, and set the
  response MIME type to `application/json`.
* If the UI is served by the same Web Service (put `dist/` in the service's *Public Content*
  folder) there are no CORS issues. If the page is served from another host/port, add
  `Access-Control-Allow-Origin: *` and answer `OPTIONS` pre-flight requests.
* Keep `/status` handling non-blocking: read the latest values from an RT FIFO / tag rather than
  waiting on the control loop.
