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
      toggleButton.textContent = controlPanel.classList.contains('minimized') ? 'Show' :
        'Hide';
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
  document.querySelectorAll('.preset-link').forEach(preset => {
    preset.addEventListener('click', function () {
      const videoInput = document.getElementById('videoSrcInput');
      const newSrc = this.getAttribute('data-src');
      if (videoInput && newSrc) {
        videoInput.value = newSrc;
        // Clear image upload when selecting a video preset
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) imageUpload.value = '';
        const imageName = document.getElementById('imageName');
        if (imageName) imageName.textContent = '';
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
  // --- SOURCE TYPE TRACKING ---
  let sourceType = 'video'; // 'video' or 'image'
  let currentImageDataUrl = null;
  let imageElement = null;
  function readControls() {
    const formData = new FormData(form);
    const safeFloat = (name, def) => {
      const val = parseFloat(formData.get(name));
      return isNaN(val) ? def : val;
    };
    controls = {
      dotColor: formData.get('dotColor') || '#C8C8C8',
      bgColor: formData.get('bgColor') || '#EDEDED',
      videoSrc: formData.get('videoSrc') ||
        "https://cdn.jsdelivr.net/gh/jon-tet/bg-vids/dove.mp4",
      shapeMode: formData.get('shapeMode') || 'mix',
      morphStart: safeFloat('morphStart', 0.9),
      morphEnd: safeFloat('morphEnd', 1.0),
      gridSize: safeFloat('gridSize', 20.0),
      dotSize: safeFloat('dotSize', 0.35),
      sizeVariation: safeFloat('sizeVariation', 0.5),
      opacityVariation: safeFloat('opacityVariation', 0.0),
      showColor: formData.get('showColor') ? 1.0 : 0.0,
      contrast: safeFloat('contrast', 1.0),
      brightness: safeFloat('brightness', 0.0),
      invert: formData.get('invert') ? 1.0 : 0.0,
      gridAngle: safeFloat('gridAngle', 90.0),
      // --- SHIMMER ---
      shimmerAmount: safeFloat('shimmerAmount', 0.0),
      sourceType: sourceType,
      imageSrc: currentImageDataUrl
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
      if (e.target.id === 'imageUpload') return; // Handle separately
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
  // Create both texture types
  let videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  let imageTexture = null;
  // --- BLUE NOISE TEXTURE (Christoph Peters, CC0) ---
  // Pre-computed 64x64 tileable blue noise from momentsingraphics.de
  // Guarantees neighboring values are maximally different — no visible clumping.
  const BLUE_NOISE_URL =
    'https://cdn.jsdelivr.net/gh/Calinou/free-blue-noise-textures@master/64_64/LDR_LLL1_0.png';
  const BLUE_NOISE_SIZE = 64.0;
  const blueNoiseLoader = new THREE.TextureLoader();
  const blueNoiseTexture = blueNoiseLoader.load(BLUE_NOISE_URL);
  blueNoiseTexture.minFilter = THREE.NearestFilter;
  blueNoiseTexture.magFilter = THREE.NearestFilter;
  blueNoiseTexture.wrapS = THREE.RepeatWrapping;
  blueNoiseTexture.wrapT = THREE.RepeatWrapping;
  // --- SHARED SHADER CODE ---
  const vertexShader =
    `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
  const fragmentShader = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform sampler2D u_blueNoise;
    uniform vec2 u_resolution;
    uniform vec2 u_textureScale;
    uniform float u_gridSize, u_dotSize, u_sizeVariation, u_opacityVariation, u_morphStart, u_morphEnd, u_contrast, u_brightness, u_showColor, u_shapeMode, u_angle, u_invert;
    uniform float u_time, u_shimmerAmount;
    uniform vec3 u_bgColor, u_dotColor;
    in vec2 vUv;
    out vec4 fragColor;
    const float BLUE_NOISE_SIZE = 64.0;
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
      float gray = getGray(col);
      // --- NOISE SHIMMER ---
      // Each cell gets a fixed phase from blue noise, all oscillate together
      // but out of phase. No directional flow, just organic flicker.
      float cellNoise = texture(u_blueNoise, gridIndex / BLUE_NOISE_SIZE).r;
      float shimmer = sin(u_time * 3.0 + cellNoise * 6.283185) * u_shimmerAmount;
      gray += shimmer;
      // --- CONTRAST & BRIGHTNESS ---
      // Contrast: how much tonal variation (0=flat, 1=normal, 2=high)
      // Brightness: overall shift (-0.5 to +0.5)
      gray = (gray - 0.5) * u_contrast + 0.5 + u_brightness;
      gray = clamp(gray, 0.0, 1.0);
      float z = gray;
      if (u_invert > 0.5) z = 1.0 - z;
      // --- DOT SIZE & VARIATION ---
      // dotSize: base size, sizeVariation: how much dots vary from base
      float range = u_sizeVariation * 0.6;
      float minR = max(0.05, u_dotSize - range * 0.5);
      float maxR = min(0.95, u_dotSize + range * 0.5);
      float radius = mix(minR, maxR, z) * 0.5;
      vec2 localPos = (rotatedPos - cellCenterRotated) / u_gridSize;
      float m = smoothstep(u_morphStart, u_morphEnd, z);
      if(u_shapeMode == 0.0) m = 0.0; else if(u_shapeMode == 1.0) m = 1.0;
      
      float dist = mix(length(localPos), max(abs(localPos.x), abs(localPos.y)), m) - radius;
      float mask = 1.0 - smoothstep(-fwidth(dist), 0.0, dist);
      // Opacity variation: blend from full opacity to z-driven opacity
      float dotOpacity = mix(1.0, z, u_opacityVariation);
      if (u_showColor > 0.5) { fragColor = texture(u_texture, getCoverUV(vUv)); return; }
      fragColor = vec4(linearToSRGB(mix(u_bgColor, u_dotColor, mask * dotOpacity)), 1.0);
    }
  `;
  const uniforms = {
    u_texture: { value: videoTexture },
    u_blueNoise: { value: blueNoiseTexture },
    u_resolution: { value: new THREE.Vector2() },
    u_time: { value: 0 },
    u_textureScale: { value: new THREE.Vector2(1, 1) },
    u_gridSize: { value: controls.gridSize },
    u_dotSize: { value: controls.dotSize },
    u_sizeVariation: { value: controls.sizeVariation },
    u_opacityVariation: { value: controls.opacityVariation },
    u_morphStart: { value: controls.morphStart },
    u_morphEnd: { value: controls.morphEnd },
    u_contrast: { value: controls.contrast },
    u_brightness: { value: controls.brightness },
    u_angle: { value: 0 },
    u_bgColor: { value: new THREE.Color(controls.bgColor) },
    u_dotColor: { value: new THREE.Color(controls.dotColor) },
    u_showColor: { value: controls.showColor },
    u_shapeMode: { value: 2.0 },
    // --- SHIMMER ---
    u_shimmerAmount: { value: controls.shimmerAmount },
    u_invert: { value: controls.invert }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader
  });
  scene.add(new THREE.Mesh(geometry, material));
  // --- IMAGE UPLOAD HANDLING ---
  const imageUpload = document.getElementById('imageUpload');
  const imageUploadBtn = document.getElementById('imageUploadBtn');
  const imageName = document.getElementById('imageName');
  const clearImageBtn = document.getElementById('clearImage');
  if (imageUploadBtn && imageUpload) {
    imageUploadBtn.addEventListener('click', () => {
      imageUpload.click();
    });
  }
  if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          currentImageDataUrl = event.target.result;
          sourceType = 'image';
          // Update UI
          if (imageName) {
            imageName.textContent = file.name;
          }
          // Load the image and create texture
          loadImageTexture(currentImageDataUrl);
        };
        reader.readAsDataURL(file);
      }
    });
  }
  if (clearImageBtn) {
    clearImageBtn.addEventListener('click', () => {
      clearImage();
    });
  }
  function clearImage() {
    sourceType = 'video';
    currentImageDataUrl = null;
    if (imageUpload) imageUpload.value = '';
    if (imageName) imageName.textContent = '';
    // Dispose of image texture if it exists
    if (imageTexture) {
      imageTexture.dispose();
      imageTexture = null;
    }
    // Switch back to video
    uniforms.u_texture.value = videoTexture;
    video.play().catch(() => {});
    updateCover();
  }
  function loadImageTexture(dataUrl) {
    // Create a new image element
    imageElement = new Image();
    imageElement.crossOrigin = 'anonymous';
    imageElement.onload = () => {
      // Dispose old image texture if exists
      if (imageTexture) {
        imageTexture.dispose();
      }
      // Create new texture from image
      imageTexture = new THREE.Texture(imageElement);
      imageTexture.minFilter = THREE.LinearFilter;
      imageTexture.magFilter = THREE.LinearFilter;
      imageTexture.colorSpace = THREE.SRGBColorSpace;
      imageTexture.needsUpdate = true;
      // Update uniform to use image texture
      uniforms.u_texture.value = imageTexture;
      // Pause video when using image
      video.pause();
      // Update cover calculations for image dimensions
      updateCover();
    };
    imageElement.src = dataUrl;
  }
  // --- IMAGE URL SUPPORT ---
  const imageUrlInput = document.getElementById('imageUrlInput');
  const loadImageUrlBtn = document.getElementById('loadImageUrl');
  if (loadImageUrlBtn && imageUrlInput) {
    loadImageUrlBtn.addEventListener('click', () => {
      const url = imageUrlInput.value.trim();
      if (url) {
        loadImageFromUrl(url);
      }
    });
    // Also allow Enter key to load
    imageUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const url = imageUrlInput.value.trim();
        if (url) {
          loadImageFromUrl(url);
        }
      }
    });
  }
  function loadImageFromUrl(url) {
    sourceType = 'image';
    currentImageDataUrl = url;
    if (imageName) {
      // Extract filename from URL
      const filename = url.split('/').pop().split('?')[0] || 'External Image';
      imageName.textContent = filename;
    }
    loadImageTexture(url);
  }
  function applyControls() {
    uniforms.u_dotColor.value.set(controls.dotColor);
    uniforms.u_bgColor.value.set(controls.bgColor);
    uniforms.u_gridSize.value = controls.gridSize;
    uniforms.u_dotSize.value = controls.dotSize;
    uniforms.u_sizeVariation.value = controls.sizeVariation;
    uniforms.u_opacityVariation.value = controls.opacityVariation;
    uniforms.u_morphStart.value = controls.morphStart;
    uniforms.u_morphEnd.value = controls.morphEnd;
    uniforms.u_showColor.value = controls.showColor;
    uniforms.u_contrast.value = controls.contrast;
    uniforms.u_brightness.value = controls.brightness;
    uniforms.u_invert.value = controls.invert;
    uniforms.u_angle.value = controls.gridAngle * (Math.PI / 180);
    // --- SHIMMER ---
    uniforms.u_shimmerAmount.value = controls.shimmerAmount;
    if (controls.shapeMode === 'circle') uniforms.u_shapeMode.value = 0.0;
    else if (controls.shapeMode === 'square') uniforms.u_shapeMode.value = 1.0;
    else uniforms.u_shapeMode.value = 2.0;
    // Only update video source if we're in video mode
    if (sourceType === 'video' && video.src !== controls.videoSrc) {
      video.src = controls.videoSrc;
      video.load();
    }
    updateCover();
  }
  function updateCover() {
    const cw = container.clientWidth,
      ch = container.clientHeight;
    renderer.setSize(cw, ch, false);
    uniforms.u_resolution.value.set(cw, ch);
    // Calculate aspect ratio based on source type
    let sourceWidth, sourceHeight;
    if (sourceType === 'image' && imageElement) {
      sourceWidth = imageElement.naturalWidth || imageElement.width || 1920;
      sourceHeight = imageElement.naturalHeight || imageElement.height || 1080;
    } else {
      sourceWidth = video.videoWidth || 1920;
      sourceHeight = video.videoHeight || 1080;
    }
    const aspect = (cw / ch) / (sourceWidth / sourceHeight);
    uniforms.u_textureScale.value.set(aspect > 1 ? 1 : aspect, aspect > 1 ? 1 / aspect : 1);
  }
  window.addEventListener('resize', updateCover);
  function animate() {
    uniforms.u_time.value = performance.now() * 0.001;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  video.onloadedmetadata = () => {
    // Only play if we're in video mode
    if (sourceType === 'video') {
      video.play();
    }
    updateCover();
    animate();
  };
  // Start animation even if video hasn't loaded yet (for image mode)
  if (!video.readyState) {
    animate();
  }
  // ==========================================================================
  // VIDEO EXPORT FUNCTIONALITY
  // ==========================================================================
  const exportBtn = document.getElementById('export-video');
  const exportStatus = document.getElementById('export-status');
  const exportProgress = document.querySelector('.export-progress');
  const exportProgressBar = document.querySelector('.export-progress-bar');
  let isExporting = false;
  if (exportBtn) {
    exportBtn.addEventListener('click', startExport);
  }
  async function startExport() {
    if (isExporting) return;
    if (sourceType === 'image') {
      alert('Export is only available for video sources. Images don\'t have duration.');
      return;
    }
    isExporting = true;
    exportBtn.disabled = true;
    exportBtn.classList.add('recording');
    exportBtn.textContent = 'Recording...';
    exportStatus.textContent = 'Preparing export...';
    exportStatus.className = 'export-status';
    exportProgress.classList.add('active');
    exportProgressBar.style.width = '0%';
    exportProgressBar.classList.add('recording');
    try {
      await exportVideo();
    } catch (err) {
      console.error('Export failed:', err);
      exportStatus.textContent = 'Export failed: ' + err.message;
      exportStatus.className = 'export-status';
    } finally {
      isExporting = false;
      exportBtn.disabled = false;
      exportBtn.classList.remove('recording');
      exportBtn.textContent = 'Export 1080p WebM';
      exportProgressBar.classList.remove('recording');
    }
  }
  async function exportVideo() {
    // Quality presets
    const qualityPresets = {
      '1080p': { width: 1920, height: 1080, bitrate: 16000000 }, // 16 Mbps
      '1440p': { width: 2560, height: 1440, bitrate: 30000000 }, // 30 Mbps
      '4k': { width: 3840, height: 2160, bitrate: 50000000 } // 50 Mbps
    };
    const qualitySelect = document.getElementById('export-quality');
    const selectedQuality = qualitySelect ? qualitySelect.value : '1080p';
    const preset = qualityPresets[selectedQuality];
    const EXPORT_WIDTH = preset.width;
    const EXPORT_HEIGHT = preset.height;
    const EXPORT_FPS = 30;
    const EXPORT_BITRATE = preset.bitrate;
    // Calculate scale factor for proportional grid sizing
    const scaleFactor = EXPORT_HEIGHT / 1080;
    // Create offscreen canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_WIDTH;
    exportCanvas.height = EXPORT_HEIGHT;
    // Create separate renderer for export
    const exportRenderer = new THREE.WebGLRenderer({
      canvas: exportCanvas,
      antialias: false,
      preserveDrawingBuffer: true
    });
    exportRenderer.setSize(EXPORT_WIDTH, EXPORT_HEIGHT, false);
    exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
    // Create export scene with same shader
    const exportScene = new THREE.Scene();
    const exportCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Clone uniforms for export (with export resolution and scaled grid)
    const exportUniforms = {
      u_texture: { value: videoTexture },
      u_blueNoise: { value: blueNoiseTexture },
      u_resolution: { value: new THREE.Vector2(EXPORT_WIDTH, EXPORT_HEIGHT) },
      u_time: { value: 0 },
      u_textureScale: { value: new THREE.Vector2(1, 1) },
      u_gridSize: { value: uniforms.u_gridSize.value * scaleFactor },
      u_dotSize: { value: uniforms.u_dotSize.value },
      u_sizeVariation: { value: uniforms.u_sizeVariation.value },
      u_opacityVariation: { value: uniforms.u_opacityVariation.value },
      u_morphStart: { value: uniforms.u_morphStart.value },
      u_morphEnd: { value: uniforms.u_morphEnd.value },
      u_contrast: { value: uniforms.u_contrast.value },
      u_brightness: { value: uniforms.u_brightness.value },
      u_angle: { value: uniforms.u_angle.value },
      u_bgColor: { value: uniforms.u_bgColor.value.clone() },
      u_dotColor: { value: uniforms.u_dotColor.value.clone() },
      u_showColor: { value: uniforms.u_showColor.value },
      u_shapeMode: { value: uniforms.u_shapeMode.value },
      // --- SHIMMER ---
      u_shimmerAmount: { value: uniforms.u_shimmerAmount.value },
      u_invert: { value: uniforms.u_invert.value }
    };
    // Calculate texture scale for export resolution
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    const exportAspect = (EXPORT_WIDTH / EXPORT_HEIGHT) / (vw / vh);
    if (exportAspect > 1) {
      exportUniforms.u_textureScale.value.set(1.0, 1.0 / exportAspect);
    } else {
      exportUniforms.u_textureScale.value.set(exportAspect, 1.0);
    }
    const exportMaterial = new THREE.ShaderMaterial({
      uniforms: exportUniforms,
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader
    });
    const exportGeometry = new THREE.PlaneGeometry(2, 2);
    exportScene.add(new THREE.Mesh(exportGeometry, exportMaterial));
    // Get video duration
    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      throw new Error('Could not determine video duration');
    }
    exportStatus.textContent =
      `Recording ${duration.toFixed(1)}s at ${selectedQuality.toUpperCase()}...`;
    exportStatus.className = 'export-status recording';
    // Set up MediaRecorder
    const stream = exportCanvas.captureStream(EXPORT_FPS);
    // Try to use VP9 for better quality, fall back to VP8
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: EXPORT_BITRATE
    });
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    // Create a promise that resolves when recording is complete
    const recordingComplete = new Promise((resolve, reject) => {
      mediaRecorder.onstop = () => {
        exportStatus.textContent = 'Processing video...';
        exportStatus.className = 'export-status processing';
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      mediaRecorder.onerror = (e) => reject(e.error);
    });
    // Reset video to start
    video.currentTime = 0;
    video.muted = true;
    // Wait for video to be ready
    await new Promise((resolve) => {
      if (video.readyState >= 3) {
        resolve();
      } else {
        video.addEventListener('canplay', resolve, { once: true });
      }
    });
    // Start recording
    mediaRecorder.start();
    video.play();
    const startTime = performance.now();
    const durationMs = duration * 1000;
    // Render loop for export
    function renderExportFrame() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Update progress bar
      exportProgressBar.style.width = (progress * 100) + '%';
      // Update time uniform for shimmer animation in export
      exportUniforms.u_time.value = performance.now() * 0.001;
      // Render frame
      exportRenderer.render(exportScene, exportCamera);
      if (progress < 1 && isExporting) {
        requestAnimationFrame(renderExportFrame);
      } else {
        // Stop recording
        video.pause();
        mediaRecorder.stop();
      }
    }
    renderExportFrame();
    // Wait for recording to complete
    const blob = await recordingComplete;
    // Clean up export resources
    exportRenderer.dispose();
    exportMaterial.dispose();
    exportGeometry.dispose();
    // Download the file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `halftone-${selectedQuality}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    exportStatus.textContent =
      `Export complete! ${selectedQuality.toUpperCase()} file downloaded.`;
    exportStatus.className = 'export-status complete';
    exportProgressBar.style.width = '100%';
    // Resume normal playback
    video.currentTime = 0;
    video.play().catch(() => {});
  }
})();