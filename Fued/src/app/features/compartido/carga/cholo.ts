import * as THREE from 'three';

/** Estatura del cholo a escala 1 (de la suela a la coronilla), para normalizar el tamaño. */
export const ESTATURA_CHOLO = 1.86;

export interface EstiloCholo {
  /** Camisa de franela a cuadros: [base, cuadro]. Con `camiseta` se ignora. */
  franela: [number, number];
  /** Camiseta blanca lisa en vez de franela. */
  camiseta?: boolean;
  pantalon: number;
  bandana: number;
  piel: number;
}

/** Ángulos de cada articulación; los pasos de baile son funciones que regresan una pose. */
interface Pose {
  bajada: number;
  caderaX: number;
  caderaGiro: number;
  caderaLado: number;
  torsoAtras: number;
  torsoGiro: number;
  torsoLado: number;
  cabezaSi: number;
  cabezaNo: number;
  hombroL: [number, number, number];
  hombroR: [number, number, number];
  codoL: number;
  codoR: number;
  musloL: number;
  musloR: number;
  rodillaL: number;
  rodillaR: number;
}

const texturasFranela = new Map<string, THREE.CanvasTexture>();

/** Cuadros de franela dibujados en un canvas (se comparten entre cholos con los mismos colores). */
function texturaFranela(base: number, cuadro: number): THREE.CanvasTexture {
  const clave = `${base}-${cuadro}`;
  let textura = texturasFranela.get(clave);
  if (!textura) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 64;
    const ctx = lienzo.getContext('2d')!;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, 64, 64);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = hex(cuadro);
    ctx.fillRect(0, 8, 64, 20);
    ctx.fillRect(8, 0, 20, 64);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 44, 64, 2);
    ctx.fillRect(44, 0, 2, 64);
    textura = new THREE.CanvasTexture(lienzo);
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(3, 2);
    textura.colorSpace = THREE.SRGBColorSpace;
    texturasFranela.set(clave, textura);
  }
  return textura;
}

/** Cilindro con el pivote arriba que cuelga hacia -Y: así la articulación queda en el origen. */
function extremidad(radioArriba: number, radioAbajo: number, largo: number, material: THREE.Material): THREE.Mesh {
  const geometria = new THREE.CylinderGeometry(radioArriba, radioAbajo, largo, 10);
  geometria.translate(0, -largo / 2, 0);
  return new THREE.Mesh(geometria, material);
}

const lerp = THREE.MathUtils.lerp;
const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Cholo de polígonos: franela abotonada (o camiseta), pantalón aguado, tenis blancos, bandana,
 * lentes negros, bigote y cadena. El baile es procedural y sigue los tiempos de la canción.
 */
export class Cholo {
  readonly raiz = new THREE.Group();
  /** Materiales que brillan con el golpe (bandana y cadena). */
  readonly brillantes: THREE.MeshStandardMaterial[] = [];
  readonly cabeza = new THREE.Group();

  private readonly cadera = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly cuello = new THREE.Group();
  private readonly hombros: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private readonly codos: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private readonly muslos: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private readonly rodillas: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private readonly pies: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];

  constructor(estilo: EstiloCholo, sombras = true) {
    const piel = new THREE.MeshStandardMaterial({ color: estilo.piel, roughness: 0.65 });
    const camisa = estilo.camiseta
      ? new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8 })
      : new THREE.MeshStandardMaterial({ map: texturaFranela(...estilo.franela), roughness: 0.85 });
    const pantalon = new THREE.MeshStandardMaterial({ color: estilo.pantalon, roughness: 0.9 });
    const tenis = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const negro = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.2, metalness: 0.5 });
    const pelo = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.9 });
    const bandana = new THREE.MeshStandardMaterial({ color: estilo.bandana, emissive: estilo.bandana, roughness: 0.6 });
    const oro = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xffa500, metalness: 1, roughness: 0.25 });
    this.brillantes.push(bandana, oro);

    // Cadera y piernas: pantalón aguado que se abre abajo, tenis blancos.
    this.cadera.position.y = 0.97;
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.24), pantalon);
    pelvis.position.y = -0.02;
    this.cadera.add(pelvis);
    this.muslos.forEach((muslo, i) => {
      const lado = i === 0 ? 1 : -1;
      muslo.position.set(0.1 * lado, -0.06, 0);
      muslo.add(extremidad(0.115, 0.125, 0.45, pantalon));
      this.rodillas[i].position.y = -0.45;
      this.rodillas[i].add(extremidad(0.125, 0.16, 0.4, pantalon));
      this.pies[i].position.y = -0.4;
      const zapato = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.29), tenis);
      zapato.position.set(0, -0.04, 0.06);
      const suela = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.295), negro);
      suela.position.set(0, -0.075, 0.06);
      this.pies[i].add(zapato, suela);
      this.rodillas[i].add(this.pies[i]);
      muslo.add(this.rodillas[i]);
      this.cadera.add(muslo);
    });

    // Torso: camisa holgada, abotonada hasta arriba, con cadena de oro.
    this.torso.position.y = 0.06;
    const pecho = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.58, 12), camisa);
    pecho.scale.z = 0.72;
    pecho.position.y = 0.29;
    const cadena = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.013, 6, 24), oro);
    cadena.position.set(0, 0.47, 0.13);
    cadena.rotation.x = 1.2;
    this.torso.add(pecho, cadena);
    this.hombros.forEach((hombro, i) => {
      const lado = i === 0 ? 1 : -1;
      hombro.position.set(0.27 * lado, 0.5, 0);
      hombro.add(extremidad(0.08, 0.075, 0.3, camisa));
      this.codos[i].position.y = -0.3;
      this.codos[i].add(extremidad(0.075, 0.065, 0.24, camisa));
      const mano = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), piel);
      mano.position.y = -0.29;
      this.codos[i].add(mano);
      hombro.add(this.codos[i]);
      this.torso.add(hombro);
    });

    // Cabeza: rapado, bandana con nudo atrás, lentes negros y bigote.
    this.cuello.position.y = 0.58;
    const pescuezo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 10), piel);
    pescuezo.position.y = 0.04;
    this.cuello.add(pescuezo);
    this.cabeza.position.y = 0.08;
    const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), piel);
    craneo.scale.set(1, 1.12, 1.02);
    craneo.position.y = 0.14;
    const rapado = new THREE.Mesh(new THREE.SphereGeometry(0.146, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), pelo);
    rapado.scale.set(1, 1.1, 1.02);
    rapado.position.y = 0.155;
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.07, 16, 1, true), bandana);
    banda.position.y = 0.215;
    banda.rotation.x = -0.12;
    const nudo = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), bandana);
    nudo.position.set(0, 0.17, -0.16);
    nudo.rotation.x = -2.4;
    const lentes = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.04), negro);
    lentes.position.set(0, 0.165, 0.125);
    const bigote = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), pelo);
    bigote.position.set(0, 0.085, 0.14);
    const orejas = [1, -1].map((lado) => {
      const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), piel);
      oreja.position.set(0.14 * lado, 0.14, 0);
      return oreja;
    });
    this.cabeza.add(craneo, rapado, banda, nudo, lentes, bigote, ...orejas);
    this.cuello.add(this.cabeza);
    this.torso.add(this.cuello);
    this.cadera.add(this.torso);
    this.raiz.add(this.cadera);

    this.raiz.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = sombras;
      }
    });
  }

  /** Pone el sombrero encima de la bandana, ladeado; `ancho` es el ancho total del ala. */
  ponerSombrero(sombrero: THREE.Object3D, ladeo: number, ancho = 0.62): void {
    sombrero.scale.setScalar(ancho / 2);
    sombrero.position.y = 0.25;
    sombrero.rotation.set(-0.1, 0, ladeo);
    this.cabeza.add(sombrero);
  }

  /**
   * @param fase beats transcurridos de la canción. Cada 8 tiempos cambia de paso:
   * rebote con codos de fuera, "moviendo el culito" y paso lateral señalando para arriba.
   * @param enElAire mientras cae del cielo: brazos arriba y piernas recogidas.
   */
  bailar(fase: number, pulso: number, enElAire = false): void {
    let pose: Pose;
    if (enElAire) {
      pose = this.poseCayendo(fase);
    } else {
      const pasos = [this.poseRebote, this.poseCulito, this.poseSenalar];
      const frase = Math.floor(fase / 8);
      const actual = pasos[frase % pasos.length].call(this, fase, pulso);
      const anterior = pasos[(frase + pasos.length - 1) % pasos.length].call(this, fase, pulso);
      // El primer tiempo de cada frase se funde con el paso anterior para no dar brincos.
      pose = mezclar(anterior, actual, suave(Math.min(1, fase - frase * 8)));
    }
    this.aplicar(pose);
  }

  /** Rebote cholo: inclinado para atrás, codos afuera con los puños al frente, cabeceando. */
  private poseRebote(fase: number, pulso: number): Pose {
    const golpe = Math.pow(1 - (fase - Math.floor(fase)), 3);
    const balanceo = Math.sin(fase * Math.PI * 0.5);
    return {
      ...poseBase(),
      bajada: 0.05 * (1 - Math.cos(fase * Math.PI * 2)) / 2 + golpe * 0.02,
      caderaX: balanceo * 0.05,
      torsoAtras: -0.14,
      torsoLado: -balanceo * 0.08,
      cabezaSi: 0.18 * golpe - 0.05 + pulso * 0.05,
      cabezaNo: balanceo * 0.15,
      hombroL: [-0.45, 0, 0.75 + golpe * 0.12],
      hombroR: [-0.45, 0, -0.75 - golpe * 0.12],
      codoL: -1.7,
      codoR: -1.7,
    };
  }

  /** "Moviendo el culito": la cadera va de lado a lado, manos en las rodillas al bajar. */
  private poseCulito(fase: number): Pose {
    const meneo = Math.sin(fase * Math.PI);
    const bajada = 0.12 + 0.03 * Math.abs(meneo);
    return {
      ...poseBase(),
      bajada,
      caderaX: meneo * 0.09,
      caderaGiro: meneo * 0.45,
      caderaLado: meneo * 0.18,
      torsoAtras: 0.35,
      torsoGiro: -meneo * 0.35,
      torsoLado: -meneo * 0.2,
      cabezaSi: -0.3,
      hombroL: [-0.7, 0, 0.35],
      hombroR: [-0.7, 0, -0.35],
      codoL: -0.5,
      codoR: -0.5,
    };
  }

  /** Paso lateral: levanta una pierna por tiempo y señala al cielo con el brazo contrario. */
  private poseSenalar(fase: number, pulso: number): Pose {
    const lado = Math.floor(fase / 2) % 2 === 0 ? 1 : -1;
    const tiempo = fase - Math.floor(fase);
    const paso = Math.sin(tiempo * Math.PI);
    const izquierda = Math.floor(fase) % 2 === 0;
    const arriba = lado === 1;
    return {
      ...poseBase(),
      bajada: 0.04 + 0.03 * (1 - paso),
      caderaX: Math.sin(fase * Math.PI * 0.5) * 0.12,
      torsoLado: -lado * 0.12,
      torsoGiro: lado * 0.25,
      cabezaSi: -0.1 + pulso * 0.08,
      cabezaNo: lado * 0.3,
      hombroL: arriba ? [-2.7 - pulso * 0.15, 0, 0.25] : [0.1, 0, 0.35],
      hombroR: arriba ? [0.1, 0, -0.35] : [-2.7 - pulso * 0.15, 0, -0.25],
      codoL: arriba ? -0.15 : -1.2,
      codoR: arriba ? -1.2 : -0.15,
      musloL: izquierda ? -0.55 * paso : 0,
      musloR: izquierda ? 0 : -0.55 * paso,
      rodillaL: izquierda ? 0.9 * paso : 0,
      rodillaR: izquierda ? 0 : 0.9 * paso,
    };
  }

  /** Cayendo del cielo: brazos arriba aleteando y piernas recogidas. */
  private poseCayendo(fase: number): Pose {
    const aleteo = Math.sin(fase * Math.PI * 4) * 0.25;
    return {
      ...poseBase(),
      cabezaSi: -0.25,
      hombroL: [-0.3, 0, 2.5 + aleteo],
      hombroR: [-0.3, 0, -2.5 - aleteo],
      codoL: -0.4,
      codoR: -0.4,
      musloL: -1.1,
      musloR: -0.4,
      rodillaL: 1.6,
      rodillaR: 0.8,
    };
  }

  private aplicar(p: Pose): void {
    this.cadera.position.set(p.caderaX, 0.97 - p.bajada, 0);
    this.cadera.rotation.set(0, p.caderaGiro, p.caderaLado);
    // El torso compensa el meneo de la cadera para que el pecho quede al frente.
    this.torso.rotation.set(p.torsoAtras, p.torsoGiro, p.torsoLado - p.caderaLado * 0.8);
    this.cabeza.rotation.set(p.cabezaSi - p.torsoAtras * 0.6, p.cabezaNo, 0);
    this.hombros[0].rotation.set(...p.hombroL);
    this.hombros[1].rotation.set(...p.hombroR);
    this.codos[0].rotation.x = p.codoL;
    this.codos[1].rotation.x = p.codoR;

    // Rodillas dobladas según qué tanto baja la cadera, para que los pies sigan en el piso.
    const doblez = Math.acos(THREE.MathUtils.clamp(1 - p.bajada / 0.85, -1, 1));
    const piernas: [number, number][] = [
      [p.musloL, p.rodillaL],
      [p.musloR, p.rodillaR],
    ];
    piernas.forEach(([muslo, rodilla], i) => {
      this.muslos[i].rotation.set(muslo - doblez - p.torsoAtras * 0.2, 0, -p.caderaLado);
      this.rodillas[i].rotation.x = rodilla + doblez * 2;
      this.pies[i].rotation.x = -(muslo + rodilla) - doblez + p.torsoAtras * 0.2;
    });
  }
}

function poseBase(): Pose {
  return {
    bajada: 0,
    caderaX: 0,
    caderaGiro: 0,
    caderaLado: 0,
    torsoAtras: 0,
    torsoGiro: 0,
    torsoLado: 0,
    cabezaSi: 0,
    cabezaNo: 0,
    hombroL: [0, 0, 0.15],
    hombroR: [0, 0, -0.15],
    codoL: -0.2,
    codoR: -0.2,
    musloL: 0,
    musloR: 0,
    rodillaL: 0,
    rodillaR: 0,
  };
}

function mezclar(a: Pose, b: Pose, t: number): Pose {
  const resultado = { ...b };
  for (const clave of Object.keys(b) as (keyof Pose)[]) {
    const va = a[clave];
    const vb = b[clave];
    (resultado[clave] as number | number[]) = Array.isArray(vb)
      ? vb.map((v, i) => lerp((va as number[])[i], v, t))
      : lerp(va as number, vb, t);
  }
  return resultado;
}
