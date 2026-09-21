const STANDARD_BLINDS=[[10,20],[15,30],[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000],[750,1500],[1000,2000]];
const STORAGE_KEY='ftp_blind_structure';

function validBlindLevel(level){
 return Array.isArray(level)&&level.length>=2&&Number.isInteger(Number(level[0]))&&Number.isInteger(Number(level[1]))&&Number(level[0])>0&&Number(level[1])>Number(level[0]);
}

function storedBlindStructure(){
 try{
  const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(!Array.isArray(value)||value.length<2||!value.every(validBlindLevel))return STANDARD_BLINDS;
  return value.map(level=>[Number(level[0]),Number(level[1])]);
 }catch{return STANDARD_BLINDS}
}

export function selectedBlindStructure(){return storedBlindStructure()}
