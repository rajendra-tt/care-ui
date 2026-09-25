# CARE 2.0 API

The UI (client) calls these APIs. The server answers them.

* Server code: `server/app.py`. Start it with `python server/app.py` (port 8000, standard library only).
* Client code: `src/services/crioHttp.js`.
* The endpoints and formats follow the **"System Workflow Software"** sheet. Rows marked *(added)* are not in the sheet yet but the UI needs them.

## Responses

Every response is JSON with `status`:

```json
{ "status": "success", "...": "data" }
{ "status": "error", "code": "ESTOP_ACTIVE", "message": "Emergency stop is engaged. Release it first" }
```

| HTTP | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Missing field or invalid JSON (`MISSING_FIELD`, `BAD_JSON`) |
| 401 | Wrong username or password (`INVALID_CREDENTIALS`, `login_status: 0`) |
| 404 | Not found (`PATIENT_NOT_FOUND`, `SESSION_NOT_FOUND`, `NOT_FOUND`) |
| 409 | Not allowed right now (`ESTOP_ACTIVE`, `SESSION_RUNNING`, `SESSION_ACTIVE`, `NO_ACTIVE_SESSION`, `SESSION_MISMATCH`, `SESSION_NOT_RUNNING`, `SESSION_NOT_ON_BREAK`, `USERNAME_TAKEN`) |
| 422 | Unloading above 60 kg (`UNLOADING_LIMIT`) |

The UI shows `message` to the therapist.

## APIs

| UI event | API | Request | Success response |
|---|---|---|---|
| Login button | `POST /api/auth/login` | `{"username","password"}` | `{"login_status": 1 therapist / 2 admin, "therapist": {"id","name","username"}}` |
| Create account | `POST /api/therapists/register` | `{"username","password","is_admin","Name"}` | `201 {"therapist_id"}` |
| Patient list | `GET /api/patients?therapist_id=2` | – (no query = all patients) | `{"patients": [{"id","name","age","gender","therapist_id","added_date","last_session_date"}]}` |
| Select patient | `GET /api/patients/{id}` | – | `{"Name","Age","Gender","patient": {...}}` |
| Add patient *(added)* | `POST /api/patients` | `{"name","age","gender","therapist_id"}` | `201 {"patient_id","patient"}` |
| Questionnaire *(added)* | `GET` / `POST /api/patients/{id}/questionnaire` | POST: `{"question_1" … "question_8"}` | GET: latest answers + `filled_date`; POST: `201 {"questionnaire_id"}` |
| Maintenance login *(added)* | `POST /api/maintenance/login` | `{"username","password"}` | `{"maintenance_user": {"id","username"}}` (401 if wrong) |
| Patient history *(added)* | `GET /api/patients/{id}/sessions` | – | `{"sessions": [{"session_id","date","mode","unloading","session_data"}]}` |
| Therapist list *(added)* | `GET /api/therapists` | – | `{"therapists": [{"id","name","username"}]}` |
| Assign patient *(added)* | `POST /api/therapists/{id}/patients` | `{"patient_id"}` | `{}` |
| Vitals → Start Session *(added)* | `POST /api/sessions` | `{"patient_id","therapist_id","body_weight_kg","before":{"bp","heart_rate","spo2"}}` | `201 {"session_id"}` |
| Lift, movement, unloading | `POST /api/device/control` | `{"session_id","movement":{"command"},"unloading":{"type","value"}}` | `{"session_id","movement","unloading"}` |
| Start Session confirm | `POST /api/sessions/mode` | `{"session_id","mode":{"name","speed"},"unloading":{"type","value"}}` | `{"session_id","state":"running"}` |
| During a session (polled every 250 ms) | `GET /api/device/status` | – | see below |
| Emergency stop | `POST /api/device/estop` | `{"session_id","soft_brake": true}` (`false` = release) | `{"session_id","state"}` |
| Break | `POST /api/sessions/break` | `{"session_id","break": true}` | `{"session_id","state":"break"}` |
| Resume | `POST /api/sessions/resume` | `{"session_id","mode","unloading"}` (mode and unloading optional) | `{"session_id","state":"running"}` |
| End session *(added)* | `POST /api/sessions/end` | `{"session_id"}` | the finished session, as in history, plus `"state":"idle"` |
| Session report *(added)* | `POST /api/sessions/{id}/report` | `{"after":{"bp","heart_rate","spo2"},"comments"}` | `{"session_id","session_data"}` |

**Field values:**
* `movement.command`: `patient_up`, `patient_down`, `device_forward`, `device_backward`, `device_left`, `device_right`, or `stop`. While a button is held, the UI re-sends the command every 150 ms and sends `stop` when it is released.
* `unloading.type`: `weight` (kg) or `percentage` (of `body_weight_kg`).
* `mode.name`: `balance`, `squat` or `walk`. `mode.speed`: `Slow`, `Medium` or `Fast`.

### `GET /api/device/status`

```json
{ "status": "success", "session_id": 17,
  "device": { "state": "running", "mode": { "name": "walk", "speed": "Medium" },
              "unloading": { "type": "percentage", "value": "20" }, "movement": null, "break_count": "1" },
  "session_data": { "session_duration": "1800", "steps": "1248", "distance_walked": "685", "balance_time": "420",
                    "walking_time": "900", "squat_time": "120", "pause_time": "480", "sit_stand_count": "18",
                    "fall_arrest_count": "1", "break_count": "1",
                    "avg_unloading_kg": "17.3", "avg_unloading_percentage": "24", "max_unloading_kg": "21.6", "min_unloading_kg": "14.4",
                    "exercises": [ { "mode": "balance", "time": "420", "speed": "" },
                                   { "mode": "walk", "time": "900", "speed": "Medium" },
                                   { "mode": "squat", "time": "120", "speed": "" } ],
                    "before": { "bp": "128/82", "heart_rate": "76", "spo2": "98" }, "after": {}, "comments": "" } }
```

**Report fields.** They cover the whole session, including changes of exercise or unloading part-way through:
* `balance_time`, `walking_time`, `squat_time`: running seconds spent in each exercise.
* `exercises`: the exercises in the order they were done. For walking, `speed` lists the speeds used.
* `pause_time`: seconds spent on a break or E-stopped.
* `avg_unloading_kg` / `avg_unloading_percentage`: unloading averaged over running time, so each set-point counts for as long as it applied.
* `max_unloading_kg`, `min_unloading_kg`: the highest and lowest unloading while running.

In the Python server, steps, distance, sit-to-stand and fall arrests are simulated. The cRIO must report its real values.

The UI calls this **only during a session**: every 250 ms while the Device Control or Session screen is open, from Vitals → Start Session until End session. It is not called on any other screen. Outside a session, the UI takes the state from each command's reply: E-stop, break, resume, start and end all return `"state"`.

`device.state` tells the UI which screen to show:
* `idle`: select mode;
* `running`: the ongoing session;
* `break`: the break screen;
* `estop`: the E-stop pop-up.

`session_id` and `session_data` are `null` when no session is open.

## Rules the server applies

* **Session.** A session must be opened with `POST /api/sessions` first. Later calls must send its `session_id`.
* **Unloading.** Never more than 60 kg. For example, 84 % of 72 kg is refused.
* **Movement.**
  * Lift and movement are refused while the session is running (take a break first).
  * `stop` is always accepted.
  * The admin Device page may send movement without a `session_id` when no session is open.
* **E-stop.**
  * While it is engaged, movement, unloading, start, break and resume are refused.
  * Releasing it goes to `break` if a session was active (never straight back to running); otherwise it goes to `idle`.
* **End session.** Only allowed from `break`.

## On the real cRIO

The LabVIEW Web Service must answer the same URLs with the same JSON. It must also, independently of the UI:
* stop motion if jog commands stop arriving (about 450 ms);
* limit unloading to 60 kg in the actuator;
* have a hard-wired E-stop. The on-screen E-stop is not the safety function.

## Database (server/care.db)

The server uses the CARE 2.0 schema and creates the tables on first start.

| Table | What the server stores |
|---|---|
| `Therapist` | Therapist and admin accounts (login, register). |
| `Patient` | Name, age, gender and therapist. `Added_Date` is set on registration; `Last_Session_Done_Date` is set at End session. |
| `Patient_Therapist_Mapping` | Which therapist a patient is assigned to (`Is_Active = 1` for the current one). |
| `Session_Record` | One row per session. `Session_Data` is a JSON object: `status` (`open` / `ended`), `mode`, `unloading`, `body_weight_kg`, the `session_data` counters, `before`, `after` and `comments`. |
| `Patient_Questionnaire` | Answers to the 8 questions (one row per time it is filled in). |
| `Device_Data` | The current device values: `session_id`, `state`, `mode`, `unloading`, `movement`. |
| `System_Log` | One row per session event: opened, movement/unloading change, started, break, resumed, e-stop, ended. |
| `Error_Log` | Server faults (HTTP 500), each linked from a `System_Log` row. |
| `Maintenance_User` | Maintenance logins (demo: `service` / `service`). |

The schema has no height, weight or diagnosis columns for a patient. The body weight is entered in the vitals at every session and saved in that session's `Session_Data`. The extra fields on the New Patient form are sent but not stored.
