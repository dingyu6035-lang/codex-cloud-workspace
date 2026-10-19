import { createFlightScene } from './scene.js';
import './legacy.css';
import './style.css';

    (() => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      const scene = createFlightScene(document.getElementById('world'), W, H);
      const rendererLabel = document.getElementById('rendererLabel');
      function updateRendererLabel() {
        rendererLabel.textContent = scene.available ? 'THREE.JS · 3D 场景' : '兼容模式 · 2D 场景';
        document.documentElement.dataset.renderer = scene.available ? 'three' : 'canvas';
      }
      updateRendererLabel();
      const storeKey = 'wanhuSimulatorDemoSaveV2';
      const $ = (id) => document.getElementById(id);
      const ui = {
        coin: $('coinCount'), gem: $('gemCount'), flight: $('flightState'), location: $('currentLocation'), bestRun: $('bestRun'), bestHeight: $('bestHeight'),
        powderLevel: $('powderLevel'), chairLevel: $('chairLevel'), kitesLevel: $('kitesLevel'), appearanceLevel: $('appearanceLevel'), incomeLevel: $('incomeLevel'),
        powderEffect: $('powderEffect'), chairEffect: $('chairEffect'), kitesEffect: $('kitesEffect'), appearanceEffect: $('appearanceEffect'), incomeEffect: $('incomeEffect'),
        breakthroughTitle: $('breakthroughTitle'), breakthroughDescription: $('breakthroughDescription'), breakthroughButton: $('breakthroughButton'), toast: $('toast'),
        gmAmount: $('gmAmount'), gmAddCoins: $('gmAddCoins'), gmAddGems: $('gmAddGems')
      };

      const maxLevels = { powder: 999, chair: 99, kites: 299, appearance: 20, income: 299 };
      const speedDisplayMultiplier = 45;
      const sonicSpeedKmh = 1225;
      const shieldThreshold = sonicSpeedKmh / speedDisplayMultiplier;
      const fallbackSave = { coins: 420, gems: 5, bestHeight: 0, upgrades: { powder: 1, chair: 1, kites: 1, appearance: 1, income: 1 }, pulse: false };
      let save;
      try { save = { ...fallbackSave, ...JSON.parse(localStorage.getItem(storeKey) || 'null') }; } catch { save = { ...fallbackSave }; }
      save.upgrades = { ...fallbackSave.upgrades, ...(save.upgrades || {}) };

      const game = {
        mode: 'title',
        altitude: 0,
        bestRun: 0,
        speed: 0,
        rocketX: W * .5,
        targetX: W * .5,
        engine: false,
        left: false,
        right: false,
        items: [],
        particles: [],
        clouds: [],
        spawnCooldown: 0,
        flash: 0,
        message: '',
        messageSub: '',
        lastTime: 0,
        landedReason: '',
        gainedCoins: 0,
        gainedGems: 0,
        pulseTimer: 0,
        pulseReady: true,
        startedAt: 0,
        ignitionProgress: 0,
        ignitionHolding: false,
        landingHard: false,
        visualScroll: 0,
        milestoneIndex: 0,
        milestoneQueue: [],
        milestoneNotice: null
      };

      function getMaterialCeiling(level = save.upgrades.kites) {
        if (level >= maxLevels.kites) return Infinity;
        const progress = (level - 1) / (maxLevels.kites - 1);
        return 10 + 99999990 * Math.pow(progress, 3.2);
      }
      function getStats() {
        const powder = save.upgrades.powder;
        const rockets = save.upgrades.chair;
        const chairQuality = save.upgrades.kites;
        const income = save.upgrades.income;
        const legacyPowerProgress = Math.min(1, (powder - 1) / 298);
        const deepPowerProgress = Math.max(0, (powder - 299) / (maxLevels.powder - 299));
        const powerFlightProgress = legacyPowerProgress + .72 * Math.pow(deepPowerProgress, .85);
        const rocketEfficiency = .15 * Math.min(1, (rockets - 1) / 29) + .10 * Math.max(0, (rockets - 30) / (maxLevels.chair - 30));
        const singleThrust = .42 + 25.2 * Math.pow(legacyPowerProgress, 2) + 48 * Math.pow(deepPowerProgress, .8);
        const incomeProgress = (income - 1) / (maxLevels.income - 1);
        return {
          launchSpeed: singleThrust + .28 * (rockets - 1),
          coastDrag: (.0015 + .0065 * (legacyPowerProgress + .5 * deepPowerProgress)) * (1 - rocketEfficiency),
          altitudeScale: (.18 + 695 * Math.pow(powerFlightProgress, 3)) * (1 + .025 * (rockets - 1)),
          ceiling: getMaterialCeiling(chairQuality),
          control: 2.7 + rockets * .18,
          rocketLiftMultiplier: 1 + .025 * (rockets - 1),
          rocketCount: rockets,
          singleThrust,
          incomeMultiplier: 1 + 4 * Math.pow(incomeProgress, 1.15),
          pulse: save.pulse
        };
      }
      function getMaterial() {
        const names = ['松木铆接椅', '熟铜加固椅', '精钢骨架椅', '钛合金座椅', '陶瓷复合座舱', '星舟级座舱'];
        const level = save.upgrades.kites;
        if (level >= maxLevels.kites) return '天穹无限座舱';
        return names[Math.min(names.length - 1, Math.floor((level - 1) / (maxLevels.kites / names.length)))];
      }
      function getLocation(height) {
        const landmarks = [
          [0, '万户起飞台'], [10000, '对流层顶部 · 10 km'], [100000, '卡门线 · 100 km'],
          [400000, '近地轨道 · 400 km'], [20000000, 'GPS 轨道 · 20,000 km'],
          [35786000, '同步轨道 · 35,786 km'], [100000000, '月球航线入口 · 100,000 km'], [384400000, '月球距离 · 384,400 km']
        ];
        let current = landmarks[0][1];
        for (const [altitude, label] of landmarks) if (height >= altitude) current = label;
        return current;
      }
      const altitudeMilestones = [
        { height: 57, label: '比萨斜塔', detail: '57 m' },
        { height: 828, label: '世界最高建筑 · 哈利法塔', detail: '828 m' },
        { height: 8849, label: '珠穆朗玛峰', detail: '8,849 m' },
        { height: 11300, label: '鸟类最高飞行记录', detail: '约 11.3 km' },
        { height: 12000, label: '平流层起点', detail: '约 12 km' },
        { height: 100000, label: '大气层边缘 · 卡门线', detail: '100 km' },
        { height: 107960, label: '人类飞行器最高飞行记录 · X-15', detail: '约 108 km' },
        { height: 384400000, label: '月球距离', detail: '384,400 km' }
      ];
      function shieldActive() { return game.mode === 'play' && game.speed >= shieldThreshold; }
      function getScreenMotion(speed) {
        const softened = Math.sqrt(Math.max(0, speed));
        return {
          scroll: 1.0 + Math.min(7.0, softened * 1.05),
          itemFall: .9 + Math.min(8.0, softened * 1.15),
          cloud: .65 + Math.min(4.0, softened * .55)
        };
      }
      function getAppearance() {
        const stages = [
          ['万户原始座椅', '椅子上的火药火箭'], ['普通飞行器', '朴素机翼与螺旋桨'], ['轻型滑翔机', '轻型翼面与尾舵'], ['双翼巡航机', '稳定的双翼布局'],
          ['小火箭', '单级固体推进器'], ['双级火箭', '分离式火箭结构'], ['大火箭', '多联推进阵列'], ['轨道穿梭机', '可重复使用的轨道外壳'],
          ['星舟流线体', '更平滑的深空外壳'], ['离子环翼机', '环翼驱动的蓝色尾焰'], ['反重力巡航器', '悬浮式多引擎结构'], ['外星飞行装置', '未知文明的生物光纹'],
          ['量子棱镜舟', '棱镜光能外壳'], ['星门穿梭器', '环形跃迁装置'], ['维度滑翔器', '折叠翼与光带尾迹'], ['曲率预热舱', '曲率泡预热'],
          ['曲率跃迁仪', '开始校准空间折叠'], ['曲率迁移飞行器', '稳定曲率环推进'], ['深空文明方舟', '跨星系远航结构'], ['万户·无限迁移体', '终极曲率迁移飞行器']
        ];
        const level = save.upgrades.appearance;
        const stage = stages[Math.min(stages.length - 1, level - 1)];
        return { level, name: stage[0], description: stage[1] };
      }
      function appearanceMaterialGate(level) {
        const gates = [1, 1, 8, 16, 28, 45, 65, 90, 115, 140, 165, 185, 205, 225, 245, 265, 280, 292, 299, 299];
        return gates[Math.min(gates.length - 1, Math.max(0, level - 1))];
      }
      function appearanceLevelCap(material = save.upgrades.kites) {
        let cap = 1;
        for (let level = 2; level <= maxLevels.appearance; level++) { if (material >= appearanceMaterialGate(level)) cap = level; }
        return cap;
      }
      function getCraft() {
        const level = Math.min(save.upgrades.powder, save.upgrades.chair, save.upgrades.kites);
        const appearance = getAppearance();
        const stages = [
          ['木椅火箭', 'Lv.1–4 · 离地试飞'], ['竹骨火箭', 'Lv.5–8 · 穿过鸟群'], ['铁架推进器', 'Lv.9–12 · 挑战雷云'],
          ['云层穿梭机', 'Lv.13–17 · 云层航行'], ['近地飞船', 'Lv.18–22 · 进入高空'], ['万户一号', 'Lv.23–27 · 星海边缘'], ['万户星舟', 'Lv.28–30 · 宇宙飞船']
        ];
        const stage = stages[Math.min(stages.length - 1, Math.floor((level - 1) / 5))];
        if (appearance.level > 1) {
          const appearanceCraftTier = appearance.level <= 4 ? 1 : appearance.level <= 7 ? 3 : appearance.level <= 11 ? 5 : 6;
          return { level, name: appearance.name, range: appearance.description, tier: appearanceCraftTier, appearanceTier: appearance.level, futureTier: Math.max(0, appearance.level - 11) };
        }
        return { level, name: stage[0], range: stage[1], tier: Math.min(6, Math.floor((level - 1) / 5)), appearanceTier: 1, futureTier: 0 };
      }
      function rocketY() { return H * .73 - Math.min(160, game.altitude * 12); }
      function upgradeCost(name, level = save.upgrades[name]) {
        const base = Math.round(45 + 32 * Math.pow(level, 1.22));
        if (name === 'appearance') return Math.round(320 + 220 * Math.pow(level, 1.45));
        return name === 'chair' ? Math.round(base * 2.6) : base;
      }
      function getBatchQuote(name, requested = 1) {
        const levelCap = name === 'appearance' ? appearanceLevelCap() : maxLevels[name];
        const room = levelCap - save.upgrades[name];
        const limit = Math.min(room, requested === Infinity ? room : requested);
        let levels = 0;
        let cost = 0;
        while (levels < limit) {
          const nextCost = upgradeCost(name, save.upgrades[name] + levels);
          if (cost + nextCost > save.coins) break;
          cost += nextCost;
          levels += 1;
        }
        return { levels, cost };
      }
      function saveGame() { localStorage.setItem(storeKey, JSON.stringify(save)); }
      function format(n) { return Math.floor(n).toLocaleString('zh-CN'); }

      let toastTimer;
      function toast(text) {
        ui.toast.textContent = text;
        ui.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
      }

      function updatePanel() {
        const stats = getStats();
        ui.coin.textContent = format(save.coins);
        ui.gem.textContent = format(save.gems);
        const craft = getCraft();
        ui.flight.textContent = game.mode === 'play' ? craft.name + ' · 飞行中' : game.mode === 'landing' ? craft.name + ' · 正在回落' : game.mode === 'ignition' ? '起飞位 · 点火准备' : game.mode === 'result' ? '已结算' : craft.name + ' · 待命';
        ui.location.textContent = getLocation(['play', 'landing'].includes(game.mode) ? game.altitude : game.bestRun);
        ui.bestRun.textContent = `${format(game.bestRun)} m`;
        ui.bestHeight.textContent = `${format(save.bestHeight)} m`;
        for (const name of ['powder', 'chair', 'kites', 'appearance', 'income']) {
          const level = save.upgrades[name];
          const title = $(name + 'Level');
          const effect = $(name + 'Effect');
          const button = document.querySelector(`.upgrade-button[data-upgrade="${name}"]`);
          title.textContent = `Lv.${level} / ${maxLevels[name]}`;
          if (name === 'powder') effect.textContent = `单枚推力 ${Math.round(stats.singleThrust * 100)}% · 深空增压 ${level > 299 ? '已进入' : 'Lv.299 解锁'}`;
          if (name === 'chair') effect.textContent = `火箭 ×${stats.rocketCount} · 升力 +${Math.round((stats.rocketLiftMultiplier - 1) * 100)}%`;
          if (name === 'kites') {
            const nextGain = level < maxLevels.kites - 1 ? getMaterialCeiling(level + 1) - stats.ceiling : 0;
            effect.textContent = level >= maxLevels.kites ? `${getMaterial()} · 高度无限 · 直至引擎熄灭` : level === maxLevels.kites - 1 ? `${getMaterial()} · ${format(stats.ceiling)}m · 下级突破天穹` : `${getMaterial()} · ${format(stats.ceiling)}m${nextGain ? ` · 下级 +${format(nextGain)}m` : ''}`;
          }
          if (name === 'appearance') {
            const appearance = getAppearance();
            const nextGate = level < maxLevels.appearance ? appearanceMaterialGate(level + 1) : null;
            effect.textContent = `${appearance.name} · ${appearance.description}${nextGate && save.upgrades.kites < nextGate ? ` · 下级需材料 Lv.${nextGate}` : ''}`;
          }
          if (name === 'income') effect.textContent = `金币收益 ×${stats.incomeMultiplier.toFixed(2)}`;
          const editable = ['title', 'result'].includes(game.mode);
          const locked = name === 'appearance' && level < maxLevels.appearance && level >= appearanceLevelCap();
          if (level >= maxLevels[name]) { button.textContent = '已满级'; button.disabled = true; }
          else if (locked) { button.textContent = `材料 Lv.${appearanceMaterialGate(level + 1)} 解锁`; button.disabled = true; }
          else { button.textContent = `${upgradeCost(name)} 金币`; button.disabled = !editable || save.coins < upgradeCost(name); }
          document.querySelectorAll(`.batch-button[data-upgrade="${name}"]`).forEach((batchButton) => {
            const requested = batchButton.dataset.amount === 'max' ? Infinity : Number(batchButton.dataset.amount);
            const quote = getBatchQuote(name, requested);
            batchButton.disabled = locked || !editable || quote.levels === 0;
          });
        }
        if (save.pulse) {
          ui.breakthroughTitle.textContent = '钻石突破：脉冲点火已装配';
          ui.breakthroughDescription.textContent = '飞行中双击画面或按 Shift，可发动短时强推力。';
          ui.breakthroughButton.textContent = '已装配'; ui.breakthroughButton.disabled = true; ui.breakthroughButton.classList.add('ready');
        } else if (save.upgrades.powder < 8) {
          ui.breakthroughTitle.textContent = '钻石突破：脉冲点火';
          ui.breakthroughDescription.textContent = '火箭当量达到 Lv.8 后开启。';
          ui.breakthroughButton.textContent = '条件不足'; ui.breakthroughButton.disabled = true; ui.breakthroughButton.classList.remove('ready');
        } else {
          ui.breakthroughTitle.textContent = '钻石突破：脉冲点火';
          ui.breakthroughDescription.textContent = '消耗 4 枚钻石。飞行中双击画面或按 Shift，获得短时强推力。';
          ui.breakthroughButton.textContent = '4 钻石解锁'; ui.breakthroughButton.disabled = save.gems < 4 || !['title', 'result'].includes(game.mode); ui.breakthroughButton.classList.remove('ready');
        }
      }

      function buyUpgrade(name, requested = 1) {
        if (!['title', 'result'].includes(game.mode)) return;
        if (save.upgrades[name] >= maxLevels[name]) return;
        if (name === 'appearance' && save.upgrades.kites < appearanceMaterialGate(save.upgrades.appearance + 1)) { toast(`椅子材料达到 Lv.${appearanceMaterialGate(save.upgrades.appearance + 1)} 后，才能研究下一外观。`); return; }
        const quote = getBatchQuote(name, requested);
        if (quote.levels === 0) { toast('金币不足，再飞一局吧。'); return; }
        save.coins -= quote.cost;
        save.upgrades[name] += quote.levels;
        saveGame(); updatePanel();
        const labels = { powder: '火箭当量', chair: '火箭数量', kites: '椅子材料', appearance: '飞行器外观', income: '金币收益' };
        toast(`${labels[name]} +${quote.levels}`);
      }
      document.querySelectorAll('.upgrade-button[data-upgrade]').forEach((button) => button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade)));
      document.querySelectorAll('.batch-button[data-upgrade]').forEach((button) => button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade, button.dataset.amount === 'max' ? Infinity : Number(button.dataset.amount))));
      ui.breakthroughButton.addEventListener('click', () => {
        if (save.pulse || save.upgrades.powder < 8 || save.gems < 4 || !['title', 'result'].includes(game.mode)) return;
        save.gems -= 4; save.pulse = true; saveGame(); updatePanel(); toast('脉冲点火已装配。双击画面试试看！');
      });
      function gmAmount() { return Math.max(1, Math.floor(Number(ui.gmAmount.value) || 0)); }
      ui.gmAddCoins.addEventListener('click', () => {
        const amount = gmAmount(); save.coins += amount; saveGame(); updatePanel(); toast(`GM：已增加 ${format(amount)} 金币`);
      });
      ui.gmAddGems.addEventListener('click', () => {
        const amount = gmAmount(); save.gems += amount; saveGame(); updatePanel(); toast(`GM：已增加 ${format(amount)} 钻石`);
      });
      $('resetButton').addEventListener('click', () => {
        if (!confirm('确定清空当前存档吗？金币、钻石、升级和最高高度都将删除。')) return;
        localStorage.removeItem(storeKey);
        save = JSON.parse(JSON.stringify(fallbackSave)); saveGame(); resetToTitle(); updatePanel(); toast('存档已清空，万户重新回到起飞台。');
      });

      function resetToTitle() {
        Object.assign(game, { mode: 'title', altitude: 0, bestRun: 0, speed: 0, rocketX: W * .5, targetX: W * .5, engine: false, items: [], particles: [], spawnCooldown: 0, flash: 0, message: '', messageSub: '', landedReason: '', gainedCoins: 0, gainedGems: 0, pulseTimer: 0, pulseReady: true, ignitionProgress: 0, ignitionHolding: false, landingHard: false, visualScroll: 0, milestoneIndex: 0, milestoneQueue: [], milestoneNotice: null });
        makeClouds();
      }
      function startIgnition() {
        Object.assign(game, { mode: 'ignition', altitude: 0, bestRun: 0, speed: 0, rocketX: W * .5, targetX: W * .5, engine: false, items: [], particles: [], spawnCooldown: 0, flash: 0, landedReason: '', gainedCoins: 0, gainedGems: 0, pulseTimer: 0, pulseReady: true, ignitionProgress: 0, ignitionHolding: false, landingHard: false, visualScroll: 0, milestoneIndex: 0, milestoneQueue: [], milestoneNotice: null });
        toast('万户已坐上木椅。长按点燃火箭。'); updatePanel();
      }
      function launchRun() {
        const stats = getStats();
        Object.assign(game, { mode: 'play', altitude: 0, bestRun: 0, speed: stats.launchSpeed, items: [], particles: [], spawnCooldown: 42, flash: 5, landedReason: '', gainedCoins: 0, gainedGems: 0, pulseTimer: 0, pulseReady: true, ignitionProgress: 100, ignitionHolding: false, landingHard: false, visualScroll: 0, milestoneIndex: 0, milestoneQueue: [], milestoneNotice: null, startedAt: performance.now() });
        const coinY = rocketY() - 78;
        for (let i = 0; i < 3; i++) spawnItem('coin', W * .5, coinY - i * 28, { r: 10 });
        spark(game.rocketX, rocketY() + 28, '#ffcb62', 22);
        toast('升空！火箭将自动飞行，专心操控方向。'); updatePanel();
      }
      function beginLanding(reason, hard = false) {
        if (game.mode !== 'play') return;
        game.mode = 'landing';
        game.engine = false;
        game.landedReason = reason;
        game.landingHard = hard;
        game.pulseTimer = 0;
        game.items = game.items.filter((item) => item.type === 'coin' || item.type === 'gem');
        updatePanel();
      }
      function endRun(reason) {
        if (!['play', 'landing'].includes(game.mode)) return;
        game.mode = 'result'; game.engine = false; game.landedReason = reason;
        const incomeMultiplier = getStats().incomeMultiplier;
        const heightReward = Math.max(28, Math.floor(game.bestRun * 4));
        const safetyReward = reason === 'ceiling' ? 18 : 0;
        const coins = Math.floor(game.gainedCoins + (heightReward + safetyReward) * incomeMultiplier);
        const gems = game.gainedGems;
        save.coins += coins; save.gems += gems; save.bestHeight = Math.max(save.bestHeight, Math.floor(game.bestRun));
        saveGame(); updatePanel();
        const headline = reason === 'bird' ? '鸟群命中，紧急落地' : reason === 'lightning' ? '雷云阻挡，紧急落地' : reason === 'meteor' ? '陨石擦撞，紧急落地' : reason === 'satellite' ? '卫星轨道相撞，紧急落地' : reason === 'debris' ? '太空碎片命中，紧急落地' : reason === 'stall' ? '推力耗尽，万户平安回落' : '抵达材料极限，安全返航';
        game.message = headline;
        game.messageSub = `本局 ${format(game.bestRun)} m · +${coins} 金币${gems ? ` · +${gems} 钻石` : ''}`;
      }
      function triggerPulse() {
        if (!save.pulse || game.mode !== 'play' || !game.pulseReady) return;
        game.pulseTimer = 86; game.pulseReady = false; game.flash = 8;
        toast('脉冲点火！');
      }

      function makeClouds() {
        game.clouds = Array.from({ length: 9 }, (_, i) => ({ x: (i * 73 + 21) % (W + 90) - 45, y: (i * 103 + 20) % H, s: .5 + (i % 4) * .16, a: .13 + (i % 3) * .05 }));
      }
      function spawnItem(type, x, y, extra = {}) {
        const radii = { bird: 16, lightning: 22, meteor: 19, satellite: 24, debris: 14, coin: 11, gem: 11 };
        game.items.push({ type, x, y, r: extra.r || radii[type] || 11, spin: Math.random() * 6.28, ...extra });
      }
      function spawnWave() {
        const x = 42 + Math.random() * (W - 84);
        if (game.altitude < 45) {
          const count = 3 + Math.floor(Math.random() * 2);
          const y = Math.max(68, rocketY() - 145);
          for (let i = 0; i < count; i++) spawnItem('coin', Math.max(26, Math.min(W - 26, x + (i - (count - 1) / 2) * 36)), y - Math.abs(i - (count - 1) / 2) * 16);
          return;
        }
        if (game.altitude < 10000) {
          if (Math.random() < .28) {
            spawnItem('lightning', x, -55, { r: 24, drift: (Math.random() - .5) * .15 });
            if (Math.random() < .7) spawnItem('gem', Math.max(24, Math.min(W - 24, x + (Math.random() < .5 ? -62 : 62))), -88, { r: 10 });
            return;
          }
          if (Math.random() < .62) {
            const baseX = x;
            for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) spawnItem('bird', Math.max(25, Math.min(W - 25, baseX + (i - .5) * 48)), -52 - i * 16, { r: 15, drift: (Math.random() - .5) * .18 });
            if (Math.random() < .6) spawnItem('coin', Math.max(25, Math.min(W - 25, baseX + (Math.random() < .5 ? -75 : 75))), -84);
            return;
          }
        } else {
          const orbital = game.altitude >= 160000;
          const deepSpace = game.altitude >= 1000000;
          const roll = Math.random();
          if (orbital && roll < .30) {
            spawnItem('satellite', x, -58, { drift: (Math.random() - .5) * .12 });
            if (Math.random() < .62) spawnItem('gem', Math.max(24, Math.min(W - 24, x + (Math.random() < .5 ? -70 : 70))), -90, { r: 10 });
            return;
          }
          if ((orbital && roll < .54) || (deepSpace && roll < .68)) {
            spawnItem('debris', x, -40, { drift: (Math.random() - .5) * .42, r: 13 + Math.random() * 5 });
            if (Math.random() < .42) spawnItem('debris', Math.max(25, Math.min(W - 25, x + (Math.random() < .5 ? -48 : 48))), -77, { drift: (Math.random() - .5) * .42, r: 10 + Math.random() * 4 });
            return;
          }
          if (roll < .74) {
            spawnItem('meteor', x, -55, { drift: (Math.random() - .5) * .3, r: 16 + Math.random() * 7 });
            if (Math.random() < .48) spawnItem('coin', Math.max(25, Math.min(W - 25, x + (Math.random() < .5 ? -66 : 66))), -88);
            return;
          }
        }
        {
          const count = 2 + Math.floor(Math.random() * 3);
          const spacing = 34;
          for (let i = 0; i < count; i++) spawnItem('coin', Math.max(25, Math.min(W - 25, x + (i - (count - 1) / 2) * spacing)), -35 - Math.abs(i - (count - 1) / 2) * 12);
          if (game.altitude >= 10000 && Math.random() < .26) spawnItem('gem', x, -92);
        }
      }
      function spark(x, y, color, amount = 6) {
        for (let i = 0; i < amount; i++) game.particles.push({ x, y, vx: (Math.random() - .5) * 2.8, vy: (Math.random() - .5) * 2.8, life: 18 + Math.random() * 12, color, size: 1 + Math.random() * 2 });
      }
      function revealNextMilestone() {
        if (!game.milestoneNotice && game.milestoneQueue.length) game.milestoneNotice = { ...game.milestoneQueue.shift(), timer: 118, maxTimer: 118 };
      }
      function recordMilestones() {
        while (game.milestoneIndex < altitudeMilestones.length && game.altitude >= altitudeMilestones[game.milestoneIndex].height) {
          game.milestoneQueue.push(altitudeMilestones[game.milestoneIndex]);
          game.milestoneIndex += 1;
        }
        revealNextMilestone();
      }
      function updateMilestoneNotice(dt) {
        if (game.milestoneNotice) {
          game.milestoneNotice.timer -= dt;
          if (game.milestoneNotice.timer <= 0) game.milestoneNotice = null;
        }
        revealNextMilestone();
      }
      function collide(item) {
        const rx = game.rocketX, ry = rocketY();
        const dx = item.x - rx, dy = item.y - ry;
        return dx * dx + dy * dy < (item.r + 15) * (item.r + 15);
      }

      function update(delta) {
        const dt = Math.min(2.2, delta / 16.667);
        const stats = getStats();
        if (game.mode === 'ignition') {
          game.ignitionProgress = Math.max(0, Math.min(100, game.ignitionProgress + (game.ignitionHolding ? 1.35 : -.72) * dt));
          game.engine = game.ignitionHolding;
          if (game.ignitionHolding) {
            for (let i = 0; i < 2; i++) game.particles.push({ x: game.rocketX + (Math.random() - .5) * 12, y: rocketY() + 28, vx: (Math.random() - .5) * 1.5, vy: 1.8 + Math.random() * 2, life: 8 + Math.random() * 8, color: '#ffb34e', size: 1 + Math.random() * 2.5 });
          }
          if (game.ignitionProgress >= 100) { launchRun(); return; }
        }
        if (game.mode === 'play') {
          const pulsing = game.pulseTimer > 0;
          game.engine = game.speed > .05;
          if (pulsing) game.speed += .068 * dt;
          game.speed = Math.max(0, game.speed - stats.coastDrag * dt);
          game.pulseTimer = Math.max(0, game.pulseTimer - dt);
          const keyInput = (game.right ? 1 : 0) - (game.left ? 1 : 0);
          if (keyInput) game.targetX += keyInput * stats.control * 1.7 * dt;
          game.targetX = Math.max(20, Math.min(W - 20, game.targetX));
          game.rocketX += (game.targetX - game.rocketX) * Math.min(.40, .045 * stats.control) * dt;
          game.altitude += game.speed * stats.altitudeScale * dt;
          game.visualScroll += getScreenMotion(game.speed).scroll * dt;
          game.bestRun = Math.max(game.bestRun, game.altitude);
          recordMilestones();
          if (game.speed <= .02 && game.altitude > 3) { beginLanding('stall'); return; }
          if (Number.isFinite(stats.ceiling) && game.altitude >= stats.ceiling) { beginLanding('ceiling'); return; }
          game.spawnCooldown -= dt * (1 + Math.min(.65, game.speed * .025));
          if (game.spawnCooldown <= 0) { spawnWave(); game.spawnCooldown = game.altitude < 45 ? 62 + Math.random() * 18 : 40 + Math.random() * 27 - Math.min(14, game.altitude / 650); }
          const fall = getScreenMotion(game.speed).itemFall;
          for (let i = game.items.length - 1; i >= 0; i--) {
            const item = game.items[i];
            item.y += fall * dt;
            item.x += (item.drift || 0) * dt;
            item.spin += .07 * dt;
            if (collide(item)) {
              if (item.type === 'coin') { game.gainedCoins += Math.round(12 * getStats().incomeMultiplier); spark(item.x, item.y, '#f6d365'); game.items.splice(i, 1); continue; }
              if (item.type === 'gem') { game.gainedGems += 1; spark(item.x, item.y, '#7addff', 10); game.items.splice(i, 1); toast('获得一枚钻石！'); continue; }
              if (shieldActive()) {
                const shieldNames = { bird: '鸟群', lightning: '雷云', meteor: '陨石', satellite: '卫星', debris: '太空碎片' };
                game.flash = 4; spark(item.x, item.y, '#9eeaff', 15); game.items.splice(i, 1); toast(`高速保护罩弹开了${shieldNames[item.type] || '障碍物'}`); continue;
              }
              game.flash = 12; spark(item.x, item.y, item.type === 'bird' ? '#f0d6bb' : item.type === 'meteor' ? '#ff9e6e' : '#ffffff', 18); beginLanding(item.type, true); return;
            }
            if (item.y > H + 70) game.items.splice(i, 1);
          }
          if (game.speed > .05) {
            for (let i = 0; i < (pulsing ? 3 : 1); i++) game.particles.push({ x: game.rocketX + (Math.random() - .5) * 8, y: rocketY() + 32, vx: (Math.random() - .5) * 1.2, vy: 2 + Math.random() * 2.8, life: 10 + Math.random() * 8, color: pulsing ? '#d8f6ff' : '#ffb34e', size: 2 + Math.random() * 3 });
          }
        }
        if (game.mode === 'landing') {
          const descent = (game.landingHard ? .46 : .12) + game.altitude * (game.landingHard ? .030 : .012);
          const keyInput = (game.right ? 1 : 0) - (game.left ? 1 : 0);
          if (keyInput) game.targetX += keyInput * stats.control * .9 * dt;
          game.targetX = Math.max(20, Math.min(W - 20, game.targetX));
          game.rocketX += (game.targetX - game.rocketX) * Math.min(.28, .045 * stats.control) * dt;
          game.altitude = Math.max(0, game.altitude - descent * dt);
          for (let i = game.items.length - 1; i >= 0; i--) {
            const item = game.items[i];
            item.y += 1.35 * dt;
            item.spin += .05 * dt;
            if (collide(item)) {
              if (item.type === 'coin') { game.gainedCoins += Math.round(12 * getStats().incomeMultiplier); spark(item.x, item.y, '#f6d365'); game.items.splice(i, 1); continue; }
              if (item.type === 'gem') { game.gainedGems += 1; spark(item.x, item.y, '#7addff', 10); game.items.splice(i, 1); continue; }
            }
            if (item.y > H + 70) game.items.splice(i, 1);
          }
          if (game.altitude <= 0) { endRun(game.landedReason || 'stall'); return; }
        }
        const cloudDrift = game.mode === 'play' ? getScreenMotion(game.speed).cloud : game.mode === 'landing' ? .45 : .14;
        for (const cloud of game.clouds) { cloud.y += cloudDrift * dt * cloud.s; if (cloud.y > H + 60) { cloud.y = -70; cloud.x = Math.random() * W - 35; } }
        for (let i = game.particles.length - 1; i >= 0; i--) { const p = game.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) game.particles.splice(i, 1); }
        updateMilestoneNotice(dt);
        game.flash = Math.max(0, game.flash - dt);
      }

      function roundedRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
      function drawCloud(cloud) {
        ctx.save(); ctx.globalAlpha = cloud.a; ctx.fillStyle = '#f8fbff'; ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, 36 * cloud.s, 14 * cloud.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cloud.x + 28 * cloud.s, cloud.y + 4 * cloud.s, 27 * cloud.s, 12 * cloud.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cloud.x - 26 * cloud.s, cloud.y + 5 * cloud.s, 24 * cloud.s, 11 * cloud.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      function drawAirflow() {
        if (!['play', 'landing'].includes(game.mode)) return;
        ctx.save(); ctx.strokeStyle = 'rgba(240,249,255,.23)'; ctx.lineWidth = 1.2;
        const scroll = game.visualScroll;
        for (let i = 0; i < 13; i++) {
          const x = 18 + (i * 57) % (W - 36);
          const y = ((i * 83 + scroll * (1.2 + (i % 3) * .18)) % (H + 80)) - 40;
          const length = 18 + (i % 4) * 8;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (i % 2 ? 5 : -5), y + length); ctx.stroke();
        }
        ctx.restore();
      }
      function drawMilestone() {
        const marker = game.milestoneNotice;
        if (!marker) return;
        const progress = 1 - marker.timer / marker.maxTimer;
        const y = 126 + progress * 390;
        const alpha = Math.min(1, progress * 4, (1 - progress) * 4);
        ctx.save(); ctx.globalAlpha = Math.max(.12, alpha);
        ctx.strokeStyle = '#ffe49a'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(W - 15, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(8,23,48,.68)'; roundedRect(W / 2 - 125, y - 31, 250, 24, 8); ctx.fill();
        ctx.fillStyle = '#fff1b8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${marker.label} · ${marker.detail}`, W / 2, y - 15);
        ctx.fillStyle = '#ffe49a'; ctx.beginPath(); ctx.arc(16, y, 3, 0, Math.PI * 2); ctx.arc(W - 16, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      function drawGround() {
        const moving = game.mode === 'play' ? Math.min(220, game.altitude * 8 + game.visualScroll * .62) : game.mode === 'landing' ? Math.min(170, game.altitude * 7) : 0;
        const y = H * .80 + moving;
        if (y > H + 8) return;
        ctx.save();
        ctx.fillStyle = '#543d2e'; ctx.fillRect(0, y, W, H - y);
        ctx.fillStyle = '#a67947'; ctx.fillRect(0, y, W, 12);
        ctx.fillStyle = '#d7b36d'; ctx.fillRect(0, y, W, 3);
        ctx.strokeStyle = 'rgba(51,34,27,.55)'; ctx.lineWidth = 2;
        for (let x = -20; x < W + 25; x += 30) { ctx.beginPath(); ctx.moveTo(x, y + 17); ctx.lineTo(x + 16, y + 22); ctx.stroke(); }
        ctx.fillStyle = '#3d2e29'; ctx.fillRect(W * .5 - 42, y - 18, 84, 8);
        ctx.fillStyle = '#76523a'; ctx.fillRect(W * .5 - 31, y - 49, 5, 32); ctx.fillRect(W * .5 + 26, y - 49, 5, 32);
        ctx.restore();
      }
      function drawWanhu() {
        ctx.fillStyle = '#e7bd96'; ctx.beginPath(); ctx.arc(0, -17, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#30353e'; ctx.beginPath(); ctx.arc(0, -21, 5.8, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#7d3b37'; ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(7, -10); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f1d6ab'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-13, 0); ctx.moveTo(7, -7); ctx.lineTo(13, 0); ctx.stroke();
      }
      function drawRocket() {
        const x = game.rocketX, y = rocketY(); const craft = getCraft(); const rocketStats = getStats(); const boosterCount = Math.min(8, Math.ceil(rocketStats.rocketCount / 4));
        ctx.save(); ctx.translate(x, y); const shake = game.engine ? (Math.random() - .5) * (game.mode === 'ignition' ? .7 : 1.3) : 0; ctx.translate(shake, 0);
        if (craft.appearanceTier > 1 && craft.appearanceTier <= 4) {
          const propeller = Date.now() / 55;
          ctx.fillStyle = '#7f8a96'; ctx.strokeStyle = '#e3eef8'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-8, -8); ctx.lineTo(28, -5); ctx.lineTo(39, 1); ctx.lineTo(28, 7); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#aebcca'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-29, 20); ctx.lineTo(12, 9); ctx.lineTo(23, 9); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (craft.appearanceTier >= 3) { ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-26, -18); ctx.lineTo(13, -7); ctx.lineTo(22, -5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          ctx.fillStyle = '#5ba7ca'; ctx.beginPath(); ctx.ellipse(10, -5, 8, 5, 0, Math.PI, 0); ctx.fill();
          ctx.save(); ctx.translate(39, 1); ctx.rotate(propeller); ctx.strokeStyle = '#f4df9e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.restore();
          if (game.engine) { ctx.fillStyle = 'rgba(255,207,94,.65)'; ctx.beginPath(); ctx.ellipse(-42, 0, 13, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        } else if (craft.appearanceTier >= 5 && craft.appearanceTier <= 7) {
          const scale = .78 + craft.appearanceTier * .055;
          ctx.save(); ctx.scale(scale, scale); ctx.fillStyle = '#d7e0e8'; ctx.strokeStyle = '#52687d'; ctx.lineWidth = 2;
          roundedRect(-17, -50, 34, 80, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#d05d42'; ctx.beginPath(); ctx.moveTo(0, -68); ctx.lineTo(17, -34); ctx.lineTo(-17, -34); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#6aa9cc'; ctx.beginPath(); ctx.ellipse(0, -25, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#708093'; ctx.beginPath(); ctx.moveTo(-17, 7); ctx.lineTo(-36, 24); ctx.lineTo(-16, 23); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(17, 7); ctx.lineTo(36, 24); ctx.lineTo(16, 23); ctx.closePath(); ctx.fill();
          const engines = craft.appearanceTier === 5 ? 1 : craft.appearanceTier === 6 ? 2 : 4;
          for (let i = 0; i < engines; i++) { const ex = engines === 1 ? 0 : -13 + i * 26 / (engines - 1); ctx.fillStyle = '#4b5664'; ctx.fillRect(ex - 3, 26, 6, 18); if (game.engine) { ctx.fillStyle = '#ffca58'; ctx.fillRect(ex - 2, 44, 4, 13 + Math.random() * 10); } }
          ctx.restore();
        } else if (craft.appearanceTier >= 8 && craft.appearanceTier <= 11) {
          const glow = 175 + craft.appearanceTier * 7;
          ctx.fillStyle = `hsl(${glow}, 32%, 45%)`; ctx.strokeStyle = `hsl(${glow}, 85%, 76%)`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, -4, 38, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `hsl(${glow}, 66%, 58%)`; ctx.beginPath(); ctx.ellipse(0, -13, 18, 13, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#dffaff'; ctx.beginPath(); ctx.arc(0, -16, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `hsla(${glow}, 100%, 75%, .7)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, 4); ctx.lineTo(-50, 17); ctx.moveTo(28, 4); ctx.lineTo(50, 17); ctx.stroke();
          if (game.engine) { ctx.fillStyle = `hsla(${glow}, 100%, 70%, .75)`; ctx.beginPath(); ctx.ellipse(0, 21, 16, 24, 0, 0, Math.PI * 2); ctx.fill(); }
        } else if (craft.futureTier) {
          const phase = Date.now() / 320;
          const advanced = craft.futureTier;
          const hue = 185 + Math.min(95, advanced * 8);
          const aura = ctx.createRadialGradient(0, -8, 5, 0, -8, 64);
          aura.addColorStop(0, `hsla(${hue}, 95%, 72%, .42)`); aura.addColorStop(1, `hsla(${hue}, 95%, 62%, 0)`);
          ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, -8, 64, 50, 0, 0, Math.PI * 2); ctx.fill();
          if (advanced >= 7) {
            ctx.save(); ctx.globalAlpha = .38 + Math.sin(phase) * .13; ctx.strokeStyle = `hsl(${hue}, 94%, 74%)`; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
            ctx.beginPath(); ctx.ellipse(0, -7, 55 + Math.sin(phase) * 3, 32, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
          }
          ctx.fillStyle = `hsl(${hue}, 32%, 34%)`; ctx.strokeStyle = `hsl(${hue}, 92%, 76%)`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, 1, 45, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `hsl(${hue}, 46%, 48%)`; ctx.beginPath(); ctx.ellipse(0, -5, 28, 15, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = `hsla(${hue}, 100%, 78%, .9)`; ctx.beginPath(); ctx.ellipse(0, -10, 16, 13, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#edf8ff'; ctx.beginPath(); ctx.arc(0, -13, 4, 0, Math.PI * 2); ctx.fill();
          for (let i = -2; i <= 2; i++) { ctx.fillStyle = `hsl(${hue + 28}, 100%, 70%)`; ctx.beginPath(); ctx.arc(i * 14, 10 + Math.abs(i) * 1.5, 2.4, 0, Math.PI * 2); ctx.fill(); }
          if (advanced >= 4) { ctx.strokeStyle = `hsla(${hue + 35}, 100%, 82%, .78)`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-49, 13); ctx.moveTo(34, 0); ctx.lineTo(49, 13); ctx.stroke(); }
          if (advanced >= 9) {
            ctx.save(); ctx.globalAlpha = .58; ctx.strokeStyle = '#cbf8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-72, 6); ctx.bezierCurveTo(-48, -5, -45, 21, -18, 10); ctx.moveTo(72, 6); ctx.bezierCurveTo(48, -5, 45, 21, 18, 10); ctx.stroke(); ctx.restore();
          }
          if (game.engine) { ctx.fillStyle = `hsla(${hue + 38}, 100%, 70%, .8)`; ctx.beginPath(); ctx.ellipse(0, 28, 13 + advanced, 25 + advanced * 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
        } else if (craft.tier < 2) {
          ctx.strokeStyle = '#e8c38d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(-36, 16); ctx.lineTo(-24, 25); ctx.moveTo(15, -4); ctx.lineTo(36, 16); ctx.lineTo(24, 25); ctx.stroke();
          ctx.fillStyle = '#e3c984'; ctx.beginPath(); ctx.moveTo(-36, 16); ctx.lineTo(-25, 10); ctx.lineTo(-24, 25); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(36, 16); ctx.lineTo(25, 10); ctx.lineTo(24, 25); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#6d3d26'; roundedRect(-19, 9, 38, 17, 3); ctx.fill(); ctx.fillStyle = '#a36639'; ctx.fillRect(-15, 18, 30, 4);
          ctx.fillStyle = '#c29862'; roundedRect(-13, -12, 26, 25, 3); ctx.fill(); ctx.strokeStyle = '#4d3427'; ctx.lineWidth = 2; ctx.stroke();
          drawWanhu();
          ctx.fillStyle = '#c94b38'; ctx.beginPath(); ctx.moveTo(-11, 25); ctx.lineTo(-2, 4); ctx.lineTo(2, 4); ctx.lineTo(11, 25); ctx.closePath(); ctx.fill();
          const spacing = boosterCount === 1 ? 0 : 46 / (boosterCount - 1); const firstBooster = boosterCount === 1 ? -2 : -23;
          for (let i = 0; i < boosterCount; i++) { const bx = firstBooster + i * spacing; ctx.fillStyle = '#e7b956'; ctx.fillRect(bx, 23, 4, 17); if (game.engine) { ctx.fillStyle = '#ffcc5e'; ctx.fillRect(bx + .8, 40, 2.4, 7 + Math.random() * 7); } }
          if (rocketStats.rocketCount > 4) { ctx.fillStyle = '#fff0bd'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(`×${rocketStats.rocketCount}`, 26, 37); }
        } else if (craft.tier < 4) {
          ctx.fillStyle = '#c8d2d8'; roundedRect(-18, -40, 36, 72, 15); ctx.fill(); ctx.strokeStyle = '#536271'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#c94b38'; ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(18, -24); ctx.lineTo(-18, -24); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#6a9ac3'; ctx.beginPath(); ctx.arc(0, -20, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e7bd96'; ctx.beginPath(); ctx.arc(0, -21, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6e7a86'; ctx.beginPath(); ctx.moveTo(-18, 11); ctx.lineTo(-35, 24); ctx.lineTo(-15, 24); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(18, 11); ctx.lineTo(35, 24); ctx.lineTo(15, 24); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e6a744'; ctx.fillRect(-11, 28, 7, 21); ctx.fillRect(4, 28, 7, 21);
        } else {
          ctx.fillStyle = craft.tier > 5 ? '#e7edf3' : '#aebdca'; ctx.beginPath(); ctx.ellipse(0, -8, 27, 55, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4d6780'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#4fa5d1'; ctx.beginPath(); ctx.ellipse(0, -27, 13, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e7bd96'; ctx.beginPath(); ctx.arc(0, -28, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#49657e'; ctx.beginPath(); ctx.moveTo(-20, 18); ctx.lineTo(-44, 32); ctx.lineTo(-18, 33); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(20, 18); ctx.lineTo(44, 32); ctx.lineTo(18, 33); ctx.closePath(); ctx.fill();
          ctx.fillStyle = craft.tier > 5 ? '#95e2f4' : '#e4a747'; ctx.fillRect(-15, 38, 10, 24); ctx.fillRect(5, 38, 10, 24);
        }
        if (shieldActive()) {
          const flicker = .58 + Math.sin(Date.now() / 85) * .16;
          ctx.save(); ctx.globalAlpha = flicker; ctx.fillStyle = 'rgba(82, 205, 245, .12)'; ctx.beginPath(); ctx.ellipse(0, -8, 47, 71, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a4efff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(0, -8, 47, 71, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        }
        ctx.restore();
      }
      function drawCoin(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(Math.sin(item.spin) * .18); ctx.fillStyle = '#e6b338'; ctx.beginPath(); ctx.arc(0, 0, item.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffe49a'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#f8df78'; ctx.font = 'bold 12px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('金', 0, 1); ctx.restore();
      }
      function drawGem(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.spin); ctx.fillStyle = '#3eb8e6'; ctx.beginPath(); ctx.moveTo(0, -item.r); ctx.lineTo(item.r * .85, 0); ctx.lineTo(0, item.r); ctx.lineTo(-item.r * .85, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c5f5ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(0, -item.r + 3); ctx.lineTo(item.r * .45, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      function drawBird(item) {
        ctx.save(); ctx.translate(item.x, item.y); const flap = Math.sin(item.spin * 3) * 6; ctx.strokeStyle = '#4f3b3a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-7, -flap, 0, 0); ctx.quadraticCurveTo(8, -flap, 15, 3); ctx.stroke(); ctx.fillStyle = '#ead0b3'; ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      function drawLightning(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.fillStyle = '#f8f0ad'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, -25); ctx.lineTo(-11, 2); ctx.lineTo(-2, 2); ctx.lineTo(-12, 29); ctx.lineTo(15, -5); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      function drawMeteor(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.spin); const tail = ctx.createLinearGradient(-item.r * 2.2, 0, item.r, 0); tail.addColorStop(0, 'rgba(255,130,76,0)'); tail.addColorStop(.7, 'rgba(255,167,94,.8)'); tail.addColorStop(1, '#ffebc9'); ctx.strokeStyle = tail; ctx.lineWidth = item.r * .7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-item.r * 2.1, 0); ctx.lineTo(-item.r * .35, 0); ctx.stroke(); ctx.fillStyle = '#856f6c'; ctx.strokeStyle = '#f3ba85'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, item.r * .65, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(48,38,41,.62)'; ctx.beginPath(); ctx.arc(-item.r * .18, -item.r * .13, item.r * .18, 0, Math.PI * 2); ctx.arc(item.r * .22, item.r * .2, item.r * .12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      function drawSatellite(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(Math.sin(item.spin) * .18); ctx.fillStyle = '#dce8f7'; ctx.strokeStyle = '#7c93a9'; ctx.lineWidth = 1.5; ctx.fillRect(-9, -8, 18, 16); ctx.strokeRect(-9, -8, 18, 16); ctx.fillStyle = '#376aaa'; ctx.fillRect(-31, -6, 18, 12); ctx.fillRect(13, -6, 18, 12); ctx.strokeStyle = '#a8c6e8'; ctx.strokeRect(-31, -6, 18, 12); ctx.strokeRect(13, -6, 18, 12); ctx.fillStyle = '#ffc766'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      function drawDebris(item) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.spin); ctx.fillStyle = '#a4b5c5'; ctx.strokeStyle = '#e1eff9'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-item.r, -item.r * .25); ctx.lineTo(-item.r * .2, -item.r); ctx.lineTo(item.r, -item.r * .2); ctx.lineTo(item.r * .38, item.r); ctx.lineTo(-item.r * .72, item.r * .48); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      function drawHUD() {
        const craft = getCraft();
        const cardWidth = 174;
        ctx.save();
        ctx.fillStyle = 'rgba(8,23,48,.48)'; roundedRect(12, 14, cardWidth, 64, 10); ctx.fill(); roundedRect(W - 12 - cardWidth, 14, cardWidth, 64, 10); ctx.fill();
        ctx.fillStyle = '#d5e7ff'; ctx.font = '11px sans-serif'; ctx.fillText('高度', 24, 36); ctx.fillText('时速', W - cardWidth, 36);
        ctx.font = 'bold 18px Georgia'; ctx.fillStyle = '#fff'; ctx.fillText(`${format(game.altitude)} m`, 24, 60); ctx.fillText(`${Math.round(game.speed * speedDisplayMultiplier)} km/h`, W - cardWidth, 60);
        ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.textAlign = 'right'; ctx.fillText(craft.name, W - 14, 96); ctx.restore();
      }
      function drawTitle() {
        ctx.save(); ctx.fillStyle = 'rgba(7,19,39,.28)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
        ctx.fillStyle = '#f8e6bb'; ctx.font = 'bold 24px Georgia'; ctx.fillText('万户模拟器', W / 2, 222);
        ctx.fillStyle = '#e7edf7'; ctx.font = '14px sans-serif'; ctx.fillText('万户已经坐在木椅上，等待第一次点火', W / 2, 253);
        ctx.fillStyle = '#c8513d'; roundedRect(W / 2 - 92, 288, 184, 46, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('进入起飞位', W / 2, 317);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '12px sans-serif'; ctx.fillText('最初只能飞十余米；改装后才能飞进云层', W / 2, 365); ctx.restore();
      }
      function drawIgnition() {
        const progress = game.ignitionProgress;
        ctx.save(); ctx.fillStyle = 'rgba(7,19,39,.48)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
        ctx.fillStyle = '#fff3cc'; ctx.font = 'bold 20px Georgia'; ctx.fillText('点火准备', W / 2, 176);
        ctx.fillStyle = '#e8eef9'; ctx.font = '13px sans-serif'; ctx.fillText('万户已坐稳，请长按画面点燃火箭', W / 2, 205);
        ctx.fillStyle = 'rgba(255,255,255,.20)'; roundedRect(W / 2 - 108, 236, 216, 16, 8); ctx.fill();
        ctx.fillStyle = progress > 72 ? '#f1c45b' : '#c8513d'; roundedRect(W / 2 - 108, 236, 216 * progress / 100, 16, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`${Math.floor(progress)}%`, W / 2, 282);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '12px sans-serif'; ctx.fillText(game.ignitionHolding ? '火箭正在燃烧…不要松开' : '按住开始点火', W / 2, 314); ctx.restore();
      }
      function drawLanding() {
        ctx.save(); ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(7,19,39,.42)'; roundedRect(W / 2 - 108, 136, 216, 53, 12); ctx.fill();
        ctx.fillStyle = '#fff3cc'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(game.landingHard ? '紧急回落' : '引擎熄灭 · 正在回落', W / 2, 159);
        ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.font = '11px sans-serif'; ctx.fillText(game.landingHard ? '万户正落向起飞台' : '起飞台正在靠近', W / 2, 178); ctx.restore();
      }
      function drawResult() {
        ctx.save(); ctx.fillStyle = 'rgba(8,19,40,.65)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff3cc'; ctx.font = 'bold 20px Georgia'; ctx.fillText(game.message, W / 2, 250); ctx.fillStyle = '#e9eef7'; ctx.font = '14px sans-serif'; ctx.fillText(game.messageSub, W / 2, 284);
        ctx.fillStyle = '#2f806e'; roundedRect(W / 2 - 88, 320, 176, 46, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('返回起飞位', W / 2, 350); ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '12px sans-serif'; ctx.fillText('金币与钻石已结算到改装台', W / 2, 391); ctx.restore();
      }
      function renderLegacy() {
        const t = Math.min(1, game.altitude / 100000000);
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, t > .55 ? '#091b43' : '#19568c'); grad.addColorStop(.55, t > .4 ? '#1a4671' : '#4f95c0'); grad.addColorStop(1, '#d9b06e'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        if (game.altitude > 25000000 || getCraft().tier >= 5) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 26; i++) { const x = (i * 71 + 19) % W; const y = (i * 47 + 30) % (H * .62); ctx.fillRect(x, y, 1.4, 1.4); } }
        drawAirflow();
        for (const cloud of game.clouds) drawCloud(cloud);
        drawMilestone();
        if (game.altitude > 10000000 && game.mode === 'play') { ctx.fillStyle = 'rgba(47,49,88,.22)'; ctx.fillRect(0, 0, W, H * .28); }
        drawGround();
        for (const item of game.items) { if (item.type === 'coin') drawCoin(item); if (item.type === 'gem') drawGem(item); if (item.type === 'bird') drawBird(item); if (item.type === 'lightning') drawLightning(item); if (item.type === 'meteor') drawMeteor(item); if (item.type === 'satellite') drawSatellite(item); if (item.type === 'debris') drawDebris(item); }
        for (const p of game.particles) { ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 10); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        drawRocket(); drawHUD();
        const stats = getStats(); const ceilingText = Number.isFinite(stats.ceiling) ? `上限 ${format(stats.ceiling)}m` : '高度无限 · 直至引擎熄灭'; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${getMaterial()} · ${ceilingText}`, W - 14, 118);
        if (game.mode === 'play') {
          ctx.fillStyle = shieldActive() ? '#b9f5ff' : 'rgba(255,255,255,.52)';
          ctx.fillText(shieldActive() ? '音速保护罩：已激活（拦截所有障碍）' : `保护罩将在时速 ${sonicSpeedKmh} km/h 激活`, W - 14, 137);
          if (save.pulse) { ctx.fillStyle = game.pulseReady ? '#dff8ff' : 'rgba(255,255,255,.45)'; ctx.fillText(game.pulseReady ? 'Shift / 双击：脉冲点火' : '脉冲已使用 · 下局恢复', W - 14, 156); }
        }
        ctx.restore();
        if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.58, game.flash / 14)})`; ctx.fillRect(0, 0, W, H); }
        if (game.mode === 'title') drawTitle(); if (game.mode === 'ignition') drawIgnition(); if (game.mode === 'landing') drawLanding(); if (game.mode === 'result') drawResult();
      }
      function render() {
        updateRendererLabel();
        if (!scene.available) { renderLegacy(); return; }
        const craft = getCraft();
        scene.render({ game, stats: getStats(), craft, rocketY: rocketY(), shield: shieldActive() });
        ctx.clearRect(0, 0, W, H);
        drawMilestone(); drawHUD();
        ctx.save(); ctx.textAlign = 'right'; ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(223,239,251,.85)';
        ctx.fillText(Number.isFinite(getStats().ceiling) ? `${getMaterial()} · 上限 ${format(getStats().ceiling)}m` : '天穹无限 · 直至引擎熄灭', W - 14, 118);
        if (game.mode === 'play') {
          ctx.fillStyle = shieldActive() ? '#a7f5ed' : '#c9dfeb';
          ctx.fillText(shieldActive() ? '音速护盾 · 已激活' : '音速护盾 · 1,225 km/h 解锁', W - 14, 137);
          if (save.pulse) ctx.fillText(game.pulseReady ? 'Shift / 双击 · 脉冲就绪' : '脉冲已使用 · 下局恢复', W - 14, 156);
        }
        ctx.restore();
        if (game.flash > 0) { ctx.fillStyle = `rgba(180,232,255,${Math.min(.25, game.flash / 35)})`; ctx.fillRect(0, 0, W, H); }
        if (game.mode === 'title') drawTitle();
        if (game.mode === 'ignition') drawIgnition();
        if (game.mode === 'landing') drawLanding();
        if (game.mode === 'result') drawResult();
      }
      function frame(time) { const delta = game.lastTime ? time - game.lastTime : 16; game.lastTime = time; update(delta); render(); if (game.mode === 'play' && Math.floor(time / 300) !== Math.floor((time - delta) / 300)) updatePanel(); requestAnimationFrame(frame); }

      function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return (event.clientX - rect.left) / rect.width * W; }
      function pointerDown(event) {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        if (game.mode === 'title' || game.mode === 'result') { startIgnition(); return; }
        game.targetX = pointerPosition(event);
        if (game.mode === 'ignition') game.ignitionHolding = true;
      }
      function pointerMove(event) { if (game.mode === 'play' || game.mode === 'ignition') { event.preventDefault(); game.targetX = pointerPosition(event); } }
      function pointerUp() { if (game.mode === 'ignition') { game.ignitionHolding = false; game.engine = false; } }
      canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp); canvas.addEventListener('lostpointercapture', pointerUp); canvas.addEventListener('dblclick', (event) => { event.preventDefault(); triggerPulse(); });
      window.addEventListener('blur', () => { game.left = false; game.right = false; pointerUp(); });
      window.addEventListener('keydown', (event) => { if (event.target instanceof HTMLInputElement) return; if (['Space', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault(); if (event.code === 'Space') { if (game.mode === 'title' || game.mode === 'result') startIgnition(); else if (game.mode === 'ignition') game.ignitionHolding = true; else if (game.mode === 'play') triggerPulse(); } if (event.code === 'ArrowLeft') game.left = true; if (event.code === 'ArrowRight') game.right = true; if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') triggerPulse(); });
      window.addEventListener('keyup', (event) => { if (event.code === 'Space' && game.mode === 'ignition') { game.ignitionHolding = false; game.engine = false; } if (event.code === 'ArrowLeft') game.left = false; if (event.code === 'ArrowRight') game.right = false; });

      resetToTitle(); updatePanel(); requestAnimationFrame(frame);
    })();
