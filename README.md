# Criterion College — Result Management System (Web Service)

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
node server.js
```
Open http://localhost:3000

**Default admin login:** `admin` / `admin123`
> Change this immediately after first login via Settings.

---

## Deploy to Render (Recommended — Free Tier)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. Set `JWT_SECRET` env var to a long random string (Render can generate one)
6. Done — your URL will be `https://criterion-college.onrender.com`

**Persistent disk:** The `render.yaml` includes a 1GB disk mounted at `/data` so your SQLite database survives restarts.

---

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add env var: `JWT_SECRET=your-secret-here`
4. Add a **Volume** and set mount path to `/app/data`
5. Deploy

---

## Migrate Your Existing Data

After deploying:

1. Visit `https://your-app-url.com/migrate.html`
2. Follow the 3-step instructions on that page
3. Your students, results, and settings will be imported
4. The migration page stays available but only works with admin credentials

---

## User Roles

| Role | Can Do |
|------|--------|
| **Admin** | Everything — students, results, settings, batch print, manage teachers |
| **Teacher** | Enter scores for any class only |

### Creating Teacher Accounts
Login as admin → click **Teachers** in sidebar → Add Teacher

---

## File Structure

```
criterion-college/
├── server.js          ← Express API server
├── db.js              ← SQLite database layer
├── package.json
├── render.yaml        ← Render deployment config
├── railway.toml       ← Railway deployment config
├── .env.example       ← Environment variable template
├── data/              ← SQLite database (auto-created, gitignored)
└── public/            ← Frontend (served as static files)
    ├── index.html
    ├── app.js         ← Main app logic
    ├── api.js         ← API client (replaces localStorage)
    ├── data.js        ← Constants (classes, subjects, grades)
    ├── print.js       ← Standard result print template
    ├── creche_print.js← Creche result print template
    ├── logo.js        ← School logo (base64)
    ├── styles.css
    ├── theme.js
    └── migrate.html   ← One-time data migration tool
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ Yes | Secret key for JWT tokens — use a long random string |
| `PORT` | No | Server port (default: 3000) |
| `DB_PATH` | No | Path to SQLite file (default: `./data/criterion.db`) |

---

## Backup

Your data is in `data/criterion.db` — a single SQLite file. Back it up by downloading it from your server.

On Render: Settings → Disks → Download.
