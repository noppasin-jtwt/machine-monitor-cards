import csv
import os
from datetime import datetime

EMERGENCY_LOG_FILE = "emergency_log.csv"
MACHINE_LOG_FILE = "machine_log.csv"

MACHINE_NAMES = {
    1: "Supply Bolt HS/FW [SL]",
    2: "Supply Bolt Piston [ML]",
    3: "Supply Head Cover [ML]",
    4: "FW CiRA CORE [SL]",
}


class EmergencyLogger:

    def __init__(self):

        self.states = {}
        self.previous_status = {}

    def ensure_file(self):

        if not os.path.exists(EMERGENCY_LOG_FILE):

            with open(
                EMERGENCY_LOG_FILE,
                "w",
                newline="",
                encoding="utf-8"
            ) as f:

                writer = csv.writer(f)

                writer.writerow([
                    "machine_no",
                    "machine_name",
                    "event",
                    "start_time",
                    "end_time",
                    "duration_seconds",
                    "duration_minutes"
                ])

        if not os.path.exists(MACHINE_LOG_FILE):

            with open(
                MACHINE_LOG_FILE,
                "w",
                newline="",
                encoding="utf-8"
            ) as f:

                writer = csv.writer(f)

                writer.writerow([
                    "timestamp",
                    "machine_no",
                    "machine_name",
                    "event",
                    "plc",
                    "emergency",
                    "auto",
                    "rssi",
                    "snr"
                ])

    def write_machine_log(
        self,
        machine_no,
        event,
        plc,
        emergency,
        auto_mode,
        rssi=None,
        snr=None
    ):

        machine_name = MACHINE_NAMES.get(
            machine_no,
            f"Machine {machine_no}"
        )

        timestamp = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        with open(
            MACHINE_LOG_FILE,
            "a",
            newline="",
            encoding="utf-8"
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                timestamp,
                machine_no,
                machine_name,
                event,
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            ])

    def emergency_on(self, machine_no):

        if machine_no in self.states:
            return

        self.states[machine_no] = {
            "start_time": datetime.now()
        }

        print(
            f"[EMERGENCY START] "
            f"Machine {machine_no}"
        )

    def emergency_off(self, machine_no):

        if machine_no not in self.states:
            return

        start_time = self.states[machine_no]["start_time"]

        end_time = datetime.now()

        duration_seconds = int(
            (end_time - start_time).total_seconds()
        )

        duration_minutes = round(
            duration_seconds / 60,
            2
        )

        machine_name = MACHINE_NAMES.get(
            machine_no,
            f"Machine {machine_no}"
        )

        with open(
            EMERGENCY_LOG_FILE,
            "a",
            newline="",
            encoding="utf-8"
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                machine_no,
                machine_name,
                "Emergency",
                start_time.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                end_time.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                duration_seconds,
                duration_minutes
            ])

        print(
            f"[EMERGENCY END] "
            f"Machine {machine_no} "
            f"Duration: {duration_seconds}s"
        )

        del self.states[machine_no]

    def update(
        self,
        machine_no,
        plc,
        emergency,
        auto_mode,
        rssi=None,
        snr=None
    ):

        # ---------------------------
        # Always log heartbeat
        # ---------------------------

        self.write_machine_log(
            machine_no,
            "HEARTBEAT",
            plc,
            emergency,
            auto_mode,
            rssi,
            snr
        )

        previous = self.previous_status.get(
            machine_no
        )

        if previous:

            if (
                previous["PLC"] == 0 and
                plc == 1
            ):
                self.write_machine_log(
                    machine_no,
                    "PLC_ON",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

            if (
                previous["PLC"] == 1 and
                plc == 0
            ):
                self.write_machine_log(
                    machine_no,
                    "PLC_OFF",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

            if (
                previous["Auto"] == 0 and
                auto_mode == 1
            ):
                self.write_machine_log(
                    machine_no,
                    "MANUAL_MODE",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

            if (
                previous["Auto"] == 1 and
                auto_mode == 0
            ):
                self.write_machine_log(
                    machine_no,
                    "AUTO_MODE",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

            if (
                previous["Emergency"] == 0 and
                emergency == 1
            ):
                self.write_machine_log(
                    machine_no,
                    "EMERGENCY_ON",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

                self.emergency_on(machine_no)

            if (
                previous["Emergency"] == 1 and
                emergency == 0
            ):
                self.write_machine_log(
                    machine_no,
                    "EMERGENCY_OFF",
                    plc,
                    emergency,
                    auto_mode,
                    rssi,
                    snr
                )

                self.emergency_off(machine_no)

        self.previous_status[machine_no] = {
            "PLC": plc,
            "Emergency": emergency,
            "Auto": auto_mode
        }