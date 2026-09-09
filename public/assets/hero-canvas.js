/* ==========================================================================
   EMBUN LAUNDRY — p5.js HERO CANVAS
   Generative water/droplet animation — laundry themed, performant, accessible
   Loaded via CDN, zero dependencies, respects prefers-reduced-motion
   ========================================================================== */

// Configuration
const HERO_CONFIG = {
  seed: 42,
  particleCount: 120,
  dropletCount: 15,
  rippleCount: 8,
  colorMode: 'hsb',
  canvasWidth: 1920,
  canvasHeight: 1080,
};

// Palette — tuned for the DARK hero gradient (#1e3a8a → #3b82f6).
// Values are HSB. Light/low-saturation strokes read as water over dark blue.
const HERO_PALETTE = {
  bg: [220, 60, 18],           // Dark navy — only used when canvas is opaque
  primary: [210, 80, 95],      // Bright water blue
  accent: [185, 70, 90],       // Cyan accent
  droplet: [205, 35, 100],     // Near-white water droplet
  ripple: [200, 45, 100],      // Light ripple ring
  highlight: [190, 25, 100],   // Specular highlight on droplet
  particle: [205, 30, 100],    // Ambient particles
};

// Global state
let heroParticles = [];
let heroDroplets = [];
let heroRipples = [];
let heroCanvas = null;
let heroP5 = null;
let prefersReducedMotion = false;

// Initialize p5 instance mode
const heroSketch = (p) => {
  
  p.setup = () => {
    // Check reduced motion preference
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Create canvas - responsive
    const container = document.getElementById('hero-canvas-container');
    if (!container) return;
    
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    
    heroCanvas = p.createCanvas(w, h);
    heroCanvas.parent('hero-canvas-container');
    heroCanvas.style('display', 'block');
    heroCanvas.style('width', '100%');
    heroCanvas.style('height', '100%');
    
    p.pixelDensity(1); // Prevent 2x-4x overdraw on retina
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();
    
    // Seed for reproducibility
    p.randomSeed(HERO_CONFIG.seed);
    p.noiseSeed(HERO_CONFIG.seed);
    
    // Initialize particles
    initParticles(p);
    initDroplets(p);
    
    // Handle resize
    window.addEventListener('resize', () => {
      if (heroCanvas && container) {
        const nw = container.offsetWidth;
        const nh = container.offsetHeight;
        if (nw === p.width && nh === p.height) return; // ignore mobile scroll-resize
        p.resizeCanvas(nw, nh);
        buildOrbBuffer(p);   // orbs are scale-dependent — rebuild
        initDroplets(p);     // keep droplets inside the new bounds
      }
    });
  };
  
  p.draw = () => {
    if (prefersReducedMotion) {
      p.noLoop();
      drawStaticFrame(p);
      return;
    }
    
    // Transparent clear — let the CSS hero gradient show through.
    // (background() would paint an opaque fill over the gradient.)
    p.clear();
    
    // Draw subtle radial gradient orbs (ambient depth)
    drawAmbientOrbs(p);
    
    // Update and draw ripples
    updateRipples(p);
    drawRipples(p);
    
    // Update and draw droplets
    updateDroplets(p);
    drawDroplets(p);
    
    // Update and draw particles
    updateParticles(p);
    drawParticles(p);
  };
  
  // Mouse interaction - subtle ripple on click
  p.mousePressed = () => {
    if (prefersReducedMotion) return;
    const mx = p.mouseX;
    const my = p.mouseY;
    // Only trigger if inside canvas
    if (mx >= 0 && mx <= p.width && my >= 0 && my <= p.height) {
      addRipple(mx, my, p.random(30, 60));
    }
  };
  
  // Touch support
  p.touchStarted = () => {
    if (prefersReducedMotion) return;
    const mx = p.touchX;
    const my = p.touchY;
    if (mx >= 0 && mx <= p.width && my >= 0 && my <= p.height) {
      addRipple(mx, my, p.random(30, 60));
    }
  };
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initParticles(p) {
  heroParticles = [];
  for (let i = 0; i < HERO_CONFIG.particleCount; i++) {
    heroParticles.push({
      x: p.random(p.width),
      y: p.random(p.height),
      size: p.random(1, 3),
      speedX: p.random(-0.15, 0.15),
      speedY: p.random(-0.1, 0.1),
      opacity: p.random(15, 40),
      phase: p.random(p.TWO_PI),
      phaseSpeed: p.random(0.002, 0.008),
      noiseOffset: p.random(1000),
    });
  }
}

function initDroplets(p) {
  heroDroplets = [];
  for (let i = 0; i < HERO_CONFIG.dropletCount; i++) {
    heroDroplets.push({
      x: p.random(p.width * 0.2, p.width * 0.8),
      y: p.random(-p.height * 0.5, p.height * 0.3),
      size: p.random(8, 20),
      speedY: p.random(0.5, 1.5),
      wobble: p.random(0.02, 0.05),
      wobblePhase: p.random(p.TWO_PI),
      opacity: p.random(40, 70),
      trail: [],
      maxTrail: 8,
    });
  }
}

// ============================================================================
// RIPPLE SYSTEM
// ============================================================================

function addRipple(x, y, maxRadius) {
  heroRipples.push({
    x,
    y,
    radius: 1,
    maxRadius,
    opacity: 60,
    life: 1,
    decay: p5.prototype ? 0.008 : 0.008, // fallback
  });
}

function updateRipples(p) {
  for (let i = heroRipples.length - 1; i >= 0; i--) {
    const r = heroRipples[i];
    r.radius += (r.maxRadius - r.radius) * 0.08;
    r.opacity *= 0.96;
    r.life -= 0.02;
    if (r.life <= 0 || r.opacity < 2) {
      heroRipples.splice(i, 1);
    }
  }
}

function drawRipples(p) {
  for (const r of heroRipples) {
    const alpha = r.opacity * r.life;
    p.stroke(...HERO_PALETTE.ripple, alpha);
    p.strokeWeight(1.5);
    p.noFill();
    p.drawingContext.setLineDash([4, 4]);
    p.ellipse(r.x, r.y, r.radius * 2);
    p.drawingContext.setLineDash([]);
  }
}

// ============================================================================
// DROPLET SYSTEM
// ============================================================================

function updateDroplets(p) {
  for (const d of heroDroplets) {
    // Add current position to trail
    d.trail.push({ x: d.x, y: d.y });
    if (d.trail.length > d.maxTrail) d.trail.shift();
    
    // Fall down with wobble
    d.y += d.speedY;
    d.wobblePhase += d.wobble;
    d.x += p.sin(d.wobblePhase) * 0.5;
    
    // Reset when off screen
    if (d.y > p.height + 50) {
      d.y = p.random(-100, -20);
      d.x = p.random(p.width * 0.1, p.width * 0.9);
      d.speedY = p.random(0.5, 1.5);
      d.size = p.random(8, 20);
      d.trail = [];
    }
  }
}

function drawDroplets(p) {
  for (const d of heroDroplets) {
    // Draw trail
    p.noStroke();
    for (let i = 0; i < d.trail.length; i++) {
      const t = d.trail[i];
      const progress = i / d.trail.length;
      const alpha = d.opacity * progress * 0.3;
      const sz = d.size * progress * 0.6;
      p.fill(...HERO_PALETTE.droplet, alpha);
      p.ellipse(t.x, t.y, sz, sz * 0.7);
    }
    
    // Draw main droplet (teardrop shape)
    p.push();
    p.translate(d.x, d.y);
    p.fill(...HERO_PALETTE.droplet, d.opacity);
    p.beginShape();
    // Teardrop using bezier
    const s = d.size;
    p.vertex(0, -s * 0.5);
    p.bezierVertex(s * 0.6, -s * 0.5, s * 0.6, s * 0.3, 0, s * 0.8);
    p.bezierVertex(-s * 0.6, s * 0.3, -s * 0.6, -s * 0.5, 0, -s * 0.5);
    p.endShape(p.CLOSE);
    
    // Highlight on droplet
    p.fill(...HERO_PALETTE.highlight, 40);
    p.ellipse(-s * 0.15, -s * 0.2, s * 0.3, s * 0.2);
    p.pop();
  }
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

function updateParticles(p) {
  for (const pt of heroParticles) {
    // Float with noise
    const nx = p.noise(pt.noiseOffset, p.frameCount * 0.001) * 2 - 1;
    const ny = p.noise(pt.noiseOffset + 100, p.frameCount * 0.001) * 2 - 1;
    
    pt.x += pt.speedX + nx * 0.05;
    pt.y += pt.speedY + ny * 0.05;
    pt.phase += pt.phaseSpeed;
    
    // Wrap around
    if (pt.x < -10) pt.x = p.width + 10;
    if (pt.x > p.width + 10) pt.x = -10;
    if (pt.y < -10) pt.y = p.height + 10;
    if (pt.y > p.height + 10) pt.y = -10;
  }
}

function drawParticles(p) {
  for (const pt of heroParticles) {
    const pulse = p.sin(pt.phase) * 0.3 + 0.7;
    const sz = pt.size * pulse;
    const alpha = pt.opacity * pulse;
    p.fill(...HERO_PALETTE.particle, alpha);
    p.ellipse(pt.x, pt.y, sz, sz);
  }
}

// ============================================================================
// AMBIENT ORBS (BACKGROUND DEPTH)
// ============================================================================

// The orbs are STATIC (they never animate), so they are pre-rendered once into
// an offscreen buffer and blitted as a single image per frame. Rendering them
// inline would mean 3 full-canvas gradient fills every frame (~6M px at 1920px).
const HERO_ORBS = [
  { x: 0.15, y: 0.20, r: 0.35, hue: 215, sat: 70, bri: 60, alpha: 7 },
  { x: 0.85, y: 0.15, r: 0.30, hue: 185, sat: 75, bri: 55, alpha: 6 },
  { x: 0.50, y: 0.90, r: 0.40, hue: 220, sat: 65, bri: 50, alpha: 5 },
];

let heroOrbBuffer = null;

function buildOrbBuffer(p) {
  if (!heroOrbBuffer) {
    heroOrbBuffer = p.createGraphics(p.width, p.height);
    heroOrbBuffer.pixelDensity(1);
  } else {
    heroOrbBuffer.resizeCanvas(p.width, p.height);
  }

  const g = heroOrbBuffer;
  g.clear();
  const ctx = g.drawingContext;

  for (const orb of HERO_ORBS) {
    const cx = orb.x * p.width;
    const cy = orb.y * p.height;
    const r = orb.r * p.width;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${orb.hue}, ${orb.sat}%, ${orb.bri}%, ${orb.alpha / 100})`);
    grad.addColorStop(1, `hsla(${orb.hue}, ${orb.sat}%, ${orb.bri}%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, p.width, p.height);
  }
}

function drawAmbientOrbs(p) {
  if (!heroOrbBuffer) buildOrbBuffer(p);
  p.image(heroOrbBuffer, 0, 0);
}

// ============================================================================
// STATIC FRAME (REDUCED MOTION)
// ============================================================================

function drawStaticFrame(p) {
  p.clear();
  drawAmbientOrbs(p);
  
  // Draw a few static droplets
  for (let i = 0; i < 5; i++) {
    const x = p.width * (0.2 + i * 0.15) + p.noise(i * 10) * 30 - 15;
    const y = p.height * (0.3 + p.noise(i * 20) * 0.4);
    const s = 12 + p.noise(i * 30) * 8;
    
    p.fill(...HERO_PALETTE.droplet, 50);
    p.ellipse(x, y, s, s * 0.7);
    p.fill(...HERO_PALETTE.highlight, 30);
    p.ellipse(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.2);
  }
  
  // Static particles
  for (let i = 0; i < 30; i++) {
    const x = p.width * p.noise(i * 0.1, 100);
    const y = p.height * p.noise(i * 0.1, 200);
    const s = 1.5 + p.noise(i * 0.1, 300) * 2;
    p.fill(...HERO_PALETTE.particle, 25);
    p.ellipse(x, y, s, s);
  }
}

// ============================================================================
// MOUNT / UNMOUNT HELPERS
// ============================================================================

function mountHeroCanvas() {
  // Bail unless the container exists and p5 actually loaded — otherwise p5
  // would inject a stray default canvas into <body>.
  if (typeof p5 === 'undefined') return false;
  if (!document.getElementById('hero-canvas-container')) return false;
  if (heroP5) return true;
  heroP5 = new p5(heroSketch);
  return true;
}

function unmountHeroCanvas() {
  if (heroP5) {
    heroP5.remove();
    heroP5 = null;
    heroCanvas = null;
    heroParticles = [];
    heroDroplets = [];
    heroRipples = [];
  }
  if (heroOrbBuffer) {
    heroOrbBuffer.remove();   // free the offscreen canvas
    heroOrbBuffer = null;
  }
}

// Auto-mount when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountHeroCanvas);
} else {
  mountHeroCanvas();
}

// Expose for SPA navigation
window.mountHeroCanvas = mountHeroCanvas;
window.unmountHeroCanvas = unmountHeroCanvas;