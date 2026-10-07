/* 场景：flash（占位，待实现） */
TG.scene({
  id: 'flash',
  title: 'flash',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「flash」', g.W / 2, g.H / 2, { size: 90 });
  },
});
