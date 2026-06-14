# Campus Lost & Found Hub

A full-stack, secure, web-based platform tailored for university students, faculty, and administrative staff to report, track, discover, and claim misplaced or found property on campus. The application handles high-level user monitoring, relational item auto-matching, real-time alert/notification dispatches, and an automated text-matching claims verification pipeline.

---

## 🚀 Key Features

### 👤 Student/User Capabilities
- **Dual Flow Reporting:** Separated structural modules to report either a **Lost Item** or a **Found Item** with unique, human-readable ID footprints (`LXXXX` or `FXXXX`).
- **Public Feed & Search Engine:** A public dashboard allowing individuals to search through items via explicit relational classification or targeted keyword queries.
- **Proof-of-Ownership Submissions:** Found items can be requested by filing a formal **Claim** containing explicit validation proof descriptors.
- **Real-Time Context Notification:** An inner notification center tracking verification updates, claim decisions, and institutional announcements.

### 🛡️ Administrative System (Admin Panel)
- **High-Level Statistics Monitoring:** Unified analytical tracking indicating real-time system metrics: Total Registered Users, Total Active Lost Reports, and Verified Found items.
- **Verification & Moderation Engine:** Central claims processing pipeline enabling admins to compare user proof descriptors against found objects and sequentially **Approve** or **Reject** claims.
- **Broadcasting Station:** System-wide announcement console routing critical updates straight into every user's personal alert ecosystem.
- **Auditing Logs:** Tracking structures recording administrative data adjustments to preserve accountability.

---

## 🛠️ Backend Architecture & Engineering Focus

This project is built with an emphasis on **Relational Database Design**, **Data Consistency (Referential Integrity)**, and **Backend Route Security**.

1. **Automated Algorithmic Cross-Matching (`checkAndCreateMatches`)**
   Whenever a user submits an item as lost or found, an asynchronous text-matching pipeline searches the inverse table (`lost_items` ↔ `found_items`) within the matching category using SQL wildcard (`LIKE %keyword%`) operations. Discovered targets are paired and written to `item_matches`.
   
2. **Referential Integrity & Cascades**
   The relational model utilizes strict `FOREIGN KEY` constraints embedded with `ON DELETE CASCADE` actions. If a user profile or item tracking entity is purged, dependent claims, notifications, logs, and matching entries are cleared, preventing orphaned row data.

3. **Robust Backend Security & Access Control**
   - **Session Protection:** Custom middleware (`requireAdmin`) wraps administrative routes, testing authentication token footprints before serving view states.
   - **SQL Injection Defenses:** Data-tier interaction uses exclusively prepared statements and parameterized bindings (`db.execute(query, [params])`).
   - **Cryptographic Protections:** Passwords are processed through one-way hashing routines using `bcryptjs` over 10 salt-generation rounds.

---

## 📊 Relational Database Schema (`schema.sql`)

The underlying architecture relies on a structured schema consisting of the following key entities:

- **`users` & `profiles`:** One-to-One linked structure distinguishing between account roles (`user`, `admin`).
- **`item_categories`:** Pre-seeded lookup catalog (`Electronics`, `Documents`, `Books`, `Keys`, `Clothing`, `Other`).
- **`lost_items` & `found_items`:** Independent transactional entities storing descriptive attributes (brand, color, location, status).
- **`claims`:** Connective tracking schema storing verification descriptions, status state (`Pending`, `Approved`, `Rejected`), and associated keys.
- **`item_matches`:** Relational entity logging auto-matched pairings.
- **`notifications`**, **`admin_logs`**, & **`reports`:** System utilities supporting communications, auditing trails, and peer assistance tickets.

---

## 💻 Tech Stack

- **Backend Platform:** Node.js, Express.js (Model-View-Controller architecture template)
- **Database Engine:** MySQL / MariaDB (Relational DBMS)
- **Authentication/Security:** Express-Session, BcryptJS
- **File System Processing:** Multer (For multi-part handling of image uploads)
- **Frontend Template Pipeline:** Embedded JavaScript (EJS) view rendering

---

## ⚙️ Installation & Local Setup

 Follow these steps to run the development environment on your local system:

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v16.x or higher)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/)

### 2. Repository Deployment & Package Installation
Clone the repository and install the project dependencies:
```bash
git clone [https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git)
cd YOUR_REPOSITORY_NAME
npm install
