/* 场景：intro（占位，待实现） */
TG.scene({
  id: 'intro',
  title: 'intro',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「intro」', g.W / 2, g.H / 2, { size: 90 });
  },
});
