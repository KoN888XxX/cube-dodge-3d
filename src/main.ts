import "./style.css";
import * as THREE from "three";

const app = document.querySelector<HTMLDivElement>("#app");
// Keep track of keys that are currently held down.
const pressedKeys = new Set<string>();
const playerSpeed = 5;
const groundPlayerY = 0.5;
const jumpVelocity = 8.5;
const gravity = 18;
// The floor is 12 x 18, so the cube stays half a cube inside each edge.
const playerBounds = {
  minX: -5.5,
  maxX: 5.5,
  minZ: -8.5,
  maxZ: 8.5,
};
const initialObstacleSpeed = 4;
const maxObstacleSpeed = 14;
const speedCurvePower = 1.2;
const speedCurveScale = 0.12;
const obstacleStartZ = -8;
const obstacleEndZ = 8.5;
const obstacleBounds = {
  minX: -5,
  maxX: 5,
};
const maxObstacleCount = 3;
const secondObstacleScore = 15;
const thirdObstacleScore = 35;
const obstacleSpacingZ = 4.2;
const moveKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);
const startKeys = new Set(["Enter", "Space"]);
const restartKey = "KeyR";
const jumpKey = "Space";
const cubeSize = 1;
const highScoreStorageKey = "cube-dodge-3d-high-score";
const initialPlayerPosition = new THREE.Vector3(0, groundPlayerY, 2.5);
const initialObstaclePositions = [
  new THREE.Vector3(-2.2, groundPlayerY, obstacleStartZ),
  new THREE.Vector3(2.2, groundPlayerY, obstacleStartZ - obstacleSpacingZ),
  new THREE.Vector3(0, groundPlayerY, obstacleStartZ - obstacleSpacingZ * 2),
];
type GameState = "title" | "playing" | "gameOver";
type SoundType = "start" | "jump" | "gameOver" | "restart";
type WindowWithWebAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioContext: AudioContext | null = null;

function formatScore(value: number) {
  return value.toFixed(1);
}

function readHighScore() {
  // localStorage keeps the high score after the page is reloaded.
  const savedScore = localStorage.getItem(highScoreStorageKey);
  const parsedScore = Number(savedScore);

  return Number.isFinite(parsedScore) ? parsedScore : 0;
}

function saveHighScore(value: number) {
  // Save only this small score value in the browser, not on a server.
  localStorage.setItem(highScoreStorageKey, value.toString());
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass =
    window.AudioContext ??
    (window as WindowWithWebAudio).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  // Browsers allow sound after a user action, such as pressing a key.
  audioContext = new AudioContextClass();
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume = 0.04,
) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    void context.resume();
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  // Fade out quickly so the short electronic sound does not click loudly.
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playSound(soundType: SoundType) {
  if (soundType === "start") {
    playTone(523.25, 0.08, "triangle", 0.035);
    window.setTimeout(() => playTone(783.99, 0.09, "triangle", 0.035), 70);
    return;
  }

  if (soundType === "jump") {
    playTone(659.25, 0.09, "square", 0.025);
    return;
  }

  if (soundType === "gameOver") {
    playTone(220, 0.16, "sawtooth", 0.035);
    window.setTimeout(() => playTone(146.83, 0.18, "sawtooth", 0.03), 120);
    return;
  }

  playTone(440, 0.07, "triangle", 0.03);
  window.setTimeout(() => playTone(587.33, 0.08, "triangle", 0.03), 60);
}

if (app) {
  app.innerHTML = `
    <section class="scene-page">
      <div class="title-panel">
        <p class="eyebrow">Mini Game Practice</p>
        <h1>Cube Dodge 3D</h1>
      </div>
      <div class="score-panel" aria-live="polite">Score: 0.0</div>
      <div class="speed-panel" aria-live="polite">Speed: ${initialObstacleSpeed.toFixed(1)}</div>
      <div class="high-score-panel" aria-live="polite">High Score: 0.0</div>
      <div class="scene-view" aria-label="Cube Dodge 3D sample 3D scene"></div>
      <div class="start-message">
        <p class="start-message__title">Cube Dodge 3D</p>
        <p class="start-message__hint">Press Enter, Space, or Tap to Start</p>
      </div>
      <div class="game-message" hidden>
        <p class="game-message__title">Game Over</p>
        <p class="game-message__hint">Press R or Tap to Restart</p>
      </div>
      <div class="touch-controls" aria-label="Touch controls">
        <div class="move-controls" aria-label="Move">
          <button class="touch-button move-button move-button--up" type="button" data-touch-key="KeyW" aria-label="Move up">上</button>
          <button class="touch-button move-button move-button--left" type="button" data-touch-key="KeyA" aria-label="Move left">左</button>
          <button class="touch-button move-button move-button--down" type="button" data-touch-key="KeyS" aria-label="Move down">下</button>
          <button class="touch-button move-button move-button--right" type="button" data-touch-key="KeyD" aria-label="Move right">右</button>
        </div>
        <button class="touch-button jump-button" type="button" aria-label="Jump">Jump</button>
      </div>
    </section>
  `;

  const sceneView = app.querySelector<HTMLDivElement>(".scene-view");
  const scorePanel = app.querySelector<HTMLDivElement>(".score-panel");
  const speedPanel = app.querySelector<HTMLDivElement>(".speed-panel");
  const highScorePanel =
    app.querySelector<HTMLDivElement>(".high-score-panel");
  const startMessage = app.querySelector<HTMLDivElement>(".start-message");
  const gameMessage = app.querySelector<HTMLDivElement>(".game-message");
  const touchMoveButtons =
    app.querySelectorAll<HTMLButtonElement>("[data-touch-key]");
  const touchJumpButton = app.querySelector<HTMLButtonElement>(".jump-button");

  if (
    sceneView &&
    scorePanel &&
    speedPanel &&
    highScorePanel &&
    startMessage &&
    gameMessage
  ) {
    const sceneContainer = sceneView;
    const scoreDisplay = scorePanel;
    const speedDisplay = speedPanel;
    const highScoreDisplay = highScorePanel;
    const titleMessage = startMessage;
    const gameOverMessage = gameMessage;
    let gameState: GameState = "title";
    let score = 0;
    let highScore = readHighScore();
    let obstacleSpeed = initialObstacleSpeed;
    let activeObstacleCount = 1;
    let playerVerticalVelocity = 0;
    highScoreDisplay.textContent = `High Score: ${formatScore(highScore)}`;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050711);
    scene.fog = new THREE.Fog(0x050711, 8, 26);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(5, 5, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050711);
    sceneContainer.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x9fb7ff, 0.35);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
    mainLight.position.set(4, 9, 5);
    scene.add(mainLight);

    const blueGlow = new THREE.PointLight(0x38bdf8, 2.4, 12);
    blueGlow.position.set(-3.5, 3, 2.5);
    scene.add(blueGlow);

    const redGlow = new THREE.PointLight(0xfb7185, 1.8, 12);
    redGlow.position.set(3.5, 3, -3.5);
    scene.add(redGlow);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 18),
      new THREE.MeshStandardMaterial({
        // Dark, slightly metallic floor keeps the neon grid readable.
        color: 0x070b16,
        emissive: 0x020617,
        roughness: 0.62,
        metalness: 0.35,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(12, 18, 0x67e8f9, 0x1d4ed8);
    grid.position.y = 0.01;
    scene.add(grid);

    const farGrid = new THREE.GridHelper(12, 6, 0xf472b6, 0x312e81);
    farGrid.position.y = 0.02;
    farGrid.position.z = -3;
    scene.add(farGrid);

    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

    const playerCube = new THREE.Mesh(
      cubeGeometry,
      new THREE.MeshStandardMaterial({
        // Emissive colors create a lightweight neon look without extra effects.
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.18,
      }),
    );
    playerCube.position.copy(initialPlayerPosition);
    scene.add(playerCube);

    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xef4444,
      emissiveIntensity: 0.5,
      roughness: 0.32,
      metalness: 0.12,
    });

    // Keep all possible obstacles in one array so they can be updated together.
    const obstacles = initialObstaclePositions
      .slice(0, maxObstacleCount)
      .map((position, index) => {
        const obstacle = new THREE.Mesh(cubeGeometry, obstacleMaterial);
        obstacle.position.copy(position);
        obstacle.visible = index < activeObstacleCount;
        scene.add(obstacle);
        return obstacle;
      });

    const clock = new THREE.Clock();

    function clamp(value: number, min: number, max: number) {
      return Math.min(Math.max(value, min), max);
    }

    function updatePlayerPosition(deltaTime: number) {
      const moveDirection = new THREE.Vector3(0, 0, 0);

      if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
        moveDirection.x -= 1;
      }

      if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
        moveDirection.x += 1;
      }

      if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
        moveDirection.z -= 1;
      }

      if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
        moveDirection.z += 1;
      }

      if (moveDirection.lengthSq() > 0) {
        // Normalize keeps diagonal movement from becoming faster than straight movement.
        moveDirection.normalize();

        playerCube.position.x += moveDirection.x * playerSpeed * deltaTime;
        playerCube.position.z += moveDirection.z * playerSpeed * deltaTime;

        playerCube.position.x = clamp(
          playerCube.position.x,
          playerBounds.minX,
          playerBounds.maxX,
        );
        playerCube.position.z = clamp(
          playerCube.position.z,
          playerBounds.minZ,
          playerBounds.maxZ,
        );
      }
    }

    function isPlayerOnGround() {
      return playerCube.position.y <= groundPlayerY;
    }

    function jumpPlayer() {
      if (isPlayerOnGround()) {
        playerVerticalVelocity = jumpVelocity;
        return true;
      }

      return false;
    }

    function updatePlayerJump(deltaTime: number) {
      // Gravity pulls the cube down every frame after a jump starts.
      playerVerticalVelocity -= gravity * deltaTime;
      playerCube.position.y += playerVerticalVelocity * deltaTime;

      if (playerCube.position.y <= groundPlayerY) {
        playerCube.position.y = groundPlayerY;
        playerVerticalVelocity = 0;
      }
    }

    function randomObstacleX() {
      return (
        Math.random() * (obstacleBounds.maxX - obstacleBounds.minX) +
        obstacleBounds.minX
      );
    }

    function resetObstaclePosition(obstacle: THREE.Object3D, index: number) {
      obstacle.position.set(
        randomObstacleX(),
        groundPlayerY,
        obstacleStartZ - obstacleSpacingZ * index,
      );
    }

    function getTargetObstacleCount() {
      if (score >= thirdObstacleScore) {
        return maxObstacleCount;
      }

      if (score >= secondObstacleScore) {
        return 2;
      }

      return 1;
    }

    function updateObstacleCount() {
      const targetObstacleCount = getTargetObstacleCount();

      if (targetObstacleCount <= activeObstacleCount) {
        return;
      }

      // Newly added obstacles start farther back so they do not overlap.
      for (
        let index = activeObstacleCount;
        index < targetObstacleCount;
        index += 1
      ) {
        const obstacle = obstacles[index];
        obstacle.visible = true;
        resetObstaclePosition(obstacle, index);
      }

      activeObstacleCount = targetObstacleCount;
    }

    function updateObstaclePositions(deltaTime: number) {
      for (let index = 0; index < activeObstacleCount; index += 1) {
        const obstacle = obstacles[index];
        obstacle.position.z += obstacleSpeed * deltaTime;

        if (obstacle.position.z > obstacleEndZ) {
          // Move the obstacle back to the far side and choose a new lane.
          resetObstaclePosition(obstacle, index);
        }
      }
    }

    function updateDifficulty() {
      // A power curve starts gently, then adds pressure as survival time grows.
      const speedBonus = Math.pow(score, speedCurvePower) * speedCurveScale;
      obstacleSpeed = Math.min(
        initialObstacleSpeed + speedBonus,
        maxObstacleSpeed,
      );
      speedDisplay.textContent = `Speed: ${obstacleSpeed.toFixed(1)}`;
    }

    function isTouching(
      firstCube: THREE.Object3D,
      secondCube: THREE.Object3D,
    ) {
      // Simple square collision: compare the cube centers on the floor.
      const isOverlappingX =
        Math.abs(firstCube.position.x - secondCube.position.x) <= cubeSize;
      const isOverlappingZ =
        Math.abs(firstCube.position.z - secondCube.position.z) <= cubeSize;
      const isOverlappingY =
        Math.abs(firstCube.position.y - secondCube.position.y) <= cubeSize;

      return isOverlappingX && isOverlappingY && isOverlappingZ;
    }

    function showGameOver() {
      gameState = "gameOver";
      playSound("gameOver");

      if (score > highScore) {
        highScore = score;
        highScoreDisplay.textContent = `High Score: ${formatScore(highScore)}`;
        saveHighScore(highScore);
      }

      gameOverMessage.hidden = false;
    }

    function updateScore(deltaTime: number) {
      score += deltaTime;
      // Keep the score easy to read by showing one decimal place.
      scoreDisplay.textContent = `Score: ${formatScore(score)}`;
    }

    function resetGameValues() {
      score = 0;
      obstacleSpeed = initialObstacleSpeed;
      activeObstacleCount = 1;
      playerVerticalVelocity = 0;
      pressedKeys.clear();
      playerCube.position.copy(initialPlayerPosition);
      obstacles.forEach((obstacle, index) => {
        obstacle.position.copy(initialObstaclePositions[index]);
        obstacle.rotation.set(0, 0, 0);
        obstacle.visible = index < activeObstacleCount;
      });
      scoreDisplay.textContent = "Score: 0.0";
      speedDisplay.textContent = `Speed: ${initialObstacleSpeed.toFixed(1)}`;
    }

    function startGame(shouldPlayStartSound = true) {
      // Game state controls which updates are allowed each frame.
      gameState = "playing";
      resetGameValues();
      titleMessage.hidden = true;
      gameOverMessage.hidden = true;
      if (shouldPlayStartSound) {
        playSound("start");
      }
      clock.getDelta();
    }

    function restartGame() {
      startGame(false);
      playSound("restart");
    }

    function startGameFromTap(event: PointerEvent) {
      if (gameState !== "title") {
        return;
      }

      event.preventDefault();
      startGame();
    }

    function restartGameFromTap(event: PointerEvent) {
      if (gameState !== "gameOver") {
        return;
      }

      event.preventDefault();
      restartGame();
    }

    function startTouchMove(keyCode: string, event: PointerEvent) {
      event.preventDefault();

      if (gameState !== "playing") {
        return;
      }

      // Touch buttons reuse the keyboard key set while the finger is down.
      pressedKeys.add(keyCode);
      event.currentTarget instanceof HTMLElement &&
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function stopTouchMove(keyCode: string, event: PointerEvent) {
      event.preventDefault();
      pressedKeys.delete(keyCode);

      if (
        event.currentTarget instanceof HTMLElement &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function jumpFromTouch(event: PointerEvent) {
      event.preventDefault();

      if (gameState !== "playing") {
        return;
      }

      if (jumpPlayer()) {
        playSound("jump");
      }
    }

    function resizeRenderer() {
      const width = sceneContainer.clientWidth;
      const height = sceneContainer.clientHeight;

      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);
    titleMessage.addEventListener("pointerup", startGameFromTap);
    gameOverMessage.addEventListener("pointerup", restartGameFromTap);
    touchMoveButtons.forEach((button) => {
      const keyCode = button.dataset.touchKey;

      if (!keyCode) {
        return;
      }

      button.addEventListener("pointerdown", (event) =>
        startTouchMove(keyCode, event),
      );
      button.addEventListener("pointerup", (event) =>
        stopTouchMove(keyCode, event),
      );
      button.addEventListener("pointercancel", (event) =>
        stopTouchMove(keyCode, event),
      );
      button.addEventListener("lostpointercapture", () => {
        pressedKeys.delete(keyCode);
      });
    });
    touchJumpButton?.addEventListener("pointerdown", jumpFromTouch);
    window.addEventListener("keydown", (event) => {
      if (gameState === "title" && startKeys.has(event.code)) {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.code === restartKey && gameState === "gameOver") {
        event.preventDefault();
        restartGame();
        return;
      }

      if (event.code === jumpKey && gameState === "playing") {
        event.preventDefault();
        if (jumpPlayer()) {
          playSound("jump");
        }
        return;
      }

      if (moveKeys.has(event.code) && gameState === "playing") {
        event.preventDefault();
        pressedKeys.add(event.code);
      }
    });
    window.addEventListener("keyup", (event) => {
      pressedKeys.delete(event.code);
    });

    renderer.setAnimationLoop(() => {
      const deltaTime = clock.getDelta();

      if (gameState === "playing") {
        updateScore(deltaTime);
        updateDifficulty();
        updateObstacleCount();
        updatePlayerPosition(deltaTime);
        updatePlayerJump(deltaTime);
        updateObstaclePositions(deltaTime);

        if (
          obstacles
            .slice(0, activeObstacleCount)
            .some((obstacle) => isTouching(playerCube, obstacle))
        ) {
          showGameOver();
        }
      }

      if (gameState === "playing") {
        playerCube.rotation.y += 0.01;
        obstacles.slice(0, activeObstacleCount).forEach((obstacle) => {
          obstacle.rotation.x += 0.008;
          obstacle.rotation.y += 0.008;
        });
      }

      renderer.render(scene, camera);
    });
  }
}
