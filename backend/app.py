from flask import Flask, jsonify
from flask_cors import CORS
import serial
import json
import threading
from datetime import datetime

from machine_log import EmergencyLogger

logger = EmergencyLogger()
logger.ensure_file()

app = Flask(__name__)
CORS(app)

machines = {}


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


def serial_reader():

    ser = serial.Serial(
        "COM5",
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

            machines[machine_no] = data

            logger.update(
                machine_no,
                data.get("PLC", 0),
                data.get("Emergency", 0),
                data.get("Auto", 0),
                data.get("rssi"),
                data.get("snr")
            )

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


@app.route("/api/emergency-log")
def emergency_log():

    return jsonify({
        "file": "emergency_log.csv"
    })


if __name__ == "__main__":

    threading.Thread(
        target=serial_reader,
        daemon=True
    ).start()

    app.run(host="0.0.0.0", port=5000)