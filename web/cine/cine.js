/* Caja Fácil · «Un día en tu bodega»: el scroll mueve la cámara por las nubes y pasa la hora del día. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixv = (A, B, t) => A.map((v, i) => lerp(v, B[i], t));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = () => innerWidth < 900;

  const film = $("#film"), photo = $("#photo"), grade = $("#grade"), dusk = $("#dusk"), scrim = $("#scrim"), intro = $("#intro"),
    cue = $("#cue"), top = $("#top"), clk = $("#clk"), ampm = $("#ampm"), fin = $("#fin"), canvas = $("#sky"), stage = $("#stage");
  const panels = [...document.querySelectorAll(".panel")].map((el) => ({ el, c: +el.dataset.c, txt: $(".txt", el), shot: $(".shot", el) }));

  // ───── Hora del día → colores del cielo ─────
  // [h, cielo arriba, horizonte, nube clara, nube sombra, sol, solX, solY, sol%, noche, nubes%]
  const K = [
    [0.00, [.06,.11,.32], [.96,.58,.38], [.98,.74,.60], [.30,.27,.46], [1,.75,.40], .20, -.30, 1.0, 0, 1],
    [0.30, [.16,.46,.84], [.80,.90,.99], [1,1,1],     [.62,.72,.86], [1,.95,.80], .12,  .28, .8, 0, 1],
    [0.65, [.20,.14,.42], [1,.45,.30],   [1,.62,.50], [.32,.22,.45], [1,.50,.30], -.22,-.20, 1.0, 0, 1],
    [1.00, [.01,.02,.07], [.08,.12,.30], [.38,.45,.70],[.06,.08,.18],[.6,.7,1],   .32,  .34, .2, 1, 1],
  ];
  function palette(h) {
    let i = 0; while (i < K.length - 2 && h > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], t = sm(a[0], b[0], h);
    return { top: mixv(a[1], b[1], t), hor: mixv(a[2], b[2], t), cl: mixv(a[3], b[3], t), cs: mixv(a[4], b[4], t), sun: mixv(a[5], b[5], t),
      sx: lerp(a[6], b[6], t), sy: lerp(a[7], b[7], t), sa: lerp(a[8], b[8], t), night: lerp(a[9], b[9], t) };
  }
  // progreso del scroll → hora (0 amanecer … 1 noche)
  const HP = [[0, 0], [.30, .20], [.38, .30], [.62, .50], [.72, .66], [.89, .92], [1, 1]];
  const hourOf = (p) => { for (let i = 0; i < HP.length - 1; i++) if (p <= HP[i + 1][0]) return lerp(HP[i][1], HP[i + 1][1], (p - HP[i][0]) / (HP[i + 1][0] - HP[i][0])); return 1; };
  // reloj que se ve (hora real del día)
  const CK = [[.30, 6.0], [.38, 6.6], [.465, 7], [.55, 10.5], [.635, 13], [.72, 16.5], [.805, 19], [.89, 21.5], [.93, 22.5]];
  const clockOf = (p) => { if (p <= CK[0][0]) return CK[0][1]; for (let i = 0; i < CK.length - 1; i++) if (p <= CK[i + 1][0]) return lerp(CK[i][1], CK[i + 1][1], (p - CK[i][0]) / (CK[i + 1][0] - CK[i][0])); return CK[CK.length - 1][1]; };
  const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

  // ───── WebGL: cielo y nubes que se atraviesan ─────
  let gl = null, U = {}, W = 0, H = 0;
  const FS = `precision highp float;
uniform vec2 uRes; uniform float uT,uDive,uSkyA,uCloudA,uSunA,uNight;
uniform vec3 uTop,uHor,uCL,uCS,uSunC; uniform vec2 uSunP,uM;
float hs(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*nz(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y+uM*.025;
  float g=clamp(gl_FragCoord.y/uRes.y,0.,1.);
  vec3 sky=mix(uHor,uTop,pow(g,.75));
  float d=length(uv-uSunP);
  sky+=uSunC*(.38/(1.+d*d*16.))*uSunA+uSunC*smoothstep(.07,.0,d)*uSunA;
  vec2 sg=floor((uv+4.)*vec2(70.));
  float st=step(.9972,hs(sg))*smoothstep(.34,.0,length(fract((uv+4.)*70.)-.5));
  sky+=vec3(st)*uNight*(.55+.45*sin(uT*2.+hs(sg+3.)*40.))*smoothstep(.15,.7,g);
  vec3 col=sky; float cov=0.;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float ph=fract(uDive+fi/6.);
    float sc=exp2(ph*3.3);
    float fade=smoothstep(0.,.2,ph)*smoothstep(1.,.6,ph);
    vec2 q=uv/sc*1.7+vec2(fi*7.3,fi*3.1)+vec2(uT*.012,0.);
    float dn=fbm(q)+(-uv.y*.12);
    float c=smoothstep(.50,.60,dn);
    float dl=fbm(q+normalize(uSunP+vec2(0.,.45))*.1);
    float lit=clamp(.45+(dn-dl)*9.,0.,1.);
    vec3 cc=mix(uCS,uCL,lit);
    float a=c*fade*uCloudA*.92;
    col=mix(col,cc,a); cov=max(cov,a);
  }
  float al=max(uSkyA,cov);
  gl_FragColor=vec4(col*al,al);
}`;
  function initGL() {
    try {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "high-performance" });
      if (!gl) throw 0;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw 0;
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      ["uRes", "uT", "uDive", "uSkyA", "uCloudA", "uSunA", "uNight", "uTop", "uHor", "uCL", "uCS", "uSunC", "uSunP", "uM"].forEach((n) => (U[n] = gl.getUniformLocation(pr, n)));
      resize();
    } catch (e) { gl = null; document.documentElement.classList.add("nogl"); }
  }
  function resize() {
    if (!gl) return;
    const k = mobile() ? .55 : Math.min(.8, devicePixelRatio * .6);
    W = Math.max(2, Math.round(canvas.clientWidth * k)); H = Math.max(2, Math.round(canvas.clientHeight * k));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
  }

  // ───── Scroll suave ─────
  let target = 0, cur = 0, mx = 0, my = 0, tmx = 0, tmy = 0, t0 = performance.now();
  const readScroll = () => { const max = film.offsetHeight - innerHeight; target = max > 0 ? clamp(scrollY / max) : 0; };
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", () => { resize(); readScroll(); });
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { tmx = e.clientX / innerWidth - .5; tmy = .5 - e.clientY / innerHeight; } }, { passive: true });
  addEventListener("keydown", (e) => { // flechas y espacio mueven la película de a un tramo
    const k = e.key; if (!/^(ArrowDown|ArrowUp|PageDown|PageUp| )$/.test(k)) return;
    const dir = (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) ? -1 : 1; e.preventDefault();
    const max = film.offsetHeight - innerHeight, step = .085, now = clamp(target + dir * step);
    scrollTo({ top: now * max, behavior: reduce ? "auto" : "smooth" });
  });

  function frame(now) {
    const dt = clamp((now - t0) / 1000, 0, .1); t0 = now;
    cur = reduce ? target : cur + (target - cur) * (1 - Math.pow(.0012, dt));
    mx += (tmx - mx) * .06; my += (tmy - my) * .06;
    const p = cur, hP = palette(hourOf(p)), mob = mobile();

    // cielo
    const dive = sm(0, 1, clamp(p / .34)) * 1.9 + now * 1e-5;
    const skyA = clamp(1 - sm(.27, .37, p) + sm(.92, .98, p));
    const cloudA = (1 - sm(.31, .41, p)) * 1 + sm(.9, .98, p) * .55;
    if (gl) {
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uT, reduce ? 0 : now * .001); gl.uniform1f(U.uDive, dive);
      gl.uniform1f(U.uSkyA, skyA); gl.uniform1f(U.uCloudA, clamp(cloudA)); gl.uniform1f(U.uSunA, hP.sa); gl.uniform1f(U.uNight, hP.night);
      gl.uniform3fv(U.uTop, hP.top); gl.uniform3fv(U.uHor, hP.hor); gl.uniform3fv(U.uCL, hP.cl); gl.uniform3fv(U.uCS, hP.cs); gl.uniform3fv(U.uSunC, hP.sun);
      gl.uniform2f(U.uSunP, hP.sx * (mob ? .5 : 1), hP.sy); gl.uniform2f(U.uM, mx, my);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    stage.style.setProperty("--sky", css(hP.top)); stage.style.setProperty("--hor", css(hP.hor));

    // foto de la bodega: aparece entre la niebla, se enfría o calienta según la hora
    const po = sm(.26, .37, p) * (1 - sm(.925, .975, p));
    photo.style.opacity = po;
    photo.style.transform = `scale(${lerp(1.42, 1.04, sm(.26, .52, p)) + sm(.52, .92, p) * .05}) translate3d(${-mx * 14}px,${my * 10}px,0)`;
    const nt = hP.night, rgba = (c, al) => `rgba(${c.map((v) => Math.round(v * 255)).join(",")},${al.toFixed(3)})`;
    grade.style.background = `linear-gradient(to top, ${rgba(hP.hor, po)}, ${rgba(hP.top, po)})`;
    dusk.style.background = `rgba(3,6,22,${(nt * .5 * po).toFixed(3)})`;
    const inPanels = sm(.33, .38, p) * (1 - sm(.915, .95, p));
    scrim.style.opacity = inPanels;

    // título gigante: la cámara lo atraviesa
    const ip = clamp(p / .19);
    intro.style.opacity = 1 - sm(.07, .19, p);
    intro.style.transform = `scale(${1 + Math.pow(ip, 1.6) * 9}) translate3d(${-mx * 10}px,${my * 8}px,0)`;
    intro.style.visibility = p > .2 ? "hidden" : "visible";
    cue.style.opacity = 1 - sm(.0, .03, p);

    // barra superior y reloj
    top.classList.toggle("on", p > .2 && p < .945);
    const hr = clockOf(p), hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60 / 5) * 5;
    clk.textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")}`; ampm.textContent = hh >= 12 ? "p. m." : "a. m.";
    $("#clock").style.opacity = sm(.3, .34, p) * (1 - sm(.9, .93, p));

    // paneles
    const w = .047;
    for (const P of panels) {
      const t = (p - P.c) / w, a = Math.abs(t), v = clamp(1 - (a - .55) / .45);
      P.el.style.opacity = v ? 1 : 0; P.el.style.visibility = v ? "visible" : "hidden";
      if (!v) continue;
      const dirx = mob ? 0 : 1, ent = t < 0 ? 1 : -1;
      P.txt.style.opacity = v;
      P.txt.style.transform = `translate3d(0,${t * 46}px,0)`;
      const x = (mob ? 0 : -t * 16) * (a > .55 ? 1 : a / .55 * 0 + 1);
      const rotY = mob ? 0 : -14 + t * -9, rotX = 5 + Math.abs(t) * 3;
      P.shot.style.opacity = v;
      P.shot.style.transform = mob
        ? `translate3d(0,${t * -40}px,${-a * 120}px) rotateX(${rotX}deg)`
        : `translate3d(${x}vw,${Math.sin(now * .0009 + P.c * 9) * 6 + t * -30}px,${-a * 260 + 40}px) rotateY(${rotY + mx * 6}deg) rotateX(${rotX + my * 4}deg)`;
    }

    // cierre
    const fo = sm(.935, .975, p);
    fin.style.opacity = fo; fin.style.transform = `translate3d(0,${(1 - fo) * 30}px,0)`; fin.classList.toggle("on", fo > .5);
    requestAnimationFrame(frame);
  }

  initGL(); readScroll(); cur = target; requestAnimationFrame(frame);
})();
