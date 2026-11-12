function alvo(c, k = 0.5, kAlt = 0.8, sMax = 8) {    // c = caixa normalizada {x, y, w, h}
  const s = Math.max(1, Math.min(k / c.w, kAlt / c.h, sMax));
  const lim = v => Math.min(0, Math.max(1 - s, v));   // a pintura sempre cobre a moldura
  return { s, tx: lim(0.5 - s * (c.x + c.w / 2)), ty: lim(0.5 - s * (c.y + c.h / 2)) };
}
function aproximar(moldura, caixa) {
  const p = moldura.querySelector('.pintura'), n = moldura.querySelector('.nitido'), { s, tx, ty } = alvo(caixa);
  const vez = moldura.vez = (moldura.vez || 0) + 1;   // invalida temporizador e evento de chamadas antigas
  p.style.setProperty('--s', s); p.style.setProperty('--tx', tx * 100 + '%'); p.style.setProperty('--ty', ty * 100 + '%');
  if (!n) return;
  const pronto = () => { if (moldura.vez === vez) n.classList.add('pronto'); };
  const ms = parseFloat(getComputedStyle(p).transitionDuration) * 1000;
  if (ms === 0) return pronto();
  p.addEventListener('transitionend', pronto, { once: true });
  setTimeout(pronto, ms + 400);                        // o evento pode não chegar; o temporizador garante
}
function afastar(moldura) {
  const p = moldura.querySelector('.pintura');
  moldura.vez = (moldura.vez || 0) + 1;
  moldura.querySelector('.nitido')?.classList.remove('pronto');
  ['--s', '--tx', '--ty'].forEach(v => p.style.removeProperty(v));
}
