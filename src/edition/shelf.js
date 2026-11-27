// Concept 5 · Game shelf hero
// A shelf of playtest game cases, spine out. The active game is pulled out and turned
// in 3D so its cover faces the viewer. Opening the cover grows a sheet of paper into a
// detail view whose artwork bleeds in like ink. Driven by one requestAnimationFrame loop
// plus the Web Animations API. Reveals are masks, clips and scales, never opacity fades.
import {recruitmentOpen} from '../playtest-features.js';
import {mosaicSection} from './mosaic.js';
import {createMediaHydrator} from '../media-store.js';
import {GENRES,OTHER_GENRE} from '../genres.js';

const DEMO_KEY='playtest-match-project-v1';
const ART={t1:0,t2:1,t3:2,t4:3,t5:4,t6:5,t7:1,t8:0};
// Two case palettes the preview can switch between: soft pastels or saturated colours.
// Each entry is [background, text].
const PASTEL=[['#bfdcff','#14233f'],['#ffd0bd','#3d1d12'],['#d9f2c4','#1d3313'],['#f3d6ff','#2e1640'],['#fff0b3','#3a2f08'],['#c8f1ea','#10332e'],['#ffd3e2','#3d1222'],['#e4e1ff','#1f1b45']];
// Gradient: the user's "Torch Red to Spring Green" palette. Each case is one flat colour,
// but neighbours step along the gradient so the shelf reads as one sweep of colour.
// The sweep runs red -> green -> red over the whole loop, so there is no seam where it wraps.
// Three sweeps the preview can switch between:
//  sweep  red -> green (the user's palette), jewel  crimson -> magenta -> violet -> royal blue,
//  sun    yellow -> green -> teal -> blue.
const SWEEPS={
  sweep:[[245,13,48],[219,134,79],[172,198,115],[0,254,153]],
  sun:[[255,200,0],[143,209,79],[25,181,168],[31,91,255]]
};
function sweepColour(t,stops) {
  const span=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(span)),f=span-i;
  const rgb=stops[i].map((c,k)=>Math.round(c+(stops[i+1][k]-c)*f));
  const lum=(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255;
  return ['#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join(''),lum>.55?'#141414':'#ffffff'];
}
const sweepStyle=(v,total)=>{
  const half=total/2,t=Math.max(0,Math.min(1,1-Math.abs((v%total)-half)/half));
  return Object.entries(SWEEPS).map(([name,stops])=>{const [bg,ink]=sweepColour(t,stops);return `;--${name}:${bg};--${name}-ink:${ink}`;}).join('');
};
// Jewel: one saturated, glossy colour per game (not a sweep), in the spirit of the crimson case.
const JEWEL=[['#f50d30','#ffffff'],['#1f5bff','#ffffff'],['#00a86b','#ffffff'],['#8a2be2','#ffffff'],['#ff7a00','#ffffff'],['#e5157a','#ffffff'],['#0096c7','#ffffff'],['#c9a100','#141414']];
// Natural: earthy, cloth-bound tones (sage, terracotta, ochre, dusty blue...).
const NATURAL=[['#a9b89c','#1f2a1a'],['#c98a6b','#2b140a'],['#d8b26a','#2e2208'],['#8fa7bd','#13202c'],['#b39bb0','#2a1a28'],['#9aa07a','#1f2210'],['#cf9e98','#2e1512'],['#6f7d86','#f7f4ee']];
// Between the two: clear colour with some softness.
const MID=[['#7fa8ff','#10204a'],['#ff9478','#3d1408'],['#6fd6a8','#0d2f22'],['#c79bff','#2a1145'],['#ffd666','#3a2c00'],['#6ccdf2','#082a3a'],['#ff8fb4','#3d0c20'],['#9a9cf2','#15164a']];
const VIVID=[['#2f6bff','#ffffff'],['#ff4d2e','#ffffff'],['#00c389','#0b2a20'],['#b14dff','#ffffff'],['#ffd60a','#141414'],['#00b8ff','#062636'],['#ff2e7e','#ffffff'],['#141414','#ffd60a']];
const EASE='cubic-bezier(.2,.8,.2,1)';
const SHEET_EASE='cubic-bezier(.76,0,.18,1)';
const BLOBS=[[150,330,0],[340,600,120],[250,120,220],[90,560,300],[400,250,360],[260,620,420],[230,470,180]];

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const smooth=x=>x*x*(3-2*x);
const genreOf=game=>(Array.isArray(game.genres)&&game.genres[0])||game.genre||OTHER_GENRE;
// Tabs follow the home page: the first eight genres get their own tab, everything else is "그 외".
const MAIN_GENRES=GENRES.slice(0,8);
const tabOf=game=>MAIN_GENRES.includes(genreOf(game))?genreOf(game):OTHER_GENRE;
const english=()=>document.documentElement.lang==='en';

// The live site hands the shelf the catalogue it just rendered; the design preview
// falls back to its demo data in localStorage.
let gameSource=null;
export function setGameSource(source){gameSource=source;}
function loadGames(main) {
  if(gameSource){const games=gameSource();if(Array.isArray(games))return games;}
  try {
    const state=JSON.parse(localStorage.getItem(DEMO_KEY));
    if(Array.isArray(state?.tests))return state.tests.filter(recruitmentOpen);
  } catch {}
  return [...main.querySelectorAll('.catalog-row .row-title')].map(button=>({id:button.dataset.id,title:button.textContent}));
}

function daysLeft(game) {
  if(!game.deadline)return null;
  const today=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
  today.setHours(0,0,0,0);
  return Math.round((new Date(game.deadline+'T00:00:00')-today)/86400000);
}
// One solid colour per genre for the top band of each case, [background, text].
const GENRE_COLOURS={
  '퍼즐':['#2f6bff','#fff'],'로그라이크':['#c62f3a','#fff'],'플랫포머':['#2fae5b','#fff'],'어드벤처':['#e08a1e','#fff'],
  '시뮬레이션':['#14a3a3','#fff'],'액션':['#e5395c','#fff'],'RPG':['#7b45d6','#fff'],'전략':['#3b4a8c','#fff'],
  '생존':['#6c7a2c','#fff'],'공포':['#2b2b2b','#fff'],'슈팅':['#ff5a1f','#fff'],'리듬':['#d63fa6','#fff'],
  '스포츠':['#1c9fd6','#fff'],'레이싱':['#f2c230','#141414'],'비주얼 노벨':['#e58fb3','#141414'],'그 외':['#8a8a8a','#fff']
};
const genreStyle=game=>{const [bg,ink]=GENRE_COLOURS[genreOf(game)]||GENRE_COLOURS['그 외'];return `;--genre:${bg};--genre-ink:${ink}`;};
// The developer's main image: the cover flagged image, else the first uploaded image.
const mainImage=game=>game.media?.find(item=>item.kind==='image'&&item.cover)||game.media?.find(item=>item.kind==='image');
// Photo spine: the main image fills the spine; games without uploads use their concept art.
const spinePhoto=game=>{const image=mainImage(game);return `<span class="pack-spine-photo">${image?`<img data-media-id="${esc(image.id)}" alt="">`:`<span class="${artClass(game)}"></span>`}</span>`;};
const artClass=game=>'shelf-art '+(Object.hasOwn(ART,game.id)?'shelf-art-'+ART[game.id]:'shelf-art-default');

// Game-pack look: a thin plastic case whose colour and top band come from the platform,
// like console game cases on a shop shelf.
const PLATFORM={
  WebGL:{band:'#d24d2c',shell:'light',label:'WEB'},
  Windows:{band:'#1f3fb0',shell:'dark',label:'PC'},
  Android:{band:'#1f8a5b',shell:'light',label:'MOBILE'}
};
const platformOf=game=>PLATFORM[game.platform]||{band:'#141414',shell:'light',label:String(game.platform||'GAME').toUpperCase()};
// Every game gets its own case colour, picked by its position in the catalogue.
const caseStyle=index=>{const [nb,nf]=NATURAL[index%NATURAL.length],[pb,pf]=PASTEL[index%PASTEL.length],[mb,mf]=MID[index%MID.length],[vb,vf]=VIVID[index%VIVID.length];const [jb,jf]=JEWEL[index%JEWEL.length];return `--jewel:${jb};--jewel-ink:${jf};--natural:${nb};--natural-ink:${nf};--pastel:${pb};--pastel-ink:${pf};--mid:${mb};--mid-ink:${mf};--vivid:${vb};--vivid-ink:${vf}`;};
function spineHtml(game,index,sweep='') {
  const p=platformOf(game);
  return `<div class="shelf-face shelf-spine pack-colour" style="${caseStyle(index)}${sweep}${genreStyle(game)}">
    ${spinePhoto(game)}
    <span class="pack-band"><b>${esc(p.label)}</b></span>
    <span class="shelf-spine-title" style="--len:${Math.max(5,[...String(game.title)].length)}">${esc(game.title)}</span>
    <span class="pack-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </div>`;
}
function coverHtml(game,index,sweep='') {
  const p=platformOf(game);
  return `<div class="shelf-face shelf-cover pack-light" style="${caseStyle(index)}${sweep}${genreStyle(game)}">
    <div class="pack-cover-band"><span>${esc(p.label)}</span><span class="pack-cover-brand">IndieTest</span></div>
    <div class="pack-cover-art">
      ${mainImage(game)?`<img class="shelf-cover-photo" data-media-id="${esc(mainImage(game).id)}" alt="">`:`<div class="${artClass(game)}"></div>`}
      <strong class="shelf-cover-title">${esc(game.title)}</strong>
      <span class="pack-cover-studio">${esc(game.team||'')}</span>
    </div>
  </div>`;
}

// Header menu: one yellow block slides between Home / Tester / Developer / Admin,
// like the genre tabs. The app re-renders the menu on every navigation, so the block
// is re-attached at its old place and then moved, which lets CSS animate the change.
function attachMenuIndicator() {
  const menu=document.getElementById('menu');
  if(!menu)return ()=>{};
  const block=document.createElement('span');
  block.className='menu-indicator';
  block.setAttribute('aria-hidden','true');
  let placed=false;
  const place=()=>{
    if(!block.isConnected)menu.prepend(block);
    const current=menu.querySelector('a[aria-current=page]');
    if(!current){block.style.opacity='0';return;}
    const apply=()=>{
      block.style.opacity='1';
      block.style.width=current.offsetWidth+'px';
      block.style.height=current.offsetHeight+'px';
      block.style.transform=`translate(${current.offsetLeft}px,${current.offsetTop}px)`;
    };
    if(!placed){block.style.transition='none';apply();block.getBoundingClientRect();block.style.transition='';placed=true;}
    else requestAnimationFrame(apply);
  };
  const observer=new MutationObserver(()=>{if(!block.isConnected)place();});
  observer.observe(menu,{childList:true});
  window.addEventListener('resize',place);
  place();
  return ()=>{observer.disconnect();window.removeEventListener('resize',place);block.remove();};
}

export function attachShelf(main) {
  const shelfMedia=createMediaHydrator();
  const detachMenu=attachMenuIndicator();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(pointer: fine)');
  let games=[];
  let copies=3;
  let tapes=[];
  let s=0,T=0,active=-1,hover=-1;
  let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
  let tiltX=0,tiltY=0,onCover=false,isOpen=false,inside=false;
  let dims={H:300,ws:50,d:210,gap:9};
  let frame=0,last=performance.now();
  let drag=null,suppressClick=false,wheelTimer=0;
  let blobFrame=0;
  // Performance: cache the shelf's screen box, skip frames when nothing moves,
  // and stop the loop entirely while the shelf is off screen or the tab is hidden.
  let box={left:0,top:0,width:innerWidth,height:400};
  let visible=true,needsFrame=true,lastTiltX=0,lastTiltY=0,lastS=NaN;

  // ---------- Markup ----------
  const hero=document.createElement('section');
  hero.className='spotlight shelf-hero';
  hero.setAttribute('aria-label',english()?'Playtest shelf':'모집 중인 게임 선반');
  hero.innerHTML=`
    <div class="shelf-intro"><p class="shelf-kicker">INDIETEST · NOW RECRUITING</p>
      <h1 class="shelf-heading">${english()?'Pull out the game you want.':'원하는 게임을 꺼내보세요.'}</h1></div>
    <nav class="shelf-tabs" aria-label="${english()?'Genres':'장르'}"><span class="shelf-tab-indicator" aria-hidden="true"></span></nav>
    <div class="shelf-viewport" tabindex="0" aria-roledescription="carousel" aria-label="${english()?'Game shelf. Use left and right arrow keys.':'게임 선반. 왼쪽·오른쪽 방향키로 넘길 수 있어요.'}">
      <div class="shelf-stage"></div>
      <button type="button" class="shelf-play" aria-label="${english()?'Open game':'게임 열기'}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor"/></svg></button>
    </div>
    <div class="shelf-caption" aria-live="polite">
      <div class="shelf-mask shelf-cap-title"></div>
      <div class="shelf-mask shelf-cap-sub"></div>
      <div class="shelf-mask shelf-cap-meta"></div>
    </div>
    <button type="button" class="shelf-arrow shelf-prev" aria-label="${english()?'Previous game':'이전 게임'}"><svg viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M5 1 L1 5 L5 9 M1 5 H17" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
    <button type="button" class="shelf-arrow shelf-next" aria-label="${english()?'Next game':'다음 게임'}"><svg viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M13 1 L17 5 L13 9 M17 5 H1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>`;
  const stage=hero.querySelector('.shelf-stage');
  const viewport=hero.querySelector('.shelf-viewport');
  const tabs=hero.querySelector('.shelf-tabs');
  const indicator=hero.querySelector('.shelf-tab-indicator');
  const play=hero.querySelector('.shelf-play');

  const cursor=document.createElement('div');
  cursor.className='shelf-cursor';
  cursor.setAttribute('aria-hidden','true');
  // Open state: a frosted lens with a slowly turning ring of text and an arrow at its centre.
  cursor.innerHTML=`<span class="shelf-cursor-ring"></span><span class="shelf-cursor-dot"></span>
    <span class="shelf-cursor-label"><svg viewBox="0 0 100 100"><defs><path id="shelf-cursor-orbit" d="M50,50 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0"/></defs>
      <text><textPath href="#shelf-cursor-orbit" textLength="242">OPEN THE CASE · 열어 보기 · </textPath></text></svg>
      <i><svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 12 L12 4 M5.5 4 H12 V10.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></i></span>`;

  const grain=document.createElement('div');
  grain.className='shelf-grain';
  grain.setAttribute('aria-hidden','true');

  const detail=document.createElement('div');
  detail.className='shelf-detail';
  detail.setAttribute('role','dialog');
  detail.setAttribute('aria-modal','true');
  detail.setAttribute('aria-labelledby','shelf-detail-title');
  detail.hidden=true;
  detail.innerHTML=`
    <button type="button" class="shelf-close shelf-box">${english()?'Close':'닫기'} / ESC</button>
    <div class="shelf-detail-copy">
      <div class="shelf-mask"><span class="shelf-detail-kicker"></span></div>
      <div class="shelf-mask"><h2 class="shelf-detail-title" id="shelf-detail-title"></h2></div>
      <div class="shelf-mask"><span class="shelf-detail-meta"></span></div>
      <div class="shelf-mask"><p class="shelf-detail-teaser"></p></div>
      <div class="shelf-mask"><div class="shelf-detail-question"><b>${english()?"Developer's question":'개발자의 질문'}</b><p></p></div></div>
      <div class="shelf-mask"><button type="button" class="shelf-detail-cta" data-act="open">${english()?'View playtest':'테스트 살펴보기'} →</button></div>
    </div>
    <div class="shelf-poster"><svg viewBox="0 0 474 640" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="shelf-ink" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="7"/>
          <feDisplacementMap in="SourceGraphic" scale="120" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <mask id="shelf-ink-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="874" height="1040">
          <g filter="url(#shelf-ink)">${BLOBS.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="0" fill="#fff"/>`).join('')}</g>
        </mask>
        <clipPath id="shelf-poster-clip"><rect width="474" height="640"/></clipPath>
      </defs>
      <g clip-path="url(#shelf-poster-clip)" mask="url(#shelf-ink-mask)">
        <rect width="474" height="640" fill="#141414"/>
        <svg class="shelf-poster-art" x="0" y="0" width="474" height="640" preserveAspectRatio="xMidYMid slice"><image preserveAspectRatio="none"/></svg>
      </g>
    </svg></div>`;
  const blobs=[...detail.querySelectorAll('circle')];

  // ---------- Geometry ----------
  function measure() {
    const probe=document.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;height:var(--H)';
    hero.append(probe);
    const H=probe.getBoundingClientRect().height||300;
    probe.remove();
    dims={H,ws:H*.12,d:H*.7,gap:H*.022};
    hero.style.setProperty('--ws',dims.ws+'px');
    hero.style.setProperty('--d',dims.d+'px');
    hero.style.setProperty('--Hpx',H+'px');
    needsFrame=true;
  }
  const total=()=>games.length*copies;
  function relative(v) {
    const n=total();
    let r=((v-s)%n+n)%n;
    if(r>n/2)r-=n;
    return r;
  }
  const B=r=>Math.abs(r)<1?(r+Math.sin(Math.PI*r)/Math.PI)/2:Math.sign(r)*.5;
  const F=r=>r*(dims.ws+dims.gap)+(dims.d-dims.ws+1.6*dims.gap)*B(r);

  // ---------- Build ----------
  function build() {
    games=loadGames(main);
    copies=games.length?Math.max(3,Math.ceil(24/games.length)):0;
    stage.replaceChildren();
    tapes=[];
    for(let copy=0;copy<copies;copy++) {
      games.forEach((game,index)=>{
        const tape=document.createElement('div');
        tape.className='shelf-tape';
        const sweep=sweepStyle(copy*games.length+index,copies*games.length);
        tape.innerHTML=spineHtml(game,index,sweep)+coverHtml(game,index,sweep);
        const v=copy*games.length+index;
        tape.addEventListener('pointerenter',()=>{hover=v;wake();});
        tape.addEventListener('pointerleave',()=>{if(hover===v)hover=-1;wake();});
        tape.addEventListener('click',event=>{
          if(suppressClick){suppressClick=false;return;}
          event.stopPropagation();
          const r=relative(v);
          if(Math.abs(r)<.5)openDetail();
          else {T=Math.round(T+r);wake();}
        });
        stage.append(tape);
        tapes.push({el:tape,v,index,lift:0,spine:tape.firstElementChild,cover:tape.lastElementChild,transform:'',shown:true,front:false});
      });
    }
    const present=new Set(games.map(tabOf));
    tabs.querySelectorAll('button').forEach(button=>button.remove());
    for(const genre of [english()?'All':'전체',...MAIN_GENRES.filter(genre=>present.has(genre)),OTHER_GENRE]) {
      const button=document.createElement('button');
      button.type='button';
      button.className='shelf-tab shelf-box';
      button.textContent=genre;
      button.dataset.genre=genre;
      const empty=genre===OTHER_GENRE&&!present.has(OTHER_GENRE);
      if(empty){button.classList.add('is-empty');button.setAttribute('aria-disabled','true');button.title=english()?'No games yet':'아직 이 분류의 게임이 없어요';}
      button.addEventListener('click',()=>{if(!empty)jumpToGenre(genre);});
      tabs.append(button);
    }
    void shelfMedia.hydrate(stage);
    // No recruiting games yet: keep the hero, show an empty shelf that invites the first upload.
    hero.classList.toggle('is-empty',!games.length);
    hero.querySelector('.shelf-empty')?.remove();
    if(!games.length) {
      const empty=document.createElement('div');
      empty.className='shelf-empty';
      empty.innerHTML=`<div class="shelf-empty-row" aria-hidden="true">${Array.from({length:14},(_,i)=>`<span style="--i:${i}"></span>`).join('')}</div>
        <div class="shelf-empty-card"><p class="shelf-empty-title">${english()?'The shelf is waiting for its first game.':'선반이 첫 번째 게임을 기다리고 있어요.'}</p>
        <p>${english()?'Post a build and players will find it here first.':'개발 중인 게임을 올리면 가장 먼저 이곳에 꽂혀요.'}</p>
        <a class="btn" href="#developer" data-nav="developer" data-sub="new">${english()?'Post the first playtest':'첫 테스트 등록하기'}</a></div>`;
      viewport.append(empty);
    }
    const middle=Math.floor(copies/2)*games.length;
    const start=games.findIndex(game=>daysLeft(game)!==null&&daysLeft(game)<=7);
    s=T=middle+Math.max(0,start);
    active=-1;
    measure();
    caption(0);
    wake();
  }

  function jumpToGenre(genre) {
    const n=games.length;
    const targets=games.map((game,index)=>({game,index})).filter(({game})=>genre==='전체'||genre==='All'||tabOf(game)===genre);
    if(!targets.length)return;
    const index=targets[0].index;
    const current=((Math.round(T)%n)+n)%n;
    let delta=index-current;
    if(delta>n/2)delta-=n;
    if(delta<-n/2)delta+=n;
    T=Math.round(T)+delta;
    wake();
  }

  // ---------- Caption ----------
  function swap(container,text,dir) {
    const next=document.createElement('span');
    next.textContent=text;
    // The incoming line always stays in normal flow, so the caption keeps its height
    // and nothing below the shelf moves; outgoing lines are lifted out of flow.
    const old=[...container.children].filter(child=>!child.dataset.leaving);
    for(const child of old){child.dataset.leaving='1';child.style.position='absolute';}
    container.append(next);
    if(reduced.matches||!dir){old.forEach(child=>child.remove());return;}
    next.animate([{transform:`translateY(${dir*105}%)`},{transform:'translateY(0)'}],{duration:650,easing:EASE,fill:'both'});
    for(const child of old) {
      child.animate([{transform:getComputedStyle(child).transform==='none'?'translateY(0)':getComputedStyle(child).transform},{transform:`translateY(${-dir*105}%)`}],{duration:650,easing:EASE,fill:'both'})
        .finished.then(()=>child.remove(),()=>child.remove());
    }
  }
  function caption(dir) {
    const n=games.length;
    if(!n)return;
    const index=((Math.round(s)%n)+n)%n;
    if(index===active)return;
    active=index;
    const game=games[index];
    const days=daysLeft(game);
    swap(hero.querySelector('.shelf-cap-title'),game.title,dir);
    swap(hero.querySelector('.shelf-cap-sub'),[game.team,genreOf(game)].filter(Boolean).join(' / '),dir);
    const due=days===null?'':days<=0?(english()?'closes today':'오늘 마감'):'D-'+days;
    swap(hero.querySelector('.shelf-cap-meta'),[game.platform,game.minutes?(english()?game.minutes+' min':game.minutes+'분'):'',game.slots?`${game.applicants||0}/${game.slots}${english()?'':'명'}`:'',due].filter(Boolean).join(' · '),dir);
    const genre=tabOf(game);
    const tab=[...tabs.querySelectorAll('.shelf-tab')].find(button=>button.dataset.genre===genre);
    tabs.querySelectorAll('.shelf-tab').forEach(button=>button.classList.toggle('is-active',button===tab));
    if(tab){indicator.style.width=tab.offsetWidth+'px';indicator.style.transform=`translateX(${tab.offsetLeft}px)`;indicator.hidden=false;}
  }

  // ---------- Frame ----------
  function cacheBox() {
    const rect=viewport.getBoundingClientRect();
    box={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    needsFrame=true;
  }
  function wake() {
    needsFrame=true;
    if(!frame&&visible&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  function tick(now) {
    frame=0;
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));
    last=now;
    if(!games.length||!hero.isConnected||!visible||document.hidden)return;
    const k=reduced.matches?1e3:drag?.moved?18:5.2;
    s+=(T-s)*(1-Math.exp(-k*dt));
    if(Math.abs(T-s)<1e-4)s=T;
    const loop=total();
    if(Math.abs(s)>loop*4){const shift=Math.round(s/loop)*loop;s-=shift;T-=shift;}
    caption(Math.sign(T-s)||1);

    const midX=box.left+box.width/2,midY=box.top+box.height/2;
    onCover=!isOpen&&inside&&Math.abs(mx-midX)<.55*dims.d&&Math.abs(my-midY)<.55*dims.H&&Math.abs(T-s)<.3;
    const targetY=onCover?(mx-midX)/(.55*dims.d)*9:(mx-midX)/innerWidth*5;
    const targetX=onCover?-(my-midY)/(dims.H/2)*6:0;
    const ease=reduced.matches?1:1-Math.exp(-7*dt);
    tiltY+=(targetY-tiltY)*ease;
    tiltX+=(targetX-tiltX)*ease;

    let moving=s!==T||Math.abs(targetY-tiltY)>.02||Math.abs(targetX-tiltX)>.02;
    const changed=needsFrame||s!==lastS||Math.abs(tiltX-lastTiltX)>.005||Math.abs(tiltY-lastTiltY)>.005;
    const limit=box.width/2+1.5*dims.d;
    for(const tape of tapes) {
      const liftTarget=hover===tape.v&&Math.abs(relative(tape.v))>.5?1:0;
      if(tape.lift!==liftTarget) {
        tape.lift+=(liftTarget-tape.lift)*(reduced.matches?1:1-Math.exp(-12*dt));
        if(Math.abs(tape.lift-liftTarget)<.002)tape.lift=liftTarget;
        moving=true;
      } else if(!changed) continue;
      const r=relative(tape.v);
      const x=F(r);
      const show=Math.abs(x)<=limit;
      if(show!==tape.shown){tape.shown=show;tape.el.style.visibility=show?'':'hidden';}
      if(!show)continue;
      const o=smooth(Math.max(0,1-Math.abs(r)));
      const y=-o*.025*dims.H-tape.lift*.045*dims.H;
      const transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${(o*.2*dims.H).toFixed(2)}px) rotateZ(${(-4.5*o).toFixed(3)}deg) rotateX(${(tiltX*o).toFixed(3)}deg) rotateY(${(-90*o+tiltY*o).toFixed(3)}deg)`;
      if(transform!==tape.transform) {
        tape.transform=transform;
        tape.el.style.transform=transform;
        tape.el.style.zIndex=Math.round(100-Math.abs(r)*4);
        tape.spine.style.setProperty('--shade',(o*.55).toFixed(3));
        tape.cover.style.setProperty('--shade',((1-o)*.5).toFixed(3));
        const front=o>.5;
        if(front!==tape.front){tape.front=front;tape.cover.classList.toggle('is-front',front);}
        // A cover seen edge-on is invisible anyway; skip painting it.
        const hidden=o<.01;
        if(hidden!==tape.coverHidden){tape.coverHidden=hidden;tape.cover.style.visibility=hidden?'hidden':'';}
      }
    }
    lastS=s;lastTiltX=tiltX;lastTiltY=tiltY;needsFrame=false;
    const settle=smooth(Math.max(0,1-Math.abs(T-s)*3));
    play.style.transform=`translate(-50%,-50%) scale(${isOpen?0:settle.toFixed(3)})`;

    if(inside&&fine.matches) {
      const follow=reduced.matches?1:1-Math.exp(-16*dt);
      cx+=(mx-cx)*follow;cy+=(my-cy)*follow;
      cursor.style.transform=`translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      if(Math.abs(mx-cx)>.3||Math.abs(my-cy)>.3)moving=true;
      const overTape=hover>=0&&Math.abs(relative(hover))>.5;
      cursor.classList.toggle('is-open',onCover);
      cursor.classList.toggle('is-spine',!onCover&&overTape);
    }
    if(moving||drag)frame=requestAnimationFrame(tick);
  }

  // ---------- Input ----------
  viewport.addEventListener('pointerenter',()=>{inside=true;cx=mx;cy=my;cursor.classList.add('is-visible');wake();});
  viewport.addEventListener('pointerleave',()=>{inside=false;cursor.classList.remove('is-visible');hover=-1;wake();});
  const onMove=event=>{mx=event.clientX;my=event.clientY;if(inside||drag)wake();
    if(drag){const dx=event.clientX-drag.x;if(Math.abs(dx)>5)drag.moved=true;if(drag.moved)T=drag.T-dx/(dims.ws+dims.gap);}};
  window.addEventListener('pointermove',onMove,{passive:true});
  viewport.addEventListener('pointerdown',event=>{if(event.target.closest('.shelf-play'))return;drag={x:event.clientX,T,moved:false};});
  const endDrag=()=>{if(drag?.moved){T=Math.round(T);wake();suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}drag=null;};
  window.addEventListener('pointerup',endDrag);
  viewport.addEventListener('click',()=>{if(onCover&&!suppressClick)openDetail();});
  // Only sideways wheel or trackpad motion moves the shelf; vertical scrolling stays with the page.
  viewport.addEventListener('wheel',event=>{
    if(isOpen||Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;
    event.preventDefault();
    T+=event.deltaX/(dims.ws+dims.gap)*.5;
    wake();
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(()=>{T=Math.round(T);wake();},160);
  },{passive:false});
  viewport.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();T=Math.round(T)-1;wake();}
    if(event.key==='ArrowRight'){event.preventDefault();T=Math.round(T)+1;wake();}
    if(event.key==='Enter'){event.preventDefault();openDetail();}
  });
  hero.querySelector('.shelf-prev').addEventListener('click',()=>{T=Math.round(T)-1;wake();});
  hero.querySelector('.shelf-next').addEventListener('click',()=>{T=Math.round(T)+1;wake();});
  play.addEventListener('click',event=>{event.stopPropagation();openDetail();});
  const onKey=event=>{if(event.key==='Escape'&&isOpen)closeDetail();};
  window.addEventListener('keydown',onKey);
  detail.querySelector('.shelf-close').addEventListener('click',closeDetail);
  detail.querySelector('.shelf-detail-cta').addEventListener('click',()=>closeDetail(true));
  const resize=()=>{measure();cacheBox();wake();};
  window.addEventListener('resize',resize);
  const onScroll=()=>{cacheBox();};
  window.addEventListener('scroll',onScroll,{passive:true});
  const seen=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){cacheBox();wake();}});
  seen.observe(viewport);
  const onVisibility=()=>{if(!document.hidden)wake();};
  document.addEventListener('visibilitychange',onVisibility);

  // ---------- Open / close ----------
  function activeTape() {
    let best=null,distance=Infinity;
    for(const tape of tapes){const r=Math.abs(relative(tape.v));if(r<distance){distance=r;best=tape;}}
    return best;
  }
  function insetFrom(rect) {
    return `inset(${rect.top}px ${innerWidth-rect.right}px ${innerHeight-rect.bottom}px ${rect.left}px round 3px)`;
  }
  async function posterArt(game) {
    const probe=document.createElement('div');
    probe.className=artClass(game);
    probe.style.cssText='position:absolute;width:10px;height:10px;visibility:hidden';
    hero.append(probe);
    const style=getComputedStyle(probe);
    const url=style.backgroundImage.slice(5,-2);
    const sprite=style.backgroundSize.startsWith('300%');
    const position=style.backgroundPosition.split(' ').map(value=>parseFloat(value)/100);
    probe.remove();
    const image=new Image();
    image.src=url;
    try{await image.decode();}catch{}
    const W=image.naturalWidth||1600,H=image.naturalHeight||900;
    const tw=sprite?W/3:W,th=sprite?H/2:H;
    const tx=sprite?Math.round(position[0]*2)*tw:0,ty=sprite?Math.round(position[1])*th:0;
    const art=detail.querySelector('.shelf-poster-art');
    art.setAttribute('viewBox',`${tx} ${ty} ${tw} ${th}`);
    const img=art.querySelector('image');
    img.setAttribute('href',url);
    img.setAttribute('width',W);
    img.setAttribute('height',H);
  }
  function grow(start) {
    cancelAnimationFrame(blobFrame);
    const step=now=>{
      const elapsed=now-start;
      for(const [i,circle] of blobs.entries()) {
        const p=Math.min(1,Math.max(0,(elapsed-BLOBS[i][2])/1250));
        circle.setAttribute('r',720*(1-(1-p)**3));
      }
      if(elapsed<2400)blobFrame=requestAnimationFrame(step);
    };
    blobFrame=requestAnimationFrame(step);
  }
  async function openDetail() {
    if(isOpen||!games.length)return;
    T=Math.round(T);
    const game=games[active];
    const tape=activeTape();
    if(!game||!tape)return;
    isOpen=true;
    wake();
    const days=daysLeft(game);
    detail.querySelector('.shelf-detail-kicker').textContent=[genreOf(game),game.platform].filter(Boolean).join(' / ');
    detail.querySelector('.shelf-detail-title').textContent=game.title;
    detail.querySelector('.shelf-detail-meta').textContent=[game.team,game.minutes?(english()?`${game.minutes} min`:`약 ${game.minutes}분`):'',game.slots?`${english()?'Players':'모집'} ${game.applicants||0}/${game.slots}`:'',game.deadline?`${english()?'Feedback due':'피드백 마감'} ${game.deadline}${days!==null&&days>=0?` (D-${days})`:''}`:''].filter(Boolean).join(' · ');
    detail.querySelector('.shelf-detail-teaser').textContent=game.teaser||'';
    detail.querySelector('.shelf-detail-question p').textContent=game.feedbackFocus||'';
    detail.querySelector('.shelf-detail-question').hidden=!game.feedbackFocus||game.feedbackFocus===game.teaser;
    detail.querySelector('.shelf-detail-cta').dataset.id=game.id;
    for(const circle of blobs)circle.setAttribute('r',0);
    await posterArt(game);
    const rect=tape.cover.getBoundingClientRect();
    detail.hidden=false;
    detail.style.transformOrigin=`${rect.left+rect.width/2}px ${rect.top+rect.height/2}px`;
    document.documentElement.classList.add('shelf-detail-open');
    const quick=reduced.matches;
    detail.animate([{clipPath:insetFrom(rect),transform:'rotate(-4.5deg)'},{clipPath:'inset(0 0 0 0 round 0)',transform:'rotate(0)'}],
      {duration:quick?1:1050,easing:SHEET_EASE,fill:'both'});
    [...detail.querySelectorAll('.shelf-detail-copy .shelf-mask>*')].forEach((line,index)=>{
      line.animate([{transform:'translateY(110%)'},{transform:'translateY(0)'}],{duration:quick?1:900,delay:quick?0:620+index*75,easing:EASE,fill:'both'});
    });
    const start=performance.now()+(quick?-5000:520);
    grow(start);
    detail.querySelector('.shelf-close').focus({preventScroll:true});
  }
  function closeDetail(keepPage) {
    if(!isOpen)return;
    const tape=activeTape();
    const rect=tape?.cover.getBoundingClientRect();
    const finish=()=>{
      detail.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
      detail.hidden=true;
      isOpen=false;
      wake();
      document.documentElement.classList.remove('shelf-detail-open');
      if(keepPage!==true)viewport.focus({preventScroll:true});
    };
    if(keepPage===true||!rect||reduced.matches){finish();return;}
    detail.animate([{clipPath:'inset(0 0 0 0 round 0)',transform:'rotate(0)'},{clipPath:insetFrom(rect),transform:'rotate(-4.5deg)'}],
      {duration:850,easing:SHEET_EASE,fill:'both'}).finished.then(finish,finish);
  }

  // ---------- Mount into the app's home page ----------
  let workspaces;
  function capture() {
    if(main.dataset.page!=='home'||document.documentElement.dataset.layout==='original'){
      cursor.classList.remove('is-visible');
      return;
    }
    const spotlight=main.querySelector('.spotlight:not(.shelf-hero)');
    if(!spotlight)return;
    const before=games.map(game=>game.id).join();
    spotlight.replaceWith(hero);
    if(loadGames(main).map(game=>game.id).join()!==before||!tapes.length)build();
    workspaces?.dispose?.();
    workspaces=mosaicSection(loadGames(main),{english:english(),onBrowse:()=>{
      const heading=main.querySelector('.recruit-section h2');
      if(!heading)return;
      heading.tabIndex=-1;
      heading.focus({preventScroll:true});
      heading.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    }});
    // The mosaic introduces the service, so it sits above the recruiting list.
    main.querySelector('.recruit-section')?.before(workspaces);
    requestAnimationFrame(()=>{measure();cacheBox();active=-1;caption(0);wake();});
  }
  hero.prepend(grain);
  document.body.append(cursor,detail);
  const renders=new MutationObserver(capture);
  renders.observe(main,{childList:true});
  const layoutChanged=event=>{grain.hidden=event.detail==='original';if(event.detail!=='original')capture();};
  window.addEventListener('indietest-preview-layout',layoutChanged);
  capture();
  wake();
  if(!fine.matches)cursor.hidden=true;

  return ()=>{
    cancelAnimationFrame(frame);
    cancelAnimationFrame(blobFrame);
    renders.disconnect();
    shelfMedia.dispose();
    detachMenu();
    seen.disconnect();
    workspaces?.dispose?.();
    window.removeEventListener('scroll',onScroll);
    document.removeEventListener('visibilitychange',onVisibility);
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',endDrag);
    window.removeEventListener('keydown',onKey);
    window.removeEventListener('resize',resize);
    window.removeEventListener('indietest-preview-layout',layoutChanged);
    grain.remove();cursor.remove();detail.remove();
  };
}
