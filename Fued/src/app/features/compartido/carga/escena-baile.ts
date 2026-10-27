import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { EstiloCholo } from './cholo';
import { Cholo, ESTATURA_CHOLO } from './cholo';

const FONDO = 0x05010d;
const NEONES = [0xff1f8f, 0x00e5ff, 0xffe600, 0x7a5cff, 0x2bff88, 0xff6a00];
const FOV = 45;
const PIELES = [0x8d5524, 0xa86b3c, 0xc68642, 0x6f4426];

/** Azulitos que caen del cielo cada 2 tiempos y se quedan bailando alrededor de la pista. */
const MAX_AZULITOS = 10;
const LUGARES_AZULITOS: [number, number][] = [
  [-2.7, 0.8], [2.7, 0.8], [-0.8, -2.7], [0.8, -2.7], [-2.6, -3.1], [2.6, -3.1],
  [-1.7, 2.1], [1.7, 2.1], [0, -4.1], [-3.7, -1.4], [3.7, -1.4],
];
const GRAVEDAD = 16;
const SALIDA_AZULITO_S = 0.35;

/** Azulito: franela azul, bandana azul y pantalón aguado. */
function estiloAzulito(i: number): EstiloCholo {
  const franelas: [number, number][] = [[0x1e4fd8, 0x0a1a4a], [0x00a2ff, 0x08306b], [0x3d6bff, 0x111a3a]];
  return {
    franela: franelas[i % franelas.length],
    pantalon: i % 2 === 0 ? 0xc8b48a : 0x1c2238,
    bandana: 0x1e6bff,
    piel: PIELES[i % PIELES.length],
  };
}

interface Bailarin {
  cholo: Cholo;
  raiz: THREE.Object3D;
  escala: number;
}

interface Azulito extends Bailarin {
  estado: 'cayendo' | 'bailando' | 'saliendo';
  vy: number;
  /** 1 justo al aterrizar (se aplasta) y regresa a 0. */
  aplastado: number;
  salida: number;
}

interface Reflector {
  luz: THREE.SpotLight;
  cono: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  fase: number;
}

/**
 * Sombrero de charro: copa y ala en un solo torno (el ala se levanta en la orilla),
 * con cinta y ribete brillantes. Mide 2 de ancho (radio 1) y la base de la copa está en y=0.
 */
function crearSombrero(colorAla: number, colorAdorno: number): THREE.Group {
  const perfil = [
    [0, 0.62], [0.14, 0.62], [0.22, 0.57], [0.3, 0.22], [0.34, 0.08], [0.37, 0.05],
    [0.62, 0.03], [0.86, 0.07], [0.97, 0.16], [1, 0.21],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const ala = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, 40),
    new THREE.MeshStandardMaterial({ color: colorAla, roughness: 0.55, side: THREE.DoubleSide }),
  );
  ala.castShadow = true;

  const adorno = new THREE.MeshStandardMaterial({
    color: colorAdorno,
    emissive: colorAdorno,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });
  const cinta = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.04, 8, 40), adorno);
  cinta.rotation.x = Math.PI / 2;
  cinta.position.y = 0.11;
  const ribete = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.028, 6, 64), adorno);
  ribete.rotation.x = Math.PI / 2;
  ribete.position.y = 0.2;

  const sombrero = new THREE.Group();
  sombrero.add(ala, cinta, ribete);
  return sombrero;
}

/**
 * Pista de baile 3D: tres cholos con sombrero bailando, azulitos que caen del cielo, piso de
 * disco que cambia de color en cada golpe y reflectores que barren la escena. `renderizar` lo
 * llama la pantalla de carga en su propio requestAnimationFrame para que todo vaya al mismo pulso.
 */
export class EscenaBaile {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly camara = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  private readonly bailarines: Bailarin[] = [];
  private readonly azulitos: Azulito[] = [];
  private readonly reflectores: Reflector[] = [];
  private readonly baldosas: THREE.InstancedMesh;
  private readonly coloresBaldosas: THREE.Color[] = [];
  private readonly bolaDisco: THREE.Mesh;
  private readonly entorno: THREE.Texture;
  private readonly color = new THREE.Color();
  private distancia = 8;
  private tiempo = 0;
  private beatAnterior = 0;
  private destruida = false;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(FONDO);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.escena.fog = new THREE.Fog(FONDO, 9, 24);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.escena.environment = this.entorno;
    this.escena.environmentIntensity = 0.35;

    this.escena.add(new THREE.HemisphereLight(0x6a4cff, 0x12001f, 0.7));
    this.baldosas = this.crearPiso();
    this.bolaDisco = this.crearBolaDisco();
    this.crearReflectores();
    this.ajustarTamano();
    this.crearBailarines();
  }

  ajustarTamano(): void {
    const ancho = this.lienzo.clientWidth || window.innerWidth;
    const alto = this.lienzo.clientHeight || window.innerHeight;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    // En vertical (teléfono) alejamos la cámara para que quepan los tres bailarines.
    const mitadVisible = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.camara.aspect;
    this.distancia = Math.max(9, 2.75 / mitadVisible);
    this.camara.updateProjectionMatrix();
  }

  /** @param pulso 0‥1, decae después de cada golpe. @param fase beats transcurridos. */
  renderizar(dtMs: number, pulso: number, fase: number): void {
    if (this.destruida) {
      return;
    }
    const dt = dtMs / 1000;
    this.tiempo += dt;
    const beat = Math.floor(fase);
    const nuevoBeat = beat !== this.beatAnterior;
    this.beatAnterior = beat;

    // Cámara: un vaivén lento alrededor de la pista y un empujoncito en cada golpe.
    const giro = Math.sin(this.tiempo * 0.3) * 0.45;
    const d = this.distancia * (1 - pulso * 0.025);
    this.camara.position.set(Math.sin(giro) * d, 2.1 + Math.sin(this.tiempo * 0.5) * 0.25, Math.cos(giro) * d);
    this.camara.lookAt(0, 1.05, -0.4);

    for (const [i, b] of this.bailarines.entries()) {
      b.cholo.bailar(fase, pulso);
      b.raiz.position.y = pulso * 0.06 * (i === 0 ? 1.4 : 1);
      for (const m of b.cholo.brillantes) {
        m.emissiveIntensity = 0.2 + pulso * 1.2;
      }
    }
    if (nuevoBeat && beat % 2 === 0) {
      this.soltarAzulito();
    }
    this.animarAzulitos(dt, pulso, fase);

    this.animarPiso(nuevoBeat, pulso);
    this.animarReflectores(pulso);
    this.bolaDisco.rotation.y += dt * 0.9;

    this.renderer.render(this.escena, this.camara);
  }

  destruir(): void {
    this.destruida = true;
    this.escena.traverse((objeto) => {
      const malla = objeto as THREE.Mesh;
      if (malla.isMesh) {
        malla.geometry?.dispose();
        const materiales = Array.isArray(malla.material) ? malla.material : [malla.material];
        materiales.forEach((m) => m?.dispose());
      }
    });
    this.entorno.dispose();
    this.renderer.dispose();
    // Sin esto cada visita a la pantalla de carga dejaría un contexto WebGL vivo.
    this.renderer.forceContextLoss();
  }

  private crearBailarines(): void {
    // Formación en "V": el líder adelante y los otros dos atrás a los lados. Todos con sombrero.
    const formacion: { x: number; z: number; tamano: number; estilo: EstiloCholo; ala: number; adorno: number; ladeo: number }[] = [
      {
        x: 0, z: 0.6, tamano: 2.1, ala: 0xc81d2a, adorno: 0xffd34d, ladeo: 0.12,
        estilo: { franela: [0x1b2a6b, 0x05070f], pantalon: 0xc8b48a, bandana: 0xff1f3d, piel: PIELES[0] },
      },
      {
        x: -1.55, z: -1.3, tamano: 1.95, ala: 0x18181f, adorno: 0xe8e8ff, ladeo: -0.16,
        estilo: { franela: [0, 0], camiseta: true, pantalon: 0x15151c, bandana: 0x111111, piel: PIELES[1] },
      },
      {
        x: 1.55, z: -1.3, tamano: 1.95, ala: 0xe9c46a, adorno: 0xff1f3d, ladeo: 0.16,
        estilo: { franela: [0x8f1020, 0x120406], pantalon: 0x3a3a40, bandana: 0x1e6bff, piel: PIELES[2] },
      },
    ];
    for (const lugar of formacion) {
      const bailarin = this.crearCholo(lugar.estilo, lugar.tamano, crearSombrero(lugar.ala, lugar.adorno), lugar.ladeo, true);
      bailarin.raiz.position.set(lugar.x, 0, lugar.z);
      bailarin.raiz.lookAt(lugar.x * 0.4, 0, 10);
      this.escena.add(bailarin.raiz);
      this.bailarines.push(bailarin);
    }
  }

  private crearCholo(estilo: EstiloCholo, tamano: number, sombrero: THREE.Object3D, ladeo: number, sombras: boolean): Bailarin {
    const cholo = new Cholo(estilo, sombras);
    cholo.ponerSombrero(sombrero, ladeo);
    const escala = tamano / ESTATURA_CHOLO;
    cholo.raiz.scale.setScalar(escala);
    return { cholo, raiz: cholo.raiz, escala };
  }

  private soltarAzulito(): void {
    if (this.azulitos.length < MAX_AZULITOS) {
      const i = this.azulitos.length;
      const sombrero = crearSombrero(0xf2d27a, NEONES[i % NEONES.length]);
      // Sin sombra propia: son muchos y en el teléfono pesaría.
      const bailarin = this.crearCholo(estiloAzulito(i), 1 + Math.random() * 0.2, sombrero, (Math.random() - 0.5) * 0.5, false);
      const [x, z] = LUGARES_AZULITOS[i % LUGARES_AZULITOS.length];
      bailarin.raiz.position.set(x, 0, z);
      const azulito: Azulito = { ...bailarin, estado: 'cayendo', vy: 0, aplastado: 0, salida: 0 };
      this.dejarCaer(azulito);
      this.escena.add(bailarin.raiz);
      this.azulitos.push(azulito);
      return;
    }
    // Ya está llena la pista: el más viejo se esfuma y vuelve a caer del cielo.
    const viejo = this.azulitos.find((a) => a.estado === 'bailando');
    if (viejo) {
      viejo.estado = 'saliendo';
      viejo.salida = 0;
    }
  }

  private dejarCaer(azulito: Azulito): void {
    azulito.estado = 'cayendo';
    azulito.vy = -2;
    azulito.raiz.position.y = 9 + Math.random() * 3;
    azulito.raiz.scale.setScalar(azulito.escala);
  }

  private animarAzulitos(dt: number, pulso: number, fase: number): void {
    for (const a of this.azulitos) {
      a.cholo.bailar(fase, pulso, a.estado === 'cayendo');
      for (const m of a.cholo.brillantes) {
        m.emissiveIntensity = 0.3 + pulso * 1.2;
      }
      const raiz = a.raiz;
      if (a.estado === 'cayendo') {
        a.vy -= GRAVEDAD * dt;
        raiz.position.y = Math.max(0, raiz.position.y + a.vy * dt);
        raiz.rotation.y += dt * 9;
        if (raiz.position.y === 0) {
          a.estado = 'bailando';
          a.aplastado = 1;
          raiz.lookAt(raiz.position.x * 0.4, 0, 10);
        }
      } else if (a.estado === 'bailando') {
        a.aplastado *= Math.exp(-dt / 0.12);
        raiz.position.y = pulso * 0.04;
        raiz.scale.set(
          a.escala * (1 + 0.25 * a.aplastado),
          a.escala * (1 - 0.35 * a.aplastado),
          a.escala * (1 + 0.25 * a.aplastado),
        );
      } else {
        a.salida += dt;
        const resto = Math.max(0, 1 - a.salida / SALIDA_AZULITO_S);
        raiz.scale.setScalar(a.escala * resto);
        raiz.rotation.y += dt * 14;
        if (resto === 0) {
          this.dejarCaer(a);
        }
      }
    }
  }

  private crearPiso(): THREE.InstancedMesh {
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x07020f, roughness: 0.35, metalness: 0.7 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    this.escena.add(base);

    const lado = 9;
    const tamano = 0.92;
    const baldosas = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(tamano, tamano),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }),
      lado * lado,
    );
    const matriz = new THREE.Matrix4();
    const rotacion = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    for (let i = 0; i < lado * lado; i++) {
      const x = (i % lado) - (lado - 1) / 2;
      const z = Math.floor(i / lado) - (lado - 1) / 2 - 1.5;
      matriz.makeTranslation(x, 0.005, z).multiply(rotacion);
      baldosas.setMatrixAt(i, matriz);
      this.coloresBaldosas.push(new THREE.Color(NEONES[i % NEONES.length]));
      baldosas.setColorAt(i, this.coloresBaldosas[i]);
    }
    this.escena.add(baldosas);
    return baldosas;
  }

  private animarPiso(nuevoBeat: boolean, pulso: number): void {
    if (nuevoBeat) {
      for (const color of this.coloresBaldosas) {
        color.setHex(Math.random() < 0.55 ? 0x000000 : NEONES[Math.floor(Math.random() * NEONES.length)]);
      }
    }
    const brillo = 0.18 + pulso * 0.55;
    for (const [i, base] of this.coloresBaldosas.entries()) {
      this.baldosas.setColorAt(i, this.color.copy(base).multiplyScalar(brillo));
    }
    this.baldosas.instanceColor!.needsUpdate = true;
  }

  private crearBolaDisco(): THREE.Mesh {
    const bola = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, flatShading: true, envMapIntensity: 3 }),
    );
    bola.position.set(0, 4.1, -1.2);
    this.escena.add(bola);
    return bola;
  }

  private crearReflectores(): void {
    const colores = [NEONES[0], NEONES[1], NEONES[3], NEONES[2]];
    // El cono va con la punta en el origen y crece hacia +Z, así lookAt lo apunta al objetivo.
    const geometria = new THREE.ConeGeometry(1, 1, 32, 1, true);
    geometria.translate(0, -0.5, 0);
    geometria.rotateX(-Math.PI / 2);

    colores.forEach((color, i) => {
      const luz = new THREE.SpotLight(color, 90, 0, THREE.MathUtils.degToRad(17), 0.5, 1.6);
      const x = (i - (colores.length - 1) / 2) * 2.6;
      luz.position.set(x, 6.5, -3.5);
      if (i === 1) {
        luz.castShadow = true;
        luz.shadow.mapSize.set(512, 512);
      }
      this.escena.add(luz, luz.target);

      const cono = new THREE.Mesh(
        geometria,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      this.escena.add(cono);
      this.reflectores.push({ luz, cono, fase: i * 1.7 });
    });
  }

  private animarReflectores(pulso: number): void {
    const objetivo = new THREE.Vector3();
    for (const r of this.reflectores) {
      const t = this.tiempo * 0.9 + r.fase;
      r.luz.target.position.set(Math.sin(t) * 2.6, 0, -0.4 + Math.cos(t * 1.3) * 1.6);
      r.luz.intensity = 70 + pulso * 160;

      objetivo.copy(r.luz.target.position);
      const largo = r.luz.position.distanceTo(objetivo);
      const radio = Math.tan(r.luz.angle) * largo;
      r.cono.position.copy(r.luz.position);
      r.cono.scale.set(radio, radio, largo);
      r.cono.lookAt(objetivo);
      r.cono.material.opacity = 0.06 + pulso * 0.12;
    }
  }
}
