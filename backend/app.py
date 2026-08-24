from flask import Flask, jsonify
from flask_cors import CORS
import serial
import json
import threading
from datetime import datetime

app = Flask(__name__)
CORS(app)

machines = {}

def serial_reader():

    ser = serial.Serial(
        "COM5",
        115200,
        timeout=1
    )

    while True:

        try:

            line = ser.readline().decode().strip()

            if not line.startswith("{"):
                continue

            data = json.loads(line)

            data["last_update"] = datetime.now().isoformat()

            machines[data["machine_no"]] = data

        except Exception as e:
            print(e)


@app.route("/api/machines")
def get_machines():

    return jsonify(
        list(machines.values())
    )

@app.route("/")
def home():
    return jsonify({
        "status": "running",
        "message": "Machine Monitoring Backend"
    })


if __name__ == "__main__":

    threading.Thread(
        target=serial_reader,
        daemon=True
    ).start()

    app.run(port=5000)