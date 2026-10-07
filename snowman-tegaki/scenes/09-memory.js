/* 场景：memory（占位，待实现） */
TG.scene({
  id: 'memory',
  title: 'memory',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「memory」', g.W / 2, g.H / 2, { size: 90 });
  },
});
