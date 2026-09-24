// Animated Charukesi mark, as plain HTML/SVG + CSS so the exact same animation can be
// used (1) as the boot splash injected into index.html before any JS has loaded and
// (2) inside the React app via <LogoLoader />.
//
// Geometry is traced from the logo PNG (137 x 180 units):
// orange bar rises, green bar drops, dark keys pop in, white cross draws, then a soft pulse.
// Brand colours from the logo artwork, green/grey text colours from P007.

// One 2.6 s cycle; the dots run at exactly half that (1.3 s) so every export loops seamlessly.
export const LOOP_MS = 2600;

const KEYFRAMES = `
@keyframes ck-rise{0%{transform:translateY(40px) scaleY(.2);opacity:0}18%{transform:none;opacity:1}88%{transform:none;opacity:1}100%{transform:translateY(-6px);opacity:0}}
@keyframes ck-drop{0%,6%{transform:translateY(-40px) scaleY(.2);opacity:0}24%{transform:none;opacity:1}88%{transform:none;opacity:1}100%{transform:translateY(6px);opacity:0}}
@keyframes ck-pop{0%,24%{transform:scale(0);opacity:0}34%{transform:scale(1.25);opacity:1}40%,88%{transform:scale(1);opacity:1}100%{transform:scale(.6);opacity:0}}
@keyframes ck-grow-y{0%,36%{transform:scaleY(0)}50%,88%{transform:scaleY(1)}100%{transform:scaleY(0)}}
@keyframes ck-grow-x{0%,46%{transform:scaleX(0)}60%,88%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@keyframes ck-pulse{0%,62%{transform:scale(1)}70%{transform:scale(1.06)}78%,100%{transform:scale(1)}}
@keyframes ck-word{0%,40%{opacity:.25;letter-spacing:.2em}60%,88%{opacity:1;letter-spacing:.06em}100%{opacity:.25}}
@keyframes ck-dot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-7px);opacity:1}}
`;

export const LOGO_LOADER_CSS = `${KEYFRAMES}
.ck-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:"Open Sans",system-ui,sans-serif}
.ck-mark{overflow:visible;display:block}
.ck-mark .ck-p{transform-box:fill-box;animation-duration:2.6s;animation-iteration-count:infinite;animation-timing-function:cubic-bezier(.45,0,.2,1)}
.ck-mark .ck-orange{transform-origin:50% 100%;animation-name:ck-rise}
.ck-mark .ck-green{transform-origin:50% 0%;animation-name:ck-drop}
.ck-mark .ck-key{transform-origin:50% 50%;animation-name:ck-pop}
.ck-mark .ck-key2{animation-delay:.08s}
.ck-mark .ck-v{transform-origin:50% 50%;animation-name:ck-grow-y}
.ck-mark .ck-h{transform-origin:50% 50%;animation-name:ck-grow-x}
.ck-mark .ck-all{transform-origin:68.5px 90px;animation:ck-pulse 2.6s cubic-bezier(.45,0,.2,1) infinite}
.ck-word{font-family:Georgia,"Times New Roman",serif;font-weight:700;letter-spacing:.06em;line-height:1;animation:ck-word 2.6s ease-in-out infinite}
.ck-word .ck-c{color:#1F5A2E}.ck-word .ck-k{color:#C14F11}
.ck-msg{color:#254229;font-size:16px;font-weight:600;letter-spacing:.02em;text-align:center}
.ck-dots{display:flex;gap:8px}
.ck-dots i{width:9px;height:9px;border-radius:50%;background:#639850;animation:ck-dot 1.3s ease-in-out infinite}
.ck-dots i:nth-child(2){animation-delay:.15s;background:#C14F11}.ck-dots i:nth-child(3){animation-delay:.3s;background:#254229}
@media (prefers-reduced-motion:reduce){
  .ck-mark .ck-p,.ck-mark .ck-all,.ck-word,.ck-dots i{animation:none!important}
  .ck-mark .ck-all{animation:ck-breathe 2s ease-in-out infinite!important}
  @keyframes ck-breathe{0%,100%{opacity:1}50%{opacity:.55}}
}
#ck-boot{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 30% 110%,#dcebe0 0%,#f5f9f3 45%,#ffffff 75%);transition:opacity .45s ease}
#ck-boot.ck-hide{opacity:0;pointer-events:none}
`;

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function logoLoaderHtml({ size = 110, message = '', wordmark = true } = {}) {
  const h = Math.round((size * 180) / 137);
  return `
<div class="ck-loader" role="status" aria-live="polite">
  <svg class="ck-mark" width="${size}" height="${h}" viewBox="0 0 137 180" aria-label="Charukesi">
    <g class="ck-all">
      <rect class="ck-p ck-orange" x="0" y="30" width="72" height="150" fill="#C14F11"/>
      <rect class="ck-p ck-green" x="72" y="0" width="65" height="153" fill="#3C7E24"/>
      <rect class="ck-p ck-key" x="59" y="29" width="26" height="25" fill="#254128"/>
      <rect class="ck-p ck-key ck-key2" x="59" y="129" width="26" height="24" fill="#254128"/>
      <rect class="ck-p ck-v" x="59" y="54" width="25" height="75" fill="#FFFFFF"/>
      <rect class="ck-p ck-h" x="34" y="79" width="75" height="25" fill="#FFFFFF"/>
    </g>
  </svg>
  ${wordmark ? `<div class="ck-word" style="font-size:${Math.round(size * 0.3)}px"><span class="ck-c">CHARU</span><span class="ck-k">KESI</span></div>` : ''}
  ${message ? `<div class="ck-msg">${esc(message)}</div>` : ''}
  <div class="ck-dots" aria-hidden="true"><i></i><i></i><i></i></div>
</div>`;
}

// Standalone animated SVG (for docs, slides, other apps). Same geometry, colours and keyframes
// as the in-app loader; the animation is CSS inside the SVG, so it plays in any modern browser.
export function logoLoaderSvg({ wordmark = true, dots = true } = {}) {
  const full = wordmark || dots;
  const vb = full ? '0 0 300 320' : '-12 -12 161 204';
  const [w, h] = full ? [300, 320] : [161, 204];
  const mark = `<g class="ck-all">
      <rect class="ck-p ck-orange" x="0" y="30" width="72" height="150" fill="#C14F11"/>
      <rect class="ck-p ck-green" x="72" y="0" width="65" height="153" fill="#3C7E24"/>
      <rect class="ck-p ck-key" x="59" y="29" width="26" height="25" fill="#254128"/>
      <rect class="ck-p ck-key ck-key2" x="59" y="129" width="26" height="24" fill="#254128"/>
      <rect class="ck-p ck-v" x="59" y="54" width="25" height="75" fill="#FFFFFF"/>
      <rect class="ck-p ck-h" x="34" y="79" width="75" height="25" fill="#FFFFFF"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" role="img" aria-label="Charukesi loading">
  <title>Charukesi loading animation</title>
  <style>${KEYFRAMES}
    .ck-p{transform-box:fill-box;animation-duration:2.6s;animation-iteration-count:infinite;animation-timing-function:cubic-bezier(.45,0,.2,1)}
    .ck-orange{transform-origin:50% 100%;animation-name:ck-rise}
    .ck-green{transform-origin:50% 0%;animation-name:ck-drop}
    .ck-key{transform-origin:50% 50%;animation-name:ck-pop}
    .ck-key2{animation-delay:.08s}
    .ck-v{transform-origin:50% 50%;animation-name:ck-grow-y}
    .ck-h{transform-origin:50% 50%;animation-name:ck-grow-x}
    .ck-all{transform-origin:68.5px 90px;animation:ck-pulse 2.6s cubic-bezier(.45,0,.2,1) infinite}
    .ck-word{font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.06em;animation:ck-word 2.6s ease-in-out infinite}
    .ck-dot{transform-box:fill-box;transform-origin:50% 50%;animation:ck-dot 1.3s ease-in-out infinite}
    .ck-d2{animation-delay:.15s}.ck-d3{animation-delay:.3s}
    @media (prefers-reduced-motion:reduce){.ck-p,.ck-all,.ck-word,.ck-dot{animation:none}}
  </style>
  ${full ? `<svg x="81" y="14" width="137" height="180" viewBox="0 0 137 180" overflow="visible">${mark}</svg>` : mark}
  ${wordmark ? `<text class="ck-word" x="150" y="248" text-anchor="middle" font-size="34"><tspan fill="#1F5A2E">CHARU</tspan><tspan fill="#C14F11">KESI</tspan></text>` : ''}
  ${dots ? `<g><circle class="ck-dot" cx="136" cy="286" r="4.5" fill="#639850"/><circle class="ck-dot ck-d2" cx="150" cy="286" r="4.5" fill="#C14F11"/><circle class="ck-dot ck-d3" cx="164" cy="286" r="4.5" fill="#254229"/></g>` : ''}
</svg>
`;
}
