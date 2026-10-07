/* 场景：sky（占位，待实现） */
TG.scene({
  id: 'sky',
  title: 'sky',
  draw(g, p, t, info) {
    g.bg(g.PAL.paper);
    g.text('「sky」', g.W / 2, g.H / 2, { size: 90 });
  },
});
