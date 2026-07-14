# Retail Banking FCY Lead Generation, Management, and Analytics Platform

An automated central lead mobilization system that aggregates and analyzes foreign currency (FCY) transaction history, running custom business rules to flag receiver, sender, and exchange leads. Supports role-based visual analytics, cascading geographical filtration, manual data uploads, and PDF/Excel report downloads.

---

## Tech Stack
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy, Uvicorn, PyMySQL
- **Frontend**: Next.js 15 (React 19, Turbopack, Tailwind CSS v4), Apache ECharts, Lucide Icons, Axios

---

## Directory Structure
- `backend/`: FastAPI implementation, db migrations, test files, and analytical generators.
- `frontend/`: Next.js web application, layouts, and ECharts visualizations.

---

## Local Setup & Run Guide

### Prerequisite
Ensure a local **MySQL server** is running on your machine.
Create a database named `fcy_leads` or customize the database connection string in your environment as `DATABASE_URL`.
*(By default, the backend will attempt to connect to `mysql+pymysql://root:password@localhost:3306/fcy_leads` and automatically create the database if permissions allow).*

---

### Step 1: Run the Backend (FastAPI)
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```
4. Install python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the server (this will automatically verify tables, create schemas, and seed 1,500 mock transaction records for development on first startup):
   ```bash
   python -m uvicorn main:app --port 8000 --reload or .\backend\venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000 --reload
   ```
   *The Swagger API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).*

---

### Step 2: Run the Frontend (Next.js)
1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the hot-reloading development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## Verification & Automated Tests
To run backend automated unit tests verifying lead generation rules and RBAC controls, run the following from the **project root directory**:
```bash
.\backend\venv\Scripts\python.exe -m pytest backend/tests
```

---

## Simulated Access Roles (Demo Accounts)
The UI features a dropdown selector in the top-right header to switch roles. The mock logins are:
- **Head Office Director**: `username: headoffice` | `password: password`
  *(Unrestricted access to all data, DISTRICT performance rankings, and manual CSV uploads)*
- **Regional Director**: `username: region` | `password: password`
  *(Access restricted to Addis East region branches)*
- **District Manager**: `username: district` | `password: password`
  *(Access restricted to Bole District branches)*
- **Branch Officer**: `username: branch` | `password: password`
  *(Access restricted to Bole Main branch leads; blocked from viewing aggregate charts/rankings/uploads, but can edit assigned leads)*
