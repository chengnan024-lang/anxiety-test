/* 角色测试页：把所有角色和道具摆在一起看 */
TG.scene({
  id: 'lineup',
  title: '角色一览',
  draw(g, p, t, info) {
    const C = TG.C, P = g.PAL;
    g.bg(P.paper);
    C.ground(g, 820, { seed: 3 });
    C.snowman(g, 260, 860, 1, { mood: 'calm', wind: 0.2, arms: [0.3, -0.2] });
    C.snowman(g, 640, 860, 0.85, { mood: 'sad', look: -0.6, tear: 0.6, snowCap: 1 });
    C.snowman(g, 980, 860, 0.85, { mood: 'happy', look: 0.6, wind: 1, blush: 1, arms: [0.8, 0.8] });
    C.snowman(g, 1320, 860, 0.85, { mood: 'hope', melt: 0.45, lookUp: 1 });
    C.snowman(g, 1660, 880, 0.85, { melt: 1 });
    C.flake(g, 140, 140, 90, { rot: t * 0.3, color: P.nightBlue, fill: P.snow });
    C.heart(g, 360, 150, 80, {});
    C.heart(g, 560, 150, 80, { crack: 0.6 });
    C.mitten(g, 760, 260, 0.9, 0.2);
    C.window(g, 900, 60, 300, 260, { tree: true, person: 1, t });
    C.tree(g, 1380, 420, 0.6, { t });
    C.person(g, 1520, 420, 0.8, { scarf: true });
    C.lamp(g, 1760, 760, 0.9);
    C.drop(g, 1640, 120, 1.4);
    C.moon(g, 1820, 120, 50, { phase: 0.5, sky: P.paper });
    C.breath(g, 340, 520, t, {});
    g.text('雪人 · 角色一览', 960, 1000, { size: 64, shadow: { color: P.red, dx: 4, dy: 4 } });
  },
});
TG.scene({
  id: 'night',
  title: '夜景测试',
  dark: true,
  draw(g, p, t, info) {
    const C = TG.C, P = g.PAL;
    g.bg([P.nightDeep, P.night, P.nightBlue]);
    C.moon(g, 1600, 180, 70, { phase: 0.4 });
    g.snow({ count: 160, seed: 2 });
    C.door(g, 300, 300, 260, 480, { open: 0, seed: 1 });
    C.door(g, 700, 300, 260, 480, { open: 0.6, seed: 2 });
    C.ground(g, 800, { seed: 9, color: '#e8eefa' });
    C.lamp(g, 1180, 840, 1);
    C.snowman(g, 1500, 900, 1, { mood: 'sad', look: -1, wind: 0.5, snowCap: 0.6, shiver: 0.5 });
    g.text('好想见你', 960, 120, { size: 80, color: '#fbfcff', vertical: false, progress: p });
    g.text('竖排的字\n第二列', 160, 120, { size: 56, color: '#fbfcff', vertical: true });
    g.vignette(0.4);
  },
});
TG.timeline([{ id: 'lineup', at: 0 }, { id: 'night', at: 0.5 }]);
