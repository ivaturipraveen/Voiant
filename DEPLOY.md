# Deploying Voiant to Render

Two services, added manually in the Render dashboard: a **FastAPI backend** (Python web
service) and a **Vite frontend** (static site).

## Prerequisites
- A Render account and the Render **Postgres** instance (you already have its external URL).
- Your `ANTHROPIC_API_KEY`.

---

### 1. Backend (Web Service)
- **Root Directory:** `backend`
- **Runtime:** Python 3 · add env var `PYTHON_VERSION = 3.12.13`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`
- **Environment variables:**
  | Key | Value |
  |---|---|
  | `ANTHROPIC_API_KEY` | *(your key)* |
  | `VOIANT_DATA_SOURCE` | `database` |
  | `VOIANT_DATABASE_URL` | *(Render Postgres **external** URL)* |
  | `VOIANT_DB_QUERY` | `reps` |
  | `BRIGHT_SHIELD_BASE_URL` | `https://36owxpb34jb9et-8000.proxy.runpod.net` |
  | `BRIGHT_SHIELD_ENABLED` | `true` |
  | `VOIANT_FRONTEND_ORIGIN` | *(the frontend URL, set after step 2)* |

  Deploy → note the backend URL.

## 2. Frontend (Static Site)
- **Root Directory:** `frontend`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Environment variable:** `VITE_API_BASE = https://<your-backend>.onrender.com`
- **Redirect/Rewrite rule** (for the SPA): source `/*` → destination `/index.html` → **Rewrite**.

  Deploy → note the frontend URL, then set it as `VOIANT_FRONTEND_ORIGIN` on the backend and redeploy.

---

## Verify
- `https://<backend>/health` → `{"status":"ok", ... "dataset":{"rep_count":80}}`
- Open the frontend URL → ask a question → the answer + technical trace render.

## Notes
- The backend reads all config from env vars (no `.env` needed in prod).
- `VOIANT_DATABASE_URL` accepts `postgresql://…`; it's normalized to `postgresql+psycopg2://…` automatically.
- To swap clients/data later, only the env vars change — no code change.
