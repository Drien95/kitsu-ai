// ==UserScript==
// @name         KitsuAI - conseiller de combat, d'equipe et de tirage
// @namespace    kitsu-ai
// @version      5.39.0
// @description  Conseiller en direct pour kitsu.games (lecture seule, ne clique rien, desactive en arene)
// @match        https://kitsu.games/*
// @match        https://*.kitsu.games/*
// @run-at       document-idle
// @updateURL    https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js
// @downloadURL  https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js
// @homepageURL  https://github.com/Drien95/kitsu-ai/wiki
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  function kitsuMain() {
    console.log('KitsuAI : script charge, attente du jeu...');
    const ready = () => window.BattleCore && window.CHAR_BY_ID
      && performance.getEntriesByType('resource').some(r => /\/assets\/dom-[^/]+\.js$/.test(r.name))
      && performance.getEntriesByType('resource').some(r => /\/assets\/app-[^/]+\.js$/.test(r.name));
    const boot = () => {
      // KitsuAI v5.17.0 : conseiller de combat, d'equipe et de tirage pour kitsu.games
      // Lecture seule : ne clique rien, n'envoie rien au serveur. Tout est simule localement
      // avec le moteur du jeu (BattleCore) et ses donnees (setupBattle, mondes, bannieres).
      // Desactive en arene (PvP).
      //
      // Console (F12) :
      //   await KitsuAI.start()      conseillers en direct (lance automatiquement par Tampermonkey)
      //   KitsuAI.stop()
      //   KitsuAI.status()           version du jeu, poids utilises, entrainement, calibration
      //   await KitsuAI.retrain()    reentraine (combats normaux + boss) jusqu'au plateau, en tache de fond
      //   await KitsuAI.pulls()      valeur de chaque banniere active pour TON equipe
      //   await KitsuAI.xpPlan()     quelle carte monter en niveau
      //   KitsuAI.report()           predictions contre resultats reels
      //   KitsuAI.signal()           instantane de l'ecran (bouton Signaler de l'onglet Sante)
      //   await KitsuAI.roadmap()    priorites du moment (quetes, energie, recharge, combats, invocation, guilde, murs)
      //   KitsuAI.showRoad()         reaffiche la roadmap
      //   await KitsuAI.training()   quelles cartes entrainer, jusqu'a quel niveau, avec qui
      //   await KitsuAI.shops()      boutique du jour et de guilde : acheter ou passer
      //   await KitsuAI.events()     evenement en cours : premieres victoires gagnables, essais, parchemins
      //   KitsuAI.guide(false)       desactive le guide pas a pas (true pour le reactiver)
      //   KitsuAI.energyAlert(true)  notification quand l'energie est pleine (ou bouton dans l'onglet Sante)
      //   Alt+K                      replie / deplie le dock (deplacable a la souris par sa barre)

      (() => {
        if (window.KitsuAI && window.KitsuAI.__v === '5.39.0') return;
        try { window.KitsuAI?.stop?.(); } catch {}
        const B = window.BattleCore;
        const COST = { basic: 10, skill: 25, ult: 20, rest: -45 };
        // Poids appris au plateau : combats normaux et boss (~540 000 simulations, reentraines avec Orochimaru).
        const W_NORM = [0.1933,-0.5256,0.4111,1.7846,-0.1384,0.0592,0.4946,1.1049,0.6246,0.094,1.1405,0.437,2.0554,0.077,0.3738,-0.6323,0.0012,-0.0684,-0.6149];
        const W_BOSS = [0.0647,-0.4792,0.9519,2.1617,-0.3986,0.6054,0.7547,1.2413,0.7783,0.0479,1.2698,0.4325,2.1071,-0.1634,0.4417,-0.879,-0.0136,1.0088,-0.8569];
        // Cauchemar (~160 000 simulations) et Tour de l'infini (score = etage atteint).
        const W_NM = [-0.3042,-0.8322,0.7914,1.6557,-0.2005,1.2199,0.9199,0.3791,0.5382,0.0507,1.0024,0.5477,1.5751,-0.6616,0.5372,-0.6145,-0.0156,0.7633,-0.8152];
        const W_TOWER = [-0.2911,-0.7984,0.8698,2.0784,-0.1861,0.9833,1.0596,1.5232,0.2841,0.6186,1.5002,0.9077,1.6502,-0.4352,0.1318,-0.6398,0.4653,0.7975,0.1358];
        const NF = W_NORM.length;
        const LS = { w: 'kitsu_ai_w3', log: 'kitsu_ai_log', ver: 'kitsu_ai_ver', pulls: 'kitsu_ai_pulls' };
        const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
        const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        // Les calculs de fond cedent la main au jeu, et se mettent en pause tant qu'un combat est en cours.
        // 5.34 : temps passe sur le fil du jeu entre deux pauses, par fonction appelante (window.__kitsuPerf, lu par la mesure
        // du lag du script prive). Lecture seule, quelques microsecondes par pause.
        const PERF = window.__kitsuPerf = window.__kitsuPerf || {};
        const perfAdd = (qui, d) => { const b = PERF[qui] ??= { ms: 0, n: 0, max: 0 }; b.ms = Math.round(b.ms + d); b.n++; if (d > b.max) b.max = Math.round(d); };
        let idleT = 0, idleQui = '', idleSeq = 0;
        // Fin du bloc : a la prochaine pause, ou des que la tache en cours rend la main (message envoye a soi-meme).
        const idleFin = new MessageChannel(); idleFin.port1.onmessage = e => { if (idleT && e.data === idleSeq) { perfAdd(idleQui, performance.now() - idleT); idleT = 0; } };
        const idleGo = (qui, r) => { idleT = performance.now(); idleQui = qui; idleFin.port2.postMessage(++idleSeq); r(); };
        const idle = async () => {
          if (idleT) { perfAdd(idleQui, performance.now() - idleT); idleT = 0; }
          const qui = 'idle:' + ((new Error().stack || '').split('\n')[2] || '').trim().replace(/^at (async )?/, '').split(' ')[0];
          for (let i = 0; i < 600; i++) { let busy = false; try { const T = APP && liveBattle(); busy = !!(T && !T.over); } catch {} if (!busy) break; await new Promise(r => setTimeout(r, 1000)); }
          return new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => idleGo(qui, r), { timeout: 500 }) : setTimeout(() => idleGo(qui, r), 30)));
        };

        let G = null, APP = null, DOMM = null;
        // Pity : 1 point tous les 10 tirages (50 points = LR garantie), donc 50 gemmes par point.
        const GEMS_PER_PITY = 50;
        // Sauvegarde du jeu : lue plusieurs fois par seconde par les conseils. On ne la reparse que si son texte a change
        // (avant : JSON.parse complet a chaque appel, donc beaucoup de travail et de memoire a ramasser pendant que tu joues).
        let svRaw = null, svObj = {};
        const save = () => { try { const r = localStorage.getItem('shokan_save_v1'); if (r !== svRaw) { svObj = (r && JSON.parse(r)) || {}; svRaw = r; } return svObj; } catch { return {}; } };
        const assetUrl = re => performance.getEntriesByType('resource').map(r => r.name).find(n => re.test(n));
        const loadModules = async () => {
          if (!G) { const u = assetUrl(/\/assets\/dom-[^/]+\.js$/); DOMM = u ? await import(u) : null; G = DOMM ? DOMM.g : null; }
          if (!APP) { const u = assetUrl(/\/assets\/app-[^/]+\.js$/); APP = u ? await import(u) : null; }
          if (!G || !APP) throw new Error('modules du jeu introuvables : recharge la page');
        };
        // cle : on retient sous quel nom l'objet a ete trouve et on regarde la d'abord (5.18) : evite de parcourir tous les exports du jeu
        // plusieurs fois par seconde. Si l'objet n'y est plus (ou plus du bon type), on refait le parcours complet comme avant.
        const exCle = {};
        const findExport = (test, cle) => {
          if (cle && exCle[cle] !== undefined) { let v; try { v = APP[exCle[cle]]; } catch {} if (v && typeof v === 'object' && test(v)) return v; }
          for (const k of Object.keys(APP)) { let v; try { v = APP[k]; } catch { continue; } if (v && typeof v === 'object' && test(v)) { if (cle) exCle[cle] = k; return v; } }
          return null;
        };
        const isPvp = v => !!(v.pvp || v.foe || /arena|arene|pvp/i.test(location.hash));
        const estCombat = v => 'st' in v && 'actions' in v && 'active' in v && 'over' in v && !isPvp(v), estPrep = v => 'f' in v && 'team' in v && 'filter' in v && v.f;
        const liveBattle = () => findExport(estCombat, 'combat');
        const prepScreen = () => findExport(estPrep, 'prep');

        // ---------- Version du jeu ----------
        const versionSig = () => {
          const file = re => (assetUrl(re) || '').split('/').pop();
          let fights = 0; try { for (const w of G.ALL_WORLDS) fights += w.fights.length; } catch {}
          return { dom: file(/\/assets\/dom-[^/]+\.js$/), app: file(/\/assets\/app-[^/]+\.js$/), fights, chars: Object.keys(window.CHAR_BY_ID || {}).length, banners: (G.ACTIVE_BANNERS || []).join(',') };
        };
        const sameVer = (a, b) => a && b && a.dom === b.dom && a.app === b.app && a.fights === b.fights && a.chars === b.chars;

        // ---------- Simulation ----------
        const teamOf = (ids, S = save(), opt = {}) => ids.map(id => ({ id: +id, lv: (S.owned?.[id] ? (S.lv?.[id]?.l || 1) : (opt.newLv || 1)) + (opt.bump === +id ? 5 : 0), stars: S.stars?.[id] || 0 }));
        const mk = (fightId, ids, seed, S, opt) => G.setupBattle(G.findFight(fightId), teamOf(ids, S, opt), seed).st;
        const step = st => {
          for (let i = 0; i < 300; i++) {
            if (B.outcome(st)) return null;
            const u = B.nextActor(st);
            const { skip } = B.startTurn(st, u);
            if (!u.alive || skip || B.outcome(st)) { u.av = 1e4 / u.spd; continue; }
            if (u.side === 'ally') return u;
            B.enemyAct(st, u);
          }
          return null;
        };
        const doAct = (st, u, c) => {
          if (!B.legal(st, u, c.kind, c.target || null)) B.act(st, u, 'rest');
          else B.act(st, u, c.kind, c.target && B.needsTarget(u, c.kind) ? c.target : undefined);
        };
        const cands = (st, u) => {
          const out = [{ kind: 'rest' }], foes = B.foes(st, u);
          for (const k of ['basic', 'skill', 'ult']) {
            if (B.needsTarget(u, k)) { for (const t of foes) if (B.legal(st, u, k, t)) out.push({ kind: k, target: t }); }
            else if (B.legal(st, u, k, null)) out.push({ kind: k });
          }
          return out;
        };
        const score = st => {
          const o = B.outcome(st), al = B.allies(st), en = B.enemies(st);
          const ah = al.reduce((a, u) => a + (u.alive ? u.hp / u.maxHp : 0), 0) / al.length;
          const eh = en.reduce((a, u) => a + (u.alive ? u.hp / u.maxHp : 0), 0) / en.length;
          if (o === 'win') return 2 + ah - st.cycle * 0.01;
          if (o === 'lose') return -eh;
          return ah - eh;
        };
        const feat = (st, u, c) => {
          const t = c.target, pv = t ? B.preview(st, u, t, c.kind) : null, dmg = pv ? pv.dmg : 0;
          const al = B.allies(st).filter(x => x.alive), low = Math.min(...al.map(x => x.hp / x.maxHp));
          const role = c.kind !== 'rest' && c.kind !== 'basic' ? B.kitRole(u, c.kind) : {};
          const foes = B.foes(st, u), charging = foes.some(e => e.charging) ? 1 : 0;
          const big = c.kind === 'skill' || c.kind === 'ult' ? 1 : 0;
          return [
            c.kind === 'rest' ? 1 : 0, c.kind === 'basic' ? 1 : 0, c.kind === 'skill' ? 1 : 0, c.kind === 'ult' ? 1 : 0,
            t ? Math.min(1, dmg / Math.max(1, t.hp)) : 0, t && dmg >= t.hp ? 1 : 0, t && t.charging ? 1 : 0,
            t && t.toughMax ? Math.min(1, (pv?.tough || 0) / Math.max(1, t.tough)) : 0,
            pv ? (pv.adv > 0 ? 1 : pv.adv < 0 ? -1 : 0) : 0,
            (st.end - (COST[c.kind] || 0)) / 100,
            (role.heal || role.shield || role.taunt || role.protect) ? (1 - low) : 0,
            role.aoe ? Math.min(3, role.aoe) * foes.length / 3 : 0,
            charging * big, (u.energy || 0) / 100 * (c.kind === 'skill' ? 1 : 0),
            role.control ? 1 : 0, role.buff ? 1 : 0,
            (t && t.status && (t.status.defDown || t.status.def_moins) ? 1 : 0) * big,
            st.end < 25 && c.kind === 'rest' ? 1 : 0, (u.energy || 0) >= 80 && c.kind === 'basic' ? 1 : 0,
          ];
        };
        const policy = w => (st, u) => {
          let best = null, bv = -1e9;
          for (const c of cands(st, u)) { const f = feat(st, u, c); let v = 0; for (let i = 0; i < f.length; i++) v += (w[i] || 0) * f[i]; if (v > bv) { bv = v; best = c; } }
          return best;
        };
        const hasBoss = st => B.enemies(st).some(e => e.boss);
        // Strategie specialisee : poids "boss" s'il y a un boss, sinon poids "normal".
        // Reglages Cauchemar propres a une equipe (entraines sur le PC) : utilises quand c'est exactement cette equipe.
        const smartPol = W => { const pn = policy(W.norm), pb = policy(W.boss), pm = policy(W.nm || W.boss), pt = policy(W.tower || W.norm), pe = {}; const nmOf = st => { if (!W.equipes) return pm; const k = st.__tk ??= B.allies(st).map(x => x.id).sort((a, b) => a - b).join('-'); const e = W.equipes[k]; return e?.nm?.length === W.boss.length ? (pe[k] ??= policy(e.nm)) : pm; }; return (st, u) => (st.__tower ? pt : st.ai === 'nm' ? nmOf(st) : hasBoss(st) ? pb : pn)(st, u); };
        const modeName = st => st.__tower ? 'tour' : st.ai === 'nm' ? 'cauchemar' : hasBoss(st) ? 'boss' : 'normale';
        const playOut = (st, pol) => { for (let i = 0; i < 200; i++) { const u = step(st); if (!u) break; doAct(st, u, pol(st, u)); } return st; };
        const runScore = (f, ids, pol, seed, S, opt) => score(playOut(mk(f, ids, seed, S, opt), pol));
        const runWin = (f, ids, pol, seed, S, opt) => B.outcome(playOut(mk(f, ids, seed, S, opt), pol)) === 'win';
        // ---------- Calcul en fil separe (Web Worker) ----------
        // Les simulations lourdes (classement des equipes, plan d'entrainement, boutique) tournent hors du jeu.
        // Le worker charge le meme module du jeu et les memes fonctions de simulation. Repli sur le fil principal si besoin.
        let worker = null, wSeq = 0; const wWait = {};
        const workerSrc = () => {
          const B0 = `const NS = Object.values(m).find(v => v && typeof v === 'object' && 'act' in v && 'enemyAct' in v);`;
          return `let B, G; const COST = ${JSON.stringify(COST)};
      const step = ${step.toString()};
      const doAct = ${doAct.toString()};
      const cands = ${cands.toString()};
      const score = ${score.toString()};
      const feat = ${feat.toString()};
      const policy = ${policy.toString()};
      const hasBoss = ${hasBoss.toString()};
      const smartPol = ${smartPol.toString()};
      const playOut = ${playOut.toString()};
      const clone = ${clone.toString()};
      const evalLive = ${evalLive.toString()};
      // 5.35 : le lot cede la main toutes les ~15 ms pour qu'un conseil en combat (live) passe devant au lieu d'attendre la fin du lot.
      const pause = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
      self.onmessage = async e => {
        const d = e.data;
        try {
          if (d.init) { const m = await import(d.init); G = m.g; ${B0} B = NS; postMessage({ id: d.id, ok: true }); return; }
          if (d.live) { const res = evalLive(d.live.st, d.live.key, smartPol(d.W)); postMessage({ id: d.id, ok: true, out: res.map(r => ({ kind: r.c.kind, tgt: r.c.target?.key ?? null, n: r.n, v: r.v, w: r.w, s3n: r.s3n, mean: r.mean, win: r.win })) }); return; }
          const pol = smartPol(d.W), out = []; let tP = performance.now();
          for (const j of d.jobs) {
            if (performance.now() - tP > 15) { await pause(); tP = performance.now(); }
            let w = 0, s3 = 0, sc = 0;
            for (const sd of j.seeds) {
              const f = G.findFight(j.fid); const st = playOut(G.setupBattle(f, j.team, sd).st, pol);
              sc += score(st); if (B.outcome(st) === 'win') { w++; if (B.allies(st).every(u => u.alive) && st.cycle <= 8) s3++; }
            }
            out.push({ w, s3, s: sc, n: j.seeds.length });
          }
          postMessage({ id: d.id, ok: true, out });
        } catch (err) { postMessage({ id: d.id, ok: false, err: String(err) }); }
      };`;
        };
        const getWorker = async () => {
          if (worker === false) return null;
          if (worker) return worker;
          try {
            const url = assetUrl(/\/assets\/dom-[^/]+\.js$/);
            const w = new Worker(URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' })), { type: 'module' });
            w.onmessage = e => { const r = wWait[e.data.id]; if (r) { delete wWait[e.data.id]; r(e.data); } };
            const id = ++wSeq; const ok = await new Promise(r => { wWait[id] = r; w.postMessage({ id, init: url }); setTimeout(() => r({ ok: false }), 10000); });
            if (!ok.ok) throw new Error('worker init');
            worker = w; return w;
          } catch { worker = false; health.err('worker indisponible, calculs sur le fil principal'); return null; }
        };
        // Worker ferme apres 3 min sans calcul (5.18) : il garde une copie complete du moteur du jeu (~100 Mo) dans l'onglet.
        // Il est recree au calcul suivant (1 a 2 s, moteur deja en cache). Memes calculs, memes resultats.
        let wUse = 0, wBusy = 0;
        clearInterval(window.__kitsuWkT); window.__kitsuWkT = setInterval(() => { if (worker && !wBusy && Date.now() - wUse > 180000) { try { worker.terminate(); } catch {} worker = null; } }, 30000);
        // jobs : [{ fid, team: [{id, lv, stars}], seeds: [...] }] -> [{ w, s3, s, n }]
        const simBatch = async (jobs, W) => {
          const w = await getWorker();
          if (w) { const id = ++wSeq; wBusy++; wUse = Date.now(); let r; try { r = await new Promise(res => { wWait[id] = res; w.postMessage({ id, W, jobs }); }); } finally { wBusy--; wUse = Date.now(); } if (r.ok) return r.out; health.err('worker : ' + r.err); }
          const pol = smartPol(W), out = [];
          for (const j of jobs) { let w2 = 0, s3 = 0, sc = 0; for (const sd of j.seeds) { const st = playOut(G.setupBattle(G.findFight(j.fid), j.team, sd).st, pol); sc += score(st); if (B.outcome(st) === 'win') { w2++; if (B.allies(st).every(u => u.alive) && st.cycle <= 8) s3++; } } out.push({ w: w2, s3, s: sc, n: j.seeds.length }); await idle(); }
          return out;
        };
        // 5.35 : victoires et score totaux de chaque trio sur une liste de combats, dans le worker. Memes equipes (teamOf),
        // memes graines et meme ordre de somme que runWin / runScore sur le fil du jeu : memes resultats.
        const simTrios = async (list, fights, seeds, S, opt, W) => {
          const jobs = []; for (const ids of list) { const team = teamOf(ids, S, opt); for (const f of fights) jobs.push({ fid: f, team, seeds }); }
          const out = await simBatch(jobs, W), n = fights.length;
          return list.map((_, i) => { let w = 0, sc = 0; for (let k = 0; k < n; k++) { const o = out[i * n + k]; w += o.w; sc += o.s; } return { w, s: sc }; });
        };
        // Journal d'etat pour l'onglet Sante
        const health = { errors: [], err(m) { this.errors.unshift({ t: Date.now(), m: String(m).slice(0, 160) }); this.errors.length = Math.min(this.errors.length, 10); } };


        // ---------- Conseiller de combat ----------
        const clone = st => { const { rng, ...rest } = st; return structuredClone(rest); };
        // ---------- Serveur local (moteur/serveur.bat sur le PC) ----------
        // Le pont Tampermonkey (en tete du userscript) relaie les demandes vers http://127.0.0.1:47123.
        // Rien d'autre ne sort : uniquement l'etat du combat en cours, vers ta propre machine.
        const localPC = { ok: false, fils: 0, msg: '', t: 0 };
        let localSeq = 0; const localWait = {};
        window.addEventListener('message', e => { const d = e.data; if (!d || !d.kitsuLocalRes) return; const w = localWait[d.kitsuLocalRes]; if (w) { delete localWait[d.kitsuLocalRes]; w(d.ok ? d.data : null); } });
        const localAsk = (path, body, timeout = 3000) => new Promise(res => { const id = ++localSeq; localWait[id] = res; window.postMessage({ kitsuLocalReq: { id, path, body, timeout } }, '*'); setTimeout(() => { if (localWait[id]) { delete localWait[id]; res(null); } }, timeout + 500); });
        const domFile = () => (assetUrl(/\/assets\/dom-[^/]+\.js$/) || '').split('/').pop();
        const localPing = async () => {
          const r = await localAsk('/ping?v=' + encodeURIComponent(window.KitsuAI?.__v || ''), null, 1500); localPC.t = Date.now(); localPC.ok = !!r?.ok && (!r.dom || r.dom === domFile()); localPC.fils = r?.fils || 0;
          localPC.msg = r?.ok && r.dom && r.dom !== domFile() ? 'moteur du PC pas a jour : panneau KitsuAI, « Mettre a jour » puis « Recharger le moteur »' : r?.ok ? '' : 'non lance';
          // Reglages de l'IA entraines sur le PC (panneau local) : adoptes s'ils sont plus recents.
          if (localPC.ok && r.poidsT && r.poidsT > (lsGet('kitsu_ai_wLocalT', 0) || 0)) {
            const p = await localAsk('/poids', null, 2000), K = window.KitsuAI;
            if (p?.W && K && ['norm', 'boss', 'nm'].every(k => Array.isArray(p.W[k]) && p.W[k].length === NF)) {
              K.W = { ...K.W, ...Object.fromEntries(Object.entries(p.W).filter(([, v]) => Array.isArray(v) && v.length === NF)), ...(p.equipes ? { equipes: Object.fromEntries(Object.entries(p.equipes).filter(([, e]) => e?.nm?.length === NF).map(([k, e]) => [k, { nom: e.nom, nm: e.nm }])) } : {}) }; if (!p.equipes) delete K.W.equipes; lsSet(LS.w, K.W); lsSet('kitsu_ai_wLocalT', r.poidsT);
              for (const k of ['kitsu_ai_plan', 'kitsu_ai_teams', 'kitsu_ai_training', 'kitsu_ai_events', 'kitsu_ai_road']) localStorage.removeItem(k);
              if (p.restaure) toast('<b style="color:#2fd27a">Reglages de l\'IA restaures</b><br>Copie remise en service depuis le panneau du PC. Plan et equipes recalcules.', 9000); else toast('<b style="color:#2fd27a">Nouveaux reglages de l\'IA</b><br>Entraines sur ton PC (' + Object.entries(p.gains || {}).map(([k, g]) => k + ' ' + g.depart + ' -> ' + g.fin).join(', ') + (p.equipes ? ', ' + Object.keys(p.equipes).length + ' equipe(s) avec reglages propres' : '') + '). Plan et equipes recalcules.', 9000);
            }
          }
          return localPC.ok;
        };
        // Sauvegarde automatique (a chaque changement de collection, sinon toutes les 30 min) et etat du jeu pour les alertes.
        let lastSaveSig = '', lastSaveT = 0;
        const localSync = async () => {
          if (!localPC.ok || !window.KitsuAI || !G) return;
          try {
            const S = save(), sig = JSON.stringify([Object.keys(S.owned || {}).length, Object.values(S.lv || {}).reduce((a, x) => a + (x?.l || 0), 0), Object.values(S.stars || {}).reduce((a, x) => a + x, 0), (S.pve?.team || []).join()]);
            if (sig !== lastSaveSig || Date.now() - lastSaveT > 30 * 60000) { const d = await window.KitsuAI.exportData(); const r = await localAsk('/sauvegarde', d, 4000); if (r?.ok) { lastSaveSig = sig; lastSaveT = Date.now(); } }
            const now = Date.now(); let en = null; try { en = { v: G.energy(S, now).v, max: G.enMax(S, now) }; } catch {}
            const gd = lsGet('kitsu_ai_guild', null), evr = lsGet('kitsu_ai_events', null)?.combats || [];
            const evs = openEvents(now).map(e => ({ titre: e.banner?.series || e.title, fin: e.banner?.until || null, reste: evr.filter(r => r.evId === e.id && !r.fait && !S.ev?.clear?.[r.id] && r.kind !== 'farm').length }));
            const bans = (G.BANNERS || []).filter(b => b.until && b.until > now && (b.opens || b.from || 0) <= now).map(b => ({ serie: b.series, fin: b.until, pity: `${S.pity?.[b.series] || 0}/${(() => { try { return G.pityMax ? G.pityMax(b) : 50; } catch { return 50; } })()}` }));
            await localAsk('/jeu', { energie: en, guilde: gd ? { boss: gd.boss?.left || 0, raid: gd.pain?.left || 0 } : null, evenements: evs, bannieres: bans }, 3000);
            // Plan d'XP du PC (5.21) : tous les modes (Campagne, Tour, Raid, Arene en prive). Relu toutes les 10 min.
            if (Date.now() - (lsGet('kitsu_ai_planxp', null)?.t || 0) > 10 * 60000) { const p = await localAsk('/plan', null, 4000); if (p && !p.err) lsSet('kitsu_ai_planxp', { t: Date.now(), cible: p.cible || null, suite: Array.isArray(p.suite) ? p.suite : [] }); }
          } catch (e) { health.err('synchro PC : ' + e.message); }
        };
        setTimeout(() => { localPing().then(localSync); setInterval(() => localPing().then(localSync), 60000); }, 5000);
        const TAG = { basic: 'Attaque', skill: 'Technique', ult: 'Ultime', rest: 'Repos' };
        const COSTS = { basic: 10, skill: 25, ult: 20, rest: 0 }, IDX = { basic: 0, skill: 1, ult: 2 };
        const mv = (u, k) => {
          if (k === 'rest') return { name: 'Repos', desc: '+45 endurance, +10 energie, -30 % de degats subis' };
          let m = null; try { m = B.moveInfo(u, k); } catch {}
          const name = m && m.name && m.name !== 'basic' ? m.name : (window.MOVES?.[u.id]?.[IDX[k]] || TAG[k]);
          return { name, desc: m?.desc || '' };
        };
        const evalLive = (st, key, pol) => {
          const u0 = st.units.find(x => x.key === key);
          const res = cands(st, u0).map(c => ({ c, n: 0, v: 0, w: 0 }));
          let seed = Math.floor(Math.random() * 1e9);
          const sim = r => {
            const s2 = clone(st); s2.rng = B.seeded(seed++); r.s3n ??= 0;
            const u = s2.units.find(x => x.key === key);
            doAct(s2, u, { kind: r.c.kind, target: r.c.target ? s2.units.find(x => x.key === r.c.target.key) : undefined });
            playOut(s2, pol); r.n++; r.v += score(s2); if (B.outcome(s2) === 'win') { r.w++; if (B.allies(s2).every(u => u.alive) && s2.cycle <= 8) r.s3n++; }
          };
          for (const r of res) for (let k = 0; k < 8; k++) sim(r);
          const t0 = performance.now();
          for (let round = 0; round < 8 && performance.now() - t0 < 60; round++) {
            res.sort((a, b) => b.v / b.n - a.v / a.n);
            const top = res[0].v / res[0].n, close = res.filter(r => top - r.v / r.n < 0.25 && r.n < 40);
            if (close.length < 2) break;
            for (const r of close) for (let k = 0; k < 4; k++) sim(r);
          }
          res.forEach(r => { r.mean = r.v / r.n; r.win = r.w / r.n; });
          return res.sort((a, b) => b.mean - a.mean);
        };

        // 5.35 : le conseil en combat tourne dans le worker (meme fonction evalLive, meme budget de 60 ms, memes politiques).
        // La page ne fait plus que copier l'etat du combat et relire le classement. Repli sur le fil du jeu si le worker
        // n'est pas pret (il est lance en fond pour le tour suivant) ou ne repond pas en 3 s.
        const evalLiveA = async (st, key, W) => {
          const t0 = performance.now(), u0 = st.units.find(x => x.key === key);
          const sync = () => { const t = performance.now(), r = evalLive(st, key, smartPol(W)); perfAdd('evalLive', performance.now() - t); return r; };
          if (!worker) { if (worker === null) getWorker().catch(() => {}); return sync(); }
          const w = worker, id = ++wSeq; wBusy++; wUse = Date.now();
          let msg; try { msg = { id, W, live: { st: clone(st), key } }; } catch { wBusy--; return sync(); }
          const p = new Promise(res => { wWait[id] = res; setTimeout(() => { if (wWait[id]) { delete wWait[id]; res({ ok: false, err: 'delai' }); } }, 3000); });
          w.postMessage(msg); perfAdd('evalLive', performance.now() - t0);
          let r; try { r = await p; } finally { wBusy--; wUse = Date.now(); }
          perfAdd('evalLive:aller-retour', performance.now() - t0);
          if (!r.ok) { health.err('conseil worker : ' + r.err); return sync(); }
          const t1 = performance.now(), cl = cands(st, u0);
          const res = r.out.map(o => ({ ...o, c: cl.find(c => c.kind === o.kind && (c.target?.key ?? null) === o.tgt) })).filter(o => o.c);
          perfAdd('evalLive', performance.now() - t1);
          return res.length ? res : sync();
        };

        // Pourquoi ce coup : traduit en clair les criteres qui ont le plus pese.
        const why = (st, u, c, res) => {
          const out = [], t = c.target, foes = B.foes(st, u), al = B.allies(st).filter(x => x.alive);
          const pv = t ? B.preview(st, u, t, c.kind) : null;
          const charging = foes.filter(e => e.charging);
          if (c.kind === 'ult') out.push('ultime pret');
          if (t && pv && pv.dmg >= t.hp) out.push(`met ${t.name} K.O.`);
          if (t && t.charging) out.push(`${t.name} charge : le briser annule son attaque de zone`);
          else if (charging.length && (c.kind === 'skill' || c.kind === 'ult')) out.push('un boss charge : on frappe fort maintenant');
          if (t && t.toughMax && pv && pv.tough >= t.tough) out.push(`brise ${t.name} (+25 % de degats subis, saute son tour)`);
          if (pv && pv.adv > 0) out.push('avantage de type (x1,5)');
          if (c.kind === 'rest') out.push(st.end < 25 ? `endurance basse (${st.end})` : 'mieux vaut souffler ce tour');
          const role = c.kind === 'skill' || c.kind === 'ult' ? B.kitRole(u, c.kind) : {};
          const low = al.reduce((m, x) => Math.min(m, x.hp / x.maxHp), 1);
          if ((role.heal || role.shield || role.taunt) && low < 0.6) out.push(`un allie est a ${Math.round(low * 100)} % de PV`);
          if (role.aoe && foes.length > 1) out.push(`touche les ${foes.length} ennemis`);
          if (t && t.status && (t.status.defDown || t.status.def_moins) && (c.kind === 'skill' || c.kind === 'ult')) out.push('profite de sa DEF baissee');
          if (!out.length && res.length > 1) out.push(`meilleur resultat en simulation (${res[0].n} essais)`);
          return out.slice(0, 3).join(' · ');
        };
        // ---------- Calibration (journal prediction contre realite) ----------
        const BINS = [[0, 0.2], [0.2, 0.5], [0.5, 0.8], [0.8, 1.01]];
        const binOf = p => BINS.findIndex(([a, b]) => p >= a && p < b);
        const calibration = () => {
          const log = lsGet(LS.log, []), bins = BINS.map(() => ({ n: 0, pred: 0, win: 0 }));
          for (const g of log) { const p = g.preds[0] ?? 0, b = bins[binOf(p)]; b.n++; b.pred += p; if (g.result === 'win') b.win++; }
          return { total: log.length, bins };
        };
        // Correction des pourcentages affiches, seulement quand une tranche a au moins 10 combats.
        // Le journal (300 combats) n'est relu qu'apres un nouveau combat termine (logEnd remet le cache a zero).
        let calibCache = null;
        const calibrate = p => {
          const c = (calibCache ??= calibration()).bins[binOf(p)];
          if (!c || c.n < 10) return p;
          const shift = c.win / c.n - c.pred / c.n;
          return Math.max(0, Math.min(1, p + shift * Math.min(1, c.n / 30)));
        };
        let curLog = null;
        const logDecision = (T, res) => {
          const id = T.f?.id; if (!id) return;
          if (!curLog || curLog.f !== id || curLog.done) curLog = { f: id, t: Date.now(), ver: lsGet(LS.ver, {})?.dom, preds: [], done: false };
          curLog.preds.push(+res[0].win.toFixed(2));
          if (curLog.s3 == null) { const r0 = res[0]; curLog.s3 = r0.s3n != null ? +(r0.s3n / r0.n).toFixed(2) : null; }
        };
        const logEnd = T => {
          if (!curLog || curLog.done || !curLog.preds.length) return;
          curLog.result = B.outcome(T.st) === 'win' ? 'win' : 'lose'; curLog.done = true;
          curLog.etoiles = curLog.result === 'win' ? (B.allies(T.st).every(u => u.alive) && T.st.cycle <= 8 ? 3 : 'moins de 3') : 0;
          const log = lsGet(LS.log, []); log.push(curLog); lsSet(LS.log, log.slice(-300)); calibCache = null;
        };

        // ---------- Interface ----------
        const ui = () => {
          if (!document.getElementById('kitsuAdvCss')) {
            const s = document.createElement('style'); s.id = 'kitsuAdvCss';
            s.textContent = '.kitsu-tgt{outline:3px solid #ff7a2f!important;outline-offset:3px;border-radius:12px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important}'
              + '.kitsu-all{outline:2px dashed #ff7a2f!important;outline-offset:3px;border-radius:12px}'
              + '.kitsu-me{outline:2px solid #2fd27a!important;outline-offset:3px;border-radius:12px}'
              + '.kitsu-btn{outline:3px solid #ff7a2f!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(8,9,12,.55)!important;border-radius:10px}'
              // 5.19 : le script prive donne un conseil exact (Tour, Campagne, arene) -> ses contours bleus seuls, pas deux conseils a l'ecran.
              + 'html[data-kar-coup] .kitsu-tgt:not(.kAr-tgt),html[data-kar-coup] .kitsu-all:not(.kAr-tgt),html[data-kar-coup] .kitsu-btn:not(.kAr-btn),html[data-kar-coup] .kitsu-me{outline:none!important;box-shadow:none!important}html[data-kar-coup] #kitsuBadge{display:none!important}'
              + '.kitsu-panel{position:fixed;right:12px;z-index:2147483647;background:rgba(12,14,19,.96);color:#f2ede6;font:12.5px/1.45 "Segoe UI",system-ui,sans-serif;padding:9px 12px 10px 13px;border:1px solid #262a33;border-radius:10px;min-width:230px;max-width:340px;pointer-events:none;display:none;box-shadow:inset 3px 0 0 var(--k-acc,#ff7a2f)}'
              + '#kitsuAdv{top:70px}#kitsuTeam,#kitsuPull{bottom:90px;font-size:12px;--k-acc:#2fd27a}#kitsuPull{--k-acc:#ffc24a}'
              + '#kitsuToast{top:12px;left:50%;right:auto;transform:translateX(-50%);font-size:12px}'
              + '#kitsuBadge{position:fixed;z-index:2147483647;pointer-events:none;background:#ff7a2f;color:#140a04;font:italic 700 13px/1.25 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:2px 9px 2px 8px;border-radius:5px 5px 5px 0;display:none;transform:translate(-50%,-125%);white-space:nowrap}'
              + '.k-ttl{font:italic 700 16px/1.1 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:.3px;text-transform:uppercase;color:#f2ede6;margin:0 0 5px}'
              + '.k-tt{font:italic 700 14px/1.2 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:.3px;text-transform:uppercase;color:#ff7a2f}'
              + '.k-who{font:600 11px/1.3 "Segoe UI",system-ui,sans-serif;letter-spacing:.7px;text-transform:uppercase;color:#9199a6}.k-who b{color:#f2ede6}'
              + '.k-move{font:italic 700 24px/1.05 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.2px;margin:3px 0 2px;color:#f2ede6}.k-move i{font-style:inherit;color:var(--k-acc,#ff7a2f)}'
              + '.k-chips{display:flex;gap:5px;flex-wrap:wrap;margin:5px 0 7px}.k-chip{white-space:nowrap;font:700 10px/1.5 system-ui,sans-serif;letter-spacing:.5px;text-transform:uppercase;padding:1px 7px;border-radius:999px;background:#1b1f28;color:#c9ced8;border:1px solid #2a2f3a}'
              + '.k-chip.hot{background:#ff4436;color:#fff;border-color:#ff4436}.k-chip.acc{color:#ff7a2f;border-color:#5a2f17;background:#22140c}.k-chip.ok{color:#2fd27a;border-color:#1f4d34;background:#0f2219}.k-chip.warn{color:#ff5f6d;border-color:#5a1f26;background:#22100f}'
              + '.k-why{font-size:12px;color:#c7ccd6;border-left:2px solid #2a2f3a;padding:1px 0 1px 8px;margin:2px 0 6px}.k-desc{font-size:11px;color:#9199a6;margin:0 0 4px}'
              + '.k-sec{display:flex;justify-content:space-between;font:700 10px/1.4 system-ui,sans-serif;letter-spacing:1.1px;text-transform:uppercase;color:#9199a6;margin:8px 0 3px}'
              + '.k-row{display:grid;grid-template-columns:14px 1fr auto;column-gap:6px;align-items:center;padding:2px 0}.k-row .n{font-weight:700;font-size:11px;color:#9199a6}.k-row .l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.k-row .p{font-weight:700;color:#ffc24a;text-align:right;white-space:nowrap}.k-row .p small{color:#9199a6;font-weight:500;font-size:10.5px;margin-left:3px}'
              + '.k-row .k-sub{grid-column:2/4;font-size:11px;color:#9199a6}.k-bar{grid-column:2/4;height:3px;border-radius:2px;background:#1d2029;overflow:hidden;margin:1px 0}.k-bar b{display:block;height:100%;background:var(--k-acc,#ff7a2f)}.k-row.k-dim{opacity:.72}.k-row:not(.k-dim) .l{font-weight:700}'
              + '.k-pc{margin:6px 0 4px;padding:6px 8px;border-radius:7px;background:#0f1a14;border:1px solid #1f4d34;font-size:12px}.k-pc.chg{background:#1f1a0c;border-color:#5a4718}.k-pc .t{display:flex;justify-content:space-between;gap:6px;font:700 10px/1.5 system-ui,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#2fd27a}.k-pc.chg .t{color:#ffc24a}.k-pc .t span{color:#9199a6;font-weight:600;letter-spacing:.2px;text-transform:none}'
              + '.k-foot{display:flex;gap:4px 10px;flex-wrap:wrap;font-size:11px;color:#9199a6;border-top:1px solid #1c1f27;margin-top:8px;padding-top:6px}.k-foot b{color:#d6dae2;font-weight:600}.k-mute{color:#9199a6}.k-gold{color:#ffc24a}.k-warn{color:#ff5f6d;font-weight:600}'
              + '.k-gd{font:italic 700 13px/1.3 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:.8px;text-transform:uppercase;background:#fff;color:#0b0c10;border-radius:999px;padding:1px 9px;margin-right:7px}';
            document.head.appendChild(s);
          }
          for (const id of ['kitsuAdv', 'kitsuTeam', 'kitsuPull', 'kitsuToast', 'kitsuBadge']) if (!document.getElementById(id)) { const d = document.createElement('div'); d.id = id; if (id !== 'kitsuBadge') d.className = 'kitsu-panel'; document.body.appendChild(d); }
          const $ = id => document.getElementById(id);
          return { box: $('kitsuAdv'), team: $('kitsuTeam'), pull: $('kitsuPull'), toast: $('kitsuToast'), badge: $('kitsuBadge') };
        };
        // Accents de l'interface (les textes du script sont ecrits sans accents ; on les remet a l'affichage).
        const ACC = [[/\bEtoiles\b/g, 'Étoiles'], [/\betoiles\b/g, 'étoiles'], [/\betoile\b/g, 'étoile'], [/\bEquipe\b/g, 'Équipe'], [/\bequipe\b/g, 'équipe'], [/\bEnergie\b/g, 'Énergie'], [/\benergie\b/g, 'énergie'],
          [/\bdegats\b/g, 'dégâts'], [/\bDegats\b/g, 'Dégâts'], [/\bRecupere\b/g, 'Récupère'], [/\brecuperer\b/g, 'récupérer'], [/\bBannieres\b/g, 'Bannières'], [/\bbannieres\b/g, 'bannières'], [/\bBanniere\b/g, 'Bannière'], [/\bbanniere\b/g, 'bannière'],
          [/\betages?\b/g, m => m.replace('e', 'é')], [/\bdeja\b/g, 'déjà'], [/\bachete\b/g, 'achète'], [/\bEntraine\b/g, 'Entraîne'], [/\bentraine\b/g, 'entraîne'], [/\bentrainer\b/g, 'entraîner'], [/\bentrainement\b/g, 'entraînement'],
          [/\bReentrainement\b/g, 'Réentraînement'], [/\ba jour\b/g, 'à jour'], [/\bA preparer\b/g, 'À préparer'], [/\ba prendre\b/g, 'à prendre'], [/\ba recuperer\b/g, 'à récupérer'], [/\ba entrainer\b/g, 'à entraîner'], [/\bportee\b/g, 'portée'],
          [/\bdepartages\b/g, 'départagés'], [/\bgardes\b/g, 'gardés'], [/\brapidite\b/g, 'rapidité'], [/\bprecis\b/g, 'précis'], [/\bDECISIF\b/g, 'DÉCISIF'], [/\bdetectee\b/g, 'détectée'], [/\bmodifiees?\b/g, m => m.replace('modifie', 'modifié')], [/\bmodifie\b/g, 'modifié'],
          [/\btermine(s?)\b/g, 'terminé$1'], [/\barriere-plan\b/g, 'arrière-plan'], [/\bRecompenses\b/g, 'Récompenses'], [/\bniveau a\b/g, 'niveau à'], [/\bverifie\b/g, 'vérifie'], [/\bpaliers a recuperer\b/g, 'paliers à récupérer'], [/\bsupposee\b/g, 'supposée'],
          [/\bprevu(e?s?)\b/g, 'prévu$1'], [/\breelles?\b/g, m => m.replace('reel', 'réel')], [/\bmarche\b/g, 'marché'], [/\bHebdo\b/g, 'Hebdo'], [/\bpleine\b/g, 'pleine'], [/\bDoublon\b/g, 'Doublon'], [/\bIA normale\b/g, 'IA normale']];
        // Chaque noeud de texte n'est corrige qu'une fois (5.18) : avant, ~40 expressions etaient repassees sur tout le dock toutes les 400 ms.
        // Un texte reecrit (innerHTML, textContent) cree de nouveaux noeuds, qui sont donc corriges a leur tour.
        const accVus = new WeakSet();
        const accents = root => {
          if (!root) return;
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) { if (accVus.has(n)) continue; let t = n.nodeValue, o = t; for (const [re, r] of ACC) t = t.replace(re, r); if (t !== o) n.nodeValue = t; accVus.add(n); }
        };
        const toast = (html, ms = 8000) => { const { toast: t } = ui(); t.innerHTML = html; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = 'none'), ms); };
        const clearMarks = badge => {
          document.querySelectorAll('.kitsu-tgt,.kitsu-all,.kitsu-me,.kitsu-btn').forEach(e => e.classList.remove('kitsu-tgt', 'kitsu-all', 'kitsu-me', 'kitsu-btn'));
          if (badge) badge.style.display = 'none';
        };
        const unitEl = k => document.querySelector(`.unit[data-unit="${k}"]`);
        const short = id => (window.CHAR_BY_ID?.[id]?.n || String(id)).split(' (')[0];
        // Guilde : points personnels. Ordre d'achat = meilleur rapport (invocations Shonen 30 pts/invocation,
        // energie 12 pts/energie, multi x10 50 pts/invocation). La carte UR (4 000) n'est pas visee : trop loin.
        const GSHOP = [{ id: 'inv5', nom: '5 invocations Shonen' }, { id: 'en10', nom: 'la recharge de 10 energies' }, { id: 'multi', nom: 'la multi-invocation x10' }];
        const guildInfo = g => {
          const me = g?.me || {}, ch = (g?.challenges || []).filter(c => c.done && !c.claimed), tiers = (g?.chest?.tiers || []).filter(t => t.reached && !t.claimed);
          const el = g?.chest?.eligible || {}, shop = g?.shop || [], pts = me.pts || 0;
          const opts = GSHOP.map(o => ({ ...o, ...(shop.find(x => x.id === o.id) || {}) })).filter(o => o.left > 0);
          const buy = opts.find(o => o.price <= pts) || null;
          return { ok: !!el.ok, contributed: !!el.contributed, eligAt: (me.joined || 0) + 3 * 86400000, weekEnd: g?.week?.ends || 0,
            chalPts: ch.reduce((a, c) => a + (c.pts || 0), 0), chestPts: tiers.reduce((a, t) => a + (t.pts || 0), 0), chal: ch.length,
            pts, cap: me.cap || 400, weekPts: me.weekPts || 0, capLeft: Math.max(0, (me.cap || 400) - (me.weekPts || 0)),
            buy, shopNext: opts.length ? opts.map(o => `${o.nom} (${o.price})`).join(' > ') : '' };
        };
        const pool = (n = 10, S = save()) => Object.keys(S.owned || {}).map(Number).map(id => {
          const c = window.CHAR_BY_ID[id], lv = S.lv?.[id]?.l || 1, st = S.stars?.[id] || 0;
          let s; try { s = G.statsAt(c, lv, st); } catch { s = { atk: c.atk, def: c.def }; }
          return { id, v: (s.atk + s.def) * (c.hpK || 1.1) * ({ M: 1.25, L: 1.15, E: 1.1 }[c.r] || 1) };
        }).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.id);
        // Interet d'un trio pour la progression : il contient des cartes du plan d'entrainement.
        // 5.37 : toutes les cartes du plan d'XP du PC (pas seulement la 1re : plan global Campagne, Tour, Raid, Arene) et celles des prochains murs
        // comptent ; une carte au 99 ne gagne plus d'XP, elle ne compte jamais. Le farm prend le trio qui en fait monter le plus a 3 etoiles.
        const xpWeights = () => {
          const tr = lsGet('kitsu_ai_training', null), w = {}, px = planXp(), S9 = save(), monte = id => S9.owned?.[id] && (S9.lv?.[id]?.l || 1) < 99;
          for (const r of lsGet('kitsu_ai_plan', null)?.avenir || []) if (r.niveauxEnPlus) for (const id of r.equipe || []) if (monte(id)) w[id] = Math.max(w[id] || 0, 4);
          (lsGet('kitsu_ai_planxp', null)?.suite || []).forEach((ids, i) => { for (const id of ids) if (monte(id)) w[id] = Math.max(w[id] || 0, Math.max(2, 5 - i * 0.5)); });
          if (px) w[px.id] = 5;
          if (tr?.objectif?.retard?.length) { const S0 = save(); for (const c of tr.objectif.retard) { const lv0 = S0.lv?.[c.id]?.l || 1; if (lv0 < tr.objectif.niveau - 2) w[c.id] = 4 + 3 * (tr.objectif.niveau - lv0) / tr.objectif.niveau; } }
          if (tr?.cartes?.length) { tr.cartes.slice(0, 3).forEach((c, i) => { if (!w[c.id]) w[c.id] = 3 - i; }); return w; }
          if (Object.keys(w).length) return w;
          const S = save(), lv = id => S.lv?.[id]?.l || 1, ids = Object.keys(S.owned || {}).map(Number);
          const top = Math.max(1, ...ids.map(lv));
          for (const id of ids) { const r = window.CHAR_BY_ID?.[id]?.r; if (['E', 'L', 'M'].includes(r) && lv(id) < top - 2) w[id] = 0.2 * ({ M: 2, L: 1.5, E: 1 }[r]) * (top - lv(id)) / top; }
          return w;
        };
        const xpScore = (t, w = xpWeights()) => t.reduce((a, id) => a + (w[id] || 0), 0);
        // Actions d'economie du moment, par ordre de rentabilite :
        // energie x25 de la boutique (1,2 gemme/energie), puis invocation x10 en gardant 15 gemmes pour une recharge.
        const econActions = (S, nTodo) => {
          const out = [], gems = S.ki || 0, pulls = lsGet('kitsu_ai_pulls', null), bb = pulls?.banners?.[0];
          const en = (S.dshop?.offers || []).find(o => o.k === 'en');
          if (en && !S.dshop?.bought?.[en.slot] && gems >= en.price + 15 && nTodo >= 10) out.push({ id: 'shop-en', txt: `Achete l'energie x${en.n} (${en.price} gemmes) : ~${en.n * 3} gemmes d'etoiles a la cle` });
          const reserve = out.length ? (en?.price || 0) + 15 : 15;
          // Les gemmes vont aux tirages seulement si la LR garantie de la banniere est atteignable avec ce qu'on a.
          const pv = bb ? String(bb.pity).split('/').map(Number) : null, needG = pv ? (pv[1] - pv[0]) * GEMS_PER_PITY : Infinity;
          if (bb && gems >= needG + reserve) out.push({ id: 'pull', banner: bb.banniere, txt: `Invoque sur ${bb.banniere} : la LR garantie est a ${needG} gemmes et tu en as ${gems}` });
          const shop = lsGet('kitsu_ai_shop', null);
          if (shop && shop.day === S.dshop?.day) for (const o of shop.offres || []) if (o.slot !== 'en' && o.verdict === 'acheter' && !S.dshop?.bought?.[o.slot] && gems >= o.prix + 15) out.push({ id: 'shop-' + o.slot, slot: o.slot, txt: `Boutique du jour : achete ${o.quoi} (${o.prix} gemmes)` });
          return out;
        };
        // Un combat vaut d'etre (re)joue maintenant ? Jamais joue : oui s'il se gagne a 90 %. Deja 1 ou 2 etoiles : il ne reste
        // que 1 ou 2 gemmes, donc seulement si les 3 etoiles sont quasi sures (90 %), sinon on y revient quand l'equipe a monte.
        // Echecs reels : combats joues ces dernieres 24 h sans faire 3 etoiles (la simulation peut se tromper,
        // les vrais resultats priment). Un combat deja etoile qui a rate les 3 etoiles n'est plus propose pendant 24 h.
        const realMiss = id => (lsGet(LS.log, []) || []).filter(g => g.f === id && g.done && g.etoiles !== 3 && Date.now() - (g.t || 0) < 86400000).length;
        // 5.33.3 : monde d'evenement ferme (Halloween : le jeu le retire de la page Aventure a HALLOWEEN_UNTIL, 1er/11 17 h,
        // mais le garde dans ALL_WORLDS et fightOpen ne regarde pas cette date). Ses combats ne sont plus proposes.
        const worldClosed = (w, now = Date.now()) => !!w && w.id === 'halloween' && Number.isFinite(G?.HALLOWEEN_UNTIL) && now >= G.HALLOWEEN_UNTIL;
        const liveWorlds = (now = Date.now()) => G.ALL_WORLDS.filter(w => !worldClosed(w, now));
        const fightClosed = id => worldClosed({ id: String(id).split('-')[0] });
        const worthNow = (r, S) => { const st = S.pve?.stars?.[r.id] || 0; return !fightClosed(r.id) && r.victoire >= 0.9 && st < 3 && (st === 0 || (r.troisEtoiles >= 0.9 && realMiss(r.id) === 0)); };
        // Progression d'une quete : enregistree, ou calculee par le jeu (quetes d'histoire : « termine l'arc… »).
        const questProg = (d, q, S) => { const p = q.prog?.[d.id]; if (p != null) return p; if (typeof d.val === 'function') { try { return +d.val(S) || 0; } catch {} } return 0; };
        // Recompenses a recuperer : connexion du jour, quetes terminees, paliers du pass.
        const claimActions = S => {
          const out = [], now = Date.now();
          try { if (G.streakState(S, now)?.canClaim) out.push({ id: 'streak', view: 'missions', sel: '[data-claim-streak]', txt: 'recupere la recompense de connexion du jour' }); } catch {}
          let ready = 0;
          for (const k of ['daily', 'weekly', 'pass', 'event', 'story']) { let defs = []; try { defs = G.questList(k, now) || []; } catch {} const q = S.quests?.[k] || {}; for (const d of defs) { if (q.ids && !q.ids.includes(d.id)) continue; if (questProg(d, q, S) >= d.goal && !q.claimed?.[d.id]) ready++; } }
          if (ready) out.push({ id: 'quests', view: 'missions', sel: '[data-qclaim-all],[data-qclaim]', txt: `${ready} quete${ready > 1 ? 's' : ''} terminee${ready > 1 ? 's' : ''} : clique sur Tout recuperer` });
          try {
            const done = [], seen = new Set();
            for (const id of Object.keys(S.owned || {})) { const sid = window.CHAR_BY_ID?.[id]?.s; if (sid == null || seen.has(sid)) continue; seen.add(sid); const list = G.albumList(sid, now) || []; if (list.length && !S.albums?.[sid] && list.every(c => S.owned?.[c.id])) done.push(sid); }
            if (done.length) out.push({ id: 'album', view: 'collection', sel: '[data-claim-album],[data-album="all"]', txt: `${done.length} album${done.length > 1 ? 's' : ''} complet${done.length > 1 ? 's' : ''} : recupere la recompense (Collection)` });
          } catch {}
          try { const p = G.passState(S, now); if (p && p.level > (p.free || 0)) out.push({ id: 'pass', view: 'pass', sel: '[data-pass-claim]', txt: `${p.level - (p.free || 0)} palier${p.level - (p.free || 0) > 1 ? 's' : ''} du pass a recuperer` }); } catch {}
          return out;
        };
        // Conseil de preparation pour une quete (aujourd'hui ou a venir), selon son intitule.
        const questHint = (t, S, future) => {
          const n = +(t.match(/\d[\d\s]*/)?.[0] || '0').replace(/\s/g, '');
          if (/D[ée]pense\s+\d+\s+Gemmes/i.test(t)) return `garde ~${n} gemmes pour ce jour-la et depense-les en energie ou boutique (guide)`;
          if (/Fusionne\s+\d+\s+doublons/i.test(t)) return future ? `ne fusionne pas tes doublons communs avant (tu en as ${Object.values(S.owned || {}).reduce((a, x) => a + Math.max(0, x - 1), 0)})` : 'fusionne des doublons communs (Collection)';
          if (/Fusionne un doublon/i.test(t)) return 'fusionne un doublon commun (Collection)';
          if (/banni[èe]re limit[ée]e/i.test(t)) return `garde ~${n * 5} gemmes pour ${n} invocation(s) a l'unite`;
          if (/Invoque|invocations?\b|Obtiens une carte/i.test(t)) return 'avec les invocations Shonen gratuites (guide a 8/10)';
          if (/d[ée]filer/i.test(t)) return 'ouvre une banniere et fais defiler les cartes (gratuit, guide)';
          if (/fiches|collection/i.test(t)) return 'ouvre la Collection et des fiches de cartes (guide)';
          if (/type\s+(\w+)/i.test(t)) return `mets une carte de type ${t.match(/type\s+(\w+)/i)[1]} dans l'equipe sur un combat facile`;
          if (/UR ou LR/i.test(t)) return 'Osamu Miya (UR) dans l\'equipe suffit';
          if (/monde\s+(.+)$/i.test(t)) return `un combat facile dans ${t.match(/monde\s+(.+)$/i)[1]}`;
          if (/pass/i.test(t)) return 'recupere le palier quand il est pret (guide)';
          if (/souffle|Repos/i.test(t)) return 'utilise Repos en combat (touche F)';
          return 'se fait en jouant normalement';
        };
        // Quetes du jour faciles a terminer tout de suite (navigation seulement).
        const questHelpers = (S, now = Date.now()) => {
          const out = []; let defs = []; try { defs = G.questList('daily', now) || []; } catch {}
          const q = S.quests?.daily || {};
          for (const d of defs) {
            if (q.ids && !q.ids.includes(d.id)) continue;
            if ((q.prog?.[d.id] || 0) >= d.goal || q.claimed?.[d.id]) continue;
            if (/fiches|collection/i.test(d.t)) out.push({ id: 'q' + d.id, view: 'collection', sel: '.card[data-id]', txt: `Quete « ${d.t} » (${q.prog?.[d.id] || 0}/${d.goal}) : ouvre des fiches de cartes` });
            else if (/d[ée]filer/i.test(d.t)) out.push({ id: 'q' + d.id, view: 'invocation', sel: null, txt: `Quete « ${d.t} » (${q.prog?.[d.id] || 0}/${d.goal}) : fais defiler la liste des cartes de la banniere` });
          }
          return out;
        };
        // Selecteurs dont le guide depend : verifies dans le code du jeu a chaque nouvelle version.
        const SELECTORS = ['data-result-next', 'data-result-close', 'data-unslot', 'data-pick', 'data-en-refill', 'data-ds-buy', 'data-qclaim-all', 'data-claim-streak', 'data-pass-claim', 'data-evp-diff', 'data-evp-go', 'data-evp-feat', 'data-salle-fight', 'data-ev-buy', 'data-ev-use', 'data-ev-size', 'data-sbc-open', 'data-sbc-auto', 'data-sbc-ok', 'data-ev-bells', 'data-goto', 'data-arc-mode', 'data-arc-nm', 'data-fight', 'data-world', 'data-back-worlds', 'data-open', 'data-act', 'data-unit', 'data-dl-skip', 'data-skip-dlg', 'data-close-prep', 'data-gtab', 'data-gw', 'data-pain', 'data-tw', 'data-claim-album', 'data-qpage', 'data-yes', 'data-ev-fight', 'data-sc-use', 'data-sc-size', 'data-sc-q', 'data-reopen', 'data-close-op', 'data-stab', 'navShop', 'play-card'];
        const trios = ids => { const t = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) t.push([ids[i], ids[j], ids[k]]); return t; };

        // Banc de test : combats de la frontiere (normaux) et boss accessibles, recalcules par version.
        let benchCache = null;
        const buildBench = async (teams, W) => {
          const pol = smartPol(W), norm = {}, boss = [];
          const ref = teams[0];
          // 5.35 : combats joues dans le worker (un lot par monde), plus sur le fil du jeu.
          for (const w of G.ALL_WORLDS) {
            const ids = w.fights.map(f => f.id), r = await simBatch(ids.map(fid => ({ fid, team: teamOf(ref), seeds: [1, 2] })), W);
            w.fights.forEach((f, i) => {
              if (f.boss) { const s = r[i].s / 2; if (s > -0.6 && s < 2.9) boss.push(f.id); }
              else if (r[i].w < 2) norm[f.id] = 1;
            });
          }
          const normList = [], nk = Object.keys(norm);
          const rn = nk.length ? await simBatch(nk.flatMap(fid => teams.map(ids => ({ fid, team: teamOf(ids), seeds: [1, 2] }))), W) : [];
          nk.forEach((f, i) => { let w = 0; for (let k = 0; k < teams.length; k++) w += rn[i * teams.length + k].w; if (w > 0 && w < teams.length * 2) normList.push(f); });
          const split = a => ({ tr: a.filter((_, i) => i % 4 !== 0), ho: a.filter((_, i) => i % 4 === 0) });
          return (benchCache = { norm: split(normList), boss: split(boss), teams });
        };
        // Tes 3 meilleurs trios : tous les trios de tes 6 meilleures cartes, classes sur un echantillon de combats.
        const defaultTeams = async (W = KitsuAI.W) => {
          const S = save(), pol = smartPol(W), sample = [];
          for (const w of G.ALL_WORLDS) w.fights.forEach((f, i) => { if (i % 6 === 0 || f.boss) sample.push(f.id); });
          const ranked = [];
          for (const t of trios(pool(6, S))) ranked.push({ t, s: (await simTrios([t], sample, [1], S, undefined, W))[0].s }); // 5.35 : dans le worker
          return ranked.sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.t);
        };


        // ---------- Evenements (modes limites lies a une banniere) ----------
        // Chaque evenement a un combat "farm" (parchemins d'XP, Zeni ou clochettes) et un boss (chance de carte SSR
        // de la serie). 4 difficultes : Normal / Difficile / Extreme / Ultime, energie 1/2/3/4, 3 essais par jour et
        // par difficulte. Gemmes uniquement a la premiere victoire (farm 1/2/3/5, boss 2/3/5/8). XP de combat a 60 %.
        const EV_DIFF = ['Normal', 'Difficile', 'Extreme', 'Ultime'];
        const SCROLL_XP = { s: 500, m: 2500, l: 10000 };
        const openEvents = (now = Date.now()) => { try { return (G.EVENTS || []).filter(e => { try { return G.eventOpen(e, now); } catch { return false; } }); } catch { return []; } };
        let evTriesFn = null;
        const evTries = (S, fid) => {
          if (evTriesFn === null) evTriesFn = (DOMM && Object.values(DOMM).find(f => typeof f === 'function' && /\.runs/.test(String(f)) && /3-\(/.test(String(f)))) || false;
          if (evTriesFn) { try { return evTriesFn(S, fid, Date.now()); } catch {} }
          const r = S.ev?.runs; return r ? Math.max(0, 3 - (r.n?.[fid] || 0)) : 3;
        };
        const evFightsOf = e => { const out = []; for (const kind of ['farm', 'boss']) for (let d = 0; d < 4; d++) { const id = `${e.id}-${kind}-${d}`; const f = G.EVENT_FIGHTS?.[id] || (() => { try { return G.findFight(id); } catch { return null; } })(); if (f) out.push({ id, kind, d, f }); } return out; };
        // Invocations Shonen gratuites ("packs") : +1 toutes les 10 min, 10 au maximum (20 en VIP). Pleines = perdues.
        const packsNow = (S, now = Date.now()) => { const cap = (+S.vipUntil || 0) > now ? 20 : 10; const p = S.packs || { v: cap, t: now }; let v = Math.max(0, Math.round(+p.v || 0)); if (v < cap) v = Math.min(cap, v + Math.floor((now - (+p.t || now)) / 6e5)); return { v, cap, fullIn: v >= cap ? 0 : (cap - v) * 10 - Math.floor(((now - (+p.t || now)) % 6e5) / 60000) }; };
        // Salle de l'Esprit et du Temps : toujours ouverte, XP de combat x10, 3 essais par jour.
        const SALLE = { id: 'ev-salle', title: "Salle de l'Esprit et du Temps", farm: { give: [{}] }, boss: { give: { s: 2 } } };
        // Defis de doublons (renouveles le lundi a 17 h) : SSR = E, UR = L, LR = M. Seuls les exemplaires en trop comptent.
        const SBC = [{ key: 'ssr_ur', r: 'E', n: 10, max: 2, txt: '10 doublons SSR -> 1 UR au hasard' }, { key: 'ur_serie', r: 'L', n: 5, max: 1, serie: true, txt: "5 doublons UR d'une meme serie -> 1 UR au choix" }, { key: 'ur_ticket', r: 'L', n: 10, max: 1, txt: '10 doublons UR -> 1 ticket LR' }, { key: 'lr_lr', r: 'M', n: 3, max: 1, txt: '3 doublons LR -> 1 LR au hasard' }];
        const sbcState = S => {
          const spare = {}, bySerie = {};
          for (const [id, n] of Object.entries(S.owned || {})) { const c = window.CHAR_BY_ID?.[id]; if (!c || n < 2) continue; spare[c.r] = (spare[c.r] || 0) + n - 1; if (c.r === 'L') { const k = c.series?.name || c.series; bySerie[k] = (bySerie[k] || 0) + n - 1; } }
          return SBC.map(d => { const used = S.sbc?.n?.[d.key] || 0, have = d.serie ? Math.max(0, ...Object.values(bySerie)) : (spare[d.r] || 0); return { ...d, have, left: Math.max(0, d.max - used), pret: have >= d.n && used < d.max }; });
        };
        // Comptoir des Zeni : l'energie (5 pour 600, 3 fois par jour) vaut bien plus que les parchemins.
        const COMPTOIR = [{ id: 'energy', prix: 600, txt: '+5 energie' }, { id: 'sc_l', prix: 3500, txt: 'grand parchemin (10 000 XP)' }, { id: 'ticket', prix: 4000, txt: '1 invocation Shonen' }, { id: 'sc_m', prix: 1000, txt: 'parchemin (2 500 XP)' }];
        // Carte qui recoit les parchemins : la plus en retard de l'equipe cible, sinon la carte a entrainer.
        // Plan d'XP du PC (launcher ouvert) : il pese tous les modes. Sans lui, plan de la page (Campagne).
        const planXp = (S = save()) => { const p = lsGet('kitsu_ai_planxp', null), c = p?.cible; return c && Date.now() - p.t < 86400000 && S.owned?.[c.id] && (S.lv?.[c.id]?.l || 1) < 99 ? c : null; };
        const scrollTarget = (S = save()) => {
          const px = planXp(S); if (px) return px.id;
          const tr = lsGet('kitsu_ai_training', null) || {}, lv = id => S.lv?.[id]?.l || 1;
          const ids = (tr.objectif?.retard || []).map(c => c.id).concat((tr.cartes || []).map(c => c.id)).filter(id => S.owned?.[id] && lv(id) < 99);
          if (ids.length) return ids[0];
          const eq = (tr.objectif?.equipe || []).filter(id => S.owned?.[id] && lv(id) < 99).sort((a, b) => lv(a) - lv(b));
          return eq[0] || null;
        };
        const evScrolls = S => { const sc = S.ev?.sc || {}; return { n: (sc.s || 0) + (sc.m || 0) + (sc.l || 0), xp: (sc.s || 0) * 500 + (sc.m || 0) * 2500 + (sc.l || 0) * 10000, sc }; };
        const KitsuAI = {
          __v: '5.39.0',
          W: (() => { const d = { norm: W_NORM, boss: W_BOSS, nm: W_NM, tower: W_TOWER }, w = lsGet(LS.w, null); if (!w) return d; for (const k of Object.keys(d)) if (w[k]?.length === NF) d[k] = w[k]; return d; })(),
          _train: null,

          async start() {
            await loadModules();
            this.live(); this.teamAdvisor(); this.pullAdvisor(); this.rewardTracker(); this.planAdvisor(); this.roadAdvisor(); if (lsGet('kitsu_ai_guide', true) !== false) this.guide(true); this.healthPanel(); this.forecast(); this.dock(); this.energyAlert(); this.raidAdvisor();
            this.checkVersion();
            const tw = lsGet('kitsu_ai_tower', null); if (!tw || Date.now() - tw.t > 86400000) setTimeout(() => this.tower(8, 4).catch(() => {}), 20000);
            const tr = lsGet('kitsu_ai_training', null);
            if (!tr || tr.ver !== 3 || Date.now() - tr.t > 6 * 3600000) setTimeout(() => this.training().then(() => this.plan()).catch(() => {}), 6000);
            setTimeout(() => this.precomputeTeams().catch(() => {}), 12000);
            const rsig = pool(8).map(id => id + ':' + Math.floor((save().lv?.[id]?.l || 1) / 5)).join(',');
            const rprev = lsGet('kitsu_ai_rosterSig', null);
            if (!rprev) lsSet('kitsu_ai_rosterSig', { sig: rsig, t: Date.now() });
            else if (rprev.sig !== rsig && Date.now() - rprev.t > 12 * 3600000) setTimeout(() => { if (!this._train || this._train.done) { toast('<b class="k-tt">Ton equipe a evolue</b><br>Reentrainement de l\'IA en arriere-plan (pause pendant les combats).', 8000); this.retrain({ quiet: true }).then(() => lsSet('kitsu_ai_rosterSig', { sig: rsig, t: Date.now() })).catch(() => {}); } }, 60000);
            if (lsGet('kitsu_ai_scriptver', null) !== this.__v) { for (const k of ['kitsu_ai_plan', 'kitsu_ai_teams', 'kitsu_ai_events', 'kitsu_ai_farm', 'kitsu_ai_road', 'kitsu_ai_snooze', 'kitsu_ai_walls']) localStorage.removeItem(k); lsSet('kitsu_ai_scriptver', this.__v); setTimeout(() => this.plan().catch(() => {}), 2000); }
            setTimeout(() => this.events().catch(() => {}), 9000);
            setTimeout(() => this.selfCheck().catch(() => {}), 15000);
            const lvSnap = () => { const S0 = save(), h = lsGet('kitsu_ai_lvhist', []); if (!h.length || Date.now() - h[h.length - 1].t > 6 * 3600000) { h.push({ t: Date.now(), lv: Object.fromEntries(Object.keys(S0.owned || {}).filter(id => ['E', 'L', 'M'].includes(window.CHAR_BY_ID?.[id]?.r)).map(id => [id, S0.lv?.[id]?.l || 1])) }); lsSet('kitsu_ai_lvhist', h.filter(x => Date.now() - x.t < 3 * 86400000).slice(-12)); } };
            lvSnap(); clearInterval(window.__kitsuLvT); window.__kitsuLvT = setInterval(lvSnap, 3600000);
            return 'KitsuAI v5.17.0 actif';
          },

          // ---------- Bloc 2 : recompenses et plan de progression ----------
          // Regle des etoiles (ecran de fin de combat) : 3 etoiles = victoire sans K.O. en 8 cycles maximum.
          // Chaque nouvelle etoile rapporte 1 gemme. Energie : 1 point toutes les 10 min, 10 au maximum.
          rewardTracker() {
            let before = null, fid = null;
            clearInterval(window.__kitsuRwT);
            window.__kitsuRwT = setInterval(() => {
              const T = liveBattle();
              if (T && !T.over && !before) { before = save(); fid = T.f?.id; return; }
              if (before && (!T || T.over)) {
                const b = before, f = fid; before = null;
                setTimeout(() => {
                  const a = save(), d = { f, t: Date.now(), gemmes: (a.ki || 0) - (b.ki || 0), xpCompte: (a.acct?.xp || 0) - (b.acct?.xp || 0) + ((a.acct?.lv || 1) - (b.acct?.lv || 1)) * 1000, etoiles: (a.pve?.stars?.[f] || 0) - (b.pve?.stars?.[f] || 0), niveaux: {}, cartes: [] };
                  for (const [id, v] of Object.entries(a.lv || {})) { const o = b.lv?.[id]; if (!o || o.l !== v.l || o.xp !== v.xp) d.niveaux[short(id)] = o && o.l !== v.l ? `niv ${o.l} -> ${v.l}` : `+${v.xp - (o?.xp || 0)} XP`; }
                  for (const id of Object.keys(a.owned || {})) if (!b.owned?.[id] || a.owned[id] > b.owned[id]) d.cartes.push(short(id));
                  const log = lsGet('kitsu_ai_rewards', []); log.push(d); lsSet('kitsu_ai_rewards', log.slice(-500));
                  const parts = [];
                  if (d.gemmes) parts.push(`<b style="color:#ffc24a">${d.gemmes > 0 ? '+' : ''}${d.gemmes} gemmes</b>`);
                  if (d.etoiles > 0) parts.push(`+${d.etoiles} etoile${d.etoiles > 1 ? 's' : ''}`);
                  const lv = Object.entries(d.niveaux).map(([k, v]) => `${k} ${v}`); if (lv.length) parts.push(lv.join(', '));
                  if (d.cartes.length) parts.push('carte : ' + d.cartes.join(', '));
                  const eco = econActions(a, 99);
                  if (eco.length) parts.push(`<span style="color:#ffc24a">A faire : ${eco.map(x => x.txt).join(' ; ')}</span>`);
                  if (parts.length) toast(`<b class="k-tt">Recompenses</b><br>${parts.join('<br>')}`, eco.length ? 10000 : 7000);
                  setTimeout(() => KitsuAI.plan().then(() => KitsuAI.precomputeTeams()).then(() => String(f || '').startsWith('ev-') ? KitsuAI.events(true) : null).then(() => Date.now() - (lsGet('kitsu_ai_training', {})?.t || 0) > 3600000 ? KitsuAI.training().then(() => KitsuAI.plan()) : null).catch(() => {}), 300);
                }, 2500);
              }
            }, 400);
          },
          rewards(n = 20) { const log = lsGet('kitsu_ai_rewards', []).slice(-n); console.table(log.map(r => ({ combat: r.f, gemmes: r.gemmes, etoiles: r.etoiles, niveaux: JSON.stringify(r.niveaux), cartes: r.cartes.join(', ') }))); return `${log.length} combats suivis`; },

          // Plan : combats jouables pas encore a 3 etoiles, chances de 3 etoiles avec le meilleur trio, gemmes, energie, tirage.
          async plan() {
            await loadModules();
            const S = save(), now = Date.now(), stars = S.pve?.stars || {}, pol = smartPol(this.W);
            const playable = [];
            for (const w of liveWorlds(now)) for (const f of w.fights) {
              if ((stars[f.id] || 0) >= 3) continue;
              let rel = true; try { rel = G.fightOpen(f, now); } catch {} if (!rel) continue;
              let prev = null; try { prev = G.prevFight(f); } catch {}
              if (prev && !((stars[prev.id || prev] || 0) > 0)) continue;
              playable.push(f);
            }
            // Modes Difficile (@h) et Extreme (@x) : un arc s'ouvre quand tous ses combats sont faits dans le mode precedent.
            // Chaine des modes par arc : Normal -> Difficile -> Extreme -> Cauchemar Normal -> Cauchemar Difficile -> Cauchemar Extreme.
            // Le Cauchemar s'ouvre apres l'Extreme et double les recompenses (x2, lu dans le code du jeu).
            // Gemmes par mode : estimation (3 etoiles x multiplicateur), a confirmer par le suivi des recompenses.
            const base3 = (G.MODES || [{ suf: '', mult: 1, n: 'Normal' }, { suf: '@h', mult: 2, n: 'Difficile' }, { suf: '@x', mult: 3, n: 'Extreme' }]);
            const rwNm = G.NM?.rw || 2;
            const MODES = [...base3, ...base3.map(m => ({ suf: (m.suf || '@') + 'n', mult: m.mult * rwNm, n: 'Cauchemar ' + (m.n || '') }))];
            for (const w of liveWorlds(now)) {
              const arcs = {}; for (const f of w.fights) (arcs[f.arc] ??= []).push(f);
              for (const fs of Object.values(arcs)) {
                for (let m = 1; m < MODES.length; m++) {
                  // Le Cauchemar demande les 3 etoiles sur tous les combats de l'arc dans les 3 difficultes (regle du jeu).
                  const prevDone = MODES[m].suf.endsWith('n') && !MODES[m - 1].suf.endsWith('n') ? fs.every(f => [0, 1, 2].every(k => (stars[f.id + MODES[k].suf] || 0) >= 3)) : fs.every(f => (stars[f.id + MODES[m - 1].suf] || 0) > 0);
                  if (!prevDone) break;
                  const nx = fs.find(f => (stars[f.id + MODES[m].suf] || 0) < 3 && (fs.indexOf(f) === 0 || (stars[fs[fs.indexOf(f) - 1].id + MODES[m].suf] || 0) > 0));
                  const hf = nx && G.findFight(nx.id + MODES[m].suf);
                  if (hf) { hf.__mult = MODES[m].mult; hf.__mode = MODES[m].n || ('mode ' + m); playable.push(hf); }
                }
              }
            }
            const trc = lsGet('kitsu_ai_training', null), tr0 = [...(trc?.objectif?.equipe || []), ...(trc?.cartes || []).slice(0, 2).map(c => c.id)].filter(id => S.owned?.[id]);
            const xw0 = xpWeights(), focusT = (trc?.objectif?.equipe || []).filter(id => S.owned?.[id]);
            const tri = trios([...new Set([...pool(6, S), ...tr0])]), seeds = [1, 2, 3, 4];
            // 5.34 : simulations dans le worker (simBatch) et non plus sur le fil du jeu : memes graines, memes equipes, memes resultats.
            // Mesure du 18/11 : ce plan, relance apres chaque combat et sur la carte, bloquait la page ~10 s par minute de jeu.
            const evL = async (f, list, n = 4, SS = S) => { const seeds = Array.from({ length: n }, (_, i) => i + 1); const out = await simBatch(list.map(ids => ({ fid: f.id, team: teamOf(ids, SS), seeds })), this.W); return out.map(o => ({ w: o.w / o.n, s3: o.s3 / o.n })); };
            const ev = async (f, ids, n = 4) => (await evL(f, [ids], n))[0];
            const rows = [];
            for (const f of playable) {
              let best = null;
              // Ton equipe actuelle d'abord : on ne propose de changer que si un autre trio fait nettement mieux.
              const curTeam = (S.pve?.team || []).filter(id => S.owned?.[id]);
              const curR = curTeam.length === 3 ? await ev(f, curTeam) : null;
              // On garde ton equipe seulement si elle fait 3 etoiles au moins aussi souvent que la meilleure
              // (un K.O. = une etoile et un combat a refaire). Sur les boss, on simule 3 fois plus.
              // Equipe cible (cartes a faire progresser) : prise des qu'elle fait aussi 3 etoiles.
              const focR = focusT.length === 3 && xpScore(focusT, xw0) > xpScore(curTeam, xw0) ? await ev(f, focusT, 16) : null;
              if (focR && focR.s3 >= 0.95) best = { t: focusT, ...focR, pourXp: true };
              else if (curR && curR.s3 >= 1 && !f.boss) best = { t: curTeam, ...curR, garder: true };
              else {
                const xw = xpWeights();
                // 1er tri rapide (4 simulations), puis les 6 meilleurs sont rejoues 16 fois : une equipe "pour l'XP"
                // n'est retenue que si elle fait vraiment 3 etoiles (sinon on perd une carte et le combat est a refaire).
                const quick = (await evL(f, tri, f.boss ? 12 : 4)).map((r, i) => ({ t: tri[i], ...r })).sort((a, b) => b.s3 - a.s3 || b.w - a.w || xpScore(b.t, xw) - xpScore(a.t, xw)).slice(0, 6);
                const sure = (await evL(f, quick.map(x => x.t), 16)).map((r, i) => ({ t: quick[i].t, ...r }));
                const s3max = Math.max(...sure.map(x => x.s3));
                best = sure.filter(x => x.s3 >= s3max - 0.02).sort((a, b) => b.s3 - a.s3 || b.w - a.w || xpScore(b.t, xw) - xpScore(a.t, xw))[0];
                if (best.s3 >= 0.95) { const xpPick = sure.filter(x => x.s3 >= 0.95).sort((a, b) => xpScore(b.t, xw) - xpScore(a.t, xw) || b.s3 - a.s3)[0]; if (xpPick) best = xpPick; }
                const curB = curR && f.boss ? await ev(f, curTeam, 12) : curR;
                if (curB && curB.s3 >= best.s3 - 0.02 && curB.w >= best.w - 0.02 && xpScore(curTeam, xw) >= xpScore(best.t, xw)) best = { t: curTeam, ...curB, garder: true };
              }
              const cur = stars[f.id] || 0;
              // Gemmes exactes (formule du jeu) : (etoiles gagnees x 1 + bonus de 1re victoire si 0 etoile avant) x2 en Cauchemar.
              // Bonus de 1re victoire : Normal 0, Difficile 1, Extreme 2. On suppose 2 etoiles quand on gagne sans les 3.
              const mi = f.mode || 0, firstB = [0, 1, 2][mi] || 0, rw = f.nm ? (G.NM?.rw || 2) : 1;
              const g3 = ((3 - cur) + (cur === 0 ? firstB : 0)) * rw, g2 = (Math.max(0, 2 - cur) + (cur === 0 ? firstB : 0)) * rw;
              rows.push({ id: f.id, nom: f.t + (f.__mode ? ` (${f.__mode})` : ''), mode: f.__mode || 'Normal', boss: !!f.boss, etoiles: cur, gemmesMax: g3, gemmesEsperees: +(g3 * best.s3 + g2 * (best.w - best.s3)).toFixed(1), victoire: best.w, troisEtoiles: best.s3, equipe: best.t, garder: !!best.garder, xp: G.fightXp(f), cout: G.fightCost(f) });
              await idle();
            }
            rows.sort((a, b) => b.gemmesEsperees / b.cout - a.gemmesEsperees / a.cout);
            let en = S.energy?.v ?? 0; try { en = G.energy(S, now).v; } catch {}
            const gems = S.ki || 0, gain = rows.reduce((a, r) => a + r.gemmesEsperees, 0), cost = rows.filter(r => r.gemmesEsperees > 0).reduce((a, r) => a + r.cout, 0);
            const pulls = lsGet(LS.pulls, null), bestBanner = pulls?.banners?.[0];
            const blockers = rows.filter(r => r.victoire < 0.7);
            // Prevision : premier "mur" de chaque monde (premier combat non fait que tes 3 meilleurs trios gagnent
            // a moins de 75 %), niveaux en plus necessaires, XP par carte et combats de farm correspondants.
            const wallKey = pool(6, S).map(id => id + ':' + Math.floor((S.lv?.[id]?.l || 1) / 3)).join(',') + '|' + Math.floor(Object.keys(stars).length / 10);
            const wallCache = lsGet('kitsu_ai_walls', null);
            const reuseWalls = wallCache && wallCache.key === wallKey && Date.now() - wallCache.t < 12 * 3600000;
            const avenir = reuseWalls ? wallCache.avenir : [];
            const xpNeed = l => Math.floor(30 * l ** 1.35);
            const lvOf = id => S.lv?.[id]?.l || 1;
            const xpTo = (id, k) => { let x = 0; for (let l = lvOf(id); l < Math.min(99, lvOf(id) + k); l++) x += xpNeed(l); return x; };
            const farm = [];
            for (const w of liveWorlds(now)) for (const f of w.fights) if ((stars[f.id] || 0) > 0) farm.push(f);
            farm.sort((a, b) => G.fightXp(b) / G.fightCost(b) - G.fightXp(a) / G.fightCost(a));
            const topTeams = [...new Set(rows.map(r => r.equipe.join(',')))].map(x => x.split(',').map(Number)).concat(tri).slice(0, 3);
            let farmFight; for (const f of farm) if ((await ev(f, topTeams[0])).w >= 1) { farmFight = f; break; }
            const ev4 = async (f, t, SS) => (await evL(f, [t], seeds.length, SS || S))[0].w;
            if (!reuseWalls) for (const w of liveWorlds(now)) {
              let wall = null, idx = 0;
              for (const f of w.fights) {
                idx++;
                if ((stars[f.id] || 0) > 0) continue;
                let best = 0, bt = topTeams[0];
                for (const t of topTeams) { const r = await ev4(f, t); if (r > best) { best = r; bt = t; } if (best >= 0.75) break; }
                if (best < 0.75) { wall = { f, best, idx, t: bt }; break; }
                if (idx % 10 === 0) await idle();
              }
              if (!wall) continue;
              let need = null;
              for (const k of [5, 10, 15, 20, 30, 40, 60]) {
                const S2 = structuredClone(S); S2.lv ||= {};
                for (const id of wall.t) S2.lv[id] = { l: Math.min(99, lvOf(id) + k), xp: 0 };
                if (await ev4(wall.f, wall.t, S2) >= 0.75) { need = k; break; }
              }
              const xp = need ? Math.max(...wall.t.map(id => xpTo(id, need))) : null;
              avenir.push({ monde: w.name || w.id, id: wall.f.id, nom: wall.f.t, boss: !!wall.f.boss, position: `${wall.idx}/${w.fights.length}`, victoire: wall.best, equipe: wall.t, niveauxEnPlus: need, xpParCarte: xp, combatsDeFarm: xp && farmFight ? Math.ceil(xp / G.fightXp(farmFight)) : null, farm: farmFight?.t });
              await idle();
            }
            if (!reuseWalls) { avenir.sort((a, b) => (a.niveauxEnPlus ?? 99) - (b.niveauxEnPlus ?? 99)); lsSet('kitsu_ai_walls', { key: wallKey, t: Date.now(), avenir }); }
            const res = { t: Date.now(), energie: en, gemmes: gems, gemmesAPrendre: +gain.toFixed(0), energieNecessaire: cost, minutesEnergie: Math.max(0, (cost - en) * 10), apresPlan: Math.round(gems + gain), tirages10: Math.floor((gems + gain) / 50), banniere: bestBanner ? `${bestBanner.banniere} (pity ${bestBanner.pity})` : 'ouvre l\'ecran Bannieres pour la calculer', combats: rows, bloquants: blockers, avenir, tour: lsGet('kitsu_ai_tower', null) };
            lsSet('kitsu_ai_plan', res);
            return res;
          },
          // ---------- Plan d'entrainement et boutiques ----------
          // Echantillon de reference : boss de milieu de campagne (les murs a venir), un essai chacun.
          _refFights() { const out = []; for (const w of G.ALL_WORLDS) w.fights.forEach((f, i) => { if (f.boss && i > 15 && i < 130) out.push(f.id); }); return out; },
          async _wins(t, S, lvMap = {}, fights = this._refFights()) {
            const team = t.map(id => ({ id, lv: lvMap[id] ?? (S.owned?.[id] ? (S.lv?.[id]?.l || 1) : 22), stars: S.stars?.[id] || 0 }));
            const out = await simBatch(fights.map(fid => ({ fid, team, seeds: [1] })), this.W);
            return out.reduce((a, r) => a + r.w, 0);
          },
          // Quelles cartes monter, jusqu'ou, et avec qui les faire porter (chaque carte de l'equipe recoit toute l'XP).
          async training() {
            await loadModules();
            const S = save(), lvOf = id => S.lv?.[id]?.l || 1;
            const key = Object.keys(S.owned || {}).length + '|' + pool(8, S).map(id => id + ':' + Math.floor(lvOf(id) / 3)).join(',');
            const c0 = lsGet('kitsu_ai_training', null);
            if (c0 && c0.key === key && c0.ver === 3 && Date.now() - c0.t < 6 * 3600000) return c0;
            const core = pool(5, S), target = Math.max(...core.slice(0, 3).map(lvOf));
            const base = await this._wins(core.slice(0, 3), S);
            const xpNeed = l => Math.floor(30 * l ** 1.35), xpTo = (id, L) => { let x = 0; for (let l = lvOf(id); l < L; l++) x += xpNeed(l); return x; };
            const cands = Object.keys(S.owned || {}).map(Number).filter(id => { const c = window.CHAR_BY_ID[id]; return ['E', 'L', 'M'].includes(c.r) || (c.r === 'R' && c.pw >= 62); });
            const rows = [];
            for (const c of cands) {
              let best = null;
              for (let i = 0; i < core.length; i++) for (let j = i + 1; j < core.length; j++) {
                if (core[i] === c || core[j] === c) continue;
                const t = [c, core[i], core[j]], w = await this._wins(t, S, { [c]: Math.max(lvOf(c), target) });
                if (!best || w > best.w) best = { t, w };
              }
              await idle();
              const xp = xpTo(c, target);
              if (best && best.w > base && xp > 0) rows.push({ id: c, nom: short(c), niveau: lvOf(c), cible: target, xp, combats: Math.ceil(xp / 1000), gain: best.w - base, trio: best.t });
            }
            rows.sort((a, b) => b.gain / Math.max(1, b.xp) - a.gain / Math.max(1, a.xp));
            // Equipe cible a long terme : meilleur trio si toutes tes cartes etaient au meme niveau, sur des combats
            // Extreme (les combats Normaux se gagnent avec presque tout). Ses cartes en retard passent en priorite d'XP.
            let objectif = null;
            try {
              const L = Math.max(target, ...pool(3, S).map(lvOf)), statL = id => { const c = window.CHAR_BY_ID[id]; try { const x = G.statsAt(c, L, S.stars?.[id] || 0); return x.atk + x.def; } catch { return c.atk + c.def; } };
              const pot = Object.keys(S.owned || {}).map(Number).filter(id => ['E', 'L', 'M'].includes(window.CHAR_BY_ID[id]?.r)).sort((a, b) => statL(b) - statL(a)).slice(0, 10);
              // Tous les boss du jeu en Extreme (127) : les combats de reference saturent (151/154) avec une LR.
              const hard = []; for (const w of G.ALL_WORLDS) w.fights.forEach(f => { if (f.boss) hard.push(f.id + '@x'); });
              const lmOf = t => Object.fromEntries(t.map(id => [id, Math.max(lvOf(id), L)]));
              let ob = null;
              const need = t => t.reduce((x, id) => x + xpTo(id, L), 0);
              const hard2 = [...hard, ...hard]; // 2 passages (graines differentes) pour limiter le bruit
              const all = []; for (const t of trios(pot)) { const tm = t.map(id => ({ id, lv: lmOf(t)[id], stars: S.stars?.[id] || 0 })); const o = await simBatch(hard.map(fid => ({ fid, team: tm, seeds: [1, 2] })), this.W); all.push({ t, w: o.reduce((a, r) => a + r.w, 0) }); await idle(); }
              // A 2 victoires pres (bruit de simulation), on prend le trio qui demande le moins d'XP.
              const wMax = Math.max(...all.map(x => x.w)); ob = all.filter(x => x.w >= wMax - 4).sort((a, b) => need(a.t) - need(b.t) || b.w - a.w)[0];
              // Stabilite : on garde l'ancienne equipe cible tant qu'elle reste a 4 victoires de la meilleure.
              const prevT = c0?.objectif?.equipe, prevR = prevT && all.find(x => x.t.length === 3 && x.t.every(id => prevT.includes(id)));
              if (prevR && prevR.w >= wMax - 4) ob = prevR;
              const curT = (S.pve?.team || []).map(Number).filter(id => S.owned?.[id]);
              const curW = curT.length === 3 ? await this._wins(curT, S, lmOf(curT), hard) : 0;
              if (ob) objectif = { equipe: ob.t, niveau: L, victoires: ob.w, actuelle: curW * 2, sur: hard.length * 2, retard: ob.t.filter(id => lvOf(id) < L - 2).map(id => ({ id, nom: short(id), niveau: lvOf(id), xp: xpTo(id, L) })) };
            } catch (e) { health.err('objectif : ' + e.message); }
            const res = { key, t: Date.now(), base, cible: target, combats: this._refFights().length, cartes: rows, objectif, ver: 3 };
            lsSet('kitsu_ai_training', res);
            return res;
          },
          // Boutique du jour (cartes, energie) et boutique de guilde, comparees aux invocations et recharges.
          async shops() {
            await loadModules();
            const S = save(), day = S.dshop?.day, c0 = lsGet('kitsu_ai_shop', null);
            if (c0 && c0.day === day && c0.n === Object.keys(S.owned || {}).length) return c0;
            const pulls = lsGet(LS.pulls, null), perCentBanner = pulls?.banners?.[0] ? pulls.banners[0].ev10 * 2 : null;
            const core = pool(6, S), tri = trios(core), base = []; for (const t of tri) base.push({ t, w: await this._wins(t, S) }); base.sort((a, b) => b.w - a.w); base.length = Math.min(2, base.length);
            const out = [];
            for (const o of S.dshop?.offers || []) {
              if (S.dshop.bought?.[o.slot]) continue;
              if (o.k === 'en') { out.push({ slot: o.slot, quoi: `${o.n} energie`, prix: o.price, verdict: 'acheter', pourquoi: `${(o.price / o.n).toFixed(1)} gemme par energie (recharge : 1,5), et ~3 gemmes d'etoiles par energie en campagne` }); continue; }
              if (o.k !== 'card' || S.owned?.[o.id]) continue;
              let best = 0;
              for (const x of base) for (let j = 0; j < 3; j++) { const t = x.t.slice(); t[j] = o.id; best = Math.max(best, await this._wins(t, S)); }
              await idle();
              const gain = best - base[0].w, perCent = gain / o.price * 100;
              out.push({ slot: o.slot, quoi: `${short(o.id)} (${window.CHAR_BY_ID[o.id].r})`, prix: o.price, gain, verdict: gain > 0 && (perCentBanner == null || perCent >= perCentBanner) ? 'acheter' : 'passer', pourquoi: `${gain >= 0 ? '+' : ''}${gain} victoires sur ${this._refFights().length} boss${perCentBanner != null ? ` (${perCent.toFixed(1)} pour 100 gemmes, banniere : ${perCentBanner.toFixed(1)})` : ''}` });
            }
            const res = { day, n: Object.keys(S.owned || {}).length, t: Date.now(), offres: out,
              guilde: 'Boutique de guilde : prends d\'abord l\'energie x10 (120 points), qui vaut ~30 gemmes d\'etoiles, puis les 5 invocations (150 points, ~25 gemmes)' };
            lsSet('kitsu_ai_shop', res);
            return res;
          },

          // ---------- Objectif banniere et alerte energie ----------
          // Barre d'objectif en haut du dock : gemmes pour la garantie LR de la meilleure banniere avant sa fin,
          // rythme necessaire contre rythme reel (gemmes gagnees ces 6 dernieres heures).
          goalTick() {
            const d = document.getElementById('kitsuDock'); if (!d || !G) return;
            // Appele toutes les 0,4 s par le dock : relit la sauvegarde et le journal des gains (jusqu'a 500 combats) ; 5 s suffisent (echelle : heures).
            if (Date.now() - (this._goalT || 0) < 5000 && document.getElementById('kitsuGoal')) return; this._goalT = Date.now();
            let bar = document.getElementById('kitsuGoal');
            if (!bar) { bar = document.createElement('div'); bar.id = 'kitsuGoal'; bar.style.cssText = 'padding:6px 12px 6px 13px;border-bottom:1px solid #1c1f27;font-size:11px'; d.insertBefore(bar, d.querySelector('#kitsuDockTabs')); }
            const S = save(), now = Date.now(), pulls = lsGet(LS.pulls, null);
            const cands = (G.BANNERS || []).filter(b => b.until && b.until > now && b.until - now < 7 * 86400000);
            const b = cands.find(x => x.series === pulls?.banners?.[0]?.banniere) || cands.find(x => (S.pity?.[x.series] || 0) > 0);
            if (!b) { bar.style.display = 'none'; return; }
            bar.style.display = 'block';
            const pmax = (() => { try { return G.pityMax(b); } catch { return 50; } })(), pity = S.pity?.[b.series] || 0;
            const gems = S.ki || 0, needTotal = (pmax - pity) * GEMS_PER_PITY, missing = Math.max(0, needTotal - gems);
            const h = (b.until - now) / 3600000;
            const goal = lsGet('kitsu_ai_goal', null);
            const g0 = goal && goal.banner === b.series && goal.until === b.until ? goal : { banner: b.series, until: b.until, start: needTotal - gems, t: now };
            if (g0 !== goal) lsSet('kitsu_ai_goal', g0);
            const pct = g0.start > 0 ? Math.max(0, Math.min(1, 1 - missing / g0.start)) : 1;
            const rw = lsGet('kitsu_ai_rewards', []).filter(r => now - r.t < 6 * 3600000);
            const rate6 = rw.reduce((a, r) => a + Math.max(0, r.gemmes || 0), 0) / 6;
            const need = h > 0 ? missing / h : Infinity;
            const reach = gems + Math.max(rate6, 30) * Math.max(0, h) * 0.5;
            const ok = missing === 0 ? 'atteint : invoque !' : reach < needTotal ? `garantie hors de portee avant la fin (${needTotal} gemmes) : ne la vise pas` : rate6 >= need ? `dans les temps (${rate6.toFixed(1)}/h, il faut ${need.toFixed(1)}/h)` : `en retard (${rate6.toFixed(1)}/h, il faut ${need.toFixed(1)}/h)`;
            const col = missing === 0 ? '#2fd27a' : rate6 >= need ? '#2fd27a' : '#ff5f6d';
            bar.innerHTML = `<div style="display:flex;justify-content:space-between"><b style="color:#ffc24a">Objectif LR ${b.series}</b><span>${h < 24 ? Math.round(h) + ' h' : Math.floor(h / 24) + ' j ' + Math.round(h % 24) + ' h'} restantes</span></div>`
              + `<div style="height:6px;background:#1b1f28;border-radius:3px;margin:3px 0"><div style="height:6px;width:${Math.round(pct * 100)}%;background:${col};border-radius:3px"></div></div>`
              + `<div>${gems}/${needTotal} gemmes (pity ${pity}/${pmax}) · <span style="color:${col}">${ok}</span></div>`;
            accents(bar);
          },
          // Notification du systeme quand l'energie est pleine (onglet en arriere-plan compris).
          energyAlert(on) {
            if (on === false) { lsSet('kitsu_ai_enAlert', false); return 'alerte energie desactivee'; }
            const ask = () => { if (!('Notification' in window)) return; if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p === 'granted') toast('Alerte energie activee : tu seras prevenu quand elle sera pleine.', 5000); }); };
            if (on === true) { lsSet('kitsu_ai_enAlert', true); ask(); }
            clearInterval(window.__kitsuEnT);
            window.__kitsuEnT = setInterval(() => {
              if (lsGet('kitsu_ai_enAlert', null) !== true || !G || !('Notification' in window) || Notification.permission !== 'granted') return;
              const S = save(); let en = S.energy?.v ?? 0, max = 10; try { en = G.energy(S, Date.now()).v; max = G.enMax(S, Date.now()); } catch {}
              // On previent au moment ou la recharge naturelle remplit la jauge (pas quand une recharge achetee la depasse).
              const prev = window.__kitsuEnPrev; window.__kitsuEnPrev = en;
              const last = lsGet('kitsu_ai_enNotified', 0);
              if (prev != null && prev < max && en >= max && Date.now() - last > 30 * 60000) {
                lsSet('kitsu_ai_enNotified', Date.now());
                try { const n = new Notification('KITSU : energie pleine', { body: `${en}/${max} energie : elle ne se recharge plus. ${(S.ki || 0) >= 50 ? 'Tu as ' + S.ki + ' gemmes.' : ''}`, tag: 'kitsu-energy' }); n.onclick = () => { window.focus(); n.close(); }; } catch {}
              }
            }, 30000);
            return 'alerte energie ' + (lsGet('kitsu_ai_enAlert', null) === true ? 'active' : 'inactive');
          },

          // ---------- Onglet Sante ----------
          // Verifie que chaque bouton utilise par le guide existe encore dans le code du jeu (apres une mise a jour).
          async selfCheck(force = false) {
            const files = [...new Set(performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/assets\/[^/]+\.js$/.test(n) && !/three|Pass-|Shader|Composer|Bloom|Room|hwaccel|rolldown/.test(n)))];
            const sig = files.map(f => f.split('/').pop()).sort().join(','), c0 = lsGet('kitsu_ai_selfcheck', null);
            if (!force && c0 && c0.sig === sig) return c0;
            let src = ''; for (const f of files) { try { src += await (await fetch(f)).text(); } catch {} }
            const lazy = ['data-evp-diff', 'data-evp-go', 'data-evp-feat', 'data-salle-fight', 'data-ev-buy', 'data-ev-use', 'data-ev-size', 'data-sbc-open', 'data-sbc-auto', 'data-sbc-ok', 'data-ev-bells'];
            const missing = SELECTORS.filter(x => !src.includes(x)), unsure = missing.filter(x => lazy.includes(x) && !files.some(f => /events-/.test(f)));
            const res = { sig, t: Date.now(), total: SELECTORS.length, manquants: missing.filter(x => !unsure.includes(x)), nonCharges: unsure };
            lsSet('kitsu_ai_selfcheck', res);
            if (res.manquants.length) { health.err('le jeu a change : ' + res.manquants.join(', ')); toast(`<b style="color:#ff5f6d">Le jeu a ete mis a jour</b><br>Le guide peut se tromper sur : ${res.manquants.join(', ')}. Envoie un « Signaler » a Claude.`, 12000); }
            return res;
          },
          // Instantane de l'ecran pour corriger un bug precis : copie dans le presse-papiers.
          signal() {
            const S = save(), vis = el => el && el.offsetParent;
            const btns = [...document.querySelectorAll('button,a,[role="button"]')].filter(vis).slice(0, 80).map(e => { const d = Object.entries(e.dataset || {}).map(([k, v]) => k + (v ? '=' + v : '')).join(' '); return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${d ? ' [' + d + ']' : ''} ${(e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}`; });
            const W = (() => { try { return prepScreen(); } catch { return null; } })(), T = (() => { try { return liveBattle(); } catch { return null; } })();
            const rep = { v: this.__v, quand: new Date().toLocaleString('fr-FR'), ecran: location.hash, guide: window.__kitsuGuideLast || null, energie: S.energy, gemmes: S.ki, equipe: (S.pve?.team || []).map(short),
              prep: W?.f ? { combat: W.f.id, equipe: (W.team || []).map(x => short(typeof x === 'object' ? x?.id : x)) } : null, combat: T ? { id: T.f?.id, fini: !!T.over } : null,
              plan: (lsGet('kitsu_ai_plan', null)?.combats || []).slice(0, 3).map(r => `${r.id} ${Math.round(r.troisEtoiles * 100)}% ${r.equipe.map(short).join('/')}`),
              erreurs: health.errors.slice(0, 5).map(e => e.m), verif: lsGet('kitsu_ai_selfcheck', null), boutons: btns };
            const txt = 'KITSU-REPORT ' + JSON.stringify(rep, null, 1);
            const log = lsGet('kitsu_ai_reports', []); log.push(rep); lsSet('kitsu_ai_reports', log.slice(-10));
            try { navigator.clipboard.writeText(txt); } catch {}
            return txt;
          },
          // Export pour l'outil local (dossier moteur/) : cartes, niveaux, etoiles et reglages de l'IA. Aucun jeton de connexion.
          async exportData() {
            const S = save(), data = { t: Date.now(), script: this.__v, owned: S.owned || {}, lv: S.lv || {}, stars: S.stars || {}, team: S.pve?.team || [], acct: { lv: S.acct?.lv || 1 }, W: this.W };
            // Boss de guilde de la semaine (pour l'analyse locale), sans aucun jeton dans le fichier.
            try { const r = await fetch('/api/guilds/week', { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } }); if (r.ok) { const g = await r.json(); if (g.boss) data.guild = { boss: { id: g.boss.id, name: g.boss.name, lv: g.boss.lv, hp: g.boss.hp, turns: g.week?.turns || 12 }, minLv: g.week?.minLv || 15 }; } } catch {}
            // Marche (echanges) : lots ouverts et offres recues sur tes lots, lus comme le fait la page du marche.
            try { const H = { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } }; const [a, b] = await Promise.all([fetch('/api/market', H), fetch('/api/market/mine', H)]); if (a.ok) { const m = await a.json(), mi = b.ok ? await b.json() : { open: [] }; data.market = { t: Date.now(), lots: (m.lots || []).slice(0, 400).map(l => ({ card: +l.card, lv: +l.lv || null })), mine: (mi.open || []).map(o => ({ card: +o.card, offers: (o.offers || []).map(f => ({ card: +f.card, lv: +f.lv || null })) })) }; } } catch {}
            // Pain (evenement de guilde) : son niveau, pour que le moteur local cherche le trio qui fait le plus de degats.
            try { const r = await fetch('/api/guilds/pain', { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } }); if (r.ok) { const g = await r.json(); if (g.event?.open && g.boss) data.pain = { lv: g.boss.lv, hp: g.boss.hp }; } } catch {}
            return data;
          },
          async exportMoteur() {
            const data = await this.exportData();
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'sauvegarde.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            return data;
          },
          healthPanel() {
            let hp = document.getElementById('kitsuHealth');
            if (!hp) { hp = document.createElement('div'); hp.id = 'kitsuHealth'; hp.className = 'kitsu-panel'; hp.style.display = 'block'; document.body.appendChild(hp); }
            const age = t => t ? (Date.now() - t < 60000 ? 'a l\'instant' : Date.now() - t < 3600000 ? `il y a ${Math.round((Date.now() - t) / 60000)} min` : `il y a ${Math.round((Date.now() - t) / 3600000)} h`) : 'jamais';
            const render = () => {
              if (document.getElementById('kitsuDock')?.dataset.tab !== 'health') return;
              const v = lsGet(LS.ver, {}), log = lsGet(LS.log, []), l3 = log.filter(g => g.s3 != null && g.etoiles != null);
              const ok3 = l3.filter(g => (g.s3 >= 0.9) === (g.etoiles === 3)).length;
              const T = this._train, tm = lsGet('kitsu_ai_teams', {});
              const rows = [
                ['Script', 'v' + this.__v],
                ['Calcul du PC (serveur local)', localPC.ok ? `connecte (${localPC.fils} fils)` : (localPC.msg || 'non lance') + ' : lance l\'application KitsuAI'],
                ['Jeu', `${v.dom || '?'} · ${v.fights || '?'} combats · ${v.chars || '?'} cartes`],
                ['Calcul en fil separe', worker ? 'actif' : worker === false ? 'indisponible (fil principal)' : 'pas encore lance'],
                ['Plan', age(lsGet('kitsu_ai_plan', null)?.t)],
                ['Equipes precalculees', Object.keys(tm).length + ' combats'],
                ['Plan d\'entrainement', age(lsGet('kitsu_ai_training', null)?.t)],
                ['Murs', age(lsGet('kitsu_ai_walls', null)?.t)],
                ['Bannieres', age(lsGet(LS.pulls, null)?.t)],
                ['Boutique', age(lsGet('kitsu_ai_shop', null)?.t)],
                ['Entrainement IA', T ? (T.done ? 'termine' : `${T.phase}, ${T.runs} combats simules`) : (lsGet(LS.w, null) ? 'poids reentraines enregistres' : 'poids par defaut')],
                ['Journal', `${log.length} combats, ${log.filter(g => g.result === 'win').length} victoires`],
                ['3 etoiles prevues', l3.length ? `${ok3}/${l3.length} predictions justes` : 'pas encore de donnees'],
                ['Boutons du jeu', (() => { const c = lsGet('kitsu_ai_selfcheck', null); return !c ? 'pas encore verifie' : c.manquants.length ? `<span style="color:#ff5f6d">${c.manquants.length} introuvable(s)</span>` : `${c.total - c.nonCharges.length}/${c.total} presents`; })()],
                ...(() => { const by = {}; for (const g of log) { if (!g.preds?.length) continue; const m = /^ev-salle/.test(g.f) ? 'Salle' : /^ev-/.test(g.f) ? 'Evenement' : /@x?n$|@hn$/.test(g.f) ? 'Cauchemar' : /@x$/.test(g.f) ? 'Extreme' : /@h$/.test(g.f) ? 'Difficile' : 'Normal'; const b = by[m] ||= { n: 0, p: 0, w: 0 }; b.n++; b.p += g.preds[0]; if (g.result === 'win') b.w++; } return Object.entries(by).map(([m, b]) => ['Calibration ' + m, `prevu ${Math.round(b.p / b.n * 100)} % · reel ${Math.round(b.w / b.n * 100)} % (${b.n})`]); })(),
              ];
              hp.innerHTML = `<div class="k-ttl">Sante de KitsuAI</div>`
                + rows.map(([k, x]) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><span style="opacity:.7">${k}</span><span>${x}</span></div>`).join('')
                + (health.errors.length ? `<div style="margin-top:6px;color:#ff5f6d;font-size:11px">${health.errors.slice(0, 4).map(e => `${age(e.t)} : ${e.m}`).join('<br>')}</div>` : '<div style="margin-top:6px;color:#2fd27a;font-size:11px">Aucune erreur recente</div>')
                + `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><span id="kitsuRecalc" style="cursor:pointer;background:#1b1f28;padding:3px 8px;border-radius:6px;font-size:11px">Tout recalculer</span>`
                + `<span id="kitsuExpBtn" style="cursor:pointer;background:#1d3a5a;padding:3px 8px;border-radius:6px;font-size:11px">Exporter pour le moteur local</span>`
                + `<span id="kitsuRepBtn" style="cursor:pointer;background:#5a2f17;padding:3px 8px;border-radius:6px;font-size:11px">Signaler (copie l'ecran)</span>`
                + `<span id="kitsuEnBtn" style="cursor:pointer;background:${lsGet('kitsu_ai_enAlert', null) === true ? '#1f4d34' : '#1b1f28'};padding:3px 8px;border-radius:6px;font-size:11px">Alerte energie pleine : ${lsGet('kitsu_ai_enAlert', null) === true ? (('Notification' in window && Notification.permission === 'granted') ? 'active' : 'autorisation bloquee') : 'activer'}</span></div>`;
              document.getElementById('kitsuExpBtn').onclick = async () => { await this.exportMoteur(); toast('<b class="k-tt">sauvegarde.json telechargee</b><br>Glisse-la dans le panneau KitsuAI (zone « Ta sauvegarde »).', 8000); };
              document.getElementById('kitsuRepBtn').onclick = () => { this.signal(); toast('<b class="k-tt">Rapport copie</b><br>Colle-le dans ta conversation avec Claude (Ctrl+V).', 7000); };
              document.getElementById('kitsuEnBtn').onclick = () => { const on = lsGet('kitsu_ai_enAlert', null) === true; this.energyAlert(!on); render(); };
              document.getElementById('kitsuRecalc').onclick = async () => {
                for (const k of ['kitsu_ai_plan', 'kitsu_ai_teams', 'kitsu_ai_training', 'kitsu_ai_walls', LS.pulls, 'kitsu_ai_shop', 'kitsu_ai_gw', 'kitsu_ai_road']) localStorage.removeItem(k);
                toast('<b class="k-tt">Recalcul complet</b><br>Plan, equipes, entrainement, boutique : en arriere-plan.', 6000);
                try { await this.plan(); await this.training(); await this.shops(); await this.precomputeTeams(); } catch (e) { health.err(e.message); }
              };
            };
            clearInterval(window.__kitsuHealthT);
            window.__kitsuHealthT = setInterval(render, 2000);
          },

          // ---------- Dock unique ----------
          // Tous les panneaux dans un seul cadre deplacable et repliable, a onglets. L'onglet suit le contexte
          // (combat, equipe, invocation, carte), sauf si tu viens d'en choisir un. Alt+K : replier / deplier.
          dock() {
            if (document.getElementById('kitsuDock')) return;
            const css = document.createElement('style'); css.id = 'kitsuDockCss';
            const tabs = [['adv', 'Combat', 'kitsuAdv'], ['team', 'Équipe', 'kitsuTeam'], ['plan', 'Plan', 'kitsuPlan'], ['road', 'Roadmap', 'kitsuRoad'], ['pull', 'Tirage', 'kitsuPull'], ['future', 'Avenir', 'kitsuFuture'], ['health', 'Santé', 'kitsuHealth']];
            css.textContent = '#kitsuDock{position:fixed;z-index:2147483646;width:340px;background:rgba(12,14,19,.96);color:#f2ede6;font:12.5px/1.45 "Segoe UI",system-ui,sans-serif;border:1px solid #262a33;border-radius:10px;box-shadow:inset 3px 0 0 #ff7a2f}'
              + '#kitsuDockHead{display:flex;align-items:center;gap:7px;padding:7px 10px 6px 13px;cursor:move;border-bottom:1px solid #1c1f27;user-select:none}#kitsuDockHead svg{width:15px;height:15px;flex:none}'
              + '#kitsuDockHead .kd-b{font:700 12px/1 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:1.6px;text-transform:uppercase}#kitsuDockHead .kd-b em{font-style:normal;color:#ff7a2f}'
              + '#kitsuDockCtx{font:600 10.5px/1.3 system-ui,sans-serif;letter-spacing:.7px;text-transform:uppercase;color:#9199a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}#kitsuDockCtx .k-chip{margin-left:4px}'
              + '#kitsuDockPc{margin-left:auto;font:600 11px system-ui,sans-serif;color:#9199a6;white-space:nowrap}#kitsuDockPc::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#4b5160;margin-right:4px;vertical-align:1px}#kitsuDockPc.on::before{background:#2fd27a}'
              + '#kitsuDockMin{cursor:pointer;color:#9199a6;font:700 14px/1 system-ui;padding:0 2px 0 4px}'
              + '#kitsuDockTabs{display:flex;padding:0 6px 0 9px;border-bottom:1px solid #1c1f27}'
              + '.kd-tab{position:relative;font:600 11px/1.3 system-ui,sans-serif;color:#9199a6;padding:6px 5px 5px;cursor:pointer}.kd-tab.on{color:#f2ede6}.kd-tab.on::after{content:"";position:absolute;left:5px;right:5px;bottom:-1px;height:2px;background:#ff7a2f}.kd-tab.rel::before{content:"";position:absolute;top:4px;right:1px;width:5px;height:5px;border-radius:50%;background:#2fd27a}'
              + '#kitsuDockBody{padding:9px 12px 10px 13px;max-height:62vh;overflow:auto}#kitsuDock.min #kitsuDockBody,#kitsuDock.min #kitsuDockTabs{display:none}'
              // 5.19 : conseil exact du script prive en cours -> le dock se replie sur une ligne (clic sur la ligne : tout voir).
              // 5.36 : cadre unique. Le script prive (0.25+) installe son conseil dans #kitsuPriv, en tete du dock : un seul cadre,
              // liseré bleu. Le conseil public (#kitsuAdv) est cache dessous ; un clic sur les lignes d'avis du prive l'affiche.
              + 'html[data-kar-avis] #kitsuDock:not(.priv):not([data-voir]){display:none!important}#kitsuPriv:empty{display:none}#kitsuDock.priv{box-shadow:inset 3px 0 0 #4fa8ff}#kitsuDock.priv #kitsuDockHead svg path:first-child{fill:#4fa8ff}#kitsuDock.priv #kitsuDockHead .kd-b em{color:#4fa8ff}'
              + '#kitsuDock.priv #kitsuDockTabs,#kitsuDock.priv:not([data-voir]) #kitsuAdv,#kitsuDock.priv #kitsuGoal{display:none!important}#kitsuDock.priv.min #kitsuDockBody{display:block}#kitsuDock.priv #kitsuDockCtx{color:#4fa8ff}'
              + '#kitsuDock.priv[data-voir] #kitsuAdv{display:block!important;margin-top:8px;padding-top:8px;border-top:1px solid #1c1f27}'
              + '#kitsuDock.exact:not([data-voir]) #kitsuDockBody,#kitsuDock.exact:not([data-voir]) #kitsuDockTabs,#kitsuDock.exact:not([data-voir]) #kitsuGoal{display:none}#kitsuDock.exact #kitsuDockCtx{cursor:pointer;color:#c9ced8}'
              + '#kitsuDock .kitsu-panel{position:static!important;transform:none!important;max-width:none!important;min-width:0!important;border:none!important;background:none!important;padding:0!important;box-shadow:none!important;pointer-events:auto!important}'
              + tabs.map(([k, , id]) => `#kitsuDock:not([data-tab="${k}"]) #${id}{display:none!important}`).join('');
            document.head.appendChild(css);
            const d = document.createElement('div'); d.id = 'kitsuDock';
            d.innerHTML = `<div id="kitsuDockHead"><svg viewBox="0 0 16 16"><path d="M1 2l4.2 3.4h5.6L15 2l-1.4 7L8 14.5 2.4 9z" fill="#ff7a2f"/><path d="M5.3 8.2l1.6.9M10.7 8.2l-1.6.9" stroke="#0c0e13" stroke-width="1.3" stroke-linecap="round"/></svg><span class="kd-b">Kitsu<em>AI</em></span><span id="kitsuDockCtx"></span><span id="kitsuDockPc">PC</span><span id="kitsuDockMin" title="Alt+K">–</span></div><div id="kitsuDockTabs">${tabs.map(([k, n]) => `<span class="kd-tab" data-kd="${k}">${n}</span>`).join('')}</div><div id="kitsuDockBody"><div id="kitsuPriv"></div></div>`;
            document.body.appendChild(d);
            const pos = lsGet('kitsu_ai_dock', { right: 12, top: 110, min: false });
            const place = p => { d.style.top = p.top + 'px'; d.style.right = p.right + 'px'; d.classList.toggle('min', !!p.min); const m = d.querySelector('#kitsuDockMin'); if (m) m.textContent = p.min ? '+' : '–'; };
            place(pos);
            const body = d.querySelector('#kitsuDockBody'), ctxEl = d.querySelector('#kitsuDockCtx'), pcEl = d.querySelector('#kitsuDockPc');
            ctxEl.onclick = () => { if (!d.classList.contains('exact')) return; if (d.dataset.voir) delete d.dataset.voir; else d.dataset.voir = '1'; };
            const adopt = () => { for (const [, , id] of tabs) { const el = document.getElementById(id); if (el && el.parentElement !== body) body.appendChild(el); } };
            let override = 0;
            d.querySelectorAll('.kd-tab').forEach(t => t.onclick = () => { d.dataset.tab = t.dataset.kd; override = Date.now(); if (pos.min) { pos.min = false; place(pos); lsSet('kitsu_ai_dock', pos); } });
            const toggle = () => { pos.min = !pos.min; place(pos); lsSet('kitsu_ai_dock', pos); };
            d.querySelector('#kitsuDockMin').onclick = toggle;
            window.addEventListener('keydown', e => { if (e.altKey && (e.key === 'k' || e.key === 'K')) toggle(); });
            // Deplacement a la souris (position memorisee)
            const head = d.querySelector('#kitsuDockHead');
            head.addEventListener('mousedown', e => {
              if (e.target.classList.contains('kd-tab') || e.target.id === 'kitsuDockMin' || (d.classList.contains('exact') && e.target.closest('#kitsuDockCtx'))) return;
              const sx = e.clientX, sy = e.clientY, r0 = { ...pos };
              const mv = ev => { pos.right = Math.max(0, r0.right - (ev.clientX - sx)); pos.top = Math.max(0, r0.top + (ev.clientY - sy)); place(pos); };
              const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); lsSet('kitsu_ai_dock', pos); };
              window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
            });
            clearInterval(window.__kitsuDockT);
            window.__kitsuDockT = setInterval(() => {
              if (document.hidden) return; // onglet cache : rien a afficher
              adopt();
              const rel = {}; for (const [k, , id] of tabs) { const el = document.getElementById(id); rel[k] = !!el && el.style.display !== 'none' && (!!el.firstElementChild || el.textContent.trim() !== ''); }
              d.querySelectorAll('.kd-tab').forEach(t => { t.classList.toggle('rel', rel[t.dataset.kd]); t.classList.toggle('on', d.dataset.tab === t.dataset.kd); });
              if (Date.now() - override > 30000) { const auto = ['adv', 'team', 'pull', 'road', 'plan'].find(k => rel[k]) || d.dataset.tab || 'plan'; d.dataset.tab = auto; }
              // 5.19 : ligne de contexte (onglet ouvert, ou conseil public replie quand le script prive donne un coup exact). Reecrite seulement si elle change.
              // 5.36 : le prive a installe son conseil dans le dock : onglet Combat, pas de repli « exact », contexte du prive.
              const privEl = d.querySelector('#kitsuPriv'), priv = !!privEl?.firstElementChild && privEl.firstElementChild.style.display !== 'none' && document.documentElement.dataset.karAvis != null;
              if (d.classList.contains('priv') !== priv) d.classList.toggle('priv', priv);
              if (priv && d.dataset.tab !== 'adv') d.dataset.tab = 'adv';
              const kc = priv ? null : document.documentElement.dataset.karCoup, exact = kc != null && d.dataset.tab === 'adv';
              if (kc == null && !priv && d.dataset.voir) delete d.dataset.voir;
              if (d.classList.contains('exact') !== exact) d.classList.toggle('exact', exact);
              let ctx = '· ' + (tabs.find(t => t[0] === d.dataset.tab)?.[1] || '');
              if (priv) ctx = '· ' + String(privEl.firstElementChild.dataset.ctx || 'Privé').replace(/[&<>"]/g, '');
              if (exact) { const c = window.__kitsuCoup, same = !!c && c.kind + '|' + (c.tgt || '') === kc; ctx = !kc || !c ? '· Public · conseil exact du privé' : `· Public · ${c.label}<span class="k-chip ${same ? 'ok' : 'warn'}">${same ? '=' : '≠'}</span>`; }
              if (ctxEl._v !== ctx) { ctxEl._v = ctx; ctxEl.innerHTML = ctx; }
              const pcOn = !!localPC.ok; if (pcEl._v !== pcOn) { pcEl._v = pcOn; pcEl.classList.toggle('on', pcOn); pcEl.title = pcOn ? 'Moteur du PC connecté' : 'Moteur du PC absent'; }
              try { KitsuAI.goalTick(); } catch {}
              accents(d); accents(document.getElementById('kitsuGuide')); accents(document.getElementById('kitsuToast')); accents(document.getElementById('kitsuBadge'));
            }, 400);
          },

          // ---------- Guide pas a pas ----------
          // Surligne en permanence le prochain endroit ou cliquer (onglet, monde, etape, cartes, Combattre, recharge,
          // invocation). Ne clique jamais : c'est toi qui cliques.
          guide(on = true) {
            clearInterval(window.__kitsuGuideT);
            const clr = () => document.querySelectorAll('.kitsu-guide,.kitsu-add,.kitsu-rm').forEach(e => e.classList.remove('kitsu-guide', 'kitsu-add', 'kitsu-rm'));
            let pill = document.getElementById('kitsuGuide');
            if (!on) { clr(); pill?.remove(); lsSet('kitsu_ai_guide', false); return 'guide desactive'; }
            lsSet('kitsu_ai_guide', true);
            ui();
            if (!document.getElementById('kitsuGuideCss')) { const s = document.createElement('style'); s.id = 'kitsuGuideCss'; s.textContent = '.kitsu-guide{outline:3px solid #fff!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important;border-radius:12px;animation:kitsuPulse 1.2s ease-in-out 3}@keyframes kitsuPulse{50%{outline-color:#ff7a2f}}.kitsu-add{outline:3px solid #2fd27a!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important;border-radius:12px}.kitsu-rm{outline:3px solid #ff4436!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important;border-radius:12px}'; document.head.appendChild(s); }
            if (!pill) { pill = document.createElement('div'); pill.id = 'kitsuGuide'; pill.className = 'kitsu-panel'; document.body.appendChild(pill); }
            // Sous la barre de navigation du jeu (sinon elle cache les onglets du haut).
            { const nav = [...document.querySelectorAll('header,nav,.topbar,#topbar')].find(e => e.offsetParent && e.getBoundingClientRect().top < 5); const top = nav ? Math.round(nav.getBoundingClientRect().bottom) + 8 : 72; pill.style.cssText = `top:${top}px;left:50%;right:auto;transform:translateX(-50%);font-size:12.5px;display:block;text-align:center;max-width:560px;border-radius:999px;padding:5px 14px 5px 6px;box-shadow:none`; }
            // Visible a l'ecran (y compris les fenetres en position fixe, que offsetParent ne voit pas).
            const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('#kitsuDock,#kitsuGuide');
            // Premier element VISIBLE (le jeu a souvent deux exemplaires d'un bouton, dont un cache dans un menu).
            const qv = sel => [...document.querySelectorAll(sel)].find(vis) || null;
            // Ecran d'equipe : son propre bouton (.pp-go / [data-go]) passe avant ceux de la page en dessous (evenements).
            const btnText = re => { const bs = [...document.querySelectorAll('button')].filter(b => vis(b) && re.test(b.innerText || '')); return bs.find(b => b.matches('.pp-go,[data-go]')) || bs.find(b => !b.matches('[data-evp-go],[data-ev-fight]')) || bs[0]; };
            let lastKey = '', guideCheck = {};
            const mark = (el, txt, key, groups = []) => {
              clr();
              pill.innerHTML = `<span class="k-gd">Guide</span>${txt}`;
              for (const g of groups) for (const e of g.els) e && e.classList.add(g.cls);
              window.__kitsuGuideLast = { t: Date.now(), key, txt: pill.innerText, el: el ? (el.outerHTML || '').slice(0, 200) : null };
              if (!el) return true;
              el.classList.add('kitsu-guide');
              if (key !== lastKey) { lastKey = key; const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
              return true;
            };
            // Aller a une vue du jeu : lien direct s'il est visible, sinon le menu Jouer (Aventure, Evenements, Tour, Arene).
            const goView = (v, txt, key) => {
              if (location.hash.split('/')[0] === '#' + v) return null;
              const cands = [...document.querySelectorAll(`a[href="#${v}"],a[data-view="${v}"]`)].filter(vis).filter(e => v !== 'social' || /social|guilde/i.test(e.innerText || ''));
              const a = cands.find(e => e.classList.contains('play-card')) || cands.find(e => e.closest('[role="menu"],[id$="-menu"],.menu,.dropdown')) || cands.find(e => e.closest('header,nav') && (e.innerText || '').trim().length > 2) || cands.find(e => (e.innerText || '').trim().length > 2) || cands[0] || (v === 'shop' ? [document.getElementById('navShop')].find(vis) : null);
              const NAME = { missions: 'QUETES', invocation: 'BANNIERES', collection: 'COLLECTION', shop: 'Boutique (panier)', social: 'Guilde', play: 'JOUER', adventure: 'JOUER', events: 'JOUER' };
              if (a) { const r = a.getBoundingClientRect(); if (a.classList.contains('play-card')) return mark(a, `${txt} : clique sur la carte « ${{ adventure: 'Aventure', events: 'Evenements', tour: 'Tour de l\'infini', arena: 'Arene' }[v] || v} »`, key); return mark(a, `${txt} : clique d'abord sur ${NAME[v] ? '« ' + NAME[v] + ' »' : 'le lien en surbrillance'}${r.top < 80 ? ' dans la barre du haut' : ''}`, key); }
              // Lien cache dans un menu deroulant (ex. COMMUNAUTE > Social) : on montre le bouton qui ouvre le menu.
              const hid = [...document.querySelectorAll(`a[href="#${v}"]`)].find(e => e.closest('[id$="-menu"],[role="menu"]'));
              if (hid) { const menu = hid.closest('[id$="-menu"],[role="menu"]'), tg = menu?.id ? [...document.querySelectorAll(`[aria-controls="${menu.id}"]`)].find(vis) : null; if (tg) return mark(tg, `${txt} : ouvre « ${(tg.innerText || '').trim()} », puis « ${(hid.innerText || '').trim()} »`, key + '-menu'); }
              if (['adventure', 'events', 'tour', 'arena'].includes(v)) return mark(qv('a[data-view="play"]'), txt + ' : ouvre Jouer', key + '-play');
              if (v === 'pass') { const m = [...document.querySelectorAll('a[href="#missions"]')].find(vis); if (m) return mark(m, txt + ' : ouvre Quetes, onglet Parcours/Pass', key + '-m'); }
              return mark(null, txt, key);
            };
            const snooze = (id, min) => { const sz = lsGet('kitsu_ai_snooze', {}); sz[id] = Date.now() + min * 60000; lsSet('kitsu_ai_snooze', sz); };
            window.__kitsuGuideT = setInterval(() => {
              if (document.hidden) return;
              try {
                const T = liveBattle();
                if (T && !T.over) { clr(); pill.innerHTML = '<span class="k-gd">Guide</span>combat en cours : suis le panneau KitsuAI'; return; }
                // Verification anti-robot du jeu : c'est a toi de la faire, le guide ne pointe rien.
                if ([...document.querySelectorAll('h2,h3,b,strong,p')].some(e => /Petite v[ée]rification/i.test(e.textContent || '') && vis(e))) return mark(null, 'verification du jeu : coche la case toi-meme, puis continue', 'botcheck');
                { const sk = [...document.querySelectorAll('#skipAll')].find(vis); if (sk) return mark(sk, 'invocation : clique sur « Tout passer » (ou touche la carte pour la retourner)', 'skipall'); const h = document.getElementById('tpHelp'); if (vis(h) && /Touche/i.test(h.innerText || '')) { const c = [...document.querySelectorAll('.tp-card')].find(vis); if (c) return mark(c, 'touche la carte pour la retourner (ou « Tout passer »)', 'tpcard'); } }
                // Animations et fenetres a passer : invocation (Passer, puis toucher), carte gagnee, popups, installation.
                for (const [sel, txt] of [['#skipAll', 'invocation : clique sur « Tout passer » (ou touche la carte pour la retourner)'], ['#tpPack', 'booster : glisse la souris sur les pointilles pour l\'ouvrir'], ['.wk-skip', 'invocation : clique sur « Passer »'], ['.rr-tap', 'touche l\'ecran pour continuer'], ['.rw-hint,.rw-card', 'carte obtenue : clique dessus (ou a cote) pour continuer'], ['[data-pop-close]', 'ferme cette fenetre (croix en haut a droite)'], ['[data-pwa-later]', 'fenetre « installer l\'appli » : clique sur la croix']]) {
                  const e = [...document.querySelectorAll(sel)].find(vis);
                  if (e) return mark(e, txt, 'ov' + sel);
                }
                // Resultats d'invocation sans invocation gratuite restante : Fermer.
                { const fe = [...document.querySelectorAll('[data-close-op=""]')].find(vis); if (fe && packsNow(save()).v === 0) return mark(fe, 'invocations terminees : clique sur « Fermer »', 'opclose'); }
                // Fiche de carte (Collection) avec parchemins d'XP : bonne carte ? plus gros parchemin, Max utile, Utiliser.
                { const use = [...document.querySelectorAll('[data-sc-use]')].find(vis);
                  if (use && /^sc/.test(lastKey)) {
                    const S0 = save(), tg = scrollTarget(S0), m = use.closest('#modal,.modal') || document, cid = +(m.querySelector('[data-fav-star]')?.getAttribute('data-fav-star') || m.querySelector('.card[data-id]')?.dataset.id || 0);
                    if (evScrolls(S0).n === 0) { const x = [...m.querySelectorAll('.modal-x,[data-close]')].find(vis); return mark(x || null, 'parchemins utilises : ferme la fiche', 'scdone'); }
                    if (tg && cid && cid !== tg) { const x = [...m.querySelectorAll('.modal-x,[data-close]')].find(vis); return mark(x || null, `ce n'est pas la bonne carte : ferme, puis ouvre ${short(tg)}`, 'scx' + cid); }
                    const sz = [...m.querySelectorAll('[data-sc-size]')].filter(vis), on = sz.find(b => b.classList.contains('on') && !b.disabled), big = ['l', 'm', 's'].map(k => sz.find(b => b.dataset.scSize === k && !b.disabled)).find(Boolean);
                    if (big && on !== big) return mark(big, `parchemins pour ${short(cid)} : choisis le plus gros`, 'scsz' + big.dataset.scSize);
                    const mx = [...m.querySelectorAll('[data-sc-q="max"]')].find(b => vis(b) && !b.disabled);
                    if (mx && !/^scmax/.test(lastKey) && !/^scuse/.test(lastKey)) return mark(mx, `parchemins pour ${short(cid)} : clique sur « Max utile »`, 'scmax' + (on || big)?.dataset.scSize);
                    if (!use.disabled) return mark(use, `parchemins pour ${short(cid)} : clique sur « ${(use.innerText || 'Utiliser').trim()} »`, 'scuse' + (on || big)?.dataset.scSize);
                  }
                }
                // Fenetre « parchemin » : le plus gros parchemin, puis la carte a faire monter.
                const sizes = [...document.querySelectorAll('[data-ev-size]')].filter(vis);
                if (sizes.length) {
                  const on = sizes.find(b => b.classList.contains('on') && !b.disabled), best = ['l', 'm', 's'].map(k => sizes.find(b => b.dataset.evSize === k && !b.disabled)).find(Boolean);
                  if (!on && best) return mark(best, 'parchemin : choisis le plus gros', 'scs');
                  const trg = (lsGet('kitsu_ai_training', null)?.objectif?.retard || []).map(c => c.id).concat((lsGet('kitsu_ai_training', null)?.cartes || []).map(c => c.id));
                  for (const id of trg) { const c = [...document.querySelectorAll(`[data-ev-scroll="${id}"]`)].find(vis); if (c) return mark(c, `donne-le a ${short(id)} (carte a faire monter)`, 'scc' + id); }
                  const srch = [...document.querySelectorAll('input')].find(e => vis(e) && /recherch/i.test(e.placeholder || ''));
                  return mark(srch || null, trg.length ? `cherche « ${short(trg[0]).split(' ')[0]} » et donne-lui le parchemin` : 'choisis la carte de ton equipe la plus basse', 'scq');
                }
                // Fenetre de confirmation ouverte apres un achat ou une recuperation conseillee.
                if (/^(eco|refill|cl|bells|packs|sbc|sc|zeni|shop|pull|gw|ev|salle|feat|diff)/.test(lastKey)) {
                  // Fenetre de confirmation du jeu : .ask avec les boutons [data-yes] / [data-no].
                  const box = [...document.querySelectorAll('.ask')].filter(vis).pop() || [...document.querySelectorAll('[role="dialog"],dialog[open],.confirm')].filter(e => vis(e) && e.querySelector('[data-yes]')).pop();
                  const yes = box && ([...box.querySelectorAll('[data-yes]')].find(b => vis(b) && !b.disabled) || [...box.querySelectorAll('button')].find(b => vis(b) && !b.disabled && /acheter|remplir|recharger|confirmer|valider|oui|echanger|échanger|d[ée]poser|utiliser|r[ée]cup[ée]rer/i.test(b.innerText || '')));
                  if (yes) { if (lastKey.startsWith('gw')) window.__kitsuGuildT = 0; return mark(yes, `confirme : clique sur « ${(yes.innerText || 'Confirmer').trim()} »`, lastKey + '-ok'); }
                }
                // Fenetre « defi de doublons » : Remplir, puis valider.
                const sbcOk = [...document.querySelectorAll('[data-sbc-ok]')].find(vis);
                if (sbcOk) { const auto = [...document.querySelectorAll('[data-sbc-auto]')].find(b => vis(b) && !b.disabled); if (auto && sbcOk.disabled) return mark(auto, 'defi de doublons : clique sur Remplir', 'sbca'); if (!sbcOk.disabled) return mark(sbcOk, 'defi de doublons : valide', 'sbcok'); }
                // 5.19.1 : avec le script prive, l'ecran de choix de la compo de la Tour suit son trio (html[data-kar-tour]),
                // meme si d'autres combats restent au plan. Le reste des conseils ne change pas.
                const karT = KitsuAI._karTour(), pkT = karT ? [...document.querySelectorAll('[data-tw="pickc"]')].filter(vis) : [];
                if (pkT.length) {
                  const on = pkT.filter(c => c.classList.contains('on')).map(c => +c.dataset.id), extra = on.filter(id => !karT.equipe.includes(id)), missing = karT.equipe.filter(id => !on.includes(id));
                  const byId = id => pkT.find(c => +c.dataset.id === id);
                  if (extra.length) return mark(byId(extra[0]), `Tour : retire ${short(extra[0])} (trio du calcul exact)`, 'kxrm' + extra[0]);
                  if (missing.length) { const el = byId(missing[0]); return mark(el || [...document.querySelectorAll('input')].find(e => vis(e) && /recherch/i.test(e.placeholder || '')) || null, `Tour : ajoute ${missing.map(short).join(', ')}${el ? '' : ' (cherche-le)'} (trio du calcul exact)`, 'kxadd' + missing[0], [{ els: missing.slice(1).map(byId).filter(Boolean), cls: 'kitsu-add' }]); }
                  const st = [...document.querySelectorAll('[data-tw="start"]')].find(b => vis(b) && !b.disabled); if (st) return mark(st, `Tour : lance la montee (calcul exact : ~${karT.etage} etages)`, 'kxstart');
                }
                const S = save(), P = lsGet('kitsu_ai_plan', null);
                const E0 = lsGet('kitsu_ai_events', null); if ((!E0 || Date.now() - E0.t > 6 * 3600000 || Object.keys(S.ev?.clear || {}).some(k => E0.combats && !E0.combats.find(r => r.id === k)?.fait)) && !KitsuAI._evBusy && !T && Date.now() - (window.__kitsuEvTry || 0) > 60000) { window.__kitsuEvTry = Date.now(); KitsuAI.events().catch(e => health.err('evenements : ' + e.message)); }
                if (!P && !prepScreen()) { mark(null, 'calcul du plan... ouvre l\'onglet Jouer'); return; }
                let en = S.energy?.v ?? 0; try { en = G.energy(S, Date.now()).v; } catch {}
                const todo = (P?.combats || []).filter(r => worthNow(r, S))
                  .sort((a, b) => b.troisEtoiles - a.troisEtoiles || (b.gemmesEsperees / (b.cout || 1)) - (a.gemmesEsperees / (a.cout || 1)) || b.xp - a.xp);
                let next = todo[0];
                // Plus aucune 3 etoiles facile : on rejoue le combat deja gagne qui donne le plus d'XP par energie
                // aux cartes a faire monter (equipe cible), pour franchir les murs plus vite.
                // Tour de l'infini (niveau de compte 25) : une montee si l'IA prevoit de depasser ton record.
                const twA = !next && !T ? KitsuAI._towerAction(S, en) : null;
                if (twA) {
                  const pk = [...document.querySelectorAll('[data-tw="pickc"]')].filter(vis);
                  if (pk.length) {
                    const on = pk.filter(c => c.classList.contains('on')).map(c => +c.dataset.id), extra = on.filter(id => !twA.team.includes(id)), missing = twA.team.filter(id => !on.includes(id));
                    const byId = id => pk.find(c => +c.dataset.id === id);
                    if (extra.length) return mark(byId(extra[0]), `Tour : retire ${short(extra[0])}`, 'twrm' + extra[0]);
                    if (missing.length) { const el = byId(missing[0]); return mark(el || [...document.querySelectorAll('input')].find(e => vis(e) && /recherch/i.test(e.placeholder || '')) || null, `Tour : ajoute ${missing.map(short).join(', ')}${el ? '' : ' (cherche-le)'}`, 'twadd' + missing[0], [{ els: missing.slice(1).map(byId).filter(Boolean), cls: 'kitsu-add' }]); }
                    const st = [...document.querySelectorAll('[data-tw="start"]')].find(b => vis(b) && !b.disabled); if (st) return mark(st, `Tour : lance la montee (record ${twA.best}, l'IA vise ~${twA.cible})`, 'twstart');
                  }
                  const ft = [...document.querySelectorAll('[data-tw="fight"]')].find(b => vis(b) && !b.disabled); if (ft) return mark(ft, 'Tour : etage suivant', 'twfight');
                  const tp = [...document.querySelectorAll('[data-tw="pick"]')].find(b => vis(b) && !b.disabled); if (tp) return mark(tp, `Tour : nouvelle montee avec ${twA.team.map(short).join(', ')}`, 'twpick');
                  if (goView('tour', `Tour de l'infini : vise l'etage ~${twA.cible} (record ${twA.best})`, 'twnav')) return;
                }
                if (!next) {
                  const F = lsGet('kitsu_ai_farm', null);
                  if (F?.row && Date.now() - F.t < 3600000) { if (en >= (F.row.cout || 1)) { todo.push(F.row); next = F.row; } }
                  else if (!KitsuAI._farmBusy && Date.now() - (window.__kitsuFarmTry || 0) > 120000 && !T) { window.__kitsuFarmTry = Date.now(); KitsuAI.farm().catch(e => health.err('farm : ' + e.message)); }
                }
                // Dialogues de l'Aventure : bouton suivant.
                const dlg = [...document.querySelectorAll('[data-dl-skip]')].find(vis);
                if (dlg) return mark(dlg, 'dialogue : clique sur Passer (astuce : coche « Passer les dialogues » sur l\'ecran d\'equipe)', 'dlg');
                // Ecran de fin de combat : Combat suivant si c'est le prochain du plan, sinon retour a la carte.
                const rClose = [...document.querySelectorAll('[data-result-close]')].find(vis);
                if (rClose) {
                  const rn = [...document.querySelectorAll('[data-result-next]')].find(vis);
                  const evN = KitsuAI._evActions(S, en).find(a => a.fight && (!a.cout || a.cout <= en));
                  if (en <= 0) return mark(rClose, 'plus d\'energie : retour a la carte', 'res-close0');
                  const lastF = T?.f?.id; if (lastF && (S.pve?.stars?.[lastF] || 0) > 0 && (S.pve?.stars?.[lastF] || 0) < 3 && realMiss(lastF) > 0) return mark(rClose, `pas 3 etoiles : stop sur ce combat pour aujourd'hui (la 3e etoile ne vaut qu'1 gemme). Retour a la carte${next ? ` pour « ${next.nom} »` : ''}`, 'res-miss');
                  if (evN) return mark(rClose, `retour a la carte, puis ${evN.txt}`, 'res-ev');
                  const rr = [...document.querySelectorAll('[data-result-retry]')].find(vis);
                  if (next?.farm && rr && T?.f?.id === next.id) return mark(rr, `rejoue « ${next.nom} » pour l'XP (+${next.xp} XP par carte)`, 'res-farm');
                  if (next && rn && rn.dataset.resultNext === next.id) return mark(rn, `combat suivant : « ${next.nom} » (3 etoiles ${Math.round(next.troisEtoiles * 100)} %)`, 'res-next');
                  return mark(rClose, next ? `retour a la carte pour « ${next.nom} »` : 'retour a la carte', 'res-close');
                }
                const W = prepScreen();
                // Tu enchaines un combat alors qu'une action economie etait proposee : on la met en pause 20 min.
                if (W) { const sz = lsGet('kitsu_ai_snooze', {}); let ch = false; for (const x of [...econActions(S, todo.length), ...KitsuAI._evActions(S, en).filter(a => !a.fight)]) if (!(sz[x.id] > Date.now())) { sz[x.id] = Date.now() + 20 * 60000; ch = true; } if (ch) lsSet('kitsu_ai_snooze', sz); }
                // Ecran d'equipe : selectionner les bonnes cartes puis Combattre
                if (W && W.f) {
                  const team = (W.team || []).map(x => typeof x === 'object' ? x?.id : x).filter(Boolean).map(Number);
                  // Equipe deja selectionnee : si elle fait 3 etoiles a 90 % ou plus sur ce combat, on ne change rien.
                  const isEv = String(W.f.id).startsWith('ev-'), evRow = isEv ? (lsGet('kitsu_ai_events', null)?.combats || []).find(r => r.id === W.f.id) : null;
                  const sig = W.f.id + '|' + team.join(',');
                  if (team.length === 3 && guideCheck.sig !== sig) {
                    guideCheck = { sig, ok: null };
                    simBatch([{ fid: W.f.id, team: teamOf(team, save()), seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }], KitsuAI.W).then(([o]) => { if (guideCheck.sig === sig) guideCheck.ok = (isEv ? o.w : o.s3) / o.n; }).catch(() => {}); // 5.34 : dans le worker
                  }
                  const bestS3 = isEv ? Math.min(0.95, evRow?.victoire || 0) : next && W.f.id === next.id ? next.troisEtoiles : 0;
                  const planT = isEv ? evRow?.equipe : (next && W.f.id === next.id ? next.equipe : null), xwG = xpWeights();
                  const xpSwap = planT?.length === 3 && (isEv ? (evRow?.victoire || 0) >= 0.95 : (next?.troisEtoiles || 0) >= 0.95) && xpScore(planT, xwG) > xpScore(team, xwG) + 0.5;
                  // Le guide suit exactement le verdict « A jouer » du panneau Equipe quand il est calcule pour ce combat.
                  const pp = window.__kitsuPick?.fid === W.f.id ? window.__kitsuPick : null;
                  // Mauvais combat ? Bouton « Carte » (retour) : un combat d'evenement ou de la Salle passe d'abord
                  // (essais du jour, premieres victoires qui expirent), et on ne lance pas un mur.
                  const backB = [...document.querySelectorAll('[data-close-prep]')].find(vis);
                  const evFirst = KitsuAI._evActions(S, en).find(a => a.fight && (!a.cout || a.cout <= en));
                  if (backB && evFirst && evFirst.fight.id !== W.f.id) return mark(backB, `reviens a la carte : d'abord ${evFirst.txt}`, 'back-ev' + evFirst.id);
                  const missN = realMiss(W.f.id);
                  if (backB && !isEv && (S.pve?.stars?.[W.f.id] || 0) > 0 && (S.pve?.stars?.[W.f.id] || 0) < 3 && missN > 0) return mark(backB, `stop : tu as deja rate les 3 etoiles ici ${missN} fois aujourd'hui (il ne reste qu'1 gemme a gagner). Reviens a la carte${next ? `, joue plutot « ${next.nom} »` : ''}`, 'back-miss' + W.f.id);
                  if (backB && !isEv && pp && pp.s3 < 0.9 && !(P?.combats || []).some(r => r.id === W.f.id && worthNow(r, S))) return mark(backB, (S.pve?.stars?.[W.f.id] || 0) > 0 ? `3e etoile pas assez sure ici (${Math.round(pp.s3 * 100)} % au mieux, pour 1 gemme) : reviens plus tard, ${next ? `joue plutot « ${next.nom} »` : 'reviens a la carte'}` : `combat trop dur pour l'instant (3 etoiles ${Math.round(pp.s3 * 100)} % au mieux) : reviens a la carte${next ? ` pour « ${next.nom} »` : ''}`, 'back-wall' + W.f.id);
                  if (pp && team.length === 3 && pp.t.every(id => team.includes(id))) return mark(btnText(/combattre/i), `equipe prete (${Math.round(pp.s3 * 100)} % de 3 etoiles) : clique sur Combattre`, 'go' + sig);
                  if (!pp && team.length === 3 && guideCheck.sig === sig && guideCheck.ok >= 0.95 && guideCheck.ok >= bestS3 - 0.02 && !xpSwap) return mark(btnText(/combattre/i), isEv ? `ton equipe gagne a ${Math.round(guideCheck.ok * 100)} % : clique sur Combattre` : `ton equipe fait 3 etoiles a ${Math.round(guideCheck.ok * 100)} % : clique sur Combattre`, 'go' + sig);
                  const want = pp ? pp.t : isEv ? (evRow?.equipe?.length ? evRow.equipe : null) : (next && W.f.id === next.id ? next.equipe : null) || lsGet('kitsu_ai_lastTeam', null);
                  if (want && (pp || !(team.length === 3 && guideCheck.ok == null && guideCheck.sig === sig))) {
                    const missing = want.filter(id => !team.includes(id)), extra = team.filter(id => !want.includes(id));
                    if (extra.length || missing.length) {
                      // Toutes les cartes a la fois : rouge = a retirer, vert = a ajouter, contour bleu = la prochaine a cliquer.
                      const findEl = (id, sels) => [...document.querySelectorAll(sels.map(x => x.replace('ID', id)).join(','))].find(vis);
                      const rmEls = extra.map(id => findEl(id, ['[data-unslot="ID"]', '.card[data-id="ID"].in', '[data-pick="ID"]', '.card[data-id="ID"]']));
                      const addEls = missing.map(id => findEl(id, ['[data-pick="ID"]', '.card[data-id="ID"]']));
                      const hidden = missing.filter((id, i) => !addEls[i]);
                      const search = [...document.querySelectorAll('input')].find(e => vis(e) && /recherch/i.test(e.placeholder || ''));
                      const firstEl = extra.length && team.length >= 3 ? rmEls[0] : (addEls.find(Boolean) || (hidden.length ? search : null) || rmEls[0]);
                      const txt = (pp ? 'equipe « A jouer » du panneau : ' : '') + [extra.length ? `<span style="color:#ff5f6d">retire ${extra.map(short).join(', ')}</span>` : '', missing.length ? `<span style="color:#2fd27a">ajoute ${missing.map(short).join(', ')}</span>` : ''].filter(Boolean).join(' puis ')
                        + (hidden.length ? ` · ${hidden.map(short).join(', ')} n'est pas a l'ecran : tape « ${short(hidden[0]).split(' ')[0]} » dans la recherche` : '')
                        + ` (equipe conseillee : ${want.map(short).join(', ')}${xpSwap ? ' : gagne aussi, et fait progresser ' + want.filter(id => xwG[id]).map(short).join(', ') : ''})`;
                      return mark(firstEl, txt + '<br><span style="font-size:11px;opacity:.8">Contour bleu clignotant : clique ici maintenant · vert : a ajouter ensuite · rouge : a retirer</span>', 'team' + extra.join() + '|' + missing.join() + '|' + hidden.length, [{ els: rmEls.filter(e => e !== firstEl), cls: 'kitsu-rm' }, { els: addEls.filter(e => e !== firstEl), cls: 'kitsu-add' }]);
                    }
                  }
                  const skipB = qv('input[data-skip-dlg]');
                  return mark(btnText(/combattre/i), `equipe prete : clique sur Combattre${skipB && !skipB.checked ? ' (astuce : coche « Passer les dialogues »)' : ''}`, 'go' + W.f.id);
                }
                // Recompenses a recuperer (gratuit) : connexion du jour, quetes, pass.
                const cl = claimActions(S).find(a => !(lsGet('kitsu_ai_snooze', {})[a.id] > Date.now()));
                if (cl) {
                  const b = [...document.querySelectorAll(cl.sel)].find(x => vis(x) && !x.disabled);
                  if (b) return mark(b, cl.txt, 'cl' + cl.id);
                  if (goView(cl.view, cl.txt, 'clnav' + cl.id)) return;
                  // Page Quetes : un hub a 3 cartes (Recompense quotidienne / Quetes / Parcours), puis la liste.
                  const qp = { streak: 'daily', quests: 'quests' }[cl.id];
                  if (qp) {
                    const card = [...document.querySelectorAll(`[data-qpage="${qp}"]`)].find(vis);
                    if (card) return mark(card, `${cl.txt} : ouvre « ${qp === 'daily' ? 'Recompense quotidienne' : 'Quetes'} »`, 'qp' + cl.id);
                    const back = [...document.querySelectorAll('[data-qpage="home"]')].find(vis);
                    if (back) return mark(back, `${cl.txt} : reviens au menu des quetes`, 'qph' + cl.id);
                  }
                  // Sur la bonne page mais bouton pas (encore) visible : on attend 8 s (chargement, onglet), puis on passe a la suite.
                  if (!window.__kitsuClWait || window.__kitsuClWait.id !== cl.id) window.__kitsuClWait = { id: cl.id, t: Date.now() };
                  if (Date.now() - window.__kitsuClWait.t < 8000) return mark(null, cl.txt + ' (chargement...)', 'clw' + cl.id);
                  snooze(cl.id, 10);
                }
                const qh = questHelpers(S).find(a => !(lsGet('kitsu_ai_snooze', {})[a.id] > Date.now()));
                if (qh) {
                  if (goView(qh.view, qh.txt, 'qnav' + qh.id)) return;
                  const el = qh.sel ? [...document.querySelectorAll(qh.sel)].find(vis) : null;
                  if (!window.__kitsuQh || window.__kitsuQh.id !== qh.id) window.__kitsuQh = { id: qh.id, t: Date.now() };
                  if (Date.now() - window.__kitsuQh.t > 90000) snooze(qh.id, 15); // 1 min 30 sur la page, puis on passe a la suite
                  return mark(el, qh.txt, 'q' + qh.id);
                }
                // Evenements : invocations gratuites, Salle de l'Esprit et du Temps, premieres victoires qui expirent.
                const evA = KitsuAI._evActions(S, en).find(a => (a.fight || !(lsGet('kitsu_ai_snooze', {})[a.id] > Date.now())) && (!a.cout || a.cout <= en));
                if (evA) {
                  const onEvents = location.hash.startsWith('#events');
                  const toEvents = why => onEvents ? null : goView('events', `${evA.txt}${why ? ' : ' + why : ''}`, 'evnav' + evA.id);
                  if (evA.id === 'packs' || evA.id === 'bells') {
                    if (evA.id === 'bells') { const b = [...document.querySelectorAll('[data-ev-bells]')].find(vis); if (b) return mark(b, evA.txt, 'bells'); const n = toEvents('ouvre Evenements'); if (n) return n; }
                    const go = [...document.querySelectorAll('[data-goto="invocation"]')].find(vis);
                    if (go) return mark(go, evA.txt, 'packs-go');
                    if (!/invocation|boosters/.test(location.hash)) return mark(qv('a[data-view="boosters"]'), evA.txt + ' : ouvre Bannieres, banniere Shonen', 'packs-nav');
                    const sh = [...document.querySelectorAll('button,a,[data-banner]')].find(e => vis(e) && /shonen/i.test(e.innerText || '') && !/x10/i.test(e.innerText || ''));
                    if (!/shonen/i.test(location.hash) && sh) return mark(sh, evA.txt + ' : choisis la banniere Shonen', 'packs-ban');
                    // x10 seulement s'il est actif (10 invocations disponibles), sinon x1 a repeter.
                    // Ecran de resultats d'invocation : ses propres boutons [data-reopen] (les [data-open] de la banniere sont dessous).
                    const pickB = n => [...document.querySelectorAll(`[data-reopen="${n}"]`)].find(e => vis(e) && !e.disabled) || [...document.querySelectorAll(`[data-open="${n}"]`)].find(e => vis(e) && !e.disabled && !document.querySelector('[data-reopen]'));
                    const x10 = pickB(10), x1 = pickB(1);
                    if (x10) return mark(x10, evA.txt + ' : multi-invocation x10', 'packs-open10');
                    if (x1) return mark(x1, evA.txt + ' : clique sur « Invoquer x1 » (une par une, le x10 demande 10 invocations)', 'packs-open1');
                    return mark(null, evA.txt, 'packs-open');
                  }
                  if (evA.id.startsWith('zeni-')) { const b = [...document.querySelectorAll(`[data-ev-buy="${evA.id.slice(5)}"]`)].find(vis); if (b) return mark(b, evA.txt, evA.id); const n = toEvents('ouvre Evenements, puis le Comptoir'); if (n) return n; return mark([...document.querySelectorAll('[data-evp-shop]')].find(vis) || null, evA.txt + ' : ouvre le Comptoir', 'shop' + evA.id); }
                  if (evA.id === 'scrolls') {
                    const b = [...document.querySelectorAll('[data-ev-use]')].find(vis); if (b) return mark(b, evA.txt, 'scrolls');
                    // Par la Collection : ouvrir la fiche de la carte cible.
                    const tg = scrollTarget(S);
                    if (tg) {
                      const c = [...document.querySelectorAll(`#view-collection .card[data-id="${tg}"]`)].find(vis);
                      if (c) return mark(c, `${evA.txt} : ouvre la fiche de ${short(tg)}`, 'sccard' + tg);
                      if (location.hash.split('/')[0] === '#collection') { const q = [...document.querySelectorAll('input[type="search"],input')].find(e => vis(e) && /recherch/i.test(e.placeholder || '')); return mark(q || null, `${evA.txt} : cherche « ${short(tg).split(' ')[0]} » dans la Collection`, 'scsearch' + tg); }
                      if (goView('collection', `${evA.txt} : ouvre Collection`, 'scnav')) return;
                    }
                  }
                  else if (evA.id.startsWith('sbc-')) { const b = [...document.querySelectorAll(`[data-sbc-open="${evA.id.slice(4)}"]`)].find(vis); if (b) return mark(b, evA.txt, evA.id); const n = toEvents('ouvre Evenements, section Defis de doublons'); if (n) return n; }
                  else if (evA.fight) {
                    const r = evA.fight;
                    const n = toEvents('ouvre Jouer, puis Evenements'); if (n) return n;
                    if (r.salle) {
                      const b = [...document.querySelectorAll(`[data-salle-fight="${r.kind}"]`)].find(vis);
                      if (b) return mark(b, evA.txt, 'salle' + r.id);
                      // La Salle est une carte d'evenement a part : on l'ouvre d'abord.
                      const ft = [...document.querySelectorAll(`[data-evp-feat="${r.evId}"],[data-evp-feat="ev-salle"]`)].find(vis);
                      if (ft) return mark(ft, `${evA.txt} : ouvre la carte « Salle de l'Esprit et du Temps »`, 'sallef' + r.id);
                      return mark(null, evA.txt + ' : fais defiler jusqu\'a la Salle', 'salle' + r.id);
                    }
                    const dsel = `[data-evp-diff="${r.evId}|${r.kind}|${r.d}"]`, db = [...document.querySelectorAll(dsel)].find(vis);
                    if (!db) { const ft = [...document.querySelectorAll(`[data-evp-feat="${r.evId}"]`)].find(vis); return mark(ft || null, `${evA.txt} : ouvre l'evenement ${r.titre}`, 'feat' + r.id); }
                    if (!db.classList.contains('on')) return mark(db, `${evA.txt} : choisis ${r.diff}`, 'diff' + r.id);
                    const go = [...document.querySelectorAll(`[data-ev-fight="${r.evId}|${r.kind}|${r.d}"]`)].find(b => vis(b) && !b.disabled) || db.closest('.evx-act')?.querySelector('[data-ev-fight],[data-evp-go]');
                    return mark(go || null, `${evA.txt} : clique sur Combattre`, 'evgo' + r.id);
                  }
                }
                // Guilde : raid Pain et boss de la semaine (essais du jour), avec l'equipe calculee dans la roadmap.
                if (!T && Date.now() - (window.__kitsuGuildT || 0) > 5 * 60000) { window.__kitsuGuildT = Date.now(); KitsuAI.guildRefresh().catch(() => {}); }
                const gA = KitsuAI._guildActions().find(a => !(lsGet('kitsu_ai_snooze', {})[a.id] > Date.now()));
                if (gA && gA.kind === 'claim') {
                  const b = [...document.querySelectorAll(gA.btn)].find(e => vis(e) && !e.disabled);
                  if (b) return mark(b, gA.txt, gA.id + 'btn');
                  const any = [...document.querySelectorAll(gA.btn)].find(vis);
                  if (any) { snooze(gA.id, 30); window.__kitsuGuildT = 0; }
                  else {
                    const tab = [...document.querySelectorAll(`[data-gtab="${gA.tab}"]`)].find(vis);
                    if (tab?.classList.contains('on')) { snooze(gA.id, 10); window.__kitsuGuildT = 0; }
                    else if (tab) return mark(tab, `${gA.txt} : onglet « ${(tab.innerText || '').trim()} »`, gA.id + 'tab');
                    if (tab) {} else {
                    const stab = [...document.querySelectorAll('[data-stab="guild"]')].find(vis);
                    if (stab) return mark(stab, `${gA.txt} : ouvre l'onglet « Guilde »`, gA.id + 'stab');
                    if (goView('social', gA.txt, gA.id + 'nav')) return;
                    snooze(gA.id, 15);
                    }
                  }
                } else if (gA) {
                  const pre = gA.kind, cards = [...document.querySelectorAll(`[data-${pre}="card"]`)].filter(vis);
                  if (cards.length) {
                    const on = cards.filter(c => c.classList.contains('on')).map(c => +c.dataset.id);
                    const extra = on.filter(id => !gA.team.includes(id)), missing = gA.team.filter(id => !on.includes(id));
                    if (extra.length || missing.length) {
                      const byId = id => cards.find(c => +c.dataset.id === id), rmEls = extra.map(byId), addEls = missing.map(byId);
                      const first = extra.length && on.length >= 3 ? rmEls[0] : (addEls.find(Boolean) || rmEls[0]);
                      return mark(first, `${gA.txt} : ${[extra.length ? 'retire ' + extra.map(short).join(', ') : '', missing.length ? 'ajoute ' + missing.map(short).join(', ') : ''].filter(Boolean).join(' puis ')}`, 'g' + pre + extra.join() + missing.join(), [{ els: rmEls.filter(e => e && e !== first), cls: 'kitsu-rm' }, { els: addEls.filter(e => e && e !== first), cls: 'kitsu-add' }]);
                    }
                  }
                  const go = [...document.querySelectorAll(`[data-${pre}="go"]`)].find(b => vis(b) && !b.disabled);
                  if (go && (cards.length || !qv(`[data-${pre}="pick"]`))) return mark(go, `${gA.txt} : attaque`, 'g' + pre + 'go');
                  // Equipe deja en place (noms affiches sous « Ton equipe ») : on va directement sur Attaquer.
                  const shown = (qv('.gp-team')?.innerText || '').toLowerCase(), teamOk = shown && gA.team.every(id => shown.includes(short(id).toLowerCase().slice(0, 9)));
                  // Plus d'essai aujourd'hui (bouton Attaquer absent ou desactive) : pause jusqu'a minuit, donnees de guilde rafraichies.
                  const noTry = !go && (qv(`[data-${pre}="pick"]`) || cards.length) && ([...document.querySelectorAll(`[data-${pre}="go"]`)].some(vis) || /plus d.essai|reviens demain/i.test((qv('.gp-team')?.closest('section') || document.getElementById('social'))?.innerText || ''));
                  if (noTry) { const m = new Date(); m.setHours(24, 0, 30, 0); const sz = lsGet('kitsu_ai_snooze', {}); sz[gA.id] = m.getTime(); lsSet('kitsu_ai_snooze', sz); window.__kitsuGuildT = 0; return mark(null, `${gA.txt.split(' (')[0]} : plus d'essai aujourd'hui, reviens apres minuit`, 'g' + pre + 'none'); }
                  if (cards.length && !go) { const cl = [...document.querySelectorAll(`[data-${pre}="pick"]`)].find(vis); if (cl) return mark(cl, `${gA.txt} : equipe en place, clique sur « ${(cl.innerText || '').trim()} »`, 'g' + pre + 'close'); }
                  if (go && teamOk) return mark(go, `${gA.txt} : equipe ${gA.team.map(short).join(', ')} en place, attaque`, 'g' + pre + 'go3');
                  const pick = [...document.querySelectorAll(`[data-${pre}="pick"]`)].find(b => vis(b) && !b.disabled);
                  if (pick) return mark(pick, `${gA.txt} : change l'equipe pour ${gA.team.map(short).join(', ')}`, 'g' + pre + 'pick');
                  if (go) return mark(go, `${gA.txt} : attaque`, 'g' + pre + 'go2');
                  const tab = [...document.querySelectorAll(`[data-gtab="${pre === 'pain' ? 'pain' : 'boss'}"]`)].find(vis);
                  if (tab) return mark(tab, gA.txt, 'g' + pre + 'tab');
                  const stab = [...document.querySelectorAll('[data-stab="guild"]')].find(vis);
                  if (stab) return mark(stab, `${gA.txt} : ouvre l'onglet « Guilde »`, 'g' + pre + 'stab');
                  if (goView('social', gA.txt, 'g' + pre + 'nav')) return;
                  snooze(gA.id, 15);
                }
                // Reflexes economie (achat d'energie, invocation) : proposes hors ecran d'equipe, mis en pause 20 min
                // si tu enchaines quand meme un combat.
                const ecoList = econActions(S, todo.length);
                const eco = ecoList.find(a => !(lsGet('kitsu_ai_snooze', {})[a.id] > Date.now()));
                if (eco) {
                  {
                    if (eco.id === 'shop-en') {
                      const b = [...document.querySelectorAll('[data-ds-buy="en"]')].find(vis);
                      if (b) return mark(b, eco.txt, 'eco-en');
                      if (goView('shop', eco.txt + ' : ouvre la Boutique (icone en haut)', 'eco-nav')) return;
                      snooze(eco.id, 10);
                    }
                    if (eco.id.startsWith('shop-') && eco.slot) {
                      const b = [...document.querySelectorAll(`[data-ds-buy="${eco.slot}"]`)].find(x => vis(x) && !x.disabled);
                      if (b) return mark(b, eco.txt, 'eco-' + eco.slot);
                      if (goView('shop', eco.txt + ' : ouvre la Boutique (icone en haut)', 'eco-nav' + eco.slot)) return;
                      snooze(eco.id, 10);
                    }
                    if (eco.id === 'pull') {
                      if (!/invocation|boosters/.test(location.hash)) return mark(qv('a[data-view="boosters"]'), eco.txt + ' : ouvre Bannieres', 'eco-nav');
                      const slug = (eco.banner || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
                      if (slug && !location.hash.includes(slug)) { const sel = [...document.querySelectorAll('button,a,[data-banner]')].find(e => vis(e) && (e.innerText || '').trim().toLowerCase().startsWith((eco.banner || '').toLowerCase())); return mark(sel || null, `${eco.txt} : choisis la banniere ${eco.banner}`, 'eco-ban'); }
                      return mark([...document.querySelectorAll('[data-open="10"]')].find(e => vis(e) && !e.disabled) || qv('[data-open="1"]'), eco.txt, 'eco-pull');
                    }
                  }
                }
                // Energie vide : recharger si rentable, sinon attendre
                if (en <= 0) {
                  if ((S.ki || 0) >= 15 && todo.some(r => !r.farm)) return mark(qv('[data-en-refill]'), 'energie vide : clique sur « + » a cote de la jauge d\'energie pour recharger (15 gemmes, ~+15 gemmes nettes)', 'refill');
                  const pulls = lsGet(LS.pulls, null);
                  if (econActions(S, 0).some(a => a.id === 'pull')) {
                    if (!/invocation|boosters/.test(location.hash)) return mark(qv('a[data-view="boosters"]'), `invoque x10 sur ${pulls.banners[0].banniere} : ouvre Bannieres`, 'nav-b');
                    return mark(qv('[data-open="10"]'), `multi-invocation x10 sur ${pulls.banners[0].banniere}`, 'pull');
                  }
                  return mark(null, 'energie vide : reviens dans ~10 min (1 energie toutes les 10 min)');
                }
                if (!next) return mark(null, 'plus de combat facile disponible : voir la roadmap');
                lsSet('kitsu_ai_lastTeam', next.equipe);
                // Navigation vers l'etape conseillee.
                // Sur la carte d'un monde : on prend le meilleur combat de CE monde qui est visible a l'ecran (etape ou
                // bouton de mode de l'arc affiche). On ne renvoie jamais a la liste des mondes si le monde est le bon.
                const worldOf = id => id.split('-')[0];
                const arcIdx = id => { const base = G.findFight(id.split('@')[0]); const w = G.ALL_WORLDS.find(x => x.id === worldOf(id)); if (!base || !w) return -1; const arcs = [...new Set(w.fights.map(f => f.arc))]; return arcs.indexOf(base.arc); };
                const modeOf = id => { const suf = id.split('@')[1] || ''; return { nm: suf.endsWith('n'), lvl: suf[0] === 'h' ? 1 : suf[0] === 'x' ? 2 : 0 }; };
                const visNode = id => [...document.querySelectorAll(`button.node[data-fight="${id}"]`)].find(vis);
                const visMode = id => { const a = arcIdx(id), m = modeOf(id); const btn = [...document.querySelectorAll(`[data-arc-mode="${a}|${m.lvl}"]`)].find(vis); const nmb = m.nm ? [...document.querySelectorAll(`[data-arc-nm="${a}"]`)].find(vis) : null; return { btn, nmb, m }; };
                const shownNodes = [...document.querySelectorAll('button.node[data-fight]')].filter(vis).map(e => e.dataset.fight);
                const curWorld = shownNodes.length ? worldOf(shownNodes[0]) : null;
                const wname = id => (G.ALL_WORLDS.find(x => x.id === worldOf(id))?.name) || worldOf(id);
                if (curWorld) {
                  const here = todo.filter(r => worldOf(r.id) === curWorld);
                  for (const r of here) {
                    const n = visNode(r.id);
                    if (n) return mark(n, r.farm ? `rejoue « ${r.nom} » pour l'XP : +${r.xp} XP a chaque carte, ${r.cout} energie (equipe : ${r.equipe.map(short).join(', ')})` : `lance « ${r.nom} » (${r.etoiles}/3 etoiles, 3 etoiles ${Math.round(r.troisEtoiles * 100)} %)`, 'node' + r.id);
                    if (r.id.includes('@')) {
                      const { btn, nmb, m } = visMode(r.id);
                      if (m.nm && nmb && (nmb.classList.contains('locked') || nmb.getAttribute('aria-disabled') === 'true')) { continue; }
                      if (m.nm && nmb && !nmb.classList.contains('on')) return mark(nmb, `passe cet arc en Cauchemar pour « ${r.nom} »`, 'nm' + r.id);
                      if (btn && !btn.classList.contains('on') && !btn.classList.contains('locked')) return mark(btn, `passe cet arc en ${['Normal', 'Difficile', 'Extreme'][m.lvl]} pour « ${r.nom} »`, 'mode' + r.id);
                    }
                  }
                  if (here.length) { const r = here[0], base = G.findFight(r.id.split('@')[0]); return mark(null, `fais defiler la carte jusqu'a l'arc « ${base?.arc || '?'} » pour « ${r.nom} »`, 'scroll' + r.id); }
                  const back = [...document.querySelectorAll('[data-back-worlds]')].find(vis);
                  return mark(back || null, `plus rien a faire ici : retourne aux mondes pour « ${next.nom} » (${wname(next.id)})`, 'back');
                }
                const wb = [...document.querySelectorAll(`button.world[data-world="${worldOf(next.id)}"]`)].find(vis);
                if (wb) return mark(wb, `ouvre ${wname(next.id)} pour « ${next.nom} »`, 'world' + next.id);
                return goView('adventure', `ouvre Aventure pour « ${next.nom} »`, 'nav-adv') || mark(null, `fais defiler jusqu'au monde ${wname(next.id)} pour « ${next.nom} »`, 'nav-w');
              } catch (e) { pill.textContent = 'Guide : ' + e.message; health.err('guide : ' + e.message); }
            }, 500);
            return 'guide actif';
          },


          // Evenement en cours : pour chaque combat pas encore gagne, chances de victoire de la meilleure equipe
          // (en cache, recalcule quand ta collection, tes niveaux ou tes victoires changent).
          async events(force = false) {
            await loadModules();
            const S = save(), now = Date.now(), evs = openEvents(now);
            const key = evs.map(e => e.id).join(',') + '|' + Object.keys(S.ev?.clear || {}).sort().join(',') + '|' + pool(8, S).map(id => id + ':' + Math.floor((S.lv?.[id]?.l || 1) / 3)).join(',');
            const c0 = lsGet('kitsu_ai_events', null);
            if (!force && c0 && c0.key === key && now - c0.t < 6 * 3600000) return c0;
            if (this._evBusy) return c0; this._evBusy = true;
            try {
              const list = [];
              for (const e of [SALLE, ...evs]) {
                for (const x of evFightsOf(e)) {
                  const done = !!S.ev?.clear?.[x.id], ev = x.f.event || {};
                  const row = { id: x.id, evId: e.id, titre: e.title, nom: x.f.t, kind: x.kind, d: x.d, diff: EV_DIFF[x.d], cout: x.f.cost || x.d + 1, gemmes: done ? 0 : (ev.first || 0), drop: ev.drop || 0, fait: done, fin: e.banner?.until || null };
                  const salle = e.id === 'ev-salle'; row.salle = salle; if (salle) row.titre = SALLE.title;
                  try { row.xpCarte = Math.round(G.fightXp(x.f) * (salle ? 10 : 0.6)); } catch { row.xpCarte = 0; }
                  if (salle) { const g = x.kind === 'boss' ? SALLE.boss.give : {}; row.gain = g; row.xpParchemins = (g.s || 0) * 500; }
                  else if (x.kind === 'farm') { const g = e.farm?.give?.[x.d] || {}; row.gain = g; row.xpParchemins = Object.entries(g).reduce((a, [k, v]) => a + (SCROLL_XP[k] || 0) * v, 0); }
                  else row.cartes = (e.banner?.pool?.E || []).slice(0, 6);
                  if (!done || x.kind === 'farm' || salle) {
                    const res = await this._rankTeams(x.id, S);
                    const xw = xpWeights(), best = res.slice().sort((a, b) => (b.w >= 0.95 && a.w >= 0.95 ? 0 : b.w - a.w) || xpScore(b.t, xw) - xpScore(a.t, xw) || b.w - a.w)[0];
                    row.victoire = best ? +best.w.toFixed(2) : 0; row.equipe = best ? best.t : [];
                  }
                  list.push(row);
                  await idle();
                }
              }
              const res = { key, t: now, combats: list };
              lsSet('kitsu_ai_events', res);
              return res;
            } finally { this._evBusy = false; }
          },
          // Actions "evenements" du moment, par priorite : ce qui se perd (invocations gratuites pleines, essais du jour
          // de la Salle, premieres victoires d'un evenement qui se termine) passe avant la campagne.
          _evActions(S = save(), en = 99) {
            const out = [], now = Date.now(), E = lsGet('kitsu_ai_events', null), rows = E?.combats || [];
            const pk = packsNow(S, now);
            if (pk.v >= pk.cap - 2 || (pk.v > 0 && /invocation\/shonen/.test(location.hash))) out.push({ id: 'packs', prio: 0, txt: pk.v >= pk.cap - 2 ? `${pk.v}/${pk.cap} invocations Shonen gratuites : utilise-les (pleines, elles ne se rechargent plus)` : `encore ${pk.v} invocation${pk.v > 1 ? 's' : ''} Shonen gratuite${pk.v > 1 ? 's' : ''} : utilise-les toutes` });
            if ((S.ev?.bells || 0) >= 20) out.push({ id: 'bells', prio: 1, txt: `${S.ev.bells} clochettes : echange-les contre une invocation Shonen` });
            const mon = S.ev?.mon || 0, bought = k => { const b = S.ev?.buy?.[k]; return typeof b === 'number' ? b : (b?.n || 0); }, c = COMPTOIR.find(o => mon >= o.prix && !(o.id === 'energy' && bought('energy') >= 3));
            if (c) out.push({ id: 'zeni-' + c.id, prio: 2, txt: `Comptoir : ${mon} Zeni, achete ${c.txt} (${c.prix} Zeni)` });
            for (const r of rows.filter(r => r.salle).sort((a, b) => (b.kind === 'boss') - (a.kind === 'boss'))) {
              const left = evTries(S, r.id);
              if (left > 0 && (r.victoire || 0) >= 0.85) out.push({ id: 'ev:' + r.id, prio: 3, fight: r, cout: r.cout, txt: `Salle de l'Esprit et du Temps : ${r.nom} (${left}/3 essais, ${r.cout} energie, +${r.xpCarte} XP par carte${r.gain?.s ? ' + 2 petits parchemins' : ''}${!S.ev?.clear?.[r.id] && r.gemmes ? `, +${r.gemmes} gemmes` : ''})` });
            }
            const nx = this._evNext(S, en);
            if (nx) { const h = nx.fin ? (nx.fin - now) / 3600000 : 99; out.push({ id: 'ev:' + nx.id, prio: 4, fight: nx, cout: nx.cout, txt: `Evenement ${nx.titre} : ${nx.kind === 'boss' ? 'boss' : 'entrainement'} ${nx.diff}, premiere victoire +${nx.gemmes} gemmes (victoire ${Math.round(nx.victoire * 100)} %, fin dans ${h < 24 ? Math.round(h) + ' h' : Math.round(h / 24) + ' j'})` }); }
            const sc = evScrolls(S);
            if (sc.n) out.push({ id: 'scrolls', prio: 6, txt: `${sc.n} parchemin${sc.n > 1 ? 's' : ''} d'XP (${sc.xp} XP) : donne-les a ${scrollTarget(S) ? short(scrollTarget(S)) : 'la carte la plus basse de ton equipe'}${planXp(S) ? ` (plan d'XP : ${planXp(S).raison})` : ''}` });
            for (const d of sbcState(S).filter(d => d.pret)) out.push({ id: 'sbc-' + d.key, prio: 2, txt: `Defi de doublons : ${d.txt} (tu en as ${d.have})` });
            return out.sort((a, b) => a.prio - b.prio);
          },
          // Prochaine action evenement conseillee : premiere victoire gagnable (elle expire avec la banniere).
          _evNext(S = save(), en = 99) {
            const E = lsGet('kitsu_ai_events', null); if (!E) return null;
            const now = Date.now();
            const firsts = E.combats.filter(r => !r.fait && !S.ev?.clear?.[r.id] && r.gemmes > 0 && (r.victoire || 0) >= 0.8 && (!r.fin || r.fin > now) && evTries(S, r.id) > 0)
              .sort((a, b) => (b.victoire >= 0.95) - (a.victoire >= 0.95) || b.gemmes / b.cout - a.gemmes / a.cout || a.cout - b.cout);
            const r = firsts.find(x => x.cout <= en) || null;
            return r ? { ...r, attente: false } : (firsts[0] ? { ...firsts[0], attente: true } : null);
          },

          // ---------- Roadmap de connexion ----------
          // Priorites calculees a chaque connexion : quetes a recuperer, energie, recharge, combats, invocation, guilde, murs.
          async roadmap() {
            await loadModules();
            const S = save(), now = Date.now(), items = [];
            const add = (prio, txt) => items.push({ prio, txt });
            // Quetes
            for (const k of ['daily', 'weekly', 'pass', 'event', 'story']) {
              let defs = []; try { defs = G.questList(k, now) || []; } catch {}
              const q = S.quests?.[k] || {};
              for (const d of defs) {
                if (q.ids && !q.ids.includes(d.id)) continue;
                const p = questProg(d, q, S);
                if (p >= d.goal && !q.claimed?.[d.id]) add(1, `Recupere la quete « ${d.t} »`);
              }
            }
            const wk = S.quests?.weekly || {};
            let wdefs = []; try { wdefs = G.questList('weekly', now) || []; } catch {}
            for (const d of wdefs) if (wk.ids?.includes(d.id) && !wk.claimed?.[d.id] && (wk.prog?.[d.id] || 0) < d.goal) add(6, `Hebdo : ${d.t} (${wk.prog?.[d.id] || 0}/${d.goal})`);
            if ((S.pass?.xp || 0) > 0) add(2, `Pass de combat : ${S.pass.xp} XP, verifie les paliers a recuperer`);
            // Energie et gemmes
            let en = S.energy?.v ?? 0, enMax = 10; try { en = G.energy(S, now).v; enMax = G.enMax(S, now); } catch {}
            const gems = S.ki || 0;
            let P = lsGet('kitsu_ai_plan', null);
            if (!P) P = await this.plan();
            else if (Date.now() - P.t > 10 * 60000) setTimeout(() => this.plan().catch(() => {}), 3000);
            const todo = P.combats.filter(r => worthNow(r, S));
            const later = P.combats.filter(r => r.victoire >= 0.9 && (S.pve?.stars?.[r.id] || 0) > 0 && (S.pve?.stars?.[r.id] || 0) < 3 && (r.troisEtoiles < 0.9 || realMiss(r.id) > 0));
            if (later.length) add(8, `A reprendre plus tard pour la 3e etoile (pas assez sur aujourd'hui) : ${later.slice(0, 4).map(r => `${r.nom} (${S.pve.stars[r.id]}/3, 3 etoiles ${Math.round(r.troisEtoiles * 100)} %${realMiss(r.id) ? `, rate ${realMiss(r.id)} fois aujourd'hui` : ''})`).join(' ; ')}`);
            if (en > 0 && todo.length) add(3, `Joue ${Math.min(en, todo.length)} combat${en > 1 ? 's' : ''} (${en}/${enMax} energie) : ${todo.slice(0, Math.min(en, 4)).map(r => `${r.nom} avec ${r.equipe.map(short).join(', ')}`).join(' ; ')}`);
            if (en >= enMax) add(2, `Energie pleine : elle ne se recharge plus, joue maintenant`);
            else add(8, `Energie pleine dans ~${(enMax - en) * 10} min`);
            if (en === 0 && gems >= 15 && todo.length) add(3, `Recharge l'energie (15 gemmes) : 10 combats a 3 etoiles rapportent ~30 gemmes, soit +15 net`);
            // Invocation : garder 15 gemmes pour une recharge, tirer par 10 sur la meilleure banniere
            const pulls = lsGet(LS.pulls, null), bb = pulls?.banners?.[0];
            const pullA = econActions(S, 99).find(a => a.id === 'pull');
            if (pullA) add(4, pullA.txt);
            else add(7, `Gemmes : ${gems}. Garde-les (LR de la boutique du jour a 1 500, ou une LR garantie atteignable) ; les invocations Shonen gratuites suffisent pour tirer`);
            // Guilde : raid Pain
            try {
              const r = await fetch('/api/guilds/pain', { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } });
              if (r.ok) {
                const g = await r.json();
                if (g.event?.open && g.me?.left > 0) {
                  const lvOf = id => S.lv?.[id]?.l || 1, pol = smartPol(this.W);
                  const elig = pool(12, S).filter(id => lvOf(id) >= (g.event.minLv || 15));
                  let best = null;
                  for (const t of trios(elig.slice(0, 12))) {
                    let d = 0;
                    for (const sd of [1, 2]) {
                      const { st, hp0 } = G.setupPain(g.boss.lv, g.boss.hp, t.map(id => ({ id, lv: lvOf(id), stars: S.stars?.[id] || 0 })), sd);
                      for (let i = 0; i < 400 && st.cycle <= (g.event.turns || 12); i++) { const u = step(st); if (!u || st.cycle > (g.event.turns || 12)) break; doAct(st, u, pol(st, u)); }
                      d += hp0 - B.enemies(st)[0].hp;
                    }
                    if (!best || d > best.d) best = { t, d: d / 2 };
                    await idle();
                  }
                  add(3, `Guilde : raid Pain ouvert, ${g.me.left} essai${g.me.left > 1 ? 's' : ''}. Equipe : ${best.t.map(short).join(', ')} (~${Math.round(best.d)} degats)`);
                  lsSet('kitsu_ai_pain', { t: Date.now(), team: best.t });
                }
              }
            } catch {}
            // Echeances : bannieres qui se terminent (la progression vers la LR garantie est propre a chaque banniere).
            for (const b of G.BANNERS || []) {
              if (!b.until || b.until < now) continue;
              const h = (b.until - now) / 3600000; if (h > 96) continue;
              const pity = S.pity?.[b.series] || 0, pmax = (() => { try { return G.pityMax(b); } catch { return 50; } })();
              const best = pulls?.banners?.[0]?.banniere === b.series;
              if (pity > 0 || best) {
                const need = (pmax - pity) * GEMS_PER_PITY;
                add(best ? 2 : 6, `Banniere ${b.series} : fin dans ${h < 24 ? Math.round(h) + ' h' : Math.round(h / 24) + ' j'} (${new Date(b.until).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}). Garantie LR a ${pmax} points (1 point = 10 tirages) : ${pity}/${pmax}, encore ${need} gemmes (tu en as ${gems}).${best ? ' Vise-la.' : ' Ta progression y sera perdue.'}`);
              }
            }
            // Evenements, Salle, invocations gratuites, Comptoir, defis de doublons
            try {
              let E = lsGet('kitsu_ai_events', null); if (!E) E = await this.events();
              for (const a of this._evActions(S, en)) add(a.prio <= 1 ? 1 : a.prio <= 3 ? 2 : 3, a.txt);
              const pk = packsNow(S, now); if (pk.v < pk.cap - 2) add(8, `Invocations Shonen gratuites : ${pk.v}/${pk.cap}, pleines dans ~${pk.fullIn} min`);
              const left = (E?.combats || []).filter(r => !r.salle && !r.fait && !S.ev?.clear?.[r.id] && r.gemmes > 0);
              const lose = left.filter(r => (r.victoire || 0) < 0.8);
              if (lose.length) add(7, `Evenement : ${lose.map(r => `${r.kind === 'boss' ? 'boss' : 'entrainement'} ${r.diff} (${Math.round((r.victoire || 0) * 100)} %)`).join(', ')} hors de portee pour l'instant`);
              for (const d of sbcState(S).filter(d => !d.pret && d.left > 0 && d.have > 0)) add(9, `Defi de doublons : ${d.txt}, tu en as ${d.have}/${d.n} (garde tes doublons ${d.r === 'E' ? 'SSR' : d.r === 'L' ? 'UR' : 'LR'} pour ca)`);
            } catch (e) { health.err('evenements : ' + e.message); }
            // Doublons et etoiles : chaque etoile = +2 % ATK/DEF (7 max) ; au-dela, un doublon donne des parchemins d'XP.
            const team = (P.combats[0]?.equipe) || [];
            const dups = Object.entries(S.owned || {}).filter(([, n]) => n > 1).map(([id, n]) => ({ id: +id, n, st: S.stars?.[id] || 0 }));
            for (const d of dups) {
              const inTeam = team.includes(d.id), maxed = d.st >= 7;
              add(inTeam ? 4 : 7, `Doublon : ${short(d.id)} x${d.n} : ${maxed ? 'deja 7 etoiles, la fusion donnera des parchemins d\'XP' : inTeam ? `fusionne-le (+1 etoile = +2 % de stats sur une carte de ton equipe)` : (['E', 'L', 'M'].includes(window.CHAR_BY_ID?.[d.id]?.r) ? 'garde-le pour les defis de doublons (onglet Evenements)' : 'fusionne-le si tu as la quete « Fusionne un doublon », sinon garde-le pour le marche')}`);
            }
            // Guilde : boss de la semaine (essais quotidiens, contribution, defis)
            try {
              const r = await fetch('/api/guilds/week', { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } });
              if (r.ok) {
                const g = await r.json();
                const gwKey = g.boss ? [g.boss.id, g.boss.lv, Math.round(g.boss.hp / 1e5), pool(6, S).map(id => S.lv?.[id]?.l || 1).join('.')].join('|') : '';
                const gwCache = lsGet('kitsu_ai_gw', null);
                if (g.me?.guild && g.boss && g.me.tries?.boss?.left > 0 && gwCache?.team?.length === 3 && (gwCache.key === gwKey || gwCache.bkey === g.boss.id + '|' + g.boss.lv)) add(3, `Guilde : boss ${g.boss.name}, ${g.me.tries.boss.left} essai${g.me.tries.boss.left > 1 ? 's' : ''} aujourd'hui (sans energie). Equipe : ${gwCache.team.map(short).join(', ')}${gwCache.d ? ` (~${gwCache.d} degats)` : ''}`);
                else if (g.me?.guild && g.boss && g.me.tries?.boss?.left > 0) {
                  const lvOf = id => S.lv?.[id]?.l || 1, pol = smartPol(this.W), turns = g.week?.turns || 12;
                  const elig = pool(12, S).filter(id => lvOf(id) >= (g.week?.minLv || 15));
                  let best = null;
                  for (const t of trios(elig.slice(0, 10))) {
                    let d = 0;
                    for (const sd of [1, 2, 3]) {
                      const { st, hp0 } = G.setupGwBoss(g.boss.id, g.boss.lv, g.boss.hp, t.map(id => ({ id, lv: lvOf(id), stars: S.stars?.[id] || 0 })), sd);
                      for (let i = 0; i < 500 && st.cycle <= turns; i++) { const u = step(st); if (!u || st.cycle > turns) break; doAct(st, u, pol(st, u)); }
                      d += hp0 - B.enemies(st)[0].hp;
                    }
                    if (!best || d > best.d) best = { t, d: d / 3 };
                    await idle();
                  }
                  if (best) { const txt = `Guilde : boss ${g.boss.name}, ${g.me.tries.boss.left} essai${g.me.tries.boss.left > 1 ? 's' : ''} aujourd'hui. Equipe : ${best.t.map(short).join(', ')} (~${Math.round(best.d)} degats, minimum ${g.week?.minDmg || 1000})`; add(3, txt); { const old = lsGet('kitsu_ai_gw', null); if (!(old?.team && old.bkey === g.boss.id + '|' + g.boss.lv)) lsSet('kitsu_ai_gw', { key: gwKey, bkey: g.boss.id + '|' + g.boss.lv, d: Math.round(best.d), txt, team: best.t }); } }
                }
                const gi = guildInfo(g), fmtD = t => new Date(t).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                if (gi.chalPts + gi.chestPts > 0) {
                  if (gi.ok) add(1, `Guilde : recupere ${gi.chalPts ? `les defis (+${gi.chalPts} points)` : ''}${gi.chalPts && gi.chestPts ? ' et ' : ''}${gi.chestPts ? `le coffre (+${gi.chestPts} points)` : ''}`);
                  else if (gi.eligAt < gi.weekEnd) add(4, `Guilde : ${gi.chalPts + gi.chestPts} points (defis + coffre) bloques : il faut etre dans la guilde depuis 3 jours${gi.contributed ? '' : ' et avoir livre au moins 1 combat cette semaine'}. Reclamables ${fmtD(gi.eligAt)}, avant le reset ${fmtD(gi.weekEnd)}.`);
                  else add(7, `Guilde : defis et coffre de cette semaine perdus (3 jours dans la guilde atteints ${fmtD(gi.eligAt)}, apres le reset). Ce sera bon la semaine prochaine.`);
                }
                if (g.boss && gi.capLeft > 0) { const per = lsGet('kitsu_ai_gw', null)?.d || 0; if (per) add(6, `Guilde : boss = 1 point par 2 500 degats, ${gi.cap} max par semaine (${gi.weekPts}/${gi.cap}). A ~${per} degats par essai, il te faut ${Math.ceil(gi.capLeft * 2500 / Math.min(per, 300000))} essais pour le plafond (3 par jour).`); }
                const buy = gi.buy; if (buy) add(5, `Boutique de guilde : achete ${buy.nom} (${buy.price} points, tu en as ${gi.pts})`);
                else if (gi.shopNext) add(8, `Boutique de guilde : ${gi.pts} points. Priorite : ${gi.shopNext}`);
                if (g.me?.tries?.war?.left > 0 && g.rivalry?.active) add(5, `Guilde : ${g.me.tries.war.left} combat${g.me.tries.war.left > 1 ? 's' : ''} de guerre disponibles`);
              }
            } catch {}
            // Boutique du jour et plan d'entrainement (resultats en cache, recalcules en fond s'ils sont perimes)
            const shop = lsGet('kitsu_ai_shop', null);
            if (shop && shop.day === S.dshop?.day) for (const o of shop.offres) if (o.verdict === 'acheter' && !S.dshop?.bought?.[o.slot] && gems >= o.prix) add(o.slot === 'en' ? 3 : 4, `Boutique : achete ${o.quoi} pour ${o.prix} gemmes (${o.pourquoi})`);
            if (!shop || shop.day !== S.dshop?.day) setTimeout(() => this.shops().catch(() => {}), 4000);
            const tr = lsGet('kitsu_ai_training', null);
            if (tr?.objectif) { const o = tr.objectif; add(4, `Equipe cible : ${o.equipe.map(short).join(', ')} (a niveau ${o.niveau} : ${o.victoires}/${o.sur} combats Extreme, contre ${o.actuelle} pour ton equipe actuelle).${o.retard.length ? ` Monte ${o.retard.map(c => `${c.nom} (niv ${S.lv?.[c.id]?.l || c.niveau} -> ${o.niveau})`).join(', ')} : mets-le dans la Salle de l'Esprit et du Temps.` : ''}`); }
            if (tr?.cartes?.length) { const c = tr.cartes[0]; add(5, `Entraine ${c.nom} : niveau ${c.niveau} -> ${c.cible} (~${c.combats} combats, ${c.xp} XP), en le faisant porter par ${c.trio.filter(id => id !== c.id).map(short).join(' et ')} ; +${c.gain} victoires sur les boss a venir`); }
            if (!tr || Date.now() - tr.t > 6 * 3600000) setTimeout(() => this.training().catch(() => {}), 8000);
            // Murs a venir
            const wall = P.avenir?.[0];
            let eta = '';
            try {
              const hist = lsGet('kitsu_ai_lvhist', []), h0 = hist[0];
              if (wall?.niveauxEnPlus && h0 && Date.now() - h0.t > 6 * 3600000) {
                const days = (Date.now() - h0.t) / 86400000, rate = wall.equipe.reduce((a, id) => a + Math.max(0, (S.lv?.[id]?.l || 1) - (h0.lv[id] || S.lv?.[id]?.l || 1)), 0) / wall.equipe.length / days;
                eta = rate > 0.2 ? ` : a ton rythme (~${rate.toFixed(1)} niveau/jour), dans environ ${Math.max(1, Math.ceil(wall.niveauxEnPlus / rate))} jour(s)` : ' : ces cartes ne montent pas en ce moment, mets-les dans la Salle';
              }
            } catch {}
            if (wall) add(9, `Prochain mur : ${wall.monde} « ${wall.nom} » (${wall.niveauxEnPlus ? `+${wall.niveauxEnPlus} niveaux pour ${wall.equipe.map(short).join(', ')}${eta}` : 'hors de portee'})`);
            if ((S.acct?.lv || 1) < 25) add(10, `Tour de l'infini au niveau de compte 25 (tu es niveau ${S.acct?.lv || 1})`);
            items.sort((a, b) => a.prio - b.prio);
            const res = { t: now, energie: en, gemmes: gems, items };
            lsSet('kitsu_ai_road', res);
            return res;
          },
          roadAdvisor() {
            ui();
            let rb = document.getElementById('kitsuRoad');
            if (!rb) { rb = document.createElement('div'); rb.id = 'kitsuRoad'; rb.className = 'kitsu-panel'; rb.style.cssText = 'top:70px;left:12px;right:auto;border:1px solid #ffc24a;pointer-events:auto;max-width:380px;font-size:12px'; document.body.appendChild(rb); }
            const show = async force => {
              const last = lsGet('kitsu_ai_road_seen', 0);
              if (!force && Date.now() - last < 90 * 60000) return;
              rb.style.display = 'block';
              const render = (R, live) => {
                rb.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px"><b style="color:#ffc24a">Roadmap du moment</b><span id="kitsuRoadX" style="cursor:pointer;opacity:.7">fermer</span></div>`
                  + `<div style="opacity:.7;margin-bottom:4px">Gemmes ${R.gemmes} · energie ${R.energie}</div>`
                  + R.items.map((it, i) => `<div style="margin-top:3px">${i + 1}. ${it.txt}</div>`).join('')
                  + `<div style="margin-top:6px;opacity:.5;font-size:11px">${live ? 'a jour' : 'mise a jour en cours...'}</div>`;
                document.getElementById('kitsuRoadX').onclick = () => { rb.style.display = 'none'; lsSet('kitsu_ai_road_seen', Date.now()); };
              };
              // Affichage immediat de la derniere roadmap, puis mise a jour en arriere-plan.
              const cached = lsGet('kitsu_ai_road', null);
              if (cached) render(cached, false); else rb.innerHTML = '<div class="k-ttl">Roadmap</div><div style="opacity:.7">Premier calcul...</div>';
              try { const R = await this.roadmap(); if (rb.style.display !== 'none') render(R, true); } catch (e) { if (!cached) rb.textContent = 'Roadmap : ' + e.message; }
            };
            this.showRoad = () => show(true);
            setTimeout(() => show(false), 2500);
          },

          // Tour de l'infini : simule des montees completes (PV reportes, 12 % de soin entre etages, 30 % apres un boss).
          async tower(n = 10, runs = 6) {
            await loadModules();
            const S = save(), pol = smartPol(this.W), TW = G.TOWER || { HEAL: 0.12, BOSS_HEAL: 0.3 };
            const climb = (ids, seed) => {
              let team = ids.map(id => ({ id, lv: S.lv?.[id]?.l || 1, stars: S.stars?.[id] || 0, ...(S.lk?.[id] ? { lk: S.lk[id] } : {}) })); // avec tes collectifs
              for (let fl = 1; fl <= 400; fl++) {
                const { st } = G.setupTower(fl, team, seed * 1000 + fl); st.__tower = 1;
                playOut(st, pol);
                if (B.outcome(st) !== 'win') return fl - 1;
                const heal = G.isBossFloor(fl) ? TW.BOSS_HEAL : TW.HEAL;
                team = team.map(m => { const u = B.allies(st).find(x => x.id === m.id); return !u || !u.alive ? { ...m, alive: false, hp: 0 } : { ...m, alive: true, hp: Math.min(u.maxHp, u.hp + u.maxHp * heal) }; });
              }
              return 400;
            };
            const res = [];
            for (const t of trios(pool(n, S))) { const f = Array.from({ length: runs }, (_, i) => climb(t, i + 1)); res.push({ equipe: t, moyenne: +(f.reduce((a, b) => a + b, 0) / runs).toFixed(1), min: Math.min(...f), max: Math.max(...f) }); await idle(); }
            res.sort((a, b) => b.moyenne - a.moyenne);
            const best = { equipe: res[0].equipe, etage: res[0].moyenne, t: Date.now(), top: res.slice(0, 5) };
            lsSet('kitsu_ai_tower', best);
            console.table(res.slice(0, 8).map(r => ({ equipe: r.equipe.map(short).join(', '), moyenne: r.moyenne, min: r.min, max: r.max })));
            return best;
          },

          planAdvisor() {
            const { pull: pb } = ui();
            let pn = document.getElementById('kitsuPlan');
            if (!pn) { pn = document.createElement('div'); pn.id = 'kitsuPlan'; pn.className = 'kitsu-panel'; pn.style.cssText = 'bottom:90px;font-size:12px'; document.body.appendChild(pn); }
            let busy = false, shownAt = 0;
            clearInterval(window.__kitsuPlanT);
            window.__kitsuPlanT = setInterval(async () => {
              if (document.hidden) return;
              const onMap = /adventure/.test(location.hash) && !liveBattle() && !prepScreen();
              if (!onMap) { pn.style.display = 'none'; return; }
              pn.style.display = 'block';
              if (busy) return;
              let P = lsGet('kitsu_ai_plan', null);
              if (P && Date.now() - shownAt < 60000 && pn.innerHTML) return;
              if (!P || Date.now() - P.t > 10 * 60000) { busy = true; pn.innerHTML = '<div class="k-ttl">Plan du moment</div><div style="opacity:.7">Calcul...</div>'; try { P = await this.plan(); } catch (e) { pn.textContent = 'Plan : ' + e.message; busy = false; return; } busy = false; }
              const top = P.combats.filter(r => r.gemmesEsperees > 0).slice(0, 6);
              pn.innerHTML = `<div class="k-ttl">Plan du moment</div><div class="k-move" style="font-size:20px">+${P.gemmesAPrendre} gemmes <i>à prendre</i></div>`
                + `<div class="k-chips"><span class="k-chip">Gemmes ${P.gemmes}</span><span class="k-chip">Énergie ${P.energie}</span><span class="k-chip">${P.energieNecessaire} énergie nécessaire</span>${P.minutesEnergie ? `<span class="k-chip">~${P.minutesEnergie} min de recharge</span>` : ''}</div>`
                + (top.length ? '<div class="k-sec"><span>Combats</span><span>3 étoiles</span></div>' : '')
                + top.map((r, i) => `<div class="k-row${i ? ' k-dim' : ''}"><span class="n">${i + 1}</span><span class="l">${r.nom}${r.boss ? ' (boss)' : ''} · ${r.etoiles}/3</span><span class="p">${Math.round(r.troisEtoiles * 100)} %</span><span class="k-sub">${r.equipe.map(short).join(', ')}</span><span class="k-bar"><b style="width:${Math.round(r.troisEtoiles * 100)}%"></b></span></div>`).join('')
                + (P.bloquants.length ? `<div class="k-warn" style="margin-top:5px">Bloquants : ${P.bloquants.map(r => r.nom).join(', ')}</div>` : '')
                + (P.avenir?.length ? '<div class="k-sec"><span>Prochains murs</span><span></span></div>' + P.avenir.slice(0, 3).map(r => `<div>${r.monde} « ${r.nom} » · ${Math.round(r.victoire * 100)} % · <span class="k-warn">${r.niveauxEnPlus ? `+${r.niveauxEnPlus} niveaux, ~${r.combatsDeFarm} farms` : 'hors de portée'}</span></div>`).join('') : '')
                + (P.tour ? `<div style="margin-top:5px">Tour : ${P.tour.equipe.map(short).join(', ')}, étage ~${P.tour.etage}</div>` : '')
                + `<div class="k-foot"><span>Ensuite <b>${P.apresPlan} gemmes</b>, soit ${P.tirages10} tirage${P.tirages10 > 1 ? 's' : ''} x10</span><span>${P.banniere}</span></div>`;
              shownAt = Date.now();
            }, 1000);
          },

          // Compare la version du jeu a la derniere vue ; si elle a change, previent et reentraine en tache de fond.
          async checkVersion() {
            const cur = versionSig(), prev = lsGet(LS.ver, null);
            if (!prev) { lsSet(LS.ver, cur); return 'premiere version enregistree'; }
            if (sameVer(prev, cur)) return 'version inchangee';
            const what = [];
            if (prev.fights !== cur.fights) what.push(`${cur.fights - prev.fights >= 0 ? '+' : ''}${cur.fights - prev.fights} combats`);
            if (prev.chars !== cur.chars) what.push(`${cur.chars - prev.chars >= 0 ? '+' : ''}${cur.chars - prev.chars} cartes`);
            if (prev.banners !== cur.banners) what.push('bannieres modifiees');
            if (prev.dom !== cur.dom || prev.app !== cur.app) what.push('code du jeu modifie');
            toast(`<b class="k-tt">Mise a jour du jeu detectee</b><br>${what.join(', ')}<br>Plan, equipes, equipe cible et evenements recalcules avec les nouvelles regles, en arriere-plan.`, 12000);
            lsSet(LS.pulls, null);
            lsSet(LS.ver, cur);
            // Les regles ont pu changer (stats, synergies, ennemis) : tous les resultats simules sont refaits.
            for (const k of ['kitsu_ai_plan', 'kitsu_ai_teams', 'kitsu_ai_training', 'kitsu_ai_walls', 'kitsu_ai_shop', 'kitsu_ai_events', 'kitsu_ai_farm', 'kitsu_ai_tower', 'kitsu_ai_gw', 'kitsu_ai_pain', 'kitsu_ai_road']) localStorage.removeItem(k);
            setTimeout(() => this.plan().then(() => this.training()).then(() => this.plan()).then(() => this.events(true)).then(() => this.precomputeTeams()).catch(e => health.err('recalcul apres mise a jour : ' + e.message)), 3000);
            setTimeout(() => this.tower(8, 4).catch(() => {}), 60000);
            setTimeout(() => this.retrain({ quiet: true }), 120000);
            return 'nouvelle version : ' + what.join(', ');
          },

          live() {
            const { box, badge } = ui();
            let last = '', cur = null, wasOver = true;
            clearInterval(window.__kitsuAdvT);
            let tick = 0;
            window.__kitsuAdvT = setInterval(() => {
              try {
                // Hors combat : on ne cherche un combat que toutes les 600 ms (4 ticks) et on ne nettoie qu'une fois, a la fin du combat (5.18).
                if (wasOver && (++tick & 3)) return;
                const T = liveBattle();
                if (!T || T.over) { if (!wasOver) { if (T && T.over) logEnd(T); box.style.display = 'none'; last = ''; cur = null; window.__kitsuCoup = null; window.__kitsuAvis = null; clearMarks(badge); } wasOver = true; return; }
                if (document.hidden) return;
                wasOver = false; box.style.display = 'block';
                const st = T.st, a = T.active;
                if (cur) {
                  // Toutes les 150 ms : on ne retouche les contours que s'ils ont change (retirer puis remettre un halo force le navigateur a tout redessiner).
                  const want = [[unitEl(cur.me), 'kitsu-me'], [document.querySelector(`button.act[data-act="${cur.kind}"]`), 'kitsu-btn']];
                  if (cur.tgt) want.push([unitEl(cur.tgt), 'kitsu-tgt']); else if (cur.all) B.foes(st, a || st.units[0]).forEach(e => want.push([unitEl(e.key), 'kitsu-all']));
                  const ok = want.filter(([el]) => el);
                  if (!ok.every(([el, c]) => el.classList.contains(c)) || document.querySelectorAll('.kitsu-tgt,.kitsu-all,.kitsu-me,.kitsu-btn').length !== ok.length) { clearMarks(); ok.forEach(([el, c]) => el.classList.add(c)); }
                  const el = cur.tgt ? unitEl(cur.tgt) : null;
                  if (el) { const r = el.getBoundingClientRect(), txt = 'CIBLE : ' + cur.label, x = (r.left + r.width / 2) + 'px', y = r.top + 'px'; if (badge.textContent !== txt) badge.textContent = txt; if (badge.style.left !== x) badge.style.left = x; if (badge.style.top !== y) badge.style.top = y; if (badge.style.display !== 'block') badge.style.display = 'block'; }
                  else if (badge.style.display !== 'none') badge.style.display = 'none';
                }
                window.__kitsuCoup = cur;
                if (!a || a.side !== 'ally') { cur = null; return; }
                const sig = a.key + '|' + (T.actions?.length || 0) + '|' + st.elapsed;
                if (sig === last) return; last = sig;
                if (T.tower) st.__tower = 1;
                cur = null; // le classement arrive du worker en quelques dizaines de ms : pas d'ancien contour sur le nouveau personnage
                evalLiveA(st, a.key, this.W).then(res => { try {
                  if (last !== sig) return;
                  logDecision(T, res);
                  const b0 = res[0].c, m0 = mv(a, b0.kind);
                  cur = { me: a.key, kind: b0.kind, tgt: b0.target?.key, all: b0.kind !== 'rest' && b0.kind !== 'basic' && !b0.target && B.kitRole(a, b0.kind).aoe > 0, label: m0.name };
                  // 5.32 : avis du public et du calcul du PC pour le script prive (un seul cadre quand il a le coup exact). Lecture seule.
                  window.__kitsuAvis = { sig, me: a.key, pub: { kind: b0.kind, tgt: b0.target?.key ?? null, label: m0.name, cible: b0.target?.name || null }, pc: localPC.ok ? { etat: 'attente' } : null };
                  const nm = c => mv(a, c.kind).name + (c.target ? ' sur ' + c.target.name : '');
                  const decisive = res.length > 1 && res[0].win - res[1].win >= 0.15;
                  const charging = B.foes(st, a).filter(e => e.charging).map(e => e.name);
                  const pct = r => Math.round(calibrate(r.win) * 100);
                  box.innerHTML = `<div class="k-who"><b>${a.name}</b> joue</div><div class="k-move">${m0.name}${b0.target ? ` <i>→ ${b0.target.name}</i>` : ''}</div>`
                    + `<div class="k-chips">${decisive ? '<span class="k-chip hot">Coup décisif</span>' : ''}<span class="k-chip acc">${TAG[b0.kind]} · ${COSTS[b0.kind] ? COSTS[b0.kind] + ' END' : 'gratuit'}</span>${charging.length ? `<span class="k-chip warn">${charging.join(', ')} charge !</span>` : ''}</div>`
                    + `<div class="k-why">${why(st, a, b0, res)}</div><div class="k-desc">${m0.desc}</div>`
                    + '<div class="k-sec"><span>Coups classés</span><span>victoire</span></div>'
                    + res.slice(0, 4).map((r, i) => `<div class="k-row${i ? ' k-dim' : ''}"><span class="n">${i + 1}</span><span class="l">${nm(r.c)}</span><span class="p">${pct(r)} %<small>(${r.n})</small></span><span class="k-bar"><b style="width:${pct(r)}%"></b></span></div>`).join('')
                    + `<div class="k-foot"><span>Endurance <b>${st.end}</b></span><span>Énergie <b>${a.energy ?? 0}/100</b></span><span>IA <b>${modeName(st)}</b></span></div>`;
                  // Anticipation poussee sur le PC (serveur local) : objectif 2 etoiles, puis 3 (en Tour : victoire puis PV gardes). Remplace le conseil s'il est meilleur.
                  if (Date.now() - localPC.t > 30000) localPing();
                  if (localPC.ok) {
                    const mySig = sig, cl = cands(st, a), { rng, ...rest } = st;
                    (box.querySelector('.k-desc') || box.firstElementChild)?.insertAdjacentHTML('afterend', '<div id="kitsuPC" class="k-pc"><div class="t">Calcul du PC<span>en cours...</span></div></div>');
                    localAsk('/conseil', { dom: domFile(), st: JSON.stringify(rest), key: a.key, cands: cl.map(c => ({ kind: c.kind, tgt: c.target?.key })), W: this.W, budget: 700 }, 5000).then(r => {
                      const el = document.getElementById('kitsuPC');
                      if (last !== mySig) return;
                      const av = window.__kitsuAvis?.sig === mySig ? window.__kitsuAvis : null;
                      if (!r || r.err || !r.res?.length) { if (av) av.pc = { etat: 'erreur' }; if (r?.err === 'version') { localPC.ok = false; localPC.msg = 'moteur du PC pas a jour : relance serveur.bat'; } if (el) el.innerHTML = '<div class="t" style="color:#9199a6">Calcul du PC<span>' + (r?.err === 'version' ? 'moteur pas à jour (relance serveur.bat)' : 'pas de réponse') + '</span></div>'; return; }
                      // Le PC ne remplace le conseil que s'il trouve STRICTEMENT mieux : a egalite (combat gagne a 3 etoiles quel que
                      // soit le coup, ou perdu quoi qu'on fasse), son classement garderait le premier coup de la liste, le repos.
                      const pcB0 = r.res.find(x => x.kind === b0.kind && (x.tgt ?? null) === (b0.target?.key ?? null));
                      const b = pcB0 && r.res[0].v - pcB0.v < 0.03 ? pcB0 : r.res[0], c1 = cl.find(c => c.kind === b.kind && (c.target?.key ?? null) === (b.tgt ?? null)); if (!c1) return;
                      const changed = c1.kind !== b0.kind || (c1.target?.key ?? null) !== (b0.target?.key ?? null);
                      if (av) av.pc = { etat: changed ? 'change' : 'confirme', kind: c1.kind, tgt: c1.target?.key ?? null, label: mv(a, c1.kind).name, cible: c1.target?.name || null, s2: b.s2, s3: b.s3, win: b.win, hp: b.hp ?? null, tour: !!T.tower, sims: r.sims, ms: r.ms };
                      cur = { me: a.key, kind: c1.kind, tgt: c1.target?.key, all: c1.kind !== 'rest' && c1.kind !== 'basic' && !c1.target && B.kitRole(a, c1.kind).aoe > 0, label: mv(a, c1.kind).name };
                      if (el) el.outerHTML = `<div id="kitsuPC" class="k-pc${changed ? ' chg' : ''}"><div class="t">Calcul du PC · ${changed ? 'change le conseil' : 'confirme'}<span>${r.sims} suites · ${r.ms} ms</span></div><b>${nm(c1)}</b> · ${T.tower && b.hp != null ? `victoire <b class="k-gold">${Math.round(b.win * 100)} %</b> · PV gardés ${Math.round(100 * b.hp / Math.max(0.01, b.win))} %` : `2+ étoiles <b class="k-gold">${Math.round(b.s2 * 100)} %</b> · 3 étoiles <b class="k-gold">${Math.round(b.s3 * 100)} %</b>`}${r.res[1] ? `<br><span class="k-mute">ensuite : ${nm(cl.find(c => c.kind === r.res[1].kind && (c.target?.key ?? null) === (r.res[1].tgt ?? null)) || { kind: r.res[1].kind })} (${Math.round(r.res[1].s2 * 100)} %)</span>` : ''}</div>`;
                      // 5.19 : le coup affiche en grand suit le conseil du PC quand il le change (comme les contours).
                      if (changed) { const mvEl = box.querySelector('.k-move'); if (mvEl) mvEl.innerHTML = `${mv(a, c1.kind).name}${c1.target ? ` <i>→ ${c1.target.name}</i>` : ''}`; }
                    });
                  }
                } catch (e) { box.textContent = 'Conseiller : ' + e.message; health.err('conseiller : ' + e.message); } });
              } catch (e) { box.textContent = 'Conseiller : ' + e.message; health.err('conseiller : ' + e.message); }
            }, 150);
          },

          // Ecran "Choisis tes cartes" : 120 trios de tes 10 meilleures cartes, simules contre ce combat.
          // Classement des trios pour un combat : en cache (par combat et niveaux de tes cartes), calcule par petits morceaux.
          _teamKey(fid, S, base) { return fid + '|' + (base ? base.join('.') + '|' : '') + (lsGet('kitsu_ai_training', null)?.objectif?.equipe || []).join('.') + '|' + pool(10, S).map(id => id + ':' + Math.floor((S.lv?.[id]?.l || 1) / 3) + ':' + (S.stars?.[id] || 0)).join(','); },
          // base (5.37, farm) : cartes dont on essaie tous les trios, a la place de tes 10 plus fortes.
          async _rankTeams(fid, S = save(), base = null) {
            const key = this._teamKey(fid, S, base), cache = lsGet('kitsu_ai_teams', {});
            if (cache[key]) return cache[key].res;
            const pol = smartPol(this.W), seeds = [1, 2, 3, 4, 5, 6, 7, 8];
            const trc = lsGet('kitsu_ai_training', null), tr0 = [...(trc?.objectif?.equipe || []), ...(trc?.cartes || []).slice(0, 2).map(c => c.id)].filter(id => S.owned?.[id]);
            const xw0 = xpWeights(), focusT = (trc?.objectif?.equipe || []).filter(id => S.owned?.[id]);
            const list = trios(base || [...new Set([...pool(10, S), ...tr0])]);
            // Trios du calcul Campagne du PC (meilleur trio de ce combat parmi TOUS tes trios, et trio du plan) : ajoutes a la liste,
            // puis classes comme les autres a tes niveaux actuels.
            const calc = new Set(); let exact = null;
            if (localPC.ok) { const c = await localAsk('/equipes', { conseil: 1, fid }, 4000).catch(() => null);
              // 5.28 : avec le script prive, trio du calcul Campagne exact (% de 3 etoiles en suivant le conseil exact en combat).
              // Calcul fait au niveau 99 : seulement si les 3 cartes y sont deja.
              const ex = c?.exact, exIds = (ex?.trio || []).map(Number).sort((a, b) => a - b);
              if (exIds.length === 3 && exIds.every(id => S.owned?.[id] && (ex.niveaux !== '99' || (S.lv?.[id]?.l || 1) >= 99)) && ex.troisEtoiles > 0) { exact = { k: exIds.join('-'), p: ex.troisEtoiles / 100 }; if (!list.some(t => t.slice().sort((a, b) => a - b).join('-') === exact.k)) list.push(exIds); }
              for (const x of c?.trios || []) { const ids = x.map(Number).sort((a, b) => a - b); if (ids.length === 3 && ids.every(id => S.owned?.[id])) { const k = ids.join('-'); calc.add(k); if (!list.some(t => t.slice().sort((a, b) => a - b).join('-') === k)) list.push(ids); } } }
            // Calcul sur le PC (serveur local) : 24 tirages par trio au lieu de 8, sinon calcul dans le navigateur.
            let res = null;
            if (localPC.ok) { const r = await localAsk('/equipes', { dom: domFile(), fid, equipes: list.map(t => teamOf(t, S)), W: this.W, seeds: 24 }, 15000); if (r?.res?.length === list.length) res = list.map((t, i) => ({ t, w: r.res[i].win / r.res[i].n, s: r.res[i].s2 / r.res[i].n, s3: r.res[i].s3 / r.res[i].n, pc: 1 })); }
            if (!res) { const out = await simBatch(list.map(t => ({ fid, team: teamOf(t, S), seeds })), this.W); res = list.map((t, i) => ({ t, w: out[i].w / out[i].n, s: out[i].s / out[i].n, s3: out[i].s3 / out[i].n })); }
            for (const r of res) { const k = r.t.slice().sort((a, b) => a - b).join('-'); if (calc.has(k)) r.calc = 1; if (exact && k === exact.k) r.exact = exact.p; }
            res.sort((a, b) => b.s3 - a.s3 || b.w - a.w || b.s - a.s);
            const c2 = lsGet('kitsu_ai_teams', {}); c2[key] = { t: Date.now(), res };
            const keys = Object.keys(c2).sort((a, b) => c2[b].t - c2[a].t).slice(0, 25);
            lsSet('kitsu_ai_teams', Object.fromEntries(keys.map(k => [k, c2[k]])));
            return res;
          },
          // Precalcule les equipes des 3 prochains combats du plan (pendant l'ecran de resultats).
          // Combat a rejouer pour l'XP quand la campagne n'a plus de 3 etoiles faciles : meilleur XP par energie
          // parmi les combats deja a 3 etoiles, avec une equipe qui gagne a coup sur et fait monter les cartes en retard.
          async farm() {
            await loadModules();
            if (this._farmBusy) return null; this._farmBusy = true;
            try {
              const S = save(), xw = xpWeights(), MODE = { h: 'Difficile', x: 'Extreme', n: 'Cauchemar', hn: 'Cauchemar Difficile', xn: 'Cauchemar Extreme' };
              const rows = Object.keys(S.pve?.stars || {}).filter(id => S.pve.stars[id] >= 3 && !id.startsWith('ev-')).map(id => { const f = G.findFight(id); if (!f) return null; let xp = 0, c = 1; try { xp = G.fightXp(f); c = G.fightCost(f) || 1; } catch {} return { id, f, xp, c }; })
                .filter(Boolean).sort((a, b) => b.xp / b.c - a.xp / a.c);
              // 5.37 : les 2 combats les plus rentables de chaque difficulte (Normal ... Cauchemar Extreme), pas seulement les plus durs :
              // une carte basse ne tient pas en Cauchemar, mais monte en Normal ou Difficile. 10 combats au plus.
              const parMode = {}; for (const r of rows) { const k = r.id.split('@')[1] || ''; if ((parMode[k] ??= []).length < 2) parMode[k].push(r); }
              const essais = Object.values(parMode).flat().sort((a, b) => b.xp / b.c - a.xp / a.c).slice(0, 10);
              // Trios essayes : tes 6 cartes les plus fortes et les 5 cartes a faire monter les plus utiles (plan d'XP, prochains murs).
              const aMonter = Object.entries(xw).filter(([id, v]) => v > 0 && S.owned?.[id] && (S.lv?.[id]?.l || 1) < 99).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => +id);
              const base = [...new Set([...pool(6, S), ...aMonter])].sort((a, b) => a - b);
              // 5.39 : le farm rejoue des combats deja a 3 etoiles, les etoiles n'y rapportent plus rien. Regle du jeu (lue dans le moteur) :
              // a la victoire, chaque carte gagne l'XP du combat, la moitie si elle est K.O. ; rien en cas de defaite. Il suffit donc de
              // gagner (95 %). Avant, il fallait aussi 3 etoiles a 90 % : une carte basse (K.O. souvent) n'etait jamais prise.
              // XP utile d'un trio = cartes a monter ponderees x (1 sans K.O., 0,5 avec) ; « 3 etoiles » sert d'estimation basse du sans K.O.
              const gainXp = x => xpScore(x.t, xw) * (0.5 + 0.5 * x.s3);
              let row = null, meilleur = -1;
              for (const r of essais) {
                const res = await this._rankTeams(r.id, S, base);
                const ok = res.filter(x => x.w >= 0.95).sort((a, b) => gainXp(b) - gainXp(a) || b.w - a.w || b.s3 - a.s3)[0];
                const v = ok ? (gainXp(ok) || 0.01) * r.xp / r.c : -1;
                if (v > meilleur) { meilleur = v; const suf = r.id.split('@')[1]; row = { id: r.id, nom: r.f.t + (suf ? ` (${MODE[suf] || suf})` : ''), equipe: ok.t, troisEtoiles: ok.s3, victoire: ok.w, etoiles: 3, xp: r.xp, cout: r.c, gemmesEsperees: 0, farm: true }; }
                await idle();
              }
              lsSet('kitsu_ai_farm', { t: Date.now(), row });
              return row;
            } finally { this._farmBusy = false; }
          },
          async guildRefresh() {
            const H = { credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } }, out = { t: Date.now() };
            try {
              const r = await fetch('/api/guilds/week', H);
              if (r.ok) {
                const g = await r.json(); out.boss = g.me?.guild && g.boss ? { left: g.me.tries?.boss?.left || 0, name: g.boss.name } : null; if (g.me?.guild) out.info = guildInfo(g);
                // Equipe du boss pas encore calculee (ou boss change) : on la calcule ici, sans attendre la roadmap.
                const c0 = lsGet('kitsu_ai_gw', null), bkey = g.boss ? g.boss.id + '|' + g.boss.lv : '';
                if (out.boss?.left > 0 && (!c0?.team || c0.bkey !== bkey) && !this._gwBusy) {
                  this._gwBusy = true;
                  try {
                    await loadModules();
                    const S = save(), lvOf = id => S.lv?.[id]?.l || 1, pol = smartPol(this.W), turns = g.week?.turns || 12;
                    // Toutes les cartes eligibles (niveau minimum de la guilde) : balayage 4 graines, puis les 12 meilleurs
                    // trios confirmes sur 40 graines (les degats varient beaucoup d'un combat a l'autre). Plafond 300 000.
                    const minLv = g.week?.minLv || 15, CAP = 300000;
                    const elig = Object.keys(S.owned || {}).map(Number).filter(id => window.CHAR_BY_ID?.[id] && lvOf(id) >= minLv).sort((a, b) => lvOf(b) - lvOf(a)).slice(0, 24);
                    const gdmg = (t, sd) => { const { st, hp0 } = G.setupGwBoss(g.boss.id, g.boss.lv, g.boss.hp, t.map(id => ({ id, lv: lvOf(id), stars: S.stars?.[id] || 0 })), sd); for (let i = 0; i < 600 && st.cycle <= turns; i++) { const u = step(st); if (!u || st.cycle > turns) break; doAct(st, u, pol(st, u)); } return Math.min(CAP, hp0 - B.enemies(st)[0].hp); };
                    const scan = []; let n = 0;
                    for (const t of trios(elig)) { let d = 0; for (const sd of [1, 2, 3, 4]) d += gdmg(t, sd); scan.push({ t, d: d / 4 }); if (++n % 25 === 0) await idle(); }
                    scan.sort((a, b) => b.d - a.d);
                    let best = null;
                    for (const c of scan.slice(0, 12)) { let d = 0; for (let sd = 2000; sd < 2040; sd++) d += gdmg(c.t, sd); d /= 40; if (!best || d > best.d) best = { t: c.t, d }; await idle(); }
                    if (best) lsSet('kitsu_ai_gw', { key: c0?.key || '', bkey, d: Math.round(best.d), team: best.t, txt: `Guilde : boss ${g.boss.name}. Equipe : ${best.t.map(short).join(', ')} (~${Math.round(best.d)} degats, minimum ${g.week?.minDmg || 1000})` });
                  } finally { this._gwBusy = false; }
                }
              }
            } catch (e) { health.err('guilde : ' + e.message); }
            try { const r = await fetch('/api/guilds/pain', H); if (r.ok) { const g = await r.json(); out.pain = g.event?.open ? { left: g.me?.left || 0 } : null; } } catch {}
            lsSet('kitsu_ai_guild', out);
            return out;
          },
          _guildActions() {
            const g = lsGet('kitsu_ai_guild', null), out = []; if (!g || Date.now() - g.t > 30 * 60000) return out;
            const pt = lsGet('kitsu_ai_pain', null)?.team, bt = lsGet('kitsu_ai_gw', null)?.team;
            if (g.pain?.left > 0 && pt?.length === 3) out.push({ id: 'pain', kind: 'pain', team: pt, txt: `Guilde : raid Pain (${g.pain.left} essai${g.pain.left > 1 ? 's' : ''})` });
            if (g.boss?.left > 0 && bt?.length === 3) out.push({ id: 'gwboss', kind: 'gw', team: bt, txt: `Guilde : boss ${g.boss.name} (${g.boss.left} essai${g.boss.left > 1 ? 's' : ''}, sans energie)` });
            const i = g.info;
            if (i?.ok && i.chalPts) out.unshift({ id: 'gwchal', kind: 'claim', tab: 'chal', btn: '[data-gw="chal"]', txt: `Guilde : recupere les defis (+${i.chalPts} points)` });
            if (i?.ok && i.chestPts) out.unshift({ id: 'gwchest', kind: 'claim', tab: 'chest', btn: '[data-gw="chest"]', txt: `Guilde : ouvre le coffre (+${i.chestPts} points)` });
            if (i?.buy) out.push({ id: 'gwbuy', kind: 'claim', tab: 'shop', btn: `[data-gw="buy"][data-id="${i.buy.id}"]`, txt: `Boutique de guilde : achete ${i.buy.nom} (${i.buy.price} points)` });
            return out;
          },
          // 5.19.1 : trio de la Tour publie par le script prive dans html[data-kar-tour] (« id,id,id|etage »), sinon null.
          // Sans script prive, rien ne change : le trio vient de la simulation de la page (kitsu_ai_tower).
          _karTour() {
            const v = document.documentElement.dataset.karTour; if (!v) return null;
            const [a, e] = v.split('|'), team = a.split(',').map(Number).filter(n => n > 0);
            return team.length === 3 ? { equipe: team, etage: +e || 0, t: Date.now() } : null;
          },
          _towerAction(S = save(), en = 0) {
            if ((S.acct?.lv || 1) < 25) return null;
            const tw = KitsuAI._karTour() || lsGet('kitsu_ai_tower', null), cost = G?.TOWER?.COST || 4, best = S.tower?.best || 0;
            if (!tw?.equipe?.length || en < cost || tw.etage < best + 1) return null;
            return { team: tw.equipe, best, cible: Math.round(tw.etage) };
          },
          // Previsions : fins de bannieres et d'evenements, nouvelles cartes (sorties a 17 h), LR de la boutique,
          // gemmes a venir a ton rythme, Tour de l'infini.
          forecast() {
            let fp = document.getElementById('kitsuFuture');
            if (!fp) { fp = document.createElement('div'); fp.id = 'kitsuFuture'; fp.className = 'kitsu-panel'; fp.style.display = 'block'; document.body.appendChild(fp); }
            const render = () => {
              if (!G || document.getElementById('kitsuDock')?.dataset.tab !== 'future') return;
              const S = save(), now = Date.now(), day = 86400000, fmt = t => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), rows = [];
              const R = { M: 'LR', L: 'UR', E: 'SSR' };
              // Gemmes : rythme des dernieres 24 h (recompenses suivies)
              const rw = lsGet('kitsu_ai_rewards', []).filter(r => now - r.t < day), perDay = Math.max(0, rw.reduce((a, r) => a + Math.max(0, r.gemmes || 0), 0));
              const gems = S.ki || 0;
              rows.push(['Gemmes', `${gems} maintenant · ~${perDay}/jour a ton rythme · ${gems + perDay * 3} dans 3 j · ${gems + perDay * 7} dans 7 j`]);
              const lrIn = S.dshop?.lrIn; if (lrIn != null) { const tLr = now + lrIn * day; rows.push(['LR de la boutique', `${lrIn === 0 ? "aujourd'hui" : 'dans ' + lrIn + ' j'} (1 500 gemmes) : ${gems + perDay * lrIn >= 1500 ? '<span style="color:#2fd27a">atteignable</span>' : `<span style="color:#ff5f6d">il manquera ~${1500 - gems - perDay * lrIn}</span>`}`]); }
              for (const b of (G.BANNERS || []).filter(b => b.until && b.until > now).sort((a, b) => a.until - b.until)) { const pity = S.pity?.[b.series] || 0; rows.push([`Banniere ${b.series}`, `fin ${fmt(b.until)}${pity ? ` · ton compteur ${pity}/50` : ''}`]); }
              for (const b of (G.BANNERS || []).filter(b => (b.opens || b.from || 0) > now)) rows.push([`Banniere ${b.series}`, `ouvre ${fmt(b.opens || b.from)}`]);
              for (const e of openEvents(now)) { const n = (lsGet('kitsu_ai_events', null)?.combats || []).filter(r => r.evId === e.id && !r.fait && !S.ev?.clear?.[r.id] && (r.victoire || 0) >= 0.8).length; rows.push([`Evenement ${e.banner?.series || e.title}`, `fin ${e.banner?.until ? fmt(e.banner.until) : '?'}${n ? ` · ${n} premiere(s) victoire(s) a prendre` : ' · fait'}`]); }
              try {
                const ord = G.STORY_DROPS?.order || [], CD = Object.entries(G.CARD_DROPS || {});
                ord.map((a, i) => ({ a, t: G.dropAt(i) })).filter(x => x.t > now && x.t < now + 8 * day).forEach(x => {
                  const cs = CD.filter(([, v]) => v.arc === x.a.arc && v.w === x.a.w && ['M', 'L'].includes(v.r)).map(([, v]) => `${v.n} (${R[v.r]})`);
                  if (cs.length) rows.push([`Nouvelles cartes ${new Date(x.t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`, `${cs.join(', ')}`]);
                });
              } catch {}
              // Quetes : aujourd'hui (non finies), demain, semaine prochaine, avec la preparation
              try {
                const qd = S.quests?.daily || {}, today = (G.questList('daily', now) || []).filter(d => (!qd.ids || qd.ids.includes(d.id)) && (qd.prog?.[d.id] || 0) < d.goal && !qd.claimed?.[d.id]);
                if (today.length) rows.push(["Quetes du jour restantes", today.map(d => `${d.t} (${qd.prog?.[d.id] || 0}/${d.goal}) : <i>${questHint(d.t, S, false)}</i>`).join('<br>')]);
                rows.push(['Quetes de demain', (G.questList('daily', now + day) || []).map(d => `${d.t} : <i>${questHint(d.t, S, true)}</i>`).join('<br>')]);
                const wk = (G.questList('weekly', now + 7 * day) || []), wkNow = (G.questList('weekly', now) || []);
                if (wk.map(d => d.t).join() !== wkNow.map(d => d.t).join()) rows.push(['Hebdo de la semaine prochaine', wk.map(d => `${d.t} : <i>${questHint(d.t, S, true)}</i>`).join('<br>')]);
              } catch {}
              // Entrainement : niveau dans 3 et 7 jours a ton rythme, pour l'equipe cible et tes cartes principales
              try {
                const hist = lsGet('kitsu_ai_lvhist', []), h0 = hist[0];
                if (h0 && now - h0.t > 3 * 3600000) {
                  const days = (now - h0.t) / day, ob = lsGet('kitsu_ai_training', null)?.objectif;
                  const ids = [...new Set([...(ob?.equipe || []), ...pool(4, S)])].slice(0, 6);
                  rows.push(['Tes cartes dans 3 / 7 jours', ids.map(id => { const lv = S.lv?.[id]?.l || 1, r = Math.max(0, lv - (h0.lv[id] || lv)) / days; return `${short(id)} : ${lv} -> ${Math.min(99, Math.round(lv + r * 3))} -> ${Math.min(99, Math.round(lv + r * 7))}${r < 0.3 ? ' <span style="color:#ff5f6d">(ne monte pas)</span>' : ''}${ob?.equipe?.includes(id) ? ' · cible' : ''}`; }).join('<br>')]);
                  const wall = lsGet('kitsu_ai_plan', null)?.avenir?.[0];
                  if (wall?.niveauxEnPlus) { const r = wall.equipe.reduce((a, id) => a + Math.max(0, (S.lv?.[id]?.l || 1) - (h0.lv[id] || S.lv?.[id]?.l || 1)), 0) / wall.equipe.length / days; rows.push(['Prochain mur', `${wall.nom} : +${wall.niveauxEnPlus} niveaux${r > 0.2 ? `, vers le ${new Date(now + wall.niveauxEnPlus / r * day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}`]); }
                } else rows.push(['Entrainement', 'projection disponible apres quelques heures de jeu (mesure de ton rythme)']);
              } catch {}
              { const gi = lsGet('kitsu_ai_guild', null)?.info; if (gi) rows.push(['Guilde', `${gi.pts} points · boss ${gi.weekPts}/${gi.cap} cette semaine · reset ${fmt(gi.weekEnd)}${gi.chalPts + gi.chestPts ? (gi.ok ? ` · ${gi.chalPts + gi.chestPts} points a recuperer` : ` · ${gi.chalPts + gi.chestPts} points reclamables ${gi.eligAt < gi.weekEnd ? fmt(gi.eligAt) : 'la semaine prochaine'}`) : ''}`]); }
              rows.push(['Tour de l\'infini', (S.acct?.lv || 1) >= 25 ? `debloquee · record ${S.tower?.best || 0}` : `niveau de compte ${S.acct?.lv || 1}/25`]);
              if (G.MARKET_OPEN === false) rows.push(['Marche', 'pas encore ouvert dans le jeu']);
              if (G.ROT_ON === false) rows.push(['Evenements tournants', 'desactives dans le jeu pour l\'instant']);
              fp.innerHTML = `<div class="k-ttl">A venir</div>` + rows.map(([k, v]) => `<div style="margin:3px 0;font-size:12px"><b style="color:#c9ced8">${k}</b><br><span style="opacity:.85">${v}</span></div>`).join('')
                + `<div style="margin-top:6px;opacity:.55;font-size:11px">Les nouvelles cartes arrivent dans les invocations (Shonen gratuites et bannieres de leur serie) et dans la boutique du jour.</div>`;
              accents(fp);
            };
            clearInterval(window.__kitsuFutT); window.__kitsuFutT = setInterval(render, 3000);
          },
          async precomputeTeams() {
            const S = save(), P = lsGet('kitsu_ai_plan', null);
            const todo = (P?.combats || []).filter(r => (S.pve?.stars?.[r.id] || 0) < 3).sort((a, b) => b.troisEtoiles - a.troisEtoiles || b.xp - a.xp).slice(0, 3);
            for (const r of todo) await this._rankTeams(r.id, S);
            return todo.map(r => r.id);
          },

          teamAdvisor() {
            const { team: tb } = ui(), seeds = [1, 2, 3, 4, 5, 6, 7, 8];
            let lastSig = '', job = null;
            clearInterval(window.__kitsuTeamT);
            window.__kitsuTeamT = setInterval(() => {
              if (document.hidden) return;
              const W = prepScreen();
              if (!W) { tb.style.display = 'none'; lastSig = ''; job = null; return; }
              const team = (W.team || []).map(x => typeof x === 'object' ? x?.id : x).filter(Boolean).map(Number);
              const sig = W.f.id + '|' + team.join(',');
              if (sig === lastSig) return; lastSig = sig;
              tb.style.display = 'block';
              const pol = smartPol(this.W), S = save();
              const hit = lsGet('kitsu_ai_teams', {})[this._teamKey(W.f.id, S)];
              if (!hit) tb.innerHTML = `<div class="k-ttl">Equipe pour « ${W.f.t} »</div><div style="opacity:.7">Calcul...</div>`;
              const evalT = ids => { let w = 0, s = 0, s3 = 0; for (const sd of seeds) { const st = playOut(mk(W.f.id, ids, sd, S), pol); s += score(st); if (B.outcome(st) === 'win') { w++; if (B.allies(st).every(u => u.alive) && st.cycle <= 8) s3++; } } return { w: w / seeds.length, s: s / seeds.length, s3: s3 / seeds.length }; };
              const my = {}; job = my;
              const list = { length: hit ? hit.res.length : trios(pool(10, S)).length };
              const chunk = async () => {
                const res = (await this._rankTeams(W.f.id, S)).map(r => ({ ...r }));
                if (job !== my) return;
                // A 3 etoiles egales, on prefere le trio qui fait progresser les cartes a entrainer.
                // Les 8 premiers sont rejoues 32 fois avant d'etre affiches : 8 simulations ne suffisent pas a dire
                // qu'une equipe fait 3 etoiles a coup sur.
                const seeds32 = Array.from({ length: 32 }, (_, i) => i + 1), evalLs = async list => (await simBatch(list.map(ids => ({ fid: W.f.id, team: teamOf(ids, S), seeds: seeds32 })), this.W)).map(o => ({ w: o.w / o.n, s: o.s / o.n, s3: o.s3 / o.n })); // 5.34 : dans le worker, memes resultats
                const head8 = res.splice(0, 8), evH = await evalLs(head8.map(r => r.t)); if (job !== my) return;
                const head = head8.map((r, i) => ({ t: r.t, calc: r.calc, exact: r.exact, ...evH[i] })).sort((a, b) => b.s3 - a.s3 || b.w - a.w || b.s - a.s);
                res.unshift(...head);
                const xw = xpWeights(), near = r => r.s3 >= Math.max(0.95, res[0].s3 - 0.02) && r.w >= res[0].w - 0.02;
                const top = res.slice(0, 8).filter(near).sort((a, b) => xpScore(b.t, xw) - xpScore(a.t, xw) || b.s3 - a.s3 || b.s - a.s);
                res.splice(0, 0, ...top.filter((x, i) => i === 0 && x !== res[0]).map(x => { res.splice(res.indexOf(x), 1); return x; }));
                const cur = team.length === 3 ? (await evalLs([team]))[0] : null; if (job !== my) return;
                const tie = top.length;
                const keep = cur && near(cur);
                const trainees = res[0].t.filter(id => xw[id]);
                const xpBetter = keep && xpScore(res[0].t, xw) > xpScore(team, xw);
                // Un seul verdict en tete : l'equipe a jouer, et pourquoi.
                // Regle prive/public : le trio du calcul exact du script prive passe devant des qu'il est jouable (ses 3 cartes a ton
                // niveau, 3 etoiles > 0 en suivant le conseil exact) ; le public n'est qu'un repli. 5.38 : plus de seuil de 10 points.
                const exR = res.find(r => r.exact != null && r.exact > 0);
                const pick = exR || (keep && !xpBetter ? { t: team, ...cur } : res[0]);
                window.__kitsuPick = { fid: W.f.id, t: pick.t.slice(), s3: pick.s3, at: Date.now() };
                const pickXp = pick.t.filter(id => xw[id]);
                const why = exR ? `calcul exact (script prive) : 3 etoiles ${Math.round(exR.exact * 100)} % en suivant le conseil exact en combat` : keep && !xpBetter ? (pickXp.length ? `deja la bonne : 3 etoiles ${Math.round(cur.s3 * 100)} % et fait monter ${pickXp.map(short).join(', ')}` : `3 etoiles ${Math.round(cur.s3 * 100)} %, aussi bien que la meilleure`)
                  : xpBetter || (pickXp.length && pick.s3 >= 0.95) ? `3 etoiles ${Math.round(pick.s3 * 100)} % et fait monter ${pickXp.map(short).join(', ')}` : `la plus sure : 3 etoiles ${Math.round(pick.s3 * 100)} %`;
                const same = (a, b) => a.length === b.length && a.every(id => b.includes(id));
                const rows = res.slice(0, 5); if (exR && !rows.includes(exR)) rows.unshift(exR); if (cur && !rows.some(r => same(r.t, team))) rows.push({ t: team, ...cur, mine: true });
                const tag = r => { const x = r.t.filter(id => xw[id]); return (x.length ? ` <span style="color:#ff7a2f;font-size:11px">XP : ${x.map(short).join(', ')}</span>` : '') + (r.calc ? ' <span style="color:#ffc24a;font-size:11px">calcul Campagne</span>' : '') + (r.exact != null ? ` <span style="color:#7cc4ff;font-size:11px">exact ${Math.round(r.exact * 100)} %</span>` : ''); };
                tb.innerHTML = `<div class="k-ttl">Equipe pour « ${W.f.t} »${W.f.boss ? ' (boss)' : ''}</div>`
                  + `<div style="margin-bottom:6px;padding:5px 7px;border:1px solid ${pickXp.length ? '#ff7a2f' : '#2fd27a'};border-radius:6px"><b style="color:${pickXp.length ? '#ff7a2f' : '#2fd27a'}">A jouer : ${pick.t.map(short).join(', ')}</b>${same(pick.t, team) ? ' (ton equipe)' : ''}<br><span style="font-size:11px;opacity:.85">${why}</span></div>`
                  + rows.map((r, k) => `<div style="opacity:${same(r.t, pick.t) ? 1 : .75}">${same(r.t, pick.t) ? '<b>&gt; ' : ''}${r.mine ? 'Ton equipe' : k + 1 + '.'} ${r.t.map(short).join(', ')}${same(r.t, pick.t) ? '</b>' : ''} <span style="color:${r.s3 >= 0.95 ? '#ffc24a' : '#ff5f6d'}">3 etoiles ${Math.round(r.s3 * 100)} %</span>${tag(r)}</div>`).join('')
                  + (!keep && cur ? `<div style="margin-top:6px;color:#ff5f6d">Ton equipe : 3 etoiles ${Math.round(cur.s3 * 100)} % seulement</div>` : '')
                  + `<div style="margin-top:4px;opacity:.55;font-size:11px">Classement : 3 etoiles d'abord (32 simulations), puis les cartes a faire monter${tie > 1 ? ` · ${tie} trios a egalite` : ''}</div>`;
              };
              setTimeout(chunk, 0);
            }, 300);
          },

          // Valeur des bannieres actives : victoires gagnees (frontiere + boss) si tu obtiens chaque carte vedette.
          async pulls({ newLv = 22, force = false } = {}) {
            await loadModules();
            const S = save(), key = Object.keys(S.owned || {}).length + '|' + JSON.stringify(S.lv || {}).length + '|' + versionSig().banners;
            const cached = lsGet(LS.pulls, null);
            if (!force && cached && cached.key === key) return cached;
            const now = Date.now();
            const rates = { E: 8.5, L: 1, M: 0.4 }; // taux des bannieres lus dans le code du jeu ; moitie sur les cartes vedettes
            const banners = (G.BANNERS || []).filter(b => { try { return G.bannersOpen(now, b) && (G.ACTIVE_BANNERS || []).includes(b.series); } catch { return false; } });
            const bench = benchCache || await buildBench(await defaultTeams(this.W), this.W);
            const fights = bench.norm.tr.concat(bench.norm.ho).filter((_, i) => i % 2 === 0).concat(bench.boss.tr.concat(bench.boss.ho).filter((_, i) => i % 2 === 0));
            const pol = smartPol(this.W), opt = { newLv };
            const wins = async ids => (await simTrios([ids], fights, [1], S, opt, this.W))[0].w; // 5.35 : dans le worker
            const base = []; for (const t of trios(pool(6, S))) base.push({ t, w: await wins(t) }); base.sort((a, b) => b.w - a.w); base.length = Math.min(2, base.length);
            const gain = {};
            const out = [];
            for (const b of banners) {
              const row = { banniere: b.series, pity: `${S.pity?.[b.series] || 0}/${G.pityMax ? G.pityMax(b) : 50}`, rarites: {} };
              let ev = 0;
              for (const r of ['E', 'L', 'M']) {
                let cards = []; try { cards = G.bannerPool(b, r, now) || []; } catch {}
                const gs = [];
                for (const c of cards) {
                  if (S.owned?.[c.id]) { gs.push({ n: c.n, g: 0, owned: true }); continue; }
                  if (gain[c.id] == null) {
                    let best = 0;
                    for (const x of base) for (let j = 0; j < 3; j++) { const t = x.t.slice(); t[j] = c.id; best = Math.max(best, await wins(t)); }
                    gain[c.id] = best - base[0].w;
                    await idle();
                  }
                  gs.push({ n: c.n, g: gain[c.id] });
                }
                const mean = gs.length ? gs.reduce((a, x) => a + Math.max(0, x.g), 0) / gs.length : 0;
                ev += 10 * rates[r] / 100 * 0.5 * mean;
                row.rarites[r] = gs.sort((a, b) => b.g - a.g);
              }
              row.ev10 = +ev.toFixed(1);
              out.push(row);
            }
            out.sort((a, b) => b.ev10 - a.ev10);
            const result = { key, t: Date.now(), base: base[0].w, total: fights.length, newLv, banners: out };
            lsSet(LS.pulls, result);
            return result;
          },
          pullAdvisor() {
            const { pull: pb } = ui();
            let busy = false, shown = false;
            clearInterval(window.__kitsuPullT);
            window.__kitsuPullT = setInterval(async () => {
              if (document.hidden) return;
              if (!/boosters|invocation/.test(location.hash)) { pb.style.display = 'none'; shown = false; return; }
              if (shown || busy) return;
              pb.style.display = 'block';
              const cached = lsGet(LS.pulls, null);
              if (!cached) pb.innerHTML = '<div class="k-ttl">Valeur des bannieres</div><div style="opacity:.7">Simulation des cartes vedettes (environ 1 minute la premiere fois)...</div>';
              busy = true;
              try {
                const R = await this.pulls();
                const name = { E: 'SSR', L: 'UR', M: 'LR' };
                pb.innerHTML = `<div class="k-ttl">Valeur des bannieres pour ton equipe</div>`
                  + R.banners.map((b, i) => {
                    const top = ['M', 'L', 'E'].map(r => b.rarites[r]?.[0]).filter(x => x && x.g > 0).sort((a, c) => c.g - a.g)[0];
                    return `<div style="opacity:${i ? .8 : 1};margin-top:3px">${i ? '' : '<b>'}${i + 1}. ${b.banniere}${i ? '' : '</b>'} <span style="color:#ffc24a">+${b.ev10}</span> victoires / 10 tirages · pity ${b.pity}${top ? `<br><span style="opacity:.75;font-size:11px">meilleure carte : ${top.n} (+${top.g})</span>` : ''}</div>`;
                  }).join('')
                  + `<div style="margin-top:6px;opacity:.55;font-size:11px">Gain moyen sur ${R.total} combats difficiles, nouvelle carte supposee niveau ${R.newLv}. Taux : SSR 8,5 %, UR 1 %, LR 0,4 %, une chance sur deux d'etre une carte vedette.</div>`;
                shown = true;
              } catch (e) { pb.textContent = 'Bannieres : ' + e.message; }
              busy = false;
            }, 500);
          },

          // Reentrainement (normal + boss) jusqu'au plateau, par petits morceaux pour ne pas figer le jeu.
          async retrain({ patience = 12, maxGen = 120, quiet = false } = {}) {
            await loadModules();
            if (this._train && !this._train.done) return 'entrainement deja en cours';
            const T = this._train = { phase: 'banc de test', gen: { norm: 0, boss: 0 }, best: {}, start: {}, runs: 0, done: false };
            const teams = await defaultTeams(this.W);
            const bench = await buildBench(teams, this.W);
            const rn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
            const S = save();
            for (const kind of ['norm', 'boss']) {
              const set = bench[kind]; if (set.tr.length < 6 || set.ho.length < 2) continue;
              T.phase = kind === 'norm' ? 'combats normaux' : 'boss';
              const fit = async (w, fs, seeds, frac = 1) => {
                const p = policy(w); let s = 0;
                for (const ids of teams) { for (const f of fs) { if (frac < 1 && Math.random() > frac) continue; for (const sd of seeds) { T.runs++; s += kind === 'boss' ? runScore(f, ids, p, sd, S) : (runWin(f, ids, p, sd, S) ? 1 : 0); } } await idle(); }
                return s;
              };
              let mu = this.W[kind].slice(), sd = Array(NF).fill(0.3), best = mu.slice(), bestHo = await fit(best, set.ho, [901, 902]), stale = 0;
              T.start[kind] = +bestHo.toFixed(1);
              for (let g = 0; g < maxGen && stale < patience; g++) {
                const seeds = [g * 2 + 11, g * 2 + 12], pop = [];
                for (let i = 0; i < 12; i++) { const w = i === 0 ? best.slice() : mu.map((m, j) => m + sd[j] * rn()); pop.push({ w, f: await fit(w, set.tr, seeds, 0.6) }); }
                pop.sort((a, b) => b.f - a.f); const el = pop.slice(0, 4);
                for (let j = 0; j < NF; j++) { const m = el.reduce((a, p) => a + p.w[j], 0) / 4; mu[j] = m; sd[j] = Math.max(0.05, Math.sqrt(el.reduce((a, p) => a + (p.w[j] - m) ** 2, 0) / 4) * 0.9 + 0.02); }
                let imp = false;
                for (const w of [pop[0].w, mu]) { const h = await fit(w, set.ho, [901, 902]); if (h > bestHo + 0.05) { bestHo = h; best = w.slice(); imp = true; } }
                stale = imp ? 0 : stale + 1; T.gen[kind] = g + 1; T.best[kind] = +bestHo.toFixed(1);
                await sleep(30);
              }
              this.W = { ...this.W, [kind]: best };
              lsSet(LS.w, this.W);
            }
            T.done = true; T.phase = 'termine';
            // Nouveaux reglages de l'IA : plan, equipes, equipe cible, evenements et murs sont resimules avec eux.
            for (const k of ['kitsu_ai_plan', 'kitsu_ai_teams', 'kitsu_ai_training', 'kitsu_ai_walls', 'kitsu_ai_events', 'kitsu_ai_farm', 'kitsu_ai_road']) localStorage.removeItem(k);
            setTimeout(() => this.plan().then(() => this.training()).then(() => this.plan()).then(() => this.events(true)).then(() => this.precomputeTeams()).catch(e => health.err('resimulation apres entrainement : ' + e.message)), 1000);
            lsSet(LS.pulls, null);
            if (!quiet) console.log('KitsuAI : entrainement termine', T);
            toast(`<b class="k-tt">Reentrainement termine</b><br>normal ${T.start.norm ?? '-'} -> ${T.best.norm ?? '-'}, boss ${T.start.boss ?? '-'} -> ${T.best.boss ?? '-'} (${T.runs} combats simules)<br>Campagne, equipes et equipe cible resimulees avec la nouvelle IA.`, 10000);
            return T;
          },

          async xpPlan(n = 8) {
            await loadModules();
            const S = save(), pol = smartPol(this.W);
            const bench = benchCache || await buildBench(await defaultTeams(this.W), this.W);
            const fights = bench.norm.tr.concat(bench.norm.ho, bench.boss.tr, bench.boss.ho).filter((_, i) => i % 2 === 0);
            const wins = async (ids, bump) => (await simTrios([ids], fights, [1, 2], S, { bump }, this.W))[0].w; // 5.35 : dans le worker
            const p = pool(n, S), base = []; for (const t of trios(p)) base.push({ t, w: await wins(t) }); base.sort((a, b) => b.w - a.w); const top = base.slice(0, 6), out = {};
            for (const c of p) {
              const tr = top.filter(x => x.t.includes(c)).slice(0, 2);
              if (tr.length) { const g = []; for (const x of tr) g.push(await wins(x.t, c) - x.w); out[`${short(c)} (niv ${S.lv?.[c]?.l || 1})`] = { gainPour5Niveaux: Math.max(...g) }; }
              await idle();
            }
            console.table(out); return out;
          },

          report() {
            const c = calibration();
            const t = {}; BINS.forEach(([a, b], i) => { const x = c.bins[i]; t[`prevu ${Math.round(a * 100)}-${Math.min(100, Math.round(b * 100))} %`] = { combats: x.n, prevuMoyen: x.n ? Math.round(x.pred / x.n * 100) + ' %' : '-', reel: x.n ? Math.round(x.win / x.n * 100) + ' %' : '-' }; });
            console.table(t);
            const log = lsGet(LS.log, []).filter(g => g.s3 != null && g.etoiles != null), b3 = {};
            for (const g of log) { const k = g.s3 >= 0.9 ? '3 etoiles prevues >= 90 %' : g.s3 >= 0.6 ? '60-89 %' : 'moins de 60 %'; b3[k] ??= { combats: 0, troisEtoilesReelles: 0 }; b3[k].combats++; if (g.etoiles === 3) b3[k].troisEtoilesReelles++; }
            console.table(b3);
            return `${c.total} combats enregistres, dont ${log.length} avec le suivi des etoiles`;
          },
          // Raid « Le Destin Effacé » (5.20) : au salon, ton meilleur trio avec les cartes de tes partenaires ; en combat, l'action de
          // chacune de tes cartes ce tour (Rupture, Garde, attaque), calculee sur le PC d'apres l'annonce du boss et ce que tes partenaires
          // ont deja prevu. Lecture seule : l'etat est lu comme la page le lit (GET), rien n'est envoye au jeu, aucun clic.
          raidAdvisor() {
            const H = () => ({ credentials: 'include', headers: { Authorization: 'Bearer ' + (localStorage.getItem('kitsu_token') || '') } });
            if (!document.getElementById('kitsuRaidCss')) {
              const c = document.createElement('style'); c.id = 'kitsuRaidCss';
              c.textContent = '#kitsuRaid{top:70px;max-width:330px}'
                + '.kitsu-rr{outline:3px solid #2fd27a!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important}.kitsu-rg{outline:3px solid #ff7a2f!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(8,9,12,.55)!important}'
                + '.kitsu-ra{outline:2px dashed #ff7a2f!important;outline-offset:3px}.kitsu-rp{outline:3px solid #2fd27a!important;outline-offset:2px}'
                + '[data-kitsu-raid]{position:relative}[data-kitsu-raid]::after{content:attr(data-kitsu-raid);position:absolute;left:50%;top:-6px;transform:translate(-50%,-100%);z-index:9;pointer-events:none;white-space:nowrap;'
                + 'font:italic 700 12px/1.25 "Bahnschrift SemiBold Condensed","Bahnschrift Condensed",Bahnschrift,"Arial Narrow",system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:1px 7px;border-radius:5px 5px 5px 0;background:#ff7a2f;color:#140a04}'
                + '.kitsu-rr[data-kitsu-raid]::after,.kitsu-rp[data-kitsu-raid]::after{background:#2fd27a;color:#04140b}';
              document.head.appendChild(c);
            }
            const box = () => { let b = document.getElementById('kitsuRaid'); if (!b) { b = document.createElement('div'); b.id = 'kitsuRaid'; b.className = 'kitsu-panel'; document.body.appendChild(b); } return b; };
            const effacer = () => document.querySelectorAll('.kitsu-rr,.kitsu-rg,.kitsu-ra,.kitsu-rp,[data-kitsu-raid]').forEach(e => { e.classList.remove('kitsu-rr', 'kitsu-rg', 'kitsu-ra', 'kitsu-rp'); e.removeAttribute('data-kitsu-raid'); });
            const marquer = (el, cls, txt) => { if (!el) return; el.classList.add(cls); if (txt) el.setAttribute('data-kitsu-raid', txt); };
            const cacher = () => { const b = document.getElementById('kitsuRaid'); if (b) b.style.display = 'none'; effacer(); };
            const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const moi = () => { try { const p = JSON.parse(atob((localStorage.getItem('kitsu_token') || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return String(p.id ?? p.sub ?? p.uid ?? p.user_id ?? ''); } catch { return ''; } };
            // Ton siege : par ton identifiant, sinon par les cartes que la page t'affiche comme les tiennes.
            const siege = w => {
              const id = moi(), p = id && w.players?.find(x => String(x.user_id) === id); if (p) return p.seat;
              const k = document.querySelector('#view-raids .rf-own [data-raid-select], #view-raids [data-raid-select]')?.dataset.raidSelect; const m = /^p(\d)-/.exec(k || ''); if (m) return +m[1];
              const pris = [...document.querySelectorAll('#view-raids [data-r-action^="pick:"][aria-pressed="true"]')].map(b => +b.dataset.rAction.slice(5)).sort().join();
              const q = w.players?.find(x => (x.cards || []).map(Number).sort().join() === pris); return q ? q.seat : null;
            };
            const nomU = u => short(u?.id) || u?.name || '?';
            const LIB = { basic: 'Attaque', skill: 'Technique', ult: 'Ultime', guard: 'Garde', rupture: 'Rupture', revive: 'Reanimer' };
            let busy = false, rid = '', ridT = 0, cleTour = '', cleSalon = '', dernier = null, suivis = 0, nConseils = 0, compte = '', finis = new Set(lsGet('kitsu_ai_raids_finis', []));
            const salon = async (w, me) => {
              const part = (w.players || []).filter(p => p.seat !== me && p.cards?.length).map(p => p.cards.map(Number));
              const cle = JSON.stringify(part); const b = box(); b.style.display = 'block';
              if (cle !== cleSalon) { cleSalon = cle; b.innerHTML = '<div class="k-who">Raid · salon</div><div class="k-mute">Calcul de ton meilleur trio avec ' + (part.length ? 'les cartes de tes partenaires' : 'des partenaires inconnus') + '...</div>';
                const r = await localAsk('/raid', { salon: { partenaires: part } }, 60000); dernier = r;
                if (!r?.trios?.length) { b.innerHTML = '<div class="k-who">Raid · salon</div><div class="k-mute">' + (localPC.ok ? 'Aucun trio a proposer : lance « Raid : meilleur trio » dans le panneau KitsuAI.' : 'Lance KitsuAI sur ton PC pour le conseil du raid.') + '</div>'; return; }
                const t = r.trios[0], noms = (w.players || []).filter(p => p.seat !== me).map(p => esc(p.name)).join(' et ');
                b.innerHTML = `<div class="k-who">Raid · salon · <b>${part.length ? 'avec ' + noms : 'partenaires pas encore choisis'}</b></div><div class="k-move">${t.ids.map(i => esc(short(i))).join(' · ')}</div>`
                  + `<div class="k-chips"><span class="k-chip ok">Victoire ${t.victoire} %</span><span class="k-chip">Ta part ${t.part} %</span><span class="k-chip">${r.joueurs} joueur${r.joueurs > 1 ? 's' : ''}</span></div>`
                  + (r.joueurs < 3 ? '<div class="k-why">Moins de 3 joueurs : le Nuage de Cioccolata demande 2 Ruptures de 2 joueurs, et Secco 2 fissures.</div>' : '')
                  + '<div class="k-sec"><span>Autres trios</span><span>victoire</span></div>' + r.trios.map((x, i) => `<div class="k-row${i ? ' k-dim' : ''}"><span class="n">${i + 1}</span><span class="l">${x.ids.map(id => esc(short(id))).join(' · ')}</span><span class="p">${x.victoire} %</span><span class="k-bar"><b style="width:${x.victoire}%"></b></span></div>`).join('')
                  + `<div class="k-foot"><span>${r.raids} raids simules</span><span>${(r.ms / 1000).toFixed(1)} s</span><span>partenaires supposes niveau 99</span></div>`;
                accents(b);
              }
              effacer(); const t = dernier?.trios?.[0]; if (t) for (const id of t.ids) marquer(document.querySelector(`#view-raids [data-r-action="pick:${id}"]`), 'kitsu-rp', 'Prends');
            };
            const tour = async (w, me) => {
              const C = w.combat; if (!C?.battle) return; const b = box(); b.style.display = 'block';
              const intents = {}; for (const it of w.intents || []) { const p = w.players?.find(x => x.user_id === it.user_id); if (p && p.seat !== me && it.actions?.length) intents[p.seat] = it.actions; }
              const mesInt = (w.intents || []).find(it => w.players?.find(x => x.user_id === it.user_id)?.seat === me);
              if (C.mode !== 'PREPARE') { // resolution : on compte si le conseil a ete suivi (une fois par tour)
                if (dernier?.tour === C.turn && !dernier.compte && mesInt?.actions) { dernier.compte = 1; nConseils++; if (dernier.actions.every(a => (mesInt.actions.find(x => x.unit === a.unit)?.kind || 'guard') === a.kind)) suivis++; }
                effacer(); return;
              }
              const cle = C.turn + '|' + JSON.stringify(intents);
              if (cle !== cleTour) { cleTour = cle;
                const r = await localAsk('/raid', { tour: { combat: C, siege: me, intents } }, 15000);
                if (!r?.actions) { b.innerHTML = '<div class="k-who">Raid</div><div class="k-mute">' + (localPC.ok ? 'Conseil indisponible ce tour.' : 'Lance KitsuAI sur ton PC pour le conseil du raid.') + '</div>'; dernier = null; return; }
                dernier = { ...r, tour: C.turn };
                const U = k => C.battle.units.find(u => u.key === k), f = r.forecast || {}, act = r.actions;
                const forts = act.filter(a => ['rupture', 'guard', 'revive'].includes(a.kind));
                const titre = forts.length ? forts.map(a => esc(nomU(U(a.unit))) + ' ' + ({ rupture: 'rompt', guard: 'garde', revive: 'reanime' }[a.kind])).join(' · ') : 'Tout le monde frappe';
                const autresR = Object.entries(intents).filter(([, v]) => v.some(a => a.kind === 'rupture')).map(([p]) => esc(w.players.find(x => x.seat === +p)?.name || 'un partenaire'));
                const msg = act.some(a => a.kind === 'rupture') ? 'Rupture prete.' : act.some(a => a.kind === 'guard' && (f.marks || []).includes(a.unit)) ? 'Je protege.' : '';
                b.innerHTML = `<div class="k-who">${esc(f.title || 'Raid')}${f.breaks ? ` · <b>${f.breaks} Rupture${f.breaks > 1 ? 's' : ''}</b>` : ''}</div><div class="k-move">${titre}</div>`
                  + `<div class="k-chips"><span class="k-chip ok">Victoire ${r.victoire} %</span>${r.sansConseil < r.victoire ? `<span class="k-chip hot">Sinon ${r.sansConseil} %</span>` : ''}${autresR.length ? `<span class="k-chip ok">${autresR.join(', ')} rompt deja</span>` : ''}</div>`
                  + (forts.length ? `<div class="k-why">${forts.map(a => `<b>${esc(nomU(U(a.unit)))}</b> : ${esc(a.why)}`).join('<br>')}</div>` : '')
                  + '<div class="k-sec"><span>Tes cartes</span><span>action</span></div>' + act.map((a, i) => `<div class="k-row"><span class="n">${i + 1}</span><span class="l">${esc(nomU(U(a.unit)))} : ${LIB[a.kind] || a.kind}${a.target && a.kind !== 'revive' ? ' sur ' + esc(U(a.target)?.name || '') : a.kind === 'revive' ? ' ' + esc(nomU(U(a.target))) : ''}</span><span class="p">${a.degats ? '~' + a.degats.toLocaleString('fr-FR') : ''}</span></div>`).join('')
                  + (msg ? `<div class="k-sec"><span>Message rapide</span><span></span></div><div>« ${msg} »</div>` : '')
                  + `<div class="k-foot"><span>Reanimations <b>${r.revives ?? '-'}</b></span><span>Conseils suivis <b>${suivis}/${nConseils}</b></span><span>${r.ms} ms</span></div>`;
                accents(b);
              }
              effacer();
              for (const a of dernier?.actions || []) { const el = document.querySelector(`#view-raids [data-raid-select="${a.unit}"]`) || document.querySelector(`#view-raids [data-unit="${a.unit}"]`);
                marquer(el, a.kind === 'rupture' || a.kind === 'revive' ? 'kitsu-rr' : a.kind === 'guard' ? 'kitsu-rg' : 'kitsu-ra', LIB[a.kind]); }
            };
            const fin = async (w, me) => {
              effacer(); const C = w.combat || {}, b = box(); b.style.display = 'block';
              if (!finis.has(w.id)) { finis.add(w.id); lsSet('kitsu_ai_raids_finis', [...finis].slice(-50));
                const mines = (C.battle?.units || []).filter(u => u.side === 'ally' && u.owner === me).map(u => +u.id).filter(Boolean), autres = (C.battle?.units || []).filter(u => u.side === 'ally' && u.owner !== me).map(u => +u.id).filter(Boolean);
                localAsk('/raid', { fin: { id: w.id, gagne: w.status === 'WON', etape: C.stage, phase: C.phase, tour: C.turn, trio: mines, partenaires: autres, joueurs: (w.players || []).length, suivis, conseils: nConseils } }, 5000); }
              b.innerHTML = `<div class="k-who">Raid termine</div><div class="k-move">${w.status === 'WON' ? 'Destin brise' : 'Expedition terminee'}</div><div class="k-mute">${['Cioccolata', 'Secco', 'Diavolo'][C.stage] || ''}${C.stage === 2 ? ', phase ' + C.phase : ''} · tour ${C.turn || '-'} · conseils suivis ${suivis}/${nConseils}</div>`;
              accents(b);
            };
            clearInterval(window.__kitsuRaidT);
            window.__kitsuRaidT = setInterval(async () => {
              const v = document.getElementById('view-raids');
              if (document.hidden || !v || !v.offsetParent) { cacher(); return; }
              if (busy) return; busy = true;
              try {
                if (!rid && Date.now() - ridT > 10000) { ridT = Date.now(); const a = await fetch('/api/raids', H()); if (a.ok) rid = (await a.json()).active || ''; }
                if (!rid) { cacher(); return; }
                const r = await fetch('/api/raids/' + rid, H()); if (!r.ok) { rid = ''; cacher(); return; }
                const w = await r.json(), me = siege(w);
                if (compte !== rid) { compte = rid; suivis = 0; nConseils = 0; cleTour = ''; cleSalon = ''; }
                if (me == null) { cacher(); return; }
                if (w.status === 'LOBBY') await salon(w, me);
                else if (w.status === 'RUNNING') await tour(w, me);
                else { await fin(w, me); rid = ''; ridT = Date.now(); }
              } catch { } finally { busy = false; }
            }, 2500);
          },
          status() {
            const v = lsGet(LS.ver, null), T = this._train;
            return { version: v, poids: lsGet(LS.w, null) ? 'reentraines' : 'par defaut', entrainement: T ? { phase: T.phase, gen: T.gen, depart: T.start, meilleur: T.best, combats: T.runs } : 'aucun', calibration: calibration().total + ' combats' };
          },
          stop() {
            clearInterval(window.__kitsuAdvT); clearInterval(window.__kitsuRaidT); clearInterval(window.__kitsuTeamT); clearInterval(window.__kitsuPullT); clearInterval(window.__kitsuRwT); clearInterval(window.__kitsuPlanT); clearInterval(window.__kitsuGuideT); clearInterval(window.__kitsuDockT); clearInterval(window.__kitsuHealthT); clearInterval(window.__kitsuEnT); worker && worker.terminate && worker.terminate(); clearInterval(window.__kitsuHealthT);
            ['kitsuAdv', 'kitsuRaid', 'kitsuRaidCss', 'kitsuTeam', 'kitsuPull', 'kitsuPlan', 'kitsuRoad', 'kitsuGuide', 'kitsuGuideCss', 'kitsuToast', 'kitsuBadge', 'kitsuAdvCss', 'kitsuDock', 'kitsuDockCss', 'kitsuHealth', 'kitsuGoal'].forEach(id => document.getElementById(id)?.remove());
            clearMarks();
            return 'KitsuAI arrete';
          },
          sim: { step, cands, feat, policy, smartPol, score, evalLive, pool, runWin, runScore },
        };
        window.KitsuAI = KitsuAI;
        console.log('KitsuAI v3 pret : await KitsuAI.start()');
      })();

      window.KitsuAI.start().then(m => console.log('KitsuAI :', m)).catch(e => console.warn('KitsuAI :', e.message));
    };
    let tries = 0;
    const t = setInterval(() => {
      if (ready()) { clearInterval(t); boot(); }
      else if (++tries > 240) { clearInterval(t); console.warn('KitsuAI : jeu non detecte'); }
    }, 500);
  }
  // Pont vers le serveur local du PC (moteur/serveur.bat) : seulement /ping, /conseil, /poids, /equipes, /sauvegarde et /jeu, seulement vers 127.0.0.1.
  window.addEventListener('message', e => {
    const q = e.data && e.data.kitsuLocalReq; if (!q || !(/^\/ping(\?v=[\w.%-]*)?$/.test(q.path) || ['/conseil', '/poids', '/equipes', '/sauvegarde', '/jeu', '/raid', '/plan'].includes(q.path))) return;
    const reply = (ok, data) => window.postMessage({ kitsuLocalRes: q.id, ok, data }, '*');
    try {
      GM_xmlhttpRequest({ method: q.body ? 'POST' : 'GET', url: 'http://127.0.0.1:47123' + q.path, data: q.body ? JSON.stringify(q.body) : undefined, headers: { 'Content-Type': 'application/json', 'X-Kitsu-Script': '1' }, timeout: q.timeout || 3000,
        onload: r => { try { reply(true, JSON.parse(r.responseText)); } catch { reply(false); } }, onerror: () => reply(false), ontimeout: () => reply(false) });
    } catch { reply(false); }
  });
  const s = document.createElement('script');
  s.textContent = '(' + kitsuMain.toString() + ')();';
  (document.head || document.documentElement).appendChild(s);
  s.remove();
})();
