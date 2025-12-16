// --- 调试日志工具 ---
const debugConsole = document.getElementById('debug-console');
function log(msg) {
    if (debugConsole) {
        const time = new Date().toLocaleTimeString();
        debugConsole.innerHTML += `[${time}] ${msg}<br>`;
    }
    console.log(msg);
}

const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (window.location.protocol === 'file:') {
    document.getElementById('protocol-warning').style.display = 'block';
}

// --- 全局变量与配置 ---
const CAKE_THEME = { bottom: "#FF69B4", top: "#FFB6C1", cream: "#FFFFFF" };
const VISUAL_CONFIG = { particleCount: IS_MOBILE ? 4000 : 7500, color: 0xff69b4, blowThreshold: 25, blowMaxDuration: 100 };
const STATE = { INTRO: -1, IDLE: 0, COUNTDOWN: 1, CAKE: 2, BLOWING: 3, CELEBRATION: 4 };

let currentState = STATE.INTRO;
let interactionMode = 0; 

let particlesData = [];
let scene, camera, renderer, particleSystem;
let time = 0;
let shapeCache = {}; 
let blowProgress = 0;
let isSpacePressed = false; 
let isTouching = false; 

let rotationVelocity = 0;
let isDragging = false;
let previousMouseX = 0;
let lastHandX = 0;
let autoRotateSpeed = 0.005;

// --- 自动倒数变量 ---
let autoEntryTimer = null;
let autoEntrySeconds = 10;

let audioContext, analyser;
const bgm = document.getElementById('bgm');

const ui = {
    startOverlay: document.getElementById('start-overlay'),
    uiLayer: document.getElementById('ui-layer'),
    statusText: document.getElementById('status-text'),
    statusDot: document.getElementById('status-dot'),
    mainText: document.getElementById('instruction-text'),
    subText: document.getElementById('sub-instruction'),
    handIcon: document.getElementById('hand-icon'),
    blowMeter: document.getElementById('blow-meter-container'),
    blowBar: document.getElementById('blow-meter-bar'),
    blowHint: document.getElementById('blow-hint'),
    surpriseLayer: document.getElementById('surprise-layer'),
    revealBtn: document.getElementById('reveal-btn'),
    floatingGiftBtn: document.getElementById('floating-gift-btn'),
    cardContainer: document.getElementById('flip-card-container'), 
    nextBtn: document.getElementById('next-surprise-btn'),
    closeBtn: document.getElementById('close-card-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsToggle: document.getElementById('settings-toggle'),
    topBanner: document.getElementById('top-banner'),
    startBtn: document.getElementById('start-btn'),
    loadingText: document.getElementById('loading-text'),
    camStatusDot: document.getElementById('cam-status-dot'),
    camStatusText: document.getElementById('cam-status-text'),
    // 卡片相关 UI
    page1: document.getElementById('card-page-1'),
    page2: document.getElementById('card-page-2'),
    toPage2Btn: document.getElementById('to-page-2-btn'),
    textContainer1: document.getElementById('typewriter-text-1'),
    textContainer2: document.getElementById('typewriter-text-2'),
    // 自动倒数文本
    autoCountdownText: document.getElementById('auto-countdown-text')
};

// 立即初始化 Three.js
initThree();

function initThree() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;
    renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    preloadShapes();
    createParticles();
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const onStart = (x) => {
        if(interactionMode === 1) {
            isDragging = true;
            previousMouseX = x;
            rotationVelocity = 0; 
        }
    };
    const onMove = (x) => {
        if(isDragging && interactionMode === 1) {
            const delta = x - previousMouseX;
            const sensitivity = IS_MOBILE ? 0.015 : 0.008; 
            rotationVelocity = delta * sensitivity;
            particleSystem.rotation.y += rotationVelocity;
            previousMouseX = x;
        }
    };
    const onEnd = () => { isDragging = false; };

    container.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    container.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), {passive: false});
    window.addEventListener('touchmove', (e) => {
        if(isDragging) e.preventDefault(); 
        onMove(e.touches[0].clientX);
    }, {passive: false});
    window.addEventListener('touchend', onEnd);
    
    render();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(VISUAL_CONFIG.particleCount * 3);
    const colors = new Float32Array(VISUAL_CONFIG.particleCount * 3);
    const sizes = new Float32Array(VISUAL_CONFIG.particleCount);
    particlesData = [];
    const c = new THREE.Color(VISUAL_CONFIG.color);

    for (let i = 0; i < VISUAL_CONFIG.particleCount; i++) {
        const x = (Math.random() - 0.5) * 300;
        const y = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 200;
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        sizes[i] = Math.random() * 2;
        particlesData.push({
            current: new THREE.Vector3(x, y, z),
            target: new THREE.Vector3(x, y, z),
            baseTarget: new THREE.Vector3(x, y, z),
            velocity: new THREE.Vector3(0, 0, 0),
            type: 'bg', layer: null, targetColor: c.clone(),
            noiseOffset: Math.random() * 100,
            angle: Math.random() * Math.PI * 2, 
            radius: 20 + Math.random() * 40,
            orbitSpeed: (Math.random() - 0.5) * 0.02
        });
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({ size: 1.2, vertexColors: true, map: getCircleTexture(), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
}

function getCircleTexture() {
    const c = document.createElement('canvas'); c.width=64; c.height=64;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
}

function getShapePoints(type, text) {
    const points = [];
    if (type === 'text') {
        const c = document.createElement('canvas'); c.width=250; c.height=250;
        const ctx=c.getContext('2d');
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = 'white'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(text, 125, 125);
        const data = ctx.getImageData(0,0,250,250).data;
        const step = 2;
        for(let y=0; y<250; y+=step) {
            for(let x=0; x<250; x+=step) {
                if(data[(y*250+x)*4+3]>128) {
                    points.push({ vec: new THREE.Vector3((x-125)/3.5, -(y-125)/3.5, 0).multiplyScalar(2), type: 'text', color: new THREE.Color(0xffffff) });
                }
            }
        }
    } else if (type === 'cake') {
        const layers = [{y: -16, r: 18, h: 10, type: 'bottom'}, {y: -6,  r: 13, h: 8,  type: 'top'}];
        layers.forEach(l => {
            for(let i=0; i<(IS_MOBILE?800:1500); i++) {
                const theta = Math.random() * Math.PI * 2;
                const r = l.r * (0.95 + Math.random()*0.05); 
                const h = Math.random() * l.h;
                points.push({ vec: new THREE.Vector3(r*Math.cos(theta), l.y+h, r*Math.sin(theta)), type: 'cake', layer: l.type });
            }
            for(let i=0; i<500; i++) {
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * l.r;
                points.push({ vec: new THREE.Vector3(r*Math.cos(theta), l.y+l.h, r*Math.sin(theta)), type: 'cake', layer: 'cream' });
            }
            for(let i=0; i<100; i++) {
                const theta = Math.random() * Math.PI * 2;
                const r = l.r + 0.2;
                const h = Math.random() * l.h;
                const sprinkleColor = new THREE.Color().setHSL(Math.random(), 1, 0.6);
                points.push({
                    vec: new THREE.Vector3(r*Math.cos(theta), l.y+h, r*Math.sin(theta)),
                    type: 'cake', color: sprinkleColor
                });
            }
        });
        const candleY = layers[1].y + layers[1].h;
        for(let i=0; i<300; i++) {
            const h = Math.random() * 12;
            const r = Math.random() * 0.8;
            const theta = Math.random() * Math.PI * 2;
            let col = (Math.sin(h*1.5 + theta)>0) ? new THREE.Color(0xFF0000) : new THREE.Color(0xFFFFFF);
            points.push({ vec: new THREE.Vector3(r*Math.cos(theta), candleY+h, r*Math.sin(theta)), type: 'candle', color: col });
        }
        const flameY = candleY + 12;
        for(let i=0; i<400; i++) {
            const u = Math.random();
            const h = u * 7;
            const r = (1-u) * 2.0 * Math.random();
            const theta = Math.random() * Math.PI * 2;
            let col = new THREE.Color(0xFFA500);
            if(u<0.2) col.setHex(0x0000FF); else if(u>0.7) col.setHex(0xFF4500);
            points.push({ vec: new THREE.Vector3(r*Math.cos(theta), flameY+h, r*Math.sin(theta)), type: 'flame', color: col });
        }
    }
    return points;
}

function preloadShapes() {
    setTimeout(() => {
        shapeCache['3'] = getShapePoints('text', '3');
        shapeCache['2'] = getShapePoints('text', '2');
        shapeCache['1'] = getShapePoints('text', '1');
        shapeCache['cake'] = getShapePoints('cake');
        ui.loadingText.style.display = 'none';
    }, 100);
}

function transitionTo(key) {
    const targets = shapeCache[key] || [];
    particlesData.forEach((p, i) => {
        if (i < targets.length) {
            p.baseTarget.copy(targets[i].vec);
            p.target.copy(targets[i].vec);
            p.type = targets[i].type;
            p.layer = targets[i].layer;
            if(targets[i].color) {
                p.targetColor = targets[i].color.clone();
            } else {
                p.targetColor = new THREE.Color(0xffffff); 
            }
            const force = 3;
            p.current.add(new THREE.Vector3((Math.random()-0.5)*force, (Math.random()-0.5)*force, (Math.random()-0.5)*force));
        } else {
            const angle = Math.random() * Math.PI * 2;
            const r = 40 + Math.random() * 40;
            p.baseTarget.set(r*Math.cos(angle), (Math.random()-0.5)*60, r*Math.sin(angle));
            p.target.copy(p.baseTarget);
            p.type = 'bg';
            p.layer = null;
            p.targetColor = new THREE.Color(0x222222);
        }
    });
}

function updateParticles() {
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    const sizes = particleSystem.geometry.attributes.size.array;
    time += 0.02;
    const blowInfluence = blowProgress / 100;

    for (let i = 0; i < VISUAL_CONFIG.particleCount; i++) {
        const p = particlesData[i];
        let target = p.target.clone();

        if (p.type === 'cake') {
            if (p.layer === 'bottom') p.targetColor.set(CAKE_THEME.bottom);
            else if (p.layer === 'top') p.targetColor.set(CAKE_THEME.top);
            else if (p.layer === 'cream') p.targetColor.set(CAKE_THEME.cream);
        }

        if (currentState === STATE.INTRO) {
            const angle = p.angle + time * 0.05;
            const r = p.radius + Math.sin(time * 0.5 + i * 0.01) * 10;
            target.x = Math.cos(angle) * r * 3;
            target.z = Math.sin(angle) * r * 3;
            target.y = p.baseTarget.y + Math.sin(time * 0.5 + target.x * 0.05) * 20; 
            const hue = 0.8 + (Math.sin(time * 0.1 + target.x * 0.01) * 0.1); 
            p.targetColor.setHSL(hue, 0.7, 0.6);
        }
        else if (currentState === STATE.CELEBRATION && p.type === 'bg') {
            const angle = p.angle + time * 0.1 + p.orbitSpeed;
            const r = p.radius + Math.sin(time + i) * 5;
            target.x = Math.cos(angle) * r;
            target.z = Math.sin(angle) * r;
            target.y = p.baseTarget.y + Math.sin(time + p.noiseOffset) * 2;
            const hue = 0.9 + (Math.sin(time + i * 0.01) * 0.05); 
            p.targetColor.setHSL(hue, 0.8, 0.6);
        } 
        else if (currentState === STATE.IDLE) {
            const angle = p.angle + time * 0.1;
            const r = p.radius + Math.sin(time + i * 0.01)*2;
            target.x = Math.cos(angle) * r;
            target.z = Math.sin(angle) * r;
            target.y = p.baseTarget.y + Math.sin(time + target.x * 0.05) * 5; 
            p.targetColor.set(0x333333); 
        }

        if (p.type === 'flame') {
            const noise = Math.sin(time * 6 + p.noiseOffset) * 0.6;
            target.x += noise;
            if (blowInfluence > 0.1 || currentState === STATE.CELEBRATION) {
                let lift = blowInfluence * 25;
                if(currentState === STATE.CELEBRATION) lift = 60;
                target.y += lift;
                target.x += (Math.random()-0.5) * lift * 0.8;
                p.targetColor.lerp(new THREE.Color(0xdddddd), 0.1); 
            }
        }

        p.current.lerp(target, 0.08);

        positions[i*3] = p.current.x;
        positions[i*3+1] = p.current.y;
        positions[i*3+2] = p.current.z;
        
        colors[i*3] += (p.targetColor.r - colors[i*3]) * 0.1;
        colors[i*3+1] += (p.targetColor.g - colors[i*3+1]) * 0.1;
        colors[i*3+2] += (p.targetColor.b - colors[i*3+2]) * 0.1;

        if (p.type === 'flame' && (blowInfluence > 0.1 || currentState === STATE.CELEBRATION)) {
            sizes[i] = Math.max(0, 1.5 * (1 - blowInfluence)); 
            if(currentState === STATE.CELEBRATION) sizes[i] *= 0.9;
        } else {
            sizes[i] = 1.2 + Math.sin(time + i) * 0.3;
        }
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    particleSystem.geometry.attributes.size.needsUpdate = true;
    
    if (interactionMode === 1) {
        if (!isDragging) {
            rotationVelocity *= 0.96; 
            particleSystem.rotation.y += rotationVelocity + autoRotateSpeed;
        }
    } else if (currentState !== STATE.IDLE && currentState !== STATE.INTRO) {
        particleSystem.rotation.y = Math.sin(time * 0.15) * 0.15;
    } else {
        particleSystem.rotation.y = 0;
    }
}

/* --- 业务逻辑 --- */
let transitionLock = false;

function startSequence() {
    if (currentState !== STATE.IDLE || transitionLock) return;
                
    // 清除自动倒数计时器
    if (autoEntryTimer) {
        clearInterval(autoEntryTimer);
        autoEntryTimer = null;
    }
    ui.autoCountdownText.classList.add('hidden');

    log('检测到手势，开始倒计时序列');
    transitionLock = true;
    currentState = STATE.COUNTDOWN;
    ui.statusText.innerText = "GESTURE DETECTED";
    ui.statusText.className = "text-xs md:text-sm text-green-400 font-bold tracking-wider";
    ui.statusDot.className = "inline-block w-2 h-2 rounded-full bg-green-500 mr-2 shadow-[0_0_8px_#0f0]";
    ui.handIcon.style.display = 'none';
    let count = 3;
    ui.mainText.innerText = "";
    ui.subText.innerText = "";
    transitionTo('3');
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            transitionTo(count.toString());
        } else {
            clearInterval(timer);
            showCake();
        }
    }, 1200);
}

function showCake() {
    log('展示蛋糕，开启吹气检测');
    currentState = STATE.BLOWING;
    transitionTo('cake');
    ui.settingsPanel.style.display = 'flex';
    ui.mainText.innerText = "";
    ui.subText.innerText = "";
    ui.topBanner.classList.remove('hidden'); 
    ui.statusText.innerText = "MIC LISTENING...";
    ui.blowMeter.style.opacity = '1';
    ui.blowHint.style.opacity = '1';
}

function successCelebration() {
    log('许愿成功！播放庆祝动画');
    currentState = STATE.CELEBRATION;
    ui.statusText.innerText = "WISH GRANTED";
    ui.blowMeter.style.opacity = '0';
    ui.blowHint.style.opacity = '0';
    ui.settingsPanel.style.display = 'none';
    
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 500);

    particlesData.forEach(p => {
        if (p.type === 'cake' || p.type === 'candle' || p.type === 'ring') {
            p.target.y += Math.sin(p.current.x * 0.5) * 0.5; 
        } else if (p.type !== 'flame') {
            p.type = 'bg'; 
        }
    });

    setTimeout(() => {
        ui.surpriseLayer.classList.remove('hidden');
        ui.surpriseLayer.classList.add('active');
        ui.revealBtn.classList.remove('hidden');
    }, 1500);
}

document.getElementById('picker-bottom').addEventListener('input', (e) => CAKE_THEME.bottom = e.target.value);
document.getElementById('picker-top').addEventListener('input', (e) => CAKE_THEME.top = e.target.value);
document.getElementById('picker-cream').addEventListener('input', (e) => CAKE_THEME.cream = e.target.value);

ui.settingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const display = ui.settingsPanel.style.display;
    ui.settingsPanel.style.display = (display === 'none' || display === '') ? 'flex' : 'none';
});

// 第一页祝福语
const wishes_part1 = [
    "李老师：",
    "嗨皮波斯得ヾ(^▽^ヾ)🎊",
    "",
    "愿你的生活如这静谧的星空，",
    "不必争抢月亮的光辉，🌙",
    "只需守住一颗恒星的坚定。✨",
    "每一次闪烁都不是微弱，💖",
    "而是为了照亮心中那片未知的原野。🎉",
    "愿你的新岁，璀璨而辽阔。🎉🎁🛍",
    "         —— 送给独一无二的你 "
];

// 第二页惊喜页
const wishes_part2 = [
    "任务接收人:李欣蔓",
    "任务主题:赴约取惊喜，顺便蹭蛋糕🎂",
    "任务地点:经济管理学院516",
    "任务时间:12月20日上午☀️",
    "",
    "任务要求:",
    "1.带上好性情，拒绝emo和忙碌;",
    "2.来之前发个消息，方便我提前‘备战’。",
    "",
    "任务奖励:一份为你量身定制的小礼物😆",
    "逾期不候？不存在的！随时约我调整时间~",
    "发件人:你的专属礼物官[红中老师]😎",
    "12月20日"
];

function typeWriter(textArray, containerId, speed = 50) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    let lineIndex = 0;
    let charIndex = 0;

    function type() {
        if (lineIndex < textArray.length) {
            const currentLine = textArray[lineIndex];
            if (charIndex < currentLine.length) {
                container.innerHTML += currentLine.charAt(charIndex);
                charIndex++;
                setTimeout(type, speed);
            } else {
                container.innerHTML += "<br>";
                lineIndex++;
                charIndex = 0;
                setTimeout(type, 300);
            }
            // 自动滚动到底部
            container.scrollTop = container.scrollHeight;
        }
    }
    type();
}

ui.revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.revealBtn.classList.add('hidden');
    ui.cardContainer.classList.remove('hidden');
});

// "What's the surprise" 按钮 -> 翻转到背面 (第一页)
ui.nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.cardContainer.classList.add('flipped');
    // 显示第一页，隐藏第二页
    ui.page1.classList.remove('hidden');
    ui.page2.classList.add('hidden');
    setTimeout(() => typeWriter(wishes_part1, 'typewriter-text-1'), 400);
});

// "还有话对你说" 按钮 -> 切换到第二页
ui.toPage2Btn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.page1.classList.add('hidden');
    ui.page2.classList.remove('hidden');
    // 重新触发第二页的打字机
    setTimeout(() => typeWriter(wishes_part2, 'typewriter-text-2', 30), 100);
});

ui.floatingGiftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.floatingGiftBtn.classList.add('hidden'); 
    ui.surpriseLayer.classList.remove('hidden'); 
    ui.surpriseLayer.classList.add('active');
    interactionMode = 0;
    ui.cardContainer.classList.remove('hidden');
    ui.cardContainer.classList.remove('flipped');
    // 重置为第一页状态
    ui.page1.classList.remove('hidden');
    ui.page2.classList.add('hidden');
});

// "收起卡片" 按钮
ui.closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.mainText.innerText = ""; 
    ui.surpriseLayer.classList.remove('active');
    ui.surpriseLayer.classList.add('hidden');    
    ui.floatingGiftBtn.classList.remove('hidden');
    
    interactionMode = 1; 
    transitionTo('cake'); 
    ui.statusText.innerText = "INTERACTIVE MODE: DRAG TO ROTATE";
    ui.typewriter.innerHTML = ""; 
    ui.topBanner.classList.remove('hidden');
});


// --- 自动倒数功能 ---
function startAutoEntryCountdown() {
    autoEntrySeconds = 15;
    ui.autoCountdownText.classList.remove('hidden');
    ui.autoCountdownText.innerText = `若未检测到手势，${autoEntrySeconds}秒后自动开始...`;
    
    // 清除旧的计时器（如果存在）
    if (autoEntryTimer) clearInterval(autoEntryTimer);

    autoEntryTimer = setInterval(() => {
        autoEntrySeconds--;
        if (autoEntrySeconds > 0) {
            ui.autoCountdownText.innerText = `若未检测到手势，${autoEntrySeconds}秒后自动开始...`;
        } else {
            clearInterval(autoEntryTimer);
            autoEntryTimer = null;
            ui.autoCountdownText.classList.add('hidden');
            // 只有在还是 IDLE 状态时才自动开始，防止用户刚好在此时触发了手势
            if (currentState === STATE.IDLE) {
                log('自动倒数结束，触发开始序列');
                startSequence();
            }
        }
    }, 1000);
}

// 按钮点击事件处理
ui.startBtn.addEventListener('click', async function() {
    log('点击了进入按钮...');
    const btn = this;
    
    if (typeof Hands === 'undefined') {
        log('警告: MediaPipe 库加载延迟。');
    }

    btn.innerHTML = '<span class="animate-pulse">Loading...</span>';
    btn.disabled = true;
    ui.loadingText.style.display = 'block';
    
    try {
        fadeAudioIn();
        await initAudio();
        log('音频初始化成功');
    } catch(e) {
        log('音频初始化警告: ' + e);
        ui.statusText.innerText = "AUDIO/MIC LIMITED";
    }

    try {
        log('尝试启动摄像头...');
        await initCamera();
        log('摄像头启动成功');
    } catch (e) {
        log('摄像头/MediaPipe 失败: ' + e);
        ui.statusText.innerText = "CAMERA FAILED - USE SPACEBAR";
    }
    
    log('进入主界面...');
    currentState = STATE.IDLE;
    ui.startOverlay.classList.add('hidden');
    ui.uiLayer.style.display = 'flex';

    // 启动自动倒数
    startAutoEntryCountdown();
});

async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        checkAudio();
    } catch (e) {
        log('麦克风权限被拒绝');
        ui.statusText.innerText = "MIC DENIED - USE TOUCH/SPACE";
        throw e;
    }
}

document.addEventListener('touchstart', (e) => {
    if(currentState === STATE.BLOWING && !e.target.closest('button') && !e.target.closest('input')) {
        isTouching = true;
    }
}, {passive: false});

document.addEventListener('touchend', () => isTouching = false);
document.addEventListener('touchcancel', () => isTouching = false);
document.addEventListener('keydown', (e) => { if(e.code === 'Space') isSpacePressed = true; });
document.addEventListener('keyup', (e) => { if(e.code === 'Space') isSpacePressed = false; });

function checkAudio() {
    requestAnimationFrame(checkAudio);
    if (currentState !== STATE.BLOWING) return;
    let volume = 0;
    if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0; for(let i=0; i<data.length; i++) sum += data[i];
        volume = sum / data.length;
    }
    if (volume > VISUAL_CONFIG.blowThreshold || isSpacePressed || isTouching) {
        isBlowing = true;
        blowProgress += 0.8; 
    } else {
        isBlowing = false;
        blowProgress -= 0.3; 
    }
    blowProgress = Math.max(0, Math.min(100, blowProgress));
    ui.blowBar.style.width = blowProgress + '%';
    if (blowProgress >= 100) successCelebration();
}

function fadeAudioIn() {
    bgm.currentTime = 23;
    const playPromise = bgm.play();
    if (playPromise !== undefined) {
        playPromise.then(_ => {
            log('背景音乐开始播放');
        }).catch(error => {
            log('自动播放被阻止，等待用户交互');
        });
    }
    
    bgm.volume = 0;
    let vol = 0;
    const fade = setInterval(() => {
        vol += 0.05;
        if(vol >= 0.95) { vol = 1; clearInterval(fade); }
        bgm.volume = vol;
    }, 200);
}

document.getElementById('music-btn').addEventListener('click', () => {
    if (bgm.paused) bgm.play(); else bgm.pause();
});

async function initCamera() {
    const video = document.getElementsByClassName('input_video')[0];
    
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        throw new Error("MediaPipe 库未加载");
    }

    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`});
    
    hands.setOptions({ 
        maxNumHands: 1, 
        modelComplexity: 0, 
        minDetectionConfidence: 0.5, 
        minTrackingConfidence: 0.5 
    });
    
    hands.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            ui.camStatusDot.className = "w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]";
            ui.camStatusText.innerText = "DETECTED";
            ui.camStatusText.className = "text-[8px] text-green-400 font-mono font-bold";
            
            if (currentState === STATE.IDLE) {
                startSequence();
            }
            if (interactionMode === 1) {
                const currentHandX = results.multiHandLandmarks[0][9].x; 
                const delta = currentHandX - lastHandX;
                if (Math.abs(delta) > 0.002) {
                    // 大幅提高手势控制灵敏度
                    rotationVelocity += delta * -0.4; 
                }
                lastHandX = currentHandX;
            }
        } else {
            ui.camStatusDot.className = "w-1.5 h-1.5 rounded-full bg-red-500";
            ui.camStatusText.innerText = "NO HAND";
            ui.camStatusText.className = "text-[8px] text-red-400 font-mono";
        }

        const ctx = document.getElementById('output_canvas').getContext('2d');
        ctx.clearRect(0, 0, 160, 120);
        if(results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                for (const l of results.multiHandLandmarks) {
                    drawConnectors(ctx, l, HAND_CONNECTIONS, {color: '#ff69b4', lineWidth: 2});
                }
        }
    });

    const camera = new Camera(video, { 
        onFrame: async () => { await hands.send({image: video}); }, 
        width: 320, 
        height: 240 
    });
    
    return camera.start();
}

function render() {
    requestAnimationFrame(render);
    updateParticles();
    renderer.render(scene, camera);
}
