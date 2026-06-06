# Cric analytics

## Required languages and runtimes

- **Node.js / npm**: required for the `Frontend` app
- **Python 3.11+**: required for the `Backend` app
- **Redis**: required for Celery broker/result backend
- **PostgreSQL**: required for the database backend

## Frontend setup

1. Open a terminal in `Frontend`
2. Install dependencies:

```bash
cd "c:\Users\Rohan\Documents\Cric analytics\Frontend"
npm install
```

3. Run the development server:

```bash
npm run dev
```

## Backend setup

1. Open a terminal in `Backend`
2. Create and activate a Python virtual environment:

```bash
cd "c:\Users\Rohan\Documents\Cric analytics\Backend"
python -m venv .venv
.\.venv\Scripts\activate
```

3. Install backend dependencies:

```bash
pip install -r requirements.txt
```

## Backend requirements file

The backend dependencies are listed in `Backend/requirements.txt`.

## Required services

- **Redis**: `redis://localhost:6379/0`
- **PostgreSQL**: default connection in code is `postgresql://crickai_user:crickai_pass@localhost:5432/crickai`

## Notes

- The backend code uses FastAPI, SQLAlchemy, Celery, OpenCV, MediaPipe, and YOLO/Ultralytics.
- The frontend is built with Next.js, React, Tailwind CSS, and TypeScript.
