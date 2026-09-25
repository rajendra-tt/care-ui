"""
CARE 2.0 API server.

Run:   python server/app.py          (listens on http://0.0.0.0:8000)

The UI calls these APIs (see the "System Workflow Software" sheet). Every response is JSON:
    success -> {"status": "success", ...}                         HTTP 200 / 201
    error   -> {"status": "error", "code": "...", "message": "..."}  HTTP 400 / 401 / 404 / 409 / 422

Only the Python standard library is used, so there is nothing to install.
Data is kept in server/care.db (SQLite, CARE 2.0 schema). Delete that file to start again with the demo data.
"""
import json
import sqlite3
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST, PORT = "0.0.0.0", 8000
DB_FILE = Path(__file__).with_name("care.db")
MAX_UNLOAD_KG = 60


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# =============================================================================
# Database (the CARE 2.0 schema)
# =============================================================================
db = sqlite3.connect(DB_FILE, check_same_thread=False)
db.row_factory = sqlite3.Row

db.executescript("""
CREATE TABLE IF NOT EXISTS Device_Data (
    Device_Key VARCHAR(100) PRIMARY KEY,
    Device_Value VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS Therapist (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name VARCHAR(100) NOT NULL,
    Is_Admin INTEGER NOT NULL DEFAULT 0,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS Patient (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name VARCHAR(100) NOT NULL,
    Age INTEGER,
    Gender VARCHAR(20),
    Last_Session_Done_Date DATETIME,
    Is_Active INTEGER NOT NULL DEFAULT 1,
    Added_Date DATETIME,
    Therapist_ID INTEGER,
    FOREIGN KEY (Therapist_ID) REFERENCES Therapist(ID) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS Patient_Therapist_Mapping (
    Patient_ID INTEGER NOT NULL,
    Therapist_ID INTEGER NOT NULL,
    Created_On DATETIME NOT NULL,
    Is_Active INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (Patient_ID, Therapist_ID),
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID) ON DELETE CASCADE,
    FOREIGN KEY (Therapist_ID) REFERENCES Therapist(ID) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS Session_Record (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Session_Date DATETIME NOT NULL,
    Patient_ID INTEGER NOT NULL,
    Therapist_ID INTEGER NOT NULL,
    Session_Data TEXT, Last_Updated DATETIME,
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID) ON DELETE CASCADE,
    FOREIGN KEY (Therapist_ID) REFERENCES Therapist(ID) ON DELETE CASCADE,
    FOREIGN KEY (Patient_ID, Therapist_ID) REFERENCES Patient_Therapist_Mapping(Patient_ID, Therapist_ID)
);
CREATE TABLE IF NOT EXISTS Patient_Questionnaire (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Patient_ID INTEGER NOT NULL,
    Last_Questionnaire_Filled_Date DATETIME,
    Question_1 VARCHAR(255), Question_2 VARCHAR(255), Question_3 VARCHAR(255), Question_4 VARCHAR(255),
    Question_5 VARCHAR(255), Question_6 VARCHAR(255), Question_7 VARCHAR(255), Question_8 VARCHAR(255),
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS Error_Log (
    Error_ID INTEGER PRIMARY KEY,
    Component_Name VARCHAR(100),
    Error_Code VARCHAR(50),
    Error_Description TEXT,
    Date_Time DATETIME
);
CREATE TABLE IF NOT EXISTS System_Log (
    Event_ID INTEGER PRIMARY KEY,
    Session_ID INTEGER,
    Patient_ID INTEGER,
    Therapist_ID INTEGER,
    Event_Details TEXT,
    Date_Time DATETIME,
    Error_ID INTEGER,
    FOREIGN KEY (Session_ID) REFERENCES Session_Record(ID) ON DELETE CASCADE,
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID) ON DELETE CASCADE,
    FOREIGN KEY (Therapist_ID) REFERENCES Therapist(ID) ON DELETE CASCADE,
    FOREIGN KEY (Error_ID) REFERENCES Error_Log(Error_ID)
);
CREATE TABLE IF NOT EXISTS Maintenance_User (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL
);
""")

if not db.execute("SELECT 1 FROM Therapist").fetchone():  # demo data on first run
    db.executemany("INSERT INTO Therapist (Name, Is_Admin, Username, Password) VALUES (?, ?, ?, ?)", [
        ("Admin", 1, "admin", "admin"),
        ("Dr. Preethi", 0, "preethi", "1234"),
        ("Dr. Arjun", 0, "arjun", "1234"),
    ])
    for name, age, gender, therapist in [
        ("Ramesh Kumar", 58, "Male", 2), ("Lakshmi Iyer", 64, "Female", 2), ("Suresh Patil", 45, "Male", 2),
        ("Anita Desai", 39, "Female", 2), ("Mohan Rao", 71, "Male", 3),
    ]:
        cur = db.execute("INSERT INTO Patient (Name, Age, Gender, Added_Date, Therapist_ID) VALUES (?, ?, ?, ?, ?)",
                         (name, age, gender, now(), therapist))
        db.execute("INSERT INTO Patient_Therapist_Mapping (Patient_ID, Therapist_ID, Created_On) VALUES (?, ?, ?)",
                   (cur.lastrowid, therapist, now()))
    db.execute("INSERT INTO Maintenance_User (Username, Password) VALUES ('service', 'service')")
    db.commit()


# =============================================================================
# Device state (what the cRIO would report). One session at a time.
# A copy of the main values is kept in the Device_Data table.
# =============================================================================
device = {
    "session_id": None,
    "state": "idle",            # idle | running | break | estop
    "state_before_estop": "idle",
    "mode": None,               # {"name": "walk", "speed": "Medium"}
    "unloading": {"type": "percentage", "value": "20"},
    "movement": None,
    "body_weight": None,
    "before": {},
    "break_count": 0,
    "run_seconds": 0.0,         # time spent running
    "pause_seconds": 0.0,       # time spent on break / e-stop
    "mode_seconds": {},         # running time per exercise, in the order they were done
    "walk_speeds": [],          # walking speeds used
    "distance_m": 0.0,          # walking distance
    "unload_kg_seconds": 0.0,   # unloading (kg) x running time -> time-weighted average
    "unload_max_kg": None,
    "unload_min_kg": None,
    "since": time.time(),       # when the totals were last brought up to date
}

WALK_SPEED_MPS = {"slow": 0.35, "medium": 0.6, "fast": 0.9}
NEW_SESSION_TOTALS = dict(run_seconds=0.0, pause_seconds=0.0, mode_seconds={}, walk_speeds=[], distance_m=0.0,
                          unload_kg_seconds=0.0, unload_max_kg=None, unload_min_kg=None, break_count=0)


def unloading_kg():
    """Current unloading in kg (a percentage is converted with the session's body weight)."""
    u = device["unloading"] or {}
    try:
        value = float(u.get("value", 0))
    except (TypeError, ValueError):
        return None
    if u.get("type") == "weight":
        return value
    return value / 100 * device["body_weight"] if device["body_weight"] else None


def settle():
    """Add the time since the last update to the session totals. Called before every change of
    state, exercise or unloading, so each total is counted with the values that applied."""
    t = time.time()
    dt = max(0.0, t - device["since"])
    device["since"] = t
    if device["state"] == "running":
        device["run_seconds"] += dt
        mode = device["mode"] or {}
        name = mode.get("name")
        if name:
            device["mode_seconds"][name] = device["mode_seconds"].get(name, 0.0) + dt
        if name == "walk":
            device["distance_m"] += WALK_SPEED_MPS.get(str(mode.get("speed", "slow")).lower(), 0.35) * dt
        kg = unloading_kg()
        if kg is not None and dt > 0:
            device["unload_kg_seconds"] += kg * dt
            device["unload_max_kg"] = kg if device["unload_max_kg"] is None else max(device["unload_max_kg"], kg)
            device["unload_min_kg"] = kg if device["unload_min_kg"] is None else min(device["unload_min_kg"], kg)
    elif device["state"] in ("break", "estop") and device["session_id"]:
        device["pause_seconds"] += dt


def set_state(new_state):
    settle()
    device["state"] = new_state


def set_mode(mode):
    settle()
    device["mode"] = mode
    speed = (mode or {}).get("speed")
    if (mode or {}).get("name") == "walk" and speed and speed not in device["walk_speeds"]:
        device["walk_speeds"].append(speed)


def set_unloading(unloading):
    settle()
    device["unloading"] = unloading


def session_data():
    """The sheet's session_data block (values as strings), plus the report totals."""
    settle()
    run = device["run_seconds"]
    secs = device["mode_seconds"]
    walk, squat = secs.get("walk", 0.0), secs.get("squat", 0.0)
    steps = int(device["distance_m"] / 0.55)
    avg_kg = device["unload_kg_seconds"] / run if run > 0 else unloading_kg()
    bw = device["body_weight"]

    def num(x):
        return "" if x is None else str(round(x, 1))

    def pct(kg):
        return None if kg is None or not bw else kg / bw * 100

    return {
        "session_duration": str(int(run)),
        "steps": str(steps),
        "distance_walked": str(round(device["distance_m"], 1)),
        "balance_time": str(int(secs.get("balance", 0))),
        "walking_time": str(int(walk)),
        "squat_time": str(int(squat)),
        "pause_time": str(int(device["pause_seconds"])),
        "sit_stand_count": str(int(squat / 6)),
        "fall_arrest_count": str(int((walk + squat) / 300)),  # simulated: about one per 5 active minutes
        "break_count": str(device["break_count"]),
        "avg_unloading_kg": num(avg_kg),
        "avg_unloading_percentage": num(pct(avg_kg)),
        "max_unloading_kg": num(device["unload_max_kg"]),
        "min_unloading_kg": num(device["unload_min_kg"]),
        "exercises": [
            {"mode": name, "time": str(int(sec)), "speed": ", ".join(device["walk_speeds"]) if name == "walk" else ""}
            for name, sec in secs.items()
        ],
        "before": device["before"],
        "after": {},
        "comments": "",
    }


# =============================================================================
# Helpers
# =============================================================================
class ApiError(Exception):
    def __init__(self, http_code, code, message):
        super().__init__(message)
        self.http_code, self.code, self.message = http_code, code, message


def need(body, *keys):
    """400 if a required field is missing."""
    for k in keys:
        if body.get(k) in (None, ""):
            raise ApiError(400, "MISSING_FIELD", f"'{k}' is required")


def check_session(body):
    """The request must name the session that is open on the device."""
    need(body, "session_id")
    if device["session_id"] is None:
        raise ApiError(409, "NO_ACTIVE_SESSION", "No session is open")
    if str(body["session_id"]) != str(device["session_id"]):
        raise ApiError(409, "SESSION_MISMATCH", f"Session {body['session_id']} is not the active session")


def check_not_estop():
    if device["state"] == "estop":
        raise ApiError(409, "ESTOP_ACTIVE", "Emergency stop is engaged. Release it first")


def check_unloading(unloading):
    """Never more than 60 kg (as weight, or as a percentage of the body weight)."""
    value = float(unloading.get("value", 0))
    kg = value if unloading.get("type") == "weight" else value / 100 * (device["body_weight"] or 0)
    if value < 0 or kg > MAX_UNLOAD_KG + 1e-6:
        raise ApiError(422, "UNLOADING_LIMIT", f"Unloading is limited to {MAX_UNLOAD_KG} kg")
    return {"type": unloading.get("type"), "value": str(unloading.get("value"))}


def patient_json(row):
    return {"id": row["ID"], "name": row["Name"], "age": row["Age"], "gender": row["Gender"],
            "therapist_id": row["Therapist_ID"], "added_date": row["Added_Date"],
            "last_session_date": row["Last_Session_Done_Date"]}


def save_device():
    """Keep the current device state in Device_Data (one row per key)."""
    for key in ("session_id", "state", "mode", "unloading", "movement"):
        value = device[key]
        if isinstance(value, dict):
            value = json.dumps(value)
        db.execute("INSERT INTO Device_Data (Device_Key, Device_Value) VALUES (?, ?) "
                   "ON CONFLICT(Device_Key) DO UPDATE SET Device_Value = excluded.Device_Value",
                   (key, None if value is None else str(value)))
    db.commit()


def log_event(details, session_id=None):
    """One System_Log row per session event (opened, started, break, e-stop, ...)."""
    sid = session_id or device["session_id"]
    row = db.execute("SELECT Patient_ID, Therapist_ID FROM Session_Record WHERE ID = ?", (sid,)).fetchone() if sid else None
    db.execute("INSERT INTO System_Log (Session_ID, Patient_ID, Therapist_ID, Event_Details, Date_Time) VALUES (?, ?, ?, ?, ?)",
               (sid, row["Patient_ID"] if row else None, row["Therapist_ID"] if row else None, details, now()))
    db.commit()
    save_device()


def log_error(code, description):
    """Server faults go to Error_Log, with a System_Log row pointing at it."""
    cur = db.execute("INSERT INTO Error_Log (Component_Name, Error_Code, Error_Description, Date_Time) VALUES (?, ?, ?, ?)",
                     ("API server", code, description, now()))
    db.execute("INSERT INTO System_Log (Session_ID, Event_Details, Date_Time, Error_ID) VALUES (?, ?, ?, ?)",
               (device["session_id"], "error", now(), cur.lastrowid))
    db.commit()


# Session_Record.Session_Data holds one JSON object:
#   {"status": "open" | "ended", "mode": {...}, "unloading": {...}, "body_weight_kg": 72,
#    "session_duration": "1800", "steps": "1248", ..., "before": {...}, "after": {...}, "comments": "..."}
SESSION_INFO = ("status", "mode", "unloading", "body_weight_kg")


def read_session(session_id):
    row = db.execute("SELECT * FROM Session_Record WHERE ID = ?", (session_id,)).fetchone()
    return row, (json.loads(row["Session_Data"] or "{}") if row else {})


def write_session(session_id, record):
    db.execute("UPDATE Session_Record SET Session_Data = ?, Last_Updated = ? WHERE ID = ?",
               (json.dumps(record), now(), session_id))
    db.commit()


def session_json(row):
    record = json.loads(row["Session_Data"] or "{}")
    return {"session_id": row["ID"], "patient_id": row["Patient_ID"], "therapist_id": row["Therapist_ID"],
            "date": row["Session_Date"], "mode": record.get("mode"), "unloading": record.get("unloading"),
            "body_weight_kg": record.get("body_weight_kg"),
            "session_data": {k: v for k, v in record.items() if k not in SESSION_INFO}}


# =============================================================================
# APIs  (each returns: http_code, response_dict)
# =============================================================================

# ---- Login button --------------------------------------------------------------
def login(body, **_):
    need(body, "username", "password")
    row = db.execute("""
        WITH match AS (
            SELECT Is_Admin FROM Therapist
            WHERE Username = ? AND Password = ?
        )
        SELECT
            CASE
                WHEN NOT EXISTS (SELECT 1 FROM match) THEN 0
                WHEN (SELECT Is_Admin FROM match) = 1 THEN 2
                ELSE 1
            END AS Login_Status""", (body["username"], body["password"])).fetchone()
    status = row["Login_Status"]  # 0 = invalid, 1 = therapist, 2 = admin
    if status == 0:
        return 401, {"status": "error", "code": "INVALID_CREDENTIALS",
                     "message": "Invalid username or password", "login_status": 0}
    t = db.execute("SELECT ID, Name, Username FROM Therapist WHERE Username = ?", (body["username"],)).fetchone()
    return 200, {"status": "success", "login_status": status,
                 "therapist": {"id": t["ID"], "name": t["Name"], "username": t["Username"]}}


# ---- Create Account button (Register) -----------------------------------------
def register(body, **_):
    need(body, "username", "password", "Name")
    if db.execute("SELECT 1 FROM Therapist WHERE Username = ?", (body["username"],)).fetchone():
        raise ApiError(409, "USERNAME_TAKEN", "Username already exists")
    cur = db.execute("INSERT INTO Therapist (Name, Is_Admin, Username, Password) VALUES (?, ?, ?, ?)",
                     (body["Name"], 1 if body.get("is_admin") else 0, body["username"], body["password"]))
    db.commit()
    return 201, {"status": "success", "therapist_id": cur.lastrowid}


# ---- Maintenance login (separate maintenance URL) --------------------------------
def maintenance_login(body, **_):
    need(body, "username", "password")
    row = db.execute("SELECT ID, Username FROM Maintenance_User WHERE Username = ? AND Password = ?",
                     (body["username"], body["password"])).fetchone()
    if not row:
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password")
    return 200, {"status": "success", "maintenance_user": {"id": row["ID"], "username": row["Username"]}}


# ---- Retrieve Patient List ------------------------------------------------------
def list_patients(query, **_):
    if query.get("therapist_id"):
        rows = db.execute("""
            SELECT Patient.*
            FROM Patient
            JOIN Patient_Therapist_Mapping ON Patient.ID = Patient_Therapist_Mapping.Patient_ID
            WHERE Patient_Therapist_Mapping.Therapist_ID = ?
            AND Patient_Therapist_Mapping.Is_Active = 1
            AND Patient.Is_Active = 1""", (query["therapist_id"],)).fetchall()
    else:  # admin: all patients
        rows = db.execute("SELECT * FROM Patient WHERE Is_Active = 1").fetchall()
    return 200, {"status": "success", "patients": [patient_json(r) for r in rows]}


# ---- Select Patient Confirm -----------------------------------------------------
def get_patient(id, **_):
    row = db.execute("SELECT * FROM Patient WHERE ID = ? AND Is_Active = 1", (id,)).fetchone()
    if not row:
        raise ApiError(404, "PATIENT_NOT_FOUND", f"Patient {id} not found")
    return 200, {"status": "success", "Name": row["Name"], "Age": row["Age"], "Gender": row["Gender"],
                 "patient": patient_json(row)}


# ---- Add new patient ------------------------------------------------------------
def add_patient(body, **_):
    need(body, "name", "age", "gender")
    cur = db.execute("INSERT INTO Patient (Name, Age, Gender, Added_Date, Therapist_ID) VALUES (?, ?, ?, ?, ?)",
                     (body["name"], body["age"], body["gender"], now(), body.get("therapist_id")))
    if body.get("therapist_id"):
        db.execute("INSERT INTO Patient_Therapist_Mapping (Patient_ID, Therapist_ID, Created_On) VALUES (?, ?, ?)",
                   (cur.lastrowid, body["therapist_id"], now()))
    db.commit()
    _, response = get_patient(cur.lastrowid)
    return 201, {**response, "patient_id": cur.lastrowid}


# ---- Patient questionnaire ----------------------------------------------------------
def get_questionnaire(id, **_):
    row = db.execute("SELECT * FROM Patient_Questionnaire WHERE Patient_ID = ? ORDER BY ID DESC LIMIT 1", (id,)).fetchone()
    if not row:
        return 200, {"status": "success", "patient_id": int(id), "questionnaire": None}
    return 200, {"status": "success", "patient_id": int(id), "questionnaire": {
        "filled_date": row["Last_Questionnaire_Filled_Date"],
        **{f"question_{i}": row[f"Question_{i}"] for i in range(1, 9)}}}


def save_questionnaire(body, id, **_):
    """Body: {"question_1": "...", ..., "question_8": "..."} (any may be left out)."""
    get_patient(id)  # 404 if the patient does not exist
    cur = db.execute(
        "INSERT INTO Patient_Questionnaire (Patient_ID, Last_Questionnaire_Filled_Date, Question_1, Question_2, "
        "Question_3, Question_4, Question_5, Question_6, Question_7, Question_8) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (id, now(), *[body.get(f"question_{i}") for i in range(1, 9)]))
    db.commit()
    return 201, {"status": "success", "patient_id": int(id), "questionnaire_id": cur.lastrowid}


# ---- Patient history ------------------------------------------------------------
def patient_sessions(id, **_):
    rows = db.execute("""SELECT * FROM Session_Record
                         WHERE Patient_ID = ? AND json_extract(Session_Data, '$.status') = 'ended'
                         ORDER BY Session_Date DESC""", (id,)).fetchall()
    return 200, {"status": "success", "sessions": [session_json(r) for r in rows]}


# ---- Therapists (admin) ---------------------------------------------------------
def list_therapists(**_):
    rows = db.execute("SELECT ID, Name, Username FROM Therapist WHERE Is_Admin = 0").fetchall()
    return 200, {"status": "success", "therapists": [{"id": r["ID"], "name": r["Name"], "username": r["Username"]} for r in rows]}


def assign_patient(body, id, **_):
    need(body, "patient_id")
    pid = body["patient_id"]
    db.execute("UPDATE Patient_Therapist_Mapping SET Is_Active = 0 WHERE Patient_ID = ?", (pid,))
    db.execute("""INSERT INTO Patient_Therapist_Mapping (Patient_ID, Therapist_ID, Created_On, Is_Active) VALUES (?, ?, ?, 1)
                  ON CONFLICT(Patient_ID, Therapist_ID) DO UPDATE SET Is_Active = 1, Created_On = excluded.Created_On""",
               (pid, id, now()))
    db.execute("UPDATE Patient SET Therapist_ID = ? WHERE ID = ?", (id, pid))
    db.commit()
    return 200, {"status": "success"}


# ---- Vitals -> Start Session: open a session, get its session_id -----------------
def open_session(body, **_):
    need(body, "patient_id", "therapist_id", "body_weight_kg")
    if device["state"] in ("running", "break"):
        raise ApiError(409, "SESSION_ACTIVE", "A session is still in progress. End it first")
    record = {"status": "open", "body_weight_kg": float(body["body_weight_kg"]), "before": body.get("before") or {}}
    cur = db.execute("INSERT INTO Session_Record (Session_Date, Patient_ID, Therapist_ID, Session_Data, Last_Updated) "
                     "VALUES (?, ?, ?, ?, ?)",
                     (now(), body["patient_id"], body["therapist_id"], json.dumps(record), now()))
    db.commit()
    device.update(session_id=cur.lastrowid, state="idle", mode=None, movement=None, since=time.time(),
                  body_weight=float(body["body_weight_kg"]), before=body.get("before") or {},
                  unloading={"type": "percentage", "value": "20"}, **NEW_SESSION_TOTALS)
    device["mode_seconds"], device["walk_speeds"] = {}, []
    log_event("session opened")
    return 201, {"status": "success", "session_id": cur.lastrowid}


# ---- Select New Session: lift / movement / unloading -----------------------------
def device_control(body, **_):
    # The admin Device page may jog the device when no session is open (no session_id then).
    maintenance = device["session_id"] is None and not body.get("session_id") and not body.get("unloading")
    if not maintenance:
        check_session(body)
    previous = (device["movement"], device["unloading"])
    if body.get("movement"):
        command = body["movement"].get("command")
        if command != "stop":
            check_not_estop()
            if device["state"] == "running":
                raise ApiError(409, "SESSION_RUNNING", "Movement is locked while the session is running")
        device["movement"] = None if command == "stop" else command
    if body.get("unloading"):
        check_not_estop()
        set_unloading(check_unloading(body["unloading"]))
    if (device["movement"], device["unloading"]) != previous:  # jog commands repeat: log changes only
        u = device["unloading"]
        log_event(f"movement {device['movement'] or 'stop'}, unloading {u['value']} {u['type']}")
    return 200, {"status": "success", "session_id": device["session_id"],
                 "movement": device["movement"], "unloading": device["unloading"]}


# ---- Start Session Confirm ------------------------------------------------------
def session_mode(body, **_):
    check_session(body)
    check_not_estop()
    need(body, "mode")
    if body.get("unloading"):
        set_unloading(check_unloading(body["unloading"]))
    set_mode(body["mode"])
    device["movement"] = None
    if device["state"] == "idle":
        set_state("running")
    log_event(f"session started: {json.dumps(device['mode'])}")
    return 200, {"status": "success", "session_id": device["session_id"], "state": device["state"]}


# ---- On-Going Session Screen (polled by the UI during a session) --------------------
def device_status(**_):
    return 200, {
        "status": "success",
        "session_id": device["session_id"],
        "device": {
            "state": device["state"],
            "mode": device["mode"],
            "unloading": device["unloading"],
            "movement": device["movement"],
            "break_count": str(device["break_count"]),
        },
        "session_data": session_data() if device["session_id"] else None,
    }


# ---- Emergency Stop Pressed (soft_brake: true) / released (false) -------------------
def estop(body, **_):
    need(body, "soft_brake")
    if body["soft_brake"] in (True, "true"):
        if device["state"] != "estop":
            device["state_before_estop"] = device["state"]
            device["movement"] = None
            set_state("estop")
            log_event("e-stop engaged")
    elif device["state"] == "estop":
        # a session that was interrupted comes back on a break, never straight back to running
        was = device["state_before_estop"]
        if was == "running":
            device["break_count"] += 1
        set_state("break" if was in ("running", "break") else "idle")
        log_event("e-stop released")
    return 200, {"status": "success", "session_id": device["session_id"], "state": device["state"]}


# ---- Break button pressed -----------------------------------------------------------
def session_break(body, **_):
    check_session(body)
    check_not_estop()
    if device["state"] != "running":
        raise ApiError(409, "SESSION_NOT_RUNNING", "The session is not running")
    device["break_count"] += 1
    set_state("break")
    log_event("break")
    return 200, {"status": "success", "session_id": device["session_id"], "state": device["state"]}


# ---- Pop-up Resume ------------------------------------------------------------------
def session_resume(body, **_):
    check_session(body)
    check_not_estop()
    if device["state"] != "break":
        raise ApiError(409, "SESSION_NOT_ON_BREAK", "The session is not on a break")
    if body.get("mode"):
        set_mode(body["mode"])
    if body.get("unloading"):
        set_unloading(check_unloading(body["unloading"]))
    set_state("running")
    log_event("resumed")
    return 200, {"status": "success", "session_id": device["session_id"], "state": device["state"]}


# ---- End session ----------------------------------------------------------------------
def session_end(body, **_):
    check_session(body)
    if device["state"] != "break":
        raise ApiError(409, "SESSION_NOT_ON_BREAK", "Take a break before ending the session")
    sid = device["session_id"]
    row, record = read_session(sid)
    data = session_data()
    record.update(data, status="ended", mode=device["mode"], unloading=device["unloading"])
    write_session(sid, record)
    db.execute("UPDATE Patient SET Last_Session_Done_Date = ? WHERE ID = ?", (now(), row["Patient_ID"]))
    db.commit()
    log_event("session ended", sid)
    device.update(session_id=None, state="idle", mode=None, movement=None, body_weight=None, since=time.time())
    save_device()
    row, _ = read_session(sid)
    return 200, {"status": "success", "state": device["state"], **session_json(row)}


# ---- Session report (vitals after + comments) -----------------------------------------
def session_report(body, id, **_):
    row, record = read_session(id)
    if not row or record.get("status") != "ended":
        raise ApiError(404, "SESSION_NOT_FOUND", f"No ended session {id}")
    record["after"] = body.get("after") or {}
    record["comments"] = body.get("comments") or ""
    write_session(id, record)
    return 200, {"status": "success", "session_id": int(id),
                 "session_data": {k: v for k, v in record.items() if k not in SESSION_INFO}}


# =============================================================================
# URL -> API function
# =============================================================================
ROUTES = {
    ("POST", "/api/auth/login"): login,
    ("POST", "/api/therapists/register"): register,
    ("POST", "/api/maintenance/login"): maintenance_login,
    ("GET", "/api/therapists"): list_therapists,
    ("POST", "/api/therapists/{id}/patients"): assign_patient,
    ("GET", "/api/patients"): list_patients,
    ("POST", "/api/patients"): add_patient,
    ("GET", "/api/patients/{id}"): get_patient,
    ("GET", "/api/patients/{id}/sessions"): patient_sessions,
    ("GET", "/api/patients/{id}/questionnaire"): get_questionnaire,
    ("POST", "/api/patients/{id}/questionnaire"): save_questionnaire,
    ("POST", "/api/sessions"): open_session,
    ("POST", "/api/sessions/mode"): session_mode,
    ("POST", "/api/sessions/break"): session_break,
    ("POST", "/api/sessions/resume"): session_resume,
    ("POST", "/api/sessions/end"): session_end,
    ("POST", "/api/sessions/{id}/report"): session_report,
    ("POST", "/api/device/control"): device_control,
    ("GET", "/api/device/status"): device_status,
    ("POST", "/api/device/estop"): estop,
}


def find_route(method, path):
    """Match /api/patients/7 against /api/patients/{id}."""
    parts = path.strip("/").split("/")
    for (m, pattern), fn in ROUTES.items():
        pat = pattern.strip("/").split("/")
        if m != method or len(pat) != len(parts):
            continue
        args = {}
        for p, v in zip(pat, parts):
            if p == "{id}":
                args["id"] = v
            elif p != v:
                break
        else:
            return fn, args
    return None, None


# Each connection gets its own thread, so a browser connection that is open but idle cannot hold
# up the others. The API functions still run one at a time (this lock), so the database and the
# device state are only ever changed by one request at a time.
api_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    timeout = 10  # close connections that send nothing for 10 s

    def do_GET(self):
        self.handle_api("GET")

    def do_POST(self):
        self.handle_api("POST")

    def do_OPTIONS(self):  # browser pre-flight (CORS)
        self.reply(204, None)

    def handle_api(self, method):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        self.print_request(method, raw)
        fn, args = find_route(method, url.path.rstrip("/"))
        try:
            if not fn:
                raise ApiError(404, "NOT_FOUND", f"No API {method} {url.path}")
            try:
                body = json.loads(raw) if raw.strip() else {}
            except json.JSONDecodeError:
                raise ApiError(400, "BAD_JSON", "Request body is not valid JSON")
            query = {k: v[0] for k, v in parse_qs(url.query).items()}
            with api_lock:
                code, response = fn(body=body, query=query, **args)
        except ApiError as e:
            code, response = e.http_code, {"status": "error", "code": e.code, "message": e.message}
        except Exception as e:
            code, response = 500, {"status": "error", "code": "SERVER_ERROR", "message": str(e)}
            with api_lock:
                log_error("SERVER_ERROR", f"{method} {url.path}: {e!r}")
        self.reply(code, response)

    def reply(self, code, response):
        data = json.dumps(response).encode() if response is not None else b""
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(data)

    def print_request(self, method, raw):
        """Print every request and the JSON it carries."""
        if method == "OPTIONS":
            return
        print()
        print(f"[{datetime.now():%H:%M:%S}] {method} {self.path}")
        if raw.strip():
            try:
                print(json.dumps(json.loads(raw), indent=2))
            except ValueError:
                print(f"(not JSON) {raw.decode(errors='replace')}")

    def log_message(self, fmt, *args):
        if self.command != "OPTIONS":
            print(f"  -> HTTP {args[1]}")


if __name__ == "__main__":
    print(f"CARE 2.0 API server on http://{HOST}:{PORT}  (Ctrl+C to stop)")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
