import * as THREE from 'three';
import {EffectComposer} from './assets/three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './assets/three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './assets/three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './assets/three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from './assets/three/addons/postprocessing/ShaderPass.js';
import {Reflector} from './assets/three/addons/objects/Reflector.js';
import {RoomEnvironment} from './assets/three/addons/environments/RoomEnvironment.js';

export function enhanceHouse({renderer,scene,camera,materials,curtains,mainLamp,kitchenLamp,mobile,modest}){
  let seed=719;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),mobile?4:8);
  function texture(draw,size=512,color=true){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);
    const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=anisotropy;if(color)map.colorSpace=THREE.SRGBColorSpace;return map;
  }
  const oak=texture((ctx,size)=>{
    for(let plank=0;plank<8;plank++){
      const y=plank*size/8,h=size/8;const shade=158+random()*24;
      ctx.fillStyle=`rgb(${shade+28},${shade+4},${shade-30})`;ctx.fillRect(0,y,size,h);
      for(let i=0;i<90;i++){
        ctx.strokeStyle=`rgba(${random()>.55?'74,47,20':'248,218,168'},${.015+random()*.065})`;ctx.lineWidth=.3+random();ctx.beginPath();
        const base=y+random()*h;for(let x=0;x<=size;x+=8){const curve=base+Math.sin(x*.024+plank+i)*(.3+random()*1.1);if(x===0)ctx.moveTo(x,curve);else ctx.lineTo(x,curve);}ctx.stroke();
      }
      ctx.fillStyle='#44382945';ctx.fillRect(0,y,size,1);ctx.fillStyle='#fff8df25';ctx.fillRect(0,y+1,size,1);
    }
  });
  const grain=texture((ctx,size)=>{ctx.fillStyle='#a0a0a0';ctx.fillRect(0,0,size,size);for(let i=0;i<6000;i++){const tone=125+random()*100;ctx.fillStyle=`rgba(${tone},${tone},${tone},.22)`;ctx.fillRect(random()*size,random()*size,12+random()*65,.5+random());}},256,false);
  const weave=texture((ctx,size)=>{
    ctx.fillStyle='#b4b4b4';ctx.fillRect(0,0,size,size);
    for(let i=0;i<size;i+=3){ctx.fillStyle=i%2?'#919191':'#d0d0d0';ctx.fillRect(i,0,1,size);ctx.fillStyle='#919191';ctx.fillRect(0,i,size,1);}
    for(let i=0;i<5000;i++){ctx.fillStyle=random()>.5?'#ddd8':'#8886';ctx.fillRect(random()*size,random()*size,1,1);}
  },256,false);weave.repeat.set(9,9);
  const plaster=texture((ctx,size)=>{ctx.fillStyle='#c9c9c9';ctx.fillRect(0,0,size,size);for(let i=0;i<18000;i++){const tone=140+random()*100;ctx.fillStyle=`rgba(${tone},${tone},${tone},.18)`;ctx.fillRect(random()*size,random()*size,1,1);}},256,false);plaster.repeat.set(4,4);
  function physical(key,options){
    const previous=materials[key];const next=new THREE.MeshPhysicalMaterial({color:previous.color,roughness:previous.roughness,metalness:previous.metalness,...options});
    scene.traverse(object=>{if(object.material===previous)object.material=next;});materials[key]=next;return next;
  }
  const floorOak=oak.clone();floorOak.repeat.set(2.6,2);floorOak.needsUpdate=true;
  physical('floor',{color:0xffffff,map:floorOak,bumpMap:grain,bumpScale:.007,roughness:.54,clearcoat:.2,clearcoatRoughness:.45});
  physical('wood',{map:oak,bumpMap:grain,bumpScale:.008,roughness:.48,clearcoat:.16,clearcoatRoughness:.4});
  materials.timber.map=oak;materials.timber.bumpMap=grain;materials.timber.bumpScale=.008;
  materials.wall.color.setHex(0xe9e5db);materials.wall.bumpMap=plaster;materials.wall.bumpScale=.004;materials.wall.roughness=.92;
  physical('sofa',{bumpMap:weave,bumpScale:.013,roughness:.96,sheen:.65,sheenColor:0x809792,sheenRoughness:.85});
  if(materials.linen)physical('linen',{bumpMap:weave,bumpScale:.01,roughness:1,sheen:.45,sheenColor:0xd9d4c7,sheenRoughness:1});
  physical('metal',{color:0x8b9697,metalness:.9,roughness:.26,clearcoat:.3});
  physical('glass',{color:0xb4d3d6,transparent:true,opacity:.2,roughness:.09,metalness:0,ior:1.5,clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide,depthWrite:false});
  curtains.forEach(panel=>{panel.material.bumpMap=weave;panel.material.bumpScale=.008;panel.material.roughness=1;});
  // Replace solid foliage balls with individually shaded, instanced leaves.
  const oldFoliage=[];scene.traverse(object=>{if(object.isMesh&&object.material===materials.leaf)oldFoliage.push(object);});oldFoliage.forEach(object=>object.removeFromParent());
  const leafMap=texture((ctx,size)=>{
    const gradient=ctx.createLinearGradient(0,0,size,size);gradient.addColorStop(0,'#376f43');gradient.addColorStop(.5,'#235835');gradient.addColorStop(1,'#5e8750');ctx.fillStyle=gradient;
    ctx.beginPath();ctx.moveTo(size*.5,size*.05);ctx.bezierCurveTo(size*.96,size*.3,size*.9,size*.76,size*.5,size*.96);ctx.bezierCurveTo(size*.1,size*.76,size*.04,size*.3,size*.5,size*.05);ctx.fill();
    ctx.strokeStyle='#bbcf814a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(size*.5,size*.12);ctx.lineTo(size*.5,size*.88);ctx.stroke();
    for(let i=0;i<7;i++){const y=size*(.25+i*.075);ctx.beginPath();ctx.moveTo(size*.5,y);ctx.lineTo(size*.23,y-size*.085);ctx.moveTo(size*.5,y);ctx.lineTo(size*.77,y-size*.085);ctx.stroke();}
  },128);
  const leafGeometry=new THREE.PlaneGeometry(.18,.28,2,2);const leafPositions=leafGeometry.attributes.position;
  for(let i=0;i<leafPositions.count;i++)leafPositions.setZ(i,Math.sin(leafPositions.getY(i)*15)*.022);leafGeometry.computeVertexNormals();
  const leafMaterial=new THREE.MeshStandardMaterial({map:leafMap,roughness:.83,side:THREE.DoubleSide,alphaTest:.45});
  const crowns=[[-6.15,1.65,3.8,.75,300],[-6.12,1.65,-2.8,.75,300],[5.95,1.58,-3.3,.55,230]];
  for(let i=0;i<9;i++)crowns.push([-4.7+i*.47,.22,5.9,.25,45]);
  for(let i=0;i<5;i++)crowns.push([6.25,.2,-2+i*.45,.21,35]);
  const foliage=new THREE.InstancedMesh(leafGeometry,leafMaterial,crowns.reduce((count,crown)=>count+crown[4],0));const leafTransform=new THREE.Object3D();let leafIndex=0;
  for(const [x,y,z,radius,count] of crowns)for(let i=0;i<count;i++){
    const angle=random()*Math.PI*2,height=random()*2-1,distance=radius*Math.cbrt(random());const radial=Math.sqrt(1-height*height);
    leafTransform.position.set(x+Math.cos(angle)*radial*distance,y+height*distance*.8,z+Math.sin(angle)*radial*distance);leafTransform.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI);leafTransform.scale.setScalar(.65+random()*.75);leafTransform.updateMatrix();foliage.setMatrixAt(leafIndex++,leafTransform.matrix);
  }
  foliage.castShadow=true;foliage.receiveShadow=true;scene.add(foliage);
  const environmentScene=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(environmentScene,.05);scene.environment=environment.texture;scene.environmentIntensity=.12;environmentScene.dispose();pmrem.dispose();
  scene.background=new THREE.Color(0x0b202c);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  mainLamp.position.y=2.84;kitchenLamp.position.y=2.84;
  mainLamp.castShadow=true;mainLamp.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);mainLamp.shadow.camera.near=.15;mainLamp.shadow.camera.far=10;mainLamp.shadow.bias=-.0003;mainLamp.shadow.normalBias=.015;mainLamp.shadow.radius=3;
  // Contact occlusion remains available on the light profile and uses no extra render pass.
  const contact=texture((ctx,size)=>{const gradient=ctx.createRadialGradient(size/2,size/2,size*.08,size/2,size/2,size*.5);gradient.addColorStop(0,'#0009');gradient.addColorStop(.5,'#0005');gradient.addColorStop(1,'#0000');ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);},128);
  for(const [x,z,w,d] of [[-2.15,2.9,3.4,1.7],[-2.1,1.3,1.6,1.6],[2.75,1.7,2.9,3.4],[-2.2,-1.95,3.3,1.5],[2.85,-1.45,1.2,1.2]]){
    const shade=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:contact,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));shade.rotation.x=-Math.PI/2;shade.position.set(x,.378,z);scene.add(shade);
  }
  // Interior ceiling appears only after entering the house, preserving the cutaway overview.
  const ceiling=new THREE.Group();scene.add(ceiling);
  for(const [x,z,w,d] of [[-2.2,1.6,5.6,4.8],[2.85,1.65,4.3,4.7]]){
    const board=new THREE.Mesh(new THREE.BoxGeometry(w,.07,d),materials.wall);board.position.set(x,3.12,z);board.receiveShadow=true;ceiling.add(board);
  }
  ceiling.visible=false;
  const ambientLight=scene.children.find(object=>object.isHemisphereLight);
  const daylight=scene.children.find(object=>object.isDirectionalLight&&object.castShadow);
  const rimLight=scene.children.find(object=>object.isDirectionalLight&&!object.castShadow);
  const floatTargets=renderer.extensions.has('EXT_color_buffer_float');
  let reflector=null,lastReflection=-Infinity,lastShadow=-Infinity;
  if(floatTargets&&!modest){
    const resolution=mobile?384:768;
    reflector=new Reflector(new THREE.PlaneGeometry(10,8),{textureWidth:resolution,textureHeight:resolution,color:0xffffff,clipBias:.003,multisample:0});
    reflector.rotation.x=-Math.PI/2;reflector.position.y=.374;
    reflector.material.transparent=true;reflector.material.depthWrite=false;
    reflector.material.uniforms.reflectionOpacity={value:.13};reflector.material.uniforms.texelSize={value:new THREE.Vector2(1/resolution,1/resolution)};
    reflector.material.fragmentShader=`uniform sampler2D tDiffuse; uniform float reflectionOpacity; uniform vec2 texelSize; varying vec4 vUv;
      void main(){vec2 uv=vUv.xy/vUv.w;vec2 blur=texelSize*2.5;vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
      reflection+=texture2D(tDiffuse,uv+blur).rgb*.15;reflection+=texture2D(tDiffuse,uv-blur).rgb*.15;
      reflection+=texture2D(tDiffuse,uv+vec2(blur.x,-blur.y)).rgb*.15;reflection+=texture2D(tDiffuse,uv+vec2(-blur.x,blur.y)).rgb*.15;
      gl_FragColor=vec4(reflection,reflectionOpacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`;
    const reflect=reflector.onBeforeRender;
    reflector.onBeforeRender=function(...args){const now=performance.now();if(now-lastReflection<(mobile?65:33))return;lastReflection=now;reflect.apply(this,args);};
    scene.add(reflector);
  }
  const target=new THREE.WebGLRenderTarget(1,1,{type:floatTargets?THREE.HalfFloatType:THREE.UnsignedByteType,samples:modest?0:2});
  const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  let bloom=null;if(floatTargets&&!modest){bloom=new UnrealBloomPass(new THREE.Vector2(1,1),mobile?.085:.12,.25,1.8);composer.addPass(bloom);}
  composer.addPass(new OutputPass());
  const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},vignette:{value:.09}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float vignette;varying vec2 vUv;void main(){vec4 sampleColor=texture2D(tDiffuse,vUv);vec3 color=(sampleColor.rgb-.5)*1.035+.5;float edge=smoothstep(.22,.76,length(vUv-.5));color*=1.-edge*vignette;gl_FragColor=vec4(color,sampleColor.a);}'});
  composer.addPass(grade);
  let costlyFrames=0,reduced=false,previousFrame=0,lateFrames=0;
  renderer.shadowMap.needsUpdate=true;
  function reduceEffects(){if(reduced)return;reduced=true;if(bloom)bloom.enabled=false;if(reflector)reflector.visible=false;}
  return {
    resize(width,height){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(width,height);},
    update(time,state,transition){
      if(bloom)bloom.enabled=!reduced&&(state.main>.01||state.tv>.01);
      scene.environmentIntensity=.12+state.main*.065;renderer.toneMappingExposure=.98-state.main*.08;
      const frameTime=time-previousFrame;previousFrame=time;
      if(frameTime>34&&frameTime<250)lateFrames++;else if(frameTime<25)lateFrames=Math.max(0,lateFrames-1);
      if(lateFrames>36)reduceEffects();
      const interior=camera.position.y<3.08&&camera.position.x<5.1&&camera.position.x>-5.1&&camera.position.z<4.1&&camera.position.z>-4.1;
      if(ambientLight)ambientLight.intensity=interior?.28+state.main*.1:.95;
      if(daylight)daylight.intensity=interior?.2:.85;
      if(rimLight)rimLight.intensity=interior?.17:.5;
      scene.environmentIntensity=interior?.12+state.main*.065:.33;
      if(ceiling.visible!==interior){ceiling.visible=interior;renderer.shadowMap.needsUpdate=true;lastReflection=-Infinity;}
      if(transition&&time-lastShadow>(mobile?180:100)){renderer.shadowMap.needsUpdate=true;lastShadow=time;}
      if(reflector){reflector.material.uniforms.reflectionOpacity.value=.11+state.tv*.025;reflector.visible=!reduced&&(state.main>.01||state.tv>.01);}
    },
    render(){
      const start=performance.now();composer.render();const cost=performance.now()-start;
      costlyFrames=cost>24?costlyFrames+1:Math.max(0,costlyFrames-1);
      if(costlyFrames>45)reduceEffects();
    }
  };
}
