/* 场景：waiting（占位，待实现） */
TG.scene({
  id: 'waiting',
  title: 'waiting',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「waiting」', g.W / 2, g.H / 2, { size: 90 });
  },
});
