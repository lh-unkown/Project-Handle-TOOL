import http.server
import socketserver
import json
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(DIRECTORY, "data")
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")

os.makedirs(DATA_DIR, exist_ok=True)

# Default initial users if file doesn't exist
DEFAULT_USERS = [
    {"id": "u_1", "username": "admin", "password": "admin123", "fullName": "IT System Admin", "role": "admin"},
    {"id": "u_2", "username": "user", "password": "user123", "fullName": "IT Staff Member", "role": "user"}
]

if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(DEFAULT_USERS, f, indent=2)

class ITProjectServer(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/api/projects':
            self.send_json_response(self.read_file_data(PROJECTS_FILE, []))
        elif self.path == '/api/users':
            users = self.read_file_data(USERS_FILE, DEFAULT_USERS)
            # Remove password field before returning
            safe_users = [{k: v for k, v in u.items() if k != 'password'} for u in users]
            self.send_json_response(safe_users)
        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        if self.path == '/api/login':
            try:
                creds = json.loads(post_data.decode('utf-8'))
                username = creds.get('username', '').strip()
                password = creds.get('password', '').strip()

                users = self.read_file_data(USERS_FILE, DEFAULT_USERS)
                user = next((u for u in users if u['username'] == username and u['password'] == password), None)

                if user:
                    safe_user = {k: v for k, v in user.items() if k != 'password'}
                    self.send_json_response({"status": "success", "user": safe_user})
                else:
                    self.send_json_response({"status": "error", "message": "Invalid username or password"}, status=401)
            except Exception as e:
                self.send_json_response({"status": "error", "message": str(e)}, status=400)

        elif self.path == '/api/projects':
            try:
                projects_json = json.loads(post_data.decode('utf-8'))
                with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(projects_json, f, indent=2)
                self.send_json_response({"status": "success", "message": "Projects saved to server disk"})
            except Exception as e:
                self.send_json_response({"status": "error", "message": str(e)}, status=500)

        elif self.path == '/api/users':
            try:
                new_user = json.loads(post_data.decode('utf-8'))
                users = self.read_file_data(USERS_FILE, DEFAULT_USERS)
                
                # Check duplicate username
                if any(u['username'] == new_user.get('username') for u in users):
                    self.send_json_response({"status": "error", "message": "Username already exists"}, status=400)
                    return

                new_user['id'] = f"u_{len(users) + 1}"
                users.append(new_user)

                with open(USERS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(users, f, indent=2)

                self.send_json_response({"status": "success", "message": "User created successfully"})
            except Exception as e:
                self.send_json_response({"status": "error", "message": str(e)}, status=500)
        else:
            self.send_response(404)
            self.end_headers()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def read_file_data(self, file_path, default_val):
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return default_val
        return default_val

def main():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), ITProjectServer) as httpd:
        print(f"IT Project Server with Authentication running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main()
