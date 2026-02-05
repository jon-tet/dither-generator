/**
 * Dither Generator
 * Interactive halftone/dither effect generator using Three.js
 * With image support, new controls, shimmer, and video export
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

  // --- SOURCE TYPE TABS ---
  const sourceTabs = document.querySelectorAll('.source-tab');
  const videoPanel = document.getElementById('video-panel');
  const imagePanel = document.getElementById('image-panel');
  let currentSourceType = 'video';

  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSourceType = tab.dataset.source;

      if (currentSourceType === 'video') {
        videoPanel.classList.add('active');
        imagePanel.classList.remove('active');
        switchToVideo();
      } else {
        videoPanel.classList.remove('active');
        imagePanel.classList.add('active');
      }
    });
  });

  // --- IMAGE UPLOAD ---
  const dropZone = document.getElementById('imageDropZone');
  const imageUpload = document.getElementById('imageUpload');
  const imageInfo = document.getElementById('imageInfo');
  const imagePreview = document.getElementById('imagePreview');
  const imageName = document.getElementById('imageName');
  const imageSize = document.getElementById('imageSize');
  const clearImage = document.getElementById('clearImage');
  const imageUrlInput = document.getElementById('imageUrlInput');
  const loadImageUrlBtn = document.getElementById('loadImageUrl');
  let uploadedImage = null;
  let imageTexture = null;

  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      if (e.target !== clearImage && !clearImage.contains(e.target)) {
        imageUpload.click();
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) handleImageFile(files[0]);
    });
  }

  if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
    });
  }

  if (loadImageUrlBtn) {
    loadImageUrlBtn.addEventListener('click', () => {
      const url = imageUrlInput.value.trim();
      if (url) loadImageFromUrl(url, 'URL Image');
    });
  }

  if (clearImage) {
    clearImage.addEventListener('click', (e) => {
      e.stopPropagation();
      clearUploadedImage();
    });
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      loadImageFromUrl(e.target.result, file.name, file.size);
    };
    reader.readAsDataURL(file);
  }

  function loadImageFromUrl(url, name = 'Image', size = null) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      uploadedImage = img;
      createImageTexture(img);
      showImageInfo(name, size, url);
      switchToImage();
    };
    img.onerror = () => {
      console.error('Failed to load image');
      alert('Failed to load image. Please check the URL or try another image.');
    };
    img.src = url;
  }

  function showImageInfo(name, size, url) {
    if (imageInfo) imageInfo.classList.add('visible');
    if (dropZone) dropZone.classList.add('has-image');
    if (imagePreview) imagePreview.src = url;
    if (imageName) imageName.textContent = name;
    if (imageSize && size) {
      imageSize.textContent = formatFileSize(size);
    } else if (imageSize) {
      imageSize.textContent = '';
    }
  }

  function clearUploadedImage() {
    uploadedImage = null;
    if (imageTexture) {
      imageTexture.dispose();
      imageTexture = null;
    }
    if (imageInfo) imageInfo.classList.remove('visible');
    if (dropZone) dropZone.classList.remove('has-image');
    if (imagePreview) imagePreview.src = '';
    if (imageName) imageName.textContent = '';
    if (imageSize) imageSize.textContent = '';
    if (imageUpload) imageUpload.value = '';
    switchToVideo();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function createImageTexture(img) {
    if (imageTexture) imageTexture.dispose();
    imageTexture = new THREE.Texture(img);
    imageTexture.needsUpdate = true;
    imageTexture.minFilter = THREE.LinearFilter;
    imageTexture.magFilter = THREE.LinearFilter;
  }

  function switchToImage() {
    if (imageTexture && uniforms) {
      uniforms.u_texture.value = imageTexture;
      uniforms.u_useVideo.value = 0.0;
      updateCover();
    }
  }

  function switchToVideo() {
    if (texture && uniforms) {
      uniforms.u_texture.value = texture;
      uniforms.u_useVideo.value = 1.0;
      updateCover();
    }
  }

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
      showColor: formData.get('showColor') ? 1.0 : 0.0,
      thresholdStart: safeFloat('thresholdStart', 0.0),
      thresholdEnd: safeFloat('thresholdEnd', 1.0),
      gridAngle: safeFloat('gridAngle', 90.0),
      // New controls
      dotSize: safeFloat('dotSize', 0.35),
      sizeVariation: safeFloat('sizeVariation', 0.5),
      opacityVariation: safeFloat('opacityVariation', 0.0),
      contrast: safeFloat('contrast', 1.0),
      brightness: safeFloat('brightness', 0.0),
      invert: formData.get('invert') ? 1.0 : 0.0,
      shimmerAmount: safeFloat('shimmerAmount', 0.0)
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
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const texture = new THREE.VideoTexture(video);

  // Load blue noise texture for shimmer
  let blueNoiseTexture = null;
  const blueNoiseLoader = new THREE.TextureLoader();
  blueNoiseLoader.load(
    'https://cdn.jsdelivr.net/gh/Calinou/free-blue-noise-textures@master/64_64/LDR_LLL1_0.png',
    (tex) => {
      blueNoiseTexture = tex;
      blueNoiseTexture.wrapS = THREE.RepeatWrapping;
      blueNoiseTexture.wrapT = THREE.RepeatWrapping;
      blueNoiseTexture.minFilter = THREE.NearestFilter;
      blueNoiseTexture.magFilter = THREE.NearestFilter;
      if (uniforms) uniforms.u_blueNoise.value = blueNoiseTexture;
    },
    undefined,
    (err) => console.warn('Blue noise texture failed to load, shimmer will be disabled')
  );

  const uniforms = {
    u_texture: { value: texture },
    u_blueNoise: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    u_time: { value: 0 },
    u_textureScale: { value: new THREE.Vector2(1, 1) },
    u_gridSize: { value: controls.gridSize },
    u_morphStart: { value: controls.morphStart },
    u_morphEnd: { value: controls.morphEnd },
    u_thresholdStart: { value: controls.thresholdStart },
    u_thresholdEnd: { value: controls.thresholdEnd },
    u_angle: { value: 0 },
    u_bgColor: { value: new THREE.Color(controls.bgColor) },
    u_dotColor: { value: new THREE.Color(controls.dotColor) },
    u_showColor: { value: controls.showColor },
    u_shapeMode: { value: 2.0 },
    u_useVideo: { value: 1.0 },
    // New uniforms
    u_dotSize: { value: controls.dotSize },
    u_sizeVariation: { value: controls.sizeVariation },
    u_opacityVariation: { value: controls.opacityVariation },
    u_contrast: { value: controls.contrast },
    u_brightness: { value: controls.brightness },
    u_invert: { value: controls.invert },
    u_shimmerAmount: { value: controls.shimmerAmount }
  };

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
      mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

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
        float z = smoothstep(u_thresholdStart, max(u_thresholdEnd, u_thresholdStart+0.01), getGray(col));

        // Size variation based on cell position
        float sizeVar = 1.0;
        if (u_sizeVariation > 0.0) {
          float noise = hash(gridIndex);
          sizeVar = mix(1.0, 0.5 + noise, u_sizeVariation);
        }

        // Shimmer effect using blue noise
        float shimmer = 1.0;
        if (u_shimmerAmount > 0.0 && u_blueNoise != u_texture) {
          vec2 noiseUV = gridIndex * 0.1 + vec2(sin(u_time * 0.5) * 0.1, cos(u_time * 0.3) * 0.1);
          float noiseVal = texture(u_blueNoise, noiseUV).r;
          shimmer = mix(1.0, 0.5 + noiseVal * 0.5, u_shimmerAmount);
        }

        float radius = z * 0.5 * u_dotSize * sizeVar * shimmer;
        vec2 localPos = (rotatedPos - cellCenterRotated) / u_gridSize;
        float m = smoothstep(u_morphStart, u_morphEnd, z);
        if(u_shapeMode == 0.0) m = 0.0; else if(u_shapeMode == 1.0) m = 1.0;

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

  scene.add(new THREE.Mesh(geometry, material));

  function applyControls() {
    uniforms.u_dotColor.value.set(controls.dotColor);
    uniforms.u_bgColor.value.set(controls.bgColor);
    uniforms.u_gridSize.value = controls.gridSize;
    uniforms.u_morphStart.value = controls.morphStart;
    uniforms.u_morphEnd.value = controls.morphEnd;
    uniforms.u_showColor.value = controls.showColor;
    uniforms.u_thresholdStart.value = controls.thresholdStart;
    uniforms.u_thresholdEnd.value = controls.thresholdEnd;
    uniforms.u_angle.value = controls.gridAngle * (Math.PI / 180);

    // New controls
    uniforms.u_dotSize.value = controls.dotSize;
    uniforms.u_sizeVariation.value = controls.sizeVariation;
    uniforms.u_opacityVariation.value = controls.opacityVariation;
    uniforms.u_contrast.value = controls.contrast;
    uniforms.u_brightness.value = controls.brightness;
    uniforms.u_invert.value = controls.invert;
    uniforms.u_shimmerAmount.value = controls.shimmerAmount;

    if (controls.shapeMode === 'circle') uniforms.u_shapeMode.value = 0.0;
    else if (controls.shapeMode === 'square') uniforms.u_shapeMode.value = 1.0;
    else uniforms.u_shapeMode.value = 2.0;

    if (currentSourceType === 'video' && video.src !== controls.videoSrc) {
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

    let sourceWidth, sourceHeight;
    if (currentSourceType === 'video') {
      sourceWidth = video.videoWidth || 1920;
      sourceHeight = video.videoHeight || 1080;
    } else if (uploadedImage) {
      sourceWidth = uploadedImage.width;
      sourceHeight = uploadedImage.height;
    } else {
      sourceWidth = 1920;
      sourceHeight = 1080;
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
    video.play();
    updateCover();
    animate();
  };

  // Handle autoplay restrictions
  video.oncanplay = () => {
    video.play().catch(() => {
      document.body.addEventListener('click', () => {
        video.play();
      }, { once: true });
    });
  };

  // --- VIDEO EXPORT ---
  const exportBtn = document.getElementById('export-video');
  const exportQuality = document.getElementById('export-quality');
  const exportProgress = document.querySelector('.export-progress');
  const exportProgressBar = document.querySelector('.export-progress-bar');
  const exportStatus = document.getElementById('export-status');
  let isExporting = false;

  if (exportBtn) {
    exportBtn.addEventListener('click', startExport);
  }

  async function startExport() {
    if (isExporting) return;
    isExporting = true;

    const quality = exportQuality?.value || '1080p';
    let width, height, bitrate;

    switch (quality) {
      case '4k':
        width = 3840; height = 2160; bitrate = 20000000;
        break;
      case '1440p':
        width = 2560; height = 1440; bitrate = 12000000;
        break;
      default:
        width = 1920; height = 1080; bitrate = 8000000;
    }

    // Calculate grid size scaling factor
    const currentWidth = container.clientWidth;
    const scaleFactor = width / currentWidth;
    const originalGridSize = uniforms.u_gridSize.value;
    const exportGridSize = originalGridSize * scaleFactor;

    exportBtn.disabled = true;
    exportBtn.textContent = 'Preparing...';
    if (exportProgress) exportProgress.style.display = 'block';
    if (exportStatus) exportStatus.textContent = 'Initializing export...';

    // Create offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    const offRenderer = new THREE.WebGLRenderer({
      canvas: offCanvas,
      antialias: false,
      preserveDrawingBuffer: true
    });
    offRenderer.setSize(width, height, false);
    offRenderer.outputColorSpace = THREE.SRGBColorSpace;

    // Clone uniforms for export
    const exportUniforms = {};
    for (const key in uniforms) {
      if (uniforms[key].value instanceof THREE.Vector2) {
        exportUniforms[key] = { value: uniforms[key].value.clone() };
      } else if (uniforms[key].value instanceof THREE.Color) {
        exportUniforms[key] = { value: uniforms[key].value.clone() };
      } else {
        exportUniforms[key] = { value: uniforms[key].value };
      }
    }
    exportUniforms.u_resolution.value.set(width, height);
    exportUniforms.u_gridSize.value = exportGridSize;

    // Update texture scale for export resolution
    let sourceWidth, sourceHeight;
    if (currentSourceType === 'video') {
      sourceWidth = video.videoWidth || 1920;
      sourceHeight = video.videoHeight || 1080;
    } else if (uploadedImage) {
      sourceWidth = uploadedImage.width;
      sourceHeight = uploadedImage.height;
    } else {
      sourceWidth = 1920;
      sourceHeight = 1080;
    }
    const aspect = (width / height) / (sourceWidth / sourceHeight);
    exportUniforms.u_textureScale.value.set(aspect > 1 ? 1 : aspect, aspect > 1 ? 1 / aspect : 1);

    const exportMaterial = new THREE.ShaderMaterial({
      uniforms: exportUniforms,
      glslVersion: THREE.GLSL3,
      vertexShader: material.vertexShader,
      fragmentShader: material.fragmentShader
    });

    const exportScene = new THREE.Scene();
    exportScene.add(new THREE.Mesh(geometry, exportMaterial));

    // Setup MediaRecorder
    const stream = offCanvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: bitrate
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dither-${quality}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup
      offRenderer.dispose();
      exportMaterial.dispose();

      exportBtn.disabled = false;
      exportBtn.textContent = 'Export WebM';
      if (exportProgress) exportProgress.style.display = 'none';
      if (exportProgressBar) exportProgressBar.style.width = '0%';
      if (exportStatus) exportStatus.textContent = 'Export complete!';
      isExporting = false;
    };

    // Get video duration for one loop
    const duration = video.duration || 10;
    const fps = 30;
    const totalFrames = Math.ceil(duration * fps);
    let frameCount = 0;

    // Seek video to start
    video.currentTime = 0;
    await new Promise(r => video.onseeked = r);

    mediaRecorder.start();
    if (exportStatus) exportStatus.textContent = 'Recording...';

    function captureFrame() {
      if (frameCount >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const progress = (frameCount / totalFrames) * 100;
      if (exportProgressBar) exportProgressBar.style.width = progress + '%';
      if (exportStatus) exportStatus.textContent = `Recording... ${Math.round(progress)}%`;

      exportUniforms.u_time.value = performance.now() * 0.001;
      offRenderer.render(exportScene, camera);

      frameCount++;
      video.currentTime = (frameCount / fps) % duration;

      if (frameCount < totalFrames) {
        requestAnimationFrame(captureFrame);
      } else {
        mediaRecorder.stop();
      }
    }

    captureFrame();
  }
})();
