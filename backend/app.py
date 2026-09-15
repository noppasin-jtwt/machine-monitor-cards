from flask import Flask, jsonify, Response
from flask_cors import CORS
import serial
import json
import threading
import time
from datetime import datetime
from pathlib import Path
import csv

from machine_log import MachineLogger

logger = MachineLogger()

app = Flask(__name__)
CORS(app)

machines = {}


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


def serial_reader():

    ser = serial.Serial(
        "/dev/ttyACM0",
        115200,
        timeout=1
    )

    print("[SYSTEM] Serial Reader Started")

    while True:

        try:

            line = ser.readline().decode(
                errors="ignore"
            ).strip()

            if not line.startswith("{"):
                continue

            print(f"[RX] {line}")

            data = json.loads(line)

            data["last_update"] = (
                datetime.now().isoformat()
            )

            machine_no = data["machine_no"]
            print(f"Stored machine {machine_no}: "
            f"PLC = {data['PLC']}")

            machines[machine_no] = data

            logger.update(
                machine_no,
                data.get("PLC", 0),
                data.get("Emergency", 0),
                data.get("Auto", 0),
                data.get("rssi"),
                data.get("snr")
            )
            time.sleep(10)

        except Exception as e:

            print(
                f"[ERROR] Serial Reader: {e}"
            )


@app.route("/")
def home():

    return jsonify({
        "status": "running",
        "message": "Machine Monitoring Backend"
    })


@app.route("/api/machines")
def get_machines():

    return jsonify(
        list(machines.values())
    )


@app.route("/api/history")
def get_history():
    """Return machine history from CSV files only.

    Reads the bundled historical CSV and any daily CSV files written by
    MachineLogger, then sorts newest first. No database is required.
    """
    project_root = Path(__file__).resolve().parent.parent
    candidates = [project_root / "machine_log.csv"]
    candidates.extend(sorted((Path(__file__).resolve().parent / "logs").glob("machine_log_*.csv")))

    rows_by_key = {}
    for log_file in candidates:
        if not log_file.exists():
            continue
        try:
            with log_file.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.DictReader(f):
                    key = tuple(row.get(k, "") for k in (
                        "timestamp", "machine_no", "machine_name", "event",
                        "plc", "emergency", "auto", "rssi", "snr"
                    ))
                    rows_by_key[key] = {
                        "timestamp": row.get("timestamp", ""),
                        "machine_no": row.get("machine_no", ""),
                        "machine_name": row.get("machine_name", ""),
                        "event": row.get("event", ""),
                        "plc": row.get("plc", ""),
                        "emergency": row.get("emergency", ""),
                        "auto": row.get("auto", ""),
                        "rssi": row.get("rssi", ""),
                        "snr": row.get("snr", ""),
                    }
        except OSError as exc:
            print(f"[ERROR] History CSV: {exc}")

    rows = list(rows_by_key.values())
    rows.sort(key=lambda row: row["timestamp"], reverse=True)
    return jsonify(rows)

@app.route("/api/stream")
def stream():
    def generate():
        while True:
            data = json.dumps(list(machines.values()))
            yield f"data: {data}\n\n"
            time.sleep(0.2)
    return Response(generate(), mimetype="text/event-stream")


if __name__ == "__main__":

    threading.Thread(
        target=serial_reader,
        daemon=True
    ).start()

    app.run(host="0.0.0.0", port=5000)