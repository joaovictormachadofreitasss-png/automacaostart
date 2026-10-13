import * as THREE from 'three';
import { OrbitControls } from './assets/three/OrbitControls.js';
import { mergeGeometries } from './assets/three/BufferGeometryUtils.js';

const mobileView=matchMedia('(max-width:760px)');
const modestDevice=(navigator.deviceMemory!==undefined&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency!==undefined&&navigator.hardwareConcurrency<=4);
const mount = document.getElementById('house-canvas');
const overlay = document.getElementById('house-hotspots');
const stage = document.querySelector('.house-stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systems = [
  {id:'cameras',name:'Câmeras',title:'Câmeras inteligentes',category:'SEGURANÇA / MONITORAMENTO',point:[5.1,2.5,3.25],description:'Acompanhe áreas de acesso e ambientes estratégicos. Posicionamento, rede e armazenamento fazem parte da mesma decisão de projeto.',scenario:'Visualizar a entrada e acompanhar uma movimentação, mesmo estando fora de casa.',professional:'Cobertura, pontos cegos, infraestrutura de rede e privacidade.'},
  {id:'lighting',name:'Iluminação',title:'Iluminação e cenas',category:'CONFORTO / AMBIENTES',point:[-2.55,2.8,1.3],description:'Luz funcional, luz de destaque e cenas criam experiências diferentes no mesmo ambiente. O projeto considera circuitos, intensidade e rotina.',scenario:'Uma cena de cinema reduz a iluminação e prepara a sala para o filme.',professional:'Circuitos, cargas, dimerização e a intenção de uso de cada ambiente.'},
  {id:'tv',name:'Projeção e cenas',title:'Cinema integrado à rotina',category:'ENTRETENIMENTO / INTEGRAÇÃO',point:[-4.55,1.55,1.7],description:'Tela retrátil, projetor, iluminação e climatização podem participar da mesma cena. O controle precisa fazer sentido para quem usa a casa.',scenario:'Preparar o cinema e o ambiente com um único comando, conforme as integrações do projeto.',professional:'Comandos disponíveis, controle infravermelho ou integração de rede e experiência de uso.'},
  {id:'climate',name:'Ar-condicionado',title:'Climatização inteligente',category:'CONFORTO / TEMPERATURA',point:[4.55,2.3,1.05],description:'Conecte o ar-condicionado às necessidades da casa. Equipamento, protocolo e tipo de controle orientam a solução.',scenario:'Preparar a temperatura de um ambiente antes de chegar, conforme a integração disponível.',professional:'Compatibilidade, estado do equipamento, sensores e critérios de acionamento.'},
  {id:'switches',name:'Interruptores',title:'Interruptores inteligentes',category:'CONTROLE / INFRAESTRUTURA',point:[0.3,1.28,3.73],description:'O controle físico continua importante. Interruptores integram os circuitos à automação e preservam uma forma simples de usar o ambiente.',scenario:'Controlar a luz pelo interruptor e também por cenas, aplicativo ou voz.',professional:'Infraestrutura elétrica, carga, caixas, protocolo e funcionamento manual.'},
  {id:'mesh',name:'Wi-Fi mesh',title:'Uma rede que sustenta tudo',category:'CONECTIVIDADE / COBERTURA',point:[-1.65,.9,-2.2],description:'Distribua a conectividade com planejamento. Uma rede confiável ajuda dispositivos, câmeras e interfaces a trabalhar de forma consistente.',scenario:'Circular pela casa com cobertura de Wi-Fi adequada nos ambientes do projeto.',professional:'Pontos de acesso, cobertura, interferência, rede cabeada e posicionamento.'},
  {id:'curtains',name:'Cortinas',title:'Luz natural sob controle',category:'CONFORTO / SOMBREAMENTO',point:[2.9,2.1,-3.7],description:'Cortinas e persianas motorizadas entram no planejamento de iluminação e conforto. O acionamento depende do motor e da integração escolhida.',scenario:'Abrir as cortinas pela manhã ou fechá-las junto de uma cena de cinema.',professional:'Tipo de motor, alimentação, medidas, acionamento e integração com cenas.'},
  {id:'locks',name:'Acesso',title:'Acesso e chegada',category:'SEGURANÇA / CONTROLE DE ACESSO',point:[5.6,1.15,5.35],description:'Fechaduras e acessos precisam equilibrar conveniência e segurança. A automação acompanha a experiência de entrada e saída.',scenario:'Organizar o acesso de moradores e visitantes conforme os recursos do equipamento.',professional:'Porta, instalação, formas de abertura, contingência e permissões.'},
  {id:'sensors',name:'Sensores',title:'Uma casa que percebe',category:'AUTOMAÇÃO / CONTEXTO',point:[2.3,2.55,2.8],description:'Presença, abertura, luminosidade e temperatura ajudam o projeto a responder ao contexto, com regras claras e adequadas à rotina.',scenario:'Acender uma luz ao detectar presença e desligá-la quando o ambiente estiver vazio.',professional:'Posicionamento, alcance, alimentação, sensibilidade e lógica das automações.'},
  {id:'audio',name:'Áudio',title:'Som integrado ao ambiente',category:'ENTRETENIMENTO / EXPERIÊNCIA',point:[-1.35,.75,2.6],description:'Áudio pode compor uma experiência por ambiente ou por zona. Distribuição, acústica e integração orientam o projeto.',scenario:'Selecionar música em uma área da casa e integrar o som à rotina do ambiente.',professional:'Zonas, potência, acústica, cabeamento e compatibilidade dos equipamentos.'}
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32,1,.08,90);
const overviewPosition=new THREE.Vector3(14,13,17);
function overviewFov(){const aspect=mount.clientWidth/Math.max(1,mount.clientHeight);return THREE.MathUtils.radToDeg(2*Math.atan(Math.max(5.5,8.4/aspect)/overviewPosition.distanceTo(new THREE.Vector3(0,.65,0))));}
camera.position.set(14,13,17);
camera.lookAt(0,.65,0);
let renderer;
let svgMode = false;
let realism = null;
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  // Preserve the screen's native pixel density for crisp edges on Retina/mobile displays.
  renderer.setPixelRatio(Math.max(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch (_) {
  const {createHouseFallback}=await import('./house-lite.js');
  renderer=createHouseFallback();
  svgMode = true;
}
mount.append(renderer.domElement);
renderer.domElement.setAttribute('aria-hidden','true');
const controls = new OrbitControls(camera,renderer.domElement);
controls.enabled=!svgMode;
controls.target.set(0,.65,0);
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = !svgMode && !reduceMotion.matches;
controls.dampingFactor = .08;
controls.minPolarAngle = .38;
controls.maxPolarAngle = 1.7;
controls.rotateSpeed = .5;
controls.mouseButtons = {LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:THREE.MOUSE.ROTATE};
// Touch gestures over the canvas rotate the house; the rest of the page stays scrollable.
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
renderer.domElement.style.touchAction = svgMode ? 'pan-y' : 'none';
if (svgMode) document.querySelector('.house-instruction').textContent='Visualização leve';
else if (matchMedia('(pointer:coarse)').matches) document.querySelector('.house-instruction').textContent = 'Arraste com um dedo para girar';
scene.add(new THREE.HemisphereLight(0xe9f4ff,0x66705f,2.1));
const sun = new THREE.DirectionalLight(0xfff0d6,4);
sun.position.set(-6,14,9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:1,far:40});
sun.shadow.bias=-.0007;
sun.shadow.normalBias=.025;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8ae0ed,1);
fill.position.set(8,5,-5);fill.intensity=.17;
scene.add(fill);

function material(color,roughness=.75,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
const materials={
  wall:material(0xf1eee1),floor:material(0xd4c9ae),stone:material(0xc4cabd),dark:material(0x173439),
  timber:material(0x997653),wood:material(0xb08a5c),fabric:material(0xdadbc9),linen:material(0xdadbc9,1),sofa:material(0x668b83),
  black:material(0x10262d,.4),metal:material(0x5b777b,.35,.65),lawn:material(0x60846b),leaf:material(0x3b6957),
  glow:new THREE.MeshStandardMaterial({color:0xece5cf,emissive:0xffd294,emissiveIntensity:1.4}),
  cyan:new THREE.MeshStandardMaterial({color:0x5ed3d8,emissive:0x30a7ac,emissiveIntensity:.4}),
  glass:new THREE.MeshStandardMaterial({color:0xaedee2,transparent:true,opacity:.25,roughness:.14,metalness:.1,side:THREE.DoubleSide})
};
const geometryCache = new Map();
function roundedGeometry(w,h,d){
  const key=[w,h,d].join('|'); if(geometryCache.has(key)) return geometryCache.get(key);
  const r=Math.min(.05,w/8,d/8,h/6);
  const shape=new THREE.Shape(); const x=-w/2,y=-d/2;
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+d-r);shape.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
  shape.lineTo(x+r,y+d);shape.quadraticCurveTo(x,y+d,x,y+d-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:h-r*2,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1,curveSegments:4});
  g.translate(0,0,-(h-r*2)/2);g.rotateX(-Math.PI/2);geometryCache.set(key,g);return g;
}
function box(w,h,d,x,y,z,mat,rounded=false,parent=scene){
  const mesh=new THREE.Mesh(rounded?roundedGeometry(w,h,d):new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(r1,r2,h,x,y,z,mat,segments=16,parent=scene){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(r,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function line(points,color=0x6bced5,opacity=.5){const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const path=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity}));scene.add(path);return path;}

// A furnished cutaway house, built as architecture rather than a collection of device icons.
box(14.2,.5,12.2,0,-.36,.5,materials.dark,true);
box(13.8,.08,11.8,0,-.08,.5,materials.lawn,true);
box(10.5,.32,8.5,0,.13,0,materials.stone,true);
box(10,.08,8,0,.32,0,materials.floor);
for(let i=0;i<22;i++) box(.018,.006,8,-4.78+i*.45,.366,0,materials.timber);
// Rear glazing and the tall far wall establish the architecture while the cutaway reveals the interior.
box(.22,2.7,8.2,-5,1.73,0,materials.wall);
box(.2,1.1,8.2,5,.93,0,materials.wall);
box(10.2,.23,.22,0,2.96,-4,materials.dark);
for(const x of [-4.9,-1.7,1.7,4.9]) box(.16,2.65,.2,x,1.7,-4,materials.dark);
for(const x of [-3.3,0,3.3]){box(3.07,2.35,.04,x,1.65,-4,materials.glass);box(3.07,.1,.15,x,.42,-4,materials.dark);}
box(10.2,.18,.18,0,2.95,4,materials.dark);
box(.18,2.7,.18,5,1.7,4,materials.dark);
box(.18,2.7,.18,-5,1.7,4,materials.dark);
box(.18,.18,8.2,5,2.96,0,materials.dark);
box(.18,.18,8.2,-5,2.96,0,materials.dark);
// Low sectioned partitions: living room, kitchen, bedroom and work space.
box(.16,.95,7.8,.65,.85,0,materials.wall);
box(4.5,.95,.15,-2.18,.85,-.8,materials.wall);
box(4.2,.95,.15,2.86,.85,-.7,materials.wall);
// Rug, sofa, pillows and lounge tables.
box(3.5,.025,3.4,-2.2,.39,1.55,material(0xeee8d5),true);
box(2.7,.43,.95,-2.15,.62,2.9,materials.sofa,true);
box(2.75,.6,.22,-2.15,.99,3.32,materials.sofa,true);
box(.25,.48,1.05,-3.58,.89,2.9,materials.sofa,true);
box(.25,.48,1.05,-.72,.89,2.9,materials.sofa,true);
for(const x of [-2.96,-2.1,-1.2]) box(.68,.14,.74,x,.89,2.9,materials.linen,true);
for(const x of [-2.98,-1.1]){const pillow=box(.44,.35,.16,x,1.15,3.13,material(0xefe8d5),true);pillow.rotation.z=x<-2?-.12:.13;}
cylinder(.65,.65,.08,-2.1,.7,1.3,materials.wood,32);cylinder(.055,.055,.32,-2.1,.5,1.3,materials.dark);
cylinder(.21,.16,.14,-2.12,.82,1.32,materials.fabric,20);
box(.75,.03,.46,-2.85,.4,.4,materials.wood,true);
// Retractable screen: casing stays fixed while the fabric unrolls from its top edge.
const screenMaterial=new THREE.MeshStandardMaterial({color:0xe9e6d8,emissive:0xffffff,emissiveIntensity:0,roughness:.8,transparent:true,opacity:0,depthWrite:false});
box(.28,.18,3.02,-4.72,2.55,1.7,materials.fabric,true);
const projectionScreen=new THREE.Group();projectionScreen.position.set(-4.55,2.43,1.7);scene.add(projectionScreen);
box(.045,1.78,2.94,0,-.89,0,materials.fabric,false,projectionScreen);
const tvScreen=box(.008,1.63,2.8,.028,-.86,0,screenMaterial,false,projectionScreen);
box(.09,.055,3.01,0,-1.79,0,materials.metal,true,projectionScreen);
projectionScreen.scale.y=.015;
// Kitchen with counter, island, sink, hob and stools.
box(3.5,.82,.7,-2.5,.82,-3.44,materials.wood,true);
box(3.62,.09,.78,-2.5,1.28,-3.44,materials.stone,true);
box(.65,.035,.45,-3.15,1.34,-3.45,materials.metal,true);
line([[-3.15,1.34,-3.6],[-3.15,1.63,-3.6],[-3.15,1.63,-3.43]],0x6c8987,1);
box(.65,.025,.45,-1.6,1.34,-3.45,materials.black);
for(const x of [-1.77,-1.47]) cylinder(.105,.105,.015,x,1.36,-3.45,materials.metal,20);
box(2.6,.76,.84,-2.2,.79,-1.95,materials.fabric,true);
box(2.75,.1,1.02,-2.2,1.23,-1.95,materials.stone,true);
for(const x of [-2.95,-1.55]){cylinder(.23,.23,.08,x,.97,-1.07,materials.wood);cylinder(.035,.05,.51,x,.69,-1.07,materials.dark);}
for(const x of [-3.1,-1.3]){line([[x,2.92,-2.08],[x,2.12,-2.08]],0x4b6463,1);cylinder(.18,.12,.16,x,2.05,-2.08,materials.dark);cylinder(.14,.14,.016,x,1.96,-2.08,materials.glow);}
// Bedroom, headboard, layered linen and bedside lamps.
box(2.3,.3,2.7,2.75,.54,1.7,materials.wood,true);
box(2.18,.24,2.56,2.75,.8,1.7,materials.linen,true);
box(2.22,.06,1.58,2.75,.96,2.08,material(0x7b9b98),true);
box(2.45,.85,.18,2.75,.91,.3,materials.wood,true);
for(const x of [2.16,3.32]) box(.95,.12,.56,x,.99,.72,material(0xefeee2),true);
for(const x of [1.1,4.33]){box(.55,.55,.55,x,.65,.73,materials.wood,true);cylinder(.1,.1,.25,x,1.06,.73,materials.metal);cylinder(.23,.17,.32,x,1.31,.73,materials.fabric);}
// Work area and chair.
box(2.8,.1,.78,2.9,1.11,-2.65,materials.wood,true);
for(const x of [1.65,4.15])box(.06,.72,.65,x,.71,-2.65,materials.dark);
box(.76,.51,.04,2.9,1.46,-2.93,materials.black,true);const officeScreen=box(.69,.44,.01,2.9,1.46,-2.9,screenMaterial);
box(.14,.12,.3,2.9,1.19,-2.8,materials.metal);
box(.7,.09,.65,2.85,.72,-1.45,materials.sofa,true);box(.74,.65,.09,2.85,1.01,-1.12,materials.sofa,true);cylinder(.06,.06,.35,2.85,.48,-1.45,materials.metal);
// Exterior deck, entrance, stepping stones and planted landscaping.
box(9.8,.15,1.35,0,.16,4.64,materials.wood,true);
for(let i=0;i<27;i++)box(.018,.007,1.3,-4.65+i*.35,.24,4.64,materials.timber);
for(let i=0;i<4;i++)box(.95,.07,.52,5.4,.03,3.8+i*.78,materials.stone,true);
box(.16,1.4,1.3,5.65,.63,5.22,materials.dark,true);
for(let i=0;i<7;i++)box(.02,.95,.028,5.76,.89,4.68+i*.18,materials.metal);
function plant(x,z,r=.45){
  cylinder(r*.7,r*.55,.45,x,.2,z,materials.stone);cylinder(.065,.09,1.4,x,.95,z,materials.timber,10);
  for(let i=0;i<5;i++){const a=i*2.4;sphere(r,x+Math.sin(a)*r*.4,1.43+Math.cos(i)*.24,z+Math.cos(a)*r*.4,materials.leaf);}
}
plant(-6.15,3.8,.65);plant(-6.12,-2.8,.65);plant(5.95,-3.3,.47);
for(let i=0;i<9;i++) sphere(.22,-4.7+i*.47,.17,5.9,materials.leaf);
for(let i=0;i<5;i++) sphere(.18,6.25,.13,-2+i*.45,materials.leaf);
// Linen curtains with visible folds, next to the glass walls.
const curtains=[];
function curtain(x,z,width){
  const geometry=new THREE.PlaneGeometry(width,2.34,20,1);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*24)*.045);geometry.computeVertexNormals();
  const fabric=new THREE.MeshStandardMaterial({color:0xe5ddc8,roughness:1,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,fabric);mesh.position.set(x,1.62,z);mesh.castShadow=true;scene.add(mesh);curtains.push(mesh);
}
curtain(1.9,-3.84,.7);curtain(4.37,-3.84,.65);
// Flat roof is optional: the default cutaway makes every room legible.
const roof=new THREE.Group();scene.add(roof);
box(10.4,.14,8.4,0,3.11,0,materials.wall,true,roof);
box(8.7,.08,6.5,0,3.22,0,materials.stone,true,roof);
box(3.2,.025,1.6,2.75,3.3,-1.9,materials.black,false,roof);
for(let i=0;i<6;i++)box(.035,.014,1.6,1.3+i*.55,3.32,-1.9,materials.metal,false,roof);
roof.visible=false;
// Visible smart devices, placed at the same coordinates as their information pins.
const deviceGroups={};
function device(id){const group=new THREE.Group();scene.add(group);deviceGroups[id]=group;return group;}
const cam=device('cameras');box(.38,.19,.26,5.06,2.57,3.25,materials.fabric,true,cam);const lens=cylinder(.07,.07,.08,5.09,2.55,3.4,materials.black,20,cam);lens.rotation.x=Math.PI/2;
box(.05,.32,.05,5.04,2.48,3.1,materials.metal,false,cam);
const lights=device('lighting');box(3.9,.045,.09,-2.25,2.83,1.3,materials.glow,false,lights);box(.06,.045,3.9,-3.9,2.83,1.35,materials.glow,false,lights);
const climate=device('climate');box(.25,.37,1.06,4.8,2.33,1.05,materials.fabric,true,climate);for(let i=0;i<5;i++)box(.01,.025,.92,4.64,2.2+i*.035,1.05,materials.metal,false,climate);
const switches=device('switches');box(.22,.29,.07,.3,1.28,3.73,materials.fabric,true,switches);for(let i=0;i<3;i++)box(.025,.11,.012,.23+i*.075,1.3,3.78,materials.cyan,false,switches);
const wifi=device('mesh');for(const p of [[-1.65,1.35,-2.2],[3.9,1.28,-2.5],[4.33,.99,.73]]){cylinder(.11,.11,.27,...p,materials.fabric,20,wifi);cylinder(.105,.105,.006,p[0],p[1]+.14,p[2],materials.cyan,20,wifi);}
const sensor=device('sensors');sphere(.105,2.3,2.56,2.8,materials.fabric,sensor);sphere(.04,2.3,2.53,2.9,materials.black,sensor);
const audio=device('audio');cylinder(.19,.19,.33,-1.35,.58,2.6,materials.dark,24,audio);cylinder(.195,.195,.015,-1.35,.76,2.6,materials.cyan,24,audio);
const lock=device('locks');box(.06,.27,.1,5.77,1.15,5.35,materials.black,true,lock);box(.075,.014,.06,5.81,1.23,5.36,materials.cyan,false,lock);
// A connection route and radio waves appear only for the selected system.
const networkGroup=new THREE.Group();scene.add(networkGroup);
for(const p of [[-1.65,1.35,-2.2],[3.9,1.28,-2.5],[4.33,.99,.73]]) for(const r of [.38,.68,1.0]){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.012,4,48),new THREE.MeshBasicMaterial({color:0x66e7de,transparent:true,opacity:.5}));ring.rotation.x=-Math.PI/2;ring.position.set(p[0],p[1]+.1,p[2]);networkGroup.add(ring);
}
const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.65,1.35,-2.2),new THREE.Vector3(3.9,1.28,-2.5),new THREE.Vector3(4.33,.99,.73)]),new THREE.LineBasicMaterial({color:0x75dfce,transparent:true,opacity:.7}));networkGroup.add(route);networkGroup.visible=false;
const marker=new THREE.Mesh(new THREE.TorusGeometry(.33,.016,6,48),new THREE.MeshBasicMaterial({color:0xabefc7,transparent:true,opacity:.8}));marker.rotation.x=-Math.PI/2;scene.add(marker);
const connectionGroup=new THREE.Group();scene.add(connectionGroup);
const hiddenRoutes=systems.map(system=>{
  const points=[new THREE.Vector3(...system.point),new THREE.Vector3(system.point[0],.39,system.point[2]),new THREE.Vector3(-1.65,.39,-2.2)];
  const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0x70d6da,dashSize:.14,gapSize:.12,transparent:true,opacity:.5}));route.computeLineDistances();route.visible=false;connectionGroup.add(route);return route;
});

// Scene state is independent of the information pins; changing scenes blends from the current state.
const hemisphere=scene.children.find(object=>object.isHemisphereLight);
hemisphere.intensity=.3;sun.intensity=.3;fill.intensity=.3;
materials.glow.emissiveIntensity=0;
const mainMaterial=new THREE.MeshStandardMaterial({color:0x756b50,emissive:0xffd6a0,emissiveIntensity:0});
const indirectMaterial=new THREE.MeshStandardMaterial({color:0x605949,emissive:0xffbc72,emissiveIntensity:0});
lights.children.forEach(object=>object.material=mainMaterial);
for(const x of [-3.7,-1.2])for(const z of [.25,2.8]){
  cylinder(.15,.15,.045,x,2.9,z,mainMaterial,20,lights);
}
// Curtain pelmet and concealed LED on the living room's far edge.
box(4.85,.13,.18,-2.45,2.73,-.66,materials.dark);
box(4.65,.035,.065,-2.45,2.64,-.61,indirectMaterial);
box(.04,.035,3.9,-4.77,2.65,1.35,indirectMaterial);
curtain(-4.5,-.73,.7);curtain(.15,-.73,.7);
function roomSpot(x,y,z,tx,ty,tz,color){
  const light=new THREE.SpotLight(color,0,10,.9,.85,1.6);light.position.set(x,y,z);light.target.position.set(tx,ty,tz);scene.add(light,light.target);return light;
}
const mainLamp=roomSpot(-2.4,4.1,1.55,-2.4,.4,1.55,0xffe1b1);
const kitchenLamp=roomSpot(-2.3,3.4,-2.4,-2.3,.4,-2.4,0xffdfa6);
const indirectLamp=new THREE.PointLight(0xffbc75,0,5,1.6);indirectLamp.position.set(-2.5,2.15,-.5);scene.add(indirectLamp);
const entryLamp=new THREE.PointLight(0xffd29a,0,5,1.7);entryLamp.position.set(3.8,1.6,4.3);scene.add(entryLamp);
const tvLamp=new THREE.PointLight(0x5d9eff,0,4.5,1.8);tvLamp.position.set(-4.25,1.45,1.7);scene.add(tvLamp);
const entryMaterial=new THREE.MeshStandardMaterial({color:0x65736b,emissive:0xffd39a,emissiveIntensity:0});
for(const x of [-3.9,-1.9,.1,2.1,4.1])box(.28,.025,.09,x,.28,4.7,entryMaterial);
box(3.3,.018,.025,2.75,.39,3.55,entryMaterial);box(.025,.018,2.2,.95,.39,2.3,entryMaterial);
// Purpose-made screen artwork avoids third-party images and gives the TV a clear power-on reveal.
const tvArtwork=document.createElement('canvas');tvArtwork.width=512;tvArtwork.height=288;
const tvContext=tvArtwork.getContext('2d');const sky=tvContext.createLinearGradient(0,0,0,288);sky.addColorStop(0,'#0d274b');sky.addColorStop(.55,'#477ca0');sky.addColorStop(1,'#a6c3bb');tvContext.fillStyle=sky;tvContext.fillRect(0,0,512,288);
tvContext.fillStyle='#f4d49e';tvContext.beginPath();tvContext.arc(382,82,25,0,Math.PI*2);tvContext.fill();
for(const [color,base,peak] of [['#344b68',230,90],['#263e58',270,150],['#102c41',310,205]]){tvContext.fillStyle=color;tvContext.beginPath();tvContext.moveTo(0,288);for(let x=0;x<=512;x+=32)tvContext.lineTo(x,base-Math.sin(x*.009+peak)*45-Math.cos(x*.017)*22);tvContext.lineTo(512,288);tvContext.fill();}
tvContext.fillStyle='#e8f0e3';tvContext.font='18px sans-serif';tvContext.fillText('LETSMAKER CINEMA',25,254);
const tvTexture=new THREE.CanvasTexture(tvArtwork);tvTexture.colorSpace=THREE.SRGBColorSpace;
screenMaterial.map=tvTexture;screenMaterial.emissiveMap=tvTexture;screenMaterial.emissive.setHex(0xffffff);screenMaterial.color.setHex(0x000000);screenMaterial.emissiveIntensity=0;
// Independent screen material keeps the office monitor off when the living room TV starts.
officeScreen.material=material(0x06121c);
const tvIndicatorMaterial=new THREE.MeshBasicMaterial({color:0x233d43});
const projector=new THREE.Group();scene.add(projector);
box(.56,.18,.43,-2.15,2.62,1.7,materials.fabric,true,projector);
cylinder(.035,.035,.31,-2.15,2.86,1.7,materials.metal,12,projector);
const projectorLens=cylinder(.065,.065,.1,-2.46,2.61,1.7,tvIndicatorMaterial,20,projector);projectorLens.rotation.z=Math.PI/2;
const lightBeam=new THREE.Group();scene.add(lightBeam);
const origin=new THREE.Vector3(-2.52,2.61,1.7);
const corners=[new THREE.Vector3(-4.51,2.38,.3),new THREE.Vector3(-4.51,2.38,3.1),new THREE.Vector3(-4.51,.73,3.1),new THREE.Vector3(-4.51,.73,.3)];
const beamVertices=[];for(let i=0;i<4;i++)beamVertices.push(...origin.toArray(),...corners[i].toArray(),...corners[(i+1)%4].toArray());
const beamGeometry=new THREE.BufferGeometry();beamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(beamVertices,3));
const beamMaterial=new THREE.MeshBasicMaterial({color:0xc1dcff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
lightBeam.add(new THREE.Mesh(beamGeometry,beamMaterial));
for(let i=0;i<8;i++){
  const destination=new THREE.Vector3(-4.5,.88+(i%3)*.65,.4+(i/7)*2.6);
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,destination]),new THREE.LineBasicMaterial({color:0xc8e2ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));lightBeam.add(ray);
}
// A second air conditioner serves the living room; its separate flap visibly opens.
box(.25,.4,1.12,-4.8,2.36,-.05,materials.fabric,true,climate);
const flapMaterial=material(0x546c73,.4);
const livingFlap=box(.2,.045,1.0,-4.63,2.21,-.05,flapMaterial,true,climate);
const bedroomFlap=box(.2,.045,.98,4.63,2.2,1.05,flapMaterial,true,climate);
const acIndicatorMaterial=new THREE.MeshBasicMaterial({color:0x182f39});
sphere(.035,-4.655,2.39,.36,acIndicatorMaterial,climate);sphere(.035,4.645,2.36,1.43,acIndicatorMaterial,climate);
const securityMaterial=new THREE.MeshBasicMaterial({color:0x294942});sphere(.035,5.09,2.62,3.4,securityMaterial,cam);box(.085,.045,.025,5.81,1.28,5.36,securityMaterial,false,lock);
// Moving translucent ribbons and particles make air flow legible without expensive fluid simulation.
const airflow=new THREE.Group();scene.add(airflow);const airParticles=[];
for(const [x,y,z,direction] of [[-4.6,2.19,-.05,1],[4.6,2.18,1.05,-1]]){
  for(let i=0;i<5;i++){
    const spread=(i-2)*.15;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,y,z+spread),new THREE.Vector3(x+direction*.6,y-.25,z+spread),new THREE.Vector3(x+direction*1.5,y-.65,z+spread*2),new THREE.Vector3(x+direction*2.4,y-1.05,z+spread*3)]);
    const airMat=new THREE.MeshBasicMaterial({color:0x8addeb,transparent:true,opacity:0,depthWrite:false});
    const ribbon=new THREE.Mesh(new THREE.TubeGeometry(curve,25,.022,4,false),airMat);airflow.add(ribbon);
    for(let j=0;j<3;j++){
      const mat=new THREE.MeshBasicMaterial({color:0xb9f7ff,transparent:true,opacity:0,depthWrite:false});
      const particle=new THREE.Mesh(new THREE.SphereGeometry(.027,6,5),mat);airflow.add(particle);airParticles.push({particle,curve,offset:j/3+i*.11});
    }
  }
}
const presets={
  inicial:{name:'Casa em repouso',description:'Escolha uma cena para transformar o ambiente.',caption:'AMBIENTE NOTURNO / EM REPOUSO',main:0,indirect:0,tv:0,ac:0,curtains:0,entry:0,security:0},
  sala:{name:'Preparar sala',description:'Luz quente, cortinas ajustadas e climatização para receber.',caption:'LUZ + CORTINAS + CONFORTO',main:1,indirect:.75,tv:0,ac:.6,curtains:.2,entry:.2,security:0},
  cinema:{name:'Hora do cinema',description:'Tela de projeção aberta, projetor ligado, luz suave e ar a 22 °C.',caption:'CINEMA / UMA CENA, VÁRIAS AÇÕES',main:0,indirect:.22,tv:1,ac:1,curtains:1,entry:0,security:0},
  noite:{name:'Boa noite',description:'Projetor e ar desligados. Cortinas fechadas e circulação suave.',caption:'DESCANSO / CIRCULAÇÃO SUAVE',main:0,indirect:0,tv:0,ac:0,curtains:1,entry:.12,security:1},
  sair:{name:'Sair de casa',description:'Equipamentos desligados. Acesso e monitoramento ativos.',caption:'AUSÊNCIA / ACESSO + MONITORAMENTO',main:0,indirect:0,tv:0,ac:0,curtains:1,entry:0,security:1},
  cheguei:{name:'Cheguei em casa',description:'Entrada iluminada, cortinas abertas e conforto na sala.',caption:'CHEGADA / A CASA RECEBE VOCÊ',main:.85,indirect:.65,tv:0,ac:.7,curtains:0,entry:1,security:0}
};
const sceneState={main:0,indirect:0,tv:0,ac:0,curtains:0,entry:0,security:0};
let sceneTransition=null,activeScene='inicial',cameraTransition=null,lastDeviceText='';
const sceneConsole=document.querySelector('.house-scene-console');
const section=document.getElementById('casa-inteligente');
const sceneCaption=document.createElement('div');sceneCaption.className='house-scene-caption';sceneCaption.hidden=true;
function chooseScene(id){
  const preset=presets[id];activeScene=id;
  sceneTransition={from:{...sceneState},to:preset,start:performance.now(),duration:reduceMotion.matches?0:6200};
  document.querySelectorAll('[data-scene]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===id)));
  section.classList.toggle('scene-active',id!=='inicial');section.classList.toggle('scene-running',!reduceMotion.matches);
  document.getElementById('house-scene-name').textContent=preset.name;
  document.getElementById('house-scene-description').textContent=reduceMotion.matches?preset.description:'Preparando… '+preset.description;
  sceneCaption.textContent=preset.caption;document.querySelector('.house-model-label').textContent=preset.name;
  roof.visible=false;const roofButton=document.getElementById('house-roof');roofButton.setAttribute('aria-pressed','false');roofButton.textContent='Cobertura';
  renderer.setRoof?.(false);
  marker.visible=false;connectionGroup.visible=false;networkGroup.visible=false;
  document.getElementById('house-points').setAttribute('aria-pressed','false');section.classList.remove('house-show-points');
  startFlight(id);
  const stageBounds=stage.getBoundingClientRect();
  const visibleHeight=window.visualViewport?.height||innerHeight;
  const headerHeight=document.querySelector('.site-header')?.getBoundingClientRect().height||56;
  if(stageBounds.top<headerHeight+12||stageBounds.bottom>visibleHeight-12){
    stage.scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'});
  }
  if(renderer.shadowMap)renderer.shadowMap.needsUpdate=true;

  requestRender();
}
document.querySelectorAll('[data-scene]').forEach(button=>{button.disabled=false;button.addEventListener('click',()=>chooseScene(button.dataset.scene));});
const sceneReset=document.getElementById('house-scene-reset');sceneReset.disabled=false;sceneReset.addEventListener('click',()=>chooseScene('inicial'));
document.getElementById('house-points').addEventListener('click',event=>{
  const show=!section.classList.contains('house-show-points');section.classList.toggle('house-show-points',show);event.currentTarget.setAttribute('aria-pressed',String(show));marker.visible=show;connectionGroup.visible=show;requestRender();
});
const flightViews={
  sala:{position:[.15,2.5,3.72],target:[-2.7,1.65,1.45],hfov:82},
  cinema:{position:[.35,2.1,3.55],target:[-3.75,1.8,1.45],hfov:68},
  noite:{position:[4.55,3,3.65],target:[2.4,1.15,.9],hfov:80},
  sair:{position:[12,8.5,13],target:[1,1,1.25],hfov:60},
  cheguei:{position:[.15,2.55,3.72],target:[-2.6,1.6,1.4],hfov:80},
  inicial:{position:[14,13,17],target:[0,.65,0]}
};
function startFlight(id){
  const view=flightViews[id];const target=new THREE.Vector3(...view.target);const destination=new THREE.Vector3(...view.position);
  const positions=id==='inicial'?[camera.position.clone(),camera.position.clone().lerp(overviewPosition,.45),overviewPosition.clone()]:id==='cheguei'?[camera.position.clone(),new THREE.Vector3(10,5.5,10),new THREE.Vector3(7.8,3.2,6.5),new THREE.Vector3(.2,3.8,3.5),destination]:[camera.position.clone(),new THREE.Vector3(...(id==='sair'?[8,6,10]:[3.5,5.5,6])),destination];
  const focus=id==='cheguei'?[controls.target.clone(),new THREE.Vector3(5.3,1,4.5),new THREE.Vector3(5.3,1,4.5),target]:[controls.target.clone(),controls.target.clone().lerp(target,.5),target];
  cameraTransition={path:new THREE.CatmullRomCurve3(positions),focus:new THREE.CatmullRomCurve3(focus),fromFov:camera.fov,toFov:id==='inicial'?overviewFov():THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(view.hfov/2))/camera.aspect)),start:performance.now(),duration:reduceMotion.matches?0:id==='cheguei'?3400:2800};
  requestRender();
}
controls.addEventListener('start',()=>cameraTransition=null);
function updateScene(time){
  if(sceneTransition){
    const elapsed=time-sceneTransition.start;const noMotion=reduceMotion.matches||sceneTransition.duration===0;
    for(const key of Object.keys(sceneState)){
      const delays=activeScene==='cheguei'?{entry:0,main:500,indirect:700,curtains:700,tv:1800,ac:2200,security:0}:{main:activeScene==='cinema'?1700:0,indirect:activeScene==='cinema'?1600:250,curtains:1000,tv:2100,ac:3500,entry:0,security:500};
      const durations={main:1400,indirect:1600,curtains:2800,tv:2200,ac:1600,entry:1200,security:900};
      let progress=noMotion?1:THREE.MathUtils.clamp((elapsed-delays[key])/durations[key],0,1);progress=progress*progress*(3-2*progress);
      sceneState[key]=THREE.MathUtils.lerp(sceneTransition.from[key],sceneTransition.to[key],progress);
    }
    if(noMotion||elapsed>=sceneTransition.duration){section.classList.remove('scene-running');document.getElementById('house-scene-description').textContent=presets[activeScene].description;sceneTransition=null;}
  }
  if(cameraTransition){
    const flight=cameraTransition;const progress=reduceMotion.matches||!flight.duration?1:THREE.MathUtils.clamp((time-flight.start)/flight.duration,0,1);const eased=progress*progress*(3-2*progress);
    camera.position.copy(flight.path.getPoint(eased));controls.target.copy(flight.focus.getPoint(eased));camera.lookAt(controls.target);
    camera.fov=THREE.MathUtils.lerp(flight.fromFov,flight.toFov,eased);camera.updateProjectionMatrix();if(progress===1)cameraTransition=null;
  }
  if(svgMode)renderer.update(sceneState);
  mainMaterial.emissiveIntensity=sceneState.main*3;mainMaterial.color.setRGB(.15+sceneState.main*.65,.14+sceneState.main*.5,.1+sceneState.main*.3);
  indirectMaterial.emissiveIntensity=sceneState.indirect*5;materials.glow.emissiveIntensity=sceneState.main*2;
  mainLamp.intensity=sceneState.main*45;kitchenLamp.intensity=sceneState.main*22;indirectLamp.intensity=sceneState.indirect*23;entryLamp.intensity=sceneState.entry*15;entryMaterial.emissiveIntensity=sceneState.entry*3;
  hemisphere.intensity=.24+sceneState.main*.1;sun.intensity=.2+sceneState.main*.08;
  const unroll=THREE.MathUtils.clamp(sceneState.tv*1.8,0,1);const projection=THREE.MathUtils.clamp((sceneState.tv-.45)/.55,0,1);
  projectionScreen.scale.y=Math.max(.015,unroll);screenMaterial.opacity=projection;screenMaterial.color.setScalar(1-projection*.4);screenMaterial.emissiveIntensity=projection*1.5;
  lightBeam.visible=projection>.01;lightBeam.children.forEach((object,i)=>object.material.opacity=projection*(i===0?.075:.12));
  tvLamp.intensity=projection*7;tvIndicatorMaterial.color.setHex(projection>.01?0xdbecff:0x233d43);
  livingFlap.rotation.z=-sceneState.ac*.55;bedroomFlap.rotation.z=sceneState.ac*.55;acIndicatorMaterial.color.setHex(sceneState.ac>.1?0x86e9f1:0x182f39);
  securityMaterial.color.setHex(sceneState.security>.5?0xa9ee91:0x294942);
  curtains.forEach((panel,i)=>{const living=i>=2;const width=.66+sceneState.curtains*(living?2.02:.91);panel.scale.x=width/.7;const left=living?-4.85:1.73,right=living?.5:4.87;panel.position.x=i%2===0?left+width/2:right-width/2;});
  airflow.visible=sceneState.ac>.02;
  airflow.children.forEach(object=>object.material.opacity=sceneState.ac*.5);
  airParticles.forEach(({particle,curve,offset})=>{
    const p=reduceMotion.matches?.45:(time*.0003+offset)%1;curve.getPointAt(p,particle.position);particle.material.opacity=sceneState.ac*Math.sin(p*Math.PI)*.65;
  });
  const states={main:Math.round(sceneState.main*100)+'%',indirect:Math.round(sceneState.indirect*100)+'%',tv:sceneState.tv>.6?'Projetando':sceneState.tv>.01?'Abrindo tela':'Desligada',ac:sceneState.ac>.1?(activeScene==='cinema'?'22 °C':'Ligado'):'Desligado',curtains:sceneState.curtains>.95?'Fechadas':sceneState.curtains<.05?'Abertas':sceneTransition?'Ajustando':'Parciais',security:sceneState.security>.5?'Monitorado':'Modo inicial'};
  const stateText=JSON.stringify(states);if(stateText!==lastDeviceText){lastDeviceText=stateText;for(const [key,text] of Object.entries(states)){const el=document.querySelector(`[data-state="${key}"]`);el.querySelector('b').textContent=text;el.dataset.on=String(sceneState[key]>.1);}}
}
sceneCaption.textContent=presets.inicial.caption;updateScene(performance.now());

let selected='cameras';
const pins=systems.map((system,index)=>{
  const button=document.createElement('button');button.type='button';button.className='house-hotspot';button.setAttribute('aria-label',`Explorar ${system.name}`);button.innerHTML=`<span>${String(index+1).padStart(2,'0')}</span><span class="hotspot-name">${system.name}</span>`;button.addEventListener('click',()=>selectSystem(system.id));overlay.append(button);return {button,point:new THREE.Vector3(...system.point)};
});
function selectSystem(id){
  section.classList.add('house-show-points');document.getElementById('house-points').setAttribute('aria-pressed','true');marker.visible=true;connectionGroup.visible=true;
  selected=id;const system=systems.find(s=>s.id===id);
  document.querySelectorAll('.house-systems button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.system===id)));
  pins.forEach((pin,i)=>pin.button.setAttribute('aria-pressed',String(systems[i].id===id)));
  for(const [element,key] of [['house-category','category'],['house-system-title','title'],['house-system-description','description'],['house-system-scenario','scenario'],['house-system-professional','professional']])document.getElementById(element).textContent=system[key];
  marker.position.set(system.point[0],system.point[1]+.12,system.point[2]);
  networkGroup.visible=id==='mesh';hiddenRoutes.forEach((route,i)=>route.visible=systems[i].id===id);
  const detail=document.querySelector('.house-detail');detail.classList.remove('house-system-updated');requestAnimationFrame(()=>detail.classList.add('house-system-updated'));
  requestRender();
}
document.querySelectorAll('.house-systems button').forEach(button=>button.addEventListener('click',()=>selectSystem(button.dataset.system)));
document.getElementById('house-reset').addEventListener('click',()=>startFlight('inicial'));
document.getElementById('house-roof').addEventListener('click',event=>{
  roof.visible=!roof.visible;event.currentTarget.setAttribute('aria-pressed',String(roof.visible));event.currentTarget.textContent=roof.visible?'Interior':'Cobertura';requestRender();
  renderer.setRoof?.(roof.visible);
  if(renderer.shadowMap) renderer.shadowMap.needsUpdate=true;
});

const projected=new THREE.Vector3();
function updatePins(){
  const width=mount.clientWidth,height=mount.clientHeight;
  pins.forEach(pin=>{
    projected.copy(pin.point).project(camera);
    const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
    pin.button.style.left=`${Math.max(17,Math.min(width-17,x))}px`;
    pin.button.style.top=`${Math.max(17,Math.min(height-17,y))}px`;
    pin.button.hidden=svgMode||projected.z>1||projected.z< -1||roof.visible;
  });
}
function resize(){
  const width=mount.clientWidth,height=mount.clientHeight;if(!width||!height)return;
  if(!svgMode){
    const nativeDensity=Math.max(2,devicePixelRatio||1);
    const limit=renderer.capabilities.maxTextureSize;
    renderer.setPixelRatio(Math.min(nativeDensity,limit/Math.max(width,height)));
  }
  camera.aspect=width/height;if(!cameraTransition&&camera.position.distanceTo(overviewPosition)<.5)camera.fov=overviewFov();camera.updateProjectionMatrix();renderer.setSize(width,height);realism?.resize(width,height);requestRender();
}
let visible=false,frame=0,lastTime=0,rendering=false;
let renderWarmupFrames=0;
const frameInterval=1000/60;
function render(time=0){
  frame=0;
  if(document.hidden)return;
  // Reconcile visibility after programmatic scrolling and mobile viewport changes.
  const bounds=stage.getBoundingClientRect();
  visible=bounds.bottom>0&&bounds.top<(window.visualViewport?.height||innerHeight);
  if(visible)document.body.classList.add('house-in-view');
  rendering=true;let controlChanged=false;
  const elapsed=time-lastTime;
  if(reduceMotion.matches||elapsed>=frameInterval-1||(!sceneTransition&&!cameraTransition&&sceneState.ac<=.02)){
    updateScene(time);controlChanged=cameraTransition?false:controls.update();
    if(!reduceMotion.matches){const pulse=1+Math.sin(time*.002)*.1;marker.scale.setScalar(pulse);networkGroup.children.forEach((object,i)=>{if(object.material?.opacity!==undefined)object.material.opacity=.35+Math.sin(time*.0015+i)*.12;});}
    if(realism){realism.update(time,sceneState,sceneTransition||cameraTransition);realism.render();renderWarmupFrames=Math.max(0,renderWarmupFrames-1);}
    else renderer.render(scene,camera);
    if(section.classList.contains('house-show-points'))updatePins();
    // Carry fractional frame time forward for consistent pacing on 60/90/120 Hz screens.
    lastTime=time-(elapsed%frameInterval);
  }
  rendering=false;
  if(visible&&!frame&&(renderWarmupFrames>0||(!reduceMotion.matches&&(sceneTransition||cameraTransition||sceneState.ac>.02||controlChanged||marker.visible||networkGroup.visible))))frame=requestAnimationFrame(render);
}
function requestRender(){if(!frame&&!rendering)frame=requestAnimationFrame(render);}
controls.addEventListener('change',requestRender);
new ResizeObserver(resize).observe(mount);
new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;
  if(visible)requestRender();else if(frame&&!sceneTransition&&!cameraTransition&&renderWarmupFrames===0){cancelAnimationFrame(frame);frame=0;}
},{threshold:.05}).observe(stage);
new IntersectionObserver(entries=>document.body.classList.toggle('house-in-view',entries[0].isIntersecting),{threshold:.03}).observe(document.querySelector('.house-experience'));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else if(visible)requestRender();});
reduceMotion.addEventListener('change',()=>{controls.enableDamping=!svgMode&&!reduceMotion.matches;requestRender();});
// Batch fixed architecture by material to reduce GPU draw calls. Animated parts stay independent.
if(!svgMode){
  const batches=new Map();const animated=new Set([...curtains,tvScreen,marker]);
  scene.updateMatrixWorld(true);
  for(const object of [...scene.children]){
    if(!object.isMesh||animated.has(object)||object.material.transparent||Array.isArray(object.material))continue;
    const key=object.material.uuid;if(!batches.has(key))batches.set(key,{material:object.material,meshes:[],geometries:[]});
    const batch=batches.get(key);let geometry=object.geometry.clone();if(geometry.index){const indexed=geometry;geometry=geometry.toNonIndexed();indexed.dispose();}geometry.applyMatrix4(object.matrixWorld);batch.meshes.push(object);batch.geometries.push(geometry);
  }
  for(const batch of batches.values()){
    if(batch.meshes.length<2){batch.geometries.forEach(geometry=>geometry.dispose());continue;}
    const merged=mergeGeometries(batch.geometries,false);batch.geometries.forEach(geometry=>geometry.dispose());if(!merged)continue;
    const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);batch.meshes.forEach(object=>scene.remove(object));
  }
}
if(!svgMode){
  try{
    const {enhanceHouse}=await import('./house-realism.js?v=real25');
    realism=enhanceHouse({renderer,scene,camera,materials,curtains,mainLamp,kitchenLamp,mobile:mobileView.matches,modest:modestDevice});
    renderWarmupFrames=6;
  }catch(error){console.warn('O acabamento avançado não carregou. A experiência principal continua disponível.',error);}
}
selectSystem(selected);marker.visible=false;connectionGroup.visible=false;section.classList.remove('house-show-points');document.getElementById('house-points').setAttribute('aria-pressed','false');resize();stage.classList.add('house-ready');
