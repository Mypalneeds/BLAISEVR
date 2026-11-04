# ◆ BlaiseVR

**Take anything apart with your bare hands.** BlaiseVR is a free, browser-based 3D lab with 23 lifelike models: the human body, engines, an okada, a danfo, a volcano, planets and Nigerian landmarks. Each one is built from up to 250,000 lit particles, and you control them with hand gestures through your webcam.

- 🫰 **Snap** to summon, ✊ **fist** to form
- ✋ **Open your hand** to explode the model (the wider you open, the further the parts fly)
- ☝️ **Point** at a part to learn what it does, 🤏 **pinch** to pull it out, 👍 **thumbs-up** to hear it explained
- ✌️ **Peace sign** for the next model, 🔄 **twist** to rotate, 🙌 **two hands** to zoom

Hand tracking runs **on your device** (MediaPipe). Video never leaves your computer. No camera? Mouse, touch, keyboard and voice all work.

> 100% static site. No backend, no API keys, no build step, no bills. Push to GitHub, deploy on Vercel or Netlify, done.

---

## What's inside

**23 built-in models, 229 explained parts**

| | Model | Highlights |
|---|---|---|
| ❤️ | Human Heart | Chambers beat, blood pulses through the arteries and veins |
| 👁️ | Human Eye | Opens as a textbook cross-section: lens, retina, optic nerve signals |
| 🧠 | Human Brain | Folded lobes, cerebellum, brainstem, nerve signals |
| 🫁 | Lungs & Airways | Breathing lungs and diaphragm, branching bronchioles, alveoli |
| 🍲 | Digestive System | Food moving through the oesophagus and intestines |
| 🦠 | Animal Cell | 12 organelles inside a see-through membrane |
| 🌿 | Plant Cell | Cell wall, chloroplasts streaming round, large vacuole |
| 🌺 | Flower (Hibiscus) | Stamens, pistil and ovules in a labelled exploded view |
| 🧬 | DNA Double Helix | A-T / G-C base pairs, hydrogen bonds |
| 🚗 | 4-Cylinder Car Engine | Pistons pump, cams spin, air in and exhaust out |
| ⚡ | Petrol Generator | The "I better pass my neighbour" gen, with a CO safety tip |
| 🏍️ | Okada Motorcycle | Spinning spoked wheels, moving chain, shock springs |
| 🚌 | Danfo Bus | Lagos yellow-and-black, sliding door, roof-rack luggage |
| 🔌 | Step-down Transformer | Magnetic flux and current flowing (Vs/Vp = Ns/Np) |
| 🌬️ | Wind Turbine | Blades, gearbox, generator |
| 🚁 | Quadcopter Drone | Counter-rotating propellers, flight controller, GPS |
| 📱 | Smartphone Teardown | 13 layers from cover glass to camera module |
| 🌋 | Volcano (Cross-section) | Glowing magma rising, lava flows, ash cloud |
| 🌍 | Planet Earth (Layers) | Crust to inner core |
| 🪐 | Solar System | Planets orbit, Saturn's rings, asteroid belt |
| ⚛️ | Carbon Atom | Protons, neutrons, electron shells in motion |
| 🪨 | Zuma Rock | The "Gateway to Abuja", with its famous face |
| 🎭 | National Theatre, Lagos | Stylised FESTAC '77 landmark |

**Realistic rendering**

- **Three views (key S):** *Realistic* (shaded solid surfaces on a studio backdrop with a floor shadow), *Glow* (particles of light) and *X-ray* (edges only, so you can see inside).
- **Real materials.** Metal reflects its surroundings, organs have soft, warm, skin-like lighting, glass is see-through, and rubber and plastic have their own finishes. Surfaces have natural texture: brain folds, rock, bumpy organs.
- **Things flow.** Blood pulses through arteries, air moves down the windpipe, current runs through coils, magma rises up the volcano, and food moves through the gut.
- **Cut-away by default** for the eye and plant cell, like a textbook diagram.

**Smarter**

- **Ask anything (key /).** Offline search across all 23 models and 229 parts. Try "what pumps blood", "powerhouse of the cell", "which part makes electricity" or "where is pollen made". It jumps to the right model and part and explains it. Voice questions work the same way.
- **Guided tour (key Y).** A narrated walk through every part. The camera flies to each one in turn, and the tour ends with a prompt to take the quiz.
- **Camera focus.** Selecting a part zooms in and makes it the centre of rotation.
- **Animated machines.** Pistons, orbits, heartbeats, breathing, rotors (key **A**).
- **Import anything.** Drop a `.glb`, `.gltf`, `.obj` or `.stl` from Sketchfab and every mesh becomes an explodable part with proper lighting. Drop a photo and it becomes a 3D relief.
- **Type words into particles.** Press **N**, type a name or "HAPPY BIRTHDAY", and every letter becomes a part.
- **Quiz with your hands.** Multiple-choice questions plus "find it" rounds where you point at the right part. Best scores are saved.
- **Voice.** Every part can be read aloud. In Chrome or Edge you can also give commands: "explode", "show the engine", "what is the crankshaft", "x-ray", "tour".
- **Cut-away slicing** on any axis, isolate, pull out, labels, five colour modes, motion trails, bloom.
- **Record video** (K), **screenshots** (P), **share links** (`/#m=okada`), **demo mode** (D), **WebXR** on Meta Quest, **offline PWA**, and a **mobile-ready** layout.

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

More keys: `/` ask · `Y` tour · `S` view (Realistic / Glow / X-ray) · `X` cut-away (`,` `.` change axis) · `Z` isolate · `L` labels · `A` animate · `R` auto-rotate · `G` hand-rotate · `T` trails · `Q` quiz · `M` voice · `K` record · `P` screenshot · `N` text · `U` import · `B` browse · `C` camera · `D` demo · `H` help.

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
js/particles.js     GPU particles. Custom shader: lighting with real surface normals, 7 materials,
                    Realistic/Glow/X-ray views (+ a see-through pass for glass), flow pulses, morphing,
                    per-part rotate/scale/translate (explode, animate, pull), cut-away
js/sampler.js       Turns shapes (sphere, box, rounded box, cylinder, capsule, lathe, torus, tube, helix…)
                    into particles with normals and flow coordinates; noise for organic surfaces
js/models.js        Built-in models (part 1) + realism tuning (materials, flows, texture)
js/models2.js       12 more models: eye, brain, lungs, digestive, flower, plant cell, okada, danfo,
                    transformer, volcano, Zuma Rock, smartphone
js/gestures.js      MediaPipe Hand Landmarker (loaded only when you turn on the camera) + pose classifier
js/importers.js     .json / .glb / .gltf / .obj / .stl / image / text → model
sw.js               Offline cache (PWA)
```

**Free services used:** Three.js and MediaPipe from the jsDelivr CDN, the MediaPipe hand model from Google's public storage, Google Fonts, and the browser's built-in Web Speech, MediaRecorder and WebXR APIs. Nothing needs an account or a key.

**Browsers:** Chrome, Edge, Brave and Opera work best (voice commands are Chrome/Edge only). Firefox and Safari work too. A WebGL2-capable GPU is recommended. Drop the particle count in ⚙ Settings on older phones.

---

## Ideas for v2

- More curriculum packs: ear, kidney, skeleton, tooth, electric motor, keke napep
- Classroom mode: a teacher controls the model and students follow on their phones (WebRTC)
- AI text-to-3D import via a free-tier API
- Multiplayer "find the part" races

---

MIT licensed. Built by **Mmadubuko Micheal Blaise** · Analaize Limited, Lagos 🇳🇬
