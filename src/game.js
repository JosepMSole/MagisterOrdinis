(() => {
  const V = { w: 1080, h: 1920 };

  const MAX_GAMES_PER_CONSOLE = 20;

  const MODES = {
    easy:   { name: "FÁCIL",  pickPerConsole: 5,  hasTimer:false, timeLimit:0,   hasWater:false },
    normal: { name: "NORMAL", pickPerConsole: 10, hasTimer:true,  timeLimit:120, hasWater:false },
    guzman: { name: "GUZMÁN", pickPerConsole: 20, hasTimer:true,  timeLimit:160, hasWater:true, dropletSeconds:10 }
  };

  const CONSOLES = [
    { key:"SNES",      shelfImg:"shelf_snes.png",      genericGameImg:"game_snes.png" },
    { key:"GAMECUBE",  shelfImg:"shelf_gamecube.png",  genericGameImg:"game_gamecube.png" },
    { key:"MEGADRIVE", shelfImg:"shelf_megadrive.png", genericGameImg:"game_megadrive.png" },
    { key:"FAMICOM",   shelfImg:"shelf_famicom.png",   genericGameImg:"game_famicom.png" },
  ];

  function consoleKeyToFilePrefix(consoleKey) { return consoleKey.toLowerCase(); }
  function two(n) { return String(n).padStart(2, "0"); }
  function uniqueGameFilename(consoleKey, idx) {
    return `game_${consoleKeyToFilePrefix(consoleKey)}_${two(idx)}.png`;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  function resize() {
    const wrap = document.getElementById("gameWrap");
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const scale = Math.min(w / V.w, h / V.h);
    canvas.style.width = (V.w * scale) + "px";
    canvas.style.height = (V.h * scale) + "px";
  }
  window.addEventListener("resize", resize, { passive:true });
  resize();

  const IMG = {};
  const OPTIMG = {};
  const toLoad = [
    "background_room.png","box_big.png","water_overlay.png",
    "shelf_snes.png","shelf_gamecube.png","shelf_megadrive.png","shelf_famicom.png",
    "game_snes.png","game_gamecube.png","game_megadrive.png","game_famicom.png",
    "icon_pause.png",
    "character_front.png","character_back_idle.png","character_back_left.png","character_back_right.png",
    "glow.png"
  ];

  function loadAll() {
    return Promise.all(toLoad.map(name => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { IMG[name] = im; res(); };
      im.onerror = rej;
      im.src = "assets/img/" + name;
    })));
  }

  function loadOptional(name) {
    return new Promise((res)=>{
      const im=new Image();
      im.onload=()=>{OPTIMG[name]=im;res(true);};
      im.onerror=()=>{res(false);};
      im.src="assets/img/"+name;
    });
  }

  // Lazy cache para imágenes únicas
  const UNIQUE_IMG = new Map(); // fname => { img, status }
  function getUniqueGameImage(consoleKey, idx) {
    const fname = uniqueGameFilename(consoleKey, idx);
    if (UNIQUE_IMG.has(fname)) return UNIQUE_IMG.get(fname);

    const rec = { img: new Image(), status: "loading" };
    rec.img.onload = () => { rec.status = "ok"; };
    rec.img.onerror = () => { rec.status = "fail"; };
    rec.img.src = "assets/img/" + fname;

    UNIQUE_IMG.set(fname, rec);
    return rec;
  }
  function getGenericGameImage(consoleKey) {
    const c = CONSOLES.find(x => x.key === consoleKey);
    return IMG[c.genericGameImg];
  }

  const input = {
    down:false, id:null, x:0, y:0, justDown:false, justUp:false,
    toVirtual(e) {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      return { x: px * V.w, y: py * V.h };
    }
  };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = input.toVirtual(e);
    input.down = true;
    input.id = e.pointerId;
    input.x = p.x; input.y = p.y;
    input.justDown = true;
  }, { passive:false });

  canvas.addEventListener("pointermove", (e) => {
    if (!input.down) return;
    e.preventDefault();
    const p = input.toVirtual(e);
    input.x = p.x; input.y = p.y;
  }, { passive:false });

  canvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    if (e.pointerId !== input.id) return;
    input.down = false;
    input.id = null;
    input.justUp = true;
  }, { passive:false });

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function easeOutBack(t){
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
  }
  function rectHit(px,py,r){ return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }
  function now(){ return performance.now(); }

  function roundRect(x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawTextShadow(text, x,y, size=44, color="#fff", align="center") {
    ctx.font = `700 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(text, x+3, y+3);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawButton(rect, label) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(rect.x, rect.y, rect.w, rect.h, 18, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 3;
    roundRect(rect.x, rect.y, rect.w, rect.h, 18, false, true);
    drawTextShadow(label, rect.x+rect.w/2, rect.y+rect.h/2, 44);
    ctx.restore();
  }

  const layout = {
    shelves: [
      { key:"SNES",      x:  30, y: 200, w: 240, h: 680 },
      { key:"GAMECUBE",  x: 290, y: 200, w: 240, h: 680 },
      { key:"MEGADRIVE", x: 550, y: 200, w: 240, h: 680 },
      { key:"FAMICOM",   x: 810, y: 200, w: 240, h: 680 },
    ],
    box: { x:110, y:1260, w:860, h:540 },
    character: { x:(V.w-520)/2, y:720, w:520, h:900 },
    btnPause: { x: V.w-140, y: 20, w:100, h:100 }
  };

  const menuButtons = (() => {
    const btnW = 680, btnH = 120, x = (V.w - btnW) / 2;
    const y0 = 950;
    return [
      { r:{ x, y:y0,       w:btnW, h:btnH }, key:"easy" },
      { r:{ x, y:y0+150,   w:btnW, h:btnH }, key:"normal" },
      { r:{ x, y:y0+300,   w:btnW, h:btnH }, key:"guzman" },
    ];
  })();

  const pauseMenu = {
    panel: { x:(V.w-720)/2, y: 620, w:720, h:520 },
    btnResume: { x:(V.w-520)/2, y: 780, w:520, h:120 },
    btnExit: { x:(V.w-520)/2, y: 930, w:520, h:120 }
  };

  let state = "menu"; // menu | intro | play | pause | win | lose
  let menuStart = 0;
  function setMenu(){ state="menu"; menuStart = now(); }
  let modeKey = "easy";
  let mode = MODES[modeKey];

  const drops = [];

  // Juego actual (en mano)
  const current = {
    active:false,
    game: { consoleKey:"SNES", idx:1 },
    x: V.w/2, y: 1230,
    dragging:false,
    homeX: V.w/2, homeY: 0, // se recalcula en resetLevel
  };

  // Tamaños: cartucho de caja “x3” (aprox ancho caja)
  const GAME_RATIO = 170/260;

  function getBoxGameSize() {
    const w = layout.box.w * 0.98;     // ~ iguala anchura de caja
    const h = w * GAME_RATIO;
    return { w, h };
  }

  function getDragGameSize() {
    // Grande cerca de la caja, pequeño cerca de los estantes
    const { w:bigW, h:bigH } = getBoxGameSize();
    const shelvesBottom = layout.shelves[0].y + layout.shelves[0].h; // ~880
    const t = clamp((current.y - shelvesBottom) / (current.homeY - shelvesBottom), 0, 1);
    // minW ~ 1/3 del grande al llegar arriba (antes del snap)
    const minW = bigW * 0.33;
    const w = lerp(minW, bigW, t);
    const h = w * GAME_RATIO;
    return { w, h };
  }

  // Snap anim (vuela al hueco final)
  const snap = {
    active:false,
    game:null,
    fromX:0, fromY:0, toX:0, toY:0,
    fromW:0, fromH:0, toW:0, toH:0,
    t0:0,
    dur:260
  };

  let pending = {};
  let placedByConsole = {};
  let totalTarget = 0;
  let placedCount = 0;

  // brillo temporal del contador por estante
  let counterGlow = { SNES:0, GAMECUBE:0, MEGADRIVE:0, FAMICOM:0 };

  let startTime = 0;
  let timeLeft = 0;
  let introStart = 0;
  let waterLevel = 0; // 0..1 => 75% altura
  let pausedAt = 0;

  function shuffle(a) {
    for (let i=a.length-1;i>0;i--) {
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function buildGamePoolForConsole(consoleKey, pickCount) {
    const indices = [];
    for (let i=1;i<=MAX_GAMES_PER_CONSOLE;i++) indices.push(i);
    shuffle(indices);
    const chosen = indices.slice(0, pickCount).sort((a,b)=>a-b);
    return chosen.map(idx => ({ consoleKey, idx }));
  }

  function pickRandomPendingGame() {
    const pool = [];
    for (const c of CONSOLES) {
      const list = pending[c.key] || [];
      for (let i=0;i<list.length;i++) pool.push(list[i]);
    }
    if (!pool.length) return null;
    return pool[(Math.random()*pool.length)|0];
  }

  function removePending(game) {
    const list = pending[game.consoleKey];
    if (!list) return;
    const idx = list.findIndex(g => g.idx === game.idx);
    if (idx >= 0) list.splice(idx, 1);
  }

  function resetLevel() {
    mode = MODES[modeKey];

    pending = {};
    placedByConsole = {};
    for (const c of CONSOLES) {
      pending[c.key] = buildGamePoolForConsole(c.key, mode.pickPerConsole);
      placedByConsole[c.key] = [];
    }

    totalTarget = CONSOLES.length * mode.pickPerConsole;
    placedCount = 0;

    current.active = true;
    current.dragging = false;
    current.homeY = layout.box.y + layout.box.h * 0.45;
    current.x = current.homeX;
    current.y = current.homeY;
    current.game = pickRandomPendingGame() || { consoleKey:"SNES", idx:1 };

    snap.active = false;
    snap.game = null;

    startTime = now();
    timeLeft = mode.hasTimer ? mode.timeLimit : 0;
    waterLevel = 0;
    drops.length = 0;
    counterGlow = { SNES:0, GAMECUBE:0, MEGADRIVE:0, FAMICOM:0 };

    introStart = now();
    state = "intro";
  }

  function renderTopBar() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,V.w,120);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0,120); ctx.lineTo(V.w,120);
    ctx.stroke();

    drawTextShadow(`NIVEL 1 · ${mode.name}`, 24, 60, 40, "#fff", "left");
    drawTextShadow(`${placedCount}/${totalTarget}`, V.w*0.52, 60, 42, "#fff");

    if (mode.hasTimer) {
      const s = Math.max(0, Math.ceil(timeLeft));
      const mm = String(Math.floor(s/60)).padStart(2,"0");
      const ss = String(s%60).padStart(2,"0");
      const warn = s <= 10;
      drawTextShadow(`${mm}:${ss}`, V.w*0.72, 60, 44, warn ? "#ffb3b3" : "#fff");
    }

    ctx.drawImage(IMG["icon_pause.png"], layout.btnPause.x, layout.btnPause.y, layout.btnPause.w, layout.btnPause.h);
    ctx.restore();
  }

  // Grid: 3 cols x 7 filas
  const SHELF_GRID = { cols: 3, rows: 7 };

  function getShelfInnerArea(shelfRect) {
    const padX = 14;
    const topPad = 135;
    const bottomPad = 70;
    return {
      x: shelfRect.x + padX,
      y: shelfRect.y + topPad,
      w: shelfRect.w - padX*2,
      h: shelfRect.h - topPad - bottomPad
    };
  }

  function getSlotCenter(shelfRect, slotIndex) {
    const area = getShelfInnerArea(shelfRect);
    const cols = SHELF_GRID.cols;
    const rows = SHELF_GRID.rows;
    const i = clamp(slotIndex, 0, cols*rows-1);

    const r = (i / cols) | 0;
    const c = i % cols;

    const cellW = area.w / cols;
    const cellH = area.h / rows;

    const cx = area.x + c*cellW + cellW/2;
    const cy = area.y + r*cellH + cellH/2;
    return { cx, cy, cellW, cellH };
  }

  function getThumbSizeForShelf(shelfRect) {
    const area = getShelfInnerArea(shelfRect);
    const cellW = area.w / SHELF_GRID.cols;

    const w = Math.min(cellW * 0.92, 92);
    const h = w * GAME_RATIO;
    return { w, h };
  }

  function renderShelfThumbnails(shelfRect, consoleKey) {
    const list = placedByConsole[consoleKey] || [];
    if (!list.length) return;

    const maxSlots = SHELF_GRID.cols * SHELF_GRID.rows;
    const { w:thumbW, h:thumbH } = getThumbSizeForShelf(shelfRect);

    for (let i=0; i<Math.min(list.length, maxSlots); i++) {
      const { cx, cy } = getSlotCenter(shelfRect, i);

      const g = list[i];
      const rec = getUniqueGameImage(g.consoleKey, g.idx);
      const img = (rec.status === "ok") ? rec.img : getGenericGameImage(g.consoleKey);

      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(img, cx - thumbW/2, cy - thumbH/2, thumbW, thumbH);
      ctx.restore();
    }
  }

  function renderShelfCounterTopCenter(shelfRect, consoleKey) {
    const remainingCount = (pending[consoleKey] || []).length;

    const badgeW = 90;
    const badgeH = 44;
    const x = shelfRect.x + shelfRect.w/2 - badgeW/2;
    const y = shelfRect.y + 102; // SUBIDO un poquito (antes ~118)

const gT = counterGlow[consoleKey] || 0;
const g = (now() - gT) / 400; // 0..1 en 0.4s
if (g >= 0 && g <= 1) {
  const a = (1 - g);
  ctx.save();
  ctx.globalAlpha = 0.75 * a;
  ctx.strokeStyle = "rgba(255,255,200,1)";
  ctx.lineWidth = 10;
  roundRect(x-6, y-6, badgeW+12, badgeH+12, 16, false, true);
  ctx.globalAlpha = 0.35 * a;
  ctx.lineWidth = 18;
  roundRect(x-10, y-10, badgeW+20, badgeH+20, 18, false, true);
  ctx.restore();
}


    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(x, y, badgeW, badgeH, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    roundRect(x, y, badgeW, badgeH, 12, false, true);
    drawTextShadow(String(remainingCount), x + badgeW/2, y + badgeH/2, 30);
    ctx.restore();
  }

  function renderWaterIfNeeded() {
    if (!(mode.hasWater && state === "play")) return;

    const dropletT = mode.dropletSeconds || 10;
    const elapsed = (now()-startTime)/1000;
    if (elapsed < dropletT) return;

    const targetH = Math.floor(V.h * 0.75);
    const waterH  = Math.max(0, Math.floor(waterLevel * targetH));
    if (waterH <= 0) return;

    const topY = V.h - waterH;

    // cuerpo del agua
    ctx.save();
    ctx.fillStyle = "rgba(40,140,220,0.16)";
    ctx.fillRect(0, topY, V.w, waterH);

    // SUPERFICIE PNG completo con ondeo suave
const waveY = topY - 120;
const drawY = Math.floor(waveY);
const drawH = Math.max(1, V.h - drawY);

const t = now()/1000;
const offsetX = Math.sin(t*2.0)*12;

ctx.save();
ctx.globalAlpha = 0.55;
ctx.translate(offsetX,0);
ctx.drawImage(IMG["water_overlay.png"],0,drawY,V.w,drawH);
ctx.restore();
  }

  function renderRoomBase() {
    ctx.drawImage(IMG["background_room.png"], 0,0,V.w,V.h);

    // shelves
    for (const s of layout.shelves) {
      const c = CONSOLES.find(z => z.key === s.key);
      ctx.drawImage(IMG[c.shelfImg], s.x, s.y, s.w, s.h);

      renderShelfThumbnails(s, s.key);
      renderShelfCounterTopCenter(s, s.key);
    }

    // character
    if (state === "intro") {
      const t = (now()-introStart)/900;
      if (t < 1) {
        ctx.drawImage(IMG["character_front.png"], layout.character.x, layout.character.y, layout.character.w, layout.character.h);
        return; // intro no dibuja resto
      } else {
        state = "play";
      }
    }

    let charImg = IMG["character_back_idle.png"];
    if (current.dragging) {
      charImg = (current.x < V.w/2) ? IMG["character_back_left.png"] : IMG["character_back_right.png"];
    }
    ctx.drawImage(charImg, layout.character.x, layout.character.y, layout.character.w, layout.character.h);

    // box
    ctx.drawImage(IMG["box_big.png"], layout.box.x, layout.box.y, layout.box.w, layout.box.h);

    // gotas (si hay)
    if (mode.hasWater && state === "play" && drops.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(120,200,255,0.55)";
      ctx.lineWidth = 2;
      for (const p of drops) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + 14);
        ctx.stroke();
      }
      ctx.restore();
    }

    // agua (antes del juego de caja, para que NO lo tape)
    renderWaterIfNeeded();
  }

  function renderMenu() {
  ctx.drawImage(IMG["background_room.png"],0,0,V.w,V.h);
  ctx.fillStyle="rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,V.w,V.h);

  const logo=OPTIMG["logo.png"];
  if(logo && logo.complete && logo.naturalWidth>0){
    const lw=1000;
    const lh=lw*(logo.naturalHeight/logo.naturalWidth);
    ctx.drawImage(logo,(V.w-lw)/2,180,lw,lh);
  }

  drawTextShadow("Selecciona dificultad",V.w/2,820,38,"rgba(255,255,255,0.9)");
  drawButton(menuButtons[0].r,"FÁCIL (20 juegos)");
  drawButton(menuButtons[1].r,"NORMAL (40 + tiempo)");
  drawButton(menuButtons[2].r,"GUZMÁN (80 + agua)");
  drawTextShadow("Toca para empezar",V.w/2,1550,40,"rgba(255,255,255,0.9)");

  // POPS1 overlay
  const pops=OPTIMG["pops1.png"];
  if(pops && pops.complete && pops.naturalWidth>0){
    const t=now()/1000;
    const enter=Math.min(1,(now()-menuStart)/1200);
    const ease=enter*enter*(3-2*enter);
    const y=V.h*(1-ease);
    const wiggle=Math.sin(t*3.5)*6;

    ctx.save();
    ctx.translate(0,y+wiggle);
    ctx.drawImage(pops,0,0,V.w,V.h);

    // dynamic glitch
    for(let i=0;i<8;i++){
      if(Math.random()<0.4){
        const sy=Math.random()*V.h;
        const sh=10+Math.random()*40;
        const dx=(Math.random()*30)-15;
        ctx.globalAlpha=0.5;
        ctx.drawImage(pops,0,sy,pops.width,sh,dx,sy,V.w,sh);
      }
    }
    ctx.restore();
  }
}


  function renderPause() {
    renderRoomBase();
    renderTopBar();
    renderForegroundGame(); // caja/juego encima de todo

    ctx.fillStyle = "rgba(0,0,0,0.60)";
    ctx.fillRect(0,0,V.w,V.h);

    ctx.save();
    ctx.fillStyle = "rgba(10,10,10,0.65)";
    roundRect(pauseMenu.panel.x, pauseMenu.panel.y, pauseMenu.panel.w, pauseMenu.panel.h, 26, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    roundRect(pauseMenu.panel.x, pauseMenu.panel.y, pauseMenu.panel.w, pauseMenu.panel.h, 26, false, true);
    ctx.restore();

    drawTextShadow("PAUSA", V.w/2, 700, 76);
    drawButton(pauseMenu.btnResume, "REANUDAR");
    drawButton(pauseMenu.btnExit, "SALIR");
  }

  let endButton = null;
  function renderEnd(kind){
  renderRoomBase();
  renderTopBar();

  ctx.fillStyle="rgba(0,0,0,0.65)";
  ctx.fillRect(0,0,V.w,V.h);

  drawTextShadow("¡COMPLETADO!",V.w/2,700,84);
  drawTextShadow(`Resultado: ${placedCount}/${totalTarget}`,V.w/2,820,46);

  // Partículas frenéticas
  for(let i=0;i<40;i++){
    const x=Math.random()*V.w;
    const y=Math.random()*V.h;
    ctx.fillStyle="rgba(255,255,255,"+(0.3+Math.random()*0.7)+")";
    ctx.fillRect(x,y,2,2);
  }

  // POPS1 overlay con wiggle (sin tapar botón)
  const pops=OPTIMG["pops1.png"];
  if(pops && pops.complete && pops.naturalWidth>0){
    const t=now()/1000;
    const wiggle=Math.sin(t*2.5)*4;
    ctx.save();
    ctx.translate(0,wiggle);
    ctx.globalAlpha=0.9;
    ctx.drawImage(pops,0,0,V.w,V.h);
    ctx.restore();
  }

  const btn={x:(V.w-520)/2,y:1050,w:520,h:120};
  drawButton(btn,"VOLVER AL MENÚ");
  endButton=btn;
}


  function drawGameAt(game, x, y, w, h, alpha=1) {
    const rec = getUniqueGameImage(game.consoleKey, game.idx);
    const img = (rec.status === "ok") ? rec.img : getGenericGameImage(game.consoleKey);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - w/2, y - h/2, w, h);
    ctx.restore();
  }

  function beginSnapToShelf(consoleKey, game, fromW, fromH) {
    const shelfRect = layout.shelves.find(s => s.key === consoleKey);
    const slotIndex = (placedByConsole[consoleKey] || []).length;
    const { cx, cy } = getSlotCenter(shelfRect, slotIndex);
    const { w:toW, h:toH } = getThumbSizeForShelf(shelfRect);

    snap.active = true;
    snap.game = game;
    snap.fromX = current.x;
    snap.fromY = current.y;
    snap.toX = cx;
    snap.toY = cy;
    snap.fromW = fromW;
    snap.fromH = fromH;
    snap.toW = toW;
    snap.toH = toH;
    snap.t0 = now();
  }

  // Foreground: el cartucho de la caja SIEMPRE va por encima de TODO
  function renderForegroundGame() {
    if (state === "intro") return;

    if (snap.active) {
      const t = clamp((now() - snap.t0) / snap.dur, 0, 1);
      const e = easeOutBack(t);

      const x = lerp(snap.fromX, snap.toX, e);
      const y = lerp(snap.fromY, snap.toY, e);

      const w = lerp(snap.fromW, snap.toW, t);
      const h = lerp(snap.fromH, snap.toH, t);

      const pop = 1 + 0.10*Math.sin(Math.PI * t);
      drawGameAt(snap.game, x, y, w*pop, h*pop, 0.98);
      return;
    }

    if (current.dragging) {
      // drag con escala dinámica
      const { w, h } = getDragGameSize();

      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(IMG["glow.png"], current.x-150, current.y-150, 300, 300);
      ctx.restore();

      drawGameAt(current.game, current.x, current.y, w, h, 1);
      return;
    }

    // juego en la caja (x3 aprox)
    if (current.active) {
      const { w, h } = getBoxGameSize();
      drawGameAt(current.game, current.homeX, current.homeY, w, h, 0.98);
    }
  }

  function update(dt) {
    if (state === "menu" && input.justDown) {
      for (const b of menuButtons) {
        if (rectHit(input.x, input.y, b.r)) {
          modeKey = b.key;
          resetLevel();
          break;
        }
      }
    }

    if ((state==="win" || state==="lose") && input.justDown) {
      if (endButton && rectHit(input.x, input.y, endButton)) state = "menu";
    }

    if (state === "pause" && input.justDown) {
      if (rectHit(input.x, input.y, pauseMenu.btnResume)) {
        const delta = now() - pausedAt;
        startTime += delta;
        pausedAt = 0;
        state = "play";
      } else if (rectHit(input.x, input.y, pauseMenu.btnExit)) {
    setMenu();
      }
    }

    if (state === "play") {
      if (input.justDown && rectHit(input.x, input.y, layout.btnPause)) {
        state = "pause";
        pausedAt = now();
        input.justDown = false;
        input.justUp = false;
        return;
      }

      // snap in progress
      if (snap.active) {
        const t = (now() - snap.t0) / snap.dur;
        if (t >= 1) {
          placedCount++;
          removePending(snap.game);
          placedByConsole[snap.game.consoleKey].push(snap.game);
          counterGlow[snap.game.consoleKey] = now();

          if (mode.hasTimer) startTime -= 800;

          snap.active = false;
          snap.game = null;

          const nxt = pickRandomPendingGame();
          if (!nxt) state = "win";
          else current.game = nxt;

          current.x = current.homeX;
          current.y = current.homeY;
          current.dragging = false;
        }

        input.justDown = false;
        input.justUp = false;
        return;
      }

      // timer
      if (mode.hasTimer) {
        const elapsed = (now()-startTime)/1000;
        timeLeft = mode.timeLimit - elapsed;
        if (timeLeft <= 0) state = "lose";
      }

      // Guzmán: gotas + agua
      if (mode.hasWater) {
        const elapsed = (now() - startTime) / 1000;
        const dropletT = mode.dropletSeconds || 10;

        // gotas lentas y pocas, siempre
        if (Math.random() < 0.10) {
          drops.push({ x: Math.random()*V.w, y: -20 - Math.random()*120, vy: 240 + Math.random()*180 });
        }
        for (let i=drops.length-1;i>=0;i--) {
          drops[i].y += drops[i].vy * dt;
          if (drops[i].y > V.h + 50) drops.splice(i,1);
        }

        if (elapsed < dropletT) waterLevel = 0;
        else {
          const floodDuration = Math.max(1, mode.timeLimit - dropletT);
          const floodElapsed = elapsed - dropletT;
          waterLevel = clamp(floodElapsed / floodDuration, 0, 1);
        }
      }

      // pickup (nota: ahora el juego es grande, así que la zona de pickup es el "boxTop")
      if (input.justDown && current.active && !current.dragging) {
        const boxTop = { x:layout.box.x+40, y:layout.box.y+140, w:layout.box.w-80, h:280 };
        if (rectHit(input.x,input.y,boxTop)) {
          current.dragging = true;
          current.x = input.x;
          current.y = input.y;
        }
      }

      if (current.dragging && input.down) {
        current.x = input.x;
        current.y = input.y;
      }

      if (current.dragging && input.justUp) {
        let dropped = false;

        for (const s of layout.shelves) {
          const pad = 10;
          const r = { x:s.x+pad, y:s.y+120, w:s.w-2*pad, h:s.h-140 };
          if (rectHit(current.x, current.y, r)) {
            dropped = true;

            if (s.key === current.game.consoleKey) {
              // correcto: snap
              const { w:fromW, h:fromH } = getDragGameSize();
              beginSnapToShelf(s.key, { ...current.game }, fromW, fromH);
            } else {
              // incorrecto => vuelve
              current.x = current.homeX;
              current.y = current.homeY;
              current.dragging = false;
            }
            break;
          }
        }

        if (!dropped) {
          current.x = current.homeX;
          current.y = current.homeY;
          current.dragging = false;
        }
      }
    }

    input.justDown = false;
    input.justUp = false;
  }

  function render() {
    ctx.clearRect(0,0,V.w,V.h);
    ctx.globalAlpha=1;

    if (state === "menu") {
      renderMenu();
      return;
    }

    renderRoomBase();
    if (state !== "intro") renderTopBar();

    // SIEMPRE lo último: el cartucho/drag/snap (para que no lo tape el agua)
    renderForegroundGame();

    if (state === "pause") renderPause();
    if (state === "win") renderEnd("win");
    if (state === "lose") renderEnd("lose");
  }

  let last = now();
  function loop() {
    const t = now();
    const dt = Math.min(0.033, (t-last)/1000);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  loadAll().then(async () => {
    await loadOptional("logo.png");
    await loadOptional("pops1.png");
    setMenu();
    loop();
  }).catch((e) => {
    console.error(e);
    ctx.fillStyle = "#fff";
    ctx.font = "24px monospace";
    ctx.fillText("Error cargando assets. Abre la consola.", 20, 40);
  });
})();