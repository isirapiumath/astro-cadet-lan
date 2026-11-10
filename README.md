# AstroCadet // Junior Astronaut Trainer (LAN Co-Op)
### NASA Space Apps Challenge Submission Prototype

**AstroCadet** is an interactive, asymmetric 2-player cooperative flight simulation where cadets train together as **Spacewalker (Astronaut EVA)** and **Flight Director (Houston CAPCOM)** to manage life-support, navigate microgravity inertia, and diagnose emergencies on the International Space Station (ISS).

---

## 🚀 Key Features

1. **Zero-Lag LAN Multiplayer:**
   - Powered by Node.js and Socket.io over local Wi-Fi.
   - Any device (laptop, tablet, or smartphone) on the same network can connect instantly without installing apps.
2. **Asymmetric Cooperative Roles:**
   - **🧑‍🚀 Astronaut (EVA Viewport):** Navigates around the ISS exterior with RCS thrusters, zero-g inertia physics, and emergency repair panels.
   - **📡 Flight Director (Houston Mission Control):** Reads live station telemetry, monitors hull integrity, decodes NASA repair manuals, vents emergency oxygen, and transmits directives to the spacewalker.
3. **Solo AI Training Mode:**
   - A solo judge can play directly with an AI-driven automated Houston Mission Control assisting over radio.
4. **NASA STEM Education:**
   - Real ISS modules (Destiny Lab, Harmony Node 2, Quest Airlock, Kibo Lab, Solar Arrays).
   - Authentic NASA EVA emergency protocols and daily astronaut physical training facts (*Train Like an Astronaut*).
5. **Procedural Web Audio FX:**
   - Authentic NASA Quindar communication beeps, RCS thruster hiss, and emergency klaxon sirens generated live in the browser using the Web Audio API.

---

## 🛠️ How to Run & Play

### 1. Start the Host Server
Open your terminal inside this folder:
```bash
npm start
```

### 2. Connect Your Devices
The terminal will display your connection links:
* **Host Machine:** Open [http://localhost:3000](http://localhost:3000) in your browser.
* **Player 2 (LAN on same Wi-Fi):** Open `http://<YOUR-LOCAL-IP>:3000` on another laptop, tablet, or phone (e.g. `http://192.168.1.9:3000`).

### 3. Crew Setup
1. Keep the default mission room code `ARTEMIS`.
2. Player 1 selects **LAUNCH AS ASTRONAUT**.
3. Player 2 selects **COMMENCE CAPCOM (HOUSTON)**.
4. Work together to save the station!
