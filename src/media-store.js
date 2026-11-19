let remoteMedia=null;
export function configureRemoteMedia(adapter){remoteMedia=adapter;}
const DB_NAME='playtest-match-media-v1';
const IMAGE_TYPES=['image/jpeg','image/png','image/webp','image/gif'];
const VIDEO_TYPES=['video/mp4','video/webm'];
export const IMAGE_LIMIT=5*1024*1024,VIDEO_LIMIT=50*1024*1024;
export function validateMedia(existing,files,{imagesOnly=false,maxImages=6,maxVideos=1}={}){
 let images=existing.filter(m=>m.kind==='image').length,videos=existing.filter(m=>m.kind==='video').length;
 for(const file of files){
  const image=IMAGE_TYPES.includes(file.type),video=VIDEO_TYPES.includes(file.type);
  if(!image&&(!video||imagesOnly))return '지원하지 않는 파일 형식입니다.';
  if(!file.size||file.size>(image?IMAGE_LIMIT:VIDEO_LIMIT))return image?'이미지는 파일당 5MB 이하만 업로드할 수 있습니다.':'영상은 파일당 50MB 이하만 업로드할 수 있습니다.';
  image?images++:videos++;
 }
 if(images>maxImages||videos>maxVideos)return imagesOnly?'스크린샷은 한 장만 첨부할 수 있습니다.':'스크린샷 최대 6장, 영상 최대 1개까지 등록할 수 있습니다.';
 return '';
}
let database;
function openDatabase(){
 if(!globalThis.indexedDB)return Promise.reject(new Error('파일 저장소를 사용할 수 없습니다. 브라우저 설정을 확인해 주세요.'));
 if(database)return database;
 database=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};request.onerror=()=>{database=null;reject(request.error);};request.onblocked=()=>{database=null;reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'));};});
 return database;
}
async function transaction(mode,action){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);let result;try{result=action(tx.objectStore('files'));}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('파일을 저장하지 못했습니다.'));});}
export async function saveMedia(items){if(!items.length)return;if(remoteMedia)return remoteMedia.saveMedia(items);await transaction('readwrite',store=>{for(const item of items)store.put({id:item.id,blob:item.file});});}
export async function removeMedia(ids){if(!ids.length)return;if(remoteMedia)return remoteMedia.removeMedia(ids);await transaction('readwrite',store=>{for(const id of ids)store.delete(id);});}
export function mediaMetadata(item){return {id:remoteMedia?remoteMedia.pathFor(item.id,item.scope):item.id,name:item.name,kind:item.kind,type:item.type,size:item.size,cover:!!item.cover};}
export function stageMedia(files){return files.map(file=>({id:crypto.randomUUID(),name:file.name,kind:file.type.startsWith('image/')?'image':'video',type:file.type,size:file.size,file,url:URL.createObjectURL(file)}));}
export function releaseStaged(items){for(const item of items)if(item.url)URL.revokeObjectURL(item.url);}
export function createMediaHydrator(){
 const urls=new Map();let disposed=false;
 async function urlFor(id){if(!urls.has(id))urls.set(id,(remoteMedia?remoteMedia.getMedia(id).then(blob=>({blob})):transaction('readonly',store=>store.get(id))).then(record=>{if(!record?.blob)return null;const url=URL.createObjectURL(record.blob);if(disposed){URL.revokeObjectURL(url);return null;}return url;}).catch(()=>null));return urls.get(id);}
 async function hydrate(root){
  if(!root?.querySelectorAll)return;
  await Promise.all([...root.querySelectorAll('[data-media-id]')].map(async element=>{
   if(element.getAttribute('src'))return;
   const url=await urlFor(element.dataset.mediaId);
   if(disposed||!element.isConnected)return;
   if(url)element.src=url;else {element.hidden=true;const note=element.parentElement.querySelector('.media-unavailable');if(note)note.hidden=false;}
  }));
 }
 return {hydrate,dispose(){disposed=true;for(const promise of urls.values())Promise.resolve(promise).then(url=>{if(url)URL.revokeObjectURL(url);});urls.clear();}};
}
