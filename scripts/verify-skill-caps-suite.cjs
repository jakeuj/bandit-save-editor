'use strict';
const P=require('./random-character-skill-caps-proof.cjs');
// Initial proof is a separate merge, never the same-fingerprint migration write-back.
// A has no native matrix, so even fabricated all-true results cannot pass this entry.
function mergeProof({catalog,proof,results,coreSource}){
 P.requireNativeRunner();
 throw Error('B 階段須先定義並驗證完整初次矩陣清單；尚未開放證明合併');
}
if(require.main===module){try{P.requireNativeRunner();throw Error('初次矩陣尚未完成');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={mergeProof};
