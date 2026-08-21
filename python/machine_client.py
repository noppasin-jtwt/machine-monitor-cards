"""
Machine Calling System — Python data feeder.

Sends live machine status to the dashboard. Run it on the PC / gateway that
reads your PLC or LoRa receiver.

    pip install requests
    python machine_client.py

Status logic handled by the dashboard:
    GREEN  = plc 1, bolt 0, cylinder 0, emergency 0
    RED    = plc 0 OR bolt 1 OR cylinder 1 OR emergency 1
    GRAY   = no update received for more than 30 seconds
"""

import random
import time

import requests

# Preview URL. Use the published URL once you publish the app.
BASE_URL = "https://project--06b5a8f3-02cd-4e55-b800-fbea2dbc85fc-dev.lovable.app"
ENDPOINT = f"{BASE_URL}/api/public/machine-status"

# Copy this from your project's secrets (MACHINE_INGEST_KEY).
API_KEY = "PASTE_YOUR_MACHINE_INGEST_KEY_HERE"

SEND_INTERVAL_SECONDS = 5


def send_status(
    machine_id: int,
    plc: int,
    bolt: int,
    cylinder: int,
    emergency: int,
    rssi: float | None = None,
    snr: float | None = None,
    line: str | None = None,
) -> None:
    payload = {
        "machine_id": machine_id,
        "plc": plc,
        "bolt": bolt,
        "cylinder": cylinder,
        "emergency": emergency,
    }
    if rssi is not None:
        payload["rssi"] = rssi
    if snr is not None:
        payload["snr"] = snr
    if line is not None:
        payload["line"] = line

    response = requests.post(
        ENDPOINT,
        json=payload,
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        timeout=10,
    )
    print(machine_id, response.status_code, response.text)


def read_machine(machine_id: int) -> dict:
    """Replace this with your real PLC / serial / Modbus / MQTT read."""
    fault = random.random() < 0.1
    return {
        "plc": 0 if fault and random.random() < 0.3 else 1,
        "bolt": 1 if fault and random.random() < 0.4 else 0,
        "cylinder": 1 if fault and random.random() < 0.4 else 0,
        "emergency": 0,
        "rssi": round(random.uniform(-85, -55), 1),
        "snr": round(random.uniform(3, 12), 1),
    }


def main() -> None:
    while True:
        for machine_id in range(1, 10):
            reading = read_machine(machine_id)
            try:
                send_status(machine_id, **reading)
            except requests.RequestException as exc:
                print(f"machine {machine_id} send failed: {exc}")
        time.sleep(SEND_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
