import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THREEx } from '@ar-js-org/ar.js-threejs';
import {
  CHANNEL_ORDER,
  CHANNELS,
  CameraPresetId,
  ChannelId,
  SoilControls,
  TelemetryState,
  ViewMode,
} from '../types/telemetry';
import {
  createAuthorPlaqueTexture,
  createBarkTexture,
  createContactShadowTexture,
  createEsp32FaceplateTexture,
  createForestFloorTexture,
  createSoilCrossSectionTexture,
  drawStatusBoardCanvas,
  drawTelemetryBoardCanvas,
} from './proceduralTextures';

const _vec3 = new THREE.Vector3();
const _vec3b = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _euler = new THREE.Euler();

export type ArTrackingStatus =
  | 'idle'
  | 'initializing'
  | 'searching'
  | 'tracking'
  | 'locked'
  | 'error';

interface CrownTier {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  heightRatio: number;
  baseRotationY: number;
}

interface NeedleParticle {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  vz: number;
  rotSpeed: number;
  angle: number;
}

interface BeetleAgent {
  y: number;
  theta: number;
  speedY: number;
  speedTheta: number;
  phase: number;
}

interface SawdustParticle {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
}

interface BoardEntry {
  channelId: ChannelId;
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  frameMat: THREE.MeshStandardMaterial;
  worldPos: THREE.Vector3;
  normalDir: THREE.Vector3;
}

export const CAMERA_PRESETS: Record<
  CameraPresetId,
  { position: [number, number, number]; target: [number, number, number]; label: string }
> = {
  overview: {
    position: [0.35, 4.9, 12.6],
    target: [0, 2.05, 0],
    label: 'Widok ogólny',
  },
  crown: {
    position: [2.7, 5.4, 5.8],
    target: [0, 4.1, 0],
    label: 'Korona świerku',
  },
  trunk: {
    position: [1.7, 1.95, 2.75],
    target: [0, 1.35, 0],
    label: 'Dendrometr i kora',
  },
  roots: {
    position: [0.75, 1.3, 4.45],
    target: [0.0, -0.58, 0.85],
    label: 'Przekrój gleby 10/60 cm',
  },
  esp32: {
    position: [4.65, 2.35, 3.85],
    target: [3.08, 1.48, 0.28],
    label: 'ESP32 i kable',
  },
  meteo5m: {
    position: [-2.2, 2.1, 3.55],
    target: [-3.35, 1.45, 0.25],
    label: 'Stacja 5m',
  },
};

export class SpruceSceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  // Główna zwarta wyspa (osadzana w 3D lub na znaczniku HIRO w AR)
  private islandRoot = new THREE.Group();

  // Światło i atmosfera
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunOrb!: THREE.Mesh;
  private skyBgColor = new THREE.Color('#6ba3d6');
  private fog!: THREE.FogExp2;

  // Świerk i czujniki
  private trunkMesh!: THREE.Mesh;
  private barkNormalTex!: THREE.CanvasTexture;
  private barkBeetleTex!: THREE.CanvasTexture;
  private trunkMaterial!: THREE.MeshStandardMaterial;
  private crownGroup = new THREE.Group();
  private crownTiers: CrownTier[] = [];
  private dendrometerGroup = new THREE.Group();
  private dendroPlunger!: THREE.Mesh;
  private dendroLedMat!: THREE.MeshStandardMaterial;

  // Zasilanie / ESP32
  private espLedMat!: THREE.MeshStandardMaterial;

  // Pierścień 10 lewitujących tablic 3D ("NASA dla drzewa": 9 kanałów + 10. tablica statusowa)
  private boardsRingGroup = new THREE.Group();
  private boardsVisibleTarget = true;
  private boardsRingScale = 1;
  private boards: Record<ChannelId, BoardEntry> = {} as Record<ChannelId, BoardEntry>;
  private statusBoard: {
    group: THREE.Group;
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    frameMat: THREE.MeshStandardMaterial;
    worldPos: THREE.Vector3;
  } | null = null;
  private lastBoardRenderTime = -1;
  private forceBoardsRefresh = true;

  // Kanałowe materiały kabli i czujników (do podświetlania i pulsowania)
  private channelCableMats: Record<ChannelId, THREE.MeshStandardMaterial[]> = {
    dendrometr: [],
    wilgotnosc10: [],
    wilgotnosc60: [],
    tempGleby: [],
    tempKory: [],
    tempPowietrza: [],
    wilgotnoscPowietrza: [],
    cisnienie: [],
    imgw: [],
  };
  private channelSensorMats: Record<ChannelId, THREE.MeshStandardMaterial[]> = {
    dendrometr: [],
    wilgotnosc10: [],
    wilgotnosc60: [],
    tempGleby: [],
    tempKory: [],
    tempPowietrza: [],
    wilgotnoscPowietrza: [],
    cisnienie: [],
    imgw: [],
  };
  private selectedChannel: ChannelId | null = null;

  // Efekty chorobowe i kornik
  private fallingNeedlesMesh!: THREE.InstancedMesh;
  private needleParticles: NeedleParticle[] = [];
  private beetlesMesh!: THREE.InstancedMesh;
  private beetleAgents: BeetleAgent[] = [];
  private sawdustMesh!: THREE.InstancedMesh;
  private sawdustParticles: SawdustParticle[] = [];

  // Przejście kamery
  private cameraAnimating = false;
  private targetCamPos = new THREE.Vector3(...CAMERA_PRESETS.overview.position);
  private targetOrbit = new THREE.Vector3(...CAMERA_PRESETS.overview.target);

  // Stan symulacji i callbacki
  private telemetryRef: TelemetryState;
  private soilControlsRef: SoilControls = {
    soilTemp10: 14.5,
    soilMoisture10: 62,
    soilTemp60: 11.2,
    soilMoisture60: 68,
  };
  private onSelectChannel?: (channelId: ChannelId | null) => void;
  private onArStatusChange?: (status: ArTrackingStatus, message?: string) => void;

  // Tryb WebAR HIRO + blokada na stole + obracanie palcami wokół osi Y
  private viewMode: ViewMode = '3d';
  private arToolkitSource: any = null;
  private arToolkitContext: any = null;
  private arMarkerControls: any = null;
  private arSmoothedControls: any = null;
  private arRawMarkerGroup = new THREE.Group();
  private arSmoothedGroup = new THREE.Group();
  private arMediaStream: MediaStream | null = null;
  private arReady = false;
  private arWasMarkerVisible = false;
  private arLocked = false;
  private arTargetYaw = 0;
  private arCurrentYaw = 0;
  private isArDragging = false;
  private arDragLastX = 0;
  private arDragDistance = 0;
  private savedCamPos = new THREE.Vector3(...CAMERA_PRESETS.overview.position);
  private savedOrbitTarget = new THREE.Vector3(...CAMERA_PRESETS.overview.target);

  // Zasoby do zwolnienia przy unmount
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(
    container: HTMLElement,
    initialTelemetry: TelemetryState,
    callbacks?: {
      onSelectChannel?: (channelId: ChannelId | null) => void;
      onArStatusChange?: (status: ArTrackingStatus, message?: string) => void;
    }
  ) {
    this.container = container;
    this.telemetryRef = initialTelemetry;
    this.onSelectChannel = callbacks?.onSelectChannel;
    this.onArStatusChange = callbacks?.onArStatusChange;

    this.isSoftwareGl = this.detectSoftwareWebGL();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.setClearAlpha(1);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.skyBgColor;
    this.fog = new THREE.FogExp2('#6ba3d6', 0.022);
    this.scene.fog = this.fog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposables.push(envTex);
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 140);
    this.camera.position.set(...CAMERA_PRESETS.overview.position);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...CAMERA_PRESETS.overview.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 22;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.addEventListener('start', () => {
      this.cameraAnimating = false;
    });

    this.scene.add(this.islandRoot);
    this.scene.add(this.arRawMarkerGroup);
    this.scene.add(this.arSmoothedGroup);
    this.arRawMarkerGroup.visible = false;
    this.arSmoothedGroup.visible = false;

    this.setupLighting();
    this.buildCompactIsland();
    this.buildSoilCutaway();
    this.buildSpruceTree();
    this.buildTreeAndSoilSensors();
    this.buildMeteoStation5m();
    this.buildEsp32AndImgw();
    this.buildTelemetryWires();
    this.buildAuthorPlaque();
    this.buildBioEffects();
    this.buildFloatingTelemetryRing();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.applyTelemetryVisuals(this.telemetryRef, 0);
    this.startLoop();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private tagInteractive(
    obj: THREE.Object3D,
    channelId: ChannelId,
    kind: 'board' | 'sensor' | 'cable'
  ) {
    obj.userData.channelId = channelId;
    obj.userData.kind = kind;
    obj.traverse((child) => {
      child.userData.channelId = channelId;
      child.userData.kind = kind;
    });
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight('#b6dcff', '#3a2e22', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff4df', 2.0);
    this.sunLight.position.set(10, 12, 8);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 36;
    const d = 7;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new THREE.DirectionalLight('#8bb8e8', 0.6);
    this.fillLight.position.set(-9, 6, -7);
    this.scene.add(this.fillLight);

    const sunGeo = this.track(new THREE.SphereGeometry(0.65, 20, 20));
    const sunMat = this.track(
      new THREE.MeshBasicMaterial({ color: '#fde68a', fog: false })
    );
    this.sunOrb = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunOrb);
  }

  /**
   * Punkt 1 i 3: Zwarta okrągła wyspa z wycięciem przekrojowym od frontu (+Z) aż do pnia + 4 mniejsze drzewa w tle
   */
  private buildCompactIsland(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorTex = this.track(createForestFloorTexture(maxAniso));
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.92,
        metalness: 0.02,
      })
    );

    const islandRadius = 4.35;
    // Wycinek przekrojowy z przodu (+Z): od -40° do +40° aż do środka pod pniem (0, 0)
    const halfCutRad = THREE.MathUtils.degToRad(40);
    const alphaLeft = Math.PI * 0.5 + halfCutRad;
    const alphaRight = Math.PI * 0.5 - halfCutRad;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(islandRadius * Math.cos(alphaLeft), islandRadius * Math.sin(alphaLeft));
    shape.absarc(0, 0, islandRadius, alphaLeft, alphaRight + Math.PI * 2, false);
    shape.lineTo(0, 0);

    const topGeo = this.track(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.18,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.05,
        bevelSegments: 2,
        curveSegments: 52,
      })
    );
    topGeo.rotateX(Math.PI / 2);

    const uvAttr = topGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * 0.18, uvAttr.getY(i) * 0.18);
    }

    const islandTop = new THREE.Mesh(topGeo, floorMat);
    islandTop.position.y = 0.02;
    islandTop.receiveShadow = true;
    this.islandRoot.add(islandTop);

    // Zewnętrzny blok ziemny pod nienaruszoną częścią trawnika (280° łuku)
    const skirtMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34261b',
        roughness: 0.95,
        metalness: 0.02,
      })
    );
    const skirtGeo = this.track(
      new THREE.CylinderGeometry(
        islandRadius - 0.06,
        islandRadius - 0.06,
        1.56,
        48,
        1,
        false,
        halfCutRad,
        Math.PI * 2 - halfCutRad * 2
      )
    );
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.y = -0.78;
    skirtMesh.receiveShadow = true;
    this.islandRoot.add(skirtMesh);

    // Tylko 4 mniejsze sąsiednie drzewa w tle (niższe niż pierścień 9 tablic)
    const bgTrunkGeo = this.track(new THREE.CylinderGeometry(0.08, 0.14, 1.15, 8));
    const bgTrunkMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#3b2b20', roughness: 0.9 })
    );
    const bgCrownGeo = this.track(new THREE.ConeGeometry(0.64, 1.85, 8));
    const bgCrownMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1b472b', roughness: 0.85 })
    );

    const bgTrees: Array<[number, number, number]> = [
      [-2.35, -2.55, 0.78],
      [-0.85, -3.15, 0.84],
      [1.05, -3.05, 0.74],
      [2.45, -2.4, 0.8],
    ];
    bgTrees.forEach(([tx, tz, sc]) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(bgTrunkGeo, bgTrunkMat);
      tr.position.y = 0.56 * sc;
      tr.scale.setScalar(sc);
      tr.castShadow = true;

      const cr = new THREE.Mesh(bgCrownGeo, bgCrownMat);
      cr.position.y = 1.65 * sc;
      cr.scale.setScalar(sc);
      cr.castShadow = true;

      g.add(tr, cr);
      g.position.set(tx, 0, tz);
      this.islandRoot.add(g);
    });

    // Cienie kontaktowe (z uwzględnieniem nowej pozycji tabliczki autorskiej i ESP32)
    const shadowTex = this.track(createContactShadowTexture());
    const shadowMat = this.track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    const addContactShadow = (x: number, z: number, r: number) => {
      const plane = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(r, r)),
        shadowMat
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(x, 0.032, z);
      this.islandRoot.add(plane);
    };
    addContactShadow(-3.35, 0.25, 1.2);
    addContactShadow(3.08, 0.28, 1.15);
    addContactShadow(-2.35, 0.95, 0.95);
  }

  /**
   * Punkt 3: Pionowe ścianki przekroju gleby w wyciętym klinie oraz warstwy 10 cm / 60 cm odsłonięte pod AR
   */
  private buildSoilCutaway(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const soilTex = this.track(createSoilCrossSectionTexture(maxAniso));
    const pitGroup = new THREE.Group();

    const halfCutRad = THREE.MathUtils.degToRad(40);
    const wallRadius = 4.28;
    const wallHeight = 1.56;
    const alphaLeft = Math.PI * 0.5 + halfCutRad;
    const alphaRight = Math.PI * 0.5 - halfCutRad;

    const wallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: soilTex,
        roughness: 0.88,
        metalness: 0.03,
        side: THREE.DoubleSide,
      })
    );
    const wallGeo = this.track(new THREE.PlaneGeometry(wallRadius, wallHeight));

    // Prawa pionowa ścianka przekroju (+40° od +Z)
    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(
      (wallRadius * 0.5) * Math.sin(halfCutRad),
      -wallHeight * 0.5,
      (wallRadius * 0.5) * Math.cos(halfCutRad)
    );
    rightWall.rotation.y = halfCutRad - Math.PI * 0.5;
    rightWall.receiveShadow = true;
    pitGroup.add(rightWall);

    // Lewa pionowa ścianka przekroju (-40° od +Z)
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(
      (wallRadius * 0.5) * Math.sin(-halfCutRad),
      -wallHeight * 0.5,
      (wallRadius * 0.5) * Math.cos(-halfCutRad)
    );
    leftWall.rotation.y = -halfCutRad - Math.PI * 0.5;
    leftWall.receiveShadow = true;
    pitGroup.add(leftWall);

    // Dno wyciętego sektora na głębokości -1.56m
    const makeWedgeShape = (r: number) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(r * Math.cos(alphaRight), r * Math.sin(alphaRight));
      s.absarc(0, 0, r, alphaRight, alphaLeft, false);
      s.lineTo(0, 0);
      return s;
    };

    const floorGeo = this.track(new THREE.ShapeGeometry(makeWedgeShape(wallRadius)));
    floorGeo.rotateX(Math.PI / 2);
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#241911',
        roughness: 0.96,
        side: THREE.DoubleSide,
      })
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -wallHeight;
    floorMesh.receiveShadow = true;
    pitGroup.add(floorMesh);

    // Półprzezroczyste klinowe płaszczyzny głębokości 10 cm (#06b6d4) i 60 cm (#3b82f6) w wycięciu
    const strataGeo = this.track(new THREE.ShapeGeometry(makeWedgeShape(2.45)));
    strataGeo.rotateX(Math.PI / 2);

    const layer10Mat = this.track(
      new THREE.MeshBasicMaterial({
        color: CHANNELS.wilgotnosc10.color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const layer60Mat = this.track(
      new THREE.MeshBasicMaterial({
        color: CHANNELS.wilgotnosc60.color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );

    const plane10 = new THREE.Mesh(strataGeo, layer10Mat);
    plane10.position.y = -0.28;
    plane10.renderOrder = 2;

    const plane60 = new THREE.Mesh(strataGeo, layer60Mat);
    plane60.position.y = -1.12;
    plane60.renderOrder = 2;

    pitGroup.add(plane10, plane60);

    // Świetliste linie brzegowe głębokości 10 cm i 60 cm na obu ściankach przekroju
    const addDepthEdgeLine = (yDepth: number, colorHex: string) => {
      const pts = [
        new THREE.Vector3(
          wallRadius * Math.sin(-halfCutRad),
          yDepth,
          wallRadius * Math.cos(-halfCutRad)
        ),
        new THREE.Vector3(0, yDepth, 0),
        new THREE.Vector3(
          wallRadius * Math.sin(halfCutRad),
          yDepth,
          wallRadius * Math.cos(halfCutRad)
        ),
      ];
      const lineGeo = this.track(new THREE.BufferGeometry().setFromPoints(pts));
      const lineMat = this.track(
        new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.72,
        })
      );
      pitGroup.add(new THREE.Line(lineGeo, lineMat));
    };
    addDepthEdgeLine(-0.28, CHANNELS.wilgotnosc10.color);
    addDepthEdgeLine(-1.12, CHANNELS.wilgotnosc60.color);

    this.islandRoot.add(pitGroup);
  }

  private buildSpruceTree(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.barkNormalTex = this.track(createBarkTexture(maxAniso, false));
    this.barkBeetleTex = this.track(createBarkTexture(maxAniso, true));

    const trunkProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.4, -0.15),
      new THREE.Vector2(0.31, 0.15),
      new THREE.Vector2(0.25, 0.8),
      new THREE.Vector2(0.22, 1.5),
      new THREE.Vector2(0.18, 2.8),
      new THREE.Vector2(0.13, 4.2),
      new THREE.Vector2(0.08, 5.4),
      new THREE.Vector2(0.025, 6.25),
      new THREE.Vector2(0.0, 6.35),
    ];
    const trunkGeo = this.track(new THREE.LatheGeometry(trunkProfile, 24));
    this.trunkMaterial = this.track(
      new THREE.MeshStandardMaterial({
        map: this.barkNormalTex,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    this.trunkMesh = new THREE.Mesh(trunkGeo, this.trunkMaterial);
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;
    this.islandRoot.add(this.trunkMesh);

    const rootMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#5a3d28',
        roughness: 0.85,
        metalness: 0.02,
      })
    );

    const rootPaths: Array<[number, number, number][][]> = [
      // Płytsze korzenie rozchodzące się głównie do odsłoniętego przekroju (+Z)
      [
        [
          [0.08, 0.04, 0.12],
          [0.34, -0.14, 0.48],
          [0.62, -0.28, 0.92],
          [0.88, -0.44, 1.38],
        ],
        [
          [-0.08, 0.04, 0.12],
          [-0.32, -0.16, 0.52],
          [-0.58, -0.32, 0.96],
          [-0.84, -0.48, 1.42],
        ],
        [
          [0.02, 0.02, 0.14],
          [0.08, -0.2, 0.62],
          [0.14, -0.42, 1.12],
          [0.2, -0.68, 1.56],
        ],
        [
          [-0.14, 0.02, 0.04],
          [-0.36, -0.24, 0.34],
          [-0.64, -0.46, 0.68],
          [-0.88, -0.68, 0.98],
        ],
      ],
      // Głębszy system palowy i korzenie na głębokości 60 cm
      [
        [
          [0.06, -0.06, 0.12],
          [0.2, -0.48, 0.46],
          [0.34, -0.96, 0.82],
          [0.48, -1.36, 1.15],
        ],
        [
          [-0.06, -0.06, 0.1],
          [-0.18, -0.52, 0.44],
          [-0.3, -1.04, 0.78],
          [-0.42, -1.4, 1.08],
        ],
        [
          [0.0, -0.08, 0.08],
          [0.02, -0.6, 0.28],
          [0.05, -1.14, 0.48],
          [0.08, -1.46, 0.68],
        ],
        [
          [0.12, -0.18, 0.14],
          [0.36, -0.64, 0.55],
          [0.54, -1.12, 0.92],
          [0.68, -1.38, 1.24],
        ],
        [
          [-0.04, -0.12, -0.04],
          [-0.1, -0.58, 0.12],
          [-0.14, -1.12, 0.36],
          [-0.18, -1.44, 0.54],
        ],
      ],
    ];

    rootPaths.forEach((groupPaths, groupIdx) => {
      groupPaths.forEach((pts) => {
        const curve = new THREE.CatmullRomCurve3(
          pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
        );
        const radius = groupIdx === 0 ? 0.052 : 0.042;
        const tubeGeo = this.track(new THREE.TubeGeometry(curve, 18, radius, 8, false));

        const pos = tubeGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i);
          const tApprox = Math.min(1, v.length() / 1.5);
          const centerOnCurve = curve.getPoint(Math.min(1, tApprox));
          v.sub(centerOnCurve).multiplyScalar(1 - tApprox * 0.72).add(centerOnCurve);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        tubeGeo.computeVertexNormals();

        const rootMesh = new THREE.Mesh(tubeGeo, rootMat);
        this.islandRoot.add(rootMesh);
      });
    });

    // Korona świerku (11 poziomów)
    const tierCount = 11;
    for (let i = 0; i < tierCount; i++) {
      const ratio = i / (tierCount - 1);
      const y = 1.95 + ratio * 4.35;
      const radius = THREE.MathUtils.lerp(1.52, 0.22, Math.pow(ratio, 0.85));
      const height = THREE.MathUtils.lerp(1.02, 0.56, ratio);

      const tierGroup = new THREE.Group();
      tierGroup.position.set(0, y, 0);

      const mainMat = this.track(
        new THREE.MeshStandardMaterial({
          color: '#1e5b34',
          roughness: 0.78,
          metalness: 0.02,
          flatShading: true,
        })
      );
      const outerMat = this.track(
        new THREE.MeshStandardMaterial({
          color: '#256c3f',
          roughness: 0.74,
          metalness: 0.02,
          flatShading: true,
        })
      );

      const cone = new THREE.Mesh(
        this.track(new THREE.ConeGeometry(radius, height, 9, 1)),
        mainMat
      );
      cone.castShadow = true;
      cone.receiveShadow = true;
      tierGroup.add(cone);

      const branchCount = Math.max(4, Math.round(THREE.MathUtils.lerp(8, 4, ratio)));
      for (let b = 0; b < branchCount; b++) {
        const ang = (b / branchCount) * Math.PI * 2 + i * 0.55;
        const bRadius = radius * 0.42;
        const bLen = radius * 0.6;
        const branch = new THREE.Mesh(
          this.track(new THREE.ConeGeometry(bRadius, bLen, 6)),
          outerMat
        );
        branch.position.set(
          Math.cos(ang) * radius * 0.62,
          -height * 0.28,
          Math.sin(ang) * radius * 0.62
        );
        branch.rotation.z = -Math.cos(ang) * 1.15;
        branch.rotation.x = Math.sin(ang) * 1.15;
        branch.castShadow = true;
        tierGroup.add(branch);
      }

      this.crownGroup.add(tierGroup);
      this.crownTiers.push({
        group: tierGroup,
        materials: [mainMat, outerMat],
        heightRatio: ratio,
        baseRotationY: i * 0.45,
      });
    }

    this.islandRoot.add(this.crownGroup);
  }

  private createChannelSensorMat(channelId: ChannelId, metalness = 0.48): THREE.MeshStandardMaterial {
    const color = CHANNELS[channelId].color;
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.22,
        roughness: 0.3,
        metalness,
      })
    );
    this.channelSensorMats[channelId].push(mat);
    return mat;
  }

  private buildTreeAndSoilSensors(): void {
    const steelMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        roughness: 0.24,
        metalness: 0.88,
      })
    );

    // 1. DENDROMETR (#f59e0b Złoty)
    const dendroMat = this.createChannelSensorMat('dendrometr', 0.68);
    const band = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.248, 0.02, 12, 36)),
      dendroMat
    );
    band.rotation.x = Math.PI / 2;
    this.dendrometerGroup.add(band);

    const housing = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.11, 0.14, 0.09)),
      dendroMat
    );
    housing.position.set(0.27, 0, 0.06);
    this.dendrometerGroup.add(housing);

    this.dendroPlunger = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10)),
      steelMat
    );
    this.dendroPlunger.rotation.z = Math.PI / 2;
    this.dendroPlunger.position.set(0.23, 0, 0.06);
    this.dendrometerGroup.add(this.dendroPlunger);

    this.dendroLedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34d399',
        emissive: '#10b981',
        emissiveIntensity: 1.4,
      })
    );
    const led = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.016, 10, 10)),
      this.dendroLedMat
    );
    led.position.set(0.33, 0.04, 0.08);
    this.dendrometerGroup.add(led);

    this.dendrometerGroup.position.set(0, 1.38, 0);
    this.tagInteractive(this.dendrometerGroup, 'dendrometr', 'sensor');
    this.islandRoot.add(this.dendrometerGroup);

    // 2. CZUJNIKI TEMPERATURY KORY Nr 1 i Nr 2 (#f97316 Pomarańczowy)
    const barkMat = this.createChannelSensorMat('tempKory', 0.42);
    const createBarkProbe = (angleRad: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.026, 0.026, 0.095, 14)),
        barkMat
      );
      body.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10)),
        steelMat
      );
      tip.rotation.z = Math.PI / 2;
      tip.position.x = -0.06;
      g.add(body, tip);

      const r = 0.265;
      g.position.set(Math.cos(angleRad) * r, 1.02, Math.sin(angleRad) * r);
      g.rotation.y = -angleRad;
      this.tagInteractive(g, 'tempKory', 'sensor');
      this.islandRoot.add(g);
    };

    createBarkProbe(Math.PI * 0.22); // Nr 1 (nasłoneczniona)
    createBarkProbe(Math.PI * 1.18); // Nr 2 (zacieniona)

    // 3. CZUJNIKI W GRUNCIE (wszystkie dobrze widoczne w wyciętym klinie przekroju!)
    const moist10Mat = this.createChannelSensorMat('wilgotnosc10', 0.45);
    const moist60Mat = this.createChannelSensorMat('wilgotnosc60', 0.45);
    const tempSoilMat = this.createChannelSensorMat('tempGleby', 0.45);

    const createSoilTempProbe = (
      x: number,
      y: number,
      z: number,
      mat: THREE.MeshStandardMaterial,
      channelId: ChannelId
    ) => {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 12)),
        mat
      );
      cap.rotation.z = Math.PI / 2;
      const rod = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 10)),
        steelMat
      );
      rod.rotation.z = Math.PI / 2;
      rod.position.x = -0.09;
      g.add(cap, rod);
      g.position.set(x, y, z);
      this.tagInteractive(g, channelId, 'sensor');
      this.islandRoot.add(g);
    };

    const createSoilMoistureFork = (
      x: number,
      y: number,
      z: number,
      mat: THREE.MeshStandardMaterial,
      channelId: ChannelId
    ) => {
      const g = new THREE.Group();
      const head = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.09, 0.06, 0.07)),
        mat
      );
      const prong1 = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8)),
        steelMat
      );
      prong1.rotation.z = Math.PI / 2;
      prong1.position.set(-0.09, 0, 0.017);
      const prong2 = prong1.clone();
      prong2.position.set(-0.09, 0, -0.017);
      g.add(head, prong1, prong2);
      g.position.set(x, y, z);
      this.tagInteractive(g, channelId, 'sensor');
      this.islandRoot.add(g);
    };

    // 10 cm w otwartym wycięciu przekrojowym
    createSoilMoistureFork(-0.34, -0.30, 0.98, moist10Mat, 'wilgotnosc10');
    createSoilTempProbe(0.42, -0.28, 0.92, tempSoilMat, 'tempGleby');

    // 60 cm w otwartym wycięciu przekrojowym
    createSoilMoistureFork(-0.26, -1.14, 0.92, moist60Mat, 'wilgotnosc60');
    createSoilTempProbe(0.44, -1.12, 0.86, tempSoilMat, 'tempGleby');
  }

  private buildMeteoStation5m(): void {
    const group = new THREE.Group();
    group.position.set(-3.35, 0, 0.25);

    const postMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.4, metalness: 0.75 })
    );
    const boxMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.28 })
    );

    const post = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.048, 0.058, 1.5, 14)),
      postMat
    );
    post.position.y = 0.75;
    post.castShadow = true;
    group.add(post);

    const housing = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.72, 0.68, 0.42)),
      boxMat
    );
    housing.position.y = 1.5;
    housing.castShadow = true;
    group.add(housing);

    // 3 osobne czujniki na stacji 5m z unikalnymi kolorami: Temp (#ef4444), Wilg (#10b981), Ciśnienie (#6366f1)
    const airTempMat = this.createChannelSensorMat('tempPowietrza', 0.35);
    const airHumMat = this.createChannelSensorMat('wilgotnoscPowietrza', 0.35);
    const pressureMat = this.createChannelSensorMat('cisnienie', 0.35);

    const nodes: Array<{ y: number; mat: THREE.MeshStandardMaterial; cid: ChannelId }> = [
      { y: 1.67, mat: airTempMat, cid: 'tempPowietrza' },
      { y: 1.50, mat: airHumMat, cid: 'wilgotnoscPowietrza' },
      { y: 1.33, mat: pressureMat, cid: 'cisnienie' },
    ];
    nodes.forEach((n) => {
      const node = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.056, 16, 16)),
        n.mat
      );
      node.position.set(0.18, n.y, 0.235);
      this.tagInteractive(node, n.cid, 'sensor');
      group.add(node);
    });

    const roof = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.86, 0.05, 0.54)),
      postMat
    );
    roof.position.y = 1.88;
    roof.castShadow = true;
    group.add(roof);

    this.islandRoot.add(group);

    // Linia dystansu 5m na gruncie
    const lineMat = this.track(
      new THREE.LineDashedMaterial({
        color: CHANNELS.wilgotnoscPowietrza.color,
        dashSize: 0.2,
        gapSize: 0.14,
        transparent: true,
        opacity: 0.65,
      })
    );
    const lineGeo = this.track(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-3.2, 0.04, 0.25),
        new THREE.Vector3(-1.45, 0.04, 0.25),
      ])
    );
    const distLine = new THREE.Line(lineGeo, lineMat);
    distLine.computeLineDistances();
    this.islandRoot.add(distLine);
  }

  /**
   * Punkt 1: Usunięcie fizycznej czarnej tablicy IMGW kolidującej z pierścieniem; zostaje sama skrzynka ESP32 odsunięta w bok
   */
  private buildEsp32AndImgw(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const espGroup = new THREE.Group();
    // Przesunięta lekko w bok (x=3.08, z=0.28) i nieco niżej, aby nie dotykała pierścienia 9 tablic
    espGroup.position.set(3.08, 0, 0.28);

    const poleMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.35, metalness: 0.8 })
    );
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42, metalness: 0.35 })
    );
    const faceplateTex = this.track(createEsp32FaceplateTexture(maxAniso));
    const faceplateMat = this.track(
      new THREE.MeshStandardMaterial({
        map: faceplateTex,
        roughness: 0.4,
        metalness: 0.15,
      })
    );

    const pole = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.052, 0.062, 1.4, 14)),
      poleMat
    );
    pole.position.y = 0.7;
    pole.castShadow = true;
    espGroup.add(pole);

    const box = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.06, 0.78, 0.38)),
      bodyMat
    );
    box.position.y = 1.48;
    box.castShadow = true;
    espGroup.add(box);

    const front = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.96, 0.68)),
      faceplateMat
    );
    front.position.set(0, 1.48, 0.195);
    espGroup.add(front);

    const antenna = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.015, 0.022, 0.42, 10)),
      poleMat
    );
    antenna.position.set(-0.38, 2.06, 0);
    espGroup.add(antenna);

    // Kompaktowy odbiornik telemetryczny IMGW (#a855f7) na szczycie masztu ESP32 (bez starej czarnej tablicy)
    const imgwSensorMat = this.createChannelSensorMat('imgw', 0.35);
    const imgwPod = new THREE.Group();
    const podBody = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 14)),
      imgwSensorMat
    );
    const podTip = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.048, 12, 12)),
      imgwSensorMat
    );
    podTip.position.y = 0.09;
    imgwPod.add(podBody, podTip);
    imgwPod.position.set(0.36, 1.94, 0);
    this.tagInteractive(imgwPod, 'imgw', 'sensor');
    espGroup.add(imgwPod);

    this.espLedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34d399',
        emissive: '#10b981',
        emissiveIntensity: 1.5,
      })
    );
    const led = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.024, 12, 12)),
      this.espLedMat
    );
    led.position.set(0.4, 1.78, 0.2);
    espGroup.add(led);

    this.islandRoot.add(espGroup);
  }

  private buildTelemetryWires(): void {
    const addCable = (
      points: [number, number, number][],
      channelId: ChannelId,
      radius = 0.015
    ) => {
      const colorHex = CHANNELS[channelId].color;
      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      );
      const geo = this.track(new THREE.TubeGeometry(curve, 28, radius, 7, false));
      const mat = this.track(
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.22,
          roughness: 0.35,
          metalness: 0.25,
        })
      );
      this.channelCableMats[channelId].push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      this.tagInteractive(mesh, channelId, 'cable');
      this.islandRoot.add(mesh);
    };

    // Przewody ze stacji 5m -> ESP32 (box lewa krawędź x=2.55, y~1.3..1.65, z=0.28)
    // 1. Temperatura powietrza (#ef4444)
    addCable(
      [
        [-3.15, 1.67, 0.48],
        [-1.4, 1.38, 0.62],
        [0.6, 1.36, 0.85],
        [2.55, 1.62, 0.32],
      ],
      'tempPowietrza'
    );
    // 2. Wilgotność powietrza (#10b981)
    addCable(
      [
        [-3.15, 1.50, 0.48],
        [-1.4, 1.24, 0.66],
        [0.6, 1.24, 0.88],
        [2.55, 1.48, 0.32],
      ],
      'wilgotnoscPowietrza'
    );
    // 3. Ciśnienie atmosferyczne (#6366f1)
    addCable(
      [
        [-3.15, 1.33, 0.48],
        [-1.4, 1.12, 0.70],
        [0.6, 1.14, 0.92],
        [2.55, 1.34, 0.32],
      ],
      'cisnienie'
    );

    // 4. Przewód z Dendrometru (#f59e0b Złoty) -> ESP32
    addCable(
      [
        [0.33, 1.38, 0.06],
        [1.25, 1.16, 0.22],
        [2.05, 1.32, 0.28],
        [2.55, 1.56, 0.24],
      ],
      'dendrometr',
      0.017
    );

    // 5. Przewody z czujników temperatury kory (#f97316 Pomarańczowy) -> ESP32
    addCable(
      [
        [0.23, 1.02, 0.17],
        [1.2, 0.88, 0.26],
        [2.05, 1.04, 0.28],
        [2.68, 1.10, 0.24],
      ],
      'tempKory'
    );
    addCable(
      [
        [-0.23, 1.02, -0.15],
        [0.25, 0.82, -0.35],
        [1.55, 0.86, -0.10],
        [2.78, 1.10, 0.18],
      ],
      'tempKory'
    );

    // 6. Wilgotność gleby 10 cm (#06b6d4 Cyjan) -> ESP32
    addCable(
      [
        [-0.30, -0.30, 0.98],
        [0.65, -0.04, 0.84],
        [1.85, 0.64, 0.46],
        [2.92, 1.10, 0.26],
      ],
      'wilgotnosc10'
    );

    // 7. Wilgotność gleby 60 cm (#3b82f6 Niebieski) -> ESP32
    addCable(
      [
        [-0.22, -1.14, 0.92],
        [0.72, -0.52, 0.78],
        [1.92, 0.56, 0.42],
        [3.04, 1.10, 0.28],
      ],
      'wilgotnosc60'
    );

    // 8. Temperatura gleby nr 3 (10 cm) i nr 4 (60 cm) (#d97706 Bursztynowy) -> ESP32
    addCable(
      [
        [0.46, -0.28, 0.92],
        [1.42, 0.06, 0.72],
        [2.25, 0.68, 0.42],
        [3.16, 1.10, 0.26],
      ],
      'tempGleby'
    );
    addCable(
      [
        [0.48, -1.12, 0.86],
        [1.48, -0.36, 0.68],
        [2.32, 0.62, 0.38],
        [3.26, 1.10, 0.24],
      ],
      'tempGleby'
    );

    // 9. Łączność z odbiornika IMGW (#a855f7 Fioletowy) -> korpus ESP32
    addCable(
      [
        [3.44, 1.88, 0.28],
        [3.52, 1.72, 0.34],
        [3.44, 1.56, 0.30],
      ],
      'imgw',
      0.015
    );
  }

  /**
   * Punkt 3: Tabliczka autorska przeniesiona na lewą, nienaruszoną część zielonego trawnika
   */
  private buildAuthorPlaque(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const plaqueTex = this.track(createAuthorPlaqueTexture(maxAniso));
    const group = new THREE.Group();
    group.position.set(-2.35, 0, 0.95);
    group.rotation.y = 0.44;

    const legMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.45, metalness: 0.7 })
    );
    const boardMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.5 })
    );
    const faceMat = this.track(
      new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.35, metalness: 0.15 })
    );

    [-0.48, 0.48].forEach((lx) => {
      const leg = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.024, 0.024, 0.68, 10)),
        legMat
      );
      leg.position.set(lx, 0.32, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    const board = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.26, 0.54, 0.05)),
      boardMat
    );
    board.position.set(0, 0.68, 0.03);
    board.rotation.x = -0.32;
    board.castShadow = true;

    const face = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1.22, 0.5)),
      faceMat
    );
    face.position.set(0, 0, 0.028);
    board.add(face);

    group.add(board);
    this.islandRoot.add(group);
  }

  private buildBioEffects(): void {
    const needleCount = 160;
    const needleGeo = this.track(new THREE.BoxGeometry(0.015, 0.09, 0.015));
    const needleMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#8c6239', roughness: 0.85 })
    );
    this.fallingNeedlesMesh = new THREE.InstancedMesh(needleGeo, needleMat, needleCount);
    this.fallingNeedlesMesh.frustumCulled = false;
    this.fallingNeedlesMesh.visible = false;

    for (let i = 0; i < needleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 0.25 + Math.random() * 1.25;
      this.needleParticles.push({
        x: Math.cos(angle) * rad,
        y: 1.8 + Math.random() * 4.2,
        z: Math.sin(angle) * rad,
        vy: 0.45 + Math.random() * 0.75,
        vx: (Math.random() - 0.5) * 0.25,
        vz: (Math.random() - 0.5) * 0.25,
        rotSpeed: (Math.random() - 0.5) * 4,
        angle: Math.random() * Math.PI * 2,
      });
    }
    this.islandRoot.add(this.fallingNeedlesMesh);

    const beetleCount = 46;
    const beetleGeo = this.track(new THREE.CapsuleGeometry(0.018, 0.028, 4, 6));
    const beetleMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#1b110d',
        roughness: 0.35,
        metalness: 0.2,
      })
    );
    this.beetlesMesh = new THREE.InstancedMesh(beetleGeo, beetleMat, beetleCount);
    this.beetlesMesh.frustumCulled = false;
    this.beetlesMesh.visible = false;

    for (let i = 0; i < beetleCount; i++) {
      this.beetleAgents.push({
        y: 0.2 + Math.random() * 2.5,
        theta: Math.random() * Math.PI * 2,
        speedY: (Math.random() > 0.3 ? 1 : -1) * (0.12 + Math.random() * 0.22),
        speedTheta: (Math.random() - 0.5) * 0.9,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.islandRoot.add(this.beetlesMesh);

    const sawdustCount = 90;
    const dustGeo = this.track(new THREE.DodecahedronGeometry(0.016, 0));
    const dustMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#d4a36a', roughness: 0.95 })
    );
    this.sawdustMesh = new THREE.InstancedMesh(dustGeo, dustMat, sawdustCount);
    this.sawdustMesh.frustumCulled = false;
    this.sawdustMesh.visible = false;

    for (let i = 0; i < sawdustCount; i++) {
      const a = Math.random() * Math.PI * 2;
      this.sawdustParticles.push({
        x: Math.cos(a) * 0.28,
        y: 0.2 + Math.random() * 2.1,
        z: Math.sin(a) * 0.28,
        vy: 0.35 + Math.random() * 0.5,
        life: Math.random(),
      });
    }
    this.islandRoot.add(this.sawdustMesh);
  }

  /**
   * Punkt 2: Lewitujący pierścień 10 półprzezroczystych tablic telemetrycznych 3D (9 kanałów + 10. tablica statusowa)
   */
  private buildFloatingTelemetryRing(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const ringRadius = 4.62;
    const boardY = 3.55;

    this.islandRoot.add(this.boardsRingGroup);

    // 10 tablic rozmieszczonych co 36° na promieniu 4.62m bez stykania, z otwartym frontem
    const anglesDeg: Record<ChannelId, number> = {
      dendrometr: 18,
      wilgotnosc10: 54,
      wilgotnosc60: 90,
      tempGleby: 126,
      tempKory: 162,
      tempPowietrza: 198,
      wilgotnoscPowietrza: 234,
      cisnienie: 270,
      imgw: 306,
    };

    const boardGeo = this.track(new THREE.PlaneGeometry(1.56, 1.04));
    const backingGeo = this.track(new THREE.BoxGeometry(1.6, 1.08, 0.03));

    CHANNEL_ORDER.forEach((channelId) => {
      const rad = THREE.MathUtils.degToRad(anglesDeg[channelId]);
      const bx = Math.sin(rad) * ringRadius;
      const bz = Math.cos(rad) * ringRadius;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 336;
      drawTelemetryBoardCanvas(
        canvas,
        channelId,
        this.telemetryRef,
        this.soilControlsRef,
        false
      );

      const texture = this.track(new THREE.CanvasTexture(canvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.max(1, maxAniso);

      const group = new THREE.Group();
      group.position.set(bx, boardY, bz);

      const lookOutTarget = new THREE.Vector3(bx * 2.1, boardY - 0.35, bz * 2.1);
      group.lookAt(lookOutTarget);

      const frameMat = this.track(
        new THREE.MeshStandardMaterial({
          color: CHANNELS[channelId].color,
          emissive: CHANNELS[channelId].color,
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.22,
          roughness: 0.2,
          metalness: 0.6,
        })
      );

      const backing = new THREE.Mesh(backingGeo, frameMat);
      backing.position.z = -0.02;

      const faceMat = this.track(
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.96,
          side: THREE.DoubleSide,
        })
      );
      const face = new THREE.Mesh(boardGeo, faceMat);

      group.add(backing, face);
      this.tagInteractive(group, channelId, 'board');
      this.boardsRingGroup.add(group);

      const worldPos = new THREE.Vector3(bx, boardY, bz);
      const normalDir = new THREE.Vector3(bx, 0, bz).normalize();

      this.boards[channelId] = {
        channelId,
        group,
        canvas,
        texture,
        frameMat,
        worldPos,
        normalDir,
      };
    });

    // 10. Tablica statusowa: Dzień/Godzina, Stan zdrowia drzewa i odliczanie do ataku kornika (342°)
    const statusRad = THREE.MathUtils.degToRad(342);
    const sbx = Math.sin(statusRad) * ringRadius;
    const sbz = Math.cos(statusRad) * ringRadius;

    const statusCanvas = document.createElement('canvas');
    statusCanvas.width = 512;
    statusCanvas.height = 336;
    drawStatusBoardCanvas(statusCanvas, this.telemetryRef);

    const statusTexture = this.track(new THREE.CanvasTexture(statusCanvas));
    statusTexture.colorSpace = THREE.SRGBColorSpace;
    statusTexture.anisotropy = Math.max(1, maxAniso);

    const statusGroup = new THREE.Group();
    statusGroup.position.set(sbx, boardY, sbz);
    statusGroup.lookAt(new THREE.Vector3(sbx * 2.1, boardY - 0.35, sbz * 2.1));

    const statusFrameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#10b981',
        emissive: '#f59e0b',
        emissiveIntensity: 0.32,
        transparent: true,
        opacity: 0.32,
        roughness: 0.2,
        metalness: 0.65,
      })
    );

    const statusBacking = new THREE.Mesh(backingGeo, statusFrameMat);
    statusBacking.position.z = -0.02;

    const statusFaceMat = this.track(
      new THREE.MeshBasicMaterial({
        map: statusTexture,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
      })
    );
    const statusFace = new THREE.Mesh(boardGeo, statusFaceMat);
    statusGroup.add(statusBacking, statusFace);
    this.boardsRingGroup.add(statusGroup);

    this.statusBoard = {
      group: statusGroup,
      canvas: statusCanvas,
      texture: statusTexture,
      frameMat: statusFrameMat,
      worldPos: new THREE.Vector3(sbx, boardY, sbz),
    };
  }

  public setBoardsVisible(visible: boolean): void {
    this.boardsVisibleTarget = visible;
  }

  public setTelemetry(state: TelemetryState): void {
    this.telemetryRef = state;
  }

  public setSoilControls(soil: SoilControls): void {
    this.soilControlsRef = soil;
    this.forceBoardsRefresh = true;
  }

  public setSelectedChannel(channelId: ChannelId | null): void {
    this.selectedChannel = channelId;
    this.forceBoardsRefresh = true;
  }

  public focusBoard(channelId: ChannelId): void {
    if (this.viewMode === 'ar') return;
    const entry = this.boards[channelId];
    if (!entry) return;

    const camDist = 2.35;
    this.targetOrbit.copy(entry.worldPos);
    this.targetCamPos
      .copy(entry.worldPos)
      .addScaledVector(entry.normalDir, camDist);
    this.targetCamPos.y = entry.worldPos.y + 0.12;
    this.cameraAnimating = true;
  }

  public focusPreset(presetId: CameraPresetId): void {
    if (this.viewMode === 'ar') return;
    const p = CAMERA_PRESETS[presetId];
    this.targetCamPos.set(...p.position);
    this.targetOrbit.set(...p.target);
    this.cameraAnimating = true;
  }

  public setArLocked(locked: boolean): boolean {
    if (this.viewMode !== 'ar') return false;
    if (locked) {
      if (!this.arSmoothedGroup.visible && !this.arWasMarkerVisible) {
        return false;
      }
      this.arLocked = true;
      this.arSmoothedGroup.visible = true;
      this.onArStatusChange?.(
        'locked',
        'Zablokowano na stole — przesuwaj palcem poziomo, aby obracać świerk'
      );
      return true;
    } else {
      this.arLocked = false;
      this.onArStatusChange?.(
        this.arWasMarkerVisible ? 'tracking' : 'searching',
        this.arWasMarkerVisible
          ? 'Znacznik HIRO wykryty — przesuwaj palcem, aby obracać świerk'
          : 'Skieruj kamerę na czarny znacznik HIRO'
      );
      return false;
    }
  }

  /**
   * Przełączanie trybu [3D] <-> [AR] (znacznik HIRO, tylna kamera environment, pełny ekran i reset dotyku)
   */
  public async setViewMode(mode: ViewMode): Promise<void> {
    if (this.viewMode === mode) return;
    this.viewMode = mode;

    if (mode === 'ar') {
      this.savedCamPos.copy(this.camera.position);
      this.savedOrbitTarget.copy(this.controls.target);

      this.cameraAnimating = false;
      this.isArDragging = false;
      this.arDragDistance = 0;
      this.controls.enabled = false;

      // Kamera musi stać w punkcie (0,0,0) przy macierzy jednostkowej dla AR.js modelViewMatrix
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      this.camera.position.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.camera.scale.set(1, 1, 1);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);

      this.scene.background = null;
      this.scene.fog = null;
      this.renderer.setClearAlpha(0);

      const canvas = this.renderer.domElement;
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.margin = '0';
      canvas.style.objectFit = 'cover';
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      this.renderer.setSize(w, h, false);

      this.arLocked = false;
      this.arTargetYaw = 0;
      this.arCurrentYaw = 0;

      // Osadzenie całej bryły przekroju na znaczniku Y = 0, aby spód ziemi leżał na stole
      this.arSmoothedGroup.add(this.islandRoot);
      this.arSmoothedGroup.position.set(0, 0, 0);
      this.arSmoothedGroup.quaternion.identity();
      this.arSmoothedGroup.scale.set(1, 1, 1);
      this.islandRoot.position.set(0, 0.24, 0);
      this.islandRoot.rotation.set(0, 0, 0);
      this.islandRoot.scale.setScalar(0.155);
      this.arSmoothedGroup.visible = false;
      this.arRawMarkerGroup.visible = false;

      this.initArTracking();
    } else {
      this.teardownArTracking();
      this.arLocked = false;
      this.arTargetYaw = 0;
      this.arCurrentYaw = 0;
      this.isArDragging = false;
      this.arDragDistance = 0;
      this.cameraAnimating = false;

      // Przywróć grupę główną drzewa i scenę 3D
      this.scene.add(this.islandRoot);
      this.islandRoot.position.set(0, 0, 0);
      this.islandRoot.rotation.set(0, 0, 0);
      this.islandRoot.scale.set(1, 1, 1);
      this.islandRoot.visible = true;

      this.scene.background = this.skyBgColor;
      this.scene.fog = this.fog;
      this.renderer.setClearAlpha(1);

      const canvas = this.renderer.domElement;
      canvas.style.position = 'static';
      canvas.style.inset = 'auto';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.margin = '0';
      canvas.style.objectFit = '';
      canvas.style.pointerEvents = 'auto';
      // OrbitControls wymaga touch-action: none, aby przeglądarka nie przejmowała gestów palców
      canvas.style.touchAction = 'none';

      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      this.renderer.setSize(w, h);
      this.camera.position.set(...CAMERA_PRESETS.overview.position);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      this.controls.enabled = true;
      this.controls.target.set(0, 1.5, 0);
      this.controls.update();
    }
  }

  private handleVideoMetadata = (): void => {
    this.syncArResize();
  };

  private initArTracking(): void {
    this.teardownArTracking();
    this.arReady = false;
    this.arWasMarkerVisible = false;
    this.onArStatusChange?.('initializing', 'Uruchamianie tylnej kamery telefonu...');

    const sourceWidth = 640;
    const sourceHeight = 480;

    const arSource = new THREEx.ArToolkitSource({
      sourceType: 'webcam',
      sourceWidth,
      sourceHeight,
    });
    this.arToolkitSource = arSource;

    const onCameraInit = (e: Event) => {
      const detail = (e as CustomEvent<{ stream: MediaStream }>).detail;
      if (detail?.stream) {
        if (this.viewMode !== 'ar' || this.disposed) {
          detail.stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.arMediaStream = detail.stream;
      }
    };
    window.addEventListener('camera-init', onCameraInit, { once: true });

    arSource.init(
      () => {
        if (this.viewMode !== 'ar' || this.disposed) {
          this.teardownArTracking();
          return;
        }

        const videoEl = arSource.domElement as HTMLVideoElement;
        if (videoEl) {
          videoEl.style.position = 'fixed';
          videoEl.style.inset = '0';
          videoEl.style.width = '100vw';
          videoEl.style.height = '100vh';
          videoEl.style.maxWidth = 'none';
          videoEl.style.maxHeight = 'none';
          videoEl.style.margin = '0';
          videoEl.style.objectFit = 'cover';
          videoEl.style.zIndex = '1';
          videoEl.style.pointerEvents = 'none';
          videoEl.style.display = 'block';
          videoEl.setAttribute('playsinline', 'true');
          videoEl.addEventListener('loadedmetadata', this.handleVideoMetadata, {
            once: true,
          });
        }

        const arContext = new THREEx.ArToolkitContext({
          cameraParametersUrl: '/ar/camera_para.dat',
          detectionMode: 'mono',
        });
        this.arToolkitContext = arContext;

        arContext.init(() => {
          if (this.viewMode !== 'ar' || this.disposed) return;
          this.arReady = true;
          this.onArStatusChange?.('searching', 'Skieruj kamerę na czarny znacznik HIRO');
          this.syncArResize();
        });

        this.arMarkerControls = new THREEx.ArMarkerControls(
          arContext,
          this.arRawMarkerGroup,
          {
            type: 'pattern',
            patternUrl: '/ar/patt.hiro',
            changeMatrixMode: 'modelViewMatrix',
            smooth: true,
            smoothCount: 5,
            smoothTolerance: 0.01,
            smoothThreshold: 2,
          }
        );

        // Wygładzanie LERP pozycji i orientacji na znaczniku HIRO
        this.arSmoothedControls = new THREEx.ArSmoothedControls(
          this.arSmoothedGroup,
          {
            lerpPosition: 0.45,
            lerpQuaternion: 0.32,
            lerpScale: 0.5,
            lerpStepDelay: 1 / 60,
            minVisibleDelay: 0.0,
            minUnvisibleDelay: 0.35,
          }
        );

        this.syncArResize();
        setTimeout(() => this.syncArResize(), 300);
      },
      (err: { name?: string; message?: string }) => {
        this.onArStatusChange?.(
          'error',
          err?.message ||
            'Brak dostępu do kamery. Zezwól na dostęp do aparatu lub przetestuj na urządzeniu z kamerą.'
        );
      }
    );
  }

  private syncArResize(): void {
    if (this.viewMode !== 'ar') {
      return;
    }
    try {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);

      const videoEl =
        (this.arToolkitSource?.domElement as HTMLVideoElement | undefined) ||
        (document.getElementById('arjs-video') as HTMLVideoElement | null);
      if (videoEl) {
        videoEl.style.position = 'fixed';
        videoEl.style.inset = '0';
        videoEl.style.width = '100vw';
        videoEl.style.height = '100vh';
        videoEl.style.maxWidth = 'none';
        videoEl.style.maxHeight = 'none';
        videoEl.style.margin = '0';
        videoEl.style.objectFit = 'cover';
        videoEl.style.zIndex = '1';
        videoEl.style.pointerEvents = 'none';
        videoEl.style.display = 'block';
      }

      const canvas = this.renderer.domElement;
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.margin = '0';
      canvas.style.objectFit = 'cover';
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';

      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;

      if (this.arToolkitContext?.arController) {
        this.camera.projectionMatrix.copy(
          this.arToolkitContext.getProjectionMatrix()
        );
        const videoAspect =
          videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0
            ? videoEl.videoWidth / videoEl.videoHeight
            : 4 / 3;
        const screenAspect = w / h;
        // Dopasowanie ogniskowej do object-fit: cover na ekranie pionowym i poziomym
        if (screenAspect < videoAspect) {
          this.camera.projectionMatrix.elements[0] *= videoAspect / screenAspect;
        } else if (screenAspect > videoAspect) {
          this.camera.projectionMatrix.elements[5] *= screenAspect / videoAspect;
        }
      } else {
        this.camera.updateProjectionMatrix();
      }
    } catch {
      // ignore if video metadata not yet ready
    }
  }

  private teardownArTracking(): void {
    this.arReady = false;
    this.arWasMarkerVisible = false;

    if (this.arMediaStream) {
      this.arMediaStream.getTracks().forEach((track) => track.stop());
      this.arMediaStream = null;
    }

    const videos = new Set<HTMLVideoElement>();
    const byId = document.getElementById('arjs-video') as HTMLVideoElement | null;
    if (byId) videos.add(byId);
    if (this.arToolkitSource?.domElement instanceof HTMLVideoElement) {
      videos.add(this.arToolkitSource.domElement);
    }
    document.querySelectorAll('video').forEach((v) => videos.add(v));

    videos.forEach((videoEl) => {
      videoEl.removeEventListener('loadedmetadata', this.handleVideoMetadata);
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      videoEl.pause();
      videoEl.srcObject = null;
      videoEl.style.pointerEvents = 'none';
      videoEl.style.display = 'none';
      videoEl.remove();
    });

    const errorPopup = document.getElementById('error-popup');
    errorPopup?.remove();

    if (this.arMarkerControls) {
      try {
        this.arMarkerControls.dispose();
      } catch {
        // ignore
      }
      this.arMarkerControls = null;
    }

    this.arToolkitContext = null;
    this.arToolkitSource = null;
    this.arSmoothedControls = null;
    this.arRawMarkerGroup.visible = false;
    this.arSmoothedGroup.visible = false;
    this.onArStatusChange?.('idle');
  }

  private applyTelemetryVisuals(state: TelemetryState, dt: number): void {
    const elapsed = this.clock.elapsedTime;

    // 1. Cykl dnia i nocy
    const dayBlend = THREE.MathUtils.clamp((state.sunElevation + 0.18) / 0.65, 0, 1);

    const nightSky = _colorA.set('#0b1322');
    const dawnSky = _colorB.set('#d98a5f');
    const noonSky = new THREE.Color('#6ca8de');

    if (state.sunElevation > 0 && state.sunElevation < 0.32) {
      const goldenT = state.sunElevation / 0.32;
      this.skyBgColor.copy(nightSky).lerp(dawnSky, 0.6).lerp(noonSky, goldenT * 0.75);
    } else if (state.sunElevation >= 0.32) {
      this.skyBgColor
        .copy(dawnSky)
        .lerp(noonSky, Math.min(1, (state.sunElevation - 0.15) / 0.5));
    } else {
      this.skyBgColor.copy(nightSky);
    }

    if (this.viewMode === '3d') {
      this.scene.background = this.skyBgColor;
      this.fog.color.copy(this.skyBgColor);
    }

    const sunDist = 18;
    const sunElevAngle = Math.max(-0.25, state.sunElevation) * (Math.PI * 0.42);
    const sunX =
      Math.cos(state.sunAzimuthRad) * Math.cos(sunElevAngle) * sunDist * 0.75 + 4;
    const sunY = Math.sin(sunElevAngle) * sunDist + 1.5;
    const sunZ =
      Math.sin(state.sunAzimuthRad * 0.5 + 0.85) *
      Math.cos(sunElevAngle) *
      sunDist *
      0.65;

    this.sunLight.position.set(sunX, Math.max(2.5, sunY), sunZ);
    this.sunOrb.position.set(sunX * 2.2, Math.max(-4, sunY * 2.2), sunZ * 2.2);
    this.sunOrb.visible = this.viewMode === '3d' && state.sunElevation > -0.15;

    const sunWarmColor = _colorA.set('#ffaa66').lerp(_colorB.set('#fff5e4'), dayBlend);
    this.sunLight.color.copy(sunWarmColor);
    this.sunLight.intensity =
      state.sunElevation > -0.05 ? 0.65 + dayBlend * 1.65 : 0.4;
    this.hemiLight.intensity = 0.36 + dayBlend * 0.52;
    this.fillLight.intensity = 0.28 + dayBlend * 0.35;

    // 2. Praca dendrometru i oddychanie pnia
    const trunkRadialScale = 1 + state.trunkScaleDelta;
    this.trunkMesh.scale.set(trunkRadialScale, 1, trunkRadialScale);
    const bandScale = 1 + state.trunkScaleDelta * 1.1;
    this.dendrometerGroup.scale.set(bandScale, 1, bandScale);
    this.dendroPlunger.position.x = 0.215 + state.trunkScaleDelta * 1.6;
    this.dendroLedMat.emissive.set(
      state.treeState === 'DOBRY'
        ? '#10b981'
        : state.treeState === 'ZŁY'
          ? '#f59e0b'
          : '#ef4444'
    );

    // 3. Kolorowanie korony wg zdrowia drzewa (od wierzchołka w dół)
    const healthNorm = state.health / 100;
    const healthyInner = _colorA.set('#1a5632');
    const healthyOuter = _colorB.set('#277443');
    const stressedYellow = new THREE.Color('#a38c34');
    const dyingBrown = new THREE.Color('#744729');
    const deadGrey = new THREE.Color('#5b4c42');

    const windSway = Math.sin(elapsed * 1.15) * 0.018;

    this.crownTiers.forEach((tier) => {
      const damageProgress = THREE.MathUtils.clamp(
        (1 - healthNorm) * 1.35 + tier.heightRatio * 0.25 * (1 - healthNorm),
        0,
        1
      );

      tier.materials.forEach((mat, matIdx) => {
        const baseGreen = matIdx === 0 ? healthyInner : healthyOuter;
        if (damageProgress < 0.45) {
          const t = damageProgress / 0.45;
          mat.color.copy(baseGreen).lerp(stressedYellow, t);
        } else if (damageProgress < 0.78) {
          const t = (damageProgress - 0.45) / 0.33;
          mat.color.copy(stressedYellow).lerp(dyingBrown, t);
        } else {
          const t = (damageProgress - 0.78) / 0.22;
          mat.color.copy(dyingBrown).lerp(deadGrey, t);
        }
      });

      tier.group.rotation.z = windSway * (0.4 + tier.heightRatio * 0.9);
      tier.group.rotation.y =
        tier.baseRotationY + Math.cos(elapsed * 0.8 + tier.heightRatio) * 0.012;
    });

    // 4. Tekstura pnia i dioda ESP32
    const targetBark = state.beetleInfestation
      ? this.barkBeetleTex
      : this.barkNormalTex;
    if (this.trunkMaterial.map !== targetBark) {
      this.trunkMaterial.map = targetBark;
      this.trunkMaterial.needsUpdate = true;
    }

    this.espLedMat.emissive.set(
      state.beetleInfestation || state.treeState === 'FATALNY'
        ? Math.sin(elapsed * 6) > 0
          ? '#ef4444'
          : '#7f1d1d'
        : '#10b981'
    );

    // 5. Pierścień 10 lewitujących tablic telemetrycznych (9 kanałów + 10. tablica statusowa)
    const shouldRefreshBoards =
      this.forceBoardsRefresh || elapsed - this.lastBoardRenderTime >= 0.5;
    if (shouldRefreshBoards) {
      this.lastBoardRenderTime = elapsed;
      this.forceBoardsRefresh = false;
      CHANNEL_ORDER.forEach((cid) => {
        const entry = this.boards[cid];
        if (!entry) return;
        const isSel = this.selectedChannel === cid;
        drawTelemetryBoardCanvas(
          entry.canvas,
          cid,
          state,
          this.soilControlsRef,
          isSel
        );
        entry.texture.needsUpdate = true;
      });
      if (this.statusBoard) {
        drawStatusBoardCanvas(this.statusBoard.canvas, state);
        this.statusBoard.texture.needsUpdate = true;
      }
    }

    // Płynne chowanie / odsłanianie całego pierścienia tablic
    this.boardsRingScale = THREE.MathUtils.damp(
      this.boardsRingScale,
      this.boardsVisibleTarget ? 1 : 0.001,
      12,
      dt || 0.016
    );
    this.boardsRingGroup.scale.setScalar(this.boardsRingScale);
    this.boardsRingGroup.visible = this.boardsRingScale > 0.025;

    // Pulsowanie i rozjaśnianie kabli, czujników oraz obramowania wybranej tablicy
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.5);
    CHANNEL_ORDER.forEach((cid, idx) => {
      const isSel = this.selectedChannel === cid;
      const entry = this.boards[cid];
      if (entry) {
        entry.group.position.y =
          entry.worldPos.y + Math.sin(elapsed * 1.4 + idx * 0.9) * 0.045;
        entry.frameMat.emissiveIntensity = isSel ? 0.95 + pulse * 0.9 : 0.25;
        entry.frameMat.opacity = isSel ? 0.55 : 0.2;
      }

      this.channelCableMats[cid].forEach((m) => {
        m.emissiveIntensity = isSel ? 1.15 + pulse * 1.35 : 0.2;
      });
      this.channelSensorMats[cid].forEach((m) => {
        m.emissiveIntensity = isSel ? 1.1 + pulse * 1.1 : 0.22;
      });
    });

    if (this.statusBoard) {
      this.statusBoard.group.position.y =
        this.statusBoard.worldPos.y + Math.sin(elapsed * 1.4 + 9 * 0.9) * 0.045;
      this.statusBoard.frameMat.emissiveIntensity =
        state.beetleInfestation || state.treeState === 'FATALNY'
          ? 0.55 + pulse * 0.5
          : 0.32;
    }

    // 7. Opadanie igieł
    const showNeedles = state.treeState === 'FATALNY' || state.health < 45;
    this.fallingNeedlesMesh.visible = showNeedles;
    if (showNeedles) {
      const count =
        state.treeState === 'FATALNY'
          ? this.needleParticles.length
          : Math.floor(this.needleParticles.length * 0.3);
      for (let i = 0; i < this.needleParticles.length; i++) {
        const p = this.needleParticles[i];
        if (i >= count) {
          _scale.setScalar(0);
          _mat4.compose(_vec3.set(0, -10, 0), _quat, _scale);
          this.fallingNeedlesMesh.setMatrixAt(i, _mat4);
          continue;
        }
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(elapsed + i) * 0.15) * dt;
        p.z += p.vz * dt;
        p.angle += p.rotSpeed * dt;
        if (p.y < 0.04) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 0.25 + Math.random() * 1.25;
          p.x = Math.cos(ang) * rad;
          p.y = 2.4 + Math.random() * 3.6;
          p.z = Math.sin(ang) * rad;
        }
        _vec3.set(p.x, p.y, p.z);
        _quat.setFromEuler(_euler.set(p.angle, p.angle * 0.7, p.angle * 0.5));
        _scale.setScalar(1);
        _mat4.compose(_vec3, _quat, _scale);
        this.fallingNeedlesMesh.setMatrixAt(i, _mat4);
      }
      this.fallingNeedlesMesh.instanceMatrix.needsUpdate = true;
    }

    // 8. Kornik drukarz + trociny
    this.beetlesMesh.visible = state.beetleInfestation;
    this.sawdustMesh.visible = state.beetleInfestation;

    if (state.beetleInfestation) {
      for (let i = 0; i < this.beetleAgents.length; i++) {
        const b = this.beetleAgents[i];
        b.y += b.speedY * dt;
        b.theta += b.speedTheta * dt;
        if (b.y > 2.8) b.y = 0.2;
        if (b.y < 0.2) b.y = 2.8;

        const r =
          THREE.MathUtils.lerp(0.3, 0.18, b.y / 2.8) * trunkRadialScale + 0.01;
        _vec3.set(Math.cos(b.theta) * r, b.y, Math.sin(b.theta) * r);
        _quat.setFromEuler(
          _euler.set(
            Math.sin(elapsed * 8 + b.phase) * 0.15,
            -b.theta,
            b.speedY > 0 ? 0.2 : Math.PI - 0.2
          )
        );
        _scale.setScalar(1);
        _mat4.compose(_vec3, _quat, _scale);
        this.beetlesMesh.setMatrixAt(i, _mat4);
      }
      this.beetlesMesh.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < this.sawdustParticles.length; i++) {
        const s = this.sawdustParticles[i];
        s.y -= s.vy * dt;
        if (s.y < 0.03) {
          const a = Math.random() * Math.PI * 2;
          const h = 0.35 + Math.random() * 2.1;
          const r = THREE.MathUtils.lerp(0.3, 0.19, h / 2.8) + 0.025;
          s.x = Math.cos(a) * r;
          s.y = h;
          s.z = Math.sin(a) * r;
        }
        _vec3.set(s.x, s.y, s.z);
        _quat.identity();
        _scale.setScalar(0.8 + (i % 3) * 0.25);
        _mat4.compose(_vec3, _quat, _scale);
        this.sawdustMesh.setMatrixAt(i, _mat4);
      }
      this.sawdustMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.renderer.domElement.addEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handlePointerDown = (ev: PointerEvent): void => {
    if (this.viewMode !== 'ar') return;
    this.isArDragging = true;
    this.arDragLastX = ev.clientX;
    this.arDragDistance = 0;
  };

  private handlePointerMove = (ev: PointerEvent): void => {
    if (this.viewMode !== 'ar' || !this.isArDragging) return;
    const dx = ev.clientX - this.arDragLastX;
    this.arDragLastX = ev.clientX;
    this.arDragDistance += Math.abs(dx);
    this.arTargetYaw += dx * 0.011;
  };

  private handlePointerUp = (): void => {
    this.isArDragging = false;
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    if (this.viewMode === 'ar') {
      this.syncArResize();
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleCanvasClick = (ev: MouseEvent): void => {
    if (this.viewMode === 'ar' && this.arDragDistance > 6) {
      this.arDragDistance = 0;
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      _vec3b.set(mx, my, 0) as unknown as THREE.Vector2,
      this.camera
    );

    const hits = raycaster.intersectObjects(this.islandRoot.children, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      let insideHiddenRing = false;
      let checkObj: THREE.Object3D | null = obj;
      while (checkObj) {
        if (checkObj === this.boardsRingGroup && !this.boardsVisibleTarget) {
          insideHiddenRing = true;
          break;
        }
        checkObj = checkObj.parent;
      }
      if (insideHiddenRing) continue;

      while (obj) {
        if (obj.userData.channelId) {
          const cid = obj.userData.channelId as ChannelId;
          const kind = obj.userData.kind as 'board' | 'sensor' | 'cable';
          this.setSelectedChannel(cid);
          this.onSelectChannel?.(cid);

          // Kliknięcie bezpośrednio w kabel lub czujnik ustawia kamerę przed tablicą!
          if (kind === 'cable' || kind === 'sensor') {
            this.focusBoard(cid);
          }
          return;
        }
        obj = obj.parent;
      }
    }

    this.setSelectedChannel(null);
    this.onSelectChannel?.(null);
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(0.1, this.clock.getDelta());

      if (this.viewMode === 'ar') {
        this.arCurrentYaw = THREE.MathUtils.damp(
          this.arCurrentYaw,
          this.arTargetYaw,
          11,
          dt || 0.016
        );
        this.islandRoot.rotation.y = this.arCurrentYaw;

        if (
          this.arReady &&
          this.arToolkitContext &&
          this.arToolkitSource?.ready
        ) {
          if (!this.arLocked) {
            this.arToolkitContext.update(this.arToolkitSource.domElement);
            if (this.arSmoothedControls) {
              this.arSmoothedControls.update(this.arRawMarkerGroup);
              const visibleNow = Boolean(this.arSmoothedGroup.visible);
              if (visibleNow !== this.arWasMarkerVisible) {
                this.arWasMarkerVisible = visibleNow;
                this.onArStatusChange?.(
                  visibleNow ? 'tracking' : 'searching',
                  visibleNow
                    ? 'Znacznik HIRO wykryty — przesuwaj palcem, aby obracać świerk'
                    : 'Skieruj kamerę na czarny znacznik HIRO'
                );
              }
            }
          } else {
            this.arSmoothedGroup.visible = true;
          }
        }
      } else {
        if (this.cameraAnimating) {
          this.camera.position.x = THREE.MathUtils.damp(
            this.camera.position.x,
            this.targetCamPos.x,
            5.5,
            dt
          );
          this.camera.position.y = THREE.MathUtils.damp(
            this.camera.position.y,
            this.targetCamPos.y,
            5.5,
            dt
          );
          this.camera.position.z = THREE.MathUtils.damp(
            this.camera.position.z,
            this.targetCamPos.z,
            5.5,
            dt
          );
          this.controls.target.x = THREE.MathUtils.damp(
            this.controls.target.x,
            this.targetOrbit.x,
            5.5,
            dt
          );
          this.controls.target.y = THREE.MathUtils.damp(
            this.controls.target.y,
            this.targetOrbit.y,
            5.5,
            dt
          );
          this.controls.target.z = THREE.MathUtils.damp(
            this.controls.target.z,
            this.targetOrbit.z,
            5.5,
            dt
          );

          if (
            this.camera.position.distanceTo(this.targetCamPos) < 0.04 &&
            this.controls.target.distanceTo(this.targetOrbit) < 0.04
          ) {
            this.cameraAnimating = false;
          }
        }
        this.controls.update();
      }

      this.applyTelemetryVisuals(this.telemetryRef, dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.teardownArTracking();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.renderer.domElement.removeEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.controls.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
