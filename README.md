# ◆ BlaiseVR

**Take anything apart with your bare hands.** BlaiseVR is a free, browser-based 3D lab where engines, hearts, cells, planets and Lagos landmarks are built from up to 250,000 glowing particles. You control them with hand gestures through your webcam.

- 🫰 **Snap** to summon, ✊ **fist** to form
- ✋ **Open your hand** to explode the model (the wider you open, the further the parts fly)
- ☝️ **Point** at a part to learn what it does, 🤏 **pinch** to pull it out, 👍 **thumbs-up** to hear it explained
- ✌️ **Peace sign** for the next model, 🔄 **twist** to rotate, 🙌 **two hands** to zoom

Hand tracking runs **on your device** (MediaPipe). Video never leaves your computer. No camera? Mouse, touch, keyboard and voice all work.

> 100% static site. No backend, no API keys, no build step, no bills. Push to GitHub, deploy on Vercel or Netlify, done.

---

## What's inside

**11 built-in models, 100+ explained parts**

| | Model | Highlights |
|---|---|---|
| ❤️ | Human Heart | Chambers beat, valves, coronary arteries |
| 🚗 | 4-Cylinder Car Engine | Pistons pump, crankshaft and camshaft spin in time |
| ⚡ | Petrol Generator | The "I better pass my neighbour" gen: rotor spins, CO safety tip |
| 🦠 | Animal Cell | 12 organelles (WAEC / NECO Biology) |
| 🧬 | DNA Double Helix | A-T / G-C base pairs, hydrogen bonds, rotates |
| 🌍 | Planet Earth (Layers) | Slice it open with the cut-away to see the core |
| 🪐 | Solar System | Planets orbit, Saturn's rings, asteroid belt |
| ⚛️ | Carbon Atom | Protons, neutrons, electron shells in motion |
| 🌬️ | Wind Turbine | Blades, gearbox, generator |
| 🚁 | Quadcopter Drone | Counter-rotating propellers, flight controller, GPS |
| 🎭 | National Theatre, Lagos | Stylised FESTAC '77 landmark |

**What makes it smarter than a plain particle demo**

- **Animated machines.** Parts actually work: pistons, orbits, heartbeats, spinning rotors (key **A**).
- **Import anything.** Drop a `.glb`, `.gltf`, `.obj` or `.stl` from Sketchfab and every mesh becomes an explodable part. Drop a photo and it becomes a 3D relief split into colour layers.
- **Type words into particles.** Press **N**, type a name or "HAPPY BIRTHDAY", and every letter becomes a part.
- **Quiz with your hands.** Multiple-choice questions plus "find it" rounds where you point at the right part. Best scores are saved.
- **Voice.** Every part can be read aloud. In Chrome or Edge you can also give commands: "explode", "show the engine", "what is the crankshaft", "pull out the aorta".
- **Cut-away slicing** on any axis, with a glowing cross-section edge.
- **Isolate, pull out, labels, solid view, five colour modes, motion trails, bloom.**
- **Record video** (K) and **screenshots** (P) straight from the browser.
- **Share links** that open a specific model (`/#m=engine`).
- **Demo mode** (D) for kiosks and exhibitions; it starts by itself after 90 seconds idle.
- **WebXR.** On a Meta Quest browser an **Enter VR** button appears.
- **Installable PWA** that works offline after the first visit.
- **Mobile-ready.** Touch to rotate, pinch to zoom, lighter particle counts on phones.

---

## Deploy for free (about 5 minutes)

### 1. Put it on GitHub
1. Create a new repository on [github.com/new](https://github.com/new) called `blaisevr` (Public).
2. Upload every file in this folder, keeping the folder structure. You can drag the whole folder into GitHub's "uploading an existing file" page. Or use the command line:
   ```bash
   cd blaisevr
   git init && git add . && git commit -m "BlaiseVR"
   git branch -M main
   git remote add origin https://github.com/<your-username>/blaisevr.git
   git push -u origin main
   ```

### 2a. Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub (Hobby plan is free).
2. Import the `blaisevr` repo. Framework preset: **Other**. Leave the build command and output directory empty.
3. Click **Deploy**. You get `https://blaisevr.vercel.app` (or similar).

### 2b. Netlify (alternative)
1. Go to [app.netlify.com/start](https://app.netlify.com/start) and connect GitHub (free Starter plan).
2. Pick the repo. Build command: *empty*. Publish directory: `.`
3. Deploy. `netlify.toml` already sets everything up.

### 2c. GitHub Pages (also free)
Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / root → Save.

Every `git push` redeploys automatically on all three.

> 📷 **The camera only works over HTTPS** (or `localhost`). Vercel, Netlify and GitHub Pages all give you HTTPS automatically.

---

## Run it locally

Any static server works. ES modules don't load from `file://`, so don't just double-click `index.html`.

```bash
cd blaisevr
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

Add `?skip` to the URL to jump straight past the welcome screen.

---

## Controls

| Gesture | Action | Key |
|---|---|---|
| 🫰 Snap | Summon / dissolve | `Space` |
| ✊ Fist | Form | `F` |
| ✋ Open hand | Explode (openness = distance) | `E`, `↑` `↓`, scroll |
| ☝️ Point & hold | Select part | click |
| 🤏 Pinch | Pull out / put back | double-click |
| 👍 Thumbs up | Explain aloud | `I` |
| ✌️ Peace | Next model | `V` `→` `←` `1-9` |
| 🔄 Twist / raise hand | Rotate / tilt | drag |
| 🙌 Two hands | Zoom | `+` `-`, ctrl+scroll, pinch |

More keys: `X` cut-away (`,` `.` change axis) · `Z` isolate · `L` labels · `S` solid · `A` animate · `R` auto-rotate · `G` hand-rotate · `T` trails · `Q` quiz · `M` voice · `K` record · `P` screenshot · `N` text · `U` import · `B` browse · `C` camera · `D` demo · `H` help.

If gestures feel unreliable, set **Sensitivity → More forgiving** in the camera panel. Good lighting and a plain background help.

---

## Make your own models

See **[docs/MODELS.md](docs/MODELS.md)**. In short:

- **Easiest:** drag a free `.glb`, `.obj` or `.stl` onto the page.
- **Full control:** write a small JSON file with parts, shapes, colours, descriptions, facts and animations. [`models/rocket.json`](models/rocket.json) is a complete example; drop it on the page to try it.
- **Ship to everyone:** add your model to `js/models.js` and push.

---

## How it works

```
index.html          UI shell + import map (Three.js from jsDelivr CDN)
css/style.css       All styling
js/main.js          App state, render loop, mouse/touch/keys, gestures→actions, quiz, voice, recording
js/particles.js     One GPU draw call. Custom shader: form/dissolve, morph between models,
                    per-part rotate/scale/translate (explode, animate, pull), cut-away, glow
js/sampler.js       Turns simple shapes (sphere, box, cylinder, torus, tube, helix…) into particles,
                    normalises scale, works out explode paths and auto-exposure
js/models.js        The 11 built-in models
js/gestures.js      MediaPipe Hand Landmarker (loaded only when you turn on the camera) + pose classifier
js/importers.js     .json / .glb / .gltf / .obj / .stl / image / text → model
sw.js               Offline cache (PWA)
```

**Free services used:** Three.js and MediaPipe from the jsDelivr CDN, the MediaPipe hand model from Google's public storage, Google Fonts, and the browser's built-in Web Speech, MediaRecorder and WebXR APIs. Nothing needs an account or a key.

**Browsers:** Chrome, Edge, Brave and Opera work best (voice commands are Chrome/Edge only). Firefox and Safari work too. A WebGL2-capable GPU is recommended. Drop the particle count in ⚙ Settings on older phones.

---

## Ideas for v2

- More Nigerian curriculum packs: digestive system, eye, ear, flower, transformer, okada engine
- Classroom mode: a teacher controls the model and students follow on their phones (WebRTC)
- AI text-to-3D import via a free-tier API
- Multiplayer "find the part" races

---

MIT licensed. Built by **Mmadubuko Micheal Blaise** · Analaize Limited, Lagos 🇳🇬
