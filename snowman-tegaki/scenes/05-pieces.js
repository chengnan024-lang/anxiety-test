/* 场景：pieces（占位，待实现） */
TG.scene({
  id: 'pieces',
  title: 'pieces',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「pieces」', g.W / 2, g.H / 2, { size: 90 });
  },
});
