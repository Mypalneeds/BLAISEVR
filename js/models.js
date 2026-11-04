// BlaiseVR — built-in models.
// Every model uses the same plain format as custom .json models (see docs/MODELS.md),
// except a few built-ins that use small JS helpers to generate repeated shapes.
import { rng } from './sampler.js';
import { MORE_MODELS } from './models2.js';

const D2R = Math.PI / 180;
const seg = (a, b, r, extra = {}) => ({ t: 'tube', pts: [a, b], r, ...extra });
// axis vector of a torus/disk normal (+y) after an Euler rotation in degrees
function normalAfterRot([rx, ry, rz]) {
  // rotate (0,1,0) by Rz then Ry then Rx (three.js XYZ order)
  let x = 0, y = 1, z = 0;
  let c = Math.cos(rz * D2R), s = Math.sin(rz * D2R); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ry * D2R); s = Math.sin(ry * D2R); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rx * D2R); s = Math.sin(rx * D2R); [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}
function rotPoint([x, y, z], [rx, ry, rz]) {
  let c = Math.cos(rz * D2R), s = Math.sin(rz * D2R); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ry * D2R); s = Math.sin(ry * D2R); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rx * D2R); s = Math.sin(rx * D2R); [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}

// ============================================================ HEART
const heart = {
  id: 'heart', name: 'Human Heart', emoji: '❤️', category: 'Biology',
  about: 'A muscular pump about the size of your fist. It beats around 100,000 times a day, sending blood on two loops: to the lungs to pick up oxygen, and out to the rest of the body.',
  parts: [
    { name: 'Left Ventricle', color: '#ff2f55', shapes: [{ t: 'ellipsoid', c: [0.3, -0.35, -0.05], r: [0.55, 0.85, 0.5], rot: [0, 0, 22] }],
      anim: { type: 'pulse', amp: 0.05, freq: 1.2 }, desc: 'The heart\'s strongest chamber. It pumps oxygen-rich blood into the aorta and out to the whole body.', fact: 'Its muscle wall is about three times thicker than the right ventricle\'s, because it has to push blood much further.' },
    { name: 'Right Ventricle', color: '#ff5a7a', shapes: [{ t: 'ellipsoid', c: [-0.28, -0.2, 0.2], r: [0.5, 0.7, 0.42], rot: [0, 0, -18] }],
      anim: { type: 'pulse', amp: 0.05, freq: 1.2 }, desc: 'Pumps oxygen-poor blood through the pulmonary artery to the lungs.', fact: 'It only needs low pressure because the lungs are right next to the heart.' },
    { name: 'Left Atrium', color: '#ff7f90', shapes: [{ t: 'sphere', c: [0.38, 0.5, -0.25], r: 0.36 }],
      anim: { type: 'pulse', amp: 0.06, freq: 1.2, phase: 2.2 }, desc: 'Receives oxygen-rich blood from the lungs through the pulmonary veins and passes it down to the left ventricle.' },
    { name: 'Right Atrium', color: '#ff9aa8', shapes: [{ t: 'sphere', c: [-0.5, 0.42, 0.05], r: 0.4 }],
      anim: { type: 'pulse', amp: 0.06, freq: 1.2, phase: 2.2 }, desc: 'Collects oxygen-poor blood returning from the body through the venae cavae.', fact: 'It holds the sinoatrial (SA) node — the heart\'s natural pacemaker that starts every heartbeat.' },
    { name: 'Aorta', color: '#ff3b3b', shapes: [
        { t: 'tube', pts: [[0.05, 0.25, 0], [0.08, 0.85, 0], [0.3, 1.25, -0.05], [0.65, 1.2, -0.15], [0.82, 0.75, -0.25], [0.85, 0.1, -0.3]], r: 0.15 },
        { t: 'cyl', c: [0.18, 1.45, -0.05], r: 0.055, h: 0.4 }, { t: 'cyl', c: [0.38, 1.45, -0.08], r: 0.055, h: 0.4 }, { t: 'cyl', c: [0.58, 1.4, -0.12], r: 0.055, h: 0.35 }],
      desc: 'The largest artery in the body. It carries oxygen-rich blood from the left ventricle to every organ.', fact: 'In adults it is about 2.5 cm wide — roughly the width of a garden hose.' },
    { name: 'Pulmonary Artery', color: '#4d7dff', shapes: [
        { t: 'tube', pts: [[-0.15, 0.2, 0.38], [-0.1, 0.75, 0.38], [0.1, 1.0, 0.28], [0.45, 1.0, 0.08]], r: 0.13 },
        { t: 'tube', pts: [[0.1, 1.0, 0.28], [-0.3, 1.05, 0.22], [-0.85, 0.95, 0.1]], r: 0.085 },
        { t: 'tube', pts: [[0.45, 1.0, 0.08], [0.95, 0.95, 0.0]], r: 0.085 }],
      desc: 'Carries oxygen-poor blood from the right ventricle to the lungs.', fact: 'After birth, it is the only artery in the body that carries deoxygenated blood.' },
    { name: 'Superior Vena Cava', color: '#3355ff', shapes: [{ t: 'cyl', c: [-0.55, 1.0, -0.05], r: 0.11, h: 0.8 }],
      desc: 'A large vein that returns blood from the head, neck, arms and upper chest to the right atrium.' },
    { name: 'Inferior Vena Cava', color: '#2f4fd8', shapes: [{ t: 'cyl', c: [-0.55, -0.25, -0.15], r: 0.12, h: 0.7 }],
      desc: 'Returns blood from the legs and lower body to the right atrium.', fact: 'It is the largest vein in the human body.' },
    { name: 'Pulmonary Veins', color: '#c86bff', shapes: [
        seg([0.45, 0.6, -0.4], [1.1, 0.72, -0.45], 0.06), seg([0.5, 0.4, -0.42], [1.1, 0.35, -0.5], 0.06),
        seg([0.25, 0.6, -0.45], [-0.2, 0.75, -0.6], 0.06), seg([0.25, 0.4, -0.45], [-0.2, 0.35, -0.62], 0.06)],
      desc: 'Bring freshly oxygenated blood from the lungs back into the left atrium.', fact: 'They are the only veins that carry oxygen-rich blood.' },
    { name: 'Tricuspid Valve', color: '#ffe066', shapes: [{ t: 'torus', c: [-0.35, 0.12, 0.12], R: 0.17, r: 0.035, rot: [20, 0, -10] }, { t: 'disk', c: [-0.35, 0.12, 0.12], r: 0.15, rot: [20, 0, -10], d: 0.5 }],
      desc: 'A three-flap valve between the right atrium and right ventricle. It snaps shut to stop blood flowing backwards.' },
    { name: 'Mitral Valve', color: '#ffd23f', shapes: [{ t: 'torus', c: [0.32, 0.1, -0.12], R: 0.16, r: 0.035, rot: [20, 0, 15] }, { t: 'disk', c: [0.32, 0.1, -0.12], r: 0.14, rot: [20, 0, 15], d: 0.5 }],
      desc: 'A two-flap (bicuspid) valve between the left atrium and left ventricle.', fact: 'The "lub" of a heartbeat is the sound of the mitral and tricuspid valves closing.' },
    { name: 'Coronary Arteries', color: '#ffae00', shapes: [
        { t: 'tube', pts: [[0.05, 0.4, 0.45], [0.0, 0.0, 0.62], [0.05, -0.5, 0.55], [0.15, -0.95, 0.3]], r: 0.035 },
        { t: 'tube', pts: [[0.05, 0.4, 0.45], [0.5, 0.25, 0.4], [0.75, -0.2, 0.15], [0.7, -0.6, -0.2]], r: 0.03 },
        { t: 'tube', pts: [[-0.1, 0.35, 0.5], [-0.6, 0.15, 0.45], [-0.75, -0.3, 0.15]], r: 0.03 }],
      desc: 'Arteries that wrap around the outside of the heart and feed the heart muscle itself with oxygen.', fact: 'A blockage in one of these is what causes a heart attack.' },
  ],
};

// ============================================================ ENGINE
const xs = [-1.5, -0.5, 0.5, 1.5], phases = [0, Math.PI, Math.PI, 0];
const engine = {
  id: 'engine', name: '4-Cylinder Car Engine', emoji: '🚗', category: 'Machines',
  about: 'An inline four-cylinder petrol engine, the kind in most everyday cars. Fuel burns above each piston, pushing it down; the crankshaft turns that push into rotation.',
  parts: [
    { name: 'Engine Block', color: '#7f93b0', d: 0.7, shapes: [{ t: 'box', c: [0, 0, 0], s: [4.2, 1.7, 1.5] }, ...xs.map(x => ({ t: 'cyl', c: [x, 0.2, 0], r: 0.37, h: 1.3, open: true, d: 0.6 }))],
      desc: 'The main cast-metal body of the engine. It holds the cylinders, coolant passages and crankshaft bearings.', fact: 'Most modern blocks are cast aluminium to save weight; older ones were cast iron.' },
    { name: 'Cylinder Head', color: '#a9b8d6', shapes: [{ t: 'box', c: [0, 1.12, 0], s: [4.2, 0.55, 1.45] }],
      desc: 'Bolts onto the top of the block and seals the cylinders. It holds the valves, ports and spark plugs.', fact: 'A "blown head gasket" means the seal between the head and the block has failed.' },
    ...xs.map((x, i) => ({
      name: `Piston ${i + 1}`, color: '#ff8a3d',
      shapes: [{ t: 'cyl', c: [x, 0.35, 0], r: 0.33, h: 0.45 }, { t: 'torus', c: [x, 0.5, 0], R: 0.335, r: 0.015, d: 2 }, { t: 'cyl', c: [x, -0.25, 0], r: 0.06, h: 0.85 }],
      anim: { type: 'bob', axis: [0, 1, 0], amp: 0.28, freq: 1, phase: phases[i] },
      desc: `Piston ${i + 1} slides up and down inside its cylinder. Burning fuel pushes it down, and the connecting rod turns that push into crankshaft rotation.`,
      fact: i === 0 ? 'Each piston repeats four strokes: intake, compression, power and exhaust. Pistons 1 & 4 move together, as do 2 & 3.' : '',
    })),
    { name: 'Crankshaft', color: '#33ddff', shapes: [{ t: 'cyl', c: [0, -0.85, 0], r: 0.11, h: 4.6, axis: 'x' }, ...xs.flatMap(x => [{ t: 'box', c: [x - 0.2, -0.95, 0], s: [0.08, 0.45, 0.35] }, { t: 'box', c: [x + 0.2, -0.95, 0], s: [0.08, 0.45, 0.35] }])],
      anim: { type: 'spin', axis: [1, 0, 0], speed: 6.283, pivot: [0, -0.85, 0] },
      desc: 'Turns the up-and-down motion of the pistons into the rotation that eventually drives the wheels.', fact: 'At highway speed it spins around 2,500–3,000 times a minute.' },
    { name: 'Camshaft', color: '#ffcc33', shapes: [{ t: 'cyl', c: [0, 1.5, 0], r: 0.07, h: 4.3, axis: 'x' }, ...xs.flatMap(x => [{ t: 'ellipsoid', c: [x - 0.2, 1.5, 0.05], r: [0.04, 0.11, 0.14] }, { t: 'ellipsoid', c: [x + 0.2, 1.5, -0.05], r: [0.04, 0.11, 0.14] }])],
      anim: { type: 'spin', axis: [1, 0, 0], speed: 3.1416, pivot: [0, 1.5, 0] },
      desc: 'Its egg-shaped lobes push the valves open and let them close, perfectly timed with the pistons.', fact: 'It turns at exactly half the speed of the crankshaft.' },
    { name: 'Flywheel', color: '#b9b9ff', shapes: [{ t: 'cyl', c: [2.45, -0.85, 0], r: 0.75, h: 0.12, axis: 'x' }, { t: 'torus', c: [2.45, -0.85, 0], R: 0.75, r: 0.04, axis: 'x' }],
      anim: { type: 'spin', axis: [1, 0, 0], speed: 6.283, pivot: [2.45, -0.85, 0] },
      desc: 'A heavy wheel that stores momentum, smooths out the power pulses and connects the engine to the clutch.' },
    { name: 'Spark Plugs', color: '#ffffff', shapes: xs.flatMap(x => [{ t: 'cyl', c: [x, 1.55, 0.3], r: 0.05, h: 0.45 }, { t: 'cyl', c: [x, 1.82, 0.3], r: 0.03, h: 0.12 }]),
      desc: 'Fire a high-voltage spark that ignites the compressed air–fuel mixture in each cylinder.', fact: 'Diesel engines have no spark plugs — the air gets hot enough from compression alone.' },
    { name: 'Oil Pan', color: '#6b7f99', shapes: [{ t: 'box', c: [0, -1.35, 0], s: [3.8, 0.55, 1.3] }],
      desc: 'The sump at the bottom of the engine that stores the oil which lubricates every moving part.' },
    { name: 'Intake Manifold', color: '#44ff99', shapes: [{ t: 'cyl', c: [0, 1.3, 1.35], r: 0.2, h: 3.6, axis: 'x' }, ...xs.map(x => ({ t: 'tube', pts: [[x, 1.05, 0.73], [x, 1.1, 1.0], [x, 1.25, 1.2]], r: 0.09 }))],
      desc: 'Shares out incoming air (or air–fuel mixture) evenly between the cylinders.' },
    { name: 'Exhaust Manifold', color: '#ff4466', shapes: [...xs.map(x => ({ t: 'tube', pts: [[x, 1.0, -0.74], [x, 0.85, -1.0], [(x + 2.0) / 2, 0.35, -1.15], [2.2, 0.0, -1.15]], r: 0.08 })), { t: 'cyl', c: [2.2, -0.4, -1.15], r: 0.12, h: 0.8 }],
      desc: 'Collects the hot exhaust gases from all four cylinders and channels them into the exhaust pipe.', fact: 'It can glow red-hot — over 600 °C — under heavy load.' },
    { name: 'Timing Belt', color: '#9b7bff', shapes: [
        { t: 'tube', closed: true, pts: [[-2.3, -1.07, 0], [-2.3, -0.85, 0.22], [-2.3, 1.5, 0.18], [-2.3, 1.68, 0], [-2.3, 1.5, -0.18], [-2.3, -0.85, -0.22]], r: 0.03 },
        { t: 'cyl', c: [-2.3, -0.85, 0], r: 0.2, h: 0.1, axis: 'x' }, { t: 'cyl', c: [-2.3, 1.5, 0], r: 0.17, h: 0.1, axis: 'x' }],
      desc: 'A toothed belt linking the crankshaft to the camshaft so the valves open at exactly the right moment.', fact: 'If it snaps in an "interference" engine, pistons can smash into open valves.' },
    { name: 'Alternator', color: '#ffee88', shapes: [{ t: 'cyl', c: [-2.0, 0.25, 0.95], r: 0.25, h: 0.4, axis: 'x' }],
      anim: { type: 'spin', axis: [1, 0, 0], speed: 10, pivot: [-2.0, 0.25, 0.95] },
      desc: 'A belt-driven generator that charges the battery and powers the car\'s electrics while the engine runs.' },
  ],
};

// ============================================================ GENERATOR (petrol)
const fr = 0.04;
const frameEdges = [
  [[-1.3, -0.7, -0.8], [1.3, -0.7, -0.8]], [[-1.3, -0.7, 0.8], [1.3, -0.7, 0.8]],
  [[-1.3, -0.7, -0.8], [-1.3, -0.7, 0.8]], [[1.3, -0.7, -0.8], [1.3, -0.7, 0.8]],
  [[-1.3, -0.7, -0.8], [-1.3, 1.25, -0.8]], [[-1.3, -0.7, 0.8], [-1.3, 1.25, 0.8]], [[-1.3, 1.25, -0.8], [-1.3, 1.25, 0.8]],
  [[1.3, -0.7, -0.8], [1.3, 1.25, -0.8]], [[1.3, -0.7, 0.8], [1.3, 1.25, 0.8]], [[1.3, 1.25, -0.8], [1.3, 1.25, 0.8]],
];
const generator = {
  id: 'generator', name: 'Petrol Generator', emoji: '⚡', category: 'Machines',
  about: 'A portable petrol generator — the familiar backup power source in many Nigerian homes and shops. A small engine spins a magnet inside copper coils to make electricity.',
  parts: [
    { name: 'Frame', color: '#ffcc00', shapes: [...frameEdges.map(([a, b]) => seg(a, b, fr)), ...[[-1.1, -0.78, -0.6], [1.1, -0.78, -0.6], [-1.1, -0.78, 0.6], [1.1, -0.78, 0.6]].map(c => ({ t: 'cyl', c, r: 0.08, h: 0.12 }))],
      desc: 'A steel tube frame that protects the generator, makes it easy to carry, and sits on rubber feet that absorb vibration.' },
    { name: 'Fuel Tank', color: '#ff3b3b', shapes: [{ t: 'ellipsoid', c: [0, 0.95, 0], r: [1.05, 0.28, 0.65] }, { t: 'cyl', c: [0.5, 1.25, 0], r: 0.1, h: 0.1 }],
      desc: 'Holds the petrol, which flows down to the carburettor by gravity.', fact: 'Always refuel with the engine off and cool — petrol vapour ignites very easily.' },
    { name: 'Engine', color: '#b8c4d6', shapes: [{ t: 'box', c: [-0.45, 0.0, 0], s: [0.95, 0.9, 0.85] }, { t: 'cyl', c: [-0.45, 0.05, -0.6], r: 0.22, h: 0.35, axis: 'z' }, ...[0, 1, 2, 3].map(i => ({ t: 'disk', c: [-0.45, 0.05, -0.47 - i * 0.08], r: 0.3, r0: 0.22, axis: 'z' }))],
      desc: 'A small single-cylinder, four-stroke petrol engine that spins the alternator.', fact: 'The fins on the cylinder are for air cooling — there is no radiator.' },
    { name: 'Alternator Housing', color: '#3fa9ff', d: 0.7, shapes: [{ t: 'cyl', c: [0.65, 0.0, 0], r: 0.45, h: 0.95, axis: 'x' }],
      desc: 'Holds the stator — fixed copper coils in which the electricity is actually induced.' },
    { name: 'Rotor', color: '#00ffd5', shapes: [{ t: 'cyl', c: [0.65, 0.0, 0], r: 0.28, h: 0.75, axis: 'x' }, { t: 'box', c: [0.65, 0.0, 0], s: [0.7, 0.62, 0.12] }],
      anim: { type: 'spin', axis: [1, 0, 0], speed: 14, pivot: [0.65, 0, 0] },
      desc: 'A spinning magnet driven by the engine. Its rotating magnetic field produces alternating current (AC) in the stator coils.', fact: 'A two-pole generator spins at 3,000 rpm to make 50 Hz power — the mains frequency used in Nigeria.' },
    { name: 'Recoil Starter', color: '#ff66cc', shapes: [{ t: 'cyl', c: [-1.02, 0.0, 0], r: 0.32, h: 0.12, axis: 'x' }, seg([-1.1, 0.0, 0.2], [-1.2, 0.0, 0.36], 0.025), { t: 'box', c: [-1.22, 0, 0.4], s: [0.06, 0.06, 0.2] }],
      desc: 'The pull-cord. Yanking it spins the engine fast enough to start it.' },
    { name: 'Air Filter', color: '#88ff66', shapes: [{ t: 'box', c: [-0.45, 0.6, 0.5], s: [0.45, 0.3, 0.22] }],
      desc: 'Cleans dust out of the air before it enters the carburettor. A clogged filter makes the generator struggle and smoke.' },
    { name: 'Carburettor', color: '#ffa94d', shapes: [{ t: 'box', c: [-0.8, 0.35, 0.45], s: [0.2, 0.2, 0.18] }, seg([-0.8, 0.45, 0.45], [-0.6, 0.55, 0.5], 0.03)],
      desc: 'Mixes air and petrol in the right ratio for burning. The choke lever richens the mix for a cold start.' },
    { name: 'Muffler', color: '#ff5533', shapes: [{ t: 'cyl', c: [-0.25, 0.3, -0.62], r: 0.17, h: 0.8, axis: 'x' }, seg([-0.45, 0.05, -0.8], [-0.45, 0.25, -0.65], 0.04)],
      desc: 'Quietens the exhaust and sends hot gases away from the operator.', fact: 'Never run a generator indoors or near windows: the exhaust contains carbon monoxide, which is colourless, odourless and deadly.' },
    { name: 'Control Panel', color: '#33ccff', shapes: [{ t: 'box', c: [0.65, 0.5, 0.62], s: [0.7, 0.38, 0.05] }, { t: 'disk', c: [0.45, 0.5, 0.66], r: 0.07, axis: 'z' }, { t: 'disk', c: [0.75, 0.5, 0.66], r: 0.07, axis: 'z' }, { t: 'box', c: [0.92, 0.58, 0.66], s: [0.1, 0.12, 0.02] }],
      desc: 'Holds the power sockets, on/off switch, circuit breaker and often a voltmeter.' },
    { name: 'Spark Plug', color: '#ffffff', shapes: [{ t: 'cyl', c: [-0.45, 0.05, -0.85], r: 0.04, h: 0.2, axis: 'z' }],
      desc: 'Ignites the fuel–air mixture inside the engine\'s single cylinder.' },
  ],
};

// ============================================================ ANIMAL CELL
const cr = rng(7);
const ribo = [];
while (ribo.length < 70) {
  const p = [(cr() * 2 - 1) * 1.8, (cr() * 2 - 1) * 1.35, (cr() * 2 - 1) * 1.55];
  if ((p[0] / 1.8) ** 2 + (p[1] / 1.35) ** 2 + (p[2] / 1.55) ** 2 < 1 && Math.hypot(p[0] - 0.2, p[1] - 0.15, p[2]) > 0.85) ribo.push({ t: 'sphere', c: p, r: 0.025 });
}
const mitoPos = [[-1.2, 0.6, 0.5, 20, 30, 10], [1.3, -0.5, 0.4, 0, -40, 30], [-0.6, -0.9, -0.6, 40, 10, -20], [1.0, 0.7, -0.7, -20, 60, 0], [-1.4, -0.3, -0.5, 0, 0, 70]];
const cell = {
  id: 'cell', name: 'Animal Cell', emoji: '🦠', category: 'Biology',
  about: 'The basic unit of life. Every part of your body is built from trillions of cells like this, each one with specialised "organelles" doing different jobs.',
  parts: [
    { name: 'Cell Membrane', ex: [0, 0, -2.2], color: '#66ccff', d: 0.55, shapes: [{ t: 'ellipsoid', c: [0, 0, 0], r: [2.2, 1.7, 1.9], j: 0.015 }],
      desc: 'A thin, flexible double layer of lipids and proteins. It controls what enters and leaves the cell.', fact: 'Plant cells have a rigid cell wall outside the membrane; animal cells do not.' },
    { name: 'Cytoplasm', ex: [0, 0, -1.2], color: '#2a5a8a', d: 0.12, shapes: [{ t: 'ellipsoid', c: [0, 0, 0], r: [2.1, 1.6, 1.8], v: true }],
      desc: 'The jelly-like fluid that fills the cell and holds the organelles. Many chemical reactions happen here.' },
    { name: 'Nucleus', ex: [0, 0.2, 1.3], color: '#cc66ff', shapes: [{ t: 'sphere', c: [0.2, 0.15, 0], r: 0.65 }, { t: 'sphere', c: [0.2, 0.15, 0], r: 0.6, d: 0.4 }],
      desc: 'The control centre. It stores the cell\'s DNA and directs growth, activity and reproduction.' },
    { name: 'Nucleolus', ex: [0.3, 0.4, 2.6], color: '#ff66cc', shapes: [{ t: 'sphere', c: [0.35, 0.25, 0.1], r: 0.22, v: true }],
      desc: 'A dense region inside the nucleus where ribosomes are made.' },
    { name: 'Mitochondria', ex: [-2.4, 1.1, 0.4], color: '#ff8833', shapes: mitoPos.flatMap(([x, y, z, a, b, c]) => [{ t: 'ellipsoid', c: [x, y, z], r: [0.32, 0.14, 0.14], rot: [a, b, c] }, { t: 'ellipsoid', c: [x, y, z], r: [0.25, 0.09, 0.09], rot: [a, b, c], d: 0.6 }]),
      desc: 'The powerhouse of the cell. Mitochondria release energy from glucose by aerobic respiration, producing ATP.', fact: 'They have their own DNA, inherited only from your mother.' },
    { name: 'Rough ER', ex: [1.9, 1.5, 0.6], color: '#33ffaa', shapes: [1.0, 1.12, 1.24].flatMap((R, i) => [{ t: 'torus', c: [0.2, 0.15, 0], R, r: 0.04, arc: 0.55, start: i * 30, rot: [70, 0, 10] }, { t: 'torus', c: [0.2, 0.15, 0], R: R - 0.05, r: 0.04, arc: 0.4, start: 200 + i * 20, rot: [-40, 0, 30] }]),
      desc: 'Folded membranes studded with ribosomes. It makes proteins and transports them around the cell.' },
    { name: 'Smooth ER', ex: [-0.4, 2.3, 0.4], color: '#a8ff5c', shapes: [{ t: 'tube', pts: [[-0.6, 0.8, -0.3], [-0.9, 1.0, 0.1], [-0.6, 1.15, 0.5], [-1.0, 0.9, 0.8], [-1.3, 1.0, 0.3]], r: 0.05 }, { t: 'tube', pts: [[1.0, -0.2, 0.9], [1.4, 0.1, 0.6], [1.6, -0.2, 0.2], [1.3, -0.1, -0.2]], r: 0.05 }],
      desc: 'A network of membrane tubes without ribosomes. It makes lipids and helps break down toxins.' },
    { name: 'Golgi Apparatus', ex: [-2.5, -0.8, 1.0], color: '#ffdd33', shapes: [...[0, 1, 2, 3, 4].map(i => ({ t: 'torus', c: [-1.05, -0.35 + i * 0.09, 0.65], R: 0.5 - i * 0.03, r: 0.025, arc: 0.35, start: 110, rot: [0, 30, 0] })), { t: 'sphere', c: [-0.6, -0.1, 0.9], r: 0.05 }, { t: 'sphere', c: [-0.55, -0.35, 1.0], r: 0.045 }],
      desc: 'A stack of flattened sacs that modifies, packages and ships proteins and lipids to where they are needed — the cell\'s post office.' },
    { name: 'Lysosomes', ex: [2.4, -1.1, 0.6], color: '#ff3366', shapes: [[0.9, -0.9, 0.6], [-0.3, -1.0, 0.9], [1.5, 0.3, -0.4], [-1.5, 0.4, -0.2]].map(c => ({ t: 'sphere', c, r: 0.12 })),
      desc: 'Small sacs full of digestive enzymes. They break down waste, bacteria and worn-out organelles.' },
    { name: 'Ribosomes', ex: [0, -2.3, 0.3], color: '#e0e0ff', shapes: ribo,
      desc: 'Tiny protein factories that join amino acids together. Some float free; others sit on the rough ER.' },
    { name: 'Centrosome', ex: [1.4, -2.0, 1.2], color: '#00e5ff', shapes: [{ t: 'cyl', c: [0.95, -0.95, 0.7], r: 0.05, h: 0.28 }, { t: 'cyl', c: [0.95, -0.95, 0.7], r: 0.05, h: 0.28, axis: 'x' }],
      desc: 'Organises microtubules and helps pull chromosomes apart when the cell divides.' },
    { name: 'Vacuoles', ex: [2.6, 0.4, -0.4], color: '#7aa2ff', shapes: [{ t: 'sphere', c: [1.3, 0.25, 0.9], r: 0.28 }, { t: 'sphere', c: [-0.3, 0.9, -1.0], r: 0.22 }],
      desc: 'Storage sacs for water, food and waste.', fact: 'Animal cells have several small vacuoles; plant cells have one large central vacuole.' },
  ],
};

// ============================================================ EARTH
const land = (x, y, z) => Math.sin(3.1 * x + 1.3) * Math.sin(2.7 * y + 0.4) * Math.sin(3.4 * z + 2.1) + 0.45 * Math.sin(6.1 * x + 5.2 * z) * Math.cos(5.5 * y) > 0.12;
const earth = {
  id: 'earth', name: 'Planet Earth (Layers)', emoji: '🌍', category: 'Geography',
  about: 'Earth is built in layers like an onion. Use the cut-away (X) to slice it open and see each layer, from the thin rocky crust down to the solid iron core.',
  parts: [
    { name: 'Inner Core', color: '#fff2a0', ex: [0, -1.2, 0], shapes: [{ t: 'sphere', r: 0.55, v: true }, { t: 'sphere', r: 0.55 }],
      desc: 'A solid ball of iron and nickel about 1,220 km in radius.', fact: 'At around 5,400 °C it is about as hot as the surface of the Sun — but the huge pressure keeps it solid.' },
    { name: 'Outer Core', color: '#ffaa33', ex: [0, -0.4, 0], shapes: [{ t: 'sphere', r: 1.05, r0: 0.6, v: true, d: 0.35 }, { t: 'sphere', r: 1.05 }],
      desc: 'A layer of liquid iron and nickel about 2,200 km thick.', fact: 'Swirling currents in this liquid metal generate Earth\'s magnetic field, which shields us from solar radiation.' },
    { name: 'Mantle', color: '#ff5522', ex: [0, 0.4, 0], shapes: [{ t: 'sphere', r: 1.85, r0: 1.1, v: true, d: 0.18 }, { t: 'sphere', r: 1.85, d: 0.6 }],
      desc: 'About 2,900 km of hot, slowly flowing rock — 84% of Earth\'s volume.', fact: 'Convection in the mantle moves the tectonic plates a few centimetres a year.' },
    { name: 'Oceanic Crust', color: '#2f8cff', ex: [0, 1.2, 0], shapes: [{ t: 'sphere', r: 2.0, mask: (x, y, z) => !land(x, y, z) }],
      desc: 'Thin (5–10 km), dense basalt crust that lies under the oceans.' },
    { name: 'Continental Crust', color: '#44dd66', ex: [0, 1.2, 0], shapes: [{ t: 'sphere', r: 2.02, mask: land }],
      desc: 'Thicker (30–50 km) but lighter granite crust that makes up the continents.', fact: 'If Earth were an apple, all of the crust together would be thinner than its skin.' },
    { name: 'Atmosphere', color: '#bfe6ff', d: 0.22, ex: [0, 2.0, 0], shapes: [{ t: 'sphere', r: 2.3 }],
      desc: 'A blanket of gases — about 78% nitrogen and 21% oxygen — that we breathe, and that drives our weather.' },
    { name: 'Moon', color: '#d8d8e8', shapes: [{ t: 'sphere', c: [4.2, 0.8, 0], r: 0.5 }],
      anim: { type: 'spin', axis: [0, 1, 0], speed: 0.35, pivot: [0, 0, 0] },
      desc: 'Earth\'s only natural satellite, on average 384,400 km away.', fact: 'Its gravity pulls on the oceans and causes the tides.' },
  ],
};

// ============================================================ SOLAR SYSTEM
const sr = rng(11);
const planets = [
  ['Mercury', 1.6, 0.08, '#c9b8a6', 1.6, 'The smallest planet and the closest to the Sun. A year there lasts only 88 Earth days.'],
  ['Venus', 2.1, 0.14, '#ffcf7a', 1.2, 'The hottest planet (about 465 °C) because its thick carbon-dioxide atmosphere traps heat.'],
  ['Earth', 2.7, 0.15, '#3d8bff', 1.0, 'Our home — the only planet known to have liquid water on its surface and life.'],
  ['Mars', 3.3, 0.11, '#ff6a3d', 0.8, 'The red planet. Its colour comes from iron oxide (rust) in the dust.'],
  ['Jupiter', 4.4, 0.38, '#e8b880', 0.43, 'The largest planet — more than 1,300 Earths would fit inside it. Its Great Red Spot is a storm bigger than Earth.'],
  ['Saturn', 5.4, 0.32, '#f3dca0', 0.32, 'Famous for its rings of ice and rock. It is so light it would float in a giant bathtub.'],
  ['Uranus', 6.3, 0.22, '#8fe3ff', 0.23, 'An ice giant that spins on its side, probably knocked over by an ancient collision.'],
  ['Neptune', 7.1, 0.21, '#5b74ff', 0.18, 'The windiest planet, with storms reaching over 2,000 km/h.'],
];
const solar = {
  id: 'solar', name: 'Solar System', emoji: '🪐', category: 'Space',
  about: 'The Sun and the eight planets that orbit it. Sizes and distances are not to scale — the real thing is mostly empty space.',
  parts: [
    { name: 'Sun', color: '#ffb52e', shapes: [{ t: 'sphere', r: 0.9, v: true, d: 0.6 }, { t: 'sphere', r: 0.9 }],
      desc: 'A star made of hot plasma. Nuclear fusion in its core turns hydrogen into helium and releases the light and heat that power life on Earth.', fact: 'It contains 99.8% of all the mass in the Solar System.' },
    ...planets.map(([name, dist, r, color, sp, desc], i) => {
      const a = sr() * Math.PI * 2, c = [dist * Math.cos(a), 0, dist * Math.sin(a)];
      const shapes = [{ t: 'sphere', c, r }];
      if (name === 'Saturn') shapes.push({ t: 'disk', c, r: 0.7, r0: 0.42, rot: [20, 0, 10], d: 0.5 });
      if (name === 'Uranus') shapes.push({ t: 'disk', c, r: 0.36, r0: 0.3, rot: [0, 0, 80], d: 0.25 });
      return { name, color, shapes, desc, ex: [0, (i + 1) * 0.12, 0], anim: { type: 'spin', axis: [0, 1, 0], speed: sp * 0.35, pivot: [0, 0, 0] } };
    }),
    { name: 'Asteroid Belt', color: '#9a8f80', d: 0.35, shapes: [{ t: 'disk', r: 3.95, r0: 3.7, j: 0.05 }], anim: { type: 'spin', axis: [0, 1, 0], speed: 0.2, pivot: [0, 0, 0] },
      desc: 'A ring of rocky leftovers from the formation of the planets, between Mars and Jupiter.' },
    { name: 'Orbits', color: '#3a4f80', d: 0.35, shapes: planets.map(([, dist]) => ({ t: 'torus', R: dist, r: 0.004 })),
      desc: 'The near-circular paths the planets follow, all in roughly the same flat plane.' },
  ],
};

// ============================================================ DNA
const dr = rng(5);
const H = 6, TURNS = 3, RADIUS = 0.7, RUNGS = 30;
const bases = { A: [], T: [], G: [], C: [] }, hbonds = [];
for (let i = 0; i < RUNGS; i++) {
  const t = (i + 0.5) / RUNGS, a = t * TURNS * Math.PI * 2, y = (t - 0.5) * H;
  const pa = [RADIUS * Math.cos(a) * 0.95, y, RADIUS * Math.sin(a) * 0.95], pb = [-pa[0], y, -pa[2]];
  const m1 = [pa[0] * 0.08, y, pa[2] * 0.08], m2 = [pb[0] * 0.08, y, pb[2] * 0.08];
  const pair = ['AT', 'TA', 'GC', 'CG'][Math.floor(dr() * 4)];
  bases[pair[0]].push(seg(pa, m1, 0.055)); bases[pair[1]].push(seg(pb, m2, 0.055));
  hbonds.push({ t: 'sphere', c: [0, y, 0], r: 0.035 });
}
const spinY = { type: 'spin', axis: [0, 1, 0], speed: 0.4, pivot: [0, 0, 0] };
const dna = {
  id: 'dna', name: 'DNA Double Helix', emoji: '🧬', category: 'Biology',
  about: 'Deoxyribonucleic acid — the molecule that carries genetic instructions. Two strands twist into a double helix, held together by pairs of bases.',
  parts: [
    { name: 'Sugar-Phosphate Backbone (strand 1)', color: '#33ccff', ex: [-1.3, 0, 0], anim: spinY, shapes: [{ t: 'helix', R: RADIUS, r: 0.07, h: H, turns: TURNS, phase: 0 }],
      desc: 'One of the two "rails" of the ladder, made of alternating sugar (deoxyribose) and phosphate groups.' },
    { name: 'Sugar-Phosphate Backbone (strand 2)', color: '#ff66cc', ex: [1.3, 0, 0], anim: spinY, shapes: [{ t: 'helix', R: RADIUS, r: 0.07, h: H, turns: TURNS, phase: Math.PI }],
      desc: 'The second strand. It runs in the opposite direction to the first — the strands are "antiparallel".' },
    { name: 'Adenine (A)', color: '#ffdd33', ex: [-0.6, 0, 0.9], anim: spinY, shapes: bases.A, desc: 'A purine base. It always pairs with thymine (T) using two hydrogen bonds.' },
    { name: 'Thymine (T)', color: '#33ff88', ex: [0.6, 0, 0.9], anim: spinY, shapes: bases.T, desc: 'A pyrimidine base that pairs with adenine (A). In RNA it is replaced by uracil (U).' },
    { name: 'Guanine (G)', color: '#ff7733', ex: [-0.6, 0, -0.9], anim: spinY, shapes: bases.G, desc: 'A purine base. It always pairs with cytosine (C) using three hydrogen bonds.' },
    { name: 'Cytosine (C)', color: '#9966ff', ex: [0.6, 0, -0.9], anim: spinY, shapes: bases.C, desc: 'A pyrimidine base that pairs with guanine (G).' },
    { name: 'Hydrogen Bonds', color: '#ffffff', anim: spinY, shapes: hbonds,
      desc: 'Weak bonds between paired bases that hold the two strands together but let them unzip when DNA is copied.', fact: 'If you stretched out the DNA in one human cell it would be about 2 metres long.' },
  ],
};

// ============================================================ ATOM (Carbon-12)
const ar = rng(3), nuc = [];
while (nuc.length < 12) {
  const p = [(ar() * 2 - 1) * 0.3, (ar() * 2 - 1) * 0.3, (ar() * 2 - 1) * 0.3];
  if (Math.hypot(...p) < 0.3 && nuc.every(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 0.17)) nuc.push(p);
  if (ar() < 0.001) break;
}
while (nuc.length < 12) nuc.push([(ar() - .5) * .5, (ar() - .5) * .5, (ar() - .5) * .5]);
const rot1 = [70, 0, 20], rot2 = [-55, 0, -35];
const electrons = (R, n, rot) => Array.from({ length: n }, (_, i) => ({ t: 'sphere', c: rotPoint([R * Math.cos(i * 2 * Math.PI / n), 0, R * Math.sin(i * 2 * Math.PI / n)], rot), r: 0.08, v: true, d: 3 }));
const atom = {
  id: 'atom', name: 'Carbon Atom', emoji: '⚛️', category: 'Chemistry',
  about: 'A carbon-12 atom shown with the Bohr model: 6 protons and 6 neutrons in the nucleus, and 6 electrons in two shells (2 + 4).',
  parts: [
    { name: 'Protons', color: '#ff4455', ex: [-0.9, 0, 0], shapes: nuc.filter((_, i) => i % 2 === 0).map(c => ({ t: 'sphere', c, r: 0.13 })),
      desc: 'Positively charged particles in the nucleus. The number of protons (6) is what makes this atom carbon.' },
    { name: 'Neutrons', color: '#7799ff', ex: [0.9, 0, 0], shapes: nuc.filter((_, i) => i % 2 === 1).map(c => ({ t: 'sphere', c, r: 0.13 })),
      desc: 'Neutral particles in the nucleus. Carbon-14, used in radiocarbon dating, simply has two extra neutrons.' },
    { name: 'Inner Shell (n=1)', color: '#00e5ff', shapes: [{ t: 'torus', R: 1.2, r: 0.008, rot: rot1, d: 3 }, ...electrons(1.2, 2, rot1)],
      anim: { type: 'spin', axis: normalAfterRot(rot1), speed: 2.2, pivot: [0, 0, 0] },
      desc: 'The first energy level. It can hold at most 2 electrons, and in carbon it is full.' },
    { name: 'Outer Shell (n=2)', color: '#b388ff', shapes: [{ t: 'torus', R: 2.1, r: 0.008, rot: rot2, d: 3 }, ...electrons(2.1, 4, rot2)],
      anim: { type: 'spin', axis: normalAfterRot(rot2), speed: 1.3, pivot: [0, 0, 0] },
      desc: 'The valence shell. Carbon has 4 electrons here, so it can form 4 bonds.', fact: 'Those 4 bonds let carbon build long chains and rings — the basis of all organic chemistry and of life.' },
    { name: 'Electron Cloud', color: '#2a4a99', d: 0.1, shapes: [{ t: 'sphere', r: 2.4, v: true }],
      desc: 'In reality electrons don\'t orbit like planets; quantum mechanics says they exist as a cloud of probability around the nucleus.' },
  ],
};

// ============================================================ WIND TURBINE
const HUB = [0, 3.15, 0.72];
const bladeSpin = { type: 'spin', axis: [0, 0, 1], speed: 1.2, pivot: HUB };
const turbine = {
  id: 'turbine', name: 'Wind Turbine', emoji: '🌬️', category: 'Energy',
  about: 'A horizontal-axis wind turbine. Wind turns the blades, a gearbox speeds up the rotation, and a generator in the nacelle turns it into electricity.',
  parts: [
    { name: 'Tower', color: '#a9c4ff', shapes: [{ t: 'cyl', c: [0, 0, 0], r: 0.28, r2: 0.13, h: 6, open: true }],
      desc: 'A tall tapered steel tube. Taller towers reach faster, steadier winds.', fact: 'Large modern towers are over 100 m tall.' },
    { name: 'Foundation', color: '#8a97ad', shapes: [{ t: 'cyl', c: [0, -3.12, 0], r: 0.9, h: 0.25 }],
      desc: 'A massive reinforced-concrete base that stops the turbine tipping over in storms.' },
    { name: 'Nacelle', color: '#9fd3ff', d: 0.8, shapes: [{ t: 'ellipsoid', c: [0, 3.15, -0.25], r: [0.32, 0.32, 0.85] }],
      desc: 'The housing on top of the tower that contains the gearbox, generator and controls.' },
    { name: 'Blades', color: '#ffffff', anim: bladeSpin, shapes: [0, 120, 240].map(th => ({ t: 'box', c: [-1.45 * Math.sin(th * D2R), 3.15 + 1.45 * Math.cos(th * D2R), 0.72], s: [0.26, 2.5, 0.05], rot: [0, 0, th] })),
      desc: 'Shaped like aeroplane wings. Air flowing over them creates lift, which turns the rotor.', fact: 'Three blades are the best balance of efficiency, cost and smooth running.' },
    { name: 'Hub', color: '#ffd166', anim: bladeSpin, shapes: [{ t: 'sphere', c: HUB, r: 0.2 }, { t: 'cyl', c: [0, 3.15, 0.95], r: 0.2, r2: 0.02, h: 0.35, axis: 'z' }],
      desc: 'Connects the blades to the main shaft. Pitch motors inside twist each blade to control speed.' },
    { name: 'Main Shaft', color: '#33ddff', anim: bladeSpin, shapes: [{ t: 'cyl', c: [0, 3.15, 0.35], r: 0.06, h: 0.6, axis: 'z' }],
      desc: 'Carries the slow, powerful rotation of the rotor into the gearbox.' },
    { name: 'Gearbox', color: '#ff9f43', shapes: [{ t: 'box', c: [0, 3.15, -0.15], s: [0.36, 0.36, 0.45] }],
      desc: 'Steps up the slow rotor speed (about 15 rpm) to the fast speed the generator needs (about 1,500 rpm).' },
    { name: 'Generator', color: '#00ffb3', shapes: [{ t: 'cyl', c: [0, 3.15, -0.72], r: 0.2, h: 0.45, axis: 'z' }], anim: { type: 'spin', axis: [0, 0, 1], speed: 8, pivot: [0, 3.15, -0.72] },
      desc: 'Converts the spinning motion into electricity using electromagnetic induction.' },
    { name: 'Yaw System', color: '#ff66aa', shapes: [{ t: 'torus', c: [0, 2.95, -0.15], R: 0.22, r: 0.04 }],
      desc: 'Motors that rotate the whole nacelle to keep the blades facing into the wind.' },
    { name: 'Transformer', color: '#c3a6ff', shapes: [{ t: 'box', c: [0.95, -2.75, 0.6], s: [0.4, 0.45, 0.35] }],
      desc: 'Raises the generator\'s voltage so the power can travel efficiently over the grid.' },
  ],
};

// ============================================================ DRONE
const motors = [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]];
const propNames = ['front-left', 'front-right', 'back-left', 'back-right'];
const drone = {
  id: 'drone', name: 'Quadcopter Drone', emoji: '🚁', category: 'Machines',
  about: 'A four-rotor drone. By changing the speed of each propeller independently, it can hover, climb, tilt and turn in any direction.',
  parts: [
    { name: 'Frame', color: '#9fb4d9', shapes: [{ t: 'box', c: [0, 0, 0], s: [0.9, 0.08, 0.9] }, ...motors.map(([x, z]) => seg([x * 0.27, 0, z * 0.27], [x, 0, z], 0.06))],
      desc: 'A light, stiff body — often carbon fibre — that holds everything together in an X shape.' },
    { name: 'Motors', color: '#ff7a59', shapes: motors.map(([x, z]) => ({ t: 'cyl', c: [x, 0.12, z], r: 0.14, h: 0.2 })),
      desc: 'Four brushless electric motors. Diagonal pairs spin in opposite directions so the drone doesn\'t spin itself around.' },
    ...motors.map(([x, z], i) => ({
      name: `Propeller (${propNames[i]})`, color: '#7cf7ff',
      shapes: [{ t: 'box', c: [x, 0.27, z], s: [0.95, 0.015, 0.09], rot: [0, 20 + i * 30, 0] }, { t: 'cyl', c: [x, 0.27, z], r: 0.04, h: 0.06 }],
      anim: { type: 'spin', axis: [0, 1, 0], speed: (i === 0 || i === 3 ? 1 : -1) * 22, pivot: [x, 0.27, z] },
      desc: `The ${propNames[i]} propeller. It pushes air down to create lift.`, fact: i === 0 ? 'To move forward, the drone speeds up its back propellers so it tilts and flies nose-first.' : '',
    })),
    { name: 'Battery', color: '#ffd23f', shapes: [{ t: 'box', c: [0, 0.17, 0], s: [0.6, 0.2, 0.3] }],
      desc: 'A lithium-polymer (LiPo) battery. It gives typical drones 20–30 minutes of flight.' },
    { name: 'Flight Controller', color: '#00ff9c', shapes: [{ t: 'box', c: [0, -0.09, 0], s: [0.3, 0.05, 0.3] }],
      desc: 'The drone\'s brain. Gyroscopes and accelerometers feed it data hundreds of times a second to keep it stable.' },
    { name: 'ESCs', color: '#ff4fa3', shapes: motors.map(([x, z]) => ({ t: 'box', c: [x * 0.55, 0.06, z * 0.55], s: [0.16, 0.04, 0.08], rot: [0, x * z > 0 ? -45 : 45, 0] })),
      desc: 'Electronic Speed Controllers — one per motor — that turn the flight controller\'s commands into motor power.' },
    { name: 'Camera Gimbal', color: '#d0d0ff', shapes: [{ t: 'sphere', c: [0, -0.38, -0.45], r: 0.14 }, { t: 'cyl', c: [0, -0.2, -0.45], r: 0.04, h: 0.22 }, { t: 'disk', c: [0, -0.38, -0.59], r: 0.06, axis: 'z' }],
      desc: 'Holds the camera and uses small motors to keep it level, so video stays smooth even when the drone tilts.' },
    { name: 'Landing Gear', color: '#8899aa', shapes: [seg([-0.3, -0.04, -0.3], [-0.45, -0.6, -0.35], 0.025), seg([-0.3, -0.04, 0.3], [-0.45, -0.6, 0.35], 0.025), seg([0.3, -0.04, -0.3], [0.45, -0.6, -0.35], 0.025), seg([0.3, -0.04, 0.3], [0.45, -0.6, 0.35], 0.025), seg([-0.45, -0.6, -0.55], [-0.45, -0.6, 0.55], 0.03), seg([0.45, -0.6, -0.55], [0.45, -0.6, 0.55], 0.03)],
      desc: 'Skids that protect the camera and body when landing.' },
    { name: 'GPS Module', color: '#66aaff', shapes: [{ t: 'disk', c: [0, 0.46, 0.25], r: 0.13 }, { t: 'cyl', c: [0, 0.34, 0.25], r: 0.015, h: 0.25 }],
      desc: 'Receives satellite signals so the drone knows its position, can hold still in wind, and can fly home automatically.' },
  ],
};

// ============================================================ NATIONAL THEATRE, LAGOS (stylised)
const ribs = Array.from({ length: 24 }, (_, k) => { const th = k * 15; return { t: 'box', c: [2.0 * Math.cos(th * D2R), 0.8, 2.0 * Math.sin(th * D2R)], s: [1.62, 0.05, 0.07], rot: [0, -th, -21.8] }; });
const stairs = [0, 90, 180, 270].flatMap(th => [0, 1, 2].map(i => { const rr = 3.05 + i * 0.18; return { t: 'box', c: [rr * Math.cos(th * D2R), -0.38 - i * 0.07, rr * Math.sin(th * D2R)], s: [0.18, 0.07, 0.9], rot: [0, -th, 0] }; }));
const theatre = {
  id: 'theatre', name: 'National Theatre, Lagos', emoji: '🎭', category: 'Landmarks',
  about: 'A stylised model of the National Arts Theatre in Iganmu, Lagos — Nigeria\'s premier centre for the performing arts, famous for its military-cap shape.',
  parts: [
    { name: 'Forecourt', color: '#5c6f99', d: 0.25, shapes: [{ t: 'disk', c: [0, -0.6, 0], r: 4.4, r0: 3.4, j: 0.01 }],
      desc: 'The open grounds around the building, used for festivals, exhibitions and events.' },
    { name: 'Podium', color: '#5f78ad', shapes: [{ t: 'cyl', c: [0, -0.4, 0], r: 3.0, h: 0.3 }],
      desc: 'The raised base the building sits on.' },
    { name: 'Main Hall Walls', color: '#ffb347', shapes: [{ t: 'cyl', c: [0, 0.1, 0], r: 2.35, h: 0.75, open: true }, ...[0.05, 0.3].map(y => ({ t: 'torus', c: [0, y, 0], R: 2.36, r: 0.015, d: 2 }))],
      desc: 'Encloses the main bowl — a hall with about 5,000 seats — plus a concert hall, cinemas and exhibition halls.' },
    { name: 'Roof Canopy', color: '#8fb0ff', shapes: [{ t: 'cyl', c: [0, 0.78, 0], r: 2.75, r2: 1.25, h: 0.6, open: true }],
      desc: 'The sloping roof whose outline gives the building its famous resemblance to a military officer\'s cap.' },
    { name: 'Roof Ribs', color: '#ffbf5a', shapes: ribs,
      desc: 'Radiating structural ribs that support the canopy and give the roof its pleated look.' },
    { name: 'Crown', color: '#c9d8ff', shapes: [{ t: 'cyl', c: [0, 1.2, 0], r: 1.25, h: 0.25, open: true }, { t: 'disk', c: [0, 1.33, 0], r: 1.25 }, { t: 'torus', c: [0, 1.33, 0], R: 1.25, r: 0.04 }],
      desc: 'The flat top of the "cap".', fact: 'The theatre was completed in 1976 to host FESTAC \'77, the Second World Black and African Festival of Arts and Culture.' },
    { name: 'Entrance Stairs', color: '#ff9e6b', shapes: stairs,
      desc: 'Stairways leading up to the entrances around the building.' },
  ],
};

// ============================================================ realism pass: materials, surface detail, flows
// tune(model, { 'Part name': { mat, flow, n, nf, nt } , '*': defaults })
function tune(m, map) {
  for (const p of m.parts) {
    const t = { ...(map['*'] || {}), ...(map[p.name] || {}) };
    if (t.mat && !p.mat) p.mat = t.mat;
    if (t.flow) p.flow = t.flow;
    if (t.n) p.shapes.forEach(sh => { if (sh.n == null && !sh.v) { sh.n = t.n; sh.nf = t.nf ?? 6; if (t.nt) sh.nt = t.nt; } });
  }
  return m;
}
const BLOOD = { speed: 0.7, strength: 1.8, k: 3 };
tune(heart, {
  '*': { mat: 'organic', n: 0.018, nf: 7 },
  'Aorta': { flow: BLOOD }, 'Pulmonary Artery': { flow: BLOOD }, 'Superior Vena Cava': { flow: { ...BLOOD, speed: -0.5 } },
  'Inferior Vena Cava': { flow: BLOOD }, 'Pulmonary Veins': { flow: { ...BLOOD, speed: -0.6 } }, 'Coronary Arteries': { flow: { speed: 0.9, strength: 2, k: 4 } },
  'Tricuspid Valve': { mat: 'plastic' }, 'Mitral Valve': { mat: 'plastic' },
});
tune(engine, {
  '*': { mat: 'metal' }, 'Intake Manifold': { mat: 'plastic', flow: { speed: -0.8, strength: 1.4, k: 3 } },
  'Exhaust Manifold': { flow: { speed: 0.9, strength: 2.2, k: 3 } }, 'Timing Belt': { mat: 'rubber', flow: { speed: 2, strength: 1.2, k: 12 } },
  'Spark Plugs': { mat: 'plastic' }, 'Oil Pan': { mat: 'metal' },
});
tune(generator, { '*': { mat: 'metal' }, 'Fuel Tank': { mat: 'plastic' }, 'Frame': { mat: 'plastic' }, 'Control Panel': { mat: 'plastic' }, 'Recoil Starter': { mat: 'plastic' }, 'Air Filter': { mat: 'plastic' },
  'Muffler': { flow: { speed: 1, strength: 2, k: 3 } }, 'Rotor': { flow: { speed: 2, strength: 1.5, k: 6 } } });
tune(cell, { '*': { mat: 'organic', n: 0.02, nf: 5 }, 'Cell Membrane': { mat: 'glass' }, 'Cytoplasm': { mat: 'glass' }, 'Smooth ER': { flow: { speed: 0.4, strength: 1.2, k: 3 } }, 'Rough ER': { flow: { speed: 0.3, strength: 1, k: 2 } } });
tune(dna, { '*': { mat: 'plastic' }, 'Sugar-Phosphate Backbone (strand 1)': { flow: { speed: 0.3, strength: 1.4, k: 6 } }, 'Sugar-Phosphate Backbone (strand 2)': { flow: { speed: -0.3, strength: 1.4, k: 6 } }, 'Hydrogen Bonds': { mat: 'glow' } });
tune(earth, { 'Inner Core': { mat: 'glow' }, 'Outer Core': { mat: 'glow', flow: { speed: 0.15, strength: 1, k: 4 } }, 'Mantle': { mat: 'organic', n: 0.03, nf: 3, flow: { speed: 0.08, strength: 0.8, k: 3 } },
  'Oceanic Crust': { mat: 'plastic' }, 'Continental Crust': { mat: 'matte', n: 0.015, nf: 9 }, 'Atmosphere': { mat: 'glass' }, 'Moon': { mat: 'matte', n: 0.02, nf: 11 } });
tune(solar, { '*': { mat: 'matte' }, 'Sun': { mat: 'glow', flow: { speed: 0.2, strength: 1.2, k: 5 } }, 'Orbits': { mat: 'glow' }, 'Jupiter': { mat: 'matte', n: 0.01, nf: 20 } });
tune(atom, { 'Protons': { mat: 'plastic' }, 'Neutrons': { mat: 'plastic' }, 'Inner Shell (n=1)': { mat: 'glow' }, 'Outer Shell (n=2)': { mat: 'glow' }, 'Electron Cloud': { mat: 'glow' } });
tune(turbine, { '*': { mat: 'plastic' }, 'Gearbox': { mat: 'metal' }, 'Main Shaft': { mat: 'metal' }, 'Yaw System': { mat: 'metal' }, 'Foundation': { mat: 'matte' }, 'Generator': { mat: 'metal', flow: { speed: 2, strength: 1.6, k: 5 } }, 'Transformer': { mat: 'metal' } });
tune(drone, { '*': { mat: 'plastic' }, 'Motors': { mat: 'metal' }, 'Camera Gimbal': { mat: 'metal' }, 'Landing Gear': { mat: 'rubber' } });
tune(theatre, { '*': { mat: 'matte' }, 'Main Hall Walls': { mat: 'glass' }, 'Crown': { mat: 'plastic' }, 'Roof Canopy': { mat: 'plastic' } });

const ALL = [heart, engine, generator, cell, dna, earth, solar, atom, turbine, drone, theatre, ...MORE_MODELS];
// The 16 most realistic models are shown by default; add ?all to the URL to see all 23.
const FEATURED = ['heart', 'eye', 'brain', 'lungs', 'digestive', 'cell', 'flower', 'dna', 'engine', 'generator', 'okada', 'danfo', 'phone', 'volcano', 'earth', 'solar'];
const showAll = typeof location !== 'undefined' && /[?&]all\b/.test(location.search);
export const MODELS = showAll ? ALL : FEATURED.map(id => ALL.find(m => m.id === id)).filter(Boolean);
