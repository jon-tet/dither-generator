/**
 * Dither Production Script
 * Embeddable halftone/dither effect for multiple instances
 *
 * Usage:
 * 1. Add a container with class "halftone-instance"
 * 2. Set data attributes for configuration:
 *    - data-video-src: URL of the video source
 *    - data-fg-color: Foreground/dot color (hex)
 *    - data-bg-color: Background color (hex)
 *    - data-halftone-config: JSON config for advanced options
 *
 * Example:
 * <div class="halftone-instance"
 *      data-video-src="https://example.com/video.mp4"
 *      data-fg-color="#C8C8C8"
 *      data-bg-color="#EDEDED"
 *      data-halftone-config='{"gridSize":20,"dotSize":0.35,"sizeVariation":0.5,"contrast":1.0,"brightness":0.0}'>
 * </div>
 *
 * Config options:
 * - gridSize: Size of halftone grid (default: 20)
 * - dotSize: Overall dot size 0.1-0.9 (default: 0.35)
 * - sizeVariation: Random size variation 0-1 (default: 0.5)
 * - morphStart: Morph start threshold (default: 0.9)
 * - morphEnd: Morph end threshold (default: 1.0)
 * - thresholdStart: Black point (default: 0.0)
 * - thresholdEnd: White point (default: 1.0)
 * - gridAngle: Rotation angle in degrees (default: 90)
 * - shapeMode: "circle", "square", or "mix" (default: "mix")
 * - opacityVariation: Random opacity variation 0-1 (default: 0.0)
 * - contrast: Contrast adjustment 0.5-2.0 (default: 1.0)
 * - brightness: Brightness adjustment -0.5-0.5 (default: 0.0)
 * - invert: Invert grayscale (default: false)
 * - shimmerAmount: Blue noise shimmer 0-0.5 (default: 0.0)
 *
 * Legacy support:
 * - minRadius/maxRadius: Converted to dotSize/sizeVariation automatically
 */

(function () {
  // Shared geometry across all instances for performance
  const sharedGeometry = new THREE.PlaneGeometry(2, 2);

  // Shared blue noise texture
  let sharedBlueNoise = null;
  const blueNoiseLoader = new THREE.TextureLoader();
  blueNoiseLoader.load(
    'https://cdn.jsdelivr.net/gh/Calinou/free-blue-noise-textures@master/64_64/LDR_LLL1_0.png',
    (tex) => {
      sharedBlueNoise = tex;
      sharedBlueNoise.wrapS = THREE.RepeatWrapping;
      sharedBlueNoise.wrapT = THREE.RepeatWrapping;
      sharedBlueNoise.minFilter = THREE.NearestFilter;
      sharedBlueNoise.magFilter = THREE.NearestFilter;
      // Update all existing instances
      instances.forEach(inst => {
        if (inst.uniforms.u_blueNoise) {
          inst.uniforms.u_blueNoise.value = sharedBlueNoise;
        }
      });
    },
    undefined,
    () => console.warn('Blue noise texture failed to load')
  );

  const instances = [];

  document.querySelectorAll('.halftone-instance').forEach((container, index) => {
    const instance = initHalftone(container, index);
    if (instance) instances.push(instance);
  });

  // Single global animation loop for all instances
  function globalAnimate() {
    const time = performance.now() * 0.001;

    for (let i = instances.length - 1; i >= 0; i--) {
      const instance = instances[i];

      // Remove disconnected instances (cleanup)
      if (!instance.container.isConnected) {
        instance.cleanup();
        instances.splice(i, 1);
        continue;
      }

      // Skip rendering when not visible (performance)
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

    // Legacy config migration: convert minRadius/maxRadius to dotSize/sizeVariation
    if (config.minRadius !== undefined || config.maxRadius !== undefined) {
      const minR = config.minRadius !== undefined ? config.minRadius : 0.2;
      const maxR = config.maxRadius !== undefined ? config.maxRadius : 0.5;
      // Map maxRadius to dotSize (0.5 max becomes ~0.35 dotSize as default)
      config.dotSize = config.dotSize !== undefined ? config.dotSize : maxR * 0.7;
      // Map difference to sizeVariation
      config.sizeVariation = config.sizeVariation !== undefined ? config.sizeVariation : Math.min((maxR - minR) / maxR, 1.0);
    }

    const videoSrc = container.getAttribute('data-video-src') || config.videoSrc || "";
    const fgColor = container.getAttribute('data-fg-color') || config.dotColor || "#C8C8C8";
    const bgColor = container.getAttribute('data-bg-color') || config.bgColor || "#ededed";

    // --- DOM SETUP ---
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%'
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
      u_morphStart: { value: safeVal(config.morphStart, 0.9) },
      u_morphEnd: { value: safeVal(config.morphEnd, 1.0) },
      u_thresholdStart: { value: safeVal(config.thresholdStart, 0.0) },
      u_thresholdEnd: { value: safeVal(config.thresholdEnd, 1.0) },
      u_angle: { value: safeVal(config.gridAngle, 90.0) * (Math.PI / 180) },
      u_bgColor: { value: new THREE.Color(bgColor) },
      u_dotColor: { value: new THREE.Color(fgColor) },
      u_showColor: { value: safeVal(config.showColor, 0.0) },
      u_shapeMode: { value: 2.0 },
      // New uniforms
      u_dotSize: { value: safeVal(config.dotSize, 0.35) },
      u_sizeVariation: { value: safeVal(config.sizeVariation, 0.5) },
      u_opacityVariation: { value: safeVal(config.opacityVariation, 0.0) },
      u_contrast: { value: safeVal(config.contrast, 1.0) },
      u_brightness: { value: safeVal(config.brightness, 0.0) },
      u_invert: { value: config.invert ? 1.0 : 0.0 },
      u_shimmerAmount: { value: safeVal(config.shimmerAmount, 0.0) }
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
        uniform float u_time;
        uniform float u_gridSize, u_morphStart, u_morphEnd;
        uniform float u_thresholdStart, u_thresholdEnd, u_showColor, u_shapeMode, u_angle;
        uniform float u_dotSize, u_sizeVariation, u_opacityVariation;
        uniform float u_contrast, u_brightness, u_invert, u_shimmerAmount;
        uniform vec3 u_bgColor, u_dotColor;
        in vec2 vUv;
        out vec4 fragColor;

        vec3 linearToSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }

        float getGray(vec3 c) {
          float gray = dot(c, vec3(0.299, 0.587, 0.114));
          // Apply contrast and brightness
          gray = (gray - 0.5) * u_contrast + 0.5 + u_brightness;
          gray = clamp(gray, 0.0, 1.0);
          // Apply invert
          if (u_invert > 0.5) gray = 1.0 - gray;
          return gray;
        }

        vec2 getCoverUV(vec2 uv) { return (uv - 0.5) * u_textureScale + 0.5; }
        mat2 rotate2d(float angle) { return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)); }

        // Hash function for variation
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 pixelPos = vUv * u_resolution;
          vec2 center = u_resolution * 0.5;
          mat2 rot = rotate2d(u_angle);
          vec2 rotatedPos = rot * (pixelPos - center);
          vec2 gridIndex = floor(rotatedPos / u_gridSize);
          vec2 cellCenterRotated = (gridIndex + 0.5) * u_gridSize;
          vec2 cellUV = (transpose(rot) * cellCenterRotated + center) / u_resolution;

          vec3 col = texture(u_texture, getCoverUV(cellUV)).rgb;
          float z = smoothstep(u_thresholdStart, max(u_thresholdEnd, u_thresholdStart + 0.01), getGray(col));

          // Size variation based on cell position
          float sizeVar = 1.0;
          if (u_sizeVariation > 0.0) {
            float noise = hash(gridIndex);
            sizeVar = mix(1.0, 0.5 + noise, u_sizeVariation);
          }

          // Shimmer effect using blue noise
          float shimmer = 1.0;
          if (u_shimmerAmount > 0.0) {
            vec2 noiseUV = gridIndex * 0.1 + vec2(sin(u_time * 0.5) * 0.1, cos(u_time * 0.3) * 0.1);
            float noiseVal = texture(u_blueNoise, noiseUV).r;
            shimmer = mix(1.0, 0.5 + noiseVal * 0.5, u_shimmerAmount);
          }

          float radius = z * 0.5 * u_dotSize * sizeVar * shimmer;
          vec2 localPos = (rotatedPos - cellCenterRotated) / u_gridSize;
          float m = smoothstep(u_morphStart, u_morphEnd, z);
          if (u_shapeMode == 0.0) m = 0.0;
          else if (u_shapeMode == 1.0) m = 1.0;

          float dist = mix(length(localPos), max(abs(localPos.x), abs(localPos.y)), m) - radius;
          float mask = 1.0 - smoothstep(-fwidth(dist), 0.0, dist);

          // Opacity variation
          float opacity = 1.0;
          if (u_opacityVariation > 0.0) {
            float opNoise = hash(gridIndex + 100.0);
            opacity = mix(1.0, 0.3 + opNoise * 0.7, u_opacityVariation);
          }
          mask *= opacity;

          if (u_showColor > 0.5) { fragColor = texture(u_texture, getCoverUV(vUv)); return; }
          fragColor = vec4(linearToSRGB(mix(u_bgColor, u_dotColor, mask)), 1.0);
        }
      `
    });

    // Use shared geometry for performance
    scene.add(new THREE.Mesh(sharedGeometry, material));

    // --- VISIBILITY STATE ---
    let isVisible = false;

    function updateSize() {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
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

    // Debounced resize
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateSize, 100);
    });
    resizeObserver.observe(container);
    video.addEventListener('loadedmetadata', updateSize);

    const startVideo = () => {
      video.play().catch(() => {});
    };

    // Track visibility for render skipping
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) startVideo();
        else video.pause();
      });
    });
    intersectionObserver.observe(container);

    // Cleanup function for when instance is removed
    function cleanup() {
      clearTimeout(resizeTimeout);
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
