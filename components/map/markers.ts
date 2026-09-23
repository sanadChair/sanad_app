import * as THREE from 'three';
import { disposeObject } from './meshes';

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------
export function createRobotMarker(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  g.add(shadow);

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 40),
    new THREE.MeshBasicMaterial({ color: 0x4d7aff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.02;
  pulse.name = 'pulse';
  g.add(pulse);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.36, 0.24, 32),
    new THREE.MeshLambertMaterial({ color: 0x2f63f6, emissive: 0x1d3fe0, emissiveIntensity: 0.7 })
  );
  base.position.y = 0.16;
  g.add(base);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9db8ff, emissiveIntensity: 0.35 })
  );
  dome.position.y = 0.28;
  g.add(dome);

  // Forward wedge pointing +X (ROS yaw 0 = +X).
  const wedge = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.34, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  wedge.rotation.z = -Math.PI / 2;
  wedge.position.set(0.48, 0.1, 0);
  g.add(wedge);

  const wedgeGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 20),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.9 })
  );
  wedgeGlow.rotation.x = -Math.PI / 2;
  wedgeGlow.position.set(0.48, 0.03, 0);
  g.add(wedgeGlow);

  return g;
}

export function createPinMarker(): THREE.Group {
  const g = new THREE.Group();
  const red = 0xe05545;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.28, 28),
    new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.85, 10),
    new THREE.MeshBasicMaterial({ color: red })
  );
  stem.position.y = 0.45;
  g.add(stem);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 14),
    new THREE.MeshLambertMaterial({ color: red, emissive: 0x7a1f14, emissiveIntensity: 0.6 })
  );
  head.position.y = 1.0;
  head.name = 'head';
  g.add(head);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  dot.position.y = 1.0;
  dot.name = 'dot';
  g.add(dot);

  return g;
}

export function createGoalMarker(): THREE.Group {
  const g = new THREE.Group();

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.16, 3.0, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 1.5;
  g.add(beam);

  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.42, 36),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.03;
  ring1.name = 'ring1';
  g.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.03;
  ring2.name = 'ring2';
  g.add(ring2);

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshLambertMaterial({ color: 0x00e0ff, emissive: 0x0090a8, emissiveIntensity: 0.9 })
  );
  gem.position.y = 1.15;
  gem.name = 'gem';
  g.add(gem);

  return g;
}

export function createPendingMarker(): THREE.Group {
  const g = new THREE.Group();
  const cyan = 0x00e0ff;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.32, 32),
    new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = 'ring';
  g.add(ring);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 10),
    new THREE.MeshBasicMaterial({ color: cyan })
  );
  dot.position.y = 0.5;
  dot.name = 'dot';
  g.add(dot);

  const stemMat = new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.7 });
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.5, 0)]),
    stemMat
  );
  g.add(stem);
  return g;
}

// Rebuild the pin group from pinpoint list (dispose old markers first).
export function rebuildPins(group: THREE.Group, pinpoints: readonly { x: number; z: number }[]): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
  for (const pin of pinpoints) {
    const marker = createPinMarker();
    marker.position.set(pin.x, 0.02, -pin.z);
    group.add(marker);
  }
}

// Per-frame marker animations (pulse, goal bob, pin bob). `t` is seconds.
export function animateMarkers(
  t: number,
  robot: THREE.Group | null,
  goal: THREE.Group | null,
  pending: THREE.Group | null,
  pins: THREE.Group | null,
): void {
  if (robot?.visible) {
    const pulse = robot.getObjectByName('pulse');
    if (pulse) {
      const s = 1 + 0.28 * Math.abs(Math.sin(t * 2.4));
      pulse.scale.set(s, s, 1);
      ((pulse as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 - 0.3 * Math.abs(Math.sin(t * 2.4));
    }
  }
  if (goal?.visible) {
    const gem = goal.getObjectByName('gem');
    if (gem) { gem.rotation.y = t * 2.2; gem.position.y = 1.15 + Math.sin(t * 2.5) * 0.08; }
    const r1 = goal.getObjectByName('ring1');
    if (r1) { const s = 1 + 0.25 * Math.abs(Math.sin(t * 2)); r1.scale.set(s, s, 1); }
  }
  if (pending?.visible) {
    const dot = pending.getObjectByName('dot');
    if (dot) dot.position.y = 0.5 + Math.sin(t * 3) * 0.07;
  }
  if (pins) {
    pins.children.forEach((pin, i) => {
      const head = pin.getObjectByName('head');
      const dot = pin.getObjectByName('dot');
      const bob = Math.sin(t * 2 + i * 1.3) * 0.05;
      if (head) head.position.y = 1.0 + bob;
      if (dot) dot.position.y = 1.0 + bob;
    });
  }
}
