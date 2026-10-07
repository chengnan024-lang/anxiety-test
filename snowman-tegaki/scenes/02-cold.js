/* 场景：cold（占位，待实现） */
TG.scene({
  id: 'cold',
  title: 'cold',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「cold」', g.W / 2, g.H / 2, { size: 90 });
  },
});
