import * as THREE from "three";
let instance;
const colors = {
  cpu: 0xffa945,
  gpu: 0x8f76ff,
  ram: 0x41d4b0,
  ssd: 0x48adff,
  case: 0xb49aff,
};
class Rig {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb4b4da, 3));
    const a = new THREE.DirectionalLight(0xffffff, 4);
    a.position.set(3, 8, 7);
    this.scene.add(a);
    const b = new THREE.DirectionalLight(0xa897ff, 2);
    b.position.set(-6, 2, -4);
    this.scene.add(b);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(5, 3.7, 8);
    this.camera.lookAt(0, 2, 0);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.parts = {};
    this.build = {};
    this.active = "cpu";
    this.tick = 0;
    this.retiring = [];
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 64),
      new THREE.MeshBasicMaterial({
        color: 0xaab0cc,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.1;
    shadow.scale.y = 0.65;
    this.root.add(shadow);
    this.base();
    this.ro = new ResizeObserver(() => this.resize());
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Complete PC preview. The current component is highlighted.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }
  mat(color, metalness = 0.3, roughness = 0.45, extra = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      ...extra,
    });
  }
  box(g, w, h, d, x, y, z, color, extra = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat(color, 0.4, 0.4, extra),
    );
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  }
  cylinder(g, r, h, x, y, z, color) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 32),
      this.mat(color, 0.5, 0.3),
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  ring(g, r, x, y, z, color) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.026, 8, 48),
      this.mat(color, 0.15, 0.25, { emissive: color, emissiveIntensity: 0.5 }),
    );
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  fan(g, r, x, y, z, color) {
    this.cylinder(g, r, 0.07, x, y, z, 0x242c3b);
    this.ring(g, r * 0.87, x, y, z + 0.046, color);
    for (let n = 0; n < 7; n++) {
      const blade = this.box(g, r * 0.65, r * 0.25, 0.035, 0, 0, 0, 0x697786);
      blade.position.set(
        x + Math.cos(n * 0.897) * r * 0.42,
        y + Math.sin(n * 0.897) * r * 0.42,
        z + 0.056,
      );
      blade.rotation.z = n * 0.897 + 0.4;
    }
    this.cylinder(g, r * 0.22, 0.09, x, y, z + 0.07, 0x3e485f);
  }
  base() {
    const g = new THREE.Group();
    this.root.add(g);
    this.box(g, 2.35, 3, 0.08, -0.1, 2.13, -0.77, 0x233240);
    for (let i = 0; i < 8; i++)
      this.box(g, 0.03, 1.8, 0.025, -0.95 + i * 0.25, 2.05, -0.71, 0x537687);
    for (let i = 0; i < 6; i++)
      this.box(g, 0.25, 0.13, 0.08, -0.85 + i * 0.33, 3.47, -0.64, 0x111b25);
    this.box(g, 2.6, 0.48, 1.65, 0, 0.4, 0, 0x252936);
    this.box(g, 0.7, 0.22, 0.03, -0.65, 0.43, 0.845, 0x4e5466);
    for (let i = 0; i < 8; i++)
      this.box(g, 0.022, 0.17, 0.03, -0.95 + i * 0.08, 0.43, 0.87, 0x9299ac);
    for (const x of [-1, 1]) this.box(g, 0.4, 0.12, 0.65, x, 0.04, 0, 0x282b37);
  }
  component(c, tier) {
    const g = new THREE.Group();
    const accent = colors[c];
    if (c === "cpu") {
      this.box(g, 0.91, 0.91, 0.08, -0.42, 2.7, -0.62, 0x2f654f);
      this.box(
        g,
        0.74,
        0.74,
        0.15,
        -0.42,
        2.7,
        -0.51,
        tier === 3 ? 0xd7c9ef : 0xbcc4ce,
      );
      for (let i = 0; i < 9; i++) {
        this.box(g, 0.027, 0.06, 0.02, -0.75 + i * 0.085, 2.23, -0.6, 0xd6ba5d);
        this.box(g, 0.027, 0.06, 0.02, -0.75 + i * 0.085, 3.16, -0.6, 0xd6ba5d);
      }
      if (tier > 1)
        for (let i = 0; i < tier; i++)
          this.box(
            g,
            0.5,
            0.02,
            0.014,
            -0.42,
            2.55 + i * 0.11,
            -0.425,
            0x8798bb,
          );
    }
    if (c === "gpu") {
      const width = [1.35, 1.95, 2.42][tier - 1];
      this.box(g, width, 0.72, 0.35, -0.05, 1.7, 0.14, 0x222936);
      this.box(
        g,
        width,
        0.085,
        0.38,
        -0.05,
        2.04,
        0.14,
        tier === 3 ? 0x9e79ff : 0x526a9e,
      );
      for (let i = 0; i < tier; i++)
        this.fan(
          g,
          0.28,
          -0.05 + (i - (tier - 1) / 2) * 0.73,
          1.68,
          0.35,
          tier === 1 ? 0x69bfa7 : accent,
        );
      this.box(g, width - 0.12, 0.035, 0.28, -0.05, 1.29, 0.06, 0x63825b);
    }
    if (c === "ram") {
      for (let n = 0; n < (tier === 1 ? 1 : 2); n++) {
        const x = 0.45 + n * 0.27;
        this.box(
          g,
          0.18,
          1.21,
          0.13,
          x,
          2.73,
          -0.45,
          tier === 1 ? 0x276341 : 0x283441,
        );
        for (let j = 0; j < 6; j++)
          this.box(g, 0.12, 0.12, 0.035, x, 2.22 + j * 0.2, -0.36, 0x151a20);
        this.box(
          g,
          0.18,
          0.055,
          0.14,
          x,
          3.36,
          -0.44,
          tier === 3 ? 0xc1a1ff : accent,
        );
      }
    }
    if (c === "ssd") {
      this.box(
        g,
        1.02,
        0.25,
        0.065,
        -0.33,
        0.95,
        -0.55,
        tier === 1 ? 0x29764c : 0x34445b,
      );
      for (let i = 0; i < 3; i++)
        this.box(g, 0.21, 0.18, 0.04, -0.65 + i * 0.31, 0.95, -0.5, 0x1a232b);
      if (tier > 1) {
        this.box(
          g,
          1.05,
          0.28,
          0.07,
          -0.33,
          0.95,
          -0.43,
          tier === 3 ? 0xb1b7c6 : 0x31568d,
        );
        for (let i = 0; i < 7; i++)
          this.box(
            g,
            1,
            0.015,
            0.02,
            -0.33,
            0.85 + i * 0.033,
            -0.385,
            tier === 3 ? 0x5f6a81 : 0x48a7e3,
          );
      }
    }
    if (c === "case") {
      const cl = [0xe5e8ef, 0x343e48, 0xa9a0db][tier - 1];
      for (const x of [-1.4, 1.4])
        for (const z of [-0.92, 0.92])
          this.box(g, 0.09, 3.9, 0.09, x, 2, z, cl);
      for (const y of [0.1, 3.93]) {
        this.box(g, 2.87, 0.09, 1.92, 0, y, 0, cl);
      }
      this.box(g, 0.07, 3.9, 1.9, -1.44, 2, 0, cl, {
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      });
      this.box(g, 2.75, 3.68, 0.022, 0, 2, 0.97, 0xdcefff, {
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      });
      const f = new THREE.Group();
      f.rotation.y = Math.PI / 2;
      f.position.x = 1.48;
      g.add(f);
      this.box(f, 1.87, 3.8, 0.09, 0, 2, 0, cl, {
        transparent: true,
        opacity: tier === 1 ? 0.5 : 0.18,
        depthWrite: false,
      });
      for (let i = 0; i < 3; i++)
        this.fan(
          f,
          0.45,
          0,
          1 + i * 1.05,
          0.075,
          tier === 3 ? [0x63e6c0, 0xaa8eff, 0xf899b2][i] : 0x758d9b,
        );
      if (tier === 2)
        for (let i = 0; i < 14; i++)
          this.box(f, 0.035, 3.6, 0.05, -0.84 + i * 0.13, 2, 0.14, 0x8c7159);
      this.cylinder(g, 0.075, 0.015, 0.82, 3.98, 0.5, 0x5d4e9a);
    }
    g.userData.category = c;
    return g;
  }
  mount(el, build, active) {
    if (this.el !== el) {
      this.ro.disconnect();
      this.el = el;
      el.replaceChildren(this.renderer.domElement);
      this.ro.observe(el);
    }
    const change = Object.keys(build).filter((c) => this.build[c] !== build[c]);
    for (const c of change) {
      if (this.parts[c]) {
        const old = this.parts[c];
        old.userData.out = performance.now();
        old.traverse((o) => {
          if (o.material) {
            o.material.transparent = true;
            o.material.depthWrite = false;
            o.userData.oldOpacity = o.material.opacity;
          }
        });
        this.retiring.push(old);
      }
      const g = this.component(c, Number(build[c]?.slice(-1)) || 1);
      this.parts[c] = g;
      this.root.add(g);
      if (c === active) {
        g.position.z = 0.75;
        g.userData.swap = performance.now();
      }
    }
    this.build = { ...build };
    this.active = active;
    for (const [c, g] of Object.entries(this.parts))
      g.traverse((o) => {
        if (o.material?.emissive) {
          o.material.emissive.setHex(c === active ? colors[c] : 0x000000);
          o.material.emissiveIntensity = c === active ? 0.18 : 0;
        }
      });
    this.resize();
  }
  resize() {
    if (!this.el?.isConnected) return;
    const w = this.el.clientWidth,
      h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  animate(t) {
    requestAnimationFrame(this.animate);
    if (!this.el?.isConnected || document.hidden || t - this.tick < 32) return;
    this.tick = t;
    for (const g of [...this.retiring]) {
      const dt = Math.min(1, (performance.now() - g.userData.out) / 220);
      g.position.z = -dt * 0.4;
      g.traverse((o) => {
        if (o.material)
          o.material.opacity = (o.userData.oldOpacity ?? 1) * (1 - dt);
      });
      if (dt === 1) {
        this.root.remove(g);
        g.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        this.retiring.splice(this.retiring.indexOf(g), 1);
      }
    }
    const reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
    for (const g of Object.values(this.parts)) {
      if (g.userData.swap) {
        const dt = Math.min(1, (performance.now() - g.userData.swap) / 450);
        g.position.z = reduced ? 0 : 0.75 * (1 - dt) ** 3;
        if (dt === 1) delete g.userData.swap;
      }
    }
    const active = this.parts[this.active];
    if (active && !reduced)
      active.traverse((o) => {
        if (o.material?.emissive)
          o.material.emissiveIntensity = 0.18 + Math.sin(t / 550) * 0.055;
      });
    this.renderer.render(this.scene, this.camera);
  }
}
export function mountRig(el, build, active) {
  try {
    instance ||= new Rig();
    instance.mount(el, build, active);
  } catch {
    el.innerHTML = `<img class="rig-fallback" src="${import.meta.env.BASE_URL}parts/${build.case || "case3"}.webp" alt="Your complete PC case"><div class="fallback-part"><img src="${import.meta.env.BASE_URL}parts/${build[active] || "cpu1"}.webp" alt="Highlighted ${active}"></div>`;
  }
}
