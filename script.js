(function () {
    'use strict';

    const CONFIG = {
        frameDir: './frames/',
        maxFramesToCheck: 250,
        particleCount: 60,
        pinDurationPerFrame: 200,
        headlines: [
            { id: 'headline1', start: 0.00, peak: 0.05, end: 0.16 },
            { id: 'headline2', start: 0.20, peak: 0.28, end: 0.38 },
            { id: 'headline3', start: 0.42, peak: 0.52, end: 0.62 },
            { id: 'headline4', start: 0.68, peak: 0.78, end: 0.90 },
        ],
        features: [
            { id: 'feature1', start: 0.08, peak: 0.14, end: 0.22 },
            { id: 'feature2', start: 0.24, peak: 0.32, end: 0.38 },
            { id: 'feature3', start: 0.40, peak: 0.48, end: 0.56 },
            { id: 'feature4', start: 0.58, peak: 0.66, end: 0.74 },
            { id: 'feature5', start: 0.76, peak: 0.84, end: 0.92 },
        ],
        glowKeyframes: [
            { at: 0.00, intensity: 0 },
            { at: 0.08, intensity: 0.2 },
            { at: 0.18, intensity: 0.4 },
            { at: 0.30, intensity: 0.6 },
            { at: 0.42, intensity: 0.8 },
            { at: 0.55, intensity: 1.0 },
            { at: 0.68, intensity: 0.8 },
            { at: 0.80, intensity: 0.5 },
            { at: 0.90, intensity: 0.3 },
            { at: 1.00, intensity: 0.15 },
        ]
    };

    const canvas = document.getElementById('frameCanvas');
    const ctx = canvas.getContext('2d');
    const particlesCanvas = document.getElementById('particlesCanvas');
    const pCtx = particlesCanvas.getContext('2d');
    const glowOverlay = document.getElementById('glowOverlay');
    const progressBar = document.getElementById('progressBar');
    const scrollIndicator = document.getElementById('scrollIndicator');

    let frames = [];
    let currentFrame = 0;
    let targetFrame = 0;
    let scrollProgress = 0;
    let particles = [];
    let rafId = null;

    function padNumber(n) {
        return String(n).padStart(3, '0');
    }

    async function loadFrames() {
        const promises = [];
        const validFrames = [];

        for (let i = 1; i <= CONFIG.maxFramesToCheck; i++) {
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    validFrames.push({ index: i, img: img });
                    resolve();
                };
                img.onerror = () => {
                    resolve();
                };
                img.src = CONFIG.frameDir + 'ezgif-frame-' + padNumber(i) + '.jpg';
            }));
        }

        await Promise.all(promises);

        validFrames.sort((a, b) => a.index - b.index);
        frames = validFrames.map(f => f.img);

        CONFIG.totalFrames = frames.length;
        CONFIG.pinDuration = CONFIG.totalFrames * CONFIG.pinDurationPerFrame;
    }

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        particlesCanvas.width = window.innerWidth * dpr;
        particlesCanvas.height = window.innerHeight * dpr;
        particlesCanvas.style.width = window.innerWidth + 'px';
        particlesCanvas.style.height = window.innerHeight + 'px';
        pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        drawFrame(Math.round(currentFrame));
    }

    function drawFrame(index) {
        const img = frames[index];
        if (!img || !img.complete || !img.naturalWidth) return;

        const cw = window.innerWidth;
        const ch = window.innerHeight;

        ctx.clearRect(0, 0, cw, ch);

        const cropRight = 2;
        const cropBottom = 2;
        const cropW = img.naturalWidth - cropRight;
        const cropH = img.naturalHeight - cropBottom;
        const imgRatio = cropW / cropH;
        const canvasRatio = cw / ch;

        let s;

        if (canvasRatio > imgRatio) {
            s = cw / cropW;
        } else {
            s = ch / cropH;
        }

        const dw = cropW * s;
        const dh = cropH * s;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        ctx.drawImage(img, 0, 0, cropW, cropH, dx, dy, dw, dh);
    }

    function getTextOpacity(progress, start, peak, end) {
        if (progress < start || progress > end) return 0;
        if (progress < peak) {
            return (progress - start) / (peak - start);
        }
        return 1 - (progress - peak) / (end - peak);
    }

    function getTextTranslateY(progress, start, peak, end) {
        if (progress < start) return 30;
        if (progress < peak) {
            const t = (progress - start) / (peak - start);
            return 30 * (1 - t);
        }
        if (progress < end) {
            const t = (progress - peak) / (end - peak);
            return -20 * t;
        }
        return -20;
    }

    function updateTextElements(progress) {
        CONFIG.headlines.forEach((h) => {
            const el = document.getElementById(h.id);
            if (!el) return;
            const opacity = getTextOpacity(progress, h.start, h.peak, h.end);
            const ty = getTextTranslateY(progress, h.start, h.peak, h.end);
            el.style.opacity = opacity;
            el.style.transform = `translateY(calc(-50% + ${ty}px))`;
        });

        CONFIG.features.forEach((f) => {
            const el = document.getElementById(f.id);
            if (!el) return;
            const opacity = getTextOpacity(progress, f.start, f.peak, f.end);
            const tx = 20 * (1 - Math.min(opacity * 2, 1));
            el.style.opacity = opacity;
            el.style.transform = `translateX(${tx}px)`;
        });
    }

    function getGlowIntensity(progress) {
        const kf = CONFIG.glowKeyframes;
        for (let i = 0; i < kf.length - 1; i++) {
            if (progress >= kf[i].at && progress <= kf[i + 1].at) {
                const t = (progress - kf[i].at) / (kf[i + 1].at - kf[i].at);
                return kf[i].intensity + t * (kf[i + 1].intensity - kf[i].intensity);
            }
        }
        return kf[kf.length - 1].intensity;
    }

    function updateGlow(progress) {
        const intensity = getGlowIntensity(progress);
        glowOverlay.style.opacity = intensity * 0.5;
    }

    function initParticles() {
        particles = [];
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < CONFIG.particleCount; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: (Math.random() - 0.5) * 0.3 - 0.2,
                opacity: Math.random() * 0.5 + 0.1,
                life: Math.random() * 200 + 100,
                age: Math.random() * 200,
                type: Math.random() > 0.7 ? 'spark' : 'dust'
            });
        }
    }

    function updateParticles() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        pCtx.clearRect(0, 0, w, h);

        particles.forEach((p) => {
            p.age++;
            p.x += p.speedX;
            p.y += p.speedY;

            if (p.age > p.life || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
                p.x = Math.random() * w;
                p.y = h + 10;
                p.age = 0;
                p.life = Math.random() * 200 + 100;
                p.speedY = (Math.random() - 0.5) * 0.3 - 0.3;
            }

            const lifeFraction = p.age / p.life;
            const fadeIn = Math.min(lifeFraction * 5, 1);
            const fadeOut = Math.max(1 - (lifeFraction - 0.7) / 0.3, 0);
            const alpha = p.opacity * fadeIn * (lifeFraction > 0.7 ? fadeOut : 1) * Math.max(scrollProgress, 0.15);

            if (p.type === 'spark') {
                pCtx.beginPath();
                pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                pCtx.fillStyle = `rgba(122, 255, 42, ${alpha})`;
                pCtx.shadowColor = 'rgba(122, 255, 42, 0.6)';
                pCtx.shadowBlur = 8;
                pCtx.fill();
                pCtx.shadowBlur = 0;
            } else {
                pCtx.beginPath();
                pCtx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
                pCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
                pCtx.fill();
            }
        });
    }

    function animate() {
        rafId = requestAnimationFrame(animate);

        currentFrame += (targetFrame - currentFrame) * 0.18;
        const frameIndex = Math.min(Math.round(currentFrame), CONFIG.totalFrames - 1);
        drawFrame(frameIndex);

        updateTextElements(scrollProgress);
        updateGlow(scrollProgress);
        updateParticles();

        progressBar.style.width = (scrollProgress * 100) + '%';
    }

    function initScroll() {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        function updateScroll(delta) {
            scrollProgress += delta;
            scrollProgress = Math.max(0, Math.min(1, scrollProgress));

            targetFrame = scrollProgress * (CONFIG.totalFrames - 1);

            if (scrollProgress > 0.02) {
                scrollIndicator.classList.add('hidden');
            } else {
                scrollIndicator.classList.remove('hidden');
            }
        }

        window.addEventListener('wheel', (e) => {
            const delta = e.deltaY * 0.0001;
            updateScroll(delta);
        }, { passive: false });

        let touchStartY = 0;
        window.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            touchStartY = touchY;

            const delta = deltaY * 0.0003;
            updateScroll(delta);
            e.preventDefault();
        }, { passive: false });
    }

    let resizeTimeout;
    function onResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeCanvas();
            initParticles();
        }, 150);
    }

    async function init() {
        resizeCanvas();
        initParticles();

        await loadFrames();

        drawFrame(0);

        initScroll();

        animate();

        window.addEventListener('resize', onResize);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
