/**
 * uhd-docs figure renderer (runs in headless Chrome).
 *
 * window.renderScene(spec) draws UHD bodies (GLB artifacts placed by
 * `assemble` matrices, mm, Z up) as technical illustrations:
 *
 *   mode "lineart": flat light fills + screen-space outlines (object id,
 *                   depth and normal discontinuities) — assembly steps,
 *                   drawings;
 *   mode "shaded":  physically based colours + soft outlines — hero renders.
 *
 * Styles per body: normal | context | accent | ghost | guide.
 * Returns a PNG data URL plus projected anchor points (output pixels), so the
 * document draws callouts and leaders as vector SVG on top.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const STYLE = { bg: 0, normal: 1, context: 2, accent: 3, ghost: 4, guide: 5 };

const LINEART = {
  frame: 0xc9cacd, top_plate: 0xc9cacd,
  motor_bell: 0xe8eaed, motor_base: 0xcfd2d7, motor_shaft: 0xf2f2f2, motor_lead: 0x8a8a8a,
  prop: 0xfde3d2,
  esc_pcb: 0xd6e1ee, fc_pcb: 0xd8eadb, components: 0xb9bdc3, grommets: 0x9aa0a8, pads: 0xe0c28a,
  video: 0xd3d4d6, battery: 0xc4c5c8, gnss: 0xe1e6e1,
  screw: 0xeceef1, nut: 0xe3e6ea, spacer: 0xf4f4f4, standoff: 0xd9e1ea,
  capacitor: 0xd9dde3, receiver: 0xe4e4e4, generic: 0xe2e2e2,
  context: 0xf5f5f5, ghost: 0xfbfbfb, accent: 0xffb584, guide: 0xff5c00,
};
const SHADED = {
  frame: 0x2e2f31, top_plate: 0x2e2f31,
  motor_bell: 0xaab0b8, motor_base: 0x4c5159, motor_shaft: 0xd6d3d1, motor_lead: 0x1b1b1b,
  prop: 0xff7a33,
  esc_pcb: 0x1f3b5c, fc_pcb: 0x1d4a2c, components: 0x2c3036, grommets: 0x3b3b3b, pads: 0xc8a052,
  video: 0x3a3b3e, battery: 0x303134, gnss: 0x2f4f39,
  screw: 0xc9ccd2, nut: 0xbfc3c9, spacer: 0x1f1f1f, standoff: 0x8f99a6,
  capacitor: 0x2b3440, receiver: 0x2a2a2a, generic: 0x8b8b8b,
  context: 0xd8d8d8, ghost: 0xeeeeee, accent: 0xff5c00, guide: 0xff5c00,
};
const METAL = new Set(["motor_bell", "motor_shaft", "screw", "nut", "standoff", "pads"]);

function tone(category, node) {
  const n = (node || "").toLowerCase();
  if (category === "motor") {
    if (n.startsWith("lead")) return "motor_lead";
    if (n.includes("shaft")) return "motor_shaft";
    if (n === "base") return "motor_base";
    return "motor_bell";
  }
  if (category === "esc" || category === "fc") {
    if (n === "components") return "components";
    if (n === "grommets") return "grommets";
    if (n.includes("pads")) return "pads";
    return category === "esc" ? "esc_pcb" : "fc_pcb";
  }
  return category in LINEART ? category : "generic";
}

const loader = new GLTFLoader();
const cache = new Map();
const loadGlb = (path) => {
  if (!cache.has(path)) cache.set(path, loader.loadAsync("/repo/" + path).catch((e) => (console.warn("glb", path, String(e)), null)));
  return cache.get(path);
};

let renderer;
function getRenderer(w, h) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    document.body.appendChild(renderer.domElement);
  }
  renderer.setSize(w, h);
  return renderer;
}

const compositeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, tId: { value: null },
    texel: { value: new THREE.Vector2() }, depthRange: { value: 1 }, px: { value: 1 },
    shaded: { value: 0 },
    cNormal: { value: new THREE.Color(0x242424) }, cContext: { value: new THREE.Color(0xa8a8a8) },
    cAccent: { value: new THREE.Color(0xd24a00) }, cGhost: { value: new THREE.Color(0xdadada) },
    cGuide: { value: new THREE.Color(0xff5c00) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tColor, tNormal, tDepth, tId;
    uniform vec2 texel; uniform float depthRange, px, shaded;
    uniform vec3 cNormal, cContext, cAccent, cGhost, cGuide;
    int styleAt(vec2 uv){ return int(texture2D(tId, uv).b * 255. + .5); }
    vec2 idAt(vec2 uv){ return floor(texture2D(tId, uv).rg * 255. + .5); }
    float dAt(vec2 uv){ return texture2D(tDepth, uv).r * depthRange; }
    vec3 nAt(vec2 uv){ return normalize(texture2D(tNormal, uv).rgb * 2. - 1.); }
    vec3 lineColor(int s){
      if (s == 2) return cContext; if (s == 3) return cAccent; if (s == 4) return cGhost; if (s == 5) return cGuide; return cNormal;
    }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
    void main(){
      int s = styleAt(vUv);
      vec2 id = idAt(vUv);
      float d = dAt(vUv);
      float sil = 0.; int ls = s; float nearest = s == 0 ? 1e9 : d;
      // silhouettes and part boundaries: id changes (radius ~1.5 px)
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 o = vec2(cos(a), sin(a)) * texel * 1.5 * px;
        vec2 idn = idAt(vUv + o);
        if (idn != id) {
          sil = 1.;
          int sn = styleAt(vUv + o);
          float dn = sn == 0 ? 1e9 : dAt(vUv + o);
          if (dn < nearest) { nearest = dn; ls = sn; }
        }
      }
      // self-occlusion: depth laplacian within one part
      float crease = 0.;
      if (s != 0 && sil == 0.) {
        vec2 ox = vec2(texel.x, 0.) * px, oy = vec2(0., texel.y) * px;
        float lap = abs(dAt(vUv + ox) + dAt(vUv - ox) - 2. * d) + abs(dAt(vUv + oy) + dAt(vUv - oy) - 2. * d);
        if (lap > 0.6) sil = 1.;
        vec3 n = nAt(vUv);
        float m = min(min(dot(n, nAt(vUv + ox)), dot(n, nAt(vUv - ox))), min(dot(n, nAt(vUv + oy)), dot(n, nAt(vUv - oy))));
        if (m < 0.82) crease = 1.;
      }
      vec4 base = texture2D(tColor, vUv);
      vec3 fill = toSRGB(base.rgb);
      float alpha = s == 0 ? 0. : 1.;
      if (s == 5 || ls == 5) { sil = 0.; crease = 0.; }
      if (s == 5) fill = toSRGB(cGuide);
      vec3 lc = toSRGB(lineColor(ls));
      float la = sil > 0. ? (shaded > .5 ? .55 : 1.) : crease > 0. ? (shaded > .5 ? .18 : .55) : 0.;
      if (s == 4 && ls == 4) la *= .6;
      vec3 outc = mix(fill, lc, la);
      float outa = max(alpha, la > 0. && sil > 0. ? 1. : 0.);
      if (s == 0) outc = lc;
      gl_FragColor = vec4(outc, outa);
    }`,
});

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial);
const quadScene = new THREE.Scene();
quadScene.add(quad);
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function rowMajor(m) {
  return new THREE.Matrix4().set(...m);
}

window.renderScene = async function renderScene(spec) {
  const ssaa = spec.ssaa ?? 2;
  const W = spec.width, H = spec.height;
  const IW = W * ssaa, IH = H * ssaa;
  const shaded = spec.mode === "shaded";
  const PAL = shaded ? SHADED : LINEART;
  const r = getRenderer(IW, IH);

  const scene = new THREE.Scene();
  const idScene = new THREE.Scene();
  const idTargets = [];
  let nextId = 1;
  const fitObjects = [];

  // lights
  if (shaded) {
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environmentIntensity = 0.85;
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(150, -220, 400);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
  } else {
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(120, -160, 420);
    scene.add(key);
  }

  const materialCache = new Map();
  const colorMaterial = (styleName, t) => {
    const k = styleName + ":" + t;
    if (!materialCache.has(k)) {
      const hex = styleName === "normal" ? PAL[t] : PAL[styleName] ?? PAL[t];
      const m = shaded
        ? new THREE.MeshStandardMaterial({
            color: hex,
            metalness: styleName === "normal" && METAL.has(t) ? 0.75 : 0.05,
            roughness: styleName === "normal" && METAL.has(t) ? 0.32 : t === "frame" || t === "top_plate" ? 0.42 : 0.6,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide });
      materialCache.set(k, m);
    }
    return materialCache.get(k);
  };
  const idMaterial = (id, style) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB((id % 256) / 255, Math.floor(id / 256) / 255, style / 255, THREE.LinearSRGBColorSpace), side: THREE.DoubleSide });

  const bodies = await Promise.all(spec.bodies.map(async (b) => ({ b, gltf: b.glb ? await loadGlb(b.glb) : null })));
  for (const { b, gltf } of bodies) {
    if (!gltf || b.style === "hidden") continue;
    const hide = new Set(b.hide || []);
    const accentNodes = new Set(b.accentNodes || []);
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(rowMajor(b.matrix));
    const wrap = new THREE.Group();
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.setScalar(1000);
    const model = gltf.scene.clone(true);
    wrap.add(model);
    holder.add(wrap);
    scene.add(holder);
    holder.updateMatrixWorld(true);

    const bodyId = nextId++;
    const accentId = nextId++;
    const meshes = [];
    model.traverse((o) => {
      if (o.name && hide.has(o.name) && !accentNodes.has(o.name)) o.visible = false;
    });
    model.traverse((o) => {
      if (!o.isMesh) return;
      // visible only if no ancestor is hidden
      let v = true;
      for (let p = o; p; p = p.parent) if (p.visible === false) v = false;
      let accent = false;
      for (let p = o; p && p !== model; p = p.parent) if (accentNodes.has(p.name)) accent = true;
      if (accent) v = true;
      if (!v) return;
      let node = o.name;
      for (let p = o; p && p.parent && p.parent !== model; p = p.parent) node = p.parent.name || node;
      if (o.parent === model) node = o.name;
      const style = accent ? "accent" : b.style;
      const t = tone(b.category, nodeTopName(o, model));
      if (b.vendor && style === "normal" && shaded) {
        o.material = o.material.clone();
      } else {
        o.material = colorMaterial(style, b.vendor && !shaded ? b.category : t);
      }
      meshes.push({ mesh: o, style, id: accent ? accentId : bodyId });
    });
    // id scene: clones sharing geometry, same world transform
    for (const { mesh, style, id } of meshes) {
      const c = new THREE.Mesh(mesh.geometry, idMaterial(id, STYLE[style] ?? 1));
      c.matrixAutoUpdate = false;
      c.matrix.copy(mesh.matrixWorld);
      idScene.add(c);
      idTargets.push(c);
    }
    if (b.fit !== false && b.style !== "ghost") fitObjects.push(...meshes.map((m) => m.mesh));
  }

  // guides: dashed accent rods between world points
  for (const g of spec.guides || []) {
    const a = new THREE.Vector3(...g.from), c = new THREE.Vector3(...g.to);
    const len = a.distanceTo(c);
    if (len < 0.01) continue;
    const dir = c.clone().sub(a).normalize();
    const [dash, gap] = g.dash || [2.2, 1.6];
    const rad = g.radius ?? 0.28;
    const geo = new THREE.CylinderGeometry(rad, rad, 1, 8, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    for (let s = 0; s < len; s += dash + gap) {
      const l = Math.min(dash, len - s);
      const m = new THREE.Mesh(geo, colorMaterial("guide", "guide"));
      m.scale.set(1, l, 1);
      m.quaternion.copy(q);
      m.position.copy(a.clone().add(dir.clone().multiplyScalar(s + l / 2)));
      m.updateMatrixWorld(true);
      scene.add(m);
      const c2 = new THREE.Mesh(geo, idMaterial(4095, STYLE.guide));
      c2.matrixAutoUpdate = false;
      c2.matrix.copy(m.matrixWorld);
      idScene.add(c2);
    }
  }
  scene.updateMatrixWorld(true);
  idScene.updateMatrixWorld(true);

  // camera: orthographic, fitted to the projected vertices of the fit set
  const cam = spec.camera || {};
  const dir = new THREE.Vector3(...(cam.dir || [1, -1.15, 0.85])).normalize();
  const up = new THREE.Vector3(...(cam.up || [0, 0, 1]));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
  camera.up.copy(up);
  const box = new THREE.Box3();
  for (const m of fitObjects) box.expandByObject(m);
  if (box.isEmpty()) box.set(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50));
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length();
  camera.position.copy(center.clone().add(dir.clone().multiplyScalar(radius * 2)));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const v = new THREE.Vector3();
  const extra = (spec.anchors || []).filter((a) => a.fit).map((a) => new THREE.Vector3(...a.p));
  for (const m of fitObjects) {
    const pos = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 20000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
    }
  }
  for (const p of extra) {
    v.copy(p).applyMatrix4(inv);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  // include everything visible in depth range
  const all = new THREE.Box3().setFromObject(scene);
  for (const x of [all.min.x, all.max.x]) for (const y of [all.min.y, all.max.y]) for (const z of [all.min.z, all.max.z]) {
    v.set(x, y, z).applyMatrix4(inv);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  const margin = cam.margin ?? 0.05;
  let w = maxX - minX, h = maxY - minY;
  const cx = (minX + maxX) / 2 + (cam.shiftX || 0) * w, cy = (minY + maxY) / 2 + (cam.shiftY || 0) * h;
  const aspect = W / H;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  w *= 1 + 2 * margin; h *= 1 + 2 * margin;
  if (cam.scaleMmPerPx) { w = W * cam.scaleMmPerPx; h = H * cam.scaleMmPerPx; }
  camera.left = cx - w / 2; camera.right = cx + w / 2; camera.top = cy + h / 2; camera.bottom = cy - h / 2;
  camera.near = Math.max(0.1, -maxZ - 10); camera.far = -minZ + 10;
  camera.updateProjectionMatrix();

  // passes
  const mk = (depth) => {
    const t = new THREE.WebGLRenderTarget(IW, IH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType });
    if (depth) { t.depthTexture = new THREE.DepthTexture(IW, IH); t.depthTexture.type = THREE.FloatType; }
    return t;
  };
  const rtColor = mk(false), rtNormal = mk(true), rtId = mk(false);
  rtColor.texture.minFilter = THREE.LinearFilter;
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.NoToneMapping;
  r.setRenderTarget(rtColor); r.clear(); r.render(scene, camera);
  const normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  scene.overrideMaterial = normalMat;
  r.setRenderTarget(rtNormal); r.clear(); r.render(scene, camera);
  scene.overrideMaterial = null;
  r.setRenderTarget(rtId); r.clear(); r.render(idScene, camera);
  r.setRenderTarget(null);

  const u = compositeMaterial.uniforms;
  u.tColor.value = rtColor.texture; u.tNormal.value = rtNormal.texture; u.tDepth.value = rtNormal.depthTexture; u.tId.value = rtId.texture;
  u.texel.value.set(1 / IW, 1 / IH);
  u.depthRange.value = camera.far - camera.near;
  u.px.value = (spec.lineScale ?? 1) * ssaa / 2;
  u.shaded.value = shaded ? 1 : 0;
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(quadScene, quadCam);

  // downsample (SSAA)
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(r.domElement, 0, 0, W, H);
  const png = out.toDataURL("image/png");

  const project = (p) => {
    const q = new THREE.Vector3(...p).project(camera);
    return { x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * H };
  };
  const anchors = (spec.anchors || []).map((a) => ({ id: a.id, ...project(a.p) }));
  const mmPerPx = (camera.right - camera.left) / W;

  for (const t of [rtColor, rtNormal, rtId]) t.dispose();
  scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === "CylinderGeometry") o.geometry.dispose(); });
  return { png, anchors, mmPerPx };
};

function nodeTopName(o, model) {
  // name of the top-level part node under the model (GLB root child), e.g. "bell", "pcb"
  let p = o;
  while (p.parent && p.parent !== model && p.parent.parent !== model) p = p.parent;
  return p.name || o.name;
}

window.__ready = true;
