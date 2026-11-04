# Making your own BlaiseVR models

There are four ways to add a model. None of them cost anything.

| Way | How | Parts come from |
|---|---|---|
| **3D file** | Drop a `.glb`, `.gltf`, `.obj` or `.stl` onto the page (or press **U**) | Each mesh in the file becomes a part |
| **Image** | Drop a `.png` / `.jpg` / `.webp` | Colour groups (bright pixels float forward) |
| **Text** | Press **N** and type | Each letter becomes a part |
| **JSON** | Drop a `.json` written in the format below | You decide every part, colour and fact |

Free 3D models to try: [Sketchfab](https://sketchfab.com/features/free-3d-models) (filter "Downloadable"), [Poly Haven](https://polyhaven.com/models), [NASA 3D Resources](https://nasa3d.arc.nasa.gov/models), [Smithsonian 3D](https://3d.si.edu/). Models with separate named meshes explode best.

Dropped JSON models are saved in your browser, so they're still there next visit. To ship a model to everyone, add it to `js/models.js` (see the bottom of this page).

---

## JSON format

```json
{
  "name": "Space Rocket",
  "emoji": "🚀",
  "category": "Space",
  "about": "One or two sentences shown/spoken when no part is selected.",
  "explode": 1,
  "parts": [
    {
      "name": "Booster",
      "color": "#00e5ff",
      "desc": "What this part does. Used for the info panel, voice and quiz questions.",
      "fact": "Optional fun fact.",
      "shapes": [ { "t": "cyl", "c": [0, -0.6, 0], "r": 0.5, "h": 2.4 } ],
      "anim": { "type": "spin", "axis": [0, 1, 0], "speed": 1 },
      "ex": [0, -1.5, 0]
    }
  ]
}
```

See [`models/rocket.json`](../models/rocket.json) for a complete working example.

### Model fields

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Shown in the picker and title |
| `parts` | yes | Up to **24** parts |
| `emoji`, `category`, `about` | no | Picker icon, category label, overview text |
| `explode` | no | Multiplier for how far parts fly apart (default `1`) |

### Part fields

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Part name (labels, quiz, voice: "what is the *booster*") |
| `shapes` | yes | One or more shapes (below) |
| `color` | no | Hex colour |
| `desc`, `fact` | no | Explanation text. Parts with a `desc` appear in quizzes |
| `anim` | no | One animation or an array of them |
| `ex` | no | Exact explode offset `[x, y, z]` in final scene units (the whole model is scaled to a radius of about 2.2). Without it, parts fly outward from the centre |
| `pivot` | no | Point that rotation/scale animations use (defaults to the part's centre) |
| `d` | no | Density multiplier: `0.3` = sparse haze, `2` = extra bright |

You can use any units you like. BlaiseVR centres and scales the whole model automatically. `y` is up.

### Shapes

Every shape takes `c` (centre, default `[0,0,0]`), optional `rot` (Euler degrees `[x, y, z]`), `d` (density) and `j` (random jitter).

| `t` | Fields | Notes |
|---|---|---|
| `sphere` | `r`, `v`, `r0` | `v: true` fills the volume; `r0` makes a hollow shell |
| `ellipsoid` | `r: [rx, ry, rz]`, `v` | Stretched sphere |
| `box` | `s: [w, h, d]`, `v` | Cuboid |
| `cyl` | `r`, `h`, `r2`, `axis`, `open`, `v` | Cylinder along `y`. `r2` = top radius (`0` = cone). `axis: "x"`/`"z"`/`[x,y,z]` to point it elsewhere. `open: true` removes the caps |
| `torus` | `R`, `r`, `arc`, `start`, `axis` | Ring lying flat (normal = `y`). `arc: 0.5` = half ring; `start` in degrees |
| `disk` | `r`, `r0`, `axis` | Flat disk or ring (normal = `y`) |
| `tube` | `pts: [[x,y,z], ...]`, `r`, `closed` | Smooth tube through points: pipes, wires, veins |
| `helix` | `R`, `r`, `h`, `turns`, `phase` | Spiral (springs, DNA) |
| `pts` | `data: [[x,y,z], ...]` | Raw points. Add `[x,y,z,r,g,b]` (0–1) for per-point colour |

### Animations

| `type` | Fields | Example use |
|---|---|---|
| `spin` | `axis`, `speed` (radians/second), `pivot` | Wheels, fans, planets (`pivot: [0,0,0]` = orbit the centre) |
| `swing` | `axis`, `amp` (radians), `freq` (Hz), `phase` | Doors, pendulums, valves |
| `bob` | `axis`, `amp` (model units), `freq`, `phase` | Pistons |
| `pulse` | `amp` (fraction), `freq`, `phase` | Heart chambers, flames |

Animations play while the **Animate** button is on (key **A**).

## Shipping a model to everyone

1. Open `js/models.js`.
2. Add your model object (same fields as the JSON, plus a unique `id`).
3. Add it to the `MODELS` array at the bottom of the file.
4. Commit and push. Vercel or Netlify redeploys automatically.

In `models.js` you can also use JavaScript loops to generate repeated shapes. The engine, DNA and atom models do this.
