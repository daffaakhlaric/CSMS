"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { Component, ReactNode, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EamState, Worker, contents } from "@/lib/eam/engine";
import { Zone, center, navigation } from "@/lib/eam/layout";
const palette = {
  production: "#badbd8",
  cold: "#c4e6f6",
  support: "#d7ddd9",
  logistics: "#e4d8bb",
};
function Box({
  p,
  s,
  c,
  onClick,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  onClick?: () => void;
}) {
  return (
    <mesh
      position={p}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.72} />
    </mesh>
  );
}
function Camera({
  zone,
  revision,
}: {
  zone: Zone | undefined;
  revision: number;
}) {
  const { camera, controls } = useThree();
  const transition = useRef(0);
  useEffect(() => {
    transition.current = 1;
  }, [zone?.id, zone?.x, zone?.z, zone?.w, zone?.d, revision]);
  useFrame((_, dt) => {
    if (!transition.current) return;
    const [x, z] = zone ? center(zone) : [50, 55];
    const desired = new THREE.Vector3(
      x + (zone ? 24 : 115),
      zone ? 35 : 170,
      z + (zone ? 24 : 150),
    );
    camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
    const orbit = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    };
    if (orbit) {
      orbit.target.lerp(new THREE.Vector3(x, 0, z), 1 - Math.exp(-dt * 4));
      orbit.update();
    }
    if (camera.position.distanceTo(desired) < 0.05) transition.current = 0;
  });
  return null;
}
function WorkerMesh({
  w,
  state,
  onSelect,
  elements,
}: {
  w: Worker;
  state: EamState;
  onSelect: () => void;
  elements: React.RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const ref = useRef<THREE.Group>(null),
    left = useRef<THREE.Group>(null),
    right = useRef<THREE.Group>(null);
  const nodes = navigation(state.layout, w.from, w.zone);
  const tick = useRef(0);
  const projection = useRef(new THREE.Vector3());
  useEffect(() => {
    tick.current = 0;
  }, [w.started, w.task]);
  useFrame(({ camera, size }, dt) => {
    if (!ref.current) return;
    if (state.running || w.manual)
      tick.current = Math.min(1, tick.current + (dt * state.speed) / 6);
    const t = Math.max(
      tick.current,
      Math.min(1, (state.clock - w.started) / 6),
    );
    const v = t * (nodes.length - 1),
      i = Math.min(nodes.length - 2, Math.floor(v)),
      f = Math.min(1, v - i);
    const a = nodes[i],
      b = nodes[i + 1];
    ref.current.position.set(
      a[0] + (b[0] - a[0]) * f,
      0.3,
      a[1] + (b[1] - a[1]) * f,
    );
    ref.current.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const label = elements.current[w.id];
    if (label) {
      projection.current
        .copy(ref.current.position)
        .add(new THREE.Vector3(0, 4, 0))
        .project(camera);
      label.style.transform = `translate(${((projection.current.x + 1) * size.width) / 2}px,${((1 - projection.current.y) * size.height) / 2}px) translate(-50%,-50%)`;
      label.style.visibility = projection.current.z > 1 ? "hidden" : "visible";
    }
    if (left.current && right.current) {
      const swing = t < 1 ? Math.sin(t * 60) * 0.5 : 0;
      left.current.rotation.x = swing;
      right.current.rotation.x = -swing;
    }
  });
  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Box
        p={[0, 1.3, 0]}
        s={[0.85, 1.3, 0.55]}
        c={w.id === "WK-06" ? "#f2bd57" : "#168b8b"}
      />
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#e8b993" />
      </mesh>
      <mesh position={[0, 2.55, 0]}>
        <sphereGeometry args={[0.42, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffd24b" />
      </mesh>
      <group ref={left} position={[-0.25, 0.65, 0]}>
        <Box p={[0, -0.35, 0]} s={[0.25, 0.8, 0.3]} c="#243c53" />
      </group>
      <group ref={right} position={[0.25, 0.65, 0]}>
        <Box p={[0, -0.35, 0]} s={[0.25, 0.8, 0.3]} c="#243c53" />
      </group>
      <Box p={[-0.65, 1.3, 0.1]} s={[0.25, 0.85, 0.25]} c="#e8b993" />
      <Box p={[0.65, 1.3, 0.1]} s={[0.25, 0.85, 0.25]} c="#e8b993" />
      {["LOADING", "MOVING_PALLET"].includes(w.status) && (
        <Box p={[0, 1.1, 0.7]} s={[1.1, 0.7, 0.65]} c="#e6c99b" />
      )}
    </group>
  );
}
function Sacks({
  state,
  select,
  selected,
}: {
  state: EamState;
  select: (id: string) => void;
  selected: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = state.sacks.filter(
    (s) =>
      s.pallet &&
      (s.status === "PALLETIZED" ||
        (s.status === "STORED" && !!state.activeCS)),
  );
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const sk = list[i],
        pIndex = state.pallets.findIndex((p) => p.id === sk.pallet),
        zone =
          state.layout.find(
            (z) =>
              z.id ===
              (sk.status === "PALLETIZED" ? "packing" : state.activeCS),
          ) || state.layout.find((z) => z.id === "anteroom")!;
      const index = contents(state, sk.pallet!).findIndex(
        (a) => a.id === sk.id,
      );
      dummy.position.set(
        zone.x + 2 + (pIndex % 5) * 3.5 + (index % 3) * 0.65,
        0.8 + Math.floor(index / 9) * 0.55,
        zone.z +
          2 +
          Math.floor(pIndex / 5) * 3.5 +
          (Math.floor(index / 3) % 3) * 0.55,
      );
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(
        i,
        new THREE.Color(sk.id === selected ? "#ff7447" : "#e9cf9c"),
      );
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [state, list, selected]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, list.length)]}
      count={list.length}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) select(list[e.instanceId].id);
      }}
      castShadow
    >
      <boxGeometry args={[0.6, 0.5, 0.5]} />
      <meshStandardMaterial color="#e9cf9c" />
    </instancedMesh>
  );
}
function Labels({
  layout,
  elements,
}: {
  layout: Zone[];
  elements: React.RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const point = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const z of layout) {
      const el = elements.current[z.id];
      if (!el) continue;
      const [x, zz] = center(z);
      point.current.set(x, 3.4, zz).project(camera);
      el.style.transform = `translate(${((point.current.x + 1) * size.width) / 2}px,${((1 - point.current.y) * size.height) / 2}px) translate(-50%,-50%)`;
      el.style.visibility = point.current.z > 1 ? "hidden" : "visible";
    }
  });
  return null;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="eam-fallback">
        3D tidak tersedia di perangkat ini. Gunakan denah 2D, panel transaksi,
        dan timeline.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function EamTwin({
  state,
  selected,
  onSelect,
}: {
  state: EamState;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [focus, setFocus] = useState(""),
    [revision, setRevision] = useState(0),
    [walls, setWalls] = useState(true),
    [evac, setEvac] = useState(false),
    [labels, setLabels] = useState(true),
    [flat, setFlat] = useState(false);
  const el = useRef<HTMLDivElement>(null),
    elements = useRef<Record<string, HTMLDivElement | null>>({});
  const select = (id: string) => {
    onSelect(id);
    if (state.layout.some((z) => z.id === id)) setFocus(id);
  };
  const zone = state.layout.find((z) => z.id === focus);
  const selectedSack = state.sacks.find((s) => s.id === selected);
  const requestedFocus = state.layout.some((z) => z.id === selected)
    ? selected
    : state.workers.find((w) => w.id === selected)?.zone ||
      (selectedSack
        ? selectedSack.status === "LOADING" ||
          selectedSack.status === "DISPATCHED"
          ? "loading"
          : selectedSack.status === "STORED"
            ? state.activeCS
            : "packing"
        : selected.startsWith("PLT") || /^R\d/.test(selected)
          ? state.activeCS
          : null);
  useEffect(() => {
    if (requestedFocus) setFocus(requestedFocus);
  }, [requestedFocus]);
  return (
    <div className="eam-twin">
      <div className="eam-twin-toolbar">
        <select
          aria-label="Preset kamera"
          value={focus}
          onChange={(e) => {
            setFocus(e.target.value);
            setRevision((r) => r + 1);
          }}
        >
          {[
            ["", "Factory overview"],
            ["abf-3", "ABF area"],
            ["packing", "Packing / pallet"],
            [state.activeCS || "anteroom", "Cold Storage"],
            ["loading", "Loading dock"],
            ["abf-1", "Monitoring suhu"],
            [state.workers[0].zone, "Worker tracking"],
          ].map(([v, l], i) => (
            <option key={i} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setFocus("");
            setRevision((r) => r + 1);
          }}
        >
          Reset kamera
        </button>
        <button onClick={() => setWalls(!walls)}>
          Dinding {walls ? "ON" : "OFF"}
        </button>
        <button onClick={() => setLabels(!labels)}>Label</button>
        <button onClick={() => setEvac(!evac)}>
          Evakuasi {evac ? "ON" : "OFF"}
        </button>
        <button onClick={() => setFlat(!flat)}>
          {flat ? "3D" : "Denah 2D"}
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.current?.requestFullscreen();
          }}
        >
          Layar penuh
        </button>
      </div>
      <div className="eam-canvas" ref={el}>
        {flat ? (
          <svg viewBox="0 0 105 110" className="eam-flat">
            {state.layout.map((z) => (
              <g key={z.id} onClick={() => select(z.id)}>
                <rect
                  x={z.x}
                  y={z.z}
                  width={z.w}
                  height={z.d}
                  fill={selected === z.id ? "#efba54" : palette[z.kind]}
                  stroke="#78948c"
                  strokeWidth=".3"
                />
                <text x={z.x + 0.5} y={z.z + 2} fontSize="1.5">
                  {z.name}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <Boundary>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{
                position: [165, 170, 205],
                fov: 43,
                near: 0.1,
                far: 500,
              }}
            >
              <color attach="background" args={["#eaf0ee"]} />
              <ambientLight intensity={0.8} />
              <directionalLight
                position={[40, 100, 20]}
                intensity={1.6}
                castShadow
                shadow-mapSize={[1024, 1024]}
              />
              <Box p={[52, -0.6, 55]} s={[112, 1, 118]} c="#cad6d0" />
              {state.layout.map((z) => {
                const [x, zz] = center(z),
                  channel = state.channels.find((c) => c.zone === z.id),
                  isSelected = selected === z.id;
                return (
                  <group
                    key={z.id}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setFocus(z.id);
                      setRevision((r) => r + 1);
                    }}
                  >
                    <Box
                      p={[x, 0, zz]}
                      s={[z.w - 0.3, 0.25, z.d - 0.3]}
                      c={
                        channel?.alarm
                          ? "#e97766"
                          : isSelected
                            ? "#f1c967"
                            : palette[z.kind]
                      }
                      onClick={() => select(z.id)}
                    />
                    {walls && z.id !== "parking" && (
                      <>
                        <Box
                          p={[x, 1.4, z.z]}
                          s={[z.w, 2.8, 0.3]}
                          c="#edf3ed"
                        />
                        <Box
                          p={[z.x + z.w, 1.4, zz]}
                          s={[0.3, 2.8, z.d]}
                          c="#d2e1dc"
                        />
                        {z.kind === "cold" && (
                          <Box
                            p={[z.x + 0.1, 1.4, z.z + z.d * 0.23]}
                            s={[0.25, 2.8, z.d * 0.45]}
                            c="#edf5f4"
                          />
                        )}
                      </>
                    )}
                    {z.id.startsWith("abf-") &&
                      !z.id.includes("machine") &&
                      !z.id.includes("small") && (
                        <>
                          <Box p={[x, 0.9, zz]} s={[4, 1.8, 2.8]} c="#91a4ad" />
                          <Box p={[x, 2, zz]} s={[4.2, 0.2, 3]} c="#e7edef" />
                          <Box
                            p={[x + 1.7, 1.1, zz + 1.45]}
                            s={[0.3, 0.6, 0.1]}
                            c={channel?.alarm ? "#e34747" : "#21b2a3"}
                          />
                        </>
                      )}
                    {z.id === "packing" &&
                      [0, 1, 2].map((i) => (
                        <group key={i}>
                          <Box
                            p={[z.x + 4 + i * 6, 1, zz]}
                            s={[3, 0.25, 2]}
                            c="#abbcc1"
                          />
                          <Box
                            p={[z.x + 4 + i * 6, 1.7, zz]}
                            s={[i === 1 ? 1.2 : 2, 1, 1]}
                            c={i === 1 ? "#e5b553" : "#547780"}
                          />
                        </group>
                      ))}
                    {z.id === "office" &&
                      [0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          p={[z.x + 3 + i * 6, 0.8, zz]}
                          s={[3, 1.4, 2]}
                          c="#937b61"
                        />
                      ))}
                    {z.id === state.activeCS &&
                      [0, 1].map((i) => (
                        <group
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(`R${i + 1}`);
                          }}
                        >
                          <Box
                            p={[z.x + 10, 2.5, z.z + 2 + i * 3.5]}
                            s={[19, 0.25, 2.3]}
                            c="#4e7891"
                          />
                          {[0, 1, 2, 3, 4, 5].map((j) => (
                            <Box
                              key={j}
                              p={[z.x + 1 + j * 3.5, 1.3, z.z + 2 + i * 3.5]}
                              s={[0.2, 2.8, 2.3]}
                              c="#dd9757"
                            />
                          ))}
                        </group>
                      ))}
                  </group>
                );
              })}
              <Sacks state={state} select={onSelect} selected={selected} />
              {state.pallets.map((p, i) => {
                const z = state.layout.find(
                  (z) => z.id === (p.location ? state.activeCS : "packing"),
                );
                if (!z) return null;
                return (
                  <Box
                    key={p.id}
                    p={[
                      z.x + 2.7 + (i % 5) * 3.5,
                      0.35,
                      z.z + 2.5 + Math.floor(i / 5) * 3.5,
                    ]}
                    s={[2.3, 0.35, 2.2]}
                    c={selected === p.id ? "#f29b42" : "#987a4f"}
                    onClick={() => onSelect(p.id)}
                  />
                );
              })}
              {state.workers.map((w) => (
                <WorkerMesh
                  key={w.id}
                  w={w}
                  elements={elements}
                  state={state}
                  onSelect={() => onSelect(w.id)}
                />
              ))}
              <group
                position={[
                  72,
                  0,
                  76 +
                    (state.orders.some((o) => o.dispatched)
                      ? Math.min(
                          18,
                          Math.max(
                            0,
                            state.clock -
                              (state.events
                                .filter((e) => e.kind === "dispatch")
                                .at(-1)?.at || state.clock),
                          ),
                        ) * 2
                      : 0),
                ]}
              >
                <Box p={[0, 2, 0]} s={[5, 4, 11]} c="#f9faf6" />
                <Box p={[0, 1.5, 7]} s={[5, 3, 3]} c="#e4b551" />
                {[-2.5, 2.5].flatMap((x) =>
                  [-3, 4].map((z) => (
                    <mesh
                      key={`${x}-${z}`}
                      position={[x, 0.8, z]}
                      rotation={[0, 0, Math.PI / 2]}
                    >
                      <cylinderGeometry args={[0.8, 0.8, 0.6, 12]} />
                      <meshStandardMaterial color="#303d45" />
                    </mesh>
                  )),
                )}
              </group>
              <group position={[41, 0, 72]}>
                <Box p={[0, 0.8, 0]} s={[2, 1.6, 3]} c="#edb343" />
                <Box p={[0, 2.5, -0.7]} s={[2, 0.25, 2]} c="#354e56" />
                <Box p={[0, 1.5, 1.7]} s={[0.3, 3, 0.3]} c="#455b61" />
              </group>
              {evac && (
                <>
                  <Line
                    points={[
                      [41, 0.4, 40],
                      [41, 0.4, 77],
                      [53, 0.4, 81],
                      [53, 0.4, 84],
                    ]}
                    color="#419c52"
                    lineWidth={4}
                  />
                  <Line
                    points={[
                      [77, 0.4, 55],
                      [77, 0.4, 77],
                      [84, 0.4, 98],
                    ]}
                    color="#419c52"
                    lineWidth={4}
                  />
                </>
              )}
              <OrbitControls
                makeDefault
                target={[50, 0, 55]}
                maxPolarAngle={Math.PI / 2.1}
                minDistance={10}
                maxDistance={340}
              />
              <Camera zone={zone} revision={revision} />
              {labels && <Labels layout={state.layout} elements={elements} />}
            </Canvas>
          </Boundary>
        )}
        {!flat && labels && (
          <div className="eam-labels">
            {state.workers.map((w) => (
              <div
                key={w.id}
                ref={(e) => {
                  elements.current[w.id] = e;
                }}
              >
                <button onClick={() => onSelect(w.id)}>
                  {w.id}
                  <small>
                    {w.role} · {w.status}
                  </small>
                </button>
              </div>
            ))}
            {state.layout
              .filter((z) => z.kind !== "support" || z.id === "office")
              .map((z) => (
                <div
                  key={z.id}
                  ref={(e) => {
                    elements.current[z.id] = e;
                  }}
                >
                  <button onClick={() => select(z.id)}>
                    {z.name}
                    {z.kind === "cold" && (
                      <small>
                        {state.activeCS === z.id
                          ? "CS-01 AKTIF"
                          : state.activeCS
                            ? "FISIK · TIDAK AKTIF"
                            : "PEMETAAN BELUM DITENTUKAN"}
                      </small>
                    )}
                    {state.channels.find((c) => c.zone === z.id) && (
                      <small>
                        {state.channels
                          .find((c) => c.zone === z.id)!
                          .value.toFixed(1)}
                        °C · SIMULASI
                      </small>
                    )}
                  </button>
                </div>
              ))}
          </div>
        )}
        <svg
          className="eam-minimap"
          viewBox="0 0 105 110"
          aria-label="Minimap pabrik"
        >
          {state.layout.map((z) => (
            <rect
              key={z.id}
              x={z.x}
              y={z.z}
              width={z.w}
              height={z.d}
              fill={selected === z.id ? "#efb755" : palette[z.kind]}
              stroke="#688b82"
              strokeWidth=".5"
              onClick={() => select(z.id)}
            />
          ))}
        </svg>
        <span className="eam-scene-note">
          SIMULASI · Koordinat perkiraan, bukan meter · NPC bukan posisi
          karyawan nyata
          {evac ? " · Jalur evakuasi ilustratif, bukan rute transport" : ""}
        </span>
      </div>
    </div>
  );
}
