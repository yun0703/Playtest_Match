export const GENRES=['퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨'];

export const OTHER_GENRE='그 외';

export function gameGenreSelection(game){
  return {
    genres:game?.genres??(GENRES.includes(game?.genre)?[game.genre]:[]),
    customGenres:game?.customGenres??[]
  };
}

export function matchesGenre(game,genre){
  if(genre==='전체')return true;
  const {genres,customGenres}=gameGenreSelection(game);
  return genre===OTHER_GENRE?customGenres.length>0:genres.includes(genre);
}
