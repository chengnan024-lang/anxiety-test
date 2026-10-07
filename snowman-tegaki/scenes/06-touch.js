/* 场景：touch（占位，待实现） */
TG.scene({
  id: 'touch',
  title: 'touch',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「touch」', g.W / 2, g.H / 2, { size: 90 });
  },
});
