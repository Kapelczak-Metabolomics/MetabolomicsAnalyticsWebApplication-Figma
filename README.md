# MetaboAnalytics

A full-stack metabolomics analytics web application built from the [Figma design](https://www.figma.com/design/1cVP5kY52DbSAFK5wKhPAm/metabolomics-analytics-web-application), with a React frontend, Express API, and PostgreSQL database.

## Quick Start (Docker)

The easiest way to run the entire stack:

```bash
docker compose up --build
```

Then open **http://localhost:8080** and sign in with:

- **Email:** `sarah.chen@university.edu`
- **Password:** `password123`

Docker Compose starts three services:

| Service | Description | Port |
|---------|-------------|------|
| `db` | PostgreSQL 16 with persistent volume | internal |
| `api` | Express API — auto-creates schema and seeds data on first run | internal |
| `web` | Nginx serving the React app and proxying `/api` | 8080 |

The database is automatically initialized when the API starts: tables are created, and seed data (users, projects, datasets, metabolite features, experiments, notifications) is inserted on first boot.

## Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL 16

### Database

```bash
createdb metaboanalytics
export DATABASE_URL=postgresql://localhost:5432/metaboanalytics
```

### API Server

```bash
cd server
npm install
npm run dev
```

The API runs on http://localhost:3001 and seeds the database automatically.

### Frontend

```bash
npm install   # or: pnpm install
npm run dev
```

The Vite dev server proxies `/api` requests to the backend.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser   │────▶│  Nginx/web  │────▶│  Express API │
│  (React)    │     │   :8080     │     │    :3001     │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  PostgreSQL  │
                                        │    :5432     │
                                        └──────────────┘
```

## Features

- JWT authentication with role-based access (Administrator, Researcher, Analyst)
- Project and dataset management backed by PostgreSQL
- Real metabolomics feature statistics computed from stored sample data
- Analysis runs (PCA, Volcano, Clustering, PLS-DA, Pathway, Biomarker) persisted to the database
- Notifications, audit logs, and admin panel with live data
- No simulated/mock data in production — all views fetch from the API

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | set in docker-compose | PostgreSQL connection string |
| `JWT_SECRET` | change in production | Secret for signing auth tokens |
| `PORT` | `3001` | API server port |

## Original Design

The UI is based on the Figma Make export: https://www.figma.com/design/1cVP5kY52DbSAFK5wKhPAm/metabolomics-analytics-web-application
