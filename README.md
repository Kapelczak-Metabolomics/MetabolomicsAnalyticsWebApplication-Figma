# MetaboAnalytics

A full-stack metabolomics analytics web application built from the [Figma design](https://www.figma.com/design/1cVP5kY52DbSAFK5wKhPAm/metabolomics-analytics-web-application), with a React frontend, Express API, and PostgreSQL database.

## Quick Start (Docker)

The easiest way to run the entire stack:

```bash
docker compose up --build
```

Then open **http://localhost:47821** and sign in with:

- **Email:** `sarah.chen@university.edu`
- **Password:** `password123`

Docker Compose starts four services on **non-standard ports** (47821–47824) to avoid conflicts with common local services such as 3000, 5173, 5432, and 8080.

| Service | Description | Host port |
|---------|-------------|-----------|
| `db` | PostgreSQL 16 with persistent volume | **47823** |
| `python` | FastAPI — mzXML import (pymzML) and analysis engine (scikit-learn, scipy) | **47824** |
| `api` | Express API — auto-creates schema and seeds data on first run | **47822** |
| `web` | Nginx serving the React app and proxying `/api` | **47821** |

The database is automatically initialized when the API starts: tables are created, and seed data (users, projects, datasets, metabolite features, experiments, notifications) is inserted on first boot.

## Deploy on EasyPanel

Use `docker-compose.easypanel.yml` for one-click deployment on [EasyPanel](https://easypanel.io):

1. In EasyPanel, create a **Project** → **Services** → **Compose (Beta)**
2. Connect this GitHub repository
3. Set the compose file path to **`docker-compose.easypanel.yml`**
4. Edit the compose file and replace these placeholders before deploying:
   - `CHANGE_ME_DB_PASSWORD` — PostgreSQL password (use the same value in `DATABASE_URL`)
   - `CHANGE_ME_JWT_SECRET` — long random string for JWT signing
5. Click **Deploy** and wait for all four services to become healthy (~2–3 minutes on first run)
6. Open the **web** service → **Domains** → add your domain with **proxy port 80**
7. EasyPanel provisions HTTPS automatically via Let's Encrypt

Only the **web** (nginx) service is exposed on port 80. The API and database communicate on the internal Docker network. Sign in at your domain with `sarah.chen@university.edu` / `password123`.

## Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL 16

### Database

```bash
createdb metaboanalytics
export DATABASE_URL=postgresql://localhost:47823/metaboanalytics
```

### API Server

```bash
cd server
npm install
npm run dev
```

The API runs on http://localhost:47822 and seeds the database automatically.

### Python Analysis Service (optional for local dev)

```bash
cd python
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 47824
```

Set `PYTHON_SERVICE_URL=http://127.0.0.1:47824` and `USE_PYTHON_ANALYSIS=true` when running the API locally to use Python for analysis and mzXML parsing.

### Frontend

```bash
npm install   # or: pnpm install
npm run dev
```

The Vite dev server proxies `/api` requests to the backend.

## mzXML Import

1. Sign in and open **Data → Import**
2. Select **mzXML** format
3. Upload one or more `.mzxml` / `.xml` files (or a `.zip` archive)
4. Assign sample groups, then start import
5. The API uploads files to the Python service, parses MS1 spectra, and loads the feature matrix into PostgreSQL
6. Poll import status until the dataset is **ready**, then run analyses as usual

Each mzXML file becomes one sample; features are binned m/z values with summed intensities.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser   │────▶│  Nginx/web  │────▶│  Express API │────▶│ Python svc   │
│  (React)    │     │   :47821    │     │    :47822    │     │   :47824     │
└─────────────┘     └─────────────┘     └──────┬───────┘     └──────────────┘
                                               │
                                        ┌──────▼───────┐
                                        │  PostgreSQL  │
                                        │    :47823    │
                                        └──────────────┘
```

Analysis runs prefer the Python service when available (`USE_PYTHON_ANALYSIS=true`); the Express API falls back to its TypeScript implementations if Python is unreachable.

## Features

- JWT authentication with role-based access (Administrator, Researcher, Analyst)
- Project and dataset management backed by PostgreSQL
- **mzXML import** — upload raw LC-MS files; Python parses MS1 spectra into m/z feature matrices
- CSV and mzXML dataset import with background processing and status polling
- Real metabolomics feature statistics computed from stored sample data
- Analysis runs (PCA, Volcano, Clustering, PLS-DA, Pathway, Biomarker) via Python with TypeScript fallback
- Interactive plots (Recharts) with **SVG/PNG export** for publication-ready figures
- Notifications, audit logs, and admin panel with live data
- All analysis metrics computed from stored sample data (Python sklearn/scipy with TypeScript fallback)

## Data & seeding

On first boot the API creates schema and seeds **minimal** data: user accounts and an empty starter project.

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_DEMO_DATA` | `true` in Docker | When `true`, loads a **deterministic** reference metabolomics matrix (not random) with pre-computed analyses. Set `false` for production to start with an empty project. |

Import real study data via **Data → Import** (CSV or mzXML). A sample CSV is available at `/fixtures/sample_metabolomics.csv`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METABO_WEB_PORT` | `47821` | Host port for the web UI |
| `METABO_API_PORT` | `47822` | Host and container port for the API |
| `METABO_DB_PORT` | `47823` | Host port mapped to PostgreSQL |
| `METABO_PYTHON_PORT` | `47824` | Host port for the Python analysis service |
| `DATABASE_URL` | set in docker-compose | PostgreSQL connection string |
| `JWT_SECRET` | change in production | Secret for signing auth tokens |
| `PORT` | `47822` | API server port (same as `METABO_API_PORT`) |
| `PYTHON_SERVICE_URL` | `http://python:47824` | Python service URL (Docker internal) |
| `USE_PYTHON_ANALYSIS` | `true` | Use Python for analysis; set `false` for TS-only |
| `RAW_DATA_DIR` | `/data/raw` | Directory for uploaded mzXML raw files |
| `SEED_DEMO_DATA` | `true` | Load reference dataset on first boot; set `false` for empty production |

## Original Design

The UI is based on the Figma Make export: https://www.figma.com/design/1cVP5kY52DbSAFK5wKhPAm/metabolomics-analytics-web-application
