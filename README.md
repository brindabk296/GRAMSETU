# CareRoute AI v2 — Longitudinal Health Intelligence Platform

**Problem Statement ID:** DL-SJBIT-HK26-SSF010  
**Tagline:** *One doctor. Many villages. One intelligent patient history — even offline.*  
**Primary Users:** Traveling Field Doctors (e.g., Dr. Ravi Kumar) & Rural Patients (e.g., Lakshmi Devi)  
**Database:** MongoDB Atlas (with seamless high-reliability fallback)

---

## 🌟 Executive Overview & Custom Capabilities

CareRoute AI v2 is a full-stack, offline-first clinical platform engineered for doctors who travel between rural communities and primary health centers. It converts fragmented paper records into one continuous, intelligent patient timeline.

### Key Capabilities Built Exactly to Your Blueprint:

1. **Dynamic District & Cascading Village Selector:**
   - Selecting a district (e.g., *Ranchi*, *Dhanbad*, *Hazaribagh*, *East Singhbhum*, *Khunti*) automatically queries the database and populates the corresponding rural villages and primary health sub-centres (e.g., *Angara*, *Bundu*, *Burmu*, *Kanke*, *Ormanjhi*, *Ratu*, *Namkum*).
2. **Strict Separate Authentication & Role Dashboards (Doctor & Patient Only):**
   - **Doctor Portal:** Prioritized patient queues, OLS regression trend forecasts, consultation records with voice dictation simulation, OCR lab slip confirmation, and patient messaging.
   - **Patient Portal:** Vitals self check-in, longitudinal condition review, medication tracking, doctor registry verification, and 24/7 AI-powered healthcare assistant chat.
   - Administrative overhead completely removed as requested (Doctor and Patient roles only).
3. **Anti-Scam Doctor Verification & Patient Record Lockdown:**
   - To protect rural patients from fraudulent or unqualified impostors, doctor registration strictly collects **Medical Council Registration Number (NMC / State Council ID)**, **Degree Qualification (MBBS, MD, MS)**, **Medical College / University**, **Year of Passing**, and **Certificate Document Upload**.
   - **Unverified / Scam Doctors are strictly blocked** from accessing patient medical records, longitudinal charts, and consultation channels.
   - Patients can view the **Verified Doctor Directory** to confirm genuine accreditation.
4. **AI-Powered Healthcare Chatbot & Real-Time Doctor-Patient Messaging:**
   - Real-time WebSocket (Socket.io) messaging channel between rural patients and traveling doctors.
   - Built-in **AI Clinical Guard**: automatically triages described symptoms, evaluates urgency level (*Emergency*, *Urgent*, *Advisory*, *Normal*), and displays immediate safety recommendations.
   - Doctors can respond with medical guidance, suggestions, and clinical recommendations.
5. **OLS Trend & Time-to-Threshold Forecast Engine:**
   - Uses Ordinary Least-Squares (OLS) regression over 180-day time-series readings.
   - Projects days and weeks until systolic BP or blood glucose breaches clinical thresholds (e.g., 160 mmHg).
   - Generates transparent, explainable alerts: *"Systolic BP has changed by roughly +4.2 mmHg/month over the last 5 readings. At this rate, it may reach 160 mmHg in roughly 6 to 8 weeks."*
6. **Confirm-Before-Save OCR Intake:**
   - Scan paper slips and lab reports with side-by-side verification and physiological range checks before saving.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18 or higher (v25 supported)
- **npm**: v9 or higher

### Option A: Run Full Application in One Command
```bash
# 1. Install dependencies for both server and client:
npm run install:all

# 2. Build the modern React client:
npm run build

# 3. Start the server (serves both API & Frontend on port 5000):
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser!

---

### Option B: Development Mode (Hot Reloading)

In one terminal:
```bash
cd server
npm start
```

In a second terminal:
```bash
cd client
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)**.

---

## 🍃 MongoDB Atlas Configuration

You can connect directly to your MongoDB Atlas cluster by editing `.env` (or `server/.env`):

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/careroute?retryWrites=true&w=majority

# Port & Secrets
PORT=5000
JWT_SECRET=careroute-super-secret-key-2026-rural-ai
```

> **Zero-Friction Offline Mode:** If `MONGODB_URI` is left blank or internet is disconnected, CareRoute AI automatically falls back to an in-memory embedded schema persistence store so you can evaluate the platform immediately out of the box with zero setup hurdles!

---

## 👥 Demo Test Accounts (Pre-Seeded)

| Role | Name | Login ID | Password | Status / Note |
|---|---|---|---|---|
| **Doctor** | Dr. Ravi Kumar | `CRD-RAVI-0001` | `doctor123` | **Verified** (NMC-JH-2016-44821, MBBS, MD) |
| **Doctor** | Dr. R. Sharma | `CRD-SHARMA-0001` | `doctor123` | **Unverified / Pending** (Tests anti-scam lock) |
| **Patient** | Lakshmi Devi | `lakshmi@ruralcare.in` | `patient123` | Angara Village (Hypertension + T2D, 5 visits) |
| **Patient** | Ramu Soren | `ramu@ruralcare.in` | `patient123` | Bundu Village (Critical Fasting Glucose spike) |
| **Patient** | Sita Munda | `patient@ruralcare.in` | `patient123` | Burmu Village (Routine Stage-1 HTN) |

New doctors receive a unique CareRoute Doctor ID at registration; save it and use it with the password to sign in. Patient sign-in continues to use email. Existing doctor accounts without an ID receive one the first time they sign in with their existing credentials.

*(Quick 1-Click login buttons are also available on the home page and login screen).*

---

## 📂 Project Architecture

```
clover/
├── package.json              # Monorepo scripts (install:all, build, start)
├── .env.example              # MongoDB Atlas environment variables template
├── server/
│   ├── server.js             # Express + Socket.io Server & Static Client Host
│   ├── db.js                 # MongoDB Atlas Connector + Fallback Store
│   ├── models/
│   │   ├── User.js           # User Auth (Doctor / Patient)
│   │   ├── DoctorProfile.js  # Education, Certificates, NMC Reg, Verification
│   │   ├── PatientProfile.js # District, Village, Conditions, DPDP Consent
│   │   ├── Visit.js          # Longitudinal Consultations, Vitals, Plans
│   │   ├── Observation.js    # Time-series BP, Glucose, Heart rate for OLS
│   │   ├── FollowUp.js       # Queue Management (Due / Overdue / Escalated)
│   │   └── ChatMessage.js    # Real-Time Chat & AI Triage Records
│   ├── routes/
│   │   ├── auth.js           # Doctor & Patient Registration / Login
│   │   ├── locations.js      # Cascading District & Village Data
│   │   ├── patients.js       # Patient Registry, Timeline, Consultations
│   │   ├── doctors.js        # Doctor Directory & Dashboard Summaries
│   │   ├── analytics.js      # OLS Trend Regression, Risk Scoring, Copilot
│   │   ├── chat.js           # Real-Time Chat & AI Symptom Assistant
│   │   └── ocr.js            # Lab Report OCR Scanner Simulator
│   ├── middleware/
│   │   ├── auth.js           # JWT Authentication & Role Authorization
│   │   └── doctorVerified.js # Anti-Scam Lock Guard
│   └── data/
│       ├── districtsVillages.js # Hierarchical District & Village Matrix
│       └── seedData.js       # Synthetic Patient Timeline Data
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx                  # Brand Header, Role Badges, Language
│   │   │   ├── DistrictVillageSelector.jsx # Cascading Location Selector
│   │   │   ├── VerificationBadge.jsx       # Anti-Scam Credential Shield
│   │   │   ├── TrendForecastChart.jsx      # Recharts OLS Regression Visualizer
│   │   │   ├── RiskBadge.jsx               # Critical/High/Moderate/Routine Tiers
│   │   │   ├── VoiceConsultationInput.jsx  # Web Speech API / Voice Dictation
│   │   │   └── OcrModal.jsx                # Confirm-before-save OCR Modal
│   │   ├── context/
│   │   │   ├── AuthContext.jsx             # Role-based Session Management
│   │   │   └── LanguageContext.jsx         # English UI text
│   │   ├── pages/
│   │   │   ├── Home.jsx                    # Landing & Feature Presentation
│   │   │   ├── Login.jsx                   # Separate Doctor & Patient Tabs
│   │   │   ├── RegisterDoctor.jsx          # Doctor Education & Certificate Form
│   │   │   ├── RegisterPatient.jsx         # Patient Demographic & Consent Form
│   │   │   ├── DoctorDashboard.jsx         # Village Queue & Circuit Switcher
│   │   │   ├── DoctorPatients.jsx          # Longitudinal Patient Directory
│   │   │   ├── PatientDetail.jsx           # 2-Min Snapshot, OLS Chart, AI Copilot
│   │   │   ├── DoctorChat.jsx              # Real-Time Patient Guidance
│   │   │   ├── DoctorVerification.jsx      # Credential Management & Test Sandbox
│   │   │   ├── PatientDashboard.jsx        # My Health & Prescriptions
│   │   │   ├── PatientChat.jsx             # AI Healthcare Assistant & Doctor Chat
│   │   │   ├── PatientVitalsCheckIn.jsx    # Remote Monitoring Check-in
│   │   │   └── DoctorDirectory.jsx         # Public Verified Doctor Registry
│   │   ├── App.jsx                         # Role-based Route Protection
│   │   └── main.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
```

---

## 🛡️ Responsible AI & Ethical Safety

- **AI Supports, Doctor Decides:** All AI risk scores and trend projections are explicitly flagged as *Decision Support Only*.
- **Grounded Copilot:** AI responses strictly cite consultation dates and observation records from the patient's file.
- **Anti-Scam Protection:** Zero access to clinical records is granted until a doctor's medical council credentials and degree certificates are verified.
- **Data Minimization:** Compliant with India DPDP Act 2023 with digital informed consent logged for each patient.

---

*CareRoute AI v2 | DL-SJBIT-HK26-SSF010 | Developed for Rural Clinical Excellence*

## 🔑 Doctor sign-in (Doctor ID + password)

- Every doctor who registers via **Join as Doctor** is issued a unique Doctor ID (format `CRD-XXXXXXXXXX`), shown on the confirmation screen and on the Verification page.
- Doctors sign in with **Doctor ID + password**. Email sign-in is rejected for doctor accounts. Patients still sign in with email.
- Existing doctor accounts without an ID get one automatically at server start-up. A doctor who forgot their ID can use **Recover my Doctor ID** on the login page (requires registered email + password).
- Demo IDs: `CRD-RAVI-0001` (verified), `CRD-SHARMA-0001` (pending), password `doctor123`.
#   G R A M S E T U  
 