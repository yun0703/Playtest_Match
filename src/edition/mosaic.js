// Concept 5 · Playtest mosaic
// Replaces the tester and developer blocks: an oversized headline with both calls to
// action on the left, and three columns of game tiles that drift up and down forever on
// the right. Tiles show the cover images developers uploaded; games without uploads fall
// back to their concept art. Solid tiles carry live numbers from the catalogue.
import {createMediaHydrator} from '../media-store.js';

const ART={t1:0,t2:1,t3:2,t4:3,t5:4,t6:5,t7:1,t8:0};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EXPO='cubic-bezier(.16,1,.3,1)';

function pictures(games) {
  const list=games.map(game=>{
    const cover=game.media?.find(item=>item.kind==='image'&&item.cover)||game.media?.find(item=>item.kind==='image');
    if(cover)return {title:game.title,media:cover.id};
    return {title:game.title,art:Object.hasOwn(ART,game.id)?'shelf-art-'+ART[game.id]:'shelf-art-default'};
  });
  // Early on, when few games exist, pad the wall with the service's own game artwork.
  for(const art of ['shelf-art-default','shelf-art-0','shelf-art-3','shelf-art-5','shelf-art-1','shelf-art-4','shelf-art-2'])
    if(list.length<7)list.push({title:'',art});
  return list;
}

function photoTile(picture) {
  const inner=picture.media
    ?`<img data-media-id="${esc(picture.media)}" alt="">`
    :`<span class="shelf-art ${picture.art}"></span>`;
  return `<div class="mosaic-cell mosaic-photo">${inner}${picture.title?`<span class="mosaic-tag">${esc(picture.title)}</span>`:''}</div>`;
}
function solidTile(colour,stat) {
  return `<div class="mosaic-cell mosaic-solid mosaic-${colour}">${stat?`<strong>${esc(stat[0])}</strong><span>${esc(stat[1])}</span>`:''}</div>`;
}

export function mosaicSection(games,{english=false,onBrowse}={}) {
  const pics=pictures(games);
  const pic=index=>photoTile(pics[index%pics.length]);
  const players=games.reduce((sum,game)=>sum+(Number(game.applicants)||0),0);
  const teams=new Set(games.map(game=>game.team).filter(Boolean)).size;
  const pad=value=>String(value).padStart(2,'0');
  const stats=english
    ?[[pad(games.length),'Recruiting now'],[pad(players),'Players joined'],[pad(teams),'Studios']]
    :[[pad(games.length),'모집 중인 게임'],[pad(players),'참여한 플레이어'],[pad(teams),'개발팀']];
  // Before the first game arrives, the number tiles stay as plain colour blocks.
  if(!games.length)stats.fill(null);
  const columns=[
    [pic(0),solidTile('yellow',stats[0]),pic(1),solidTile('ink'),pic(2)],
    [solidTile('cream'),pic(3),solidTile('vermillion',stats[1]),pic(4),solidTile('cobalt')],
    [pic(5),solidTile('ink',stats[2]),pic(6),solidTile('yellow'),pic(7)]
  ];
  const section=document.createElement('section');
  section.className='mosaic';
  section.setAttribute('aria-labelledby','mosaic-title');
  const lines=english?['Play it','before','it ships.']:['출시 전 게임을','가장 먼저','플레이하세요.'];
  section.innerHTML=`
    <div class="mosaic-copy">
      <p class="mosaic-kicker">${english?'For players & developers':'플레이어와 개발자를 위해'}</p>
      <h2 class="mosaic-title" id="mosaic-title">${lines.map(line=>`<span class="mosaic-line"><span>${esc(line)}</span></span>`).join('')}</h2>
      <p class="mosaic-body">${!games.length?(english?'IndieTest is an archive of games still in the making. Post your build and be the first game players meet here.':'IndieTest는 아직 만들어지고 있는 게임들의 아카이브예요. 지금 게임을 올리면, 플레이어가 이곳에서 가장 먼저 만나는 게임이 돼요.'):english
        ?`IndieTest is an archive of games still in the making. Right now <b>${games.length} games</b> are waiting for their first players, and every answer goes straight to the people building them.`
        :`IndieTest는 아직 만들어지고 있는 게임들의 아카이브예요. 지금 <b>${games.length}개의 게임</b>이 첫 플레이어를 기다리고, 남긴 소감은 만드는 사람에게 바로 전해져요.`}</p>
      <div class="mosaic-actions">
        <button type="button" class="btn" data-mosaic-browse>${english?'Browse playtests':'모집 중인 게임 보기'}</button>
        <a class="mosaic-link" href="#developer" data-nav="developer" data-sub="new"><span>${english?'Post your game':'내 게임 등록하기'}</span><i aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 12 L12 4 M5 4 H12 V11" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></i></a>
      </div>
    </div>
    <div class="mosaic-grid" aria-hidden="true">
      ${columns.map((cells,index)=>`<div class="mosaic-col mosaic-c${index+1}"><div class="mosaic-track">${cells.join('')}${cells.join('')}</div></div>`).join('')}
    </div>`;
  section.querySelector('[data-mosaic-browse]').addEventListener('click',()=>onBrowse?.());

  const media=createMediaHydrator();
  void media.hydrate(section);

  // Entrance once, then keep the columns paused while the section is off screen.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let entered=false;
  const observer=new IntersectionObserver(([entry])=>{
    section.classList.toggle('is-paused',!entry.isIntersecting);
    if(!entry.isIntersecting||entered)return;
    entered=true;
    section.classList.add('is-entered');
    if(reduced)return;
    section.querySelectorAll('.mosaic-line>span').forEach((line,index)=>
      line.animate([{transform:'translateY(110%)'},{transform:'translateY(0)'}],{duration:1000,delay:150+index*85,easing:EXPO,fill:'both'}));
    section.querySelectorAll('.mosaic-kicker,.mosaic-body,.mosaic-actions>*').forEach((element,index)=>
      element.animate([{transform:'translateY(14px)',clipPath:'inset(0 0 100% 0)'},{transform:'translateY(0)',clipPath:'inset(0 0 0 0)'}],{duration:900,delay:420+index*90,easing:EXPO,fill:'both'}));
    section.querySelectorAll('.mosaic-col').forEach((column,index)=>
      column.animate([{transform:`translateY(${index%2?'-':''}12%)`,clipPath:'inset(0 0 100% 0)'},{transform:'translateY(0)',clipPath:'inset(0 0 0 0)'}],{duration:1400,delay:200+index*120,easing:EXPO,fill:'both'}));
  },{threshold:.15});
  observer.observe(section);
  section.dispose=()=>{observer.disconnect();media.dispose();};
  return section;
}
