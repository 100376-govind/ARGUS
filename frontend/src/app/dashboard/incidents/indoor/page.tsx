"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────
interface Room {
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
}

interface EgressNode {
  type: "elevator" | "stairs";
  x: number;
  z: number;
}

interface FloorConfig {
  level: number;
  name: string;
  rooms: Room[];
  egress: EgressNode[];
}

interface TrackedPerson {
  id: string;
  name: string;
  role: string;
  floor: number;
  x: number;
  z: number;
  status: "NORMAL" | "ALERT" | "CRITICAL";
  heartRate: number;
  battery: number;
}

interface HazardZone {
  id: string;
  name: string;
  floor: number;
  x: number;
  z: number;
  radius: number;
  type: "fire" | "smoke" | "hazard";
}

// ── Building Structure Definition ──────────────────────────
const BUILDING_FLOORS: FloorConfig[] = [
  {
    level: 0,
    name: "Ground Floor",
    rooms: [
      { name: "Lobby & Reception", x: -8, z: 0, w: 6, d: 8, color: "#00DAF3" },
      { name: "Main Server Room", x: 8, z: 4, w: 4, d: 6, color: "#FF5252" },
      { name: "Stairwell Access A", x: 0, z: -8, w: 3, d: 3, color: "#FFC107" },
      { name: "Elevator Lobby", x: 0, z: 8, w: 3, d: 3, color: "#00E676" },
      { name: "Security Desk", x: -4, z: -6, w: 3, d: 3, color: "#00DAF3" },
      { name: "Facility Office", x: 6, z: -6, w: 4, d: 4, color: "#E0E0E0" },
    ],
    egress: [
      { type: "stairs", x: 0, z: -8 },
      { type: "elevator", x: 0, z: 8 },
    ],
  },
  {
    level: 1,
    name: "Floor 1 - Operations",
    rooms: [
      { name: "Control Room Alpha", x: -6, z: -4, w: 6, d: 6, color: "#00DAF3" },
      { name: "Meeting Hall", x: 6, z: -2, w: 6, d: 8, color: "#95A5A6" },
      { name: "Stairwell Access A", x: 0, z: -8, w: 3, d: 3, color: "#FFC107" },
      { name: "Elevator Lobby", x: 0, z: 8, w: 3, d: 3, color: "#00E676" },
      { name: "Research Lab A", x: -7, z: 6, w: 4, d: 4, color: "#BB86FC" },
      { name: "Comm Hub", x: 7, z: 6, w: 4, d: 4, color: "#03DAC6" },
    ],
    egress: [
      { type: "stairs", x: 0, z: -8 },
      { type: "elevator", x: 0, z: 8 },
    ],
  },
  {
    level: 2,
    name: "Floor 2 - Engineering",
    rooms: [
      { name: "Hardware Prototyping", x: -8, z: 0, w: 6, d: 10, color: "#BB86FC" },
      { name: "R&D Staging Area", x: 8, z: -2, w: 5, d: 8, color: "#00E676" },
      { name: "Stairwell Access A", x: 0, z: -8, w: 3, d: 3, color: "#FFC107" },
      { name: "Elevator Lobby", x: 0, z: 8, w: 3, d: 3, color: "#00E676" },
      { name: "Testing Vault", x: 8, z: 6, w: 4, d: 4, color: "#FF8F00" },
    ],
    egress: [
      { type: "stairs", x: 0, z: -8 },
      { type: "elevator", x: 0, z: 8 },
    ],
  },
  {
    level: 3,
    name: "Floor 3 - Executive",
    rooms: [
      { name: "Executive Suite", x: -6, z: -4, w: 5, d: 6, color: "#CFD8DC" },
      { name: "Boardroom", x: 6, z: -2, w: 6, d: 8, color: "#ECEFF1" },
      { name: "Stairwell Access A", x: 0, z: -8, w: 3, d: 3, color: "#FFC107" },
      { name: "Elevator Lobby", x: 0, z: 8, w: 3, d: 3, color: "#00E676" },
      { name: "Sky Lounge", x: -6, z: 6, w: 5, d: 4, color: "#00DAF3" },
    ],
    egress: [
      { type: "stairs", x: 0, z: -8 },
      { type: "elevator", x: 0, z: 8 },
    ],
  },
];

export default function Tactical3DPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);

  // UI state variables
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [explodedView, setExplodedView] = useState<boolean>(false);
  const [wallOpacity, setWallOpacity] = useState<number>(0.15);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [egressVisible, setEgressVisible] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);

  // Live Tracked Personnel
  const [trackedPeople, setTrackedPeople] = useState<TrackedPerson[]>([
    { id: "OP-01", name: "Agent Govind", role: "Tactical Lead", floor: 1, x: -6, z: -4, status: "NORMAL", heartRate: 72, battery: 98 },
    { id: "OP-02", name: "Officer K. Sen", role: "Reconnaissance", floor: 0, x: 8, z: 4, status: "ALERT", heartRate: 98, battery: 85 },
    { id: "OP-03", name: "Dr. A. Roy", role: "Bio-Safety Officer", floor: 2, x: -8, z: 2, status: "NORMAL", heartRate: 80, battery: 90 },
    { id: "OP-04", name: "Engr. M. Das", role: "Grid Controller", floor: 1, x: 7, z: 6, status: "CRITICAL", heartRate: 115, battery: 42 },
  ]);

  // Active Building Hazards
  const [hazardZones, setHazardZones] = useState<HazardZone[]>([
    { id: "HZ-01", name: "Thermal Leak", floor: 0, x: 8, z: 4, radius: 2.2, type: "fire" },
    { id: "HZ-02", name: "High Gas Levels", floor: 2, x: 8, z: 6, radius: 2.5, type: "hazard" },
    { id: "HZ-03", name: "Corridor Blockage", floor: 1, x: 0, z: 2, radius: 1.5, type: "smoke" },
  ]);

  // Dynamic references for three.js objects
  const floorGroupsRef = useRef<Record<number, any>>({});
  const markerMeshesRef = useRef<Record<string, any>>({});
  const hazardMeshesRef = useRef<any[]>([]);

  // Simulation timeline interval
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTrackedPeople((prev) =>
        prev.map((person) => {
          // Add minor Brownian motion step bounded to structure grid [-9, 9]
          let dx = (Math.random() - 0.5) * 1.2;
          let dz = (Math.random() - 0.5) * 1.2;
          let newX = Math.max(-9, Math.min(9, person.x + dx));
          let newZ = Math.max(-9, Math.min(9, person.z + dz));

          // Rare chance of floor change
          let newFloor = person.floor;
          if (Math.random() < 0.05) {
            newFloor = (person.floor + (Math.random() > 0.5 ? 1 : -1) + 4) % 4;
          }

          // Heartrate jitter
          let hrDiff = Math.floor((Math.random() - 0.5) * 6);
          let newHr = Math.max(60, Math.min(140, person.heartRate + hrDiff));

          // Battery drain
          let newBat = Math.max(1, person.battery - (Math.random() > 0.8 ? 1 : 0));

          return {
            ...person,
            x: Number(newX.toFixed(2)),
            z: Number(newZ.toFixed(2)),
            floor: newFloor,
            heartRate: newHr,
            battery: newBat,
          };
        })
      );
    }, 1800);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Dynamically setup/destroy Three.js canvas
  useEffect(() => {
    if (!mountRef.current) return;

    // Dynamically load Three.js to guarantee environment compatibility
    Promise.all([
      import("three"),
      import("three/examples/jsm/controls/OrbitControls.js")
    ]).then(([THREE, { OrbitControls }]) => {
      // 1. Setup Scene, Camera, and WebGLRenderer
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0c0f12");
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        45,
        mountRef.current!.clientWidth / mountRef.current!.clientHeight,
        0.1,
        1000
      );
      camera.position.set(22, 28, 22);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(mountRef.current!.clientWidth, mountRef.current!.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      rendererRef.current = renderer;

      // Clean existing nodes
      mountRef.current!.innerHTML = "";
      mountRef.current!.appendChild(renderer.domElement);

      // 2. Setup Tactical Lights
      const ambientLight = new THREE.AmbientLight("#111a24", 2.0);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight("#00DAF3", 1.8);
      directionalLight.position.set(15, 35, 10);
      scene.add(directionalLight);

      const auxiliaryLight = new THREE.DirectionalLight("#BB86FC", 0.8);
      auxiliaryLight.position.set(-15, 15, -10);
      scene.add(auxiliaryLight);

      // 3. Grid Helper baseline
      const gridHelper = new THREE.GridHelper(24, 24, "#00DAF3", "#142129");
      (gridHelper.material as any).opacity = 0.2;
      (gridHelper.material as any).transparent = true;
      gridHelper.position.y = -0.5;
      scene.add(gridHelper);

      // 4. Generate Procedural Building Structure
      const floorGroups: Record<number, any> = {};

      BUILDING_FLOORS.forEach((floor) => {
        const floorGroup = new THREE.Group();
        // Base vertical layer stacking: default 4.5 units step (increases when exploded)
        floorGroup.position.y = floor.level * 4.5;
        scene.add(floorGroup);
        floorGroups[floor.level] = floorGroup;

        // Ground slab geometry
        const slabGeom = new THREE.BoxGeometry(22, 0.1, 22);
        const slabMat = new THREE.MeshPhongMaterial({
          color: "#080c10",
          transparent: true,
          opacity: 0.85,
          shininess: 10,
        });
        const slabMesh = new THREE.Mesh(slabGeom, slabMat);
        floorGroup.add(slabMesh);

        // Core corridor boundary wire lines
        const wireframeGeom = new THREE.BoxGeometry(22.1, 0.12, 22.1);
        const edgeGeom = new THREE.EdgesGeometry(wireframeGeom);
        const wireframeLine = new THREE.LineSegments(
          edgeGeom,
          new THREE.LineBasicMaterial({ color: "#00DAF3", transparent: true, opacity: 0.25 })
        );
        floorGroup.add(wireframeLine);

        // Draw structural rooms
        floor.rooms.forEach((room) => {
          // Room floor boundary box
          const rGeom = new THREE.BoxGeometry(room.w, 0.1, room.d);
          const rMat = new THREE.MeshPhongMaterial({
            color: room.color,
            transparent: true,
            opacity: 0.15,
          });
          const rMesh = new THREE.Mesh(rGeom, rMat);
          rMesh.position.set(room.x, 0.06, room.z);
          floorGroup.add(rMesh);

          // Room boundary walls outline
          const wallHeight = 2.4;
          const wallGeom = new THREE.BoxGeometry(room.w, wallHeight, room.d);
          const wallEdge = new THREE.EdgesGeometry(wallGeom);
          const wallLine = new THREE.LineSegments(
            wallEdge,
            new THREE.LineBasicMaterial({ color: "#00DAF3", transparent: true, opacity: 0.15 })
          );
          wallLine.position.set(room.x, wallHeight / 2, room.z);
          floorGroup.add(wallLine);

          // Solid semi-transparent wall meshes
          const solidWallMat = new THREE.MeshPhongMaterial({
            color: "#14252f",
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
          });
          const solidWall = new THREE.Mesh(wallGeom, solidWallMat);
          solidWall.position.set(room.x, wallHeight / 2, room.z);
          floorGroup.add(solidWall);
        });

        // Draw egress points (elevators & stairs)
        floor.egress.forEach((node) => {
          const egColor = node.type === "elevator" ? "#00E676" : "#FFC107";
          const eGeom = new THREE.BoxGeometry(3, 2.5, 3);
          const eEdge = new THREE.EdgesGeometry(eGeom);
          const eLine = new THREE.LineSegments(
            eEdge,
            new THREE.LineBasicMaterial({ color: egColor, transparent: true, opacity: 0.5 })
          );
          eLine.position.set(node.x, 1.25, node.z);
          floorGroup.add(eLine);
        });
      });

      floorGroupsRef.current = floorGroups;

      // 5. Setup OrbitControls with Damping and constraints
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 10;
      controls.maxDistance = 80;
      controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow looking slightly below floor level
      controlsRef.current = controls;

      // Ensure correct initial frame focus
      controls.target.set(0, 3.5, 0);
      controls.update();

      // 6. Tracked Personnel markers (Cylinder Pins)
      const markerGroups: Record<string, any> = {};
      markerMeshesRef.current = markerGroups;

      // 7. Responsive window scaling
      const handleResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };
      window.addEventListener("resize", handleResize);

      // 8. Animation/Render Loop
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        // Update controls for damping smoothness
        if (controlsRef.current) {
          controlsRef.current.update();
        }

        // Animate hazard pulses
        hazardMeshesRef.current.forEach((hm) => {
          if (hm.material) {
            const time = Date.now() * 0.0035;
            hm.material.opacity = 0.15 + Math.sin(time) * 0.12;
            const scale = 1.0 + Math.sin(time * 0.5) * 0.1;
            hm.scale.set(scale, 1, scale);
          }
        });

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener("resize", handleResize);
        controls.dispose();
      };
    });
  }, []);

  // ── Sync Visual States / Positions ─────────────────────────
  useEffect(() => {
    // 1. Handle Explosion Offset & Floor Focus Transparencies
    const floorGroups = floorGroupsRef.current;
    const yStep = explodedView ? 7.5 : 4.5;

    Object.entries(floorGroups).forEach(([levelKey, group]: [string, any]) => {
      const level = parseInt(levelKey);
      const isFocused = level === selectedFloor;

      // Smooth offset updates
      const targetY = level * yStep;
      group.position.y += (targetY - group.position.y) * 0.18;

      // Adjust opacities recursively for non-focused floors
      group.children.forEach((child: any) => {
        if (child.material) {
          // Adjust wall geometries
          const isWall = child.geometry?.type === "BoxGeometry" && child.geometry?.parameters?.height > 1.0;
          if (isWall) {
            child.material.opacity = isFocused ? wallOpacity : wallOpacity * 0.2;
            child.material.wireframe = wireframeMode;
          } else {
            // Slabs
            child.material.opacity = isFocused ? 0.85 : 0.15;
          }
        }
      });
    });
  }, [selectedFloor, explodedView, wallOpacity, wireframeMode]);

  // ── Render / Position 3D Personnel Markers ─────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Load Three
    import("three").then((THREE) => {
      const yStep = explodedView ? 7.5 : 4.5;

      trackedPeople.forEach((person) => {
        let marker = markerMeshesRef.current[person.id];

        // Create marker if it does not exist
        if (!marker) {
          const group = new THREE.Group();

          // Cyberpunk cone pin pointing downward
          const geom = new THREE.ConeGeometry(0.45, 1.2, 5);
          geom.rotateX(Math.PI); // Point down
          const mat = new THREE.MeshPhongMaterial({
            color: person.status === "CRITICAL" ? "#FF5252" : person.status === "ALERT" ? "#FFC107" : "#00DAF3",
            emissive: person.status === "CRITICAL" ? "#4a0606" : "#000000",
            shininess: 30,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.y = 1.0;
          group.add(mesh);

          // Pulsing halo at the feet of the operator
          const ringGeom = new THREE.RingGeometry(0.1, 0.7, 16);
          ringGeom.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: mat.color,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeom, ringMat);
          ringMesh.position.y = 0.05;
          group.add(ringMesh);

          scene.add(group);
          marker = group;
          markerMeshesRef.current[person.id] = marker;
        }

        // Apply Lerp-like target translation matching exploded offset height
        const targetY = person.floor * yStep + 0.1;
        marker.position.x += (person.x - marker.position.x) * 0.12;
        marker.position.z += (person.z - marker.position.z) * 0.12;
        marker.position.y += (targetY - marker.position.y) * 0.12;

        // Animate marker properties dynamically
        const meshCone = marker.children[0];
        if (meshCone && meshCone.material) {
          meshCone.material.color.set(
            person.status === "CRITICAL" ? "#FF5252" : person.status === "ALERT" ? "#FFC107" : "#00DAF3"
          );
        }
      });

      // Cleanup deleted markers
      Object.keys(markerMeshesRef.current).forEach((key) => {
        if (!trackedPeople.some((p) => p.id === key)) {
          const obj = markerMeshesRef.current[key];
          if (obj) scene.remove(obj);
          delete markerMeshesRef.current[key];
        }
      });
    });
  }, [trackedPeople, explodedView]);

  // ── Sync Visual Hazards ────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    import("three").then((THREE) => {
      const yStep = explodedView ? 7.5 : 4.5;

      // Clear existing hazard meshes
      hazardMeshesRef.current.forEach((hm) => scene.remove(hm));
      hazardMeshesRef.current = [];

      if (!showHazards) return;

      hazardZones.forEach((hz) => {
        // Red volumetric warning sphere showing hazard radius
        const geom = new THREE.CylinderGeometry(hz.radius, hz.radius, 1.8, 16);
        const mat = new THREE.MeshPhongMaterial({
          color: hz.type === "fire" ? "#FF1744" : hz.type === "smoke" ? "#616161" : "#FFEA00",
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(hz.x, hz.floor * yStep + 0.9, hz.z);
        scene.add(mesh);
        hazardMeshesRef.current.push(mesh);
      });
    });
  }, [hazardZones, explodedView, showHazards]);

  // Camera Helper Actions
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(22, 28, 22);
    controlsRef.current.target.set(0, (explodedView ? 7.5 : 3.5), 0);
    controlsRef.current.update();
  };

  const fitModel = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(28, 32, 28);
    controlsRef.current.target.set(0, (explodedView ? 7.5 : 3.5), 0);
    controlsRef.current.update();
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !controlsRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    import("three").then((THREE) => {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
      const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const controls = controlsRef.current;
        controls.target.copy(point);
        
        // Zoom in slightly closer to the double-clicked spot
        const dir = new THREE.Vector3().subVectors(cameraRef.current.position, point).normalize();
        cameraRef.current.position.copy(point).addScaledVector(dir, 12);
        controls.update();
      }
    });
  };

  // Sync camera target on floor changes
  useEffect(() => {
    if (controlsRef.current) {
      const yStep = explodedView ? 7.5 : 4.5;
      controlsRef.current.target.y = selectedFloor * yStep + 1.2;
      controlsRef.current.update();
    }
  }, [selectedFloor, explodedView]);

  // ── Derived stats ──────────────────────────────────────────
  const activeAlerts = useMemo(() => {
    return trackedPeople.filter((p) => p.status !== "NORMAL").length;
  }, [trackedPeople]);

  return (
    <div className="p-6 flex gap-6 h-[calc(100vh-4rem)] relative overflow-hidden text-on-surface bg-[#0c0f12]">
      {/* Left Collapsible Floating Toolbar */}
      <div className={`relative shrink-0 flex flex-col transition-all duration-300 ${isLeftPanelOpen ? "w-64" : "w-12"}`}>
        <div className="glass-panel border border-outline-variant/30 h-full p-4 flex flex-col gap-4 relative overflow-hidden select-none">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div className={`flex items-center gap-2 transition-opacity duration-200 ${isLeftPanelOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
              <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">tune</span>
              <span className="font-[var(--font-geist)] text-[11px] font-bold text-primary-fixed-dim uppercase tracking-wider">
                Adjustments
              </span>
            </div>
            <button
              onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
              className="text-outline hover:text-on-surface transition-colors cursor-pointer select-none"
              title={isLeftPanelOpen ? "Collapse controls" : "Expand controls"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isLeftPanelOpen ? "menu_open" : "menu"}
              </span>
            </button>
          </div>

          {isLeftPanelOpen && (
            <div className="flex flex-col gap-4 font-[var(--font-geist)] text-[11px] leading-relaxed">
              {/* Controls */}
              <div className="flex flex-col gap-3.5">
                {/* Exploded view */}
                <div className="flex items-center justify-between">
                  <span className="text-outline uppercase">Exploded View</span>
                  <button
                    onClick={() => setExplodedView(!explodedView)}
                    className={`px-2.5 py-1 font-bold rounded-sm border uppercase transition-all duration-200 active:scale-95 flex items-center gap-1 cursor-pointer ${
                      explodedView
                        ? "bg-secondary/15 border-secondary text-secondary shadow-[0_0_8px_rgba(68,221,193,0.3)]"
                        : "bg-surface-container-highest/30 border-outline-variant text-outline"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {explodedView ? "height" : "unfold_more"}
                    </span>
                    {explodedView ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Wireframe */}
                <div className="flex items-center justify-between">
                  <span className="text-outline uppercase">Wireframe</span>
                  <button
                    onClick={() => setWireframeMode(!wireframeMode)}
                    className={`px-2.5 py-1 font-bold rounded-sm border uppercase transition-all duration-200 active:scale-95 flex items-center gap-1 cursor-pointer ${
                      wireframeMode
                        ? "bg-secondary/15 border-secondary text-secondary shadow-[0_0_8px_rgba(68,221,193,0.3)]"
                        : "bg-surface-container-highest/30 border-outline-variant text-outline"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">grid_on</span>
                    {wireframeMode ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Egress */}
                <div className="flex items-center justify-between">
                  <span className="text-outline uppercase">Egress Nodes</span>
                  <button
                    onClick={() => setEgressVisible(!egressVisible)}
                    className={`px-2.5 py-1 font-bold rounded-sm border uppercase transition-all duration-200 active:scale-95 flex items-center gap-1 cursor-pointer ${
                      egressVisible
                        ? "bg-secondary/15 border-secondary text-secondary shadow-[0_0_8px_rgba(68,221,193,0.3)]"
                        : "bg-surface-container-highest/30 border-outline-variant text-outline"
                    }`}
                  >
                    {egressVisible ? "SHOW" : "HIDE"}
                  </button>
                </div>

                {/* Hazards */}
                <div className="flex items-center justify-between">
                  <span className="text-outline uppercase">Threat zones</span>
                  <button
                    onClick={() => setShowHazards(!showHazards)}
                    className={`px-2.5 py-1 font-bold rounded-sm border uppercase transition-all duration-200 active:scale-95 flex items-center gap-1 cursor-pointer ${
                      showHazards
                        ? "bg-error/20 border-error text-error shadow-[0_0_8px_rgba(255,82,82,0.3)]"
                        : "bg-surface-container-highest/30 border-outline-variant text-outline"
                    }`}
                  >
                    {showHazards ? "ACTIVE" : "MUTED"}
                  </button>
                </div>

                {/* Slider */}
                <div className="flex flex-col gap-1.5 border-t border-outline-variant/10 pt-3">
                  <div className="flex justify-between uppercase">
                    <span className="text-outline">Wall Opacity</span>
                    <span className="text-primary-fixed-dim">{(wallOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={wallOpacity}
                    onChange={(e) => setWallOpacity(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-primary-fixed-dim"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Column: Unobstructed Viewport & Toolbars */}
      <div className="flex-1 flex flex-col gap-4 h-full relative">
        {/* Title Header */}
        <div className="flex items-center justify-between bg-surface-container-lowest/50 border border-outline-variant/20 px-4 py-2.5 rounded-sm select-none">
          <div>
            <h1 className="font-[var(--font-inter)] text-[18px] leading-[24px] font-bold text-primary uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,218,243,0.8)]">
              Sector-7 Indoor Tactical Map
            </h1>
            <p className="font-[var(--font-geist)] text-[10px] text-outline mt-0.5 uppercase tracking-widest">
              validated telemetry visualization engine
            </p>
          </div>
          <div className="bg-surface-container-highest/40 border border-outline-variant/20 px-3 py-1 rounded-sm font-[var(--font-geist)] text-[10px] text-outline uppercase tracking-wider">
            Operator Console Connected
          </div>
        </div>

        {/* Dedicated 3D Canvas Viewport Container */}
        <div className="flex-1 relative w-full border border-outline-variant/25 rounded-sm overflow-hidden bg-black/40 shadow-[inset_0_0_30px_rgba(0,0,0,0.85)]">
          {/* Mount canvas with 100% dimensions and no overlay blocking */}
          <div 
            ref={mountRef} 
            className="w-full h-full cursor-grab active:cursor-grabbing outline-none" 
            onDoubleClick={onDoubleClick}
          />
          <div className="tech-bracket" />
        </div>

        {/* Compact Bottom Toolbar */}
        <div className="flex items-center justify-between bg-surface-container-lowest/50 border border-outline-variant/20 p-3 rounded-sm font-[var(--font-geist)] select-none">
          {/* Floor selector */}
          <div className="flex gap-1.5">
            {BUILDING_FLOORS.map((floor) => {
              const isActive = selectedFloor === floor.level;
              return (
                <button
                  key={floor.level}
                  onClick={() => setSelectedFloor(floor.level)}
                  className={`px-3 py-1.5 font-[var(--font-inter)] text-[11px] font-bold border uppercase transition-all duration-200 active:scale-95 cursor-pointer rounded-sm ${
                    isActive
                      ? "bg-primary-fixed-dim/20 border-primary-fixed-dim text-primary-fixed-dim shadow-[0_0_12px_rgba(0,218,243,0.4)]"
                      : "bg-surface-container-lowest/70 border-outline-variant/30 text-outline hover:text-on-surface"
                  }`}
                >
                  {floor.name}
                </button>
              );
            })}
          </div>

          {/* Camera Controls & Tooltips */}
          <div className="flex items-center gap-3">
            <span className="text-outline text-[9px] uppercase tracking-wider mr-2 hidden lg:inline">
              🖱 Left: Orbit • Right: Pan • Wheel: Zoom • Double Click: Focus
            </span>
            <button
              onClick={resetCamera}
              className="px-3 py-1.5 font-bold border border-outline-variant/30 rounded-sm text-[11px] hover:text-primary-fixed-dim hover:border-primary-fixed-dim transition-all active:scale-95 cursor-pointer"
              title="Restore default isometric view"
            >
              Reset Camera
            </button>
            <button
              onClick={fitModel}
              className="px-3 py-1.5 font-bold border border-outline-variant/30 rounded-sm text-[11px] hover:text-primary-fixed-dim hover:border-primary-fixed-dim transition-all active:scale-95 cursor-pointer"
              title="Center building in view"
            >
              Fit Model
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Details and Logs */}
      <div className="w-80 flex flex-col gap-[var(--spacing-gutter)] shrink-0 h-full">
        {/* Tracked Personnel Overview */}
        <div className="glass-card rounded-sm p-1 relative flex-1 flex flex-col min-h-[300px]">
          <div className="glass-card-header px-3 py-2 flex items-center justify-between border-b border-outline-variant/20 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                my_location
              </span>
              <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-secondary uppercase">
                Personnel Tracking
              </span>
            </div>
            {activeAlerts > 0 && (
              <span className="font-[var(--font-geist)] text-[10px] font-bold bg-error/20 text-error px-2 py-0.5 rounded-sm animate-pulse">
                {activeAlerts} ALERTS
              </span>
            )}
          </div>

          <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2.5">
            {trackedPeople.map((person) => {
              const isSelected = selectedPerson === person.id;
              const isAlert = person.status !== "NORMAL";
              const isCritical = person.status === "CRITICAL";

              return (
                <div
                  key={person.id}
                  onClick={() => setSelectedPerson(isSelected ? null : person.id)}
                  className={`p-3 rounded-sm border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? "bg-primary/5 border-primary"
                      : isAlert
                      ? isCritical
                        ? "bg-error/5 border-error/40 hover:border-error/60"
                        : "bg-tertiary-container/5 border-tertiary-container/40 hover:border-tertiary-container/60"
                      : "bg-surface-container-lowest/30 border-outline-variant/20 hover:border-outline-variant/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-[var(--font-inter)] text-[13px] font-bold">
                        {person.name}
                      </h4>
                      <p className="font-[var(--font-geist)] text-[10px] text-outline">
                        {person.role}
                      </p>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isCritical
                          ? "bg-error animate-ping"
                          : isAlert
                          ? "bg-tertiary-container animate-pulse"
                          : "bg-secondary"
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-outline-variant/10 pt-2 font-[var(--font-geist)] text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-outline text-[9px] uppercase">Location</span>
                      <span className="font-semibold text-on-surface">
                        F{person.floor} • ({person.x}, {person.z})
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-outline text-[9px] uppercase">Telemetry</span>
                      <span
                        className={`font-semibold ${
                          isCritical ? "text-error" : isAlert ? "text-tertiary-container" : "text-secondary"
                        }`}
                      >
                        {person.heartRate} BPM • {person.battery}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Structural Threat & Egress Log */}
        <div className="glass-card rounded-sm p-1 relative h-56 flex flex-col shrink-0">
          <div className="glass-card-header px-3 py-2 flex items-center justify-between border-b border-outline-variant/20 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error">warning</span>
              <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-error uppercase">
                Structural Threats
              </span>
            </div>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="text-[9px] uppercase font-bold px-2 py-0.5 border border-outline-variant/35 rounded-sm hover:text-primary transition-colors"
            >
              {isSimulating ? "Pause Sim" : "Resume Sim"}
            </button>
          </div>

          <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2 font-[var(--font-geist)] text-[11px] leading-relaxed">
            {hazardZones.map((hz) => (
              <div key={hz.id} className="flex items-start gap-2 border-b border-outline-variant/10 pb-1.5">
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    hz.type === "fire" ? "text-error animate-pulse" : "text-tertiary-container"
                  }`}
                >
                  {hz.type === "fire" ? "local_fire_department" : "warning"}
                </span>
                <div>
                  <div className="font-bold text-on-surface">{hz.name}</div>
                  <div className="text-outline text-[10px] uppercase">
                    Level {hz.floor} • ({hz.x}, {hz.z}) • Radius: {hz.radius}M
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


