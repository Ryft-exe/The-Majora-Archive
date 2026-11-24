/*
 * Majora Archive — pointer life.
 * Tael follows the cursor, surfaces tilt toward it, and a small WebGL haze
 * drifts behind the hero. Every effect is optional: without WebGL, without a
 * fine pointer, or with reduced motion, the page stays a normal static page.
 */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const reduced = () => reduceMotion.matches;
  const fine = () => finePointer.matches;

  /* ------------------------------------------------------------ Tael */

  function initTael() {
    const root = document.documentElement;
    const cursor = document.getElementById("tael");
    const trail = document.getElementById("tael-trail");
    if (!cursor || !trail || !fine()) return;

    const image = cursor.querySelector(".tael-cursor__sprite");
    if (!image) return;

    const position = { x: -120, y: -120 };
    const target = { x: -120, y: -120 };
    let hasPointer = false;
    let visible = false;
    let lastMove = 0;
    let lastSpark = 0;
    let frame = 0;

    root.classList.add("tael-mode");
    if (reduced()) root.classList.add("tael-reduced");

    const show = () => {
      if (visible) return;
      visible = true;
      cursor.classList.add("on");
    };

    const hide = () => {
      visible = false;
      cursor.classList.remove("on");
      trail.replaceChildren();
    };

    const spark = (x, y) => {
      if (reduced()) return;
      const star = document.createElement("i");
      const angle = Math.random() * Math.PI * 2;
      const spread = 12 + Math.random() * 20;
      const gold = Math.random() > 0.7;
      star.className = "tael-spark";
      star.style.left = `${x + (Math.random() - 0.5) * 10}px`;
      star.style.top = `${y + (Math.random() - 0.5) * 8}px`;
      star.style.setProperty("--dx", `${Math.cos(angle) * spread}px`);
      star.style.setProperty("--dy", `${Math.sin(angle) * spread + 8}px`);
      star.style.setProperty("--spark-color", gold ? "#ffd98a" : "#ff9ad5");
      star.addEventListener("animationend", () => star.remove(), { once: true });
      trail.append(star);
      if (trail.childElementCount > 16) trail.firstElementChild?.remove();
    };

    const render = (now) => {
      const ease = reduced() ? 1 : 0.34;
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      position.x += dx * ease;
      position.y += dy * ease;

      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      cursor.style.setProperty("--lean", `${Math.max(-10, Math.min(10, dx * 0.55))}deg`);

      if (visible && !reduced() && hasPointer && now - lastMove < 90 && now - lastSpark > 58) {
        spark(position.x, position.y + 8);
        lastSpark = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    const onMove = (event) => {
      // Keep the sprite inside the viewport even if a synthetic pointer event
      // reports coordinates from a scrolled document.
      target.x = Math.max(0, Math.min(window.innerWidth - 1, event.clientX));
      target.y = Math.max(0, Math.min(window.innerHeight - 1, event.clientY));
      if (!hasPointer) {
        position.x = target.x;
        position.y = target.y;
        hasPointer = true;
      }
      lastMove = performance.now();
      show();
    };

    const onOver = (event) => {
      const hot = event.target instanceof Element && event.target.closest("a, button, summary");
      cursor.classList.toggle("is-hot", Boolean(hot));
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };

    const onImageError = () => {
      root.classList.remove("tael-mode", "tael-reduced");
      hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    image.addEventListener("error", onImageError);
    if (image.complete && image.naturalWidth === 0) onImageError();

    window.addEventListener(
      "pagehide",
      () => {
        cancelAnimationFrame(frame);
        root.classList.remove("tael-mode", "tael-reduced");
      },
      { once: true },
    );
  }

  /* ------------------------------------------------------- tilt cards */

  function initTilt() {
    if (!fine() || reduced()) return;

    document.querySelectorAll("[data-tilt]").forEach((element) => {
      const max = Number.parseFloat(element.dataset.tilt || "4") || 4;
      let queued = 0;
      let px = 0.5;
      let py = 0.5;

      const apply = () => {
        queued = 0;
        element.style.setProperty("--rx", `${((0.5 - py) * max).toFixed(2)}deg`);
        element.style.setProperty("--ry", `${((px - 0.5) * max).toFixed(2)}deg`);
        element.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        element.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      };

      element.addEventListener(
        "pointermove",
        (event) => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
          element.classList.add("is-tilting");
          if (!queued) queued = requestAnimationFrame(apply);
        },
        { passive: true },
      );

      element.addEventListener("pointerleave", () => {
        if (queued) {
          cancelAnimationFrame(queued);
          queued = 0;
        }
        element.classList.remove("is-tilting");
        element.style.setProperty("--rx", "0deg");
        element.style.setProperty("--ry", "0deg");
        element.style.setProperty("--mx", "50%");
        element.style.setProperty("--my", "50%");
      });
    });
  }

  /* ------------------------------------------------------ depth drift */

  function initDepth() {
    if (!fine() || reduced()) return;

    const layers = [...document.querySelectorAll("[data-depth]")].map((element) => ({
      element,
      depth: Number.parseFloat(element.dataset.depth || "0") || 0,
    }));
    if (!layers.length) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    const tick = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      for (const layer of layers) {
        layer.element.style.setProperty("--shift-x", `${(currentX * layer.depth).toFixed(2)}px`);
        layer.element.style.setProperty("--shift-y", `${(currentY * layer.depth).toFixed(2)}px`);
      }
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        targetY = (event.clientY / window.innerHeight - 0.5) * 2;
        start();
      },
      { passive: true },
    );

    document.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      start();
    });
  }

  /* ------------------------------------------------------- WebGL haze */

  function initAura() {
    const canvas = document.getElementById("aura");
    if (!canvas) return;

    let gl = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;

      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform float u_time;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec2(11.3, 7.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = uv;
        p.x *= u_resolution.x / u_resolution.y;
        p *= 1.35;

        float t = u_time * 0.035;
        vec2 q = vec2(
          fbm(p + vec2(t, -t * 0.6)),
          fbm(p + vec2(5.2, 1.3) - t * 0.4)
        );
        float cloud = fbm(p + q * 1.6 + vec2(t * 0.5, t * 0.2));
        cloud = smoothstep(0.28, 0.85, cloud);

        vec2 m = u_pointer / u_resolution;
        m.x *= u_resolution.x / u_resolution.y;
        m *= 1.35;
        float d = length(p - m);
        float halo = exp(-d * d * 2.4);

        vec3 indigo = vec3(0.13, 0.09, 0.3);
        vec3 violet = vec3(0.27, 0.16, 0.52);
        vec3 amber = vec3(0.85, 0.55, 0.26);

        vec3 color = mix(indigo, violet, clamp(cloud * 0.7 + halo * 0.3, 0.0, 1.0));
        color = mix(color, amber, pow(cloud, 4.0) * 0.18);

        float side = smoothstep(0.02, 0.82, uv.x);
        float band = smoothstep(0.0, 0.35, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y) * 0.35);
        float alpha = (cloud * 0.085 + halo * 0.1) * (0.25 + 0.75 * side) * band;

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      canvas.style.display = "none";
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      canvas.style.display = "none";
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const timeLocation = gl.getUniformLocation(program, "u_time");

    const hero = canvas.parentElement;
    let width = 1;
    let height = 1;
    let targetX = 0;
    let targetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    let onScreen = true;
    let started = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(1, Math.round(rect.width * ratio));
      const nextHeight = Math.max(1, Math.round(rect.height * ratio));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      pointerX = targetX || width * 0.72;
      pointerY = targetY || height * 0.46;
      if (reduced()) draw(12);
    };

    const draw = (seconds) => {
      pointerX += (targetX - pointerX) * 0.06;
      pointerY += (targetY - pointerY) * 0.06;
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform2f(pointerLocation, pointerX, pointerY);
      gl.uniform1f(timeLocation, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now) => {
      frame = 0;
      if (!onScreen || document.visibilityState === "hidden") return;
      draw(now / 1000);
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (frame || reduced() || !onScreen) return;
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        const rect = canvas.getBoundingClientRect();
        const ratio = width / Math.max(1, rect.width);
        targetX = (event.clientX - rect.left) * ratio;
        targetY = (event.clientY - rect.top) * ratio;
      },
      { passive: true },
    );

    const update = () => {
      resize();
      if (!started) {
        started = true;
        if (reduced()) draw(12);
      }
      if (reduced()) return;
      if (onScreen && document.visibilityState !== "hidden") start();
      else stop();
    };

    if ("ResizeObserver" in window && hero) {
      new ResizeObserver(resize).observe(hero);
    } else {
      window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
          update();
        },
        { rootMargin: "120px" },
      ).observe(canvas);
    }

    document.addEventListener("visibilitychange", update);
    window.addEventListener("resize", update);

    resize();
    started = true;
    if (reduced()) draw(12);
    else start();
  }

  initAura();
  initDepth();
  initTilt();
  initTael();
})();
