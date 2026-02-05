/**
 * Dither Generator
 * Interactive halftone/dither effect generator using Three.js
 */

(function () {
  const form = document.getElementById('halftone-form');
  const jsonInput = document.getElementById('json-input');
  const applyJsonBtn = document.getElementById('apply-json');
  const copyBtn = document.getElementById('copy-config');

  // --- UI LOGIC ---
  const toggleButton = document.getElementById('toggle-controls');
  const controlPanel = document.getElementById('control-panel');

  if (toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      controlPanel.classList.toggle('minimized');
      toggleButton.textContent = controlPanel.classList.contains('minimized') ? 'Show' : 'Hide';
    });
  }

  // COLORS
  const fgInput = document.getElementById('dotColorInput');
  const bgInput = document.getElementById('bgColorInput');
  const fgDisplay = document.getElementById('fg-display');
  const bgDisplay = document.getElementById('bg-display');
  const activeLabel = document.getElementById('active-target-label');
  const swapBtn = document.getElementById('swap-colors');
  let activeInput = fgInput;

  function updateColorVisuals() {
    if (fgDisplay && fgInput) fgDisplay.style.backgroundColor = fgInput.value;
    if (bgDisplay && bgInput) bgDisplay.style.backgroundColor = bgInput.value;
  }

  function setActiveTarget(input, displayElement, name) {
    activeInput = input;
    fgDisplay.classList.remove('active-target');
    bgDisplay.classList.remove('active-target');
    displayElement.classList.add('active-target');
    if (activeLabel) activeLabel.textContent = "Active: " + name;
  }

  if (fgInput && bgInput) {
    updateColorVisuals();
    fgInput.addEventListener('input', () => {
      updateColorVisuals();
      syncAll();
    });
    bgInput.addEventListener('input', () => {
      updateColorVisuals();
      syncAll();
    });
    fgDisplay.addEventListener('click', () => setActiveTarget(fgInput, fgDisplay, "Foreground"));
    bgDisplay.addEventListener('click', () => setActiveTarget(bgInput, bgDisplay, "Background"));

    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const temp = fgInput.value;
        fgInput.value = bgInput.value;
        bgInput.value = temp;
        updateColorVisuals();
        syncAll();
      });
    }
  }

  // SWATCHES & PRESETS
  document.querySelectorAll('.swatch').forEach(swatch => {
    swatch.addEventListener('click', function () {
      if (activeInput) {
        activeInput.value = this.value;
        updateColorVisuals();
        syncAll();
      }
    });
  });

  // Collapsible swatch groups
  document.querySelectorAll('.swatch-label').forEach(label => {
    if (label.closest('.swatch-favorites')) return;

    label.addEventListener('click', function (e) {
      if (this.closest('.ps-header')) return;

      const nextRow = this.nextElementSibling;
      if (nextRow && nextRow.classList.contains('swatch-row')) {
        this.classList.toggle('collapsed');
        nextRow.classList.toggle('collapsed');
      }
    });
  });

  // Initial collapse state
  document.querySelectorAll('.swatch-label').forEach(label => {
    const text = label.textContent.trim().toLowerCase();
    if (!['brand', 'grays', 'presets'].includes(text)) {
      label.classList.add('collapsed');
      const nextRow = label.nextElementSibling;
      if (nextRow && nextRow.classList.contains('swatch-row')) {
        nextRow.classList.add('collapsed');
      }
    }
  });

  // Video presets
  document.querySelectorAll('.preset-link').forEach(preset => {
    preset.addEventListener('click', function () {
      const videoInput = document.getElementById('videoSrcInput');
      const newSrc = this.getAttribute('data-src');
      if (videoInput && newSrc) {
        videoInput.value = newSrc;
        syncAll();
      }
    });
  });

  // --- JSON IMPORT/EXPORT ---
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const jsonString = JSON.stringify(controls, null, 2);
      if (jsonInput) jsonInput.value = jsonString;
      navigator.clipboard.writeText(jsonString).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = originalText, 2000);
      });
    });
  }

  if (applyJsonBtn && jsonInput) {
    applyJsonBtn.addEventListener('click', () => {
      try {
        const newConfig = JSON.parse(jsonInput.value);
        Object.keys(newConfig).forEach(key => {
          const input = form.querySelector(`[name="${key}"]`);
          if (input) {
            if (input.type === 'checkbox') input.checked = Boolean(newConfig[key]);
            else input.value = newConfig[key];
          }
        });
        updateColorVisuals();
        syncAll();
        applyJsonBtn.classList.add('success');
        setTimeout(() => applyJsonBtn.classList.remove('success'), 2000);
      } catch (err) {
        applyJsonBtn.classList.add('error');
        setTimeout(() => applyJsonBtn.classList.remove('error'), 2000);
      }
    });
  }

  let controls = {};

  function readControls() {
    const formData = new FormData(form);
    const safeFloat = (name, def) => {
      const val = parseFloat(formData.get(name));
      return isNaN(val) ? def : val;
    };

    controls = {
      dotColor: formData.get('dotColor') || '#C8C8C8',
      bgColor: formData.get('bgColor') || '#EDEDED',
      videoSrc: formData.get('videoSrc') || "https://cdn.jsdelivr.net/gh/jon-tet/bg-vids@main/dove.mp4",
      shapeMode: formData.get('shapeMode') || 'mix',
      morphStart: safeFloat('morphStart', 0.9),
      morphEnd: safeFloat('morphEnd', 1.0),
      gridSize: safeFloat('gridSize', 20.0),
      minRadius: safeFloat('minRadius', 0.2),
      maxRadius: safeFloat('maxRadius', 0.5),
      showColor: formData.get('showColor') ? 1.0 : 0.0,
      thresholdStart: safeFloat('thresholdStart', 0.0),
      thresholdEnd: safeFloat('thresholdEnd', 1.0),
      gridAngle: safeFloat('gridAngle', 90.0)
    };
  }

  function syncAll() {
    readControls();
    applyControls();
  }

  function initControls() {
    readControls();
    form.addEventListener('input', (e) => {
      if (e.target.id === 'json-input') return;
      syncAll();
    });
  }

  // --- THREE.JS INITIALIZATION ---
  initControls();

  const container = document.querySelector('.halftone-container');
  const canvas = document.getElementById('c');
  const video = document.getElementById('v');

  video.src = controls.videoSrc;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const texture = new THREE.VideoTexture(video);

  const uniforms = {
    u_texture: { value: texture },
    u_resolution: { value: new THREE.Vector2() },
    u_time: { value: 0 },
    u_textureScale: { value: new THREE.Vector2(1, 1) },
    u_gridSize: { value: controls.gridSize },
    u_minRadius: { value: controls.minRadius },
    u_maxRadius: { value: controls.maxRadius },
    u_morphStart: { value: controls.morphStart },
    u_morphEnd: { value: controls.morphEnd },
    u_thresholdStart: { value: controls.thresholdStart },
    u_thresholdEnd: { value: controls.thresholdEnd },
    u_angle: { value: 0 },
    u_bgColor: { value: new THREE.Color(controls.bgColor) },
    u_dotColor: { value: new THREE.Color(controls.dotColor) },
    u_showColor: { value: controls.showColor },
    u_shapeMode: { value: 2.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform vec2 u_textureScale;
      uniform float u_gridSize, u_minRadius, u_maxRadius, u_morphStart, u_morphEnd, u_thresholdStart, u_thresholdEnd, u_showColor, u_shapeMode, u_angle;
      uniform vec3 u_bgColor, u_dotColor;
      in vec2 vUv;
      out vec4 fragColor;

      vec3 linearToSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }
      float getGray(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec2 getCoverUV(vec2 uv) { return (uv - 0.5) * u_textureScale + 0.5; }
      mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

      void main() {
        vec2 pixelPos = vUv * u_resolution;
        vec2 center = u_resolution * 0.5;
        mat2 rot = rotate2d(u_angle);
        vec2 rotatedPos = rot * (pixelPos - center);
        vec2 gridIndex = floor(rotatedPos / u_gridSize);
        vec2 cellCenterRotated = (gridIndex + 0.5) * u_gridSize;
        vec2 cellUV = (transpose(rot) * cellCenterRotated + center) / u_resolution;

        vec3 col = texture(u_texture, getCoverUV(cellUV)).rgb;
        float z = smoothstep(u_thresholdStart, max(u_thresholdEnd, u_thresholdStart+0.01), getGray(col));

        float radius = mix(u_minRadius, u_maxRadius, z) * 0.5;
        vec2 localPos = (rotatedPos - cellCenterRotated) / u_gridSize;
        float m = smoothstep(u_morphStart, u_morphEnd, z);
        if(u_shapeMode == 0.0) m = 0.0; else if(u_shapeMode == 1.0) m = 1.0;

        float dist = mix(length(localPos), max(abs(localPos.x), abs(localPos.y)), m) - radius;
        float mask = 1.0 - smoothstep(-fwidth(dist), 0.0, dist);

        if (u_showColor > 0.5) { fragColor = texture(u_texture, getCoverUV(vUv)); return; }
        fragColor = vec4(linearToSRGB(mix(u_bgColor, u_dotColor, mask)), 1.0);
      }
    `
  });

  scene.add(new THREE.Mesh(geometry, material));

  function applyControls() {
    uniforms.u_dotColor.value.set(controls.dotColor);
    uniforms.u_bgColor.value.set(controls.bgColor);
    uniforms.u_gridSize.value = controls.gridSize;
    uniforms.u_minRadius.value = controls.minRadius;
    uniforms.u_maxRadius.value = controls.maxRadius;
    uniforms.u_morphStart.value = controls.morphStart;
    uniforms.u_morphEnd.value = controls.morphEnd;
    uniforms.u_showColor.value = controls.showColor;
    uniforms.u_thresholdStart.value = controls.thresholdStart;
    uniforms.u_thresholdEnd.value = controls.thresholdEnd;
    uniforms.u_angle.value = controls.gridAngle * (Math.PI / 180);

    if (controls.shapeMode === 'circle') uniforms.u_shapeMode.value = 0.0;
    else if (controls.shapeMode === 'square') uniforms.u_shapeMode.value = 1.0;
    else uniforms.u_shapeMode.value = 2.0;

    if (video.src !== controls.videoSrc) {
      video.src = controls.videoSrc;
      video.load();
    }
    updateCover();
  }

  function updateCover() {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    renderer.setSize(cw, ch, false);
    uniforms.u_resolution.value.set(cw, ch);
    const aspect = (cw / ch) / ((video.videoWidth || 1920) / (video.videoHeight || 1080));
    uniforms.u_textureScale.value.set(aspect > 1 ? 1 : aspect, aspect > 1 ? 1 / aspect : 1);
  }

  window.addEventListener('resize', updateCover);

  function animate() {
    uniforms.u_time.value = performance.now() * 0.001;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  video.onloadedmetadata = () => {
    video.play();
    updateCover();
    animate();
  };

  // Handle autoplay restrictions
  video.oncanplay = () => {
    video.play().catch(() => {
      // Add click-to-play fallback
      document.body.addEventListener('click', () => {
        video.play();
      }, { once: true });
    });
  };
})();
