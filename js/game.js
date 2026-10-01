/* Pithoo 3D — game engine: 3D scene, custom physics, 7-stone stack,
   slingshot throw, rebuild chase phase, team AI. Three.js r128 vendored. */
(function () {
  "use strict";
  const C = () => PT.config;
  const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  const G = {
    ready: false, running: false, paused: false,
    scene: null, camera: null, renderer: null,
    phase: "idle",            // throw | rebuild | over
    round: 1, score: 0, best: 0,
    throwsLeft: 3, throwsUsed: 0,
    stackedCount: 0, downCount: 0,
    lives: 3, timeLeft: 0, elapsed: 0,
    stones: [], ball: null, hero: null, mates: [], defs: [],
    aim: null, joy: null,
    shake: 0, time: 0,
    onHUD: null, onEvent: null,   // ui callbacks
    proLeague: false,
  };
  try { G.best = parseInt(localStorage.getItem("pt_best") || "0", 10) || 0; } catch (e) {}

  function selBall() {
    try {
      const id = localStorage.getItem("pt_ball") || "tennis";
      return C().BALLS.find(b => b.id === id) || C().BALLS[0];
    } catch (e) { return C().BALLS[0]; }
  }
  function selGround() {
    try {
      const id = localStorage.getItem("pt_ground") || "maidan";
      return C().GROUNDS.find(g => g.id === id) || C().GROUNDS[0];
    } catch (e) { return C().GROUNDS[0]; }
  }

  /* ---------- scene ---------- */
  function makeGroundTexture(c1, c2) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const x = cv.getContext("2d");
    x.fillStyle = c1; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = Math.random() < 0.5 ? c2 : c1;
      x.globalAlpha = 0.25 + Math.random() * 0.4;
      const s = 1 + Math.random() * 3;
      x.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }

  function css(hex) { return "#" + ("000000" + hex.toString(16)).slice(-6); }

  function buildScene() {
    const gr = selGround();
    const wrap = document.getElementById("game-wrap");
    const W = wrap.clientWidth || window.innerWidth;
    const H = wrap.clientHeight || window.innerHeight;

    G.renderer = new THREE.WebGLRenderer({ antialias: true });
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    G.renderer.setSize(W, H);
    G.renderer.outputEncoding = THREE.sRGBEncoding;
    wrap.appendChild(G.renderer.domElement);

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(gr.sky);
    G.scene.fog = new THREE.Fog(gr.fog, 34, 78);

    G.camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    G.camera.position.set(0, 8, 16);
    G.camera.lookAt(0, 1, 0);

    // lights — warm dusk key + cool fill
    const hemi = new THREE.HemisphereLight(0xffe6c4, 0x2a2438, 0.75);
    G.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb066, 0.85);
    sun.position.set(-14, 20, 8);
    G.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6a7bd6, 0.3);
    fill.position.set(12, 10, -10);
    G.scene.add(fill);

    // ground
    const gtex = makeGroundTexture(css(gr.ground), css(gr.ground2));
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(34, 48),
      new THREE.MeshLambertMaterial({ map: gtex })
    );
    ground.rotation.x = -Math.PI / 2;
    G.scene.add(ground);

    // arena boundary ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(C().ARENA_R - 0.25, C().ARENA_R + 0.25, 64),
      new THREE.MeshBasicMaterial({ color: gr.line, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    G.scene.add(ring);

    // base circle where stones stack (rebuild target)
    const base = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.35, 48),
      new THREE.MeshBasicMaterial({ color: gr.ring, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    base.rotation.x = -Math.PI / 2; base.position.y = 0.03;
    G.scene.add(base);
    G.baseRing = base;

    // floodlight poles around arena
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const px = Math.cos(a) * 22, pz = Math.sin(a) * 22;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 11, 8),
        new THREE.MeshLambertMaterial({ color: 0x3a3f4a })
      );
      pole.position.set(px, 5.5, pz);
      G.scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xfff2c8 })
      );
      lamp.position.set(px, 11.2, pz);
      G.scene.add(lamp);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22 })
      );
      glow.position.copy(lamp.position);
      G.scene.add(glow);
    }

    // low-poly trees outside arena
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2);
      const r = rand(20, 28);
      const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a4030 })
      );
      trunk.position.set(tx, 0.8, tz);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(rand(1.1, 1.7), rand(2.2, 3.2), 8),
        new THREE.MeshLambertMaterial({ color: 0x2f6b3a })
      );
      top.position.set(tx, 2.6, tz);
      G.scene.add(trunk); G.scene.add(top);
    }
  }

  function blobShadow(r) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.015;
    return m;
  }

  /* ---------- stones ---------- */
  function stoneColor(i) {
    // sandstone with alternating tint, like real pithoo stones
    const base = [0xc9a06a, 0xbd9260, 0xd2ab74, 0xc39a63, 0xcb9f66, 0xb98e5c, 0xd4ad72];
    return base[i % base.length];
  }

  function buildStones() {
    G.stones = [];
    const n = C().STONE_COUNT, R = C().STONE_R, H = C().STONE_H;
    for (let i = 0; i < n; i++) {
      const geo = new THREE.CylinderGeometry(R * (1 - i * 0.035), R * (1 - i * 0.035), H, 22);
      const mat = new THREE.MeshLambertMaterial({ color: stoneColor(i) });
      const mesh = new THREE.Mesh(geo, mat);
      // white painted edge ring, like street pithoo stones
      const edge = new THREE.Mesh(
        new THREE.TorusGeometry(R * (1 - i * 0.035) - 0.02, 0.022, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0xf5f1e8 })
      );
      edge.rotation.x = Math.PI / 2;
      mesh.add(edge);
      const sh = blobShadow(R * 1.05);
      G.scene.add(sh);
      G.scene.add(mesh);
      G.stones.push({
        mesh, shadow: sh, idx: i,
        pos: V3(), vel: V3(),
        state: "stacked",          // stacked | flying | rest | placing
        tumbleAxis: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
        tumble: 0, tumbleSpeed: 0,
        placeT: 0, placeFrom: V3(), placeTo: V3(),
        claimedBy: null,
      });
    }
    resetStoneStack();
  }

  function resetStoneStack() {
    const H = C().STONE_H;
    G.stones.forEach((s, i) => {
      s.state = "stacked";
      s.pos.set(rand(-0.05, 0.05), H / 2 + i * H, rand(-0.05, 0.05));
      s.vel.set(0, 0, 0);
      s.tumble = 0; s.claimedBy = null;
      s.mesh.rotation.set(0, rand(0, TAU), 0);
      s.mesh.position.copy(s.pos);
      s.shadow.position.set(s.pos.x, 0.015, s.pos.z);
      s.shadow.visible = true;
    });
    G.stackedCount = 0;
    G.downCount = 0;
  }

  function knockStone(s, fromVel, power) {
    if (s.state !== "stacked") return;
    s.state = "flying";
    const dir = V3(s.pos.x - 0, 0, s.pos.z - 0);
    if (dir.lengthSq() < 0.01) dir.set(rand(-1, 1), 0, rand(-1, 1));
    dir.normalize();
    s.vel.set(
      fromVel.x * 0.55 + dir.x * power * rand(2, 4) + rand(-1.5, 1.5),
      rand(3.5, 6.5) * Math.min(1.4, power * 0.5 + 0.4),
      fromVel.z * 0.55 + dir.z * power * rand(2, 4) + rand(-1.5, 1.5)
    );
    s.tumbleSpeed = rand(6, 14);
    s.tumbleAxis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    G.downCount++;
    PT.audio.sfx.clatter(3);
    if (G.onHUD) G.onHUD();
  }

  function updateStones(dt) {
    const R = C().STONE_R, H = C().STONE_H, ARENA = C().ARENA_R;
    for (const s of G.stones) {
      if (s.state === "flying") {
        s.vel.y -= C().GRAVITY * dt;
        s.pos.addScaledVector(s.vel, dt);
        // stone-stone nudge while flying
        for (const o of G.stones) {
          if (o === s || o.state === "stacked") continue;
          const dx = s.pos.x - o.pos.x, dz = s.pos.z - o.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < R * 1.7 && d > 0.001 && Math.abs(s.pos.y - o.pos.y) < 0.5) {
            const push = (R * 1.7 - d) * 0.5;
            s.pos.x += dx / d * push; s.pos.z += dz / d * push;
            o.pos.x -= dx / d * push; o.pos.z -= dz / d * push;
          }
        }
        // arena clamp
        const rr = Math.hypot(s.pos.x, s.pos.z);
        if (rr > ARENA - 0.6) {
          s.pos.x *= (ARENA - 0.6) / rr; s.pos.z *= (ARENA - 0.6) / rr;
          s.vel.x *= -0.4; s.vel.z *= -0.4;
        }
        if (s.pos.y <= H / 2) {
          s.pos.y = H / 2;
          s.state = "rest";
          s.vel.set(0, 0, 0);
          s.mesh.rotation.set(0, rand(0, TAU), 0);
        } else {
          s.tumble += s.tumbleSpeed * dt;
          s.mesh.rotateOnWorldAxis(s.tumbleAxis, s.tumbleSpeed * dt);
        }
        s.mesh.position.copy(s.pos);
      } else if (s.state === "rest") {
        // gentle settle nudge apart
        for (const o of G.stones) {
          if (o === s || o.state !== "rest") continue;
          const dx = s.pos.x - o.pos.x, dz = s.pos.z - o.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < R * 1.8 && d > 0.001) {
            const push = (R * 1.8 - d) * 0.5;
            s.pos.x += dx / d * push; s.pos.z += dz / d * push;
          }
        }
        s.mesh.position.copy(s.pos);
      } else if (s.state === "carried") {
        const carrier = (G.hero && G.hero.carrying === s) ? G.hero
          : (G.mates || []).find(p => p.carrying === s);
        if (carrier) {
          s.pos.set(carrier.pos.x, 2.15, carrier.pos.z);
          s.mesh.position.copy(s.pos);
          s.mesh.rotation.y += dt * 1.4;
        }
        s.shadow.position.set(s.pos.x, 0.015, s.pos.z);
      } else if (s.state === "placing") {
        s.placeT += dt / 0.55;
        const t = Math.min(1, s.placeT);
        const e = 1 - Math.pow(1 - t, 3);
        s.pos.lerpVectors(s.placeFrom, s.placeTo, e);
        s.pos.y += Math.sin(t * Math.PI) * 1.6;
        s.mesh.position.copy(s.pos);
        s.mesh.rotation.y += dt * 3;
        if (t >= 1) {
          s.state = "stacked";
          s.pos.copy(s.placeTo);
          s.mesh.position.copy(s.pos);
          s.mesh.rotation.set(0, rand(0, TAU), 0);
          G.stackedCount++;
          PT.audio.sfx.place();
          if (G.onHUD) G.onHUD();
          if (G.stackedCount >= C().STONE_COUNT) onRebuildComplete();
        }
      } else if (s.state === "stacked") {
        s.mesh.position.copy(s.pos);
      }
      s.shadow.position.set(s.pos.x, 0.015, s.pos.z);
      s.shadow.visible = s.state !== "stacked" || s.pos.y < 1.2;
    }
  }

  /* ---------- ball ---------- */
  function buildBall() {
    const b = selBall();
    const grp = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(C().BALL_R, 20, 16),
      new THREE.MeshLambertMaterial({ color: b.color })
    );
    grp.add(sphere);
    // seam ring
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(C().BALL_R * 0.99, 0.02, 8, 24),
      new THREE.MeshBasicMaterial({ color: b.seam })
    );
    seam.rotation.x = Math.PI / 2.4;
    grp.add(seam);
    const sh = blobShadow(C().BALL_R * 1.4);
    G.scene.add(sh);
    G.scene.add(grp);
    G.ball = {
      mesh: grp, shadow: sh,
      pos: V3(0, 1.2, 9), vel: V3(),
      state: "held",   // held | flying | rest | heldD | passD | thrownD
      spin: V3(),
      thrownBy: null, flyT: 0, restT: 0,
      passFrom: V3(), passTo: V3(), passT: 0, passDur: 0.6, passTarget: null,
    };
  }

  function throwBallAt(from, vel, state, thrownBy) {
    const b = G.ball;
    b.pos.copy(from);
    b.vel.copy(vel);
    b.state = state;
    b.thrownBy = thrownBy || null;
    b.flyT = 0; b.restT = 0;
    b.spin.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    PT.audio.sfx.whoosh();
  }

  function updateBall(dt) {
    const b = G.ball, R = C().BALL_R, ARENA = C().ARENA_R;
    if (b.state === "flying" || b.state === "thrownD") {
      b.flyT += dt;
      b.vel.y -= C().GRAVITY * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      // ground bounce — or roll like a real skiddy pithoo throw
      if (b.pos.y < R) {
        b.pos.y = R;
        if (Math.abs(b.vel.y) > 1.6) {
          b.vel.y *= -0.42;
          b.vel.x *= 0.7; b.vel.z *= 0.7;
          PT.audio.sfx.bounce();
        } else {
          b.vel.y = 0;
          const hs = Math.hypot(b.vel.x, b.vel.z);
          if (hs < 0.9) {
            b.vel.set(0, 0, 0);
            b.state = "rest";
            b.restT = 0;
          } else {
            const fr = Math.max(0, 1 - 2.4 * dt);
            b.vel.x *= fr; b.vel.z *= fr;
          }
        }
      }
      // arena wall
      const rr = Math.hypot(b.pos.x, b.pos.z);
      if (rr > ARENA - 0.4) {
        b.pos.x *= (ARENA - 0.4) / rr; b.pos.z *= (ARENA - 0.4) / rr;
        const nx = b.pos.x / rr, nz = b.pos.z / rr;
        const dot = b.vel.x * nx + b.vel.z * nz;
        b.vel.x -= 2 * dot * nx; b.vel.z -= 2 * dot * nz;
        b.vel.multiplyScalar(0.5);
      }
      if (b.state === "flying") {
        // hit stones
        for (const s of G.stones) {
          if (s.state !== "stacked") continue;
          const dx = b.pos.x - s.pos.x, dy = b.pos.y - s.pos.y, dz = b.pos.z - s.pos.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < R + C().STONE_R * 0.95) {
            const speed = b.vel.length();
            knockStone(s, b.vel, clamp(speed / 14, 0.4, 1.6));
            // ball deflects & slows
            b.vel.multiplyScalar(0.42);
            b.vel.y = Math.abs(b.vel.y) * 0.5 + 1.5;
            b.vel.x += rand(-2, 2); b.vel.z += rand(-2, 2);
            G.shake = Math.min(0.5, G.shake + 0.18);
          }
        }
        // also scatter resting stones it rolls through
        for (const s of G.stones) {
          if (s.state !== "rest") continue;
          const dx = b.pos.x - s.pos.x, dz = b.pos.z - s.pos.z;
          if (Math.hypot(dx, dz) < R + C().STONE_R && b.pos.y < 0.8) {
            const push = 2.2;
            const d = Math.max(0.2, Math.hypot(dx, dz));
            s.pos.x += dx / d * push * dt * 8;
            s.pos.z += dz / d * push * dt * 8;
          }
        }
        if (b.flyT > 7) { b.vel.set(0, 0, 0); b.state = "rest"; b.restT = 0; }
      } else if (b.state === "thrownD") {
        // hit hero / mates
        const targets = [G.hero, ...G.mates];
        for (const p of targets) {
          if (!p || p.stun > 0 && p !== G.hero) continue;
          const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
          if (Math.hypot(dx, dz) < 0.62 && b.pos.y < 1.9) {
            onPlayerHit(p);
            b.vel.multiplyScalar(0.25);
            b.vel.y = 2;
            b.state = "rest"; b.restT = 0;
            break;
          }
        }
        // defenders can catch their own wild throw
        if (b.state === "thrownD") {
          for (const d of G.defs) {
            if (d === b.thrownBy) continue;
            const dx = b.pos.x - d.pos.x, dz = b.pos.z - d.pos.z;
            if (Math.hypot(dx, dz) < 0.8 && b.pos.y < 2 && b.flyT > 0.4) {
              d.hasBall = false;
              b.thrownBy.hasBall = false;
              b.thrownBy = null;
              d.hasBall = true;
              b.state = "heldD";
              break;
            }
          }
        }
        if (b.flyT > 5) { b.state = "rest"; b.restT = 0; }
      }
    } else if (b.state === "rest") {
      b.restT += dt;
      b.mesh.position.copy(b.pos);
    } else if (b.state === "passD") {
      b.passT += dt / b.passDur;
      const t = Math.min(1, b.passT);
      b.pos.lerpVectors(b.passFrom, b.passTo, t);
      b.pos.y += Math.sin(t * Math.PI) * 2.2;
      b.mesh.position.copy(b.pos);
      if (t >= 1) {
        if (b.passTarget) { b.passTarget.hasBall = true; }
        b.state = "heldD";
      }
    }
    // held positions are set by holder logic each frame
    b.mesh.position.copy(b.pos);
    const shScale = clamp(1 - (b.pos.y - R) / 8, 0.3, 1);
    b.shadow.scale.set(shScale, shScale, 1);
    b.shadow.position.set(b.pos.x, 0.015, b.pos.z);
  }

  /* ---------- players ---------- */
  function makePlayer(team, x, z) {
    const grp = new THREE.Group();
    const col = team === "atk" ? 0x2f7fe0 : 0xe0403a;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.36, 0.95, 12),
      new THREE.MeshLambertMaterial({ color: col })
    );
    body.position.y = 0.75;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xc98d64 })
    );
    head.position.y = 1.45;
    // cap
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 8, 0, TAU, 0, 1.1),
      new THREE.MeshLambertMaterial({ color: team === "atk" ? 0x174a8f : 0x8f1a14 })
    );
    cap.position.y = 1.5;
    grp.add(body); grp.add(head); grp.add(cap);
    // carried-stone indicator disc above head
    const carry = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 18),
      new THREE.MeshLambertMaterial({ color: 0xd4ad72 })
    );
    carry.position.y = 1.95;
    carry.visible = false;
    grp.add(carry);
    // defender windup telegraph ring
    const tele = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    tele.rotation.x = -Math.PI / 2;
    tele.position.y = 0.04;
    grp.add(tele);
    const sh = blobShadow(0.5);
    G.scene.add(sh);
    grp.position.set(x, 0, z);
    G.scene.add(grp);
    return {
      mesh: grp, shadow: sh, carryMesh: carry, teleMesh: tele,
      team, pos: V3(x, 0, z), vel: V3(),
      stun: 0, invuln: 0, carrying: null, hasBall: false,
      ai: "idle", aiT: 0, target: V3(), windup: 0,
      faceA: 0,
    };
  }

  function buildPlayers() {
    // clear old
    for (const p of [G.hero, ...G.mates, ...G.defs]) {
      if (p) { G.scene.remove(p.mesh); G.scene.remove(p.shadow); }
    }
    G.hero = makePlayer("atk", 0, 11);
    G.mates = [makePlayer("atk", -2.5, 12), makePlayer("atk", 2.5, 12)];
    G.defs = [makePlayer("def", -6, -7), makePlayer("def", 6, -7), makePlayer("def", 0, -9)];
  }

  function updatePlayerMesh(p, dt) {
    p.mesh.position.set(p.pos.x, 0, p.pos.z);
    // face movement
    if (p.vel.lengthSq() > 0.05) {
      const want = Math.atan2(p.vel.x, p.vel.z);
      let d = want - p.faceA;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      p.faceA += d * Math.min(1, dt * 10);
    }
    p.mesh.rotation.y = p.faceA;
    // little run bob
    const sp = p.vel.length();
    p.mesh.position.y = sp > 0.5 ? Math.abs(Math.sin(G.time * 11)) * 0.07 : 0;
    p.carryMesh.visible = !!p.carrying;
    if (p.carrying) p.carryMesh.rotation.y += dt * 1.5;
    p.shadow.position.set(p.pos.x, 0.015, p.pos.z);
    // stun flash
    p.mesh.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive !== undefined) {
        o.material.emissive.setHex(p.stun > 0 && Math.floor(G.time * 8) % 2 ? 0x551111 : 0x000000);
      }
    });
    if (p.invuln > 0) p.invuln -= dt;
    if (p.stun > 0) p.stun -= dt;
  }

  function movePlayer(p, dir, speed, dt) {
    if (p.stun > 0) { p.vel.multiplyScalar(1 - Math.min(1, dt * 6)); }
    else {
      p.vel.lerp(V3(dir.x * speed, 0, dir.z * speed), Math.min(1, dt * 8));
    }
    p.pos.addScaledVector(p.vel, dt);
    const r = Math.hypot(p.pos.x, p.pos.z);
    const max = C().ARENA_R - 0.8;
    if (r > max) { p.pos.x *= max / r; p.pos.z *= max / r; }
  }

  function nearestRestStone(pos, forPlayer) {
    let best = null, bd = 1e9;
    for (const s of G.stones) {
      if (s.state !== "rest") continue;
      if (s.claimedBy && s.claimedBy !== forPlayer) continue;
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function tryPickup(p) {
    if (p.carrying) return;
    const s = nearestRestStone(p.pos, p);
    if (s && Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < 1.25) {
      p.carrying = s;
      s.state = "carried";
      s.claimedBy = null;
      if (p === G.hero) PT.audio.sfx.pickup();
    }
  }

  function tryPlace(p) {
    if (!p.carrying) return false;
    if (Math.hypot(p.pos.x, p.pos.z) > 1.5) return false;
    const s = p.carrying;
    p.carrying = null;
    const order = G.placeOrder++; // next stack index (supports overlapping place animations)
    s.state = "placing";
    s.placeT = 0;
    s.placeFrom.copy(s.pos).setY(1.9);
    s.placeTo.set(rand(-0.04, 0.04), C().STONE_H / 2 + order * C().STONE_H, rand(-0.04, 0.04));
    return true;
  }

  function dropCarried(p) {
    if (!p.carrying) return;
    const s = p.carrying;
    p.carrying = null;
    s.state = "rest";
    s.pos.set(p.pos.x + rand(-0.5, 0.5), C().STONE_H / 2, p.pos.z + rand(-0.5, 0.5));
    s.mesh.position.copy(s.pos);
  }

  /* ---------- throw phase ---------- */
  function startThrowPhase() {
    G.phase = "throw";
    G.throwsLeft = C().THROWS_PER_ROUND;
    G.throwsUsed = 0;
    resetStoneStack();
    // thrower marker: hero stands at throw line
    G.hero.pos.set(0, 0, 9); G.hero.vel.set(0, 0, 0);
    G.hero.stun = 0; G.hero.carrying = null;
    for (const m of G.mates) { m.pos.set(m === G.mates[0] ? -2.5 : 2.5, 0, 11); m.vel.set(0, 0, 0); m.carrying = null; m.stun = 0; }
    // defenders wait off to the side during throw
    G.defs.forEach((d, i) => { d.pos.set(-8 + i * 8, 0, -11); d.vel.set(0, 0, 0); d.hasBall = false; });
    G.ball.state = "held";
    G.ball.pos.set(0.5, 1.15, 8.5);
    G.aim = null;
    if (G.onEvent) G.onEvent("phase", "throw");
    if (G.onHUD) G.onHUD();
  }

  function aimThrow(sx, sy, dx, dy) {
    // slingshot: drag vector -> world throw dir. screen down = pull back = throw forward (-z)
    const len = Math.hypot(dx, dy);
    const power = clamp(len / 230, 0, 1);
    let dir = V3(dx, 0, dy); // screen dy+ = world +z
    if (dir.lengthSq() < 1) dir.set(0, 0, -1);
    dir.normalize();
    // throw goes opposite of drag (pull back, release forward)
    dir.multiplyScalar(-1);
    // must have a forward component toward the stack
    const speed = 9 + power * 17;
    const elev = 10 * Math.PI / 180; // flat, skiddy throw — like a real pithoo bullet throw
    const hv = speed * Math.cos(elev);
    const vel = V3(dir.x * hv, speed * Math.sin(elev), dir.z * hv);
    return { dir, power, vel };
  }

  const trajDots = [];
  function showTrajectory(vel) {
    hideTrajectory();
    const g = C().GRAVITY;
    const p = V3(0.5, 1.15, 8.5);
    const v = vel.clone();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const dt = 0.09;
      v.y -= g * dt;
      p.addScaledVector(v, dt);
      if (p.y < 0.1) break;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat);
      d.position.copy(p);
      G.scene.add(d);
      trajDots.push(d);
      // stop at stack plane
      if (p.z < 1 && Math.hypot(p.x, p.z) < 3) break;
    }
  }
  function hideTrajectory() {
    for (const d of trajDots) { G.scene.remove(d); d.geometry.dispose(); }
    trajDots.length = 0;
  }

  function releaseThrow() {
    if (!G.aim || G.aim.power < 0.08) { G.aim = null; hideTrajectory(); return; }
    const from = V3(0.5, 1.15, 8.5);
    throwBallAt(from, G.aim.vel, "flying", null);
    G.throwsLeft--; G.throwsUsed++;
    G.aim = null;
    hideTrajectory();
    if (G.onHUD) G.onHUD();
  }

  function updateThrowPhase(dt) {
    const b = G.ball;
    if (b.state === "rest") {
      b.restT += dt;
      if (b.restT > 1.1) {
        // throw settled — evaluate
        if (G.downCount >= C().STONE_COUNT) {
          startRebuildPhase();
        } else if (G.throwsLeft > 0) {
          b.state = "held";
          b.pos.set(0.5, 1.15, 8.5);
          if (G.onHUD) G.onHUD();
        } else {
          onThrowFailed();
        }
      }
    }
  }

  function onThrowFailed() {
    G.phase = "over";
    PT.audio.sfx.lose();
    if (G.onEvent) G.onEvent("lose", "The stack still stands. Defenders take the round.");
  }

  /* ---------- rebuild phase ---------- */
  function startRebuildPhase() {
    G.phase = "rebuild";
    G.timeLeft = C().REBUILD_TIME;
    G.elapsed = 0;
    G.lives = C().LIVES;
    G.placeOrder = 0;
    // hero near base, mates spread
    G.hero.pos.set(0, 0, 6); G.hero.vel.set(0, 0, 0);
    G.mates[0].pos.set(-5, 0, 7); G.mates[1].pos.set(5, 0, 7);
    for (const m of G.mates) { m.vel.set(0, 0, 0); m.ai = "seek"; m.aiT = rand(0, 1); m.carrying = null; }
    // defenders get the ball
    let holder = G.defs[0], bd = 1e9;
    for (const d of G.defs) {
      const dd = Math.hypot(d.pos.x - G.ball.pos.x, d.pos.z - G.ball.pos.z);
      if (dd < bd) { bd = dd; holder = d; }
      d.ai = "support"; d.aiT = rand(0, 2); d.windup = 0;
      d.pos.set(d.pos.x * 0.5, 0, -6 - Math.random() * 2);
    }
    holder.ai = "fetch";
    G.ball.state = "rest";
    G.ball.thrownBy = null;
    PT.audio.sfx.whistle();
    if (G.onEvent) G.onEvent("phase", "rebuild");
    if (G.onHUD) G.onHUD();
  }

  function onPlayerHit(p) {
    dropCarried(p);
    p.stun = p === G.hero ? 1.7 : 2.6;
    if (p === G.hero) {
      if (p.invuln > 0) return;
      p.invuln = 2.2;
      G.lives--;
      G.shake = 0.7;
      PT.audio.sfx.thud();
      if (G.onHUD) G.onHUD();
      if (G.lives <= 0) {
        G.phase = "over";
        PT.audio.sfx.lose();
        if (G.onEvent) G.onEvent("lose", "All attackers are out. Defenders take the round.");
      }
    } else {
      PT.audio.sfx.thud();
    }
  }

  function onRebuildComplete() {
    if (G.phase !== "rebuild") return;
    G.phase = "over";
    const timeBonus = Math.max(0, Math.round(400 - G.elapsed * 3));
    const lifeBonus = G.lives * 150;
    let pts = 500 + timeBonus + lifeBonus;
    if (G.proLeague) pts *= 2;
    G.score += pts;
    if (G.score > G.best) {
      G.best = G.score;
      try { localStorage.setItem("pt_best", String(G.best)); } catch (e) {}
    }
    PT.audio.sfx.cheer();
    setTimeout(() => PT.audio.sfx.whistle(), 700);
    if (G.onEvent) G.onEvent("win", { points: pts, round: G.round });
  }

  function defenderThrowSpeed() {
    return 12.5 + G.round * 1.1 + (G.proLeague ? 2.5 : 0);
  }
  function defenderError() {
    return Math.max(0.45, 2.4 - G.round * 0.28 - (G.proLeague ? 0.5 : 0));
  }

  function updateDefenders(dt) {
    const b = G.ball;
    const holder = G.defs.find(d => d.hasBall);
    for (const d of G.defs) {
      d.aiT -= dt;
      if (d.ai === "windup") {
        // telegraphed throw at the hero — ball stays glued during windup
        d.windup -= dt;
        d.vel.multiplyScalar(1 - Math.min(1, dt * 6));
        d.teleMesh.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(G.time * 14));
        b.pos.set(d.pos.x + Math.sin(d.faceA) * 0.5, 1.35, d.pos.z + Math.cos(d.faceA) * 0.5);
        if (d.windup <= 0) {
          d.teleMesh.material.opacity = 0;
          // throw at predicted hero pos + error
          const from = V3(d.pos.x, 1.5, d.pos.z);
          const dist = Math.hypot(G.hero.pos.x - from.x, G.hero.pos.z - from.z);
          const spd = defenderThrowSpeed();
          const t = clamp(dist / spd, 0.25, 1.4);
          const err = defenderError();
          const target = V3(
            G.hero.pos.x + G.hero.vel.x * t * 0.85 + rand(-err, err),
            1.0,
            G.hero.pos.z + G.hero.vel.z * t * 0.85 + rand(-err, err)
          );
          const flight = t;
          const vel = V3(
            (target.x - from.x) / flight,
            (target.y - from.y) / flight + 0.5 * C().GRAVITY * flight,
            (target.z - from.z) / flight
          );
          d.hasBall = false;
          throwBallAt(from, vel, "thrownD", d);
          d.ai = "support"; d.aiT = rand(2.2, 3.8) / (1 + G.round * 0.12);
        }
      } else if (d.hasBall) {
        d.ai = "holder";
        // keep 7-11m from hero, strafe
        const toH = V3(G.hero.pos.x - d.pos.x, 0, G.hero.pos.z - d.pos.z);
        const dist = toH.length();
        const dir = V3();
        if (dist < 6.5) dir.addScaledVector(toH.normalize(), -1);
        else if (dist > 11) dir.addScaledVector(toH.normalize(), 1);
        // strafe perpendicular
        const perp = V3(-toH.z, 0, toH.x).normalize();
        dir.addScaledVector(perp, Math.sin(G.time * 0.9 + d.pos.x) * 0.7);
        if (dir.lengthSq() > 0.01) movePlayer(d, dir.normalize(), C().DEF_SPEED * 0.8, dt);
        else d.vel.multiplyScalar(1 - Math.min(1, dt * 5));
        // ball glued to hand
        b.pos.set(d.pos.x + Math.sin(d.faceA) * 0.5, 1.35, d.pos.z + Math.cos(d.faceA) * 0.5);
        b.state = "heldD";
        // decide: pass or throw
        if (d.aiT <= 0) {
          const others = G.defs.filter(o => o !== d);
          const mate = others[Math.floor(Math.random() * others.length)];
          const heroDist = Math.hypot(G.hero.pos.x - d.pos.x, G.hero.pos.z - d.pos.z);
          const shouldThrow = heroDist < 14 && Math.random() < (G.proLeague ? 0.62 : 0.5);
          if (shouldThrow) { d.ai = "windup"; d.windup = 0.75; d.aiT = 1; }
          else {
            // pass
            d.hasBall = false;
            b.state = "passD";
            b.passFrom.copy(b.pos);
            b.passTo.set(mate.pos.x, 1.35, mate.pos.z);
            b.passT = 0; b.passDur = 0.55;
            b.passTarget = mate;
            d.ai = "support"; d.aiT = rand(1.6, 3.2);
          }
        }
      } else if (d.ai === "fetch") {
        // go to resting ball
        if (b.state === "rest") {
          const to = V3(b.pos.x - d.pos.x, 0, b.pos.z - d.pos.z);
          if (to.length() < 0.9) {
            d.hasBall = true;
            b.state = "heldD";
            d.ai = "holder"; d.aiT = rand(1.2, 2.4);
          } else movePlayer(d, to.normalize(), C().DEF_SPEED, dt);
        } else {
          d.ai = "support"; d.aiT = rand(0.5, 1.5);
        }
      } else {
        // support: spread in triangle around hero at 6-9m
        const idx = G.defs.indexOf(d);
        const a = G.time * 0.25 + idx * TAU / 3;
        const want = V3(G.hero.pos.x + Math.cos(a) * 7.5, 0, G.hero.pos.z + Math.sin(a) * 7.5);
        const to = V3(want.x - d.pos.x, 0, want.z - d.pos.z);
        // if ball is resting and I'm closest, fetch it
        if (b.state === "rest") {
          let closest = true;
          for (const o of G.defs) {
            if (o === d) continue;
            const od = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z);
            const md = Math.hypot(d.pos.x - b.pos.x, d.pos.z - b.pos.z);
            if (od < md) { closest = false; break; }
          }
          if (closest) { d.ai = "fetch"; continue; }
        }
        if (to.length() > 1.2) movePlayer(d, to.normalize(), C().DEF_SPEED * 0.75, dt);
        else d.vel.multiplyScalar(1 - Math.min(1, dt * 5));
        if (d.aiT <= 0 && !holder) d.aiT = rand(0.5, 1.5);
      }
      updatePlayerMesh(d, dt);
    }
  }

  function updateMates(dt) {
    for (const m of G.mates) {
      if (m.stun > 0) { updatePlayerMesh(m, dt); continue; }
      m.aiT -= dt;
      if (m.carrying) {
        // carry to the base ring and stack
        const to = V3(-m.pos.x, 0, -m.pos.z);
        if (to.length() < 1.5) {
          if (tryPlace(m)) { m.ai = "seek"; m.aiT = 0; }
        } else movePlayer(m, to.normalize(), C().MATE_SPEED, dt);
      } else if (m.ai === "fetch") {
        // walk to claimed stone; lease expires -> re-seek
        const to = V3(m.target.x - m.pos.x, 0, m.target.z - m.pos.z);
        let claimedGone = true;
        for (const s of G.stones) {
          if (s.state === "rest" && Math.hypot(s.pos.x - m.target.x, s.pos.z - m.target.z) < 1.6) { claimedGone = false; break; }
        }
        if (claimedGone || m.aiT <= 0) { m.ai = "seek"; m.aiT = 0; }
        else if (to.length() < 1.0) {
          tryPickup(m);
          m.ai = m.carrying ? "carry" : "seek";
          m.aiT = 0;
        } else movePlayer(m, to.normalize(), C().MATE_SPEED, dt);
      } else {
        // seek: claim nearest free stone
        const s = nearestRestStone(m.pos, m);
        if (s) {
          s.claimedBy = m;
          m.target.set(s.pos.x, 0, s.pos.z);
          m.ai = "fetch";
          m.aiT = 5; // claim lease (seconds)
        } else {
          // nothing free: hold near base ring
          const want = V3(Math.sin(G.time * 0.5 + m.pos.x) * 3.5, 0, 4.5);
          const to = V3(want.x - m.pos.x, 0, want.z - m.pos.z);
          if (to.length() > 1.2) movePlayer(m, to.normalize(), C().MATE_SPEED * 0.7, dt);
          else m.vel.multiplyScalar(1 - Math.min(1, dt * 5));
          m.ai = "seek";
        }
      }
      // mate auto-pickup when walking over a stone
      if (!m.carrying) tryPickup(m);
      updatePlayerMesh(m, dt);
    }
  }

  function updateRebuildPhase(dt) {
    G.elapsed += dt;
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) {
      G.phase = "over";
      PT.audio.sfx.lose();
      if (G.onEvent) G.onEvent("lose", "Time up. Defenders held the ground.");
      return;
    }
    // hero movement from joystick
    const j = G.joy;
    if (j && j.active && G.hero.stun <= 0) {
      movePlayer(G.hero, V3(j.dx, 0, j.dy), C().HERO_SPEED, dt);
    } else {
      G.hero.vel.multiplyScalar(1 - Math.min(1, dt * 6));
      G.hero.pos.addScaledVector(G.hero.vel, dt);
    }
    if (!G.hero.carrying) tryPickup(G.hero);
    else tryPlace(G.hero);
    updatePlayerMesh(G.hero, dt);
    updateMates(dt);
    updateDefenders(dt);
    // base ring pulse
    const s = 1 + Math.sin(G.time * 4) * 0.06;
    G.baseRing.scale.set(s, s, 1);
    if (G.onHUD) G.onHUD();
  }

  /* ---------- camera ---------- */
  const camPos = V3(), camLook = V3(), camPosT = V3(), camLookT = V3();
  function updateCamera(dt) {
    if (G.phase === "throw") {
      camPosT.set(0, 6.4, 15.2);
      camLookT.set(0, 1.0, 1.2);
    } else if (G.phase === "rebuild") {
      const h = G.hero.pos;
      camPosT.set(h.x * 0.55, 13.5, h.z * 0.55 + 9.5);
      camLookT.set(h.x * 0.7, 0, h.z * 0.7 - 1);
    } else {
      camPosT.set(0, 16, 20);
      camLookT.set(0, 0, 0);
    }
    const k = Math.min(1, dt * 3.2);
    camPos.lerp(camPosT, k);
    camLook.lerp(camLookT, k);
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - dt * 2.2);
      camPos.x += rand(-1, 1) * G.shake * 0.5;
      camPos.y += rand(-1, 1) * G.shake * 0.35;
    }
    G.camera.position.copy(camPos);
    G.camera.lookAt(camLook);
  }

  /* ---------- input ---------- */
  function bindInput() {
    const el = G.renderer.domElement;
    let pid = null, sx = 0, sy = 0;
    G.joy = { active: false, dx: 0, dy: 0, ox: 0, oy: 0, id: null };
    G.sling = { active: false, id: null };

    el.addEventListener("pointerdown", e => {
      PT.audio.unlock();
      if (G.paused || !G.running) return;
      if (G.phase === "throw" && G.ball.state === "held" && G.sling.id === null) {
        G.sling.id = e.pointerId;
        G.sling.active = true;
        sx = e.clientX; sy = e.clientY;
        G.sling.sx = sx; G.sling.sy = sy;
      } else if (G.phase === "rebuild" && G.joy.id === null) {
        G.joy.id = e.pointerId;
        G.joy.active = true;
        G.joy.ox = e.clientX; G.joy.oy = e.clientY;
        G.joy.dx = 0; G.joy.dy = 0;
        if (G.onEvent) G.onEvent("joy", { x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
      }
    });
    el.addEventListener("pointermove", e => {
      if (G.phase === "throw" && G.sling.id === e.pointerId && G.sling.active) {
        const dx = e.clientX - G.sling.sx, dy = e.clientY - G.sling.sy;
        G.aim = aimThrow(0, 0, dx, dy);
        showTrajectory(G.aim.vel);
        if (G.onEvent) G.onEvent("aim", { power: G.aim.power });
      } else if (G.phase === "rebuild" && G.joy.id === e.pointerId && G.joy.active) {
        let dx = (e.clientX - G.joy.ox) / 55, dy = (e.clientY - G.joy.oy) / 55;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        G.joy.dx = dx; G.joy.dy = dy;
        if (G.onEvent) G.onEvent("joy", { x: G.joy.ox, y: G.joy.oy, dx, dy });
      }
    });
    const up = e => {
      if (G.phase === "throw" && G.sling.id === e.pointerId) {
        G.sling.id = null; G.sling.active = false;
        releaseThrow();
      } else if (G.phase === "rebuild" && G.joy.id === e.pointerId) {
        G.joy.id = null; G.joy.active = false;
        G.joy.dx = 0; G.joy.dy = 0;
        if (G.onEvent) G.onEvent("joy", null);
      }
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  /* ---------- main loop ---------- */
  let lastT = 0;
  function loop(t) {
    if (!G.running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (G.paused) { G.renderer.render(G.scene, G.camera); return; }
    G.time += dt;
    if (G.phase === "throw") updateThrowPhase(dt);
    else if (G.phase === "rebuild") updateRebuildPhase(dt);
    updateStones(dt);
    updateBall(dt);
    // defenders may hold ball — sync happens in updateDefenders; in throw phase sync held ball
    if (G.phase === "throw" && G.ball.state === "held") {
      G.ball.pos.set(0.55, 1.15, 8.5);
    }
    updateCamera(dt);
    // hero/mates mesh sync in throw phase (idle)
    if (G.phase === "throw") {
      updatePlayerMesh(G.hero, dt);
      for (const m of G.mates) updatePlayerMesh(m, dt);
      for (const d of G.defs) updatePlayerMesh(d, dt);
    }
    G.renderer.render(G.scene, G.camera);
  }

  /* ---------- public API ---------- */
  function init() {
    if (G.ready) return;
    buildScene();
    buildStones();
    buildBall();
    buildPlayers();
    bindInput();
    camPos.set(0, 16, 20); camLook.set(0, 0, 0);
    G.ready = true;
  }

  function startGame(proLeague) {
    G.proLeague = !!proLeague;
    G.round = 1;
    G.score = 0;
    G.running = true;
    G.paused = false;
    startThrowPhase();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function nextRound() {
    G.round++;
    startThrowPhase();
  }

  function setPaused(p) {
    G.paused = !!p;
  }

  function destroy() {
    G.running = false;
    const wrap = document.getElementById("game-wrap");
    if (G.renderer) {
      wrap.removeChild(G.renderer.domElement);
      G.renderer.dispose();
    }
    G.ready = false;
  }

  // test hooks
  function debug() { return G; }

  PT.game = { init, startGame, nextRound, setPaused, destroy, debug, state: G,
    selBall, selGround };
})();
