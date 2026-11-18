import json
import os
import signal
import subprocess
import sys
import tempfile
import threading


class ExtractionModel:
    def __init__(self):
        self.slot = threading.BoundedSemaphore(1)

    def extract(self, path: str, kind: str) -> dict:
        # One parser/OCR plus health requests; no unbounded request queue in the worker.
        if not self.slot.acquire(blocking=False):
            return {"errorCode": "PROCESSOR_BUSY"}
        try:
            with tempfile.TemporaryDirectory(prefix="siare-result-") as directory:
                output = os.path.join(directory, "result.json")
                process = subprocess.Popen([sys.executable, "-m", "app.models.extraction_worker", path, kind, output],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                           start_new_session=sys.platform != "win32")
                try:
                    process.wait(timeout=25)
                except subprocess.TimeoutExpired:
                    if sys.platform != "win32":
                        os.killpg(process.pid, signal.SIGKILL)
                    else:
                        process.kill()
                    process.wait()
                    return {"errorCode": "EXTRACTION_TIMEOUT"}
                if process.returncode != 0 or not os.path.isfile(output):
                    return {"errorCode": "UNSAFE_DOCUMENT"}
                with open(output, "rb") as result:
                    data = result.read(8 * 1024 * 1024 + 1)
                    if len(data) > 8 * 1024 * 1024:
                        return {"errorCode": "TEXT_LIMIT"}
                return json.loads(data)
        finally:
            self.slot.release()
