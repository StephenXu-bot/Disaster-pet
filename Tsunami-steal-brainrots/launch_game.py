import contextlib
import http.server
import json
import socket
import socketserver
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from random import choice, randint
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
START_PORT = 8123
MATCH_TIMEOUT_SECONDS = 5

MATCH_LOCK = threading.Lock()
WAITING_PLAYER = None
BATTLES = {} 
PLAYER_BATTLES = {}

BOT_NAMES = [
    "Online TigerKid",
    "Dragon Lobby Pro",
    "Moon Deer",
    "Boss Farmer",
    "Galaxy Cow",
]

def now() -> float:
    return time.time()

def make_new_player():
    pass

def make_bot_player() -> dict:
    bot_pet = choice(["dragon", "lion", "tiger", "cow","dog"])
    bot_level = randint(8, 26)
    return {
        "id": f"bot-{uuid.uuid4().hex[:8]}",
        "name": choice(BOT_NAMES),
        "petKey": bot_pet,
        "petLabel": bot_pet.title(),
        "level": bot_level,
        "bot": True,
    }


def max_hp(player: dict) -> int:
    return 220 + int(player.get("level", 1)) * 18


def public_battle(battle: dict) -> dict:
    return {
        "battleId": battle["id"],
        "players": battle["players"],
        "hp": battle["hp"],
        "maxHp": battle["maxHp"],
        "turn": battle["turn"],
        "log": battle["log"][-8:],
        "winner": battle.get("winner"),
    }


def create_battle(player_a: dict, player_b: dict) -> dict:
    battle_id = uuid.uuid4().hex
    battle = {
        "id": battle_id,
        "players": [player_a, player_b],
        "hp": {
            player_a["id"]: max_hp(player_a),
            player_b["id"]: max_hp(player_b),
        },
        "maxHp": {
            player_a["id"]: max_hp(player_a),
            player_b["id"]: max_hp(player_b),
        },
        "turn": player_a["id"],
        "log": [f"{player_a['name']} matched with {player_b['name']}."],
        "created": now(),
    }
    BATTLES[battle_id] = battle
    PLAYER_BATTLES[player_a["id"]] = battle_id
    PLAYER_BATTLES[player_b["id"]] = battle_id
    return battle


def apply_attack(battle: dict, attacker_id: str, skill_name: str, damage: int) -> None:
    if battle.get("winner"):
        return
    players = battle["players"]
    attacker = players[0] if players[0]["id"] == attacker_id else players[1]
    defender = players[1] if players[0]["id"] == attacker_id else players[0]
    defender_id = defender["id"]
    final_damage = max(1, int(damage))
    battle["hp"][defender_id] = max(0, battle["hp"][defender_id] - final_damage)
    battle["log"].append(f"{attacker['name']} used {skill_name} for {final_damage}.")
    if battle["hp"][defender_id] <= 0:
        battle["winner"] = attacker_id
        battle["log"].append(f"{attacker['name']} won the pet battle.")
        return
    battle["turn"] = defender_id


def apply_bot_turn(battle: dict) -> None:
    if battle.get("winner"):
        return
    bot = next((player for player in battle["players"] if player.get("bot")), None)
    if not bot or battle["turn"] != bot["id"]:
        return
    skill = choice(["Wild Bite", "Rank Rush", "Tail Break", "Boss Roar"])
    damage = randint(18, 34) + int(bot.get("level", 1)) * randint(2, 4)
    apply_attack(battle, bot["id"], skill, damage)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        return

    def send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/match":
            params = parse_qs(parsed.query)
            player_id = (params.get("playerId") or [""])[0]
            with MATCH_LOCK:
                battle_id = PLAYER_BATTLES.get(player_id)
                if battle_id and battle_id in BATTLES:
                    self.send_json({"status": "matched", "battle": public_battle(BATTLES[battle_id])})
                    return
                global WAITING_PLAYER
                if WAITING_PLAYER and WAITING_PLAYER.get("id") == player_id:
                    if now() - WAITING_PLAYER["queuedAt"] >= MATCH_TIMEOUT_SECONDS:
                        bot = make_bot_player()
                        battle = create_battle(WAITING_PLAYER, bot)
                        WAITING_PLAYER = None
                        self.send_json({"status": "matched", "battle": public_battle(battle)})
                        return
                    self.send_json({"status": "waiting"})
                    return
            self.send_json({"status": "idle"})
            return

        if parsed.path == "/api/battle":
            params = parse_qs(parsed.query)
            battle_id = (params.get("battleId") or [""])[0]
            with MATCH_LOCK:
                battle = BATTLES.get(battle_id)
                if not battle:
                    self.send_json({"error": "Battle not found."}, 404)
                    return
                self.send_json({"battle": public_battle(battle)})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/match":
            payload = self.read_json()
            player = {
                "id": uuid.uuid4().hex,
                "name": str(payload.get("name") or "Player")[:24],
                "petKey": str(payload.get("petKey") or "frog"),
                "petLabel": str(payload.get("petLabel") or "Frog")[:24],
                "level": max(1, int(payload.get("level") or 1)),
                "bot": False,
                "queuedAt": now(),
            }
            with MATCH_LOCK:
                global WAITING_PLAYER
                if WAITING_PLAYER and now() - WAITING_PLAYER["queuedAt"] < 30:
                    waiting = WAITING_PLAYER
                    WAITING_PLAYER = None
                    battle = create_battle(waiting, player)
                    self.send_json({"status": "matched", "playerId": player["id"], "battle": public_battle(battle)})
                    return
                WAITING_PLAYER = player
                self.send_json({"status": "waiting", "playerId": player["id"]})
            return

        if parsed.path == "/api/battle/action":
            payload = self.read_json()
            battle_id = str(payload.get("battleId") or "")
            player_id = str(payload.get("playerId") or "")
            skill_name = str(payload.get("skillName") or "Skill")[:32]
            damage = int(payload.get("damage") or 1)
            with MATCH_LOCK:
                battle = BATTLES.get(battle_id)
                if not battle:
                    self.send_json({"error": "Battle not found."}, 404)
                    return
                if battle.get("winner"):
                    self.send_json({"battle": public_battle(battle)})
                    return
                if battle["turn"] != player_id:
                    self.send_json({"error": "Not your turn.", "battle": public_battle(battle)}, 409)
                    return
                apply_attack(battle, player_id, skill_name, damage)
                apply_bot_turn(battle)
                self.send_json({"battle": public_battle(battle)})
            return

        self.send_json({"error": "Unknown API endpoint."}, 404)


def find_free_port(start_port: int) -> int:
    port = start_port
    while True:
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            try:
                sock.bind((HOST, port))
                return port
            except OSError:
                port += 1


def main() -> None:
    port = find_free_port(START_PORT)
    url = f"http://{HOST}:{port}/"

    with socketserver.ThreadingTCPServer((HOST, port), QuietHandler) as httpd:
        print("Tsunami Steal launcher is running.")
        print(f"Open: {url}")
        print("Pet battle matchmaking is available through this local server.")
        print("Keep this window open while you play. Press Ctrl+C to stop the server.")

        opener = threading.Thread(target=lambda: webbrowser.open(url), daemon=True)
        opener.start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
