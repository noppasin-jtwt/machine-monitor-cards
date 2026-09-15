import csv
import os
from datetime import datetime

# ============================================================
# MACHINE NAME MAPPING
# ============================================================

MACHINE_NAMES = {
    1: "Supply Bolt Piston [ML]",
    2: "Supply Bolt HS/FW [SL]",
    3: "Supply Head Cover [ML]",
    4: "FW CiRA CORE [SL]",
}


# ============================================================
# MACHINE LOGGER
# ============================================================

class MachineLogger:

    def __init__(self):

        self.previous_status = {}
        self.last_heartbeat = {}

        # Create logs folder automatically

        self.log_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "logs"
        )

        os.makedirs(
            self.log_dir,
            exist_ok=True
        )

    # ========================================================
    # Generate Daily Log File
    # Example:
    # logs/machine_log_2026-09-09.csv
    # ========================================================

    def get_log_file(self):

        current_date = datetime.now().strftime(
            "%Y-%m-%d"
        )

        return os.path.join(
            self.log_dir,
            f"machine_log_{current_date}.csv"
        )

    # ========================================================
    # Write CSV
    # ========================================================

    def write_log(
        self,
        machine_no,
        event,
        plc,
        emergency,
        auto_mode,
        rssi=None,
        snr=None
    ):

        log_file = self.get_log_file()

        file_exists = os.path.exists(log_file)

        machine_name = MACHINE_NAMES.get(
            machine_no,
            f"Machine {machine_no}"
        )

        with open(
            log_file,
            "a",
            newline="",
            encoding="utf-8"
        ) as f:

            writer = csv.writer(f)

            # Create header
            if not file_exists:

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

            writer.writerow([
                datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                machine_no,
                machine_name,
                event,
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            ])

    # ========================================================
    # Heartbeat Control (10 Seconds)
    # ========================================================

    def allow_heartbeat(
        self,
        machine_no
    ):

        now = datetime.now()

        if machine_no not in self.last_heartbeat:

            self.last_heartbeat[machine_no] = now
            return True

        elapsed = (
            now -
            self.last_heartbeat[machine_no]
        ).total_seconds()

        if elapsed >= 10:

            self.last_heartbeat[machine_no] = now
            return True

        return False

    # ========================================================
    # Main Update Function
    # Called whenever a packet is received
    # ========================================================

    def update(
        self,
        machine_no,
        plc,
        emergency,
        auto_mode,
        rssi=None,
        snr=None
    ):

        # ----------------------------------------------------
        # HEARTBEAT
        # Every 10 seconds
        # ----------------------------------------------------

        # if self.allow_heartbeat(machine_no):

        #     self.write_log(
        #         machine_no,
        #         "HEARTBEAT",
        #         plc,
        #         emergency,
        #         auto_mode,
        #         rssi,
        #         snr
        #     )

        # ----------------------------------------------------
        # Get Previous Status
        # ----------------------------------------------------

        previous = self.previous_status.get(
            machine_no
        )

        # First packet
        if previous is None:

            self.write_log(
                machine_no,
                "STARTUP",
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            )

            self.previous_status[machine_no] = {
                "PLC": plc,
                "Emergency": emergency,
                "Auto": auto_mode
            }

            return

        # ----------------------------------------------------
        # PLC Status Changes
        # ----------------------------------------------------

        if previous["PLC"] != plc:

            self.write_log(
                machine_no,
                "PLC_ON" if plc else "PLC_OFF",
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            )

        # ----------------------------------------------------
        # Emergency Changes
        # ----------------------------------------------------

        if previous["Emergency"] != emergency:

            self.write_log(
                machine_no,
                "EMERGENCY_ON"
                if emergency
                else "EMERGENCY_OFF",
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            )

        # ----------------------------------------------------
        # Auto / Manual Changes
        #
        # Your system:
        # Auto=1 -> Manual Mode
        # Auto=0 -> Auto Mode
        # ----------------------------------------------------

        if previous["Auto"] != auto_mode:

            self.write_log(
                machine_no,
                "MANUAL_MODE"
                if auto_mode
                else "AUTO_MODE",
                plc,
                emergency,
                auto_mode,
                rssi,
                snr
            )

        # ----------------------------------------------------
        # Save Current Status
        # ----------------------------------------------------

        self.previous_status[machine_no] = {
            "PLC": plc,
            "Emergency": emergency,
            "Auto": auto_mode
        }
