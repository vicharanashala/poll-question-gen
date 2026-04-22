# Spandan – Real-Time Interactive Classroom Platform

## 📌 Overview

Spandan is a real-time interactive learning platform that transforms traditional lectures into engaging sessions. It captures teacher speech, converts it into text, and automatically generates questions for students to answer instantly.

---

## 🚀 Key Features

* 🎤 Real-time speech-to-text transcription
* 🤖 Automatic question generation (Mock DB + NLP)
* ⚡ Live interaction between teacher and students
* 📊 Leaderboard and performance tracking
* 🧠 Time-based scoring system
* ✍️ Manual question creation by teacher

---

## 🛠️ Tech Stack

**Frontend:** React, TypeScript, Vite, Socket.IO-client
**Backend:** Node.js, Express.js, Socket.IO, MongoDB
**AI/NLP:** Compromise NLP + Mock Trivia DB
**Deployment:** Vercel (Frontend), Render/Railway (Backend)

---

## 🌐 Live Demo

👉 Add your deployment link here:
[Live Project Link](https://spandan-iota.vercel.app/)

---

## ⚙️ How to Run Locally

### 1. Clone Repository

```bash
git clone <your-repo-link>
cd spandan
```

### 2. Run Backend

```bash
cd backend
npm install
node index.js
```

### 3. Run Frontend

```bash
cd vite-project
npm install
npm run dev
```

Open: http://localhost:5173

---

## 🎯 How It Works

1. Teacher creates a session
2. Students join using Session ID
3. Teacher speaks → transcript generated
4. Questions auto-generated every 20 seconds
5. Students answer in real-time
6. Scores and leaderboard update instantly

---

## 📦 Future Improvements

* Advanced AI-based question generation
* Better analytics dashboard
* Multi-session tracking
* Improved UI/UX

---

## 👩‍💻 Author

Navya Sri Mahadevapatnam
