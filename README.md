# Digital Muster Register (MERN Stack)

A clean, practical, and easy-to-use digital version of a physical construction site muster register, designed specifically for daily wage worker management, attendance tracking based on working hours, and flexible payment settlements.

---

## 🏗️ Highlights & Requirements Met

- **Physical Ledger Design**: Styled to resemble a traditional paper muster roll with ruled borders, high contrast, clean typography, and zero clutter.
- **Single Owner Account**: Dedicated single-owner access model with auto-seed or first-time setup lock.
- **Single Construction Site**: Built-in support for site configuration (Site Name, Location, Standard Daily Hours, Currency Symbol).
- **Daily Wage Workers**: Manage active and inactive workers by trade (Masons, Helpers, Carpenters, etc.) and individual daily wage rates.
- **Hours-Based Attendance**: Accurate daily attendance recording (Full Day, Half Day, Absent, Overtime) with automatic pro-rata wage calculation.
- **Flexible Payments**: Log daily cash advances (*kharcha*), weekly disbursements, and settlements with mode tracking (Cash, UPI, Bank Transfer).
- **Monthly Muster Roll**: Ledger sheet view with full 1–31 daily columns, total hours, days worked, total earned, total advances, and net balance due.
- **Print Friendly**: Built-in print styling to output physical paper records directly for site records.

---

## 🛠️ Technology Stack

- **Frontend**: React.js 18 + Vite, React Router DOM, Clean Custom CSS
- **Backend**: Node.js + Express.js (REST API, JWT Authentication)
- **Database**: MongoDB + Mongoose

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running on `mongodb://127.0.0.1:27017`

### 2. Default Credentials
On initial startup, the system seeds a default owner account:
- **Username**: `owner`
- **Password**: `construction123`

*(You can change the password and site details anytime from the **Settings** page).*

### 3. Running the Application

From the root directory:
```bash
# Run both Backend API (Port 5000) and Frontend (Port 3000) concurrently:
npm run dev
```

Or run them individually in separate terminals:
```bash
# Backend:
cd server
npm run dev

# Frontend:
cd client
npm run dev
```

Visit the application in your browser:
**[http://localhost:3000](http://localhost:3000)**

---

## 📑 Application Pages

1. **Login (`/login`)**: Single-owner secure sign-in with default credential guidance.
2. **Dashboard (`/dashboard`)**: Daily summary of active workers, today's attendance ratio, hours logged, and recent payments.
3. **Workers (`/workers`)**: Add, edit, and manage daily wage workers with trade specifications and wage rates.
4. **Attendance (`/attendance`)**: Day-by-day attendance sheet with quick fill buttons (All Present, All Absent, Half-day, Overtime) and hour-based wage calculation.
5. **Payments (`/payments`)**: Record cash advances and disbursements; view historical payment ledger.
6. **Muster Register (`/muster`)**: Physical register ledger grid with 31-day columns, total hours, wages earned, advances paid, and balance due. Includes print preview button.
7. **Settings (`/settings`)**: Site name, location, standard shift hours (default: 8 hrs), currency symbol (₹), and password security.

---

## 📁 Project Structure

```text
Muster Register/
├── package.json              # Root orchestration scripts
├── README.md
├── server/
│   ├── .env                  # Environment variables
│   ├── package.json
│   ├── server.js             # Express app & data seeder
│   ├── config/
│   │   └── db.js             # Mongoose connection
│   ├── models/
│   │   ├── User.js           # Single owner schema
│   │   ├── Site.js           # Site settings schema
│   │   ├── Worker.js         # Daily wage worker schema
│   │   ├── Attendance.js     # Hours-based attendance schema
│   │   └── Payment.js        # Flexible payments schema
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
│   └── routes/
│       ├── auth.js           # Login & profile routes
│       ├── workers.js        # Worker CRUD routes
│       ├── attendance.js     # Daily sheet & muster matrix routes
│       ├── payments.js       # Advance & payment ledger routes
│       └── settings.js       # Site configuration & dashboard stats
└── client/
    ├── index.html
    ├── vite.config.js        # Proxy to backend on port 5000
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx           # Routing & layout setup
    │   ├── index.css         # Physical muster ledger design system
    │   ├── App.css           # Navigation & component styles
    │   ├── context/
    │   │   └── AuthContext.jsx # Auth state & API client
    │   ├── components/
    │   │   ├── Layout.jsx    # Site header & tab bar
    │   │   └── ProtectedRoute.jsx
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── DashboardPage.jsx
    │       ├── WorkersPage.jsx
    │       ├── AttendancePage.jsx
    │       ├── PaymentsPage.jsx
    │       ├── MusterRegisterPage.jsx
    │       └── SettingsPage.jsx
```
