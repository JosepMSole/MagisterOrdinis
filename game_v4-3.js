(() => {
  const V = { w: 1080, h: 1920 };

  const MAX_GAMES_PER_CONSOLE = 20;

  const MODES = {
    easy:   { name: "FÀCIL",  pickPerConsole: 5,  hasTimer:false, timeLimit:0,   hasWater:false },
    normal: { name: "NORMAL", pickPerConsole: 10, hasTimer:true,  timeLimit:120, hasWater:false },
    guzman: { name: "GUZMÁN", pickPerConsole: 20, hasTimer:true,  timeLimit:180, hasWater:true, dropletSeconds:10 }
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

  // --- Audio (només música de nivell + SFX) ---
  const AUDIO = {
    unlocked: false,
    bgm: null,
    currentTrack: null,
    activeEndSfx: null,
    completeSong: null,
    failSong: null,
    trackMap: {
      easy: "assets/music1.mp3",
      normal: "assets/music2.mp3",
      guzman: "assets/music3.mp3"
    },
    placeYesSrc: "assets/colocaSI.mp3",
    placeNoSrc: "assets/colocaNO.mp3",
    shelfCompleteSrc: "assets/shelfcomplete.mp3",
    completeSongSrc: "assets/completesong.mp3",
    failSongSrc: "assets/failsong.mp3",
    buildPersistentPlayer(src, volume = 1.0) {
      if (!src) return null;
      try {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.loop = false;
        audio.playsInline = true;
        audio.volume = volume;
        audio.load();
        return audio;
      } catch (e) {
        return null;
      }
    },
    ensureEndSongsReady() {
      if (!this.completeSong) this.completeSong = this.buildPersistentPlayer(this.completeSongSrc, 1.0);
      if (!this.failSong) this.failSong = this.buildPersistentPlayer(this.failSongSrc, 1.0);
    },
    unlock() {
      if (this.unlocked) {
        this.ensureEndSongsReady();
        return;
      }
      this.unlocked = true;
      try {
        const probe = new Audio();
        probe.muted = true;
        probe.playsInline = true;
        const p = probe.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
        probe.pause();
      } catch(e) {}
      this.ensureEndSongsReady();
    },
    stopBgm() {
      if (!this.bgm) {
        this.currentTrack = null;
        return;
      }
      try {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      } catch(e) {}
      this.bgm = null;
      this.currentTrack = null;
    },
    stopEndSongs() {
      [this.completeSong, this.failSong, this.activeEndSfx].forEach((audio) => {
        if (!audio) return;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      });
      this.activeEndSfx = null;
    },
    playPersistentSong(audio, onBlocked) {
      if (!audio) return;
      this.ensureEndSongsReady();
      this.stopBgm();
      this.stopEndSongs();
      this.activeEndSfx = audio;
      try {
        audio.currentTime = 0;
      } catch (e) {}
      const attemptPlay = () => {
        if (!this.activeEndSfx) return;
        try {
          const p = audio.play();
          if (p && typeof p.catch === "function") {
            p.catch(() => {
              const retry = () => {
                window.removeEventListener("pointerdown", retry, true);
                window.removeEventListener("touchstart", retry, true);
                window.removeEventListener("keydown", retry, true);
                try {
                  audio.currentTime = 0;
                  audio.play().catch(() => {});
                } catch (e) {}
              };
              window.addEventListener("pointerdown", retry, true);
              window.addEventListener("touchstart", retry, true);
              window.addEventListener("keydown", retry, true);
              if (typeof onBlocked === "function") onBlocked();
            });
          }
        } catch (e) {
          if (typeof onBlocked === "function") onBlocked();
        }
      };
      if (audio.readyState >= 2) attemptPlay();
      else {
        audio.addEventListener("canplaythrough", attemptPlay, { once:true });
        audio.addEventListener("loadeddata", attemptPlay, { once:true });
        try { audio.load(); } catch (e) {}
        setTimeout(attemptPlay, 120);
      }
    },
    resetCompleteSong() {
      this.completePlayed = false;
      this.failPlayed = false;
    },
    playCompleteSong() {
      if (this.completePlayed) return;
      this.unlock();
      this.completePlayed = true;
      this.failPlayed = false;
      this.playPersistentSong(this.completeSong);
    },
    playFailSong() {
      if (this.failPlayed) return;
      this.unlock();
      this.failPlayed = true;
      this.completePlayed = false;
      this.playPersistentSong(this.failSong);
    },

    playGame(modeKey) {
      this.unlock();
      this.resetCompleteSong();
      this.stopEndSongs();
      const src = this.trackMap[modeKey];
      if (!src) return;
      const ensurePlayOnGesture = () => {
        const retry = () => {
          if (!this.bgm) return;
          try {
            this.bgm.play().catch(() => {});
          } catch(e) {}
          window.removeEventListener("pointerdown", retry, true);
          window.removeEventListener("touchstart", retry, true);
          window.removeEventListener("keydown", retry, true);
        };
        window.addEventListener("pointerdown", retry, true);
        window.addEventListener("touchstart", retry, true);
        window.addEventListener("keydown", retry, true);
      };
      if (this.currentTrack === src && this.bgm) {
        try {
          this.bgm.loop = true;
          this.bgm.volume = (modeKey === "easy") ? 1.0 : 0.75;
          this.bgm.playsInline = true;
          const p = this.bgm.play();
          if (p && typeof p.catch === "function") p.catch(() => ensurePlayOnGesture());
        } catch(e) {
          ensurePlayOnGesture();
        }
        return;
      }
      this.stopBgm();
      try {
        const bgm = new Audio(src);
        bgm.preload = "auto";
        bgm.loop = true;
        bgm.volume = (modeKey === "easy") ? 1.0 : 0.75;
        bgm.playsInline = true;
        this.bgm = bgm;
        this.currentTrack = src;
        const tryPlay = () => {
          try {
            bgm.muted = false;
            const p = bgm.play();
            if (p && typeof p.catch === "function") p.catch(() => ensurePlayOnGesture());
          } catch(e) {
            ensurePlayOnGesture();
          }
        };
        bgm.addEventListener("canplay", tryPlay, { once:true });
        bgm.addEventListener("loadeddata", tryPlay, { once:true });
        bgm.addEventListener("error", () => {
          try { bgm.load(); } catch(e) {}
          setTimeout(tryPlay, 150);
        }, { once:true });
        bgm.load();
        tryPlay();
      } catch(e) {}
    },
    playPlace(isCorrect) {
      const src = isCorrect ? this.placeYesSrc : this.placeNoSrc;
      if (!src) return;
      try {
        const sfx = new Audio(src);
        sfx.preload = "auto";
        sfx.loop = false;
        sfx.playsInline = true;
        sfx.volume = isCorrect ? 0.7 : 0.7;
        const p = sfx.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch(e) {}
    },
    playShelfComplete() {
      const src = this.shelfCompleteSrc;
      if (!src) return;
      try {
        const sfx = new Audio(src);
        sfx.preload = "auto";
        sfx.loop = false;
        sfx.playsInline = true;
        sfx.volume = 0.7;
        const p = sfx.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch(e) {}
    },
    pauseGame() {
      if (!this.bgm) return;
      try {
        this.bgm.pause();
      } catch(e) {}
    },
    resumeGame() {
      if (!this.bgm || !this.currentTrack) return;
      try {
        this.bgm.loop = true;
        this.bgm.volume = (this.currentTrack === this.trackMap.easy) ? 1.0 : 0.75;
        this.bgm.playsInline = true;
        const p = this.bgm.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch(e) {}
    }
  };

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

  const CHARACTER_STORAGE_KEY = "magister-ordinis-selected-character";
  const SELECTED_FRONT = {
    name: null,
    image: null,
  };
  const SELECTED_CHARACTER_ASSETS = {
    name: null,
    front: null,
    backIdle: null,
    backLeft: null,
    backRight: null,
  };

  function getSelectedCharacterName() {
    try {
      const saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
      return saved || "JOU";
    } catch (e) {
      return "JOU";
    }
  }

  function getSelectedFrontFilename() {
    const [first] = getCharacterAssetCandidates(getSelectedCharacterName(), "front");
    return first || `${getSelectedCharacterName()}_front.png`;
  }

  function makeVisibleFallbackLabel(text) {
    const fallback = document.createElement("canvas");
    fallback.width = 360;
    fallback.height = 640;
    const fctx = fallback.getContext("2d");
    fctx.fillStyle = "rgba(40, 24, 64, 0.92)";
    fctx.fillRect(0, 0, fallback.width, fallback.height);
    fctx.strokeStyle = "rgba(255,255,255,0.18)";
    fctx.lineWidth = 8;
    fctx.strokeRect(12, 12, fallback.width - 24, fallback.height - 24);
    fctx.fillStyle = "rgba(255,255,255,0.9)";
    fctx.font = "700 42px system-ui, sans-serif";
    fctx.textAlign = "center";
    fctx.textBaseline = "middle";
    fctx.fillText(String(text || "CHAR"), fallback.width / 2, fallback.height / 2);
    return fallback;
  }

  function buildAssetCandidates(baseName) {
    const set = new Set();
    const variants = [
      baseName,
      baseName.toLowerCase(),
      baseName.toUpperCase(),
      baseName.replace(/_/g, "-"),
      baseName.replace(/_/g, "-").toLowerCase(),
      baseName.replace(/_/g, "-").toUpperCase()
    ];
    variants.forEach((name) => {
      if (!name) return;
      set.add(`${name}.png`);
      set.add(`${name}.webp`);
      set.add(`${name}.jpg`);
      set.add(`${name}.jpeg`);
    });
    return [...set];
  }

  function getCharacterAssetCandidates(characterName, pose) {
    const raw = String(characterName || "JOU").trim();
    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();
    const poseAliases = {
      front: ["front", "front2", "idle_front"],
      backIdle: ["back_idle", "back", "idle_back"],
      backLeft: ["back_left", "left", "walk_left"],
      backRight: ["back_right", "right", "walk_right"]
    };
    const aliases = poseAliases[pose] || [pose];
    const set = new Set();
    aliases.forEach((alias) => {
      [raw, upper, lower].forEach((name) => {
        buildAssetCandidates(`${name}_${alias}`).forEach((file) => set.add(file));
        buildAssetCandidates(`${name}${alias}`).forEach((file) => set.add(file));
      });
    });
    if (pose === "front" && upper === "JOU") {
      [raw, upper, lower].forEach((name) => {
        buildAssetCandidates(`${name}_front2`).forEach((file) => set.add(file));
      });
    }
    return [...set];
  }

  function loadImageCandidates(candidates, fallbackNames = []) {
    const queue = [...new Set([...(candidates || []), ...(fallbackNames || [])].filter(Boolean))];
    return new Promise((resolve) => {
      const tryNext = () => {
        const next = queue.shift();
        if (!next) {
          resolve(null);
          return;
        }
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => tryNext();
        im.src = "assets/img/" + next;
      };
      tryNext();
    });
  }

  function loadImageWithFallback(primaryName, fallbackName) {
    return loadImageCandidates(primaryName ? [primaryName] : [], fallbackName ? [fallbackName] : []);
  }

  async function loadSelectedFront() {
    const name = getSelectedCharacterName();
    if (SELECTED_FRONT.name === name && SELECTED_FRONT.image) return;
    const im = await loadImageCandidates(
      getCharacterAssetCandidates(name, "front"),
      ["character_front.png", "character_front.webp", "character_front.jpg"]
    );
    SELECTED_FRONT.name = name;
    SELECTED_FRONT.image = im || makeVisibleFallbackLabel(name);
  }

  async function loadSelectedCharacterAssets() {
    const name = getSelectedCharacterName();
    if (SELECTED_CHARACTER_ASSETS.name === name && SELECTED_CHARACTER_ASSETS.front && SELECTED_CHARACTER_ASSETS.backIdle) return;

    const [front, backIdle, backLeft, backRight] = await Promise.all([
      loadImageCandidates(getCharacterAssetCandidates(name, "front"), ["character_front.png", "character_front.webp", "character_front.jpg"]),
      loadImageCandidates(getCharacterAssetCandidates(name, "backIdle"), ["character_back_idle.png", "character_back.png", "character_back_idle.webp"]),
      loadImageCandidates(getCharacterAssetCandidates(name, "backLeft"), ["character_back_left.png", "character_left.png", "character_back_left.webp"]),
      loadImageCandidates(getCharacterAssetCandidates(name, "backRight"), ["character_back_right.png", "character_right.png", "character_back_right.webp"])
    ]);

    SELECTED_CHARACTER_ASSETS.name = name;
    SELECTED_CHARACTER_ASSETS.front = front || IMG["character_front.png"] || makeVisibleFallbackLabel(name);
    SELECTED_CHARACTER_ASSETS.backIdle = backIdle || IMG["character_back_idle.png"] || SELECTED_CHARACTER_ASSETS.front || makeVisibleFallbackLabel(name);
    SELECTED_CHARACTER_ASSETS.backLeft = backLeft || SELECTED_CHARACTER_ASSETS.backIdle || IMG["character_back_left.png"] || makeVisibleFallbackLabel(name);
    SELECTED_CHARACTER_ASSETS.backRight = backRight || SELECTED_CHARACTER_ASSETS.backIdle || IMG["character_back_right.png"] || makeVisibleFallbackLabel(name);
  }

  function getSelectedGameplayImages() {
    const selectedName = getSelectedCharacterName();
    if (SELECTED_CHARACTER_ASSETS.name !== selectedName) {
      loadSelectedCharacterAssets().catch(() => {});
    }
    return {
      front: SELECTED_CHARACTER_ASSETS.front || IMG["character_front.png"],
      backIdle: SELECTED_CHARACTER_ASSETS.backIdle || IMG["character_back_idle.png"],
      backLeft: SELECTED_CHARACTER_ASSETS.backLeft || IMG["character_back_left.png"],
      backRight: SELECTED_CHARACTER_ASSETS.backRight || IMG["character_back_right.png"]
    };
  }

  function loadAll() {
    return Promise.all([
      ...toLoad.map(name => new Promise((res) => {
        const im = new Image();
        im.onload = () => { IMG[name] = im; res(); };
        im.onerror = () => {
          console.warn("[magister] asset load failed:", name);
          if (/^character_/.test(name)) {
            IMG[name] = makeVisibleFallbackLabel(name.replace(/^character_/, "").replace(/\.[a-z0-9]+$/i, ""));
          } else {
            const fallback = document.createElement("canvas");
            fallback.width = 2;
            fallback.height = 2;
            IMG[name] = fallback;
          }
          res();
        };
        im.src = "assets/img/" + name;
      })),
      loadSelectedFront(),
      loadSelectedCharacterAssets()
    ]);
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
    rec.img.onload = () => { rec.status = "ok"; markShelfCacheDirty(consoleKey); };
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
    // Desbloqueig d'àudio al primer toc/clic
    if (!AUDIO.unlocked) AUDIO.unlock();
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
    const y0 = 800;
    return [
      { r:{ x, y:y0,       w:btnW, h:btnH }, key:"easy" },
      { r:{ x, y:y0+150,   w:btnW, h:btnH }, key:"normal" },
      { r:{ x, y:y0+300,   w:btnW, h:btnH }, key:"guzman" },
      { r:{ x, y:y0+450,   w:btnW, h:btnH }, key:"characters" },
    ];
  })();

  const pauseMenu = {
    panel: { x:(V.w-720)/2, y: 560, w:720, h:680 },
    btnResume: { x:(V.w-520)/2, y: 760, w:520, h:120 },
    btnExit: { x:(V.w-520)/2, y: 910, w:520, h:120 },
    btnCharacters: { x:(V.w-520)/2, y: 1060, w:520, h:120 }
  };

  let state = "menu"; // menu | intro | play | pause | win | lose
  window.__magisterGameState = state;
  function setGameState(next) {
    state = next;
    window.__magisterGameState = next;
  }
  let menuStart = 0;
  function setMenu(){ setGameState("menu"); menuStart = now(); AUDIO.stopBgm(); AUDIO.resetCompleteSong(); }
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
  let shelfGlow = { SNES:0, GAMECUBE:0, MEGADRIVE:0, FAMICOM:0 };
  let counterGlow = { SNES:0, GAMECUBE:0, MEGADRIVE:0, FAMICOM:0 };
    shelfGlow = { SNES:0, GAMECUBE:0, MEGADRIVE:0, FAMICOM:0 };

  const SHELF_THUMB_CACHE = {};
  const THUMB_SPRITE_CACHE = new Map(); // key => offscreen/img bitmap-sized thumbnail

  function markShelfCacheDirty(consoleKey) {
    if (!consoleKey) return;
    if (!SHELF_THUMB_CACHE[consoleKey]) SHELF_THUMB_CACHE[consoleKey] = { canvas:null, ctx:null, dirty:true };
    SHELF_THUMB_CACHE[consoleKey].dirty = true;
  }

  function markAllShelfCachesDirty() {
    for (const c of CONSOLES) markShelfCacheDirty(c.key);
  }

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
    AUDIO.resetCompleteSong();
    mode = MODES[modeKey];

    pending = {};
    placedByConsole = {};
    for (const c of CONSOLES) {
      pending[c.key] = buildGamePoolForConsole(c.key, mode.pickPerConsole);
      placedByConsole[c.key] = [];
    }

    totalTarget = CONSOLES.length * mode.pickPerConsole;
    placedCount = 0;
    markAllShelfCachesDirty();

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
        AUDIO.playGame(modeKey);
setGameState("intro");
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

    drawTextShadow(`NIVELL · ${mode.name}`, 24, 60, 40, "#fff", "left");
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


  function getOrBuildThumbSprite(consoleKey, idx, shelfRect) {
    const { w:thumbW, h:thumbH } = getThumbSizeForShelf(shelfRect);
    const cacheKey = `${consoleKey}:${idx}:${Math.round(thumbW)}x${Math.round(thumbH)}`;
    if (THUMB_SPRITE_CACHE.has(cacheKey)) return THUMB_SPRITE_CACHE.get(cacheKey);

    const rec = getUniqueGameImage(consoleKey, idx);
    const src = (rec.status === "ok") ? rec.img : getGenericGameImage(consoleKey);

    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(thumbW));
    c.height = Math.max(1, Math.round(thumbH));
    const cctx = c.getContext("2d");
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(src, 0, 0, c.width, c.height);
    THUMB_SPRITE_CACHE.set(cacheKey, c);
    return c;
  }

  function ensureShelfThumbCache(consoleKey, shelfRect) {
    let rec = SHELF_THUMB_CACHE[consoleKey];
    if (!rec || !rec.canvas) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(shelfRect.w));
      c.height = Math.max(1, Math.round(shelfRect.h));
      rec = { canvas:c, ctx:c.getContext("2d"), dirty:true };
      SHELF_THUMB_CACHE[consoleKey] = rec;
    }

    if (!rec.dirty) return rec;

    rec.ctx.clearRect(0, 0, rec.canvas.width, rec.canvas.height);
    const list = placedByConsole[consoleKey] || [];
    if (!list.length) {
      rec.dirty = false;
      return rec;
    }

    const maxSlots = SHELF_GRID.cols * SHELF_GRID.rows;
    const { w:thumbW, h:thumbH } = getThumbSizeForShelf(shelfRect);

    for (let i=0; i<Math.min(list.length, maxSlots); i++) {
      const { cx, cy } = getSlotCenter(shelfRect, i);
      const g = list[i];
      const recImg = getUniqueGameImage(g.consoleKey, g.idx);
      const imgReady = (recImg.status === "ok");
      const img = imgReady ? getOrBuildThumbSprite(g.consoleKey, g.idx, shelfRect) : getGenericGameImage(g.consoleKey);

      rec.ctx.save();
      rec.ctx.globalAlpha = 0.98;
      rec.ctx.drawImage(
        img,
        Math.round(cx - shelfRect.x - thumbW/2),
        Math.round(cy - shelfRect.y - thumbH/2),
        Math.round(thumbW),
        Math.round(thumbH)
      );
      rec.ctx.restore();
    }

    rec.dirty = false;
    return rec;
  }

  function renderShelfThumbnails(shelfRect, consoleKey) {
    const cacheRec = ensureShelfThumbCache(consoleKey, shelfRect);
    if (!cacheRec || !cacheRec.canvas) return;
    ctx.drawImage(cacheRec.canvas, shelfRect.x, shelfRect.y, shelfRect.w, shelfRect.h);
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
      // Brillantor 1s quan completes el moble
      const sgT = shelfGlow[s.key] || 0;
      const sg = (now() - sgT) / 2000;
      if (sgT && sg >= 0 && sg <= 1) {
        const a = (1 - sg);
        ctx.save();
        ctx.globalAlpha = 0.75 * a;
        ctx.filter = "brightness(2.8) blur(14px)";
        ctx.drawImage(IMG[c.shelfImg], s.x, s.y, s.w, s.h);
        ctx.filter = "none";
        ctx.globalAlpha = 0.28 * a;
        ctx.fillStyle = "rgba(255,255,220,1)";
        ctx.fillRect(s.x, s.y, s.w, s.h);
        // contorn pulsant
        ctx.globalAlpha = 0.6 * a;
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(255,255,220,1)";
        ctx.strokeRect(s.x+6, s.y+6, s.w-12, s.h-12);
        ctx.restore();
      }

      renderShelfThumbnails(s, s.key);
      renderShelfCounterTopCenter(s, s.key);
    }

    // character
    if (state === "intro") {
      const t = (now()-introStart)/900;
      if (t < 1) {
        let fx = layout.character.x;
        let fw = layout.character.w;
        const selectedName = getSelectedCharacterName();
        const gameplayImages = getSelectedGameplayImages();
        if (String(selectedName).toUpperCase() === "JOU") {
          fw = Math.round(layout.character.w * 0.8);
          fx = Math.round(layout.character.x + (layout.character.w - fw) / 2);
        }
        const frontImg = gameplayImages.front || IMG["character_front.png"] ;
        if (frontImg) ctx.drawImage(frontImg, fx, layout.character.y, fw, layout.character.h);
        return; // intro no dibuja resto
      } else {
        setGameState("play");
        AUDIO.resumeGame();
      }
    }

    const gameplayImages = getSelectedGameplayImages();
    let charImg = gameplayImages.backIdle || IMG["character_back_idle.png"];
    if (current.dragging) {
      charImg = (current.x < V.w/2)
        ? (gameplayImages.backLeft || IMG["character_back_left.png"])
        : (gameplayImages.backRight || IMG["character_back_right.png"]);
    }
    if (charImg) ctx.drawImage(charImg, layout.character.x, layout.character.y, layout.character.w, layout.character.h);

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

  function renderSelectedCharacterFrontInMenu() {
    const front = SELECTED_FRONT.image;
    if (!(front && front.complete && front.naturalWidth > 0)) return;
    if (!menuButtons[3] || !menuButtons[3].r) return;

    const scale = V.w / front.naturalWidth;
    const w = V.w;
    const h = Math.max(1, Math.round(front.naturalHeight * scale * 1.2));
    const x = -300;
    const y = Math.round(V.h - (h / 2));

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = "drop-shadow(0 12px 24px rgba(0,0,0,0.28))";
    ctx.drawImage(front, x, y, w, h);
    ctx.restore();
  }

  function renderMenu() {
  ctx.drawImage(IMG["background_room.png"], 0,0,V.w,V.h);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,V.w,V.h);

  // Logo amb brillantor (loop) + wiggle suau d'escala
  const logo = OPTIMG["logo.png"];
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const t = now()/1000;
    const baseW = 1020;
    const s = 1 + Math.sin(t*1.7)*0.018;
    const glow = 0.25 + 0.25*(0.5+0.5*Math.sin(t*2.4));
    const w = baseW * s;
    const h = w * (logo.naturalHeight / logo.naturalWidth);
    const x = (V.w - w)/2;
    const y = 90;

    ctx.save();
    ctx.globalAlpha = glow;
    ctx.filter = "brightness(2.0) blur(7px)";
    ctx.drawImage(logo, x, y, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.drawImage(logo, x, y, w, h);
    ctx.restore();
  } else {
    drawTextShadow("MAGISTER ORDINIS", V.w/2, 230, 84);
  }

  // Bloc UI (més amunt)
  drawTextShadow("Selecciona dificultat", V.w/2, 680, 38, "rgba(255,255,255,0.9)");
  drawButton(menuButtons[0].r, "FÀCIL 20");
  drawButton(menuButtons[1].r, "NORMAL 40");
  drawButton(menuButtons[2].r, "GUZMÁN 80");
  drawButton(menuButtons[3].r, "PERSONATGES");
  renderSelectedCharacterFrontInMenu();

  // Capa POPS1: entra des de baix, més petita, wiggle + glitch dinàmic
  const pops = OPTIMG["pops1.png"];
  if (pops && pops.complete && pops.naturalWidth > 0) {
    const t = now()/1000;
    const enter = clamp((now() - menuStart) / 1200, 0, 1);
    const ease = enter*enter*(3-2*enter);

    const scale = 0.78;
    const w = V.w * scale;
    const h = V.h * scale;
    const x = (V.w - w)/2;

    const fromY = V.h + 60;
    const toY = V.h - h;
    const y = lerp(fromY, toY, ease) + Math.sin(t*2.7)*4;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.82;
    ctx.drawImage(pops, 0, 0, w, h);

    for (let i=0;i<12;i++) {
      if (Math.random() < 0.48) {
        const sy = (Math.random()*h) | 0;
        const sh = 10 + ((Math.random()*46)|0);
        const dx = ((Math.random()*40)|0) - 20;
        ctx.globalAlpha = 0.28 + Math.random()*0.28;
        ctx.drawImage(
          pops,
          0,
          sy*(pops.height/h),
          pops.width,
          sh*(pops.height/h),
          dx,
          sy,
          w,
          sh
        );
      }
    }

    if (Math.random() < 0.65) {
      ctx.globalAlpha = 0.12;
      ctx.filter = "hue-rotate(18deg) saturate(170%)";
      ctx.drawImage(pops, 2, 0, w, h);
      ctx.filter = "hue-rotate(-18deg) saturate(170%)";
      ctx.drawImage(pops, -2, 0, w, h);
      ctx.filter = "none";
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.filter = "none";
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
    drawButton(pauseMenu.btnResume, "CONTINUAR");
    drawButton(pauseMenu.btnExit, "SORTIR");
    drawButton(pauseMenu.btnCharacters, "PERSONATGES");
  }

  let endButton = null;
  let endStart = 0;
  // Partícules (pantalla final)
let endParticles = [];
function spawnEndParticles() {
  endParticles = [];
  for (let i=0;i<160;i++){
    endParticles.push({
      x: Math.random()*V.w,
      y: Math.random()*V.h,
      vx: (Math.random()*2-1)*200,
      vy: (Math.random()*2-1)*200,
      a: 0.35 + Math.random()*0.65,
      s: 1 + Math.random()*2
    });
  }
}

function renderEnd(kind) {
  renderRoomBase();
  renderTopBar();

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0,0,V.w,V.h);

  const win = (kind === "win") && (placedCount === totalTarget);
  const endElapsed = endStart ? (now() - endStart) : 0;
  const animT = clamp(endElapsed / 1000, 0, 1);
  const zoomT = win ? easeOutBack(animT) : animT;
  const titleScale = win ? (0.84 + 0.16 * zoomT) : 1;
  const titleSize = Math.round(84 * titleScale);
  const glowAlpha = win ? (0.15 + 0.7 * animT) : 0.18;
  const glowBlur = win ? (18 + 42 * animT) : 18;
  const glowPulse = win ? (1 + Math.sin(animT * Math.PI) * 0.08) : 1;
  const titleY = win ? (720 - (1 - animT) * 18) : 720;

  if (win) {
    ctx.save();
    ctx.globalAlpha = glowAlpha;
    ctx.shadowColor = "rgba(255, 245, 170, 0.98)";
    ctx.shadowBlur = glowBlur;
    ctx.fillStyle = "rgba(255, 245, 170, 0.96)";
    ctx.font = `900 ${Math.round(titleSize * glowPulse)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("COMPLETAT!", V.w/2, titleY);
    ctx.restore();
  }

  drawTextShadow(win ? "COMPLETAT!" : "HAS FALLAT!", V.w/2, titleY, titleSize);
  drawTextShadow(`Resultat: ${placedCount}/${totalTarget}`, V.w/2, 830, 46, "rgba(255,255,255,0.9)");

  // Partícules frenètiques
  const t = now()/1000;
  ctx.save();
  for (const p of endParticles) {
    const dt = 1/60;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -30) p.x = V.w+30;
    if (p.x > V.w+30) p.x = -30;
    if (p.y < -30) p.y = V.h+30;
    if (p.y > V.h+30) p.y = -30;

    const flick = 0.35 + 0.65*(0.5+0.5*Math.sin(t*10 + p.x*0.03));
    ctx.globalAlpha = p.a * flick;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // POPS1 (més petita) amb wiggle
  const pops = OPTIMG["pops1.png"];
  if (pops && pops.complete && pops.naturalWidth > 0) {
    const scale = 0.78;
    const w = V.w * scale;
    const h = V.h * scale;
    const x = (V.w - w)/2;
    const y = V.h - h + Math.sin(t*2.2)*3;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(x, y);
    ctx.drawImage(pops, 0, 0, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const btn = { x:(V.w-560)/2, y: 1180, w:560, h:130 };
  drawButton(btn, "TORNAR AL MENU");
  endButton = btn;
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
          if (b.key === "characters") {
            window.location.reload();
          } else {
            modeKey = b.key;
            resetLevel();
          }
          break;
        }
      }
    }

    if ((state==="win" || state==="lose") && input.justDown) {
      if (endButton && rectHit(input.x, input.y, endButton)) setMenu();
    }

    if (state === "pause" && input.justDown) {
      if (rectHit(input.x, input.y, pauseMenu.btnResume)) {
        const delta = now() - pausedAt;
        startTime += delta;
        pausedAt = 0;
        setGameState("play");
        AUDIO.resumeGame();
      } else if (rectHit(input.x, input.y, pauseMenu.btnExit)) {
        setMenu();
      } else if (rectHit(input.x, input.y, pauseMenu.btnCharacters)) {
        window.location.reload();
      }
    }

    if (state === "play") {
      if (input.justDown && rectHit(input.x, input.y, layout.btnPause)) {
        setGameState("pause");
        AUDIO.pauseGame();
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
          markShelfCacheDirty(snap.game.consoleKey);
          if ((placedByConsole[snap.game.consoleKey] || []).length >= mode.pickPerConsole) { shelfGlow[snap.game.consoleKey] = now(); AUDIO.playShelfComplete(); }
          counterGlow[snap.game.consoleKey] = now();

          if (mode.hasTimer) startTime -= 800;

          snap.active = false;
          snap.game = null;

          const nxt = pickRandomPendingGame();
          if (!nxt) { setGameState("win");
              endStart = now();
              AUDIO.playCompleteSong(); spawnEndParticles(); }
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
        if (timeLeft <= 0) { setGameState("lose");
        endStart = now();
        AUDIO.stopBgm(); AUDIO.resetCompleteSong(); AUDIO.playFailSong(); spawnEndParticles(); }
      }

      // Guzmán: gotas + agua
      if (mode.hasWater) {
        const elapsed = (now() - startTime) / 2000;
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
              AUDIO.playPlace(true);
              const { w:fromW, h:fromH } = getDragGameSize();
              beginSnapToShelf(s.key, { ...current.game }, fromW, fromH);
            } else {
              // incorrecto => vuelve
              AUDIO.playPlace(false);
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
    ctx.globalAlpha = 1;
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