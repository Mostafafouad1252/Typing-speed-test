import os
import random
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "typing_app.db"

TEXTS_BY_DIFFICULTY = {
    "easy": [
        "Cats sleep in sunny spots and wake up ready to play.",
        "I drink water every day and take short walks outside.",
        "Typing slowly with care helps you make fewer mistakes.",
        "The blue bird sat on a tree and sang all morning.",
        "Good habits become easier when you practice each day.",
    ],
    "medium": [
        "Learning to type well takes patience, rhythm, and many short focused practice sessions.",
        "A steady pace often produces better results than rushing through every sentence too quickly.",
        "Clear goals help you measure progress and stay motivated when your speed improves week by week.",
        "When your fingers know the keyboard layout, your eyes can stay focused on the text sample.",
        "Regular practice with accurate keystrokes builds confidence for coding, writing, and daily communication.",
    ],
    "hard": [
        "Professional developers improve productivity by combining accuracy, consistency, and deliberate practice under timed constraints.",
        "The most effective training routine balances short intense sessions with reflective reviews of common typing mistakes.",
        "Complex technical writing requires concentration, punctuation precision, and sustained rhythm across varied sentence structures.",
        "Performance gains become measurable when you monitor words per minute, error rate, and long-term improvement trends.",
        "Mastery emerges when disciplined repetition transforms difficult finger movements into reliable and automatic keyboard patterns.",
    ],
}


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")

    init_db()

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        if len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        hashed = generate_password_hash(password)
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, hashed),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists."}), 409
        finally:
            conn.close()

        return jsonify({"message": "Registration successful."}), 201

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        conn = get_db()
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        conn.close()

        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid username or password."}), 401

        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({"message": "Login successful.", "username": user["username"]})

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify({"message": "Logged out."})

    @app.get("/api/me")
    def me():
        username = session.get("username")
        return jsonify({"logged_in": bool(username), "username": username})

    @app.get("/api/text")
    def get_text():
        if not session.get("user_id"):
            return jsonify({"error": "Unauthorized"}), 401

        difficulty = (request.args.get("difficulty") or "medium").lower()
        if difficulty not in TEXTS_BY_DIFFICULTY:
            difficulty = "medium"

        text = random.choice(TEXTS_BY_DIFFICULTY[difficulty])
        return jsonify({"difficulty": difficulty, "text": text})

    return app


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
