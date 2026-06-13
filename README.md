# Customer Support Face call

A real-time video support platform built for the AtomQuest Hackathon.

## Description
This platform enables customer support teams to provide real-time, visual assistance to customers through video calling, screen recording, and live chat.

### Core Features
- **Custom SFU Backend**: Media routing is handled securely through a custom `mediasoup` server (satisfying the "no direct peer-to-peer" and "no third-party hosted video APIs" constraints).
- **Agent Dashboard**: Agents can generate secure, shareable invite links for customers.
- **Premium User Experience**: Built with React, Vite, and Vanilla CSS focusing on dynamic, glassmorphism-inspired design.
- **Role-based Permissions**: Customers cannot join without valid tokens, nor can they perform agent actions.
- **Screen Recording**: Agents have the ability to record the session. Agents can also dynamically grant or revoke permission for the customer to record the session.
- **In-Call Chat**: Real-time messaging synchronized through WebSockets and persisted to an SQLite database.
- **Operations Dashboard**: Real-time view of active sessions and historical data.

## Setup Instructions

### Prerequisites
- **Node.js** (v18+)
- (No Docker or external services required)

### Backend Setup
1. Open a terminal and navigate to the `backend` directory.
2. Run `npm install` to install dependencies (including the mediasoup SFU).
3. Run `npm start` (or `node server.js`) to start the WebSocket and Media server.
   *(The backend runs on http://localhost:3001)*

### Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory.
2. Run `npm install` to install the UI dependencies.
3. Run `npm run dev` to start the Vite development server.
4. Navigate to the local URL provided by Vite (e.g., `http://localhost:5173/`).

## Architecture Overview
- **Frontend**: React.js, Vite, `mediasoup-client`, `socket.io-client`.
- **Backend**: Node.js, Express.js, `mediasoup` (WebRTC SFU), `socket.io`, `better-sqlite3` (Database).
