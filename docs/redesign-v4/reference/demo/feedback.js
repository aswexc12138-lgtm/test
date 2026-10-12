/* 反馈辅助函数：数字变化、行高亮、徽标跳动、抖动、FLIP 重排、定位脉冲、快捷键回显、落点涟漪、依次落入、确认按钮、撤销型 Toast
 * 来源：「设备绘图 · 改版参考演示.html」（v3）原样提取，未改动。
 * 用法：Codex 按这里的类名 / 变量名 / 关键帧实现，接入 xuyu 时颜色一律用主题变量（规格 T-03 映射）。
 * 与 v4 规格冲突时以规格为准。
 * 依赖：$ / $$ 为 querySelector / querySelectorAll 的简写；#toastHost 为 Toast 容器。
 * 在 React 里改写成 hook 或工具函数即可，行为（时长、减少动效时的分支）保持一致。
 */

const root = document.documentElement;
const reduced = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = id => `<svg class="i"><use href="#i-${id}"/></svg>`;
const wait = ms => new Promise(r => setTimeout(r, ms));
function replayClass(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); el.addEventListener('animationend', () => el.classList.remove(cls), { once: true }); }
function moveIndicator(container, active, ind) { const c = container.getBoundingClientRect(), a = active.getBoundingClientRect(); ind.style.transform = `translateX(${a.left - c.left}px) scaleX(${a.width / 100})`; }
function moveSegThumb(seg) { const a = seg.querySelector('[aria-selected="true"],[aria-checked="true"]'); const t = seg.querySelector('.ui-seg__thumb'); if (!a || !t || !seg.offsetParent) return; const s = seg.getBoundingClientRect(), r = a.getBoundingClientRect(); t.style.width = r.width + 'px'; t.style.transform = `translateX(${r.left - s.left}px)`; }
function animateNumber(el, next, { showDelta = false, dec = 0 } = {}) {
  const prev = Number(el.dataset.value ?? el.textContent ?? 0); if (prev === next) return;
  el.dataset.value = next; el.textContent = next.toFixed(dec);
  replayClass(el, next > prev ? 'fx-num--up' : 'fx-num--down');
  if (showDelta && !reduced()) { const d = document.createElement('span'); const diff = next - prev; d.className = 'fx-delta' + (diff < 0 ? ' fx-delta--neg' : ''); d.textContent = (diff > 0 ? '+' : '−') + Math.abs(diff); const host = el.offsetParent || el.parentElement; const r = el.getBoundingClientRect(), h = host.getBoundingClientRect(); d.style.left = (r.right - h.left + 4) + 'px'; d.style.top = (r.top - h.top) + 'px'; host.appendChild(d); d.addEventListener('animationend', () => d.remove(), { once: true }); }
}
function countUp(el, to, dec = 0) { if (reduced()) { el.textContent = to.toFixed(dec); return; } const t0 = performance.now(); const step = t => { const p = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
const flashRow = el => replayClass(el, 'fx-flash');
const bump = el => replayClass(el, 'fx-bump');
const shake = el => replayClass(el, 'fx-shake');
function flip(container, mutate, sel = ':scope > *') { const items = $$(sel, container); const first = new Map(items.map(el => [el, el.getBoundingClientRect()])); mutate(); if (reduced()) return; $$(sel, container).forEach(el => { const f = first.get(el); if (!f) return; const l = el.getBoundingClientRect(); const dx = f.left - l.left, dy = f.top - l.top; if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2,0,0,1)' }); }); }
function locate(el) { if (!el) return; el.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); replayClass(el, 'fx-locate'); }
function kbdEcho(cmd) { replayClass($(`[data-command="${cmd}"]`), 'fx-kbd-echo'); }
function ripple(host, x, y, color = 'var(--paper-point)') { if (reduced()) return; const r = document.createElement('span'); r.className = 'fx-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.setProperty('--ripple-color', color); host.appendChild(r); r.addEventListener('animationend', () => r.remove(), { once: true }); }
function staggerDropIn(els) { els.forEach((el, i) => { if (!el) return; el.style.animationDelay = Math.min(i, 10) * 30 + 'ms'; replayClass(el, 'fx-drop-in'); }); }
async function confirmButton(btn, work, doneLabel = '已完成') {
  const html = btn.innerHTML; btn.style.minWidth = btn.offsetWidth + 'px'; btn.setAttribute('aria-busy', 'true');
  try { const r = await work(); btn.removeAttribute('aria-busy'); btn.dataset.state = 'done'; btn.innerHTML = `<svg class="fx-check" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M3 8.5l3.2 3L13 5"/></svg>${doneLabel}`; await wait(reduced() ? 400 : 900); return r; }
  catch (e) { btn.removeAttribute('aria-busy'); shake(btn); throw e; }
  finally { delete btn.dataset.state; btn.innerHTML = html; btn.style.minWidth = ''; }
}

let currentToast = null;
function toast(msg, opts = {}) {
  dismissToast(true);
  const ms = opts.ms ?? (opts.action ? 6000 : 4000);
  const el = document.createElement('div'); el.className = 'ui-toast'; el.setAttribute('role', 'status'); el.dataset.testid = 'toast';
  el.innerHTML = `<svg class="i ui-toast__icon" style="color:var(--success)"><use href="#i-check"/></svg><span></span>`; el.querySelector('span').textContent = msg;
  if (opts.action) { const b = document.createElement('button'); b.className = 'ui-toast__action'; b.textContent = opts.action.label; b.onclick = () => { opts.action.run(); dismissToast(); }; el.appendChild(b); el.style.setProperty('--toast-ms', ms + 'ms'); el.insertAdjacentHTML('beforeend', '<i class="ui-toast__timer"></i>'); }
  let remaining = ms, started = Date.now(), timer = 0;
  const arm = () => { timer = setTimeout(() => dismissToast(), remaining); started = Date.now(); };
  el.onmouseenter = () => { clearTimeout(timer); remaining -= Date.now() - started; el.querySelector('.ui-toast__timer')?.style.setProperty('animation-play-state', 'paused'); };
  el.onmouseleave = () => { arm(); el.querySelector('.ui-toast__timer')?.style.setProperty('animation-play-state', 'running'); };
  $('#toastHost').appendChild(el); arm(); currentToast = { el, clear: () => clearTimeout(timer) };
}
function dismissToast(immediate) { if (!currentToast) return; const { el, clear } = currentToast; clear(); currentToast = null; if (immediate || reduced()) { el.remove(); return; } el.dataset.leaving = ''; el.addEventListener('animationend', () => el.remove(), { once: true }); }

/* ---------- 以下两个函数由演示页的接线代码整理而来 ---------- */

/** 按住 +/− 连发，越按越快（数量步进器）。onStep 返回 false 时停止（例如已经减到 0）。 */
function holdRepeat(button, onStep) {
  let delay = 380, timer = 0;
  const stop = () => { clearTimeout(timer); button.removeEventListener('pointerup', stop); button.removeEventListener('pointerleave', stop); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (onStep() === false) return;
    const tick = () => { if (onStep() === false) return stop(); delay = Math.max(40, delay * 0.82); timer = setTimeout(tick, delay); };
    timer = setTimeout(tick, delay);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointerleave', stop);
  });
}

/** 点了不可用的按钮：轻摆一下，并用提示说明为什么不能用（而不是没反应）。 */
function explainDisabled(button, reason) {
  replayClass(button, 'fx-nope');
  button.dataset.tip = reason;
  button.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  setTimeout(() => { button.dataset.tip = ''; }, 1600);
}
