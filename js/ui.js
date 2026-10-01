/* Pithoo 3D — UI shell: menu, howto, HUD, pause, win/lose, shop, Pro + UPI pay. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const C = () => PT.config;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    if (id) $(id).classList.add("active");
  }

  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---------- HUD ---------- */
  const hudCache = { phase: "", stones: "", lives: -1, timer: "", score: "", round: "" };
  function hud() {
    const st = PT.game.state;
    const phaseTxt = st.phase === "throw" ? "THROW " + (st.throwsUsed + 1) + "/" + C().THROWS_PER_ROUND
      : st.phase === "rebuild" ? "REBUILD THE STACK" : "";
    if (phaseTxt !== hudCache.phase) { hudCache.phase = phaseTxt; $("hud-phase").textContent = phaseTxt; }
    const stonesTxt = st.phase === "throw"
      ? st.downCount + "/" + C().STONE_COUNT + " DOWN"
      : st.stackedCount + "/" + C().STONE_COUNT + " STACKED";
    if (stonesTxt !== hudCache.stones) { hudCache.stones = stonesTxt; $("hud-stones").textContent = stonesTxt; }
    const showLives = st.phase === "rebuild";
    $("hud-lives").style.display = showLives ? "flex" : "none";
    if (showLives && st.lives !== hudCache.lives) {
      hudCache.lives = st.lives;
      let hearts = "";
      for (let i = 0; i < C().LIVES; i++) {
        hearts += '<svg class="heart' + (i < st.lives ? "" : " lost") + '" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-9.8-9.2C.6 8.6 2.4 5 5.8 5c2 0 3.4 1.1 4.2 2.3h4c.8-1.2 2.2-2.3 4.2-2.3 3.4 0 5.2 3.6 3.6 6.8C19.5 16.1 12 21 12 21z" transform="scale(0.92) translate(1,0)"/></svg>';
      }
      $("hud-lives").innerHTML = hearts;
    }
    const timerTxt = st.phase === "rebuild" ? fmtTime(st.timeLeft) : "";
    if (timerTxt !== hudCache.timer) { hudCache.timer = timerTxt; $("hud-timer").textContent = timerTxt; }
    $("hud-timer").style.display = st.phase === "rebuild" ? "block" : "none";
    const scoreTxt = st.score > 0 ? String(st.score) : "";
    if (scoreTxt !== hudCache.score) { hudCache.score = scoreTxt; $("hud-score").textContent = scoreTxt; }
    const roundTxt = "ROUND " + st.round;
    if (roundTxt !== hudCache.round) { hudCache.round = roundTxt; $("hud-round").textContent = roundTxt; }
  }

  function banner(text, sub, ms) {
    $("banner-title").textContent = text;
    $("banner-sub").textContent = sub || "";
    $("banner").classList.add("show");
    clearTimeout(banner._t);
    banner._t = setTimeout(() => $("banner").classList.remove("show"), ms || 2200);
  }

  function toast(text, ms) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => $("toast").classList.remove("show"), ms || 1800);
  }

  /* ---------- events from game ---------- */
  function onGameEvent(kind, data) {
    if (kind === "phase") {
      if (data === "throw") {
        banner("BREAK THE STACK", "Drag back & release to throw \u2022 " + C().THROWS_PER_ROUND + " throws");
      } else if (data === "rebuild") {
        banner("STACK IT BACK", "Drag to run \u2022 dodge the ball \u2022 rebuild all 7");
      }
    } else if (kind === "aim") {
      const el = $("power-fill");
      el.style.width = Math.round(data.power * 100) + "%";
      $("power-wrap").style.opacity = data.power > 0.03 ? "1" : "0";
    } else if (kind === "joy") {
      const j = $("joystick");
      if (!data) { j.style.opacity = "0"; return; }
      j.style.opacity = "0.9";
      j.style.left = data.x + "px";
      j.style.top = data.y + "px";
      $("joy-knob").style.transform = "translate(" + data.dx * 34 + "px," + data.dy * 34 + "px)";
    } else if (kind === "win") {
      setTimeout(() => showWin(data), 900);
    } else if (kind === "lose") {
      setTimeout(() => showLose(data), 900);
    }
  }

  function showWin(data) {
    $("win-points").textContent = "+" + data.points;
    $("win-round").textContent = "ROUND " + data.round + " COMPLETE";
    show("screen-win");
    $("hud").classList.remove("active");
  }

  function showLose(msg) {
    $("lose-msg").textContent = msg;
    $("lose-score").textContent = PT.game.state.score > 0 ? "SCORE " + PT.game.state.score : "";
    show("screen-lose");
    $("hud").classList.remove("active");
  }

  /* ---------- shop ---------- */
  function ballCard(b) {
    const locked = b.pro && !PT.upi.isPro();
    const active = (localStorage.getItem("pt_ball") || "tennis") === b.id;
    return '<div class="shop-card' + (locked ? " locked" : "") + (active ? " active" : "") + '" data-ball="' + b.id + '">' +
      '<div class="ball-prev" style="background:#' + b.color.toString(16).padStart(6, "0") + '"></div>' +
      '<div class="shop-name">' + esc(b.name) + '</div>' +
      '<div class="shop-tag">' + (locked ? "PRO" : active ? "SELECTED" : "FREE") + "</div></div>";
  }

  function groundCard(g) {
    const locked = g.pro && !PT.upi.isPro();
    const active = (localStorage.getItem("pt_ground") || "maidan") === g.id;
    return '<div class="shop-card' + (locked ? " locked" : "") + (active ? " active" : "") + '" data-ground="' + g.id + '">' +
      '<div class="ground-prev" style="background:linear-gradient(180deg,#' + g.sky.toString(16).padStart(6, "0") + " 45%,#" + g.ground.toString(16).padStart(6, "0") + ' 45%)"></div>' +
      '<div class="shop-name">' + esc(g.name) + '</div>' +
      '<div class="shop-tag">' + (locked ? "PRO" : active ? "SELECTED" : "FREE") + "</div></div>";
  }

  function renderShop() {
    $("shop-balls").innerHTML = C().BALLS.map(ballCard).join("");
    $("shop-grounds").innerHTML = C().GROUNDS.map(groundCard).join("");
    document.querySelectorAll("[data-ball]").forEach(el => {
      el.onclick = () => {
        const b = C().BALLS.find(x => x.id === el.dataset.ball);
        if (b.pro && !PT.upi.isPro()) { openPro(); return; }
        try { localStorage.setItem("pt_ball", b.id); } catch (e) {}
        PT.audio.sfx.click();
        renderShop();
        toast(b.name + " selected \u2014 applies on next game");
      };
    });
    document.querySelectorAll("[data-ground]").forEach(el => {
      el.onclick = () => {
        const g = C().GROUNDS.find(x => x.id === el.dataset.ground);
        if (g.pro && !PT.upi.isPro()) { openPro(); return; }
        try { localStorage.setItem("pt_ground", g.id); } catch (e) {}
        PT.audio.sfx.click();
        renderShop();
        toast(g.name + " selected \u2014 applies on next game");
      };
    });
    renderProBadge();
  }

  function renderProBadge() {
    const pro = PT.upi.isPro();
    $("menu-pro-btn").innerHTML = pro ? "PRO ACTIVE" : "GO PRO \u20B9" + C().PRO_PRICE_INR;
    $("menu-pro-btn").classList.toggle("pro-on", pro);
    $("shop-pro-note").style.display = pro ? "none" : "block";
  }

  /* ---------- pro / pay ---------- */
  function openPro() {
    PT.audio.sfx.click();
    renderProList();
    show("screen-pro");
  }

  function renderProList() {
    const pro = PT.upi.isPro();
    $("pro-state").innerHTML = pro
      ? '<div class="pro-active">PRO is active on this device. Enjoy Pro League, all grounds and balls.</div>'
      : '<ul class="pro-list">' +
        "<li><b>Pro League</b> \u2014 faster, sharper defenders + 2x score</li>" +
        "<li><b>All 4 grounds</b> \u2014 Beach & Night Turf unlocked</li>" +
        "<li><b>All 5 balls</b> \u2014 Leather, Golden & Neon unlocked</li>" +
        "<li>One-time payment \u2014 no subscription, yours forever</li></ul>" +
        '<div class="pro-price">\u20B9' + C().PRO_PRICE_INR + ' <span>one-time</span></div>';
    $("pro-buy").style.display = pro ? "none" : "block";
  }

  function openPay() {
    PT.audio.sfx.click();
    if (!PT.upi.isConfigured()) {
      $("pay-qr-zone").innerHTML = '<div class="pay-pending">Payments are being set up.<br>Please check back soon.</div>';
      $("pay-utr-row").style.display = "none";
      $("pay-open-app").style.display = "none";
    } else {
      const { intent, txnRef } = PT.upi.buildIntent();
      $("pay-txn").textContent = "Ref: " + txnRef;
      // local QR (vendored generator, no network)
      try {
        const qr = qrcode(0, "M");
        qr.addData(intent);
        qr.make();
        $("pay-qr-zone").innerHTML = qr.createImgTag(5, 4);
      } catch (e) {
        $("pay-qr-zone").innerHTML = '<div class="pay-pending">QR failed to render.</div>';
      }
      $("pay-utr-row").style.display = "flex";
      $("pay-open-app").style.display = "block";
      $("pay-open-app").onclick = () => { window.location.href = intent; };
    }
    $("pay-utr").value = "";
    $("pay-msg").textContent = "";
    show("screen-pay");
  }

  function verifyUtr() {
    const v = $("pay-utr").value;
    if (!PT.upi.validUtr(v)) {
      $("pay-msg").textContent = "Enter the 12-digit UTR from your UPI app.";
      $("pay-msg").className = "pay-msg err";
      return;
    }
    PT.upi.activatePro();
    PT.audio.sfx.pro();
    $("pay-msg").textContent = "Pro unlocked. Welcome to the league.";
    $("pay-msg").className = "pay-msg ok";
    setTimeout(() => { renderProBadge(); renderShop(); show("screen-menu"); }, 1200);
  }

  /* ---------- boot ---------- */
  function bindMenu() {
    $("btn-play").onclick = () => {
      PT.audio.unlock(); PT.audio.sfx.click();
      startMatch(false);
    };
    $("btn-league").onclick = () => {
      PT.audio.unlock(); PT.audio.sfx.click();
      if (!PT.upi.isPro()) { openPro(); return; }
      startMatch(true);
    };
    $("btn-howto").onclick = () => { PT.audio.sfx.click(); show("screen-howto"); };
    $("btn-shop").onclick = () => { PT.audio.sfx.click(); renderShop(); show("screen-shop"); };
    $("menu-pro-btn").onclick = openPro;
    $("btn-mute").onclick = () => {
      const m = !PT.audio.isMuted();
      PT.audio.setMuted(m);
      $("btn-mute").textContent = m ? "SOUND OFF" : "SOUND ON";
    };
    $("btn-mute").textContent = PT.audio.isMuted() ? "SOUND OFF" : "SOUND ON";
    document.querySelectorAll("[data-back]").forEach(b => {
      b.onclick = () => { PT.audio.sfx.click(); show("screen-menu"); renderProBadge(); };
    });
    $("pro-buy").onclick = openPay;
    $("pay-verify").onclick = verifyUtr;
    $("btn-pause").onclick = () => {
      PT.audio.sfx.click();
      PT.game.setPaused(true);
      show("screen-pause");
    };
    $("btn-resume").onclick = () => { PT.audio.sfx.click(); PT.game.setPaused(false); show(null); $("hud").classList.add("active"); };
    $("btn-quit").onclick = () => { PT.audio.sfx.click(); quitToMenu(); };
    $("btn-again").onclick = () => { PT.audio.sfx.click(); startMatch(false); };
    $("btn-next-round").onclick = () => { PT.audio.sfx.click(); PT.game.nextRound(); show(null); $("hud").classList.add("active"); };
    $("btn-menu2").onclick = () => { PT.audio.sfx.click(); quitToMenu(); };
    $("btn-menu3").onclick = () => { PT.audio.sfx.click(); quitToMenu(); };
    const best = PT.game.state.best;
    if (best > 0) $("menu-best").textContent = "BEST " + best;
  }

  function startMatch(proLeague) {
    show(null);
    $("hud").classList.add("active");
    PT.game.startGame(proLeague);
    hud();
  }

  function quitToMenu() {
    PT.game.setPaused(false);
    PT.game.destroy();
    PT.game.init();
    PT.game.state.onHUD = hud;
    PT.game.state.onEvent = onGameEvent;
    // reset hud cache so menu->game transition repaints
    hudCache.phase = ""; hudCache.stones = ""; hudCache.lives = -1;
    hudCache.timer = ""; hudCache.score = ""; hudCache.round = "";
    PT.game.state.running = true;
    PT.game.state.phase = "idle";
    let last = performance.now();
    (function idleLoop(t) {
      const st = PT.game.state;
      if (!st.running || st.phase !== "idle") return;
      requestAnimationFrame(idleLoop);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      st.time += dt;
      idleA += dt * 0.1;
      if (st.camera) {
        st.camera.position.set(Math.sin(idleA) * 20, 12, Math.cos(idleA) * 20);
        st.camera.lookAt(0, 1, 0);
      }
      if (st.renderer) st.renderer.render(st.scene, st.camera);
    })(last);
    show("screen-menu");
    $("hud").classList.remove("active");
    const best = PT.game.state.best;
    $("menu-best").textContent = best > 0 ? "BEST " + best : "";
    renderProBadge();
  }

  function boot() {
    PT.game.init();
    PT.game.state.onHUD = hud;
    PT.game.state.onEvent = onGameEvent;
    bindMenu();
    renderProBadge();
    // idle menu backdrop: slow camera orbit behind menu
    PT.game.state.running = true;
    PT.game.state.phase = "idle";
    let last = performance.now();
    (function idleLoop(t) {
      const st = PT.game.state;
      if (!st.running || st.phase !== "idle") return;
      requestAnimationFrame(idleLoop);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      st.time += dt;
      idleA += dt * 0.1;
      if (st.camera) {
        st.camera.position.set(Math.sin(idleA) * 20, 12, Math.cos(idleA) * 20);
        st.camera.lookAt(0, 1, 0);
      }
      updateStonesIdle(dt);
      if (st.renderer) st.renderer.render(st.scene, st.camera);
    })(last);
    show("screen-menu");
    // hide loader
    setTimeout(() => $("loader").classList.add("hide"), 400);
  }

  let idleA = 0;
  // keep the stone stack gently visible during menu (stones already stacked by init)
  function updateStonesIdle(dt) {}

  PT.ui = { boot, hud, toast, banner, openPro };
  document.addEventListener("DOMContentLoaded", boot);
})();
