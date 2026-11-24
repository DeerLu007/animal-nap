const stage = document.querySelector('#stage');
const canvas = stage.querySelector('.cat');
const still = stage.querySelector('.cat-still');
const hand = stage.querySelector('.hand');
const message = stage.querySelector('.stage-message');
const buttons = [...document.querySelectorAll('.choice')];
const backdropButtons = [...document.querySelectorAll('.backdrop-choice')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const width = 960;
const height = 600;
const cols = 44;
const rows = 28;
const count = (cols + 1) * (rows + 1);
const base = new Float32Array(count * 2);
const vertex = new Float32Array(count * 2);
const displacement = new Float32Array(count * 2);
const velocity = new Float32Array(count * 2);
const tailWeight = new Float32Array(count);
const uv = new Float32Array(count * 2);
const indices = [];
// Tail guides use the same 960 × 600 coordinates as the sprite canvas.
const cats = {
  ginger: { name: '橘猫', tail: [[707, 248], [788, 266], [840, 311], [846, 365], [816, 418], [759, 454], [675, 470]], tailRadius: 33 },
  silver: { name: '银灰猫', tail: [[709, 252], [787, 261], [835, 300], [857, 351], [841, 402], [796, 445], [722, 473], [657, 461]], tailRadius: 43 },
  husky: { name: '哈士奇', tail: [[709, 246], [788, 244], [833, 269], [852, 319], [843, 378], [823, 432], [820, 477]], tailRadius: 49 },
  golden: { name: '金毛', tail: [[705, 239], [779, 261], [831, 287], [851, 321], [842, 367], [821, 415], [816, 459]], tailRadius: 44 },
  ragdoll: { name: '布偶猫', tail: [[714, 261], [781, 275], [824, 306], [851, 348], [837, 402], [795, 443], [746, 471]], tailRadius: 53 },
  samoyed: { name: '萨摩耶', tail: [[707, 264], [774, 277], [822, 307], [845, 345], [830, 395], [792, 440], [743, 471]], tailRadius: 56 },
  tiger: { name: '老虎', tail: [[740, 281], [790, 294], [841, 313], [867, 344], [870, 385], [852, 421], [817, 451], [775, 454], [731, 435]], tailRadius: 31 },
  lion: { name: '狮子', tail: [[764, 246], [803, 267], [841, 298], [875, 343], [886, 387], [870, 430], [840, 448], [798, 470], [771, 496]], tailRadius: 27 },
  elephant: { name: '大象', tail: [[777, 263], [801, 294], [832, 323], [860, 349], [879, 378], [880, 404], [863, 431], [852, 454]], tailRadius: 25 },
  orca: { name: '蓝色虎鲸', tail: [[625, 277], [692, 286], [755, 316], [805, 341]], tailRadius: 108 },
};

for (let y = 0; y <= rows; y++) {
  for (let x = 0; x <= cols; x++) {
    const index = y * (cols + 1) + x;
    uv.set([x / cols, y / rows], index * 2);
    base.set([x * width / cols, y * height / rows], index * 2);
    if (x < cols && y < rows) {
      const below = index + cols + 1;
      indices.push(index, index + 1, below, below, index + 1, below + 1);
    }
  }
}

function createRenderer() {
  const gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) return null;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, [
    'attribute vec2 position;',
    'attribute vec2 texCoord;',
    'varying vec2 coord;',
    'void main() { gl_Position = vec4(position, 0.0, 1.0); coord = texCoord; }',
  ].join('\n')));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, [
    'precision mediump float;',
    'uniform sampler2D image;',
    'varying vec2 coord;',
    'void main() { gl_FragColor = texture2D(image, coord); }',
  ].join('\n')));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  function attribute(name, values, usage) {
    const buffer = gl.createBuffer();
    const location = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, values, usage);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    return buffer;
  }

  const positions = attribute('position', vertex, gl.DYNAMIC_DRAW);
  attribute('texCoord', uv, gl.STATIC_DRAW);
  const triangles = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangles);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    image(img) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    },
    resize() {
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertex);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    },
  };
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const smooth = (min, max, v) => {
  const t = clamp((v - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
};

function alphaMap(image) {
  const mask = document.createElement('canvas');
  mask.width = width / 3;
  mask.height = height / 3;
  const context = mask.getContext('2d');
  context.drawImage(image, 0, 0, mask.width, mask.height);
  return context.getImageData(0, 0, mask.width, mask.height).data;
}

function hitsCat(x, y) {
  const col = Math.round(x / 3);
  const row = Math.round(y / 3);
  const stride = width / 3;
  for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
    if (col + dx >= 0 && col + dx < stride && row + dy >= 0 && row + dy < height / 3 &&
        cat.alpha[((row + dy) * stride + col + dx) * 4 + 3] > 85) return true;
  }
  return false;
}

function nearestTail(x, y) {
  let nearest = { distance: Infinity, progress: 0 };
  const path = cat.tail;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const dx = path[i][0] - ax;
    const dy = path[i][1] - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const distance = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (distance < nearest.distance) nearest = { distance, progress: (i - 1 + t) / (path.length - 1) };
  }
  return nearest;
}

let cat, renderer, contact, previous, tailGrab, touchId, keyStart;
let handPoint, handOpacity = 0, handAngle = 0, speedX = 0, speedY = 0;
let layout;

function clearContact() {
  if (touchId !== undefined && stage.hasPointerCapture(touchId)) stage.releasePointerCapture(touchId);
  touchId = keyStart = contact = previous = tailGrab = undefined;
  speedX = speedY = 0;
  stage.removeAttribute('data-contact');
}

function choose(id) {
  clearContact();
  cat = cats[id];
  displacement.fill(0);
  velocity.fill(0);
  if (renderer) renderer.image(cat.image);
  else still.src = cat.image.src;
  for (let i = 0; i < count; i++) {
    const near = nearestTail(base[i * 2], base[i * 2 + 1]);
    tailWeight[i] = smooth(.02, 1, near.progress) *
      (1 - smooth(cat.tailRadius * .84, cat.tailRadius * 1.55, near.distance));
  }
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.cat === id));
  stage.dataset.cat = id;
  stage.setAttribute('aria-label', '抚摸' + cat.name);
}

function route(x, y, now) {
  const near = nearestTail(x, y);
  const hit = hitsCat(x, y);
  const onTail = near.progress > .095 && near.distance < cat.tailRadius + 8 && hit;
  const trackingTail = tailGrab && (x > cat.tail[0][0] || near.progress > .83) && near.distance < cat.tailRadius + 55;
  if (onTail || trackingTail) {
    tailGrab ??= { x, y };
    contact = { x, y, time: now, region: 'tail' };
  } else {
    tailGrab = undefined;
    contact = hit ? { x, y, time: now, region: 'body' } : undefined;
  }

  if (!contact) {
    previous = undefined;
    stage.removeAttribute('data-contact');
    return;
  }

  if (previous) {
    const dt = Math.max(10, now - previous.time) / 1000;
    speedX = speedX * .3 + .7 * clamp((x - previous.x) / dt, -1800, 1800);
    speedY = speedY * .3 + .7 * clamp((y - previous.y) / dt, -1800, 1800);
  }
  previous = contact;
  handPoint = contact;
  stage.dataset.contact = contact.region;
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  route((event.clientX - rect.left) * width / rect.width,
    (event.clientY - rect.top) * height / rect.height, performance.now());
}

stage.addEventListener('pointerdown', (event) => {
  if (!renderer || !cat || touchId !== undefined || event.button !== 0) return;
  keyStart = undefined;
  if (event.pointerType !== 'mouse') {
    touchId = event.pointerId;
    stage.setPointerCapture(touchId);
  }
  point(event);
});

stage.addEventListener('pointermove', (event) => {
  if (!renderer || !cat || keyStart !== undefined) return;
  if (touchId !== undefined ? event.pointerId === touchId : event.pointerType === 'mouse') point(event);
});

stage.addEventListener('pointerleave', () => {
  if (touchId === undefined && keyStart === undefined) clearContact();
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(type, (event) => {
    if (event.pointerId === touchId || (event.pointerType === 'mouse' && type === 'pointerup' && tailGrab)) {
      clearContact();
    }
  });
}
stage.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || !cat || !renderer) return;
  event.preventDefault();
  if (event.repeat || touchId !== undefined) return;
  clearContact();
  keyStart = performance.now();
});
stage.addEventListener('keyup', (event) => {
  if (event.code === 'Space' && keyStart !== undefined) {
    event.preventDefault();
    clearContact();
  }
});
stage.addEventListener('blur', () => {
  if (keyStart !== undefined) clearContact();
});
window.addEventListener('blur', clearContact);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearContact();
});

for (const button of buttons) {
  button.addEventListener('click', () => choose(button.dataset.cat));
}

for (const button of backdropButtons) {
  button.addEventListener('click', () => {
    stage.dataset.backdrop = button.dataset.backdrop;
    for (const option of backdropButtons) option.setAttribute('aria-pressed', String(option === button));
  });
}


function size() {
  const scene = canvas.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  layout = {
    x: scene.left - frame.left - stage.clientLeft,
    y: scene.top - frame.top - stage.clientTop,
    width: scene.width,
    height: scene.height,
  };
  renderer?.resize();
}

function poseHand(dt) {
  const wanted = contact ? 1 : 0;
  handOpacity += (wanted - handOpacity) * (1 - Math.exp(-dt * (contact ? 29 : 15)));
  if (!handPoint || handOpacity < .012) {
    hand.hidden = true;
    return;
  }
  hand.hidden = false;
  handAngle += (clamp(speedX / 125, -12, 12) - handAngle) * (1 - Math.exp(-dt * 12));
  hand.style.left = layout.x + handPoint.x * layout.width / width + 'px';
  hand.style.top = layout.y + handPoint.y * layout.height / height + (1 - handOpacity) * 22 + 'px';
  hand.style.opacity = handOpacity;
  hand.style.setProperty('--hand-angle', handAngle + 'deg');
}

let lastFrame;
function draw(now) {
  requestAnimationFrame(draw);
  const dt = Math.min((now - (lastFrame ?? now - 16)) / 1000, .026);
  lastFrame = now;
  if (!cat || !renderer || !layout) return;

  if (keyStart !== undefined) {
    const phase = (now - keyStart) / 370;
    route(340 + 125 * (1 - Math.cos(phase)), 309, now);
  }
  if (!contact || now - contact.time > 35) {
    const decay = Math.exp(-dt * 15);
    speedX *= decay;
    speedY *= decay;
  }

  const stroke = contact?.region === 'body' ? contact : undefined;
  const motionScale = reducedMotion.matches ? .62 : 1;
  const dragX = clamp(speedX * .027, -20, 20);
  const dragY = clamp(speedY * .027, -17, 17);
  const tailX = tailGrab ? clamp((contact.x - tailGrab.x) * .50, -28, 46) : 0;
  const tailY = tailGrab ? clamp((contact.y - tailGrab.y) * .53, -36, 36) : 0;
  const breath = reducedMotion.matches ? 0 : Math.sin(now * .0017) * .010;
  const retain = Math.exp(-15 * dt);

  for (let i = 0; i < count; i++) {
    const j = i * 2;
    const x = base[j];
    const y = base[j + 1];
    const falloff = stroke ? Math.max(0, 1 - ((x - stroke.x) ** 2 + (y - stroke.y) ** 2) / 128 ** 2) ** 2 : 0;
    const targetX = ((dragX + (stroke ? (stroke.x - x) * .08 : 0)) * falloff + tailX * tailWeight[i]) * motionScale;
    const targetY = ((dragY + (stroke ? (stroke.y - y) * .08 : 0)) * falloff + tailY * tailWeight[i]) * motionScale;
    velocity[j] = (velocity[j] + (targetX - displacement[j]) * 280 * dt) * retain;
    velocity[j + 1] = (velocity[j + 1] + (targetY - displacement[j + 1]) * 280 * dt) * retain;
    displacement[j] += velocity[j] * dt;
    displacement[j + 1] += velocity[j + 1] * dt;
    vertex[j] = (x + displacement[j]) * 2 / width - 1;
    const breathing = (y - height * .51) * breath * (1 - tailWeight[i]) * smooth(200, 390, x) * (1 - smooth(615, 725, x));
    vertex[j + 1] = 1 - (y + displacement[j + 1] + breathing) * 2 / height;
  }

  renderer.draw();
  poseHand(dt);
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

async function start() {
  try {
    await Promise.all(buttons.map(async (button) => {
      const current = cats[button.dataset.cat];
      current.image = button.querySelector('img');
      await current.image.decode();
      current.alpha = alphaMap(current.image);
    }));
    await hand.decode();
    renderer = createRenderer();
    if (renderer) {
      still.hidden = true;
      new ResizeObserver(size).observe(stage);
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        clearContact();
        still.src = cat.image.src;
        still.hidden = false;
        canvas.hidden = true;
        renderer = null;
        showMessage('动效已暂停，刷新即可重试。');
      });
      size();
      requestAnimationFrame(draw);
    } else {
      showMessage('此浏览器无法绘制抚摸动效。');
    }
    choose('ginger');
    for (const button of buttons) button.disabled = false;
  } catch (error) {
    console.error(error);
    showMessage('素材加载失败，请刷新重试。');
  } finally {
    stage.setAttribute('aria-busy', 'false');
  }
}

start();
