// ============================================================
// 🎣 FISHING REALISTIC - Full Game Engine
// Mechanics: cast power, line tension, fish AI, strike window
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 900, H = 600;

// --- Game State ---
const state = {
    score: 0,
    fishCaught: 0,
    phase: 'idle',          // idle | charging | casting | waiting | fish_bite | reeling | caught
    power: 0,
    charging: false,
    lineX: W/2,
    lineY: 80,
    lineEndX: W/2,
    lineEndY: 80,
    bobX: W/2,
    bobY: 80,
    bobSplash: 0,
    fish: null,
    targetCircle: null,     // { x, y, radius, spawnTime, hit }
    biteTimer: 0,
    fishAlert: 0,
    rippleTimer: 0,
    ripples: [],
    underwaterFish: [],     // decorative fish swimming
    lineTension: 0,
    castAngle: 0,
    castSpeed: 0,
};

// --- Fish Species ---
const FISH_TYPES = [
    { name: 'Tilápia', color: '#8abaae', weight: 0.5, points: 10, minWait: 2, maxWait: 5 },
    { name: 'Traíra', color: '#5a7a3a', weight: 1.2, points: 25, minWait: 3, maxWait: 7 },
    { name: 'Tucunaré', color: '#e8b828', weight: 2.0, points: 40, minWait: 4, maxWait: 8 },
    { name: 'Dourado', color: '#d4a017', weight: 3.5, points: 60, minWait: 5, maxWait: 10 },
    { name: 'Pirarucu', color: '#8b4513', weight: 5.0, points: 100, minWait: 7, maxWait: 12 },
];

// --- Decor fish (underwater background) ---
function spawnDecorFish() {
    for (let i = 0; i < 8; i++) {
        state.underwaterFish.push({
            x: Math.random() * W,
            y: 350 + Math.random() * 220,
            size: 8 + Math.random() * 14,
            speed: 0.3 + Math.random() * 0.8,
            dir: Math.random() > 0.5 ? 1 : -1,
            color: `hsla(${140 + Math.random() * 60}, 30%, ${40 + Math.random() * 30}%, 0.3)`,
            waveOffset: Math.random() * Math.PI * 2,
        });
    }
}
spawnDecorFish();

// --- Ripples ---
function addRipple(x, y, intensity) {
    state.ripples.push({ x, y, radius: 2, maxRadius: 10 + intensity * 20, alpha: 1, speed: 1 + intensity * 0.5 });
}

function updateRipples() {
    state.ripples = state.ripples.filter(r => {
        r.radius += r.speed;
        r.alpha = 1 - (r.radius / r.maxRadius);
        return r.alpha > 0;
    });
}

// --- Fish AI ---
function spawnFish() {
    const type = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
    const side = Math.random() > 0.5 ? -1 : 1;
    const startX = side === -1 ? -40 : W + 40;
    const targetX = 150 + Math.random() * (W - 300);
    const targetY = 300 + Math.random() * 200;

    state.fish = {
        ...type,
        x: startX,
        y: targetY,
        targetX,
        targetY,
        size: 20 + type.weight * 8,
        speed: 0.5 + Math.random() * 1.5,
        arrived: false,
        biteTimer: 0,
        biteChanceTimer: 0,
        biteWindowStart: type.minWait + Math.random() * 2,
        biteWindowEnd: type.maxWait + Math.random() * 3,
        interested: true,
        wiggle: 0,
    };
    state.phase = 'waiting';
    state.biteTimer = 0;
}

function updateFish() {
    if (!state.fish) return;
    const f = state.fish;

    const dx = f.targetX - f.x;
    const dy = f.targetY - f.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 5) {
        f.x += (dx / dist) * f.speed;
        f.y += (dy / dist) * f.speed;
        f.wiggle += 0.05;
    } else {
        f.arrived = true;
        f.x += Math.sin(f.wiggle) * 0.3;
        f.wiggle += 0.02;

        f.biteTimer += 1/60;
        if (f.biteTimer >= f.biteWindowStart && f.biteTimer <= f.biteWindowEnd && state.phase === 'waiting') {
            const bobDist = Math.sqrt((f.x - state.bobX)**2 + (f.y - state.bobY)**2);
            if (bobDist < 80) {
                f.x += (state.bobX - f.x) * 0.01;
                f.y += (state.bobY - f.y) * 0.01;
                if (bobDist < 30 && Math.random() < 0.02) {
                    state.phase = 'fish_bite';
                    state.fishAlert = 1.0;
                    state.biteTimer = 0;
                    state.targetCircle = {
                        x: state.bobX + (Math.random() - 0.5) * 60,
                        y: state.bobY + (Math.random() - 0.5) * 40 + 20,
                        radius: 20,
                        spawnTime: Date.now(),
                        hit: false,
                        life: 1.5,
                    };
                    f.interested = false;
                }
            }
        }
        if (f.biteTimer > f.biteWindowEnd + 3) f.interested = false;
    }
}

function castLine(power) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    state.castAngle = angle;
    state.castSpeed = 4 + power * 0.08;
    state.phase = 'casting';
    state.power = 0;
    const dist = 100 + power * 1.2;
    state.bobX = Math.max(30, Math.min(W - 30, state.lineX + Math.cos(angle) * dist * 0.3));
    state.bobY = Math.max(200, Math.min(H - 30, state.lineY + Math.sin(angle) * dist * 0.3 + 50));
    state.lineEndX = state.bobX;
    state.lineEndY = state.bobY;
    setTimeout(() => {
        if (state.phase === 'casting') { state.phase = 'waiting'; addRipple(state.bobX, state.bobY, 0.8); spawnFish(); }
    }, 800 + power * 2);
}

function startReeling() {
    state.phase = 'reeling';
    state.biteTimer = 0;
    state.fishAlert = 0;
    if (state.targetCircle) state.targetCircle = null;
}

function updateReeling() {
    if (state.phase !== 'reeling' || !state.fish) return;
    const pullSpeed = 2 + state.score * 0.01;
    const dx = state.lineX - state.fish.x;
    const dy = state.lineY - state.fish.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    state.fish.x += (dx / (dist || 1)) * pullSpeed;
    state.fish.y += (dy / (dist || 1)) * pullSpeed + Math.sin(state.fish.wiggle) * 0.5;
    state.fish.wiggle += 0.1;
    state.bobX = state.fish.x;
    state.bobY = state.fish.y;
    state.lineTension = Math.min(1, dist / 400);
    if (dist < 40) {
        state.phase = 'caught';
        state.score += state.fish.points;
        state.fishCaught++;
        for (let i = 0; i < 5; i++) setTimeout(() => addRipple(state.bobX, state.bobY, 1.5), i * 100);
        setTimeout(() => { state.fish = null; state.phase = 'idle'; state.bobX = state.lineX; state.bobY = state.lineY; }, 1500);
    }
    if (Math.random() < 0.003 && state.fish.weight > 2) {
        state.phase = 'waiting';
        state.fish.interested = false;
        state.fish.biteTimer = 999;
    }
}

function drawBackground() {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 300);
    skyGrad.addColorStop(0, '#1a3a5c'); skyGrad.addColorStop(0.5, '#2a5a7c'); skyGrad.addColorStop(1, '#3a7a9c');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, 260);
    ctx.fillStyle = 'rgba(100,200,255,0.08)'; ctx.fillRect(0, 240, W, 40);
    const waterGrad = ctx.createLinearGradient(0, 260, 0, H);
    waterGrad.addColorStop(0, '#1a5a7a'); waterGrad.addColorStop(0.3, '#0d4060');
    waterGrad.addColorStop(0.6, '#082a4a'); waterGrad.addColorStop(1, '#041a30');
    ctx.fillStyle = waterGrad; ctx.fillRect(0, 260, W, H - 260);
    ctx.save();
    for (let i = 0; i < 6; i++) {
        const x = 100 + i * 140 + Math.sin(Date.now() * 0.0003 + i) * 20;
        ctx.fillStyle = `rgba(200,240,255,${0.02 + Math.sin(Date.now() * 0.001 + i * 2) * 0.01})`;
        ctx.beginPath(); ctx.moveTo(x, 260); ctx.lineTo(x - 20, H); ctx.lineTo(x + 20, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(100,200,255,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 5) {
        const y = 260 + Math.sin(x * 0.02 + Date.now() * 0.002) * 4;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    state.underwaterFish.forEach(f => {
        f.x += f.speed * f.dir;
        if (f.x > W + 30) f.dir = -1; if (f.x < -30) f.dir = 1;
        ctx.save(); ctx.translate(f.x, f.y + Math.sin(Date.now() * 0.002 + f.waveOffset) * 5); ctx.scale(f.dir, 1);
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-f.size, 0); ctx.lineTo(-f.size * 1.4, -f.size * 0.5); ctx.lineTo(-f.size * 1.4, f.size * 0.5); ctx.closePath(); ctx.fill();
        ctx.restore();
    });
}

function drawLine() {
    if (state.phase === 'idle') return;
    ctx.beginPath(); ctx.moveTo(state.lineX, state.lineY);
    const midX = (state.lineX + state.bobX) / 2, midY = (state.lineX + state.bobY) / 2 + 20 + state.lineTension * 30;
    ctx.quadraticCurveTo(midX, midY, state.bobX, state.bobY);
    ctx.strokeStyle = 'rgba(200,200,200,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawBobber() {
    if (state.phase === 'idle' || state.phase === 'charging') return;
    const bobY = state.bobY + (state.phase === 'casting' ? Math.min(40, (Date.now() % 400) / 10) : 0);
    ctx.save(); ctx.translate(state.bobX, bobY);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    glow.addColorStop(0, 'rgba(255,100,50,0.3)'); glow.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
    bg.addColorStop(0, '#ff6666'); bg.addColorStop(0.5, '#ee2222'); bg.addColorStop(1, '#881111');
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -16); ctx.stroke();
    ctx.restore();
    if (state.phase === 'waiting' || state.phase === 'fish_bite') {
        const rs = 6 + Math.sin(Date.now() * 0.005) * 3;
        ctx.strokeStyle = `rgba(200,230,255,${0.15 + Math.sin(Date.now() * 0.004) * 0.08})`;
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(state.bobX, bobY, rs, 0, Math.PI * 2); ctx.stroke();
    }
}

function drawFish() {
    if (!state.fish) return;
    const f = state.fish;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.x < state.bobX ? 1 : -1, 1);
    const g = ctx.createRadialGradient(-f.size*0.2, -f.size*0.2, 1, 0, 0, f.size);
    g.addColorStop(0, lightenColor(f.color, 40)); g.addColorStop(0.7, f.color); g.addColorStop(1, darkenColor(f.color, 30));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = darkenColor(f.color, 20);
    ctx.beginPath(); ctx.moveTo(-f.size*0.8, 0); ctx.lineTo(-f.size*1.3, -f.size*0.5); ctx.lineTo(-f.size*1.3, f.size*0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(f.size*0.4, -f.size*0.1, f.size*0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(f.size*0.45, -f.size*0.1, f.size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    if (state.phase === 'fish_bite') {
        ctx.save(); ctx.translate(f.x, f.y - f.size - 15);
        const p = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.fillStyle = `rgba(255,50,50,0.8)`; ctx.font = `${20*p}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('❗', 0, 0);
        ctx.restore();
    }
}

function drawTargetCircle() {
    if (!state.targetCircle || state.phase !== 'fish_bite') return;
    const t = state.targetCircle;
    const life = Math.max(0, 1 - (Date.now() - t.spawnTime) / 1000 / t.life);
    if (life <= 0) { state.targetCircle = null; state.phase = 'waiting'; if (state.fish) state.fish.interested = false; return; }
    const pulse = 1 + Math.sin(Date.now() * 0.015) * 0.15;
    ctx.save(); ctx.translate(t.x, t.y);
    ctx.strokeStyle = `rgba(255,50,50,${0.6*life})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, t.radius*pulse, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,200,50,${0.8*life})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, t.radius*0.5*pulse, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(255,100,50,${0.9*life})`; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.3*life})`; ctx.fillRect(-t.radius, t.radius+10, t.radius*2*life, 4);
    ctx.restore();
}

function drawRipples() {
    state.ripples.forEach(r => {
        ctx.strokeStyle = `rgba(255,255,255,${r.alpha*0.3})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI*2); ctx.stroke();
    });
}

function drawCaughtEffect() {
    if (state.phase !== 'caught') return;
    ctx.fillStyle = 'rgba(255,200,50,0.15)'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🎉 PEIXE PEGO! 🎉', W/2, 150);
}

let powerInterval = null;
canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (state.phase === 'idle') {
        state.phase = 'charging'; state.charging = true; state.power = 0;
        document.getElementById('power-bar-fill').style.width = '0%';
        powerInterval = setInterval(() => { if (state.charging) { state.power = Math.min(100, state.power+1.5); document.getElementById('power-bar-fill').style.width = state.power+'%'; } }, 20);
    }
    if (state.phase === 'fish_bite' && state.targetCircle) {
        const t = state.targetCircle;
        if (Math.sqrt((mx-t.x)**2 + (my-t.y)**2) < t.radius*1.3) { t.hit = true; state.targetCircle = null; addRipple(state.bobX, state.bobY, 1.2); startReeling(); }
    }
});
canvas.addEventListener('mouseup', () => {
    if (state.charging && state.phase === 'charging') { state.charging = false; clearInterval(powerInterval); castLine(state.power); document.getElementById('power-bar-fill').style.width = '0%'; }
});
canvas.addEventListener('mouseleave', () => {
    if (state.charging) { state.charging = false; clearInterval(powerInterval); castLine(state.power||10); document.getElementById('power-bar-fill').style.width = '0%'; }
});
document.getElementById('reset-btn').addEventListener('click', () => {
    state.score = 0; state.fishCaught = 0; state.fish = null; state.targetCircle = null; state.phase = 'idle';
    state.power = 0; state.bobX = state.lineX; state.bobY = state.lineY; state.ripples = [];
    state.charging = false; state.fishAlert = 0; clearInterval(powerInterval);
    document.getElementById('power-bar-fill').style.width = '0%';
});

function lightenColor(c, a) { let r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16); return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`; }
function darkenColor(c, a) { let r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16); return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`; }

function update() { updateRipples(); if (state.phase==='casting') state.bobY+=2; if (state.phase==='waiting'||state.phase==='fish_bite') updateFish(); if (state.phase==='reeling') updateReeling(); }
function draw() {
    ctx.clearRect(0,0,W,H); drawBackground(); drawRipples(); drawLine(); drawBobber(); drawFish(); drawTargetCircle(); drawCaughtEffect();
    document.getElementById('catch-count').textContent=state.fishCaught; document.getElementById('score').textContent=state.score;
}
function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
gameLoop();
