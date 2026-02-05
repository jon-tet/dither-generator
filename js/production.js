(function () {
  // #5 - Shared geometry across all instances
  const sharedGeometry = new THREE.PlaneGeometry(2, 2);
  // --- SHARED BLUE NOISE TEXTURE (Christoph Peters, CC0) ---
  // Pre-computed 64x64 tileable blue noise from momentsingraphics.de
  // Loaded once and shared across all instances for zero overhead.
  const blueNoiseLoader = new THREE.TextureLoader();
  const sharedBlueNoise = blueNoiseLoader.load(
    'https://cdn.jsdelivr.net/gh/Calinou/free-blue-noise-textures@master/64_64/LDR_LLL1_0.png'
  );
  sharedBlueNoise.minFilter = THREE.NearestFilter;
  sharedBlueNoise.magFilter = THREE.NearestFilter;
  sharedBlueNoise.wrapS = THREE.RepeatWrapping;
  sharedBlueNoise.wrapT = THREE.RepeatWrapping;
  const instances = [];
  document.querySelectorAll('.halftone-instance').forEach((container, index) => {
    const instance = initHalftone(container, index);
    if (instance) instances.push(instance);
  });
  // #1 - Single global animation loop
  function globalAnimate() {
    const time = performance.now() * 0.001;
    for (let i = instances.length - 1; i >= 0; i--) {
      const instance = instances[i];
      // #3 - Remove disconnected instances
      if (!instance.container.isConnected) {
        instance.cleanup();
        instances.splice(i, 1);
        continue;
      }
      // #2 - Skip rendering when not visible
      if (instance.isVisible) {
        instance.uniforms.u_time.value = time;
        instance.renderer.render(instance.scene, instance.camera);
      }
    }
    if (instances.length) {
      requestAnimationFrame(globalAnimate);
    }
  }
  if (instances.length) requestAnimationFrame(globalAnimate);
  function initHalftone(container, index) {
    // --- CONFIG ---
    const configAttr = container.getAttribute('data-halftone-config');
    let config = {};
    try {
      config = configAttr ? JSON.parse(configAttr) : {};
    } catch (e) {
      console.error("Invalid Config", e);
      return null;
    }
    // --- MIGRATE OLD CONFIG NAMES ---
    if (config.minRadius !== undefined && config.dotSize === undefined) {
      const min = config.minRadius;
      const max = config.maxRadius !== undefined ? config.maxRadius : 0.5;
      config.dotSize = (min + max) / 2;
      config.sizeVariation = (max - min) / 0.6;
    }
    if (config.thresholdStart !== undefined && config.contrast === undefined) {
      const start = config.thresholdStart;
      const end = config.thresholdEnd !== undefined ? config.thresholdEnd : 1.0;
      config.contrast = 1.0 / Math.max(0.1, end - start);
      config.brightness = -start * config.contrast;
    }
    const videoSrc = container.getAttribute('data-video-src') || config.videoSrc || "";
    const fgColor = container.getAttribute('data-fg-color') || config.dotColor || "#C8C8C8";
    const bgColor = container.getAttribute('data-bg-color') || config.bgColor || "#ededed";
    // --- DOM SETUP ---
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0'
      // No width/height here - controlled via JS to prevent stretch during resize
    });
    const video = document.createElement('video');
    video.src = videoSrc;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.style.display = 'none';
    container.style.overflow = 'hidden';
    container.appendChild(video);
    container.appendChild(canvas);
    // --- THREE.JS SETUP ---
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const safeVal = (v, def) => (v !== undefined ? v : def);
    const uniforms = {
      u_texture: { value: texture },
      u_blueNoise: { value: sharedBlueNoise },
      u_resolution: { value: new THREE.Vector2() },
      u_time: { value: 0 },
      u_textureScale: { value: new THREE.Vector2(1, 1) },
      u_gridSize: { value: safeVal(config.gridSize, 20.0) },
      u_dotSize: { value: safeVal(config.dotSize, 0.35) },
      u_sizeVariation: { value: safeVal(config.sizeVariation, 0.5) },
      u_opacityVariation: { value: safeVal(config.opacityVariation, 0.0) },
      u_morphStart: { value: safeVal(config.morphStart, 0.75) },
      u_morphEnd: { value: safeVal(config.morphEnd, 0.95) },
      u_contrast: { value: safeVal(config.contrast, 1.0) },
      u_brightness: { value: safeVal(config.brightness, 0.0) },
      u_angle: { value: safeVal(config.gridAngle, 0.0) * (Math.PI / 180) },
      u_bgColor: { value: new THREE.Color(bgColor) },
      u_dotColor: { value: new THREE.Color(fgColor) },
      u_showColor: { value: safeVal(config.showColor, 0.0) },
      u_shapeMode: { value: 2.0 },
      // --- SHIMMER ---
      u_shimmerAmount: { value: safeVal(config.shimmerAmount, 0.0) },
      u_invert: { value: 0.0 }
    };
    if (config.shapeMode === 'circle') uniforms.u_shapeMode.value = 0.0;
    else if (config.shapeMode === 'square') uniforms.u_shapeMode.value = 1.0;
    const material = new THREE.ShaderMaterial({
      uniforms,
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D u_texture;
        uniform sampler2D u_blueNoise;
        uniform vec2 u_resolution;
        uniform vec2 u_textureScale;
        uniform float u_gridSize;
        uniform float u_dotSize;
        uniform float u_sizeVariation;
        uniform float u_opacityVariation;
        uniform float u_morphStart;
        uniform float u_morphEnd;
        uniform float u_contrast;
        uniform float u_brightness;
        uniform vec3 u_bgColor;
        uniform vec3 u_dotColor;
        uniform float u_showColor;
        uniform float u_shapeMode;
        uniform float u_angle;
        uniform float u_time;
        uniform float u_shimmerAmount;
        in vec2 vUv;
        out vec4 fragColor;
        uniform float u_invert;
        const float BLUE_NOISE_SIZE = 64.0;
        vec3 linearToSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }
        float getGray(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec2 getCoverUV(vec2 uv) { return (uv - 0.5) * u_textureScale + 0.5; }
        mat2 rotate2d(float angle) { return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)); }
        void main() {
          vec2 pixelPos = vUv * u_resolution;
          vec2 center = u_resolution * 0.5;
          vec2 centeredPos = pixelPos - center;
          mat2 rot = rotate2d(u_angle);
          vec2 rotatedPos = rot * centeredPos;
          vec2 gridIndex = floor(rotatedPos / u_gridSize);
          vec2 cellCenterRotated = (gridIndex + 0.5) * u_gridSize;
          mat2 rotInv = transpose(rot);
          vec2 cellCenterUnrotated = (rotInv * cellCenterRotated) + center;
          vec2 cellUV = cellCenterUnrotated / u_resolution;
          vec2 videoUV = getCoverUV(cellUV);
          vec3 col = texture(u_texture, videoUV).rgb;
          float gray = getGray(col);
          // --- NOISE SHIMMER ---
          float cellNoise = texture(u_blueNoise, gridIndex / BLUE_NOISE_SIZE).r;
          float shimmer = sin(u_time * 3.0 + cellNoise * 6.283185) * u_shimmerAmount;
          gray += shimmer;
          // --- CONTRAST & BRIGHTNESS ---
          gray = (gray - 0.5) * u_contrast + 0.5 + u_brightness;
          gray = clamp(gray, 0.0, 1.0);                    
          float z = gray;
          if (u_invert > 0.5) z = 1.0 - z;
          
          // --- DOT SIZE & VARIATION ---
          float range = u_sizeVariation * 0.6;
          float minR = max(0.05, u_dotSize - range * 0.5);
          float maxR = min(0.95, u_dotSize + range * 0.5);
          float radius = mix(minR, maxR, z) * 0.5;
          vec2 localPos = (rotatedPos - cellCenterRotated) / u_gridSize;
          float morphFactor = smoothstep(u_morphStart, u_morphEnd, z);
          if (u_shapeMode == 0.0) morphFactor = 0.0;
          else if (u_shapeMode == 1.0) morphFactor = 1.0;
          float dMetric = mix(length(localPos), max(abs(localPos.x), abs(localPos.y)), morphFactor);
          float dist = dMetric - radius;
          float aa = fwidth(dist);
          float mask = 1.0 - smoothstep(-aa, 0.0, dist);
          float dotOpacity = mix(1.0, z, u_opacityVariation);
          if (u_showColor > 0.5) { fragColor = texture(u_texture, getCoverUV(vUv)); return; }
          vec3 finalColorLinear = mix(u_bgColor, u_dotColor, mask * dotOpacity);
          fragColor = vec4(linearToSRGB(finalColorLinear), 1.0);
        }
      `
    });
    // #5 - Use shared geometry
    scene.add(new THREE.Mesh(sharedGeometry, material));
    // --- VISIBILITY STATE ---
    let isVisible = false;
    function updateSize() {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;
      // Explicitly set canvas CSS size (prevents stretch mismatch)
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      const vw = video.videoWidth || 1920;
      const vh = video.videoHeight || 1080;
      uniforms.u_resolution.value.set(cw, ch);
      renderer.setSize(cw, ch, false);
      const containerAspect = cw / ch;
      const videoAspect = vw / vh;
      const ratio = containerAspect / videoAspect;
      if (ratio > 1) uniforms.u_textureScale.value.set(1.0, 1.0 / ratio);
      else uniforms.u_textureScale.value.set(ratio, 1.0);
    }
    // Synchronous resize with immediate render to prevent flash
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      // Render immediately to prevent blank frame flash
      if (isVisible) {
        renderer.render(scene, camera);
      }
    });
    resizeObserver.observe(container);
    video.addEventListener('loadedmetadata', updateSize);
    const startVideo = () => {
      video.play().catch(() => {});
    };
    // #2 - Track visibility for render skipping
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) startVideo();
        else video.pause();
      });
    });
    intersectionObserver.observe(container);
    // #3 - Cleanup function for when instance is removed
    function cleanup() {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      renderer.dispose();
      material.dispose();
      texture.dispose();
      video.pause();
      video.src = '';
      video.load();
    }
    // Return instance object for global loop
    return {
      container,
      uniforms,
      renderer,
      scene,
      camera,
      cleanup,
      get isVisible() { return isVisible; }
    };
  }
})();