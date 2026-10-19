import * as THREE from 'three';

// Gameplay stays in 390 × 720 screen coordinates. Orthographic projection keeps
// every obstacle's 3D centre aligned with the original collision simulation.
export function createFlightScene(canvas, width, height) {
  let available = false;
  const fallback = { get available() { return available; }, render() {} };
  if (new URLSearchParams(location.search).get('renderer') === '2d') {
    canvas.hidden = true;
    return fallback;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('3D 场景不可用，已切换到 2D。', error.message);
    canvas.hidden = true;
    return fallback;
  }
  available = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); available = false; canvas.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    available = true; canvas.hidden = false;
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, width, height, 0, .1, 2000);
  camera.position.set(0, 0, 1000);
  const ambient = new THREE.HemisphereLight('#c9e9ff', '#8c6147', 2.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffd3a0', 3.4);
  sun.position.set(-180, 600, 400); scene.add(sun);
  const rim = new THREE.DirectionalLight('#78dfff', 2.2);
  rim.position.set(350, 220, -100); scene.add(rim);

  const geometries = new Map();
  function geometry(key, make) {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  }
  const sphere = geometry('sphere', () => new THREE.IcosahedronGeometry(1, 2));
  const box = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 16));
  const cone = geometry('cone', () => new THREE.ConeGeometry(1, 1, 16));
  const ring = geometry('ring', () => new THREE.TorusGeometry(1, .075, 8, 48));
  const octahedron = geometry('gem', () => new THREE.OctahedronGeometry(1));
  const materials = new Map();
  function material(color, metalness = .1, roughness = .65, glow = 0) {
    const key = `${color}/${metalness}/${roughness}/${glow}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
      color, metalness, roughness, emissive: color, emissiveIntensity: glow,
    }));
    return materials.get(key);
  }
  const wood = material('#8b5133');
  const woodLight = material('#d5a566');
  const brass = material('#dcb16c', .75, .3);
  const steel = material('#c2d2da', .72, .32);
  const dark = material('#263f4e', .65, .4);
  const red = material('#c75b45', .3, .45);
  const glass = material('#54d9ef', .45, .15, .4);
  const glow = material('#9cecff', .25, .25, 2.2);
  const gold = material('#f5c957', .75, .25, .25);

  function mesh(parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) {
    const object = new THREE.Mesh(geo, mat);
    object.position.set(x, y, z); object.scale.set(sx, sy, sz); parent.add(object);
    return object;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Group(); object.position.set(x, y, z); parent.add(object); return object;
  }
  function rod(parent, mat, x, y, z, sx, sy, sz, rotation = 0) {
    const m = mesh(parent, box, mat, x, y, z, sx, sy, sz); m.rotation.z = rotation; return m;
  }

  // A fully procedural atmosphere: no remote textures, models or CDN requests.
  const skyUniforms = { space: { value: 0 }, time: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms, depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float space; uniform float time;
      void main(){
        vec3 horizon=vec3(.93,.65,.40); vec3 zenith=vec3(.055,.19,.28);
        vec3 air=mix(horizon,zenith,smoothstep(0.,.94,vUv.y));
        vec3 cosmos=mix(vec3(.045,.12,.22),vec3(.008,.018,.057),vUv.y);
        vec3 color=mix(air,cosmos,space);
        vec2 p=(vUv-vec2(.78,.42))*vec2(.54,1.);
        float d=length(p);
        color+=vec3(1.,.56,.22)*exp(-d*9.)*.30*(1.-space);
        float disc=1.-smoothstep(.047,.049,d);
        color=mix(color,vec3(1.,.88,.65),disc*(1.-space)*.9);
        float aurora=pow(max(0.,1.-abs(vUv.y-.65-sin(vUv.x*5.+time*.08)*.11)*14.),3.);
        color+=vec3(.025,.16,.15)*aurora*space;
        float grain=fract(sin(dot(vUv,vec2(123.3,75.1)))*4357.);
        gl_FragColor=vec4(color+(grain-.5)*.012,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(width, height), skyMat);
  sky.position.set(width / 2, height / 2, -500); scene.add(sky);

  const starPositions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    starPositions[i * 3] = (Math.sin(i * 127.1) * 43758.5 % 1 + 1) % 1 * width;
    starPositions[i * 3 + 1] = (Math.sin(i * 311.7) * 12741.1 % 1 + 1) % 1 * height;
    starPositions[i * 3 + 2] = -400;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: '#e3f5ff', size: 1.6, transparent: true, opacity: 0, sizeAttenuation: false, depthWrite: false });
  const stars = new THREE.Points(starGeometry, starMaterial); scene.add(stars);

  const planet = group(scene, 315, 540, -320);
  mesh(planet, sphere, material('#6086a1', .25, .9), 0, 0, 0, 47);
  const planetRing = mesh(planet, ring, material('#a9cbcb', .5, .5, .1), 0, 0, 0, 77, 24, 77);
  planetRing.rotation.x = .5; planetRing.rotation.z = -.35;

  const terrain = group(scene, 0, 144, -140);
  for (let i = 0; i < 10; i++) {
    const peak = mesh(terrain, cone, material(i % 2 ? '#536e70' : '#3a565e'), i * 58 - 60, 10 + i % 3 * 9, -70 - i % 2 * 20, 75, 100 + i % 3 * 35, 35);
    peak.rotation.y = i;
  }
  mesh(terrain, box, material('#294247'), width / 2, -100, 0, width * 2, 200, 180);
  const launchpad = group(scene, width / 2, 144, -12);
  mesh(launchpad, cylinder, dark, 0, 3, 0, 72, 9, 29);
  mesh(launchpad, cylinder, brass, 0, 9, 0, 57, 3, 24);
  const padRing = mesh(launchpad, ring, material('#ffcf87', .4, .5, 1), 0, 12, 0, 48, 18, 1);
  padRing.rotation.x = -.35;
  for (const side of [-1, 1]) {
    rod(launchpad, dark, side * 51, 35, -20, 5, 65, 5);
    mesh(launchpad, sphere, glow, side * 51, 67, -20, 3);
    rod(launchpad, brass, side * 38, 19, -17, 28, 3, 4);
  }

  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#e6e5d7', transparent: true, opacity: .32, roughness: 1, depthWrite: false });
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const c = group(scene, i * 71 % width, i * 113 % height, -180 - i * 5);
    for (let j = 0; j < 4; j++) mesh(c, sphere, cloudMaterial, (j - 1.5) * 22, Math.sin(j * 2) * 5, j, 25, 11 + j % 2 * 7, 12);
    c.scale.setScalar(.7 + i % 3 * .22); clouds.push(c);
  }

  const craftRoot = group(scene);
  let craftModel = null;
  let craftKey = '';
  const flames = [];
  function addEngine(parent, x, y, z, size = 1) {
    mesh(parent, cylinder, dark, x, y, z, 5 * size, 10 * size, 5 * size);
    const fire = group(parent, x, y - 12 * size, z);
    const outer = mesh(fire, cone, material('#ff8a37', .05, .5, 2.5), 0, -7 * size, 0, 6 * size, 24 * size, 6 * size);
    outer.rotation.z = Math.PI;
    const inner = mesh(fire, cone, material('#fff2b0', .05, .5, 3), 0, -4 * size, 2, 3 * size, 17 * size, 3 * size);
    inner.rotation.z = Math.PI;
    flames.push(fire);
  }
  function buildCraft(craft, stats) {
    if (craftModel) craftRoot.remove(craftModel);
    craftModel = group(craftRoot); flames.length = 0;
    const model = craftModel;
    const level = craft.appearanceTier;
    if (level === 1 && craft.tier < 2) {
      rod(model, wood, 0, -5, 0, 39, 7, 27);
      rod(model, woodLight, 0, 13, -10, 32, 32, 5);
      for (const side of [-1, 1]) {
        rod(model, wood, side * 16, -20, 0, 4, 28, 5);
        rod(model, brass, side * 21, 0, 5, 4, 15, 5);
        rod(model, woodLight, side * 18, 7, 5, 13, 3, 21);
        const kite = mesh(model, octahedron, material('#c6a969'), side * 39, 1, -12, 10, 17, 2);
        kite.rotation.z = side * -.4;
        rod(model, brass, side * 27, -5, -6, 25, .7, .7, side * .4);
      }
      mesh(model, sphere, material('#d4a077'), 0, 30, 3, 7, 8, 7);
      mesh(model, sphere, material('#263137'), 0, 35, 1, 7.2, 4, 7.3);
      mesh(model, cylinder, red, 0, 12, 4, 8, 21, 7);
      for (const side of [-1, 1]) {
        rod(model, red, side * 7, -2, 10, 6, 12, 7);
        rod(model, dark, side * 7, -10, 13, 7, 4, 10);
      }
      const count = Math.min(7, stats.rocketCount);
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? 0 : -24 + i * 48 / (count - 1);
        mesh(model, cylinder, red, x, -17, -7, 4, 26, 4);
        mesh(model, cone, brass, x, -1, -7, 4, 7, 4);
        addEngine(model, x, -31, -7, .65);
      }
    } else if (level >= 2 && level <= 4) {
      mesh(model, sphere, steel, 0, 0, 0, 14, 38, 12);
      rod(model, brass, 0, 0, 0, 85, 5, 15);
      if (level >= 3) rod(model, red, 0, -7, -10, 73, 3, 16);
      rod(model, dark, 0, -25, 0, 37, 4, 10);
      mesh(model, sphere, glass, 0, 13, 10, 7, 11, 6);
      rod(model, dark, 0, 40, 0, 4, 5, 5);
      const prop = rod(model, brass, 0, 43, 0, 40, 2, 3);
      prop.name = 'propeller'; addEngine(model, 0, -36, 0, .9);
    } else if (level <= 7 || (level === 1 && craft.tier < 4)) {
      const big = level === 7;
      mesh(model, cylinder, steel, 0, 0, 0, 16, 65, 16);
      mesh(model, cone, red, 0, 44, 0, 16, 28, 16);
      mesh(model, sphere, glass, 0, 13, 15, 7, 9, 3);
      rod(model, red, 0, -19, 0, 33, 7, 33);
      for (const side of [-1, 1]) {
        const fin = mesh(model, cone, dark, side * 20, -27, -2, 13, 30, 7);
        fin.rotation.z = -side * .4;
        if (big || level === 6) { mesh(model, cylinder, steel, side * 24, -7, -3, 7, 49, 7); addEngine(model, side * 24, -34, -3, .8); }
      }
      addEngine(model, 0, -36, 0, 1.2);
    } else {
      const advanced = Math.max(0, level - 11);
      const color = new THREE.Color().setHSL(.49 + advanced * .018, .4, .5).getHex();
      const hull = material(color, .78, .25);
      mesh(model, sphere, hull, 0, 0, 0, 39 + advanced, 13, 26);
      mesh(model, sphere, glass, 0, 11, 0, 19, 14, 16);
      const orbit = mesh(model, ring, glow, 0, 0, 0, 44 + advanced * 2, 18 + advanced, 1);
      orbit.rotation.x = .5; orbit.name = 'warp-ring';
      for (let i = 0; i < 5; i++) mesh(model, sphere, glow, (i - 2) * 14, -4, 23 - Math.abs(i - 2) * 3, 2.1);
      if (advanced > 3) {
        const outer = mesh(model, ring, material('#bdabff', .2, .4, 1.8), 0, 0, 0, 55, 32, 1);
        outer.rotation.y = .8; outer.name = 'outer-ring';
      }
      for (const side of [-1, 1]) addEngine(model, side * 19, -14, 0, .7);
      addEngine(model, 0, -16, 0, 1.1);
    }
    model.rotation.y = -.22;
  }

  const shieldMaterial = new THREE.MeshPhysicalMaterial({ color: '#75dfff', transparent: true, opacity: .12, metalness: .4, roughness: .2, side: THREE.DoubleSide, depthWrite: false });
  const shield = mesh(craftRoot, sphere, shieldMaterial, 0, 0, 0, 49, 70, 42);
  const shieldRing = mesh(craftRoot, ring, glow, 0, 0, 0, 48, 68, 1);
  shieldRing.material = new THREE.MeshBasicMaterial({ color: '#98f7ff', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
  const engineLight = new THREE.PointLight('#ff9e45', 900, 150, 1.5);
  engineLight.position.set(0, -45, 28); craftRoot.add(engineLight);

  // One object per active entity, pooled by type. Geometry/materials are shared.
  const activeItems = new Map();
  const itemPools = new Map();
  function buildItem(type) {
    const object = new THREE.Group();
    if (type === 'coin') {
      const c = mesh(object, cylinder, gold, 0, 0, 0, 10, 3, 10); c.rotation.x = Math.PI / 2;
      mesh(object, ring, brass, 0, 0, 2, 8);
      rod(object, brass, 0, 0, 3, 2, 8, 1);
    } else if (type === 'gem') {
      mesh(object, octahedron, material('#66e5f3', .4, .1, .7), 0, 0, 0, 10, 13, 8);
      mesh(object, ring, material('#c7fcff', .2, .4, 1), 0, 0, 0, 14, 14, 1).rotation.x = .7;
    } else if (type === 'bird') {
      mesh(object, sphere, material('#6f6966'), 0, 0, 0, 5, 4, 6);
      mesh(object, cone, brass, 0, 4, 0, 2, 5, 2);
      for (const side of [-1, 1]) {
        const wing = group(object, side * 3, 0, 0);
        mesh(wing, sphere, material('#45576a'), side * 7, 0, 0, 10, 2, 4);
        wing.name = side < 0 ? 'left-wing' : 'right-wing';
      }
    } else if (type === 'lightning') {
      const storm = material('#536579');
      for (let i = 0; i < 3; i++) mesh(object, sphere, storm, (i - 1) * 12, 14 + i % 2 * 5, -3, 15, 9, 9);
      const bolt = new THREE.Shape();
      bolt.moveTo(3, 17); bolt.lineTo(-10, -3); bolt.lineTo(-1, -3); bolt.lineTo(-8, -24); bolt.lineTo(13, 3); bolt.lineTo(4, 3); bolt.closePath();
      const boltGeometry = geometry('bolt', () => new THREE.ExtrudeGeometry(bolt, { depth: 3, bevelEnabled: false }));
      mesh(object, boltGeometry, material('#ffe8a1', .1, .4, 2), 0, -3, 5);
    } else if (type === 'meteor' || type === 'debris') {
      mesh(object, sphere, material(type === 'meteor' ? '#9c7260' : '#8698a2', .5, .9), 0, 0, 0, 15, 13, 11);
      if (type === 'meteor') {
        const tail = mesh(object, cone, material('#fa9a55', .1, .5, 1), 0, 24, -3, 9, 43, 7);
        tail.rotation.z = -.2;
      } else rod(object, brass, 5, 2, 5, 3, 16, 3, .6);
    } else if (type === 'satellite') {
      mesh(object, box, steel, 0, 0, 0, 15, 14, 12);
      for (const side of [-1, 1]) {
        rod(object, brass, side * 13, 0, 0, 12, 2, 2);
        rod(object, material('#275c89', .65, .4), side * 23, 0, 0, 17, 16, 2);
        for (let j = 0; j < 3; j++) rod(object, glass, side * 23, (j - 1) * 5, 2, 16, .5, .5);
      }
      mesh(object, cone, brass, 0, 12, 0, 7, 9, 5).rotation.z = .45;
    }
    return object;
  }

  const particleCount = 420;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  const particleMaterial = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false; scene.add(particles);
  const colorScratch = new THREE.Color();

  const streakCount = 36;
  const streakPositions = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({ color: '#c5f4ff', transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
  streaks.frustumCulled = false; scene.add(streaks);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previousX = width / 2;

  return {
    get available() { return available; },
    render({ game, stats, craft, rocketY, shield: protectedFlight }) {
      if (!available) return;
      const t = game.lastTime / 1000;
      const flying = game.mode === 'play';
      const space = THREE.MathUtils.smoothstep(game.altitude, 12000, 180000);
      skyUniforms.space.value = space; skyUniforms.time.value = t;
      starMaterial.opacity = .1 + space * .85;
      planet.visible = space > .12;
      planet.scale.setScalar(.6 + space * .4); planet.rotation.z = -.2;
      cloudMaterial.opacity = (1 - space) * .24;
      for (let i = 0; i < clouds.length; i++) {
        clouds[i].position.y = height - ((i * 113 + game.visualScroll * (.2 + i % 3 * .15) + t * 2) % (height + 100) - 50);
      }
      const groundScroll = flying ? Math.min(420, game.altitude * 8 + game.visualScroll * .62) : game.mode === 'landing' ? Math.min(420, game.altitude * 7) : 0;
      terrain.position.y = 144 - groundScroll * .65;
      launchpad.position.y = 144 - groundScroll;
      terrain.visible = groundScroll < 400;
      launchpad.visible = groundScroll < 350;

      const key = `${craft.appearanceTier}/${craft.tier}/${stats.rocketCount}`;
      if (key !== craftKey) { buildCraft(craft, stats); craftKey = key; }
      craftRoot.position.set(game.rocketX, height - rocketY, 20);
      const bank = reducedMotion ? 0 : THREE.MathUtils.clamp((game.rocketX - previousX) * -.045, -.25, .25);
      craftRoot.rotation.z += (bank - craftRoot.rotation.z) * .15;
      if (!reducedMotion) craftModel.rotation.y = -.22 + Math.sin(t * .7) * .12;
      previousX = game.rocketX;
      const propeller = craftModel.getObjectByName('propeller');
      if (propeller) propeller.rotation.y = t * (game.engine ? 35 : 3);
      const warpRing = craftModel.getObjectByName('warp-ring');
      if (warpRing && !reducedMotion) warpRing.rotation.z = Math.sin(t) * .2;
      const outerRing = craftModel.getObjectByName('outer-ring');
      if (outerRing && !reducedMotion) outerRing.rotation.y = t * .3;
      for (let i = 0; i < flames.length; i++) {
        flames[i].visible = game.engine;
        flames[i].scale.y = (game.pulseTimer > 0 ? 1.9 : .85) + (reducedMotion ? 0 : Math.sin(t * 37 + i) * .16);
      }
      engineLight.intensity = game.engine ? (game.pulseTimer > 0 ? 1800 : 900) : 0;
      shield.visible = shieldRing.visible = protectedFlight;
      shieldMaterial.opacity = .10 + Math.sin(t * 3) * .025;
      shieldRing.rotation.y = reducedMotion ? .25 : Math.sin(t * .8) * .35;

      const living = new Set(game.items);
      for (const [item, object] of activeItems) {
        if (!living.has(item)) {
          scene.remove(object); activeItems.delete(item);
          if (!itemPools.has(item.type)) itemPools.set(item.type, []);
          itemPools.get(item.type).push(object);
        }
      }
      for (const item of game.items) {
        let object = activeItems.get(item);
        if (!object) {
          object = itemPools.get(item.type)?.pop() || buildItem(item.type);
          activeItems.set(item, object); scene.add(object);
        }
        object.position.set(item.x, height - item.y, 20);
        object.rotation.z = item.type === 'meteor' || item.type === 'debris' ? item.spin : Math.sin(item.spin) * .12;
        object.rotation.y = item.type === 'coin' || item.type === 'gem' ? item.spin : .15;
        if (item.type === 'bird') {
          object.getObjectByName('left-wing').rotation.z = Math.sin(item.spin * 3) * .6;
          object.getObjectByName('right-wing').rotation.z = -Math.sin(item.spin * 3) * .6;
        }
      }
      const count = Math.min(game.particles.length, particleCount);
      for (let i = 0; i < count; i++) {
        const p = game.particles[i];
        particlePositions.set([p.x, height - p.y, 35], i * 3);
        colorScratch.set(p.color).multiplyScalar(Math.min(1, p.life / 12));
        particleColors.set([colorScratch.r, colorScratch.g, colorScratch.b], i * 3);
      }
      particleGeometry.setDrawRange(0, count);
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      streaks.visible = flying && !reducedMotion;
      const motion = Math.min(1, Math.sqrt(game.speed) / 7);
      streakMaterial.opacity = .045 + motion * .18;
      for (let i = 0; i < streakCount; i++) {
        const x = (i * 79 + 13) % width;
        const y = (i * 137 - game.visualScroll * (1 + i % 3 * .3)) % (height + 100);
        const wrapped = (y + height + 100) % (height + 100);
        const length = 8 + motion * 55;
        streakPositions.set([x, wrapped, -20, x, wrapped - length, -20], i * 6);
      }
      streakGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    },
  };
}
