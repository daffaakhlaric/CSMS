"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { factoryLayout } from "@/lib/factory-layout";
import { RoomId, Sack, State, status, inventory } from "@/lib/domain";
import { readingSource } from "@/lib/domain";
const colors = {
  normal: "#29c7ce",
  warning: "#f5ae48",
  critical: "#f45252",
  offline: "#87939c",
};
const roomX = (id: RoomId) =>
  ((id === "CS-01" ? -1 : 1) *
    (factoryLayout.coldRooms.width + factoryLayout.coldRooms.gap)) /
  2;
type SceneLabel = {
  id: string;
  at: [number, number, number];
  content: React.ReactNode;
};
function ProjectLabels({
  labels,
  elements,
}: {
  labels: SceneLabel[];
  elements: React.RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const point = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const el = elements.current[label.id];
      if (!el) continue;
      point.current.set(...label.at).project(camera);
      el.style.transform = `translate(${((point.current.x + 1) * size.width) / 2}px,${((1 - point.current.y) * size.height) / 2}px) translate(-50%,-50%)`;
      el.style.visibility = point.current.z > 1 ? "hidden" : "visible";
    }
  });
  return null;
}
function Box({
  position,
  size,
  color,
  ...props
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  onClick?: () => void;
}) {
  return (
    <mesh position={position} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}
function Camera({ view, focus }: { view: string; focus: RoomId | null }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const targetX = focus ? roomX(focus) : 0;
    const targetZ = focus ? factoryLayout.coldRooms.centerZ : 0;
    camera.position.set(
      ...((view === "atas"
        ? [targetX, 36, targetZ + 0.01]
        : factoryLayout.defaultCamera) as [number, number, number]),
    );
    camera.lookAt(
      focus ? roomX(focus) : 0,
      0,
      focus ? factoryLayout.coldRooms.centerZ : 0,
    );
    const orbit = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    if (orbit) {
      orbit.target.set(
        focus ? roomX(focus) : 0,
        0,
        focus ? factoryLayout.coldRooms.centerZ : 0,
      );
      orbit.update();
    }
  }, [camera, controls, view, focus]);
  return null;
}
const path: [number, number, number][] = [
  [-13, 0.8, 8],
  [-7, 0.8, 8],
  [-2, 0.8, 8],
  [3, 0.8, 8],
  [6, 0.8, 3],
  [6, 0.8, -3],
  [10, 0.8, 3],
  [14, 0.8, 7],
];
function DemoMovement() {
  const ref = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(elapsed.current * 0.35, path.length - 1 - 0.0001);
    const i = Math.floor(t);
    if (ref.current)
      ref.current.position.lerpVectors(
        new THREE.Vector3(...path[i]),
        new THREE.Vector3(...path[i + 1]),
        t - i,
      );
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.65, 0.65, 0.65]} />
      <meshStandardMaterial color="#ffcc6f" />
    </mesh>
  );
}
export default function Twin({
  state,
  selected,
  onRoom,
  onSack,
  focus,
}: {
  state: State;
  selected: Sack | null;
  onRoom: (id: RoomId) => void;
  onSack: (s: Sack) => void;
  focus: RoomId | null;
}) {
  const [walls, setWalls] = useState(true);
  const [roof, setRoof] = useState(false);
  const [view, setView] = useState("iso");
  const [reset, setReset] = useState(0);
  const [animation, setAnimation] = useState(false);
  const [rackInfo, setRackInfo] = useState("");
  const labelElements = useRef<Record<string, HTMLDivElement | null>>({});
  const roomHeight = Math.max(
    factoryLayout.coldRooms.wallHeight,
    state.config.levels * factoryLayout.rack.levelSpacing + 1,
  );
  const labels: SceneLabel[] = [
    ...state.rooms.map((room) => ({
      id: room.id,
      at: [roomX(room.id), roomHeight + 1, factoryLayout.coldRooms.centerZ] as [
        number,
        number,
        number,
      ],
      content: (
        <button onClick={() => onRoom(room.id)}>
          <b>{room.id}</b>
          <strong style={{ color: colors[status(room)] }}>
            {room.temperature.toFixed(1)}°C
          </strong>
          <small>
            {room.name} · {readingSource(room)}
          </small>
          <small>
            {Math.round(
              (inventory(state, room.id).count /
                (state.config.racks *
                  state.config.levels *
                  state.config.slots)) *
                100,
            )}
            % terisi
          </small>
        </button>
      ),
    })),
    {
      id: "abf",
      at: [-13, 3.1, 8],
      content: (
        <>
          ABF
          <small>
            Target {state.config.abfTarget}°C · {state.config.abfCount} unit
            demo
          </small>
        </>
      ),
    },
    { id: "packing", at: [-7, 3.1, 8], content: "PENGEMASAN" },
    { id: "weighing", at: [-2, 3.1, 8], content: "PENIMBANGAN" },
    { id: "sewing", at: [3, 3.1, 8], content: "PENJAHITAN" },
    { id: "office", at: [-13, 4.5, -5], content: "KANTOR / KENDALI" },
    { id: "loading", at: [14, 4.3, 7], content: "DOK PEMUATAN" },
  ];
  return (
    <div className="twin-shell">
      <div className="twin-tools">
        <span className="live-pill">
          <i /> DIGITAL TWIN
        </span>
        <div>
          <button onClick={() => setView("iso")}>Isometrik</button>
          <button onClick={() => setView("atas")}>Tampak atas</button>
          <button onClick={() => setWalls(!walls)}>
            {walls ? "Sembunyikan" : "Tampilkan"} dinding
          </button>
          <button onClick={() => setRoof(!roof)}>
            Atap {roof ? "aktif" : "nonaktif"}
          </button>
          <button
            onClick={() => {
              setView("iso");
              setReset((n) => n + 1);
            }}
          >
            Reset kamera
          </button>
        </div>
      </div>
      <Canvas
        shadows
        camera={{ position: factoryLayout.defaultCamera, fov: 43 }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#e9f0f2"]} />
        <ambientLight intensity={1.7} />
        <directionalLight
          castShadow
          position={[0, 25, 10]}
          intensity={2.4}
          shadow-mapSize={[2048, 2048]}
        />
        <Suspense fallback={null}>
          <OrbitControls
            makeDefault
            minDistance={12}
            maxDistance={65}
            maxPolarAngle={Math.PI / 2.05}
          />
          <Camera key={reset} view={view} focus={focus} />
          <ProjectLabels labels={labels} elements={labelElements} />
          <Box
            position={[0, -0.3, 1]}
            size={[factoryLayout.floor.width, 0.6, factoryLayout.floor.depth]}
            color="#c5d0d1"
          />
          <gridHelper
            args={[35, 35, "#aebfc1", "#b9c8ca"]}
            position={[0, 0.015, 1]}
          />
          {state.rooms.map((room) => {
            const x = roomX(room.id);
            const { width, depth, centerZ } = factoryLayout.coldRooms;
            const height = Math.max(
              factoryLayout.coldRooms.wallHeight,
              state.config.levels * factoryLayout.rack.levelSpacing + 1,
            );
            const rackWidth = Math.min(factoryLayout.rack.width, width - 1.5);
            const color = colors[status(room)];
            const sacks = state.sacks.filter((s) => s.room === room.id);
            return (
              <group key={room.id} position={[x, 0, centerZ]}>
                <Box
                  position={[0, 0.1, 0]}
                  size={[
                    factoryLayout.coldRooms.width,
                    0.2,
                    factoryLayout.coldRooms.depth,
                  ]}
                  color="#c4e3e9"
                  onClick={() => onRoom(room.id)}
                />
                {walls && (
                  <>
                    <Box
                      position={[0, height / 2, -depth / 2]}
                      size={[width, height, 0.18]}
                      color="#89b4c8"
                    />
                    <Box
                      position={[-width / 2, height / 2, 0]}
                      size={[0.18, height, depth]}
                      color="#aacbd9"
                    />
                  </>
                )}
                {roof && (
                  <Box
                    position={[0, height + 0.2, 0]}
                    size={[width, 0.2, depth]}
                    color="#d9e5e9"
                  />
                )}
                <Box
                  position={[0, 0.15, depth / 2]}
                  size={[width, 0.12, 0.12]}
                  color={color}
                />
                <Box
                  position={[0, height - 0.3, -depth / 2 + 0.15]}
                  size={[3, 0.8, 0.6]}
                  color="#e9f0ee"
                />
                {[-0.8, 0, 0.8].map((a) => (
                  <mesh
                    key={a}
                    position={[a, height - 0.3, -depth / 2 + 0.51]}
                    rotation={[Math.PI / 2, 0, 0]}
                  >
                    <cylinderGeometry args={[0.27, 0.27, 0.06, 16]} />
                    <meshStandardMaterial color="#596e79" />
                  </mesh>
                ))}

                {Array.from({ length: state.config.racks }, (_, r) => {
                  const z =
                    -depth / 2 +
                    1.5 +
                    (r * (depth - 3)) / Math.max(1, state.config.racks - 1);
                  return (
                    <group
                      key={r}
                      position={[0, 0, z]}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRackInfo(
                          `${room.id} • Rak ${r + 1} • ${sacks.filter((s) => s.rack === r + 1).length} karung`,
                        );
                      }}
                    >
                      {[-rackWidth / 2, rackWidth / 2].map((a) => (
                        <Box
                          key={a}
                          position={[a, (height - 0.6) / 2, 0]}
                          size={[0.1, height - 0.6, 0.7]}
                          color="#52758b"
                        />
                      ))}
                      {Array.from({ length: state.config.levels }, (_, l) => (
                        <Box
                          key={l}
                          position={[
                            0,
                            0.35 + l * factoryLayout.rack.levelSpacing,
                            0,
                          ]}
                          size={[rackWidth, 0.09, factoryLayout.rack.depth]}
                          color="#df9750"
                        />
                      ))}
                      {sacks
                        .filter((s) => s.rack === r + 1)
                        .map((s) => (
                          <mesh
                            key={s.id}
                            position={[
                              -rackWidth / 2 +
                                0.2 +
                                (((s.slot ?? 1) - 1) * (rackWidth - 0.4)) /
                                  Math.max(1, state.config.slots - 1),
                              0.62 +
                                ((s.level ?? 1) - 1) *
                                  factoryLayout.rack.levelSpacing,
                              0,
                            ]}
                            scale={[0.28, 0.38, 0.43]}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSack(s);
                            }}
                            castShadow
                          >
                            <sphereGeometry args={[1, 6, 5]} />
                            <meshStandardMaterial
                              color={
                                selected?.id === s.id
                                  ? "#ff743c"
                                  : s.product === "Kepala ikan"
                                    ? "#e3d4b5"
                                    : "#adcfc6"
                              }
                              emissive={
                                selected?.id === s.id ? "#ff743c" : "#000000"
                              }
                              emissiveIntensity={0.45}
                            />
                          </mesh>
                        ))}
                    </group>
                  );
                })}
              </group>
            );
          })}
          {(
            [
              [-13, "ABF", "#9ab7ca"],
              [-7, "PENGEMASAN", "#67b6aa"],
              [-2, "PENIMBANGAN", "#83aeb9"],
              [3, "PENJAHITAN", "#91abae"],
            ] as [number, string, string][]
          ).map(([x, label, color]) => (
            <group key={label}>
              <Box position={[x, 0.15, 8]} size={[4, 0.3, 4]} color={color} />
              <Box
                position={[x, 1.2, 8]}
                size={[2.3, 2, 1.5]}
                color={label === "ABF" ? "#c5d7e0" : "#d9e0df"}
              />
              <Box
                position={[x, 2.25, 8]}
                size={[2.5, 0.15, 1.8]}
                color="#566f7a"
              />
            </group>
          ))}
          <group position={[-13, 0, -5]}>
            <Box position={[0, 1.8, 0]} size={[3.7, 3.6, 5]} color="#dce4e6" />
            <Box position={[1.9, 2, 0]} size={[0.05, 1.2, 3]} color="#7798a9" />
          </group>
          <group position={[14, 0, 7]}>
            <Box position={[0, 1.65, 0]} size={[3, 2.8, 6]} color="#fafaf5" />
            <Box position={[0, 1.2, 4]} size={[3, 2.2, 2]} color="#347477" />
            <Box
              position={[0, 1.8, 5.02]}
              size={[2.5, 0.9, 0.05]}
              color="#93c8d8"
            />
            {[-1.5, 1.5].flatMap((x) =>
              [-1.7, 3.8].map((z) => (
                <mesh
                  key={`${x}${z}`}
                  position={[x, 0.55, z]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.6, 0.6, 0.35, 16]} />
                  <meshStandardMaterial color="#34434a" />
                </mesh>
              )),
            )}
          </group>
          <group position={[7, 0, 6]}>
            <Box position={[0, 0.7, 0]} size={[1.2, 1, 2]} color="#edb852" />
            <Box position={[0, 1.6, 0.2]} size={[1, 1, 0.8]} color="#405863" />
            <Box
              position={[0, 2.2, 0.2]}
              size={[1.4, 0.12, 1.4]}
              color="#edb852"
            />
            <Box position={[0, 1, 1.4]} size={[1, 2, 0.15]} color="#52646a" />
          </group>
          {animation && (
            <>
              <Line
                points={path}
                color="#de9945"
                dashed
                dashSize={0.3}
                gapSize={0.2}
                lineWidth={2}
              />
              <DemoMovement />
            </>
          )}
        </Suspense>
      </Canvas>
      <div className="twin-overlays">
        {labels.map((label) => (
          <div
            className="mesh-label"
            key={label.id}
            ref={(el) => {
              labelElements.current[label.id] = el;
            }}
          >
            {label.content}
          </div>
        ))}
      </div>
      <div className="twin-bottom">
        <span>● Putar: seret · Perbesar: gulir · Geser: klik kanan</span>
        <button onClick={() => setAnimation(!animation)}>
          {animation ? "Hentikan" : "Putar"} animasi DEMO
        </button>
      </div>
      {animation && (
        <div className="demo-caption">
          Animasi DEMO satu arah · tidak mengubah stok
        </div>
      )}
      {rackInfo && (
        <button className="rack-info" onClick={() => setRackInfo("")}>
          {rackInfo} ×
        </button>
      )}
    </div>
  );
}
