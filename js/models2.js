// BlaiseVR — 12 more built-in models: human body, plants, Nigerian transport & landmarks, physics, geography, tech.
import { rng } from './sampler.js';

const D2R = Math.PI / 180;
const seg = (a, b, r, extra = {}) => ({ t: 'tube', pts: [a, b], r, ...extra });
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = v => Math.hypot(...v);
// helix (spring/coil) between two points
const spring = (a, b, R, r, turns, extra = {}) => ({ t: 'helix', c: mid(a, b), axis: sub(b, a), h: len(sub(b, a)), R, r, turns, ...extra });

// ============================================================ HUMAN EYE
const eye = {
  id: 'eye', name: 'Human Eye', emoji: '👁️', category: 'Biology', autoCut: [3, 0.02],
  about: 'The eye works like a camera. Light passes through the cornea and lens, which focus it onto the retina; the retina turns it into nerve signals that travel along the optic nerve to the brain.',
  parts: [
    { name: 'Sclera', color: '#f4efe8', mat: 'organic', ex: [0, 0, -1.6], shapes: [{ t: 'sphere', r: 1.2, mask: (x, y, z) => z < 0.82, n: 0.01, nf: 8 }],
      desc: 'The tough white outer coat of the eyeball. It protects the eye and gives it its shape.', fact: 'Muscles attached to the sclera can move your eye in any direction in a fraction of a second.' },
    { name: 'Cornea', color: '#bfe8ff', mat: 'glass', ex: [0, 0, 1.9], shapes: [{ t: 'sphere', c: [0, 0, 0.42], r: 0.8, mask: (x, y, z) => z > 0.62 }],
      desc: 'The clear, dome-shaped window at the front of the eye. It does most of the focusing of light.', fact: 'The cornea has no blood vessels — it gets oxygen directly from the air and from tears.' },
    { name: 'Iris', color: '#7a4a24', mat: 'organic', ex: [0, 0, 1.35], shapes: [{ t: 'disk', c: [0, 0, 0.9], r: 0.55, r0: 0.2, axis: 'z', n: 0.01, nf: 25 }],
      anim: { type: 'pulse', amp: 0.03, freq: 0.15 },
      desc: 'The coloured ring of muscle. It widens or narrows the pupil to control how much light gets in.', fact: 'Brown is the most common eye colour in the world, and almost universal in Nigeria.' },
    { name: 'Pupil', color: '#34506e', mat: 'glass', ex: [0, 0, 1.15], shapes: [{ t: 'disk', c: [0, 0, 0.905], r: 0.2, axis: 'z' }],
      desc: 'The black hole in the middle of the iris that lets light into the eye. It looks black because light goes in and does not come back out.' },
    { name: 'Lens', color: '#e8f6ff', mat: 'glass', ex: [0, 0, 0.75], shapes: [{ t: 'ellipsoid', c: [0, 0, 0.68], r: [0.45, 0.45, 0.2] }],
      desc: 'A flexible, transparent disc behind the iris. Muscles change its shape to focus on near or far objects.', fact: 'As we age the lens stiffens, which is why many people need reading glasses after 40. A cloudy lens is a cataract.' },
    { name: 'Ciliary Body', color: '#d96a6a', mat: 'organic', ex: [0, 0, 0.55], shapes: [{ t: 'torus', c: [0, 0, 0.7], R: 0.56, r: 0.07, axis: 'z', n: 0.02, nf: 14 }],
      desc: 'A ring of muscle around the lens. Contracting it makes the lens rounder for close-up focus.' },
    { name: 'Aqueous Humour', color: '#9fe0ff', mat: 'glass', d: 0.35, ex: [0, 0, 1.6], shapes: [{ t: 'ellipsoid', c: [0, 0, 0.88], r: [0.62, 0.62, 0.12], v: true }],
      desc: 'Watery fluid filling the space between the cornea and lens. It nourishes the cornea and keeps the eye\'s pressure steady.', fact: 'If it cannot drain properly, pressure builds up — this is glaucoma.' },
    { name: 'Vitreous Humour', color: '#cfefff', mat: 'glass', d: 0.12, shapes: [{ t: 'sphere', c: [0, 0, -0.1], r: 1.05, v: true }],
      desc: 'Clear jelly that fills the main body of the eyeball and holds the retina in place.' },
    { name: 'Retina', color: '#ff6f61', mat: 'organic', ex: [0, 0, -0.9], shapes: [{ t: 'sphere', r: 1.12, mask: (x, y, z) => z < 0.45 }], flow: { speed: -0.4, strength: 1.2, k: 4 },
      desc: 'A thin layer of light-sensitive cells (rods and cones) lining the back of the eye. It turns light into electrical signals.', fact: 'The image on your retina is upside down — your brain flips it the right way up.' },
    { name: 'Fovea', color: '#ffe066', mat: 'glow', ex: [0, 0, -1.25], shapes: [{ t: 'sphere', c: [0, 0, -1.11], r: 0.09 }],
      desc: 'A tiny pit in the centre of the retina packed with cone cells. It gives the sharpest, most colourful vision.' },
    { name: 'Optic Nerve', color: '#ffd27a', mat: 'organic', ex: [0, 0, -2.2], shapes: [{ t: 'cyl', c: [0.25, 0, -1.6], r: 0.2, h: 1.0, axis: 'z' }], flow: { speed: 0.9, strength: 2.2, k: 3 },
      desc: 'A cable of over a million nerve fibres carrying signals from the retina to the brain.', fact: 'Where it leaves the eye there are no light cells — your "blind spot". Your brain fills in the gap.' },
    { name: 'Eye Muscles', color: '#c0392b', mat: 'organic', shapes: [{ t: 'ellipsoid', c: [0, 1.15, -0.35], r: [0.2, 0.08, 0.75], n: 0.02, nf: 12 }, { t: 'ellipsoid', c: [0, -1.15, -0.35], r: [0.2, 0.08, 0.75], n: 0.02, nf: 12 }, { t: 'ellipsoid', c: [1.15, 0, -0.35], r: [0.08, 0.2, 0.75], n: 0.02, nf: 12 }, { t: 'ellipsoid', c: [-1.15, 0, -0.35], r: [0.08, 0.2, 0.75], n: 0.02, nf: 12 }],
      desc: 'Six muscles attached to each eyeball (four shown) that rotate it up, down and side to side.' },
  ],
};

// ============================================================ HUMAN BRAIN
const gyri = { n: 0.055, nf: 9, nt: 'ridge' };
const hemi = (c, r, extra = {}) => [{ t: 'ellipsoid', c: [c[0], c[1], c[2]], r, ...gyri, ...extra }, { t: 'ellipsoid', c: [-c[0], c[1], c[2]], r, ...gyri, ...extra }];
const brain = {
  id: 'brain', name: 'Human Brain', emoji: '🧠', category: 'Biology',
  about: 'The control centre of the body: about 1.4 kg of tissue containing roughly 86 billion neurons. Each region (lobe) specialises in different jobs. The front of the brain faces you.',
  parts: [
    { name: 'Frontal Lobe', color: '#ff8fab', mat: 'organic', ex: [0, 0.3, 1.2], shapes: hemi([0.42, 0.35, 0.72], [0.48, 0.58, 0.7]),
      desc: 'Behind your forehead. It handles planning, decision-making, personality, speech and voluntary movement.', fact: 'It is the last part of the brain to fully mature — not until your mid-20s.' },
    { name: 'Parietal Lobe', color: '#ffd166', mat: 'organic', ex: [0, 1.2, -0.2], shapes: hemi([0.42, 0.72, -0.28], [0.48, 0.44, 0.58]),
      desc: 'At the top of the head. It processes touch, temperature, pain and your sense of where your body is in space.' },
    { name: 'Temporal Lobe', color: '#7bdff2', mat: 'organic', ex: [0, -0.6, 0.5], shapes: hemi([0.72, -0.22, 0.15], [0.3, 0.34, 0.72]),
      desc: 'At the sides, above the ears. It handles hearing, language understanding and memory.', fact: 'Deep inside it sits the hippocampus, which turns short-term memories into long-term ones.' },
    { name: 'Occipital Lobe', color: '#b388ff', mat: 'organic', ex: [0, 0.2, -1.3], shapes: hemi([0.38, 0.25, -0.95], [0.4, 0.44, 0.38]),
      desc: 'At the back of the head. It is the visual centre that makes sense of what your eyes see.' },
    { name: 'Cerebellum', color: '#44ff99', mat: 'organic', ex: [0, -0.9, -1.0], shapes: [{ t: 'ellipsoid', c: [0, -0.55, -0.82], r: [0.72, 0.33, 0.38], n: 0.035, nf: 22, nt: 'ridge' }],
      desc: 'The "little brain" at the back. It coordinates balance, posture and smooth, precise movement.', fact: 'It holds more than half of all the brain\'s neurons despite being only about 10% of its size.' },
    { name: 'Brainstem', color: '#ffb347', mat: 'organic', ex: [0, -1.3, 0], shapes: [{ t: 'cyl', c: [0, -0.95, -0.3], r: 0.17, r2: 0.24, h: 0.95, rot: [-15, 0, 0] }], flow: { speed: 0.8, strength: 2, k: 3 },
      desc: 'Connects the brain to the spinal cord. It runs automatic functions like breathing, heart rate and swallowing.' },
    { name: 'Spinal Cord', color: '#ffe0a3', mat: 'organic', ex: [0, -1.8, 0], shapes: [{ t: 'cyl', c: [0, -1.7, -0.48], r: 0.12, h: 0.7, rot: [-12, 0, 0] }], flow: { speed: 0.8, strength: 2, k: 3 },
      desc: 'The main highway of nerves running down your back, carrying messages between the brain and the body.' },
    { name: 'Corpus Callosum', color: '#ffffff', mat: 'organic', ex: [0, 0.6, 0], shapes: [{ t: 'tube', pts: [[0, 0.3, 0.55], [0, 0.55, 0.15], [0, 0.52, -0.35], [0, 0.28, -0.6]], r: 0.08 }], flow: { speed: 0.6, strength: 1.6, k: 4 },
      desc: 'A thick band of about 200 million nerve fibres linking the left and right halves of the brain.' },
    { name: 'Thalamus', color: '#ff6f91', mat: 'organic', ex: [0.9, 0, 0], shapes: [{ t: 'ellipsoid', c: [0.12, 0.02, -0.12], r: [0.13, 0.15, 0.22] }, { t: 'ellipsoid', c: [-0.12, 0.02, -0.12], r: [0.13, 0.15, 0.22] }],
      desc: 'The brain\'s relay station. Almost every sense (except smell) passes through here on its way to the cortex.' },
    { name: 'Hypothalamus', color: '#ffe066', mat: 'organic', ex: [-0.9, -0.2, 0.3], shapes: [{ t: 'sphere', c: [0, -0.2, 0.12], r: 0.1 }],
      desc: 'A tiny region that controls body temperature, hunger, thirst, sleep and hormones.' },
    { name: 'Pituitary Gland', color: '#ff4fd8', mat: 'glow', ex: [0, -0.7, 1.0], shapes: [{ t: 'sphere', c: [0, -0.42, 0.3], r: 0.07 }],
      desc: 'The pea-sized "master gland". It releases hormones that control growth and many other glands.' },
  ],
};

// ============================================================ LUNGS
const lr = rng(21), bronchioles = [], alveoli = [];
function branch(a, dir, L, depth) {
  const b = [a[0] + dir[0] * L, a[1] + dir[1] * L, a[2] + dir[2] * L];
  bronchioles.push(seg(a, b, 0.055 * Math.pow(0.66, 3 - depth)));
  if (depth <= 0) { for (let k = 0; k < 3; k++) alveoli.push({ t: 'sphere', c: [b[0] + (lr() - .5) * .12, b[1] + (lr() - .5) * .12, b[2] + (lr() - .5) * .12], r: 0.04 }); return; }
  for (const s of [-1, 1]) {
    const d = [dir[0] + s * 0.55 + (lr() - .5) * .3, dir[1] - 0.25 + (lr() - .5) * .3, dir[2] + (lr() - .5) * 0.9];
    const l = Math.hypot(...d); branch(b, d.map(x => x / l), L * 0.72, depth - 1);
  }
}
branch([-0.55, 0.42, 0], [-0.35, -0.94, 0], 0.55, 3);
branch([0.55, 0.48, 0], [0.35, -0.94, 0], 0.55, 3);
const breathe = { type: 'pulse', amp: 0.05, freq: 0.22 };
const lungs = {
  id: 'lungs', name: 'Lungs & Airways', emoji: '🫁', category: 'Biology',
  about: 'The respiratory system brings oxygen into the body and removes carbon dioxide. Air flows down the trachea, through branching bronchi, into millions of tiny air sacs called alveoli.',
  parts: [
    { name: 'Larynx', color: '#ffd166', mat: 'organic', shapes: [{ t: 'cyl', c: [0, 2.45, 0], r: 0.2, r2: 0.17, h: 0.38 }],
      desc: 'The voice box. Air passing over the vocal cords inside it makes them vibrate to produce sound.' },
    { name: 'Trachea', color: '#ffe8d6', mat: 'organic', shapes: [{ t: 'cyl', c: [0, 1.6, 0], r: 0.14, h: 1.35, open: true }, ...Array.from({ length: 7 }, (_, i) => ({ t: 'torus', c: [0, 1.05 + i * 0.18, 0], R: 0.145, r: 0.025 }))], flow: { speed: -0.6, strength: 1.6, k: 3 },
      desc: 'The windpipe — a tube held open by C-shaped rings of cartilage, carrying air to the lungs.', fact: 'Tiny hairs (cilia) lining it sweep dust and germs back up towards the throat.' },
    { name: 'Bronchi', color: '#ffc8a2', mat: 'organic', shapes: [{ t: 'tube', pts: [[0, 0.95, 0], [-0.3, 0.68, 0], [-0.55, 0.42, 0]], r: 0.1 }, { t: 'tube', pts: [[0, 0.95, 0], [0.3, 0.72, 0], [0.55, 0.48, 0]], r: 0.1 }], flow: { speed: -0.6, strength: 1.6, k: 2 },
      desc: 'The two main branches of the trachea, one going into each lung.' },
    { name: 'Bronchioles', color: '#ffa8b8', mat: 'organic', shapes: bronchioles, flow: { speed: -0.7, strength: 1.4, k: 2 },
      desc: 'Smaller and smaller branches of the airways — like the branches of an upside-down tree.' },
    { name: 'Alveoli', color: '#ff5c8a', mat: 'organic', shapes: alveoli, anim: breathe,
      desc: 'Hundreds of millions of tiny air sacs where oxygen passes into the blood and carbon dioxide passes out.', fact: 'Spread flat, the alveoli in your lungs would cover about half a tennis court.' },
    { name: 'Left Lung', color: '#ff8fa3', mat: 'organic', d: 0.7, ex: [-1.4, 0, 0], shapes: [{ t: 'ellipsoid', c: [-0.85, -0.25, 0], r: [0.62, 1.15, 0.58], n: 0.025, nf: 5 }], anim: breathe,
      desc: 'Has two lobes. It is a little smaller than the right lung to make room for the heart.' },
    { name: 'Right Lung', color: '#ff99ad', mat: 'organic', d: 0.7, ex: [1.4, 0, 0], shapes: [{ t: 'ellipsoid', c: [0.88, -0.2, 0], r: [0.68, 1.2, 0.6], n: 0.025, nf: 5 }], anim: breathe,
      desc: 'Has three lobes and is slightly bigger than the left lung.', fact: 'An adult breathes in and out roughly 20,000 times a day.' },
    { name: 'Diaphragm', color: '#e63946', mat: 'organic', ex: [0, -1.2, 0], shapes: [{ t: 'sphere', c: [0, -2.75, 0], r: 1.65, mask: (x, y) => y > 0.5, n: 0.015, nf: 10 }], anim: { type: 'bob', axis: [0, -1, 0], amp: 0.08, freq: 0.22 },
      desc: 'A dome-shaped sheet of muscle under the lungs. When it contracts and flattens, air is pulled into the lungs.', fact: 'Hiccups are sudden, involuntary spasms of the diaphragm.' },
  ],
};

// ============================================================ DIGESTIVE SYSTEM
const gi = rng(9), smallInt = [];
for (let i = 0; i <= 34; i++) { const t = i / 34; smallInt.push([Math.sin(t * Math.PI * 7) * 0.55 * (0.6 + 0.4 * Math.sin(t * 9)), -0.05 - t * 0.85 + Math.sin(t * Math.PI * 13) * 0.06, 0.2 + Math.cos(t * Math.PI * 5) * 0.22 + (gi() - .5) * .05]); }
const food = { speed: 0.25, strength: 1.4, k: 4 };
const digestive = {
  id: 'digestive', name: 'Digestive System', emoji: '🍲', category: 'Biology',
  about: 'Your body\'s food-processing line, about 9 metres long. Food is broken down by chewing, acids and enzymes, nutrients are absorbed into the blood, and waste is removed.',
  parts: [
    { name: 'Mouth', color: '#ff8fa3', mat: 'organic', shapes: [{ t: 'ellipsoid', c: [0, 2.75, 0.12], r: [0.3, 0.12, 0.22] }],
      desc: 'Where digestion starts. Teeth chew food and saliva begins breaking down starch.' },
    { name: 'Oesophagus', color: '#ffb4a2', mat: 'organic', shapes: [{ t: 'tube', pts: [[0, 2.62, 0.05], [0, 1.8, 0.02], [0.1, 1.02, 0]], r: 0.07 }], flow: food,
      desc: 'A muscular tube that squeezes food from the throat down to the stomach in waves (peristalsis).', fact: 'Thanks to peristalsis you could swallow even while standing on your head.' },
    { name: 'Stomach', color: '#ff7b54', mat: 'organic', shapes: [{ t: 'tube', pts: [[0.1, 1.02, 0], [0.45, 0.95, 0.05], [0.62, 0.6, 0.1], [0.45, 0.25, 0.12], [0.1, 0.25, 0.12]], r: 0.27, n: 0.02, nf: 9 }], anim: { type: 'pulse', amp: 0.025, freq: 0.3 },
      desc: 'A stretchy, muscular bag that churns food with strong acid and enzymes into a thick liquid.', fact: 'Stomach acid is strong enough to dissolve metal; a mucus lining stops it digesting the stomach itself.' },
    { name: 'Liver', color: '#9b2c2c', mat: 'organic', shapes: [{ t: 'ellipsoid', c: [-0.55, 0.88, 0.15], r: [0.78, 0.36, 0.45], rot: [0, 0, -12], n: 0.015, nf: 6 }],
      desc: 'The largest internal organ. It makes bile to digest fat, stores energy and removes toxins from the blood.', fact: 'The liver can regrow to full size even after up to two-thirds of it is removed.' },
    { name: 'Gallbladder', color: '#2ecc71', mat: 'organic', shapes: [{ t: 'ellipsoid', c: [-0.42, 0.52, 0.48], r: [0.1, 0.17, 0.1] }],
      desc: 'A small pouch that stores bile from the liver and squeezes it into the small intestine after a fatty meal.' },
    { name: 'Pancreas', color: '#ffd27a', mat: 'organic', shapes: [{ t: 'tube', pts: [[0.6, 0.38, -0.2], [0.15, 0.25, -0.15], [-0.25, 0.15, -0.1]], r: 0.09, n: 0.02, nf: 14 }],
      desc: 'Makes digestive enzymes, and also the hormone insulin, which controls blood sugar.', fact: 'Diabetes happens when the body cannot make or use insulin properly.' },
    { name: 'Small Intestine', color: '#ffb3c6', mat: 'organic', shapes: [{ t: 'tube', pts: smallInt, r: 0.075 }], flow: food,
      desc: 'A coiled tube about 6–7 m long where most digestion finishes and nutrients are absorbed into the blood.', fact: 'Millions of finger-like villi give it the surface area of a small apartment.' },
    { name: 'Large Intestine', color: '#c77dff', mat: 'organic', shapes: [{ t: 'tube', pts: [[-0.45, -1.05, 0.12], [-0.82, -0.9, 0.1], [-0.88, 0.05, 0.1], [-0.5, 0.2, 0.18], [0.5, 0.2, 0.18], [0.88, 0.05, 0.1], [0.88, -0.9, 0.1], [0.5, -1.15, 0.05], [0.15, -1.25, 0.0]], r: 0.14, n: 0.03, nf: 12, nt: 'ridge' }], flow: { speed: 0.12, strength: 1.2, k: 3 },
      desc: 'Also called the colon. It absorbs water from leftover material, turning it into solid waste.', fact: 'Trillions of helpful bacteria live here, making vitamins and protecting you from germs.' },
    { name: 'Appendix', color: '#ff66aa', mat: 'organic', shapes: [{ t: 'tube', pts: [[-0.5, -1.08, 0.12], [-0.46, -1.25, 0.16], [-0.38, -1.38, 0.18]], r: 0.03 }],
      desc: 'A small finger-shaped pouch off the large intestine. It may store helpful gut bacteria.' },
    { name: 'Rectum', color: '#9d4edd', mat: 'organic', shapes: [{ t: 'tube', pts: [[0.15, -1.25, 0], [0.02, -1.5, -0.05], [0, -1.78, -0.05]], r: 0.09 }],
      desc: 'The last part of the large intestine, which stores waste until you go to the toilet.' },
  ],
};

// ============================================================ FLOWER
const petals = Array.from({ length: 5 }, (_, k) => { const th = k * 72; return { t: 'ellipsoid', c: [0.72 * Math.cos(th * D2R), 0.32, 0.72 * Math.sin(th * D2R)], r: [0.62, 0.035, 0.36], rot: [0, -th, 22], n: 0.02, nf: 8 }; });
const sepals = Array.from({ length: 5 }, (_, k) => { const th = k * 72 + 36; return { t: 'ellipsoid', c: [0.34 * Math.cos(th * D2R), -0.05, 0.34 * Math.sin(th * D2R)], r: [0.3, 0.025, 0.13], rot: [0, -th, -25] }; });
const fils = [], anthers = [];
for (let k = 0; k < 10; k++) { const th = k * 36, e = [0.3 * Math.cos(th * D2R), 0.95, 0.3 * Math.sin(th * D2R)]; fils.push({ t: 'tube', pts: [[0.05 * Math.cos(th * D2R), 0.15, 0.05 * Math.sin(th * D2R)], [0.18 * Math.cos(th * D2R), 0.6, 0.18 * Math.sin(th * D2R)], e], r: 0.015 }); anthers.push({ t: 'ellipsoid', c: e, r: [0.05, 0.08, 0.05] }); }
const sway = { type: 'swing', axis: [0, 0, 1], amp: 0.04, freq: 0.25, pivot: [0, -2.3, 0] };
const flower = {
  id: 'flower', name: 'Flower (Hibiscus)', emoji: '🌺', category: 'Biology',
  about: 'A complete flower like the hibiscus that grows all over Nigeria. It has both male parts (stamens) and female parts (the pistil), surrounded by colourful petals that attract pollinators.',
  parts: [
    { name: 'Petals', ex: [0, 0.15, 0], color: '#ff2e63', mat: 'organic', anim: [sway, { type: 'pulse', amp: 0.02, freq: 0.2 }], shapes: petals,
      desc: 'Brightly coloured leaves that attract insects and birds to carry pollen.', fact: 'Many petals have ultraviolet patterns that only bees can see, guiding them to the nectar.' },
    { name: 'Sepals', ex: [0, -0.7, 0], color: '#3fd16a', mat: 'organic', anim: sway, shapes: sepals,
      desc: 'Small green leaf-like parts that protected the flower when it was still a bud.' },
    { name: 'Filaments', ex: [-1.0, 0.9, 0.2], color: '#ffe8a3', mat: 'organic', anim: sway, shapes: fils,
      desc: 'The thin stalks of the stamens that hold the anthers up.' },
    { name: 'Anthers', ex: [-1.0, 1.6, 0.2], color: '#ffc300', mat: 'organic', anim: sway, shapes: anthers,
      desc: 'Produce pollen — the male sex cells of the plant. Filament + anther = stamen.' },
    { name: 'Stigma', ex: [1.0, 1.9, 0.2], color: '#ff8c42', mat: 'organic', anim: sway, shapes: [{ t: 'sphere', c: [0, 1.15, 0], r: 0.09, n: 0.02, nf: 30 }],
      desc: 'The sticky tip of the pistil that catches pollen.' },
    { name: 'Style', ex: [1.0, 1.1, 0.2], color: '#c6f68d', mat: 'organic', anim: sway, shapes: [{ t: 'cyl', c: [0, 0.68, 0], r: 0.035, h: 0.9 }], flow: { speed: -0.5, strength: 1.8, k: 2 },
      desc: 'The tube connecting stigma to ovary. A pollen tube grows down it to deliver the male cell.' },
    { name: 'Ovary', ex: [1.0, 0.25, 0.2], color: '#9be564', mat: 'organic', anim: sway, shapes: [{ t: 'ellipsoid', c: [0, 0.18, 0], r: [0.15, 0.17, 0.15] }],
      desc: 'Contains the ovules. After fertilisation the ovary becomes the fruit.', fact: 'Stigma + style + ovary together make up the pistil (or carpel).' },
    { name: 'Ovules', ex: [1.8, 0.25, 0.2], color: '#ffffff', mat: 'plastic', anim: sway, shapes: Array.from({ length: 6 }, (_, k) => ({ t: 'sphere', c: [0.06 * Math.cos(k), 0.12 + (k % 3) * 0.05, 0.06 * Math.sin(k)], r: 0.028 })),
      desc: 'Tiny structures inside the ovary that become seeds after fertilisation.' },
    { name: 'Receptacle', ex: [0, -1.1, 0.3], color: '#6bdc6b', mat: 'organic', anim: sway, shapes: [{ t: 'ellipsoid', c: [0, 0, 0], r: [0.24, 0.16, 0.24] }],
      desc: 'The swollen top of the stalk that all the flower parts grow from.' },
    { name: 'Stalk & Leaf', ex: [0, -1.5, 0], color: '#2fae49', mat: 'organic', anim: sway, shapes: [{ t: 'tube', pts: [[0, -0.12, 0], [0.05, -1.0, 0], [-0.05, -2.3, 0]], r: 0.06 }, { t: 'ellipsoid', c: [0.62, -1.3, 0], r: [0.58, 0.025, 0.25], rot: [0, 0, 25], n: 0.015, nf: 12 }],
      desc: 'The stalk (pedicel) supports the flower and carries water up from the roots; the leaf makes food by photosynthesis.' },
  ],
};

// ============================================================ PLANT CELL
const pc = rng(4);
const chloro = [[-1.3, 0.75, 0.5], [1.35, -0.7, 0.45], [-1.4, -0.65, -0.4], [0.2, 0.85, -0.55], [1.4, 0.7, -0.35], [-0.6, -0.85, 0.55], [0.5, -0.88, -0.5], [-1.45, 0.1, 0.55]];
const plantCell = {
  id: 'plantcell', name: 'Plant Cell', emoji: '🌿', category: 'Biology', autoCut: [2, 0.12],
  about: 'A typical plant cell. Compared with an animal cell it has three extra features: a rigid cell wall, chloroplasts for photosynthesis, and a large permanent vacuole.',
  parts: [
    { name: 'Cell Wall', color: '#5cd65c', mat: 'matte', d: 0.8, ex: [0, 0, -2.3], shapes: [{ t: 'rbox', s: [3.4, 2.2, 1.6], rad: 0.28, n: 0.01, nf: 10 }],
      desc: 'A tough layer of cellulose outside the membrane that gives the cell strength and a fixed shape.', fact: 'Cellulose from plant cell walls is the most common organic substance on Earth — paper and cotton are made of it.' },
    { name: 'Cell Membrane', color: '#a0e7ff', mat: 'glass', d: 0.45, ex: [0, 0, -1.5], shapes: [{ t: 'rbox', s: [3.25, 2.05, 1.45], rad: 0.24 }],
      desc: 'A thin layer just inside the wall that controls what enters and leaves the cell.' },
    { name: 'Cytoplasm', color: '#1e6b4a', mat: 'glass', d: 0.08, shapes: [{ t: 'rbox', s: [3.1, 1.9, 1.3], rad: 0.2, v: true }],
      desc: 'Jelly-like fluid where most of the cell\'s chemical reactions take place.' },
    { name: 'Large Vacuole', color: '#8fd3ff', mat: 'glass', ex: [0, 0, 1.6], shapes: [{ t: 'ellipsoid', c: [-0.25, 0, 0], r: [1.0, 0.62, 0.46] }, { t: 'ellipsoid', c: [-0.25, 0, 0], r: [0.95, 0.58, 0.42], v: true, d: 0.15 }],
      desc: 'A big sac of cell sap. When full of water it pushes outwards, keeping the plant firm.', fact: 'When plants wilt, it\'s because their vacuoles have lost water.' },
    { name: 'Nucleus', color: '#c77dff', mat: 'organic', ex: [1.4, 0.8, 0.6], shapes: [{ t: 'sphere', c: [1.05, 0.35, 0.1], r: 0.36, n: 0.01, nf: 12 }, { t: 'sphere', c: [1.1, 0.4, 0.15], r: 0.12, v: true, color: '#ff66cc' }],
      desc: 'Contains the DNA and controls the cell\'s activities.' },
    { name: 'Chloroplasts', color: '#29c34a', mat: 'organic', ex: [0, 1.7, 0], anim: { type: 'spin', axis: [0, 1, 0], speed: 0.12, pivot: [0, 0, 0] },
      shapes: chloro.flatMap(([x, y, z]) => { const a = pc() * 180; return [{ t: 'ellipsoid', c: [x, y, z], r: [0.24, 0.11, 0.13], rot: [0, a, 0] }, ...[-0.08, 0, 0.08].map(o => ({ t: 'disk', c: [x + o, y, z], r: 0.07, axis: 'x', color: '#7dff8a', d: 2 }))]; }),
      desc: 'Green organelles that use sunlight to make glucose from carbon dioxide and water — photosynthesis.', fact: 'They contain chlorophyll, the pigment that makes leaves green. They drift around the cell in "cytoplasmic streaming".' },
    { name: 'Mitochondria', color: '#ff8833', mat: 'organic', ex: [0, -1.6, 0.5], shapes: [[0.4, 0.55, 0.45], [1.3, -0.25, -0.4], [-0.9, -0.55, -0.45]].map(c => ({ t: 'ellipsoid', c, r: [0.22, 0.1, 0.1], rot: [0, pc() * 180, pc() * 60], n: 0.01, nf: 20, nt: 'ridge' })),
      desc: 'Release energy from glucose through respiration — plants need them too, day and night.' },
    { name: 'Golgi Apparatus', color: '#ffdd33', mat: 'organic', ex: [1.8, -0.6, 0.8], shapes: [0, 1, 2, 3].map(i => ({ t: 'torus', c: [0.9, -0.45 + i * 0.07, 0.35], R: 0.32 - i * 0.02, r: 0.02, arc: 0.4, start: 100, rot: [0, 20, 0] })),
      desc: 'Packages proteins and helps build materials for the cell wall.' },
    { name: 'Plasmodesmata', color: '#e0ffb3', mat: 'glow', shapes: [[1.7, 0.4, 0], [1.7, -0.4, 0.2], [-1.7, 0.2, -0.2], [0, 1.1, 0.3]].map(c => ({ t: 'cyl', c, r: 0.03, h: 0.2, axis: Math.abs(c[0]) > 1 ? 'x' : 'y' })), flow: { speed: 0.8, strength: 2, k: 2 },
      desc: 'Tiny channels through the cell wall that connect neighbouring cells so they can share water and nutrients.' },
  ],
};

// ============================================================ OKADA (motorcycle)
const wheel = (x) => {
  const c = [x, -0.65, 0];
  return [{ t: 'torus', c, R: 0.55, r: 0.1, axis: 'z', color: '#5a6170', mat: 'rubber' }, { t: 'torus', c, R: 0.44, r: 0.025, axis: 'z', color: '#d9dee8', mat: 'metal' },
    { t: 'cyl', c, r: 0.08, h: 0.16, axis: 'z', color: '#c0c8d6', mat: 'metal' },
    ...Array.from({ length: 12 }, (_, k) => { const a = k * 30 * D2R; return seg([x + 0.07 * Math.cos(a), -0.65 + 0.07 * Math.sin(a), (k % 2 ? 0.05 : -0.05)], [x + 0.43 * Math.cos(a + 0.2), -0.65 + 0.43 * Math.sin(a + 0.2), 0], 0.007, { color: '#e8ecf2', mat: 'metal', d: 3 }); })];
};
const okada = {
  id: 'okada', name: 'Okada Motorcycle', emoji: '🏍️', category: 'Transport',
  about: 'A typical Nigerian okada — a light commercial motorcycle with a single-cylinder petrol engine of about 100–125 cc. Cheap to run and great in traffic, it moves millions of people every day.',
  parts: [
    { name: 'Front Wheel', color: '#5a6170', shapes: wheel(1.35), anim: { type: 'spin', axis: [0, 0, 1], speed: -6, pivot: [1.35, -0.65, 0] },
      desc: 'Rubber tyre, steel rim and spokes. The front wheel steers and does most of the braking.' },
    { name: 'Rear Wheel', color: '#5a6170', shapes: wheel(-1.3), anim: { type: 'spin', axis: [0, 0, 1], speed: -6, pivot: [-1.3, -0.65, 0] },
      desc: 'Driven by the chain from the engine. It pushes the bike forward.' },
    { name: 'Frame', color: '#d0d8e8', mat: 'metal', shapes: [seg([-1.3, -0.65, 0], [-0.25, 0.05, 0], 0.035), seg([-0.25, 0.05, 0], [0.9, 0.5, 0], 0.045), seg([-0.25, 0.05, 0], [0.35, -0.45, 0], 0.035), seg([0.35, -0.45, 0], [0.9, 0.5, 0], 0.035), seg([-1.3, -0.65, 0], [-0.7, 0.35, 0], 0.025)],
      desc: 'The steel skeleton of the bike that everything else bolts onto.' },
    { name: 'Engine', color: '#aab4c3', mat: 'metal', shapes: [{ t: 'rbox', c: [0.08, -0.22, 0], s: [0.55, 0.45, 0.36], rad: 0.08 }, { t: 'cyl', c: [0.32, 0.12, 0], r: 0.14, h: 0.38, rot: [0, 0, -28] }, ...[0, 1, 2, 3, 4].map(i => ({ t: 'disk', c: [0.25 + i * 0.03, 0.0 + i * 0.06, 0], r: 0.2, r0: 0.14, rot: [0, 0, -28], d: 1.5 }))],
      desc: 'A single-cylinder, air-cooled four-stroke engine. The fins carry heat away into the passing air.', fact: 'Many okadas can travel 40–50 km on a single litre of petrol.' },
    { name: 'Fuel Tank', color: '#e63946', mat: 'plastic', shapes: [{ t: 'ellipsoid', c: [0.38, 0.58, 0], r: [0.45, 0.19, 0.25] }, { t: 'cyl', c: [0.38, 0.78, 0], r: 0.06, h: 0.04 }],
      desc: 'Holds about 10–13 litres of petrol above the engine, so fuel flows down by gravity.' },
    { name: 'Seat', color: '#4a4e69', mat: 'rubber', shapes: [{ t: 'rbox', c: [-0.5, 0.48, 0], s: [1.05, 0.13, 0.32], rad: 0.06 }],
      desc: 'A long seat with room for the rider and passenger — sometimes more!' },
    { name: 'Exhaust', color: '#c9ced8', mat: 'metal', shapes: [{ t: 'tube', pts: [[0.32, -0.25, 0.16], [0.05, -0.48, 0.22], [-0.6, -0.42, 0.25], [-0.85, -0.32, 0.26]], r: 0.05 }, { t: 'cyl', c: [-1.08, -0.28, 0.26], r: 0.1, h: 0.55, axis: [1, 0.15, 0] }], flow: { speed: 1, strength: 2, k: 3 },
      desc: 'Carries hot exhaust gas from the engine to the silencer at the back.' },
    { name: 'Chain & Sprockets', color: '#9aa3b2', mat: 'metal', shapes: [{ t: 'tube', closed: true, pts: [[0.05, -0.27, 0.13], [-1.3, -0.49, 0.13], [-1.46, -0.65, 0.13], [-1.3, -0.81, 0.13], [0.05, -0.43, 0.13], [0.13, -0.35, 0.13]], r: 0.018 }, { t: 'disk', c: [-1.3, -0.65, 0.13], r: 0.16, axis: 'z' }, { t: 'disk', c: [0.05, -0.35, 0.13], r: 0.08, axis: 'z' }], flow: { speed: 2.5, strength: 1.2, k: 14 },
      desc: 'The chain carries power from the small engine sprocket to the big rear-wheel sprocket.', fact: 'A bigger rear sprocket gives more pulling power for carrying heavy loads, but a lower top speed.' },
    { name: 'Front Fork & Handlebar', color: '#e8ecf2', mat: 'metal', shapes: [seg([1.35, -0.65, 0.12], [0.95, 0.62, 0.12], 0.03), seg([1.35, -0.65, -0.12], [0.95, 0.62, -0.12], 0.03), { t: 'tube', pts: [[0.85, 0.82, -0.42], [0.95, 0.75, 0], [0.85, 0.82, 0.42]], r: 0.022 }, { t: 'cyl', c: [0.85, 0.82, 0.46], r: 0.035, h: 0.15, axis: 'z', mat: 'rubber', color: '#444b5a' }, { t: 'cyl', c: [0.85, 0.82, -0.46], r: 0.035, h: 0.15, axis: 'z', mat: 'rubber', color: '#444b5a' }],
      desc: 'The fork holds the front wheel and has springs inside to absorb bumps; the handlebar steers and holds the throttle, brake and clutch levers.' },
    { name: 'Shock Absorbers', color: '#ffd23f', mat: 'metal', shapes: [spring([-1.05, -0.45, 0.17], [-0.62, 0.38, 0.17], 0.05, 0.01, 9), spring([-1.05, -0.45, -0.17], [-0.62, 0.38, -0.17], 0.05, 0.01, 9)],
      desc: 'Springs and dampers at the back that soak up potholes and keep the tyre on the road.' },
    { name: 'Headlamp', color: '#fff6c2', mat: 'glow', shapes: [{ t: 'sphere', c: [1.1, 0.5, 0], r: 0.12, mask: (x) => x > -0.2 }, { t: 'disk', c: [1.2, 0.5, 0], r: 0.1, axis: 'x' }],
      desc: 'Lights the road at night and makes the bike visible to other drivers.' },
    { name: 'Mudguards', color: '#e63946', mat: 'plastic', shapes: [{ t: 'torus', c: [1.35, -0.65, 0], R: 0.67, r: 0.03, axis: 'z', arc: 0.32, start: 200 }, { t: 'torus', c: [-1.3, -0.65, 0], R: 0.67, r: 0.03, axis: 'z', arc: 0.3, start: 230 }],
      desc: 'Curved covers that stop the wheels throwing mud and water onto the rider.' },
  ],
};

// ============================================================ DANFO BUS
const danfoWheels = x => [0.68, -0.68].flatMap(z => [{ t: 'torus', c: [x, -0.62, z], R: 0.32, r: 0.1, axis: 'z', mat: 'rubber', color: '#4b5263' }, { t: 'disk', c: [x, -0.62, z + Math.sign(z) * 0.06], r: 0.24, axis: 'z', mat: 'metal', color: '#d0d6e0' }]);
const danfo = {
  id: 'danfo', name: 'Danfo Bus', emoji: '🚌', category: 'Transport',
  about: 'The famous yellow minibus of Lagos, with black stripes along the sides. Many danfos are based on old Volkswagen vans, with the engine at the back. They carry millions of commuters every day.',
  parts: [
    { name: 'Body', color: '#ffc300', mat: 'plastic', shapes: [{ t: 'rbox', c: [0, 0.18, 0], s: [3.6, 1.35, 1.5], rad: 0.28 }],
      desc: 'A boxy steel body painted danfo yellow — the colour Lagos State set for commercial buses.' },
    { name: 'Black Stripes', color: '#2b2f3a', mat: 'plastic', shapes: [0.755, -0.755].flatMap(z => [{ t: 'box', c: [0, 0.02, z], s: [3.3, 0.1, 0.01] }, { t: 'box', c: [0, -0.18, z], s: [3.3, 0.1, 0.01] }]),
      desc: 'The black stripes that, together with the yellow paint, make a danfo instantly recognisable.' },
    { name: 'Windows', color: '#9ad0ff', mat: 'glass', shapes: [...[-1.2, -0.4, 0.4].flatMap(x => [0.76, -0.76].map(z => ({ t: 'box', c: [x, 0.55, z], s: [0.65, 0.42, 0.01] }))), { t: 'box', c: [1.79, 0.5, 0], s: [0.01, 0.48, 1.25], rot: [0, 0, 8] }],
      desc: 'Usually open on hot days for air — few danfos have air-conditioning.' },
    { name: 'Sliding Door', color: '#ffd633', mat: 'plastic', shapes: [{ t: 'box', c: [1.05, 0.15, 0.77], s: [0.75, 1.1, 0.02] }], anim: { type: 'bob', axis: [-1, 0, 0], amp: 0.35, freq: 0.08 },
      desc: 'The side door, often left open so passengers can jump in and out quickly at bus stops.', fact: 'The conductor hangs out of the doorway calling the route — "Oshodi! Oshodi!" — and collects the fares.' },
    { name: 'Front Wheels', color: '#4b5263', shapes: danfoWheels(1.15), anim: { type: 'spin', axis: [0, 0, 1], speed: -4, pivot: [1.15, -0.62, 0] },
      desc: 'Steered by the driver. Danfo tyres take a beating on Lagos roads.' },
    { name: 'Rear Wheels', color: '#4b5263', shapes: danfoWheels(-1.15), anim: { type: 'spin', axis: [0, 0, 1], speed: -4, pivot: [-1.15, -0.62, 0] },
      desc: 'Driven by the rear engine through a gearbox.' },
    { name: 'Rear Engine', color: '#aab4c3', mat: 'metal', ex: [-1.6, 0, 0], shapes: [{ t: 'rbox', c: [-1.45, -0.28, 0], s: [0.5, 0.42, 1.0], rad: 0.06 }, ...[-0.3, -0.1, 0.1, 0.3].map(z => ({ t: 'cyl', c: [-1.45, -0.28, z], r: 0.1, h: 0.62, axis: 'x', d: 0.5 }))],
      desc: 'An air-cooled flat-four engine at the back, as in the classic Volkswagen van.', fact: 'Its "boxer" layout has pistons moving in opposite pairs, which keeps vibration low.' },
    { name: 'Roof Rack & Luggage', color: '#c0855c', mat: 'matte', ex: [0, 1.0, 0], shapes: [seg([-1.4, 0.95, 0.6], [1.2, 0.95, 0.6], 0.025, { mat: 'metal', color: '#c0c8d6' }), seg([-1.4, 0.95, -0.6], [1.2, 0.95, -0.6], 0.025, { mat: 'metal', color: '#c0c8d6' }), { t: 'rbox', c: [-0.6, 1.1, 0], s: [0.9, 0.28, 0.9], rad: 0.08 }, { t: 'rbox', c: [0.55, 1.06, 0.1], s: [0.6, 0.2, 0.7], rad: 0.06, color: '#3a86ff' }],
      desc: 'A metal rack on the roof for market goods, bags and anything else passengers bring.' },
    { name: 'Passenger Seats', color: '#8d6e63', mat: 'rubber', ex: [0, 0, 1.6], shapes: [-0.9, -0.2, 0.5, 1.2].map(x => ({ t: 'rbox', c: [x, -0.05, 0], s: [0.35, 0.35, 1.25], rad: 0.05 })),
      desc: 'Rows of benches. A danfo officially seats around 14–18 people, but often squeezes in more.' },
    { name: 'Lights', color: '#fff6c2', mat: 'glow', shapes: [{ t: 'sphere', c: [1.8, -0.05, 0.5], r: 0.09 }, { t: 'sphere', c: [1.8, -0.05, -0.5], r: 0.09 }, { t: 'box', c: [-1.81, 0.05, 0.55], s: [0.02, 0.16, 0.12], color: '#ff3b3b' }, { t: 'box', c: [-1.81, 0.05, -0.55], s: [0.02, 0.16, 0.12], color: '#ff3b3b' }],
      desc: 'Headlights at the front, red tail lights at the back.' },
    { name: 'Bumpers', color: '#c9ced8', mat: 'metal', shapes: [{ t: 'rbox', c: [1.85, -0.45, 0], s: [0.1, 0.14, 1.55], rad: 0.04 }, { t: 'rbox', c: [-1.85, -0.45, 0], s: [0.1, 0.14, 1.55], rad: 0.04 }],
      desc: 'Steel bars that absorb small knocks in tight traffic.' },
  ],
};

// ============================================================ TRANSFORMER
const transformer = {
  id: 'transformer', name: 'Step-down Transformer', emoji: '🔌', category: 'Physics',
  about: 'A transformer changes the voltage of alternating current. Current in the primary coil creates a changing magnetic field in the iron core, which induces a voltage in the secondary coil. Fewer secondary turns means a lower voltage.',
  parts: [
    { name: 'Laminated Iron Core', color: '#8d99ae', mat: 'metal', shapes: [{ t: 'box', c: [-0.8, 0, 0], s: [0.38, 2.2, 0.38] }, { t: 'box', c: [0.8, 0, 0], s: [0.38, 2.2, 0.38] }, { t: 'box', c: [0, 0.91, 0], s: [1.98, 0.38, 0.38] }, { t: 'box', c: [0, -0.91, 0], s: [1.98, 0.38, 0.38] }],
      desc: 'Thin sheets of soft iron stacked together. The core guides the magnetic field from the primary to the secondary coil.', fact: 'It is laminated (layered and insulated) to stop wasteful "eddy currents" heating it up.' },
    { name: 'Magnetic Flux', color: '#7df9ff', mat: 'glow', d: 0.6, shapes: [{ t: 'tube', closed: true, pts: [[-0.8, -0.91, 0], [-0.8, 0.91, 0], [0.8, 0.91, 0], [0.8, -0.91, 0]], r: 0.03 }], flow: { speed: 0.7, strength: 2.5, k: 6 },
      desc: 'The changing magnetic field that flows round and round the core, linking the two coils.' },
    { name: 'Primary Coil', color: '#ff9f43', mat: 'metal', shapes: [{ t: 'helix', c: [-0.8, 0, 0], R: 0.3, r: 0.035, h: 1.3, turns: 14 }], flow: { speed: 1.2, strength: 1.8, k: 6 },
      desc: 'The input coil, connected to the high-voltage supply (e.g. 11,000 V on a street transformer).' },
    { name: 'Secondary Coil', color: '#ffd166', mat: 'metal', shapes: [{ t: 'helix', c: [0.8, 0, 0], R: 0.3, r: 0.045, h: 1.3, turns: 6 }], flow: { speed: 1.2, strength: 1.8, k: 6 },
      desc: 'The output coil. It has fewer turns than the primary, so the voltage comes out lower — ready for homes.', fact: 'The rule is Vs / Vp = Ns / Np: the voltage ratio equals the turns ratio.' },
    { name: 'Coil Insulation', color: '#c7f0ff', mat: 'glass', d: 0.35, shapes: [{ t: 'cyl', c: [-0.8, 0, 0], r: 0.38, h: 1.4, open: true }, { t: 'cyl', c: [0.8, 0, 0], r: 0.38, h: 1.4, open: true }],
      desc: 'Paper and varnish layers that stop the copper wires short-circuiting against each other or the core.' },
    { name: 'High-voltage Bushings', color: '#f1f1f1', mat: 'plastic', ex: [-0.5, 1.2, 0], shapes: [-0.95, -0.65].flatMap(x => [{ t: 'cyl', c: [x, 1.55, 0], r: 0.07, h: 0.55 }, ...[0, 1, 2].map(i => ({ t: 'disk', c: [x, 1.38 + i * 0.15, 0], r: 0.12 }))]),
      desc: 'Porcelain insulators where the high-voltage cables enter safely.' },
    { name: 'Low-voltage Terminals', color: '#ffe8a3', mat: 'metal', ex: [0.5, 1.2, 0], shapes: [0.65, 0.95].map(x => ({ t: 'cyl', c: [x, 1.45, 0], r: 0.05, h: 0.35 })),
      desc: 'Outputs carrying the stepped-down voltage (230 V in Nigeria) to homes and businesses.' },
    { name: 'Oil Tank', color: '#9fb3d1', mat: 'glass', d: 0.3, ex: [0, 0, -1.8], shapes: [{ t: 'rbox', s: [2.6, 2.6, 1.15], rad: 0.12 }],
      desc: 'A steel tank filled with mineral oil, which insulates the parts and carries heat away.' },
    { name: 'Cooling Fins', color: '#8d99ae', mat: 'metal', ex: [0, 0, -2.4], shapes: [-0.9, -0.5, -0.1, 0.3, 0.7].map(x => ({ t: 'box', c: [x, 0, -0.75], s: [0.06, 2.1, 0.35] })),
      desc: 'Radiator fins that let hot oil cool down as it circulates.', fact: 'The hum you hear from a transformer comes from the iron core vibrating 100 times a second on 50 Hz power.' },
  ],
};

// ============================================================ VOLCANO (cut open)
const vr = rng(13);
const volcano = {
  id: 'volcano', name: 'Volcano (Cross-section)', emoji: '🌋', category: 'Geography',
  about: 'A stratovolcano cut open to show its insides. Molten rock (magma) collects in a chamber deep underground and forces its way up through the vent, erupting as lava, ash and gas.',
  parts: [
    { name: 'Volcanic Cone', color: '#8d6e63', mat: 'matte', shapes: [{ t: 'lathe', pts: [[3.3, -1.2], [2.3, -0.65], [1.3, 0.35], [0.55, 1.22], [0.38, 1.3]], arc: 0.78, start: 20, n: 0.05, nf: 4 }],
      desc: 'Layers of hardened lava, ash and rock built up over many eruptions into a steep cone.', fact: 'Nigeria\'s Jos Plateau and Biu Plateau are dotted with ancient extinct volcanoes.' },
    { name: 'Ash & Lava Layers', color: '#bcaaa4', mat: 'matte', d: 0.7, shapes: [0.85, 0.7, 0.55].map((k, i) => ({ t: 'lathe', pts: [[3.3 * k, -1.2], [2.3 * k, -0.65 - i * 0.05], [1.3 * k, 0.35 - i * 0.12], [0.5, 1.0 - i * 0.18]], arc: 0.78, start: 20, color: ['#bcaaa4', '#6d4c41', '#a1887f'][i] })),
      desc: 'Alternating layers (strata) of ash and lava from different eruptions — this is why it\'s called a stratovolcano.' },
    { name: 'Magma Chamber', color: '#ff5722', mat: 'glow', ex: [0, -0.9, 0], shapes: [{ t: 'ellipsoid', c: [0, -1.95, 0], r: [1.2, 0.45, 1.0], n: 0.06, nf: 3 }, { t: 'ellipsoid', c: [0, -1.95, 0], r: [1.1, 0.4, 0.9], v: true, d: 0.4, color: '#ff9800' }], flow: { speed: 0.15, strength: 1.2, k: 3 },
      desc: 'A huge underground pool of molten rock, at temperatures around 700–1,200 °C.' },
    { name: 'Main Vent', color: '#ff7043', mat: 'glow', shapes: [{ t: 'cyl', c: [0, -0.32, 0], r: 0.13, h: 3.2 }, { t: 'cyl', c: [0, -0.32, 0], r: 0.1, h: 3.2, v: true, d: 0.4, color: '#ffab40' }], flow: { speed: 0.6, strength: 2.4, k: 4 },
      desc: 'The central pipe through which magma rises to the surface.' },
    { name: 'Side Vent', color: '#ff8a50', mat: 'glow', shapes: [{ t: 'tube', pts: [[0, -1.5, 0], [0.55, -0.7, 0.35], [1.15, 0.0, 0.62], [1.55, 0.12, 0.8]], r: 0.06 }], flow: { speed: 0.6, strength: 2.4, k: 3 },
      desc: 'A branch (dyke) where magma escapes through a crack in the side of the volcano.' },
    { name: 'Crater', color: '#5d4037', mat: 'matte', shapes: [{ t: 'torus', c: [0, 1.3, 0], R: 0.42, r: 0.08, n: 0.03, nf: 10 }],
      desc: 'The bowl-shaped opening at the summit where eruptions burst out.' },
    { name: 'Lava Flow', color: '#ff9800', mat: 'glow', shapes: [{ t: 'tube', pts: [[0.2, 1.3, 0.35], [0.6, 0.8, 0.7], [1.0, 0.15, 1.15], [1.45, -0.55, 1.65], [1.6, -1.1, 2.1]], r: 0.08 }, { t: 'tube', pts: [[-0.3, 1.3, 0.25], [-0.8, 0.7, 0.55], [-1.4, -0.1, 0.9], [-1.9, -0.95, 1.3]], r: 0.06 }], flow: { speed: 0.3, strength: 2.2, k: 3 },
      desc: 'Molten rock pouring down the slopes. It cools into new rock, adding another layer to the volcano.' },
    { name: 'Ash Cloud', color: '#9e9e9e', mat: 'matte', d: 0.5, ex: [0, 1.2, 0], shapes: Array.from({ length: 9 }, (_, i) => ({ t: 'sphere', c: [(vr() - 0.5) * 1.2 + i * 0.12, 2.0 + i * 0.22, (vr() - 0.5) * 0.8], r: 0.35 + i * 0.05, n: 0.12, nf: 3 })),
      anim: [{ type: 'spin', axis: [0, 1, 0], speed: 0.1, pivot: [0, 2.5, 0] }, { type: 'pulse', amp: 0.04, freq: 0.15 }],
      desc: 'A billowing column of hot gas, rock dust and tiny glass shards.', fact: 'Ash clouds can reach over 30 km high and ground aeroplanes across whole continents.' },
    { name: 'Bedrock', color: '#4e342e', mat: 'matte', d: 0.6, shapes: [{ t: 'disk', c: [0, -1.22, 0], r: 3.9, r0: 0.0, arc: 0.78, start: 20 }, { t: 'disk', c: [0, -2.6, 0], r: 3.4, d: 0.3 }],
      desc: 'The solid crust the volcano grew through. Magma rises because it is less dense than the surrounding rock.' },
  ],
};

// ============================================================ ZUMA ROCK
const zr = rng(17);
const trees = Array.from({ length: 16 }, () => { const a = zr() * Math.PI * 2, r = 2.3 + zr() * 1.2; return [r * Math.cos(a), r * Math.sin(a)]; });
const zuma = {
  id: 'zuma', name: 'Zuma Rock', emoji: '🪨', category: 'Landmarks',
  about: 'A huge natural monolith beside the Abuja–Kaduna road near Madalla, Niger State, often called the "Gateway to Abuja". It rises roughly 300 m above the surrounding land.',
  parts: [
    { name: 'Monolith', color: '#8a7f78', mat: 'matte', shapes: [{ t: 'lathe', pts: [[2.0, -1.0], [1.95, -0.4], [1.75, 0.3], [1.4, 0.9], [0.9, 1.3], [0.35, 1.48], [0, 1.5]], n: 0.07, nf: 3.2 }, { t: 'disk', c: [0, -1.0, 0], r: 2.0, d: 0.3 }],
      desc: 'A single enormous mass of igneous rock (gabbro and granodiorite) that cooled deep underground and was exposed by erosion over millions of years.', fact: 'Zuma Rock appears on the ₦100 note.' },
    { name: 'The "Face"', color: '#4e3b31', mat: 'matte', ex: [0, 0, 1.2], shapes: [{ t: 'ellipsoid', c: [-0.45, 0.65, 1.3], r: [0.22, 0.12, 0.08], rot: [-30, 0, 10] }, { t: 'ellipsoid', c: [0.45, 0.65, 1.3], r: [0.22, 0.12, 0.08], rot: [-30, 0, -10] }, { t: 'ellipsoid', c: [0, 0.2, 1.62], r: [0.08, 0.3, 0.08], rot: [-20, 0, 0] }, { t: 'ellipsoid', c: [0, -0.35, 1.78], r: [0.45, 0.06, 0.08], rot: [-10, 0, 0] }],
      desc: 'Dark streaks and hollows that many people say look like a human face — eyes, nose and mouth — on one side of the rock.' },
    { name: 'Rock Streaks', color: '#5d544e', mat: 'matte', shapes: Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + 0.3; return { t: 'tube', pts: [[1.4 * Math.cos(a), 0.95, 1.4 * Math.sin(a)], [1.85 * Math.cos(a), 0.1, 1.85 * Math.sin(a)], [2.0 * Math.cos(a), -0.8, 2.0 * Math.sin(a)]], r: 0.04 }; }),
      desc: 'Vertical dark stains where rainwater has run down the rock for centuries, carrying minerals and algae.' },
    { name: 'Vegetation', color: '#2ecc71', mat: 'organic', shapes: trees.flatMap(([x, z]) => [{ t: 'sphere', c: [x, -0.55, z], r: 0.22 + zr() * 0.1, n: 0.05, nf: 10 }, { t: 'cyl', c: [x, -0.85, z], r: 0.03, h: 0.3, color: '#795548' }]),
      desc: 'Savannah trees and shrubs typical of the Guinea savannah around Niger State and Abuja.' },
    { name: 'Abuja–Kaduna Road', color: '#95a5a6', mat: 'matte', shapes: [{ t: 'box', c: [0, -1.02, 3.0], s: [8, 0.02, 0.5] }, { t: 'box', c: [0, -1.0, 3.0], s: [7.6, 0.01, 0.03], color: '#ffffff', d: 3 }],
      desc: 'The busy highway that passes right beside the rock, giving travellers a spectacular view.' },
    { name: 'Savannah Plain', color: '#a1887f', mat: 'matte', d: 0.35, shapes: [{ t: 'disk', c: [0, -1.05, 0], r: 4.2, r0: 2.0, j: 0.01 }],
      desc: 'The flat surrounding land, which makes the rock look even bigger as it rises straight up.' },
  ],
};

// ============================================================ SMARTPHONE TEARDOWN
const phone = {
  id: 'phone', name: 'Smartphone Teardown', emoji: '📱', category: 'Technology',
  about: 'What\'s inside the phone in your pocket. Explode it to see each layer, from the glass screen at the front to the camera module at the back.',
  explode: 1.4,
  parts: [
    { name: 'Cover Glass', color: '#bfe3ff', mat: 'glass', ex: [0, 0, 2.2], shapes: [{ t: 'rbox', c: [0, 0, 0.21], s: [1.6, 3.3, 0.03], rad: 0.012 }],
      desc: 'Toughened glass (like Gorilla Glass) that protects the display and senses your touch through a transparent layer on its underside.' },
    { name: 'OLED Display', color: '#4a6cff', mat: 'glow', ex: [0, 0, 1.6], shapes: [{ t: 'rbox', c: [0, 0, 0.17], s: [1.55, 3.25, 0.02], rad: 0.008 }], flow: { speed: 0.15, strength: 0.6, k: 3 },
      desc: 'Millions of tiny red, green and blue pixels that each produce their own light.', fact: 'A 1080p screen has over 2 million pixels — more than 6 million individual sub-pixels.' },
    { name: 'Front Camera & Sensors', color: '#2b2f3a', mat: 'glass', ex: [0, 0.6, 1.9], shapes: [{ t: 'cyl', c: [0, 1.48, 0.19], r: 0.06, h: 0.03, axis: 'z' }, { t: 'disk', c: [-0.2, 1.48, 0.2], r: 0.03, axis: 'z', color: '#ff3b5c', mat: 'glow' }],
      desc: 'The selfie camera, plus proximity and light sensors that switch off the screen during calls and adjust its brightness.' },
    { name: 'Frame', color: '#c0c8d6', mat: 'metal', shapes: [
        { t: 'box', c: [0.84, 0, 0], s: [0.03, 3.1, 0.3] }, { t: 'box', c: [-0.84, 0, 0], s: [0.03, 3.1, 0.3] }, { t: 'box', c: [0, 1.69, 0], s: [1.4, 0.03, 0.3] }, { t: 'box', c: [0, -1.69, 0], s: [1.4, 0.03, 0.3] },
        { t: 'cyl', c: [0.7, -1.55, 0], r: 0.15, h: 0.3, axis: 'z', open: true, arc: 0.25, start: 0 }, { t: 'cyl', c: [0.7, 1.55, 0], r: 0.15, h: 0.3, axis: 'z', open: true, arc: 0.25, start: 270 },
        { t: 'cyl', c: [-0.7, 1.55, 0], r: 0.15, h: 0.3, axis: 'z', open: true, arc: 0.25, start: 180 }, { t: 'cyl', c: [-0.7, -1.55, 0], r: 0.15, h: 0.3, axis: 'z', open: true, arc: 0.25, start: 90 }],
      desc: 'An aluminium or steel frame that holds the phone together. Its gaps (antenna lines) let radio signals in and out.' },
    { name: 'Battery', color: '#ffd23f', mat: 'plastic', ex: [-1.6, -0.3, 0.4], shapes: [{ t: 'rbox', c: [0, -0.45, 0.03], s: [1.25, 2.0, 0.1], rad: 0.04 }],
      desc: 'A flat lithium-ion battery that stores the energy, typically 3,000–5,000 mAh.', fact: 'Lithium-ion batteries last longest if you keep them between about 20% and 80% charged.' },
    { name: 'Logic Board', color: '#1fa35a', mat: 'plastic', ex: [1.6, 0.8, 0.5], shapes: [{ t: 'box', c: [0, 1.15, 0.03], s: [1.35, 0.75, 0.03] }],
      desc: 'The main circuit board — the phone\'s nervous system — connecting every chip and component.' },
    { name: 'Processor (SoC)', color: '#b0b8c8', mat: 'metal', ex: [1.9, 0.8, 1.1], shapes: [{ t: 'box', c: [0.12, 1.15, 0.065], s: [0.34, 0.34, 0.03] }], flow: { speed: 2, strength: 1.5, k: 6 },
      desc: 'The System-on-a-Chip: CPU, graphics, AI engine and modem combined on one tiny chip.', fact: 'Modern phone chips contain over 10 billion transistors.' },
    { name: 'Memory & Storage', color: '#7b8aa6', mat: 'metal', ex: [1.9, 0.8, 0.8], shapes: [{ t: 'box', c: [-0.35, 1.2, 0.06], s: [0.28, 0.22, 0.025] }, { t: 'box', c: [-0.35, 0.95, 0.06], s: [0.28, 0.18, 0.025] }],
      desc: 'RAM chips for running apps and flash storage chips for your photos, music and apps.' },
    { name: 'Rear Cameras', color: '#3a4256', mat: 'glass', ex: [0, 0.8, -2.0], shapes: [[-0.45, 1.38], [-0.45, 0.98], [-0.1, 1.38]].flatMap(([x, y]) => [{ t: 'cyl', c: [x, y, -0.18], r: 0.14, h: 0.08, axis: 'z', mat: 'metal', color: '#9aa3b2' }, { t: 'disk', c: [x, y, -0.225], r: 0.09, axis: 'z' }]),
      desc: 'Usually a main wide camera, an ultra-wide and sometimes a zoom camera, each with its own sensor and lens.' },
    { name: 'Wireless Charging Coil', color: '#ff9f43', mat: 'metal', ex: [0, -0.3, -1.4], shapes: [0.18, 0.25, 0.32, 0.39].map(R => ({ t: 'torus', c: [0, -0.25, -0.12], R, r: 0.012, axis: 'z' })), flow: { speed: 1, strength: 1.8, k: 4 },
      desc: 'A flat copper coil that picks up energy from a charging pad by electromagnetic induction — the same physics as a transformer.' },
    { name: 'Speaker & Vibration Motor', color: '#9aa3b2', mat: 'metal', ex: [0, -1.4, 0.6], shapes: [{ t: 'box', c: [-0.3, -1.52, 0.03], s: [0.45, 0.16, 0.06] }, { t: 'cyl', c: [0.4, -1.52, 0.03], r: 0.07, h: 0.3, axis: 'x' }],
      desc: 'The loudspeaker, and a tiny motor with an off-centre weight that makes the phone buzz.' },
    { name: 'Charging Port & SIM Tray', color: '#e0e6f0', mat: 'metal', ex: [0, -1.2, 0], shapes: [{ t: 'rbox', c: [0, -1.69, 0], s: [0.32, 0.06, 0.1], rad: 0.025 }, { t: 'box', c: [0.85, 0.5, 0], s: [0.03, 0.5, 0.1] }],
      desc: 'The USB-C (or Lightning) port for charging and data, and the tray that holds your SIM card.' },
    { name: 'Back Glass', color: '#dfe6f2', mat: 'glass', ex: [0, 0, -2.6], shapes: [{ t: 'rbox', c: [0, 0, -0.18], s: [1.6, 3.3, 0.03], rad: 0.012 }],
      desc: 'A glass back lets wireless charging work — metal would block the magnetic field.' },
  ],
};

export const MORE_MODELS = [eye, brain, lungs, digestive, flower, plantCell, okada, danfo, transformer, volcano, zuma, phone];
